import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, Search, Save, RotateCcw, Users, Check, X, Pencil, ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth, URA_API } from '../context/AuthContext';
import { employeeAPI } from '../services/api';
import { TABS, FIXED_ACCOUNTS, defaultTabsFor, roleForId, cleanTabs } from '../config/tabs';
import { Btn, Notice, Panel, ToolHeader, card, font, inputStyle, SpinStyle } from './tools/shared';

const ROLE_LABEL = { employee: 'Employee', hr: 'HR', it: 'IT', manager: 'Manager', dashboard: 'Dashboard viewer' };
const MAX_RESULTS = 60;

const AccessControl = () => {
  const { user, refreshTabAccess } = useAuth();
  const [people, setPeople] = useState([]);          // { id, name, department, role, fixed }
  const [overrides, setOverrides] = useState({});    // empId -> { tabs, name, updatedBy, updatedAt }
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);      // ids
  const [tabs, setTabs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);              // { type, text }

  const api = useCallback(async (path, method = 'GET', body) => {
    const r = await fetch(`${URA_API}${path}`, {
      method, headers: { 'Content-Type': 'application/json', 'x-user-role': user?.role || '', 'x-user-id': user?.empId || '' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.success === false) throw new Error(j.error || `Request failed (${r.status})`);
    return j;
  }, [user]);

  const loadOverrides = useCallback(async () => {
    try {
      const j = await api('/tab-access');
      setOverrides(Object.fromEntries(j.records.map(r => [String(r.empId), r])));
      setOffline(false);
    } catch (e) { setOffline(true); }
  }, [api]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let list = [];
      try { list = await employeeAPI.getAll(); } catch (_) {}
      setPeople([
        ...FIXED_ACCOUNTS.map(a => ({ id: a.id, name: a.name, department: 'Shared login', role: a.role, fixed: true })),
        ...list.map(e => ({ id: String(e.id).trim(), name: e.name, department: e.department || '', designation: e.designation || '', role: 'employee' })),
      ]);
      await loadOverrides();
      setLoading(false);
    })();
  }, [loadOverrides]);

  const byId = useMemo(() => Object.fromEntries(people.map(p => [p.id, p])), [people]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q ? people.filter(p => p.fixed || overrides[p.id]) : people.filter(p =>
      p.id.toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q) || (p.department || '').toLowerCase().includes(q));
    return list.slice(0, MAX_RESULTS);
  }, [people, query, overrides]);

  const currentTabsOf = (id) => overrides[id]?.tabs || defaultTabsFor(roleForId(id));

  // Selecting exactly one person loads their current access into the editor.
  const select = (id, additive) => {
    setMsg(null);
    setSelected(sel => {
      const next = additive ? (sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]) : [id];
      if (next.length === 1) setTabs(currentTabsOf(next[0]));
      if (next.length === 0) setTabs([]);
      return next;
    });
  };
  const toggleTab = (id) => setTabs(t => (t.includes(id) ? t.filter(x => x !== id) : cleanTabs([...t, id])));

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      await api('/tab-access', 'PUT', { entries: selected.map(id => ({ empId: id, name: byId[id]?.name || null })), tabs });
      await loadOverrides();
      if (selected.includes(user?.empId)) refreshTabAccess();
      setMsg({ type: 'success', text: `Saved for ${selected.length} ${selected.length > 1 ? 'people' : 'person'}. They'll see the change next time they open or switch back to SmartDesk.` });
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    setBusy(false);
  };
  const resetToDefault = async (ids = selected) => {
    setBusy(true); setMsg(null);
    try {
      for (const id of ids) await api(`/tab-access/${encodeURIComponent(id)}`, 'DELETE'); // eslint-disable-line no-await-in-loop
      await loadOverrides();
      if (ids.length === 1 && selected.length === 1 && selected[0] === ids[0]) setTabs(defaultTabsFor(roleForId(ids[0])));
      setMsg({ type: 'success', text: `${ids.length} ${ids.length > 1 ? 'people are' : 'person is'} back to the default tabs for their role.` });
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    setBusy(false);
  };

  const customList = Object.values(overrides).sort((a, b) => String(a.empId).localeCompare(String(b.empId)));
  const single = selected.length === 1 ? selected[0] : null;
  const singleRole = single ? roleForId(single) : null;
  const sameAsDefault = single && cleanTabs(tabs).join() === defaultTabsFor(singleRole).join();
  const chip = (on) => ({ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, fontFamily: font.body, fontSize: '.72rem', fontWeight: 600,
    background: on ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--bg-elevated)', color: on ? 'var(--accent)' : 'var(--text-muted)', border: '1px solid var(--border)' });

  return (
    <div style={{ paddingBottom: 32 }}>
      <SpinStyle />
      <ToolHeader icon={KeyRound} title="Access Control" subtitle="Choose which tabs each employee (or shared login) can see. Admins always see everything." />
      {offline && <div style={{ marginBottom: 14 }}><Notice>The User Rights service (port 5093) isn't reachable, so access can't be loaded or saved. Start <code>backend-userrights</code> and refresh.</Notice></div>}

      <div className="ac-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 0.9fr) minmax(0, 1.4fr)', gap: 16, alignItems: 'start' }}>
        {/* People */}
        <Panel title="1 · Choose employees" right={selected.length > 0 && <button type="button" onClick={() => { setSelected([]); setTabs([]); }} style={{ border: 'none', background: 'none', color: 'var(--text-muted)', fontFamily: font.body, fontSize: '.74rem', cursor: 'pointer', textDecoration: 'underline' }}>Clear selection</button>}>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input style={{ ...inputStyle, paddingLeft: 34 }} value={query} onChange={e => setQuery(e.target.value)} placeholder="Employee code, name or department…" autoFocus />
          </div>
          <div style={{ fontFamily: font.body, fontSize: '.72rem', color: 'var(--text-muted)', marginBottom: 8 }}>
            {query ? `${results.length}${results.length === MAX_RESULTS ? '+' : ''} match${results.length === 1 ? '' : 'es'}` : 'Shared logins and people with custom access — search to find anyone else.'} Tick boxes to set several at once.
          </div>
          <div style={{ maxHeight: 520, overflowY: 'auto', margin: '0 -6px', padding: '0 6px' }}>
            {loading && <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 14, fontFamily: font.body, fontSize: '.8rem', color: 'var(--text-muted)' }}><Loader2 size={15} className="tools-spin" />Loading employees…</div>}
            {!loading && results.length === 0 && <div style={{ padding: 14, fontFamily: font.body, fontSize: '.8rem', color: 'var(--text-muted)' }}>No one matches “{query}”.</div>}
            {results.map(p => {
              const on = selected.includes(p.id);
              const custom = !!overrides[p.id];
              return (
                <div key={p.id} onClick={() => select(p.id, false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 10, cursor: 'pointer', marginBottom: 4,
                  background: on ? 'color-mix(in srgb, var(--accent) 10%, var(--bg-card))' : 'transparent', border: `1px solid ${on ? 'var(--accent)' : 'transparent'}`, transition: 'background .15s' }}>
                  <input type="checkbox" checked={on} onClick={e => e.stopPropagation()} onChange={() => select(p.id, true)} title="Add to selection" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '.8rem', fontWeight: 700, color: 'var(--accent)' }}>{p.id}</span>
                      <span style={{ fontFamily: font.head, fontWeight: 700, fontSize: '.82rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    </div>
                    <div style={{ fontFamily: font.body, fontSize: '.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.department || '—'}</div>
                  </div>
                  <span style={chip(custom)}>{custom ? `Custom · ${overrides[p.id].tabs.length}` : 'Default'}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Tabs editor */}
        <Panel title="2 · Tabs they can see">
          {selected.length === 0 ? (
            <div style={{ padding: '30px 10px', textAlign: 'center', fontFamily: font.body, fontSize: '.84rem', color: 'var(--text-muted)' }}>
              <Users size={28} style={{ opacity: .5, marginBottom: 8 }} /><div>Pick one or more employees on the left.</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {selected.map(id => (
                  <span key={id} style={{ ...chip(true), fontSize: '.76rem' }}>
                    {id}{byId[id]?.name ? ` · ${byId[id].name}` : ''}
                    <button type="button" onClick={() => select(id, true)} style={{ border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex' }}><X size={12} /></button>
                  </span>
                ))}
              </div>
              {single && (
                <div style={{ fontFamily: font.body, fontSize: '.78rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                  Role: <b>{ROLE_LABEL[singleRole]}</b> · currently {overrides[single] ? <b style={{ color: 'var(--accent)' }}>custom access</b> : 'using the role defaults'}
                  {sameAsDefault && overrides[single] && <> (same as default)</>}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <span style={{ fontFamily: font.body, fontSize: '.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', alignSelf: 'center' }}>Quick set:</span>
                <Btn variant="ghost" onClick={() => setTabs(TABS.map(t => t.id))}>All tabs</Btn>
                <Btn variant="ghost" onClick={() => setTabs(defaultTabsFor('employee'))}>Standard employee</Btn>
                <Btn variant="ghost" onClick={() => setTabs(['home'])}>Home only</Btn>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
                {TABS.map(t => {
                  const on = tabs.includes(t.id);
                  return (
                    <button key={t.id} type="button" onClick={() => toggleTab(t.id)} style={{ ...card, boxShadow: 'none', textAlign: 'left', cursor: 'pointer', padding: '12px 14px', display: 'flex', gap: 11, alignItems: 'flex-start',
                      borderColor: on ? 'var(--accent)' : 'var(--border)', background: on ? 'color-mix(in srgb, var(--accent) 8%, var(--bg-card))' : 'var(--bg-card)', transition: 'all .15s' }}>
                      <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: on ? 'var(--accent)' : 'transparent', border: `1.5px solid ${on ? 'var(--accent)' : 'var(--text-muted)'}`, color: '#fff', transition: 'all .15s' }}>{on && <Check size={13} strokeWidth={3} />}</span>
                      <span>
                        <span style={{ display: 'block', fontFamily: font.head, fontWeight: 700, fontSize: '.84rem', color: 'var(--text-primary)' }}>{t.label}</span>
                        <span style={{ display: 'block', fontFamily: font.body, fontSize: '.72rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{t.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 16 }}>
                <Btn icon={Save} busy={busy} disabled={!tabs.length || offline} onClick={save}>Save for {selected.length} {selected.length > 1 ? 'people' : 'person'}</Btn>
                <Btn variant="ghost" icon={RotateCcw} disabled={busy || offline || !selected.some(id => overrides[id])} onClick={() => resetToDefault(selected.filter(id => overrides[id]))}>Reset to role default</Btn>
                {!tabs.length && <span style={{ fontFamily: font.body, fontSize: '.76rem', color: 'var(--danger)' }}>Tick at least one tab.</span>}
              </div>
            </>
          )}
          {msg && <div style={{ marginTop: 12 }}><Notice type={msg.type}>{msg.text}</Notice></div>}
        </Panel>
      </div>

      {/* Everyone with custom access */}
      <Panel title={`People with custom access (${customList.length})`} style={{ marginTop: 16 }}>
        {customList.length === 0 ? (
          <div style={{ fontFamily: font.body, fontSize: '.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={16} /> Nobody yet — everyone sees the default tabs for their role.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: font.body, fontSize: '.8rem', minWidth: 720 }}>
              <thead><tr>{['Code', 'Name', 'Tabs', 'Changed by', ''].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid var(--border)' }}>{h}</th>)}</tr></thead>
              <tbody>
                {customList.map(r => (
                  <tr key={r.empId} style={{ borderBottom: '1px solid var(--chart-grid)' }}>
                    <td style={{ padding: '8px 10px', fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, color: 'var(--accent)' }}>{r.empId}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-primary)', fontWeight: 600 }}>{r.name || byId[r.empId]?.name || '—'}</td>
                    <td style={{ padding: '8px 10px' }}><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{r.tabs.map(t => <span key={t} style={chip(true)}>{TABS.find(x => x.id === t)?.label || t}</span>)}</div></td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{r.updatedBy || '—'}{r.updatedAt ? ` · ${new Date(r.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}</td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <span style={{ display: 'inline-flex', gap: 6 }}>
                        <Btn variant="ghost" icon={Pencil} onClick={() => { setQuery(r.empId); select(r.empId, false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</Btn>
                        <Btn variant="danger" icon={RotateCcw} disabled={busy} onClick={() => resetToDefault([r.empId])}>Reset</Btn>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <div style={{ fontFamily: font.body, fontSize: '.72rem', color: 'var(--text-muted)', marginTop: 10 }}>
        This controls which tabs appear in each person's sidebar. Inside Live Attendance, employees still only see their own records.
      </div>
      <style>{`@media (max-width: 1000px){ .ac-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
};

export default AccessControl;
