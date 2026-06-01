import React, { useState, useEffect, useRef, useCallback } from 'react';
import { employeeAPI } from '../services/api';

const POLICIES = [
  "Working Hours & Attendance Policy","Sexual Harassment Policy","Dress Code Policy",
  "Leave Policy","Employee Referral Policy","Local Conveyance Policy","Tour Travel Policy",
  "IT Security Policy","Data Protection Policy","Acceptable Use Policy",
];

const NAV_ITEMS = [
  { id:'home',             label:'Home',              sub:'Dashboard & Quick Links' },
  { id:'directory',        label:'Employee Directory', sub:'Search employees' },
  { id:'attendance',       label:'Live Attendance',   sub:'Real-time attendance data' },
  { id:'holiday-calendar', label:'Holiday Calendar',  sub:'View holidays 2026' },
  { id:'dashboard',        label:'Power BI Dashboard', sub:'Analytics reports' },
  { id:'policies',         label:'Policies',           sub:'HR, Admin, IT policies' },
];

const GlobalSearch = ({ onClose }) => {
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState([]);
  const [employees, setEmployees]   = useState([]);
  const [aiAnswer, setAiAnswer]     = useState('');
  const [aiLoading, setAiLoading]   = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [recent, setRecent]         = useState(() => JSON.parse(localStorage.getItem('sd-recent-search') || '[]'));
  const inputRef  = useRef(null);
  const aiTimerRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { employeeAPI.getAll().then(setEmployees).catch(() => {}); }, []);

  // Local search (instant)
  useEffect(() => {
    if (!query.trim()) { setResults([]); setSelectedIdx(0); setAiAnswer(''); return; }
    const q = query.toLowerCase();

    const empResults = employees.filter(e =>
      e.name?.toLowerCase().includes(q) ||
      e.department?.toLowerCase().includes(q) ||
      e.grade?.toLowerCase().includes(q) ||
      String(e.id || '').toLowerCase().includes(q)
    ).slice(0, 4).map(e => ({
      type:'employee', label:e.name,
      sub:`${e.grade || ''} · ${e.department || ''}`, data:e
    }));

    const polResults = POLICIES.filter(p => p.toLowerCase().includes(q)).slice(0, 3)
      .map(p => ({ type:'policy', label:p, sub:'Company Policy' }));

    const navResults = NAV_ITEMS
      .filter(n => n.label.toLowerCase().includes(q) || n.sub.toLowerCase().includes(q))
      .slice(0, 3).map(n => ({ type:'nav', label:n.label, sub:n.sub, navId:n.id }));

    setResults([...empResults, ...polResults, ...navResults]);
    setSelectedIdx(0);
  }, [query, employees]);

  // AI search — debounced 800ms after typing stops
  const askAI = useCallback(async (q) => {
    if (!q || q.length < 4) { setAiAnswer(''); return; }
    setAiLoading(true);
    setAiAnswer('');
    try {
      const empSummary = employees.slice(0, 50).map(e =>
        `${e.name} (ID:${e.id}, Dept:${e.department}, Grade:${e.grade}, Location:${e.location})`
      ).join('\n');

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 300,
          system: `You are SmartDesk AI assistant for Smart World Developers. Answer questions about the company portal concisely in 1-3 sentences. 
Company info: Employee portal with Home, Employee Directory, Live Attendance (from SQL Server), Policies, Holiday Calendar, Dashboard (Power BI).
Sample employees:\n${empSummary}
Policies: ${POLICIES.join(', ')}.
If asked about attendance, mention the Live Attendance page. If asked about employees, mention Employee Directory. Be helpful and concise.`,
          messages: [{ role: "user", content: q }]
        })
      });
      const data = await res.json();
      const text = data?.content?.[0]?.text || '';
      setAiAnswer(text);
    } catch (e) {
      setAiAnswer('Unable to get AI response. Try searching below.');
    }
    setAiLoading(false);
  }, [employees]);

  useEffect(() => {
    clearTimeout(aiTimerRef.current);
    if (!query.trim() || query.length < 4) { setAiAnswer(''); setAiLoading(false); return; }
    aiTimerRef.current = setTimeout(() => askAI(query), 800);
    return () => clearTimeout(aiTimerRef.current);
  }, [query, askAI]);

  const handleSelect = (r) => {
    const entry = r.label;
    const updated = [entry, ...recent.filter(x => x !== entry)].slice(0, 6);
    setRecent(updated);
    localStorage.setItem('sd-recent-search', JSON.stringify(updated));
    onClose(r);
  };

  const onKey = (e) => {
    const list = query ? results : [];
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i+1, list.length-1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx(i => Math.max(i-1, 0)); }
    if (e.key === 'Enter' && list[selectedIdx]) handleSelect(list[selectedIdx]);
    if (e.key === 'Escape') onClose(null);
  };

  const TypeIcon = ({ type }) => {
    if (type === 'employee') return <span style={{fontSize:16}}>👤</span>;
    if (type === 'policy')   return <span style={{fontSize:16}}>📋</span>;
    return <span style={{fontSize:16}}>🔗</span>;
  };

  const list = query ? results : [];

  return (
    <div style={{ position:'fixed', inset:0, zIndex:99999, display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:80, background:'rgba(0,0,0,0.4)', backdropFilter:'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose(null)}>
      <div style={{ background:'var(--bg-sidebar)', border:'1px solid var(--border-hover)', borderRadius:16, width:'100%', maxWidth:600, boxShadow:'0 24px 80px rgba(0,0,0,0.5)', overflow:'hidden' }}>

        {/* Input */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', borderBottom:'1px solid var(--border)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={onKey}
            placeholder="Ask anything — employees, policies, attendance..."
            style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:'1rem', color:'var(--text-primary)', fontFamily:"'DM Sans',sans-serif" }}/>
          {aiLoading && (
            <div style={{ width:16, height:16, border:'2px solid rgba(16,93,169,0.2)', borderTop:'2px solid #105da9', borderRadius:'50%', animation:'spin .6s linear infinite' }}/>
          )}
          <kbd style={{ fontFamily:'monospace', fontSize:'.7rem', padding:'2px 6px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text-muted)' }}>ESC</kbd>
        </div>

        <div style={{ maxHeight:460, overflowY:'auto' }}>

          {/* AI Answer */}
          {(aiAnswer || aiLoading) && query.length >= 4 && (
            <div style={{ margin:'12px 14px 4px', padding:'12px 14px', background:'linear-gradient(135deg,#eff8ff,#dbeafe)', border:'1px solid rgba(16,93,169,0.25)', borderRadius:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                <div style={{ width:20, height:20, borderRadius:6, background:'linear-gradient(135deg,#105da9,#1a7fd4)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/></svg>
                </div>
                <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.72rem', color:'#105da9', letterSpacing:'.05em' }}>AI ANSWER</span>
              </div>
              {aiLoading ? (
                <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'#105da9', opacity:.5, animation:`dotPulse 1.2s ease-in-out ${i*0.2}s infinite` }}/>
                  ))}
                  <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.75rem', color:'#64748b', marginLeft:4 }}>Thinking...</span>
                </div>
              ) : (
                <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.82rem', color:'#1e3a5f', lineHeight:1.55, margin:0 }}>{aiAnswer}</p>
              )}
            </div>
          )}

          {/* Recent */}
          {!query && recent.length > 0 && (
            <div style={{ padding:'10px 18px 6px' }}>
              <div style={{ fontSize:'.65rem', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, color:'var(--text-muted)', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:8 }}>Recent</div>
              {recent.map((r,i) => (
                <div key={i} onClick={()=>setQuery(r)}
                  style={{ padding:'7px 10px', borderRadius:8, display:'flex', alignItems:'center', gap:10, cursor:'pointer', color:'var(--text-secondary)', fontSize:'.85rem' }}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(16,93,169,0.06)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <span style={{fontSize:13}}>🕐</span>{r}
                </div>
              ))}
            </div>
          )}

          {!query && (
            <div style={{ padding:'12px 18px', fontSize:'.8rem', color:'var(--text-muted)', fontFamily:"'DM Sans',sans-serif" }}>
              💡 Try: "who is in IT department", "leave policy", "holiday calendar", "show attendance"
            </div>
          )}

          {query && results.length === 0 && !aiLoading && !aiAnswer && (
            <div style={{ padding:'24px 18px', textAlign:'center', color:'var(--text-muted)', fontSize:'.85rem' }}>No results for "{query}"</div>
          )}

          {/* Results */}
          {list.length > 0 && (
            <div style={{ padding:'8px 0' }}>
              <div style={{ padding:'4px 18px 6px', fontSize:'.65rem', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, color:'var(--text-muted)', letterSpacing:'.12em', textTransform:'uppercase' }}>Results</div>
              {list.map((r,i) => (
                <div key={i} onClick={()=>handleSelect(r)}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 18px', cursor:'pointer', background:i===selectedIdx?'rgba(16,93,169,0.08)':'transparent', borderLeft:i===selectedIdx?'3px solid #105da9':'3px solid transparent', transition:'all .1s' }}
                  onMouseEnter={()=>setSelectedIdx(i)}>
                  <TypeIcon type={r.type}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'.85rem', fontWeight:600, color:'var(--text-primary)', fontFamily:"'Plus Jakarta Sans',sans-serif", whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.label}</div>
                    <div style={{ fontSize:'.72rem', color:'var(--text-muted)', fontFamily:"'DM Sans',sans-serif" }}>{r.sub}</div>
                  </div>
                  <span style={{ fontSize:'.65rem', padding:'2px 8px', borderRadius:20, background:'var(--bg-elevated)', color:'var(--text-muted)', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:600, textTransform:'capitalize' }}>{r.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding:'8px 18px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', gap:16, fontSize:'.65rem', color:'var(--text-muted)', fontFamily:"'DM Sans',sans-serif" }}>
            <span>↑↓ navigate</span><span>↵ select</span><span>ESC close</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:'.65rem', color:'rgba(16,93,169,0.6)', fontFamily:"'DM Sans',sans-serif" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(16,93,169,0.6)"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/></svg>
            AI-powered by Claude
          </div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes dotPulse{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.4);opacity:1}}`}</style>
      </div>
    </div>
  );
};

export default GlobalSearch;
