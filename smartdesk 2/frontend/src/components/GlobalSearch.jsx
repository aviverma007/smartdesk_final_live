import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Sparkles, User, FileText, LayoutGrid, CalendarDays, Globe, ArrowRight, CornerDownLeft, RotateCcw, ExternalLink, Users, Activity, Megaphone, Loader2 } from 'lucide-react';
import { employeeAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { URA_API } from '../config/api';
import { TABS } from '../config/tabs';
import { HOLIDAYS } from '../config/holidays';

/*
 * Global search (Ctrl+K)
 *  • Instant portal results while typing: people, pages, policies, holidays
 *  • "Ask SmartDesk AI" (Claude, via backend-userrights /api/ai/ask): answers from the
 *    directory, live attendance, HR announcements and the policy PDFs, plus web search for
 *    anything outside the company — with sources, people and page shortcuts. Follow-ups keep context.
 */

const POLICIES = [
  'Leave Policy', 'Working Hours & Attendance Policy', 'Business Hours Attendance Policy', 'Revised Attendance Policy',
  'Flexible Work Schedule Policy', 'Dress Code Policy', 'Employee Referral Policy', 'Customer Referral Incentives',
  'Local Conveyance Policy', 'Tour Travel Policy', 'Meal and Conveyance (night site work)', 'Code of Conduct Policy',
  'Sexual Harassment (POSH) Policy', 'Whistleblower Policy', 'IT Policy', 'Holiday List 2026',
];
const SUGGESTIONS = [
  'How many casual leaves do I get?', 'Who is in the IT team?', 'How many people are in office today?',
  "What's the weather in Gurugram?", 'When is the next holiday?', 'Any announcements this week?',
];
const QUESTION = /^(who|what|whats|what's|when|where|which|why|how|is|are|can|could|do|does|did|should|tell|show|list|find|give|explain|summari[sz]e|kya|kaun|kab|kaise|kitne|kitna)\b|\?\s*$/i;
const USED = {
  web_search: { label: 'Web', Icon: Globe }, search_employees: { label: 'Directory', Icon: Users }, directory_stats: { label: 'Headcount', Icon: Users },
  attendance_today: { label: 'Attendance', Icon: Activity }, company_updates: { label: 'Announcements', Icon: Megaphone },
  read_policy: { label: 'Policies', Icon: FileText }, list_policies: { label: 'Policies', Icon: FileText },
};
const STAGES = ['Thinking…', 'Checking SmartDesk data…', 'Searching…', 'Putting the answer together…'];
const font = { head: "'Plus Jakarta Sans',sans-serif", body: "'DM Sans',sans-serif" };

/* Minimal, safe markdown: **bold**, *italic*, `code`, [links](url), bare URLs, bullets, numbered lists, headings */
function Inline({ text }) {
  const parts = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s)]+)/g;
  let last = 0, m, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) parts.push(<strong key={k++}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('`')) parts.push(<code key={k++} className="gs-code">{t.slice(1, -1)}</code>);
    else if (t.startsWith('[')) { const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t); parts.push(<a key={k++} href={mm[2]} target="_blank" rel="noopener noreferrer">{mm[1]}</a>); }
    else if (t.startsWith('http')) parts.push(<a key={k++} href={t} target="_blank" rel="noopener noreferrer">{t.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)}</a>);
    else parts.push(<em key={k++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
function Markdown({ text }) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const out = [];
  let list = null;
  const flush = () => { if (list) { out.push(list.ordered ? <ol key={out.length}>{list.items}</ol> : <ul key={out.length}>{list.items}</ul>); list = null; } };
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const b = /^\s*[-*•]\s+(.*)$/.exec(line), n = /^\s*\d+[.)]\s+(.*)$/.exec(line), h = /^#{1,4}\s+(.*)$/.exec(line);
    if (b || n) {
      const ordered = !!n;
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push(<li key={i}><Inline text={(b || n)[1]} /></li>);
      return;
    }
    flush();
    if (h) out.push(<div key={i} className="gs-h"><Inline text={h[1]} /></div>);
    else if (line.trim()) out.push(<p key={i}><Inline text={line} /></p>);
  });
  flush();
  return <div className="gs-md">{out}</div>;
}
const domainOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const initials = (n = '') => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

const GlobalSearch = ({ onClose }) => {
  const { user, allowedTabs } = useAuth();
  const [query, setQuery] = useState('');
  const [employees, setEmployees] = useState([]);
  const [loadingEmp, setLoadingEmp] = useState(true);
  const [sel, setSel] = useState(0);
  const [thread, setThread] = useState([]);           // [{ q, a?, error?, loading }]
  const [stage, setStage] = useState(0);
  const [aiStatus, setAiStatus] = useState(null);     // { enabled, model } | 'offline'
  const [recent, setRecent] = useState(() => { try { return JSON.parse(localStorage.getItem('sd-recent-search') || '[]'); } catch { return []; } });
  const inputRef = useRef(null);
  const bodyRef = useRef(null);
  const abortRef = useRef(null);
  const asking = thread.some(t => t.loading);
  const inChat = thread.length > 0;

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    employeeAPI.getAll().then(d => setEmployees(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoadingEmp(false));
    fetch(`${URA_API}/ai/status`).then(r => r.json()).then(j => setAiStatus(j.success ? j : 'offline')).catch(() => setAiStatus('offline'));
    return () => abortRef.current && abortRef.current.abort();
  }, []);
  useEffect(() => {
    if (!asking) return undefined;
    setStage(0);
    const t = setInterval(() => setStage(s => Math.min(s + 1, STAGES.length - 1)), 2200);
    return () => clearInterval(t);
  }, [asking]);
  useEffect(() => { if (bodyRef.current && inChat) bodyRef.current.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' }); }, [thread, inChat]);

  /* instant portal results */
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || inChat) return [];
    const words = q.split(/\s+/);
    const emp = employees.filter(e => {
      const hay = `${e.name} ${e.id} ${e.department} ${e.designation || e.grade} ${e.location}`.toLowerCase();
      return words.every(w => hay.includes(w));
    }).slice(0, 5).map(e => ({ type: 'employee', label: e.name, sub: [e.designation || e.grade, e.department, e.location].filter(Boolean).join(' · '), data: e }));
    const pages = TABS.filter(t => allowedTabs.includes(t.id) && `${t.label} ${t.desc}`.toLowerCase().includes(q)).slice(0, 3)
      .map(t => ({ type: 'page', label: t.label, sub: t.desc, navId: t.id }));
    const pols = POLICIES.filter(p => words.every(w => p.toLowerCase().includes(w))).slice(0, 3).map(p => ({ type: 'policy', label: p, sub: 'Company policy · open Policies' }));
    const hols = HOLIDAYS.filter(h => h.name.toLowerCase().includes(q)).slice(0, 2)
      .map(h => ({ type: 'holiday', label: h.name, sub: new Date(h.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }));
    return [...emp, ...pages, ...pols, ...hols];
  }, [query, employees, allowedTabs, inChat]);

  const aiFirst = QUESTION.test(query.trim()) || (query.trim().length > 2 && results.length === 0);
  const items = useMemo(() => {
    if (!query.trim()) return [];
    const ask = { type: 'ask', label: query.trim() };
    if (inChat) return [ask];
    return aiFirst ? [ask, ...results] : [...results, ask];
  }, [query, results, aiFirst, inChat]);
  useEffect(() => { setSel(0); }, [query]);

  const remember = (entry) => {
    const updated = [entry, ...recent.filter(x => x !== entry)].slice(0, 6);
    setRecent(updated);
    try { localStorage.setItem('sd-recent-search', JSON.stringify(updated)); } catch (_) {}
  };

  const ask = async (q) => {
    const question = String(q || '').trim();
    if (!question || asking) return;
    remember(question);
    setQuery('');
    const history = thread.filter(t => t.a).flatMap(t => [{ role: 'user', content: t.q }, { role: 'assistant', content: t.a.answer }]);
    setThread(th => [...th, { q: question, loading: true }]);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const r = await fetch(`${URA_API}/ai/ask`, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-user-role': user?.role || '', 'x-user-id': user?.empId || '' },
        body: JSON.stringify({
          question, history,
          context: {
            userName: user?.name, tabs: allowedTabs,
            holidays: HOLIDAYS.map(h => ({ date: h.date, name: h.name })),
          },
        }),
      });
      let j = {};
      try { j = await r.json(); } catch (_) {}
      if (!r.ok || !j.success) throw new Error(j.error || (r.status === 404 ? 'AI search needs the latest backend-userrights — pull and restart it.' : `The AI service returned an error (${r.status}).`));
      setThread(th => th.map((t, i) => (i === th.length - 1 ? { q: t.q, a: j } : t)));
    } catch (e) {
      if (e.name === 'AbortError') return;
      const msg = /Failed to fetch|NetworkError|offline/i.test(e.message) ? 'Could not reach the SmartDesk server (backend-userrights). Is it running?' : e.message;
      setThread(th => th.map((t, i) => (i === th.length - 1 ? { q: t.q, error: msg } : t)));
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const pick = (it) => {
    if (!it) return;
    if (it.type === 'ask') return ask(it.label);
    remember(it.label);
    if (it.type === 'employee') return onClose({ type: 'employee', navId: 'directory', empId: it.data?.id, empName: it.data?.name, data: it.data });
    if (it.type === 'policy') return onClose({ type: 'nav', navId: 'policies', label: it.label });
    if (it.type === 'holiday') return onClose({ type: 'nav', navId: 'holiday-calendar', label: it.label });
    return onClose({ type: 'nav', navId: it.navId, label: it.label });
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(i => Math.min(i + 1, items.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSel(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); if (inChat) ask(query); else pick(items[sel]); }
    if (e.key === 'Escape') { e.preventDefault(); onClose(null); }
  };
  const reset = () => { abortRef.current && abortRef.current.abort(); setThread([]); setQuery(''); inputRef.current?.focus(); };

  const typeMeta = {
    ask: { Icon: Sparkles, tag: 'Ask AI' }, employee: { Icon: User, tag: 'Person' }, page: { Icon: LayoutGrid, tag: 'Page' },
    policy: { Icon: FileText, tag: 'Policy' }, holiday: { Icon: CalendarDays, tag: 'Holiday' },
  };
  const aiOff = aiStatus === 'offline' || (aiStatus && aiStatus.enabled === false);

  return (
    <div className="gs-overlay" onMouseDown={e => e.target === e.currentTarget && onClose(null)}>
      <div className="gs-modal" role="dialog" aria-label="Search SmartDesk">
        {/* input */}
        <div className="gs-inputrow">
          {asking ? <Loader2 size={18} className="gs-spin gs-accent" /> : inChat ? <Sparkles size={18} className="gs-accent" /> : <Search size={18} className="gs-accent" />}
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKey} aria-label="Search or ask"
            placeholder={inChat ? 'Ask a follow-up…' : 'Search people, pages, policies — or ask anything…'} />
          {inChat && <button type="button" className="gs-ghost" onClick={reset} title="New search"><RotateCcw size={13} />New</button>}
          <kbd className="gs-kbd" onClick={() => onClose(null)}>ESC</kbd>
        </div>

        <div className="gs-body" ref={bodyRef}>
          {/* conversation */}
          {inChat && (
            <div className="gs-thread">
              {thread.map((t, i) => (
                <div key={i} className="gs-turn">
                  <div className="gs-q"><span>{t.q}</span></div>
                  <div className="gs-a">
                    <div className="gs-ahead">
                      <span className="gs-badge"><Sparkles size={11} /></span>
                      <span className="gs-alabel">SmartDesk AI</span>
                      {t.a && (t.a.used || []).filter(u => USED[u]).filter((u, k, a) => a.findIndex(x => USED[x].label === USED[u].label) === k).map(u => {
                        const M = USED[u];
                        return <span key={u} className="gs-used"><M.Icon size={10} />{M.label}</span>;
                      })}
                    </div>
                    {t.loading && (
                      <div className="gs-loading">
                        <div className="gs-shimmer" /><div className="gs-shimmer short" />
                        <span>{STAGES[stage]}</span>
                      </div>
                    )}
                    {t.error && <div className="gs-error">{t.error}</div>}
                    {t.a && (
                      <>
                        <Markdown text={t.a.answer} />
                        {t.a.people && t.a.people.length > 0 && (
                          <div className="gs-people">
                            {t.a.people.map(p => (
                              <button key={p.code} type="button" className="gs-person" onClick={() => onClose({ type: 'employee', navId: 'directory', empId: p.code, empName: p.name })} title={`Open ${p.name} in the directory`}>
                                <span className="gs-av">{initials(p.name)}</span>
                                <span className="gs-ptext"><b>{p.name}</b><span>{[p.designation, p.department].filter(Boolean).join(' · ')}</span></span>
                              </button>
                            ))}
                          </div>
                        )}
                        {((t.a.actions && t.a.actions.length) || (t.a.sources && t.a.sources.length)) ? (
                          <div className="gs-foot">
                            {(t.a.actions || []).filter(a => allowedTabs.includes(a.page) || a.page === 'home').map(a => (
                              <button key={a.page} type="button" className="gs-action" onClick={() => onClose({ type: 'nav', navId: a.page })}>
                                {a.label || `Open ${TABS.find(x => x.id === a.page)?.label || a.page}`}<ArrowRight size={12} />
                              </button>
                            ))}
                            {(t.a.sources || []).map(s => (
                              <a key={s.url} className="gs-source" href={s.url} target="_blank" rel="noopener noreferrer" title={s.title}>
                                <img src={`https://www.google.com/s2/favicons?domain=${domainOf(s.url)}&sz=32`} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />
                                {domainOf(s.url)}<ExternalLink size={10} />
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* typing: ask + portal results */}
          {!inChat && items.length > 0 && (
            <div className="gs-list">
              {items.map((it, i) => {
                const M = typeMeta[it.type];
                const on = i === sel;
                return (
                  <div key={`${it.type}-${it.label}-${i}`} className={`gs-item ${on ? 'on' : ''} ${it.type === 'ask' ? 'ask' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => pick(it)}>
                    <span className={`gs-icon t-${it.type}`}><M.Icon size={15} /></span>
                    <span className="gs-itext">
                      {it.type === 'ask'
                        ? <><b>Ask SmartDesk AI</b><span>“{it.label}” — answers from company data and the web</span></>
                        : <><b>{it.label}</b><span>{it.sub}</span></>}
                    </span>
                    {on ? <CornerDownLeft size={13} className="gs-enter" /> : <span className={`gs-tag t-${it.type}`}>{M.tag}</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* empty state */}
          {!inChat && !query.trim() && (
            <div className="gs-empty">
              {recent.length > 0 && (
                <>
                  <div className="gs-sect">Recent</div>
                  <div className="gs-chips">{recent.map(r => <button key={r} type="button" className="gs-chip ghost" onClick={() => (QUESTION.test(r) ? ask(r) : setQuery(r))}>{r}</button>)}</div>
                </>
              )}
              <div className="gs-sect">Try asking</div>
              <div className="gs-chips">{SUGGESTIONS.map(s => <button key={s} type="button" className="gs-chip" onClick={() => ask(s)}><Sparkles size={11} />{s}</button>)}</div>
            </div>
          )}
          {aiOff && (
            <div className="gs-note">{aiStatus === 'offline'
              ? 'AI answers need the SmartDesk server (backend-userrights). Portal search still works.'
              : 'AI answers are not switched on yet — add ANTHROPIC_API_KEY to backend-userrights/.env and restart it.'}</div>
          )}
        </div>

        <div className="gs-footer">
          <span>↑↓ navigate</span><span>↵ {inChat ? 'ask' : 'select'}</span><span>esc close</span>
          <span className="gs-brand">{loadingEmp ? 'Loading directory…' : `${employees.length} employees`} · AI by Claude</span>
        </div>
      </div>

      <style>{`
        .gs-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:72px 16px 16px;background:rgba(3,10,25,.45);backdrop-filter:blur(6px);animation:gsFade .2s ease}
        @keyframes gsFade{from{opacity:0}}
        .gs-modal{width:100%;max-width:680px;max-height:calc(100vh - 100px);display:flex;flex-direction:column;background:var(--bg-card);border:1px solid var(--border);border-radius:18px;overflow:hidden;
          box-shadow:0 30px 90px rgba(3,20,50,.35),0 0 0 1px color-mix(in srgb,var(--accent) 12%,transparent);animation:gsPop .3s cubic-bezier(.16,1,.3,1)}
        @keyframes gsPop{from{opacity:0;transform:translateY(-10px) scale(.98)}}
        .gs-inputrow{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--border)}
        .gs-inputrow input{flex:1;min-width:0;background:transparent;border:none;outline:none;font-size:1rem;color:var(--text-primary);font-family:${font.body}}
        .gs-inputrow input::placeholder{color:var(--text-muted)}
        .gs-accent{color:var(--accent);flex-shrink:0}
        .gs-spin{animation:spin .8s linear infinite}
        .gs-kbd{font-family:monospace;font-size:.68rem;padding:3px 7px;border-radius:6px;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-muted);cursor:pointer}
        .gs-ghost{display:inline-flex;align-items:center;gap:5px;font-family:${font.head};font-weight:700;font-size:.72rem;padding:5px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-secondary);cursor:pointer}
        .gs-body{overflow-y:auto;flex:1;min-height:0}
        .gs-list{padding:6px 0}
        .gs-item{display:flex;align-items:center;gap:12px;padding:9px 16px;margin:0 6px;border-radius:10px;cursor:pointer;transition:background .12s}
        .gs-item.on{background:color-mix(in srgb,var(--accent) 10%,transparent)}
        .gs-item.ask .gs-itext b{background:linear-gradient(90deg,var(--accent),#7c3aed);-webkit-background-clip:text;background-clip:text;color:transparent}
        .gs-icon{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:var(--bg-elevated);color:var(--text-secondary)}
        .gs-icon.t-ask{background:linear-gradient(135deg,var(--accent),#7c3aed);color:#fff}
        .gs-itext{flex:1;min-width:0;display:flex;flex-direction:column}
        .gs-itext b{font-family:${font.head};font-size:.86rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .gs-itext span{font-family:${font.body};font-size:.72rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .gs-tag{font-family:${font.head};font-weight:700;font-size:.62rem;padding:2px 8px;border-radius:20px;background:var(--bg-elevated);color:var(--text-muted);border:1px solid var(--border)}
        .gs-enter{color:var(--accent)}
        .gs-empty{padding:12px 18px 6px}
        .gs-sect{font-family:${font.head};font-weight:700;font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted);margin:6px 0 8px}
        .gs-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
        .gs-chip{display:inline-flex;align-items:center;gap:6px;font-family:${font.body};font-weight:600;font-size:.76rem;padding:6px 12px;border-radius:20px;cursor:pointer;border:1px solid color-mix(in srgb,var(--accent) 25%,transparent);
          background:color-mix(in srgb,var(--accent) 8%,transparent);color:var(--accent);transition:transform .15s,background .15s}
        .gs-chip:hover{transform:translateY(-1px);background:color-mix(in srgb,var(--accent) 14%,transparent)}
        .gs-chip.ghost{border-color:var(--border);background:var(--bg-elevated);color:var(--text-secondary)}
        .gs-note{margin:8px 16px 12px;padding:9px 12px;border-radius:10px;font-family:${font.body};font-size:.74rem;color:var(--text-secondary);background:var(--bg-elevated);border:1px dashed var(--border)}
        .gs-thread{padding:14px 16px;display:flex;flex-direction:column;gap:16px}
        .gs-turn{display:flex;flex-direction:column;gap:8px;animation:gsPop .35s cubic-bezier(.16,1,.3,1)}
        .gs-q{display:flex;justify-content:flex-end}
        .gs-q span{max-width:85%;font-family:${font.body};font-size:.86rem;padding:8px 13px;border-radius:14px 14px 4px 14px;background:linear-gradient(135deg,#105da9,#1a7fd4);color:#fff}
        .gs-a{padding:12px 14px;border-radius:4px 14px 14px 14px;background:var(--bg-elevated);border:1px solid var(--border)}
        .gs-ahead{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px}
        .gs-badge{width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(135deg,var(--accent),#7c3aed)}
        .gs-alabel{font-family:${font.head};font-weight:800;font-size:.7rem;letter-spacing:.06em;color:var(--accent);text-transform:uppercase}
        .gs-used{display:inline-flex;align-items:center;gap:4px;font-family:${font.body};font-size:.62rem;font-weight:600;padding:2px 7px;border-radius:20px;background:var(--bg-card);border:1px solid var(--border);color:var(--text-muted)}
        .gs-md{font-family:${font.body};font-size:.86rem;line-height:1.6;color:var(--text-primary)}
        .gs-md p{margin:0 0 6px}
        .gs-md ul,.gs-md ol{margin:2px 0 8px;padding-left:20px}
        .gs-md ul{list-style:disc}.gs-md ol{list-style:decimal}
        .gs-md li::marker{color:var(--accent)}
        .gs-md li{margin:2px 0}
        .gs-md strong{font-weight:700;color:var(--text-primary)}
        .gs-md a{color:var(--accent);text-decoration:underline;text-underline-offset:2px}
        .gs-h{font-family:${font.head};font-weight:800;font-size:.86rem;margin:6px 0 4px}
        .gs-code{font-family:monospace;font-size:.8rem;padding:1px 5px;border-radius:5px;background:var(--bg-card);border:1px solid var(--border)}
        .gs-loading{display:flex;flex-direction:column;gap:7px;padding:4px 0}
        .gs-loading span{font-family:${font.body};font-size:.74rem;color:var(--text-muted)}
        .gs-shimmer{height:10px;border-radius:6px;background:linear-gradient(90deg,var(--border) 0%,color-mix(in srgb,var(--accent) 22%,var(--border)) 50%,var(--border) 100%);background-size:200% 100%;animation:gsShim 1.2s linear infinite}
        .gs-shimmer.short{width:60%}
        @keyframes gsShim{from{background-position:200% 0}to{background-position:-200% 0}}
        .gs-error{font-family:${font.body};font-size:.8rem;color:var(--danger);background:var(--danger-bg);border:1px solid color-mix(in srgb,var(--danger) 35%,transparent);padding:8px 10px;border-radius:9px}
        .gs-people{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
        .gs-person{display:flex;align-items:center;gap:8px;padding:5px 10px 5px 5px;border-radius:24px;border:1px solid var(--border);background:var(--bg-card);cursor:pointer;max-width:100%;transition:border-color .15s,transform .15s}
        .gs-person:hover{border-color:var(--accent);transform:translateY(-1px)}
        .gs-av{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:${font.head};font-weight:800;font-size:.62rem;color:#fff;background:linear-gradient(135deg,#105da9,#1a7fd4)}
        .gs-ptext{display:flex;flex-direction:column;min-width:0;text-align:left}
        .gs-ptext b{font-family:${font.head};font-size:.74rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .gs-ptext span{font-family:${font.body};font-size:.64rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}
        .gs-foot{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:10px;padding-top:8px;border-top:1px dashed var(--border)}
        .gs-action{display:inline-flex;align-items:center;gap:5px;font-family:${font.head};font-weight:700;font-size:.72rem;padding:5px 11px;border-radius:8px;border:none;cursor:pointer;color:#fff;background:linear-gradient(135deg,#105da9,#1a7fd4)}
        .gs-source{display:inline-flex;align-items:center;gap:5px;font-family:${font.body};font-size:.68rem;font-weight:600;padding:4px 9px;border-radius:20px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-secondary);text-decoration:none}
        .gs-source:hover{border-color:var(--accent);color:var(--accent)}
        .gs-source img{width:12px;height:12px;border-radius:2px}
        .gs-footer{display:flex;align-items:center;gap:14px;padding:8px 18px;border-top:1px solid var(--border);font-family:${font.body};font-size:.66rem;color:var(--text-muted)}
        .gs-brand{margin-left:auto;font-weight:700;color:var(--accent)}
        @media (max-width:640px){.gs-overlay{padding-top:20px}.gs-footer span:not(.gs-brand){display:none}}
      `}</style>
    </div>
  );
};

export default GlobalSearch;
