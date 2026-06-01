import React, { useState, useEffect, useRef, useCallback } from 'react';
import { employeeAPI } from '../services/api';

const GROQ_API_KEY = process.env.REACT_APP_GROQ_API_KEY || "";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const POLICIES = [
  "Working Hours & Attendance Policy","Sexual Harassment Policy","Dress Code Policy",
  "Leave Policy","Employee Referral Policy","Local Conveyance Policy","Tour Travel Policy",
  "IT Security Policy","Data Protection Policy","Acceptable Use Policy",
];

const NAV_ITEMS = [
  { id:'home',             label:'Home',              sub:'Dashboard & Quick Links' },
  { id:'directory',        label:'Employee Directory', sub:'Search all employees' },
  { id:'attendance',       label:'Live Attendance',   sub:'Real-time attendance data' },
  { id:'holiday-calendar', label:'Holiday Calendar',  sub:'View holidays 2026' },
  { id:'dashboard',        label:'Power BI Dashboard', sub:'Analytics & reports' },
  { id:'policies',         label:'Policies',           sub:'HR, Admin, IT policies' },
];

const GlobalSearch = ({ onClose }) => {
  const [query, setQuery]             = useState('');
  const [results, setResults]         = useState([]);
  const [employees, setEmployees]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [aiAnswer, setAiAnswer]       = useState('');
  const [aiLoading, setAiLoading]     = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [recent, setRecent]           = useState(() => JSON.parse(localStorage.getItem('sd-recent-search') || '[]'));
  const inputRef   = useRef(null);
  const timerRef   = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    setLoading(true);
    employeeAPI.getAll()
      .then(data => { setEmployees(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // ── Local instant search ───────────────────────────────────────────────────
  useEffect(() => {
    if (!query.trim()) { setResults([]); setSelectedIdx(0); setAiAnswer(''); return; }
    const q = query.toLowerCase();

    const empResults = employees.filter(e =>
      (e.name || '').toLowerCase().includes(q) ||
      (e.department || '').toLowerCase().includes(q) ||
      (e.grade || '').toLowerCase().includes(q) ||
      (e.location || '').toLowerCase().includes(q) ||
      String(e.id || '').toLowerCase().includes(q)
    ).slice(0, 5).map(e => ({
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

  // ── Groq AI search — debounced 600ms ─────────────────────────────────────
  const askGroq = useCallback(async (q) => {
    if (!q || q.length < 3) { setAiAnswer(''); return; }
    setAiLoading(true);
    setAiAnswer('');
    try {
      // Build context from loaded employees (first 60)
      const empContext = employees.slice(0, 60).map(e =>
        `${e.name} | ID:${e.id} | ${e.designation} | ${e.department} | ${e.location}`
      ).join('\n');

      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama3-8b-8192',
          messages: [
            {
              role: 'system',
              content: `You are SmartDesk AI, the assistant for Smart World Developers' internal portal.
Answer questions concisely in 1-3 sentences. You have access to:
- Employee directory (935 employees): ${empContext}
- Pages: Home, Employee Directory, Live Attendance, Holiday Calendar, Power BI Dashboard, Policies
- Policies: ${POLICIES.join(', ')}
- Company: Smart World Developers (real estate), offices: IFC, Sales Gallery, etc.
If asked about general topics (weather, news, etc.), answer briefly from your knowledge.
If asked about employees, search the directory above.
Keep answers short and helpful.`
            },
            { role: 'user', content: q }
          ],
          max_tokens: 200,
          temperature: 0.7,
        })
      });
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || '';
      setAiAnswer(text.trim());
    } catch (e) {
      setAiAnswer('');
    }
    setAiLoading(false);
  }, [employees]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!query.trim() || query.length < 3) { setAiAnswer(''); setAiLoading(false); return; }
    timerRef.current = setTimeout(() => askGroq(query), 600);
    return () => clearTimeout(timerRef.current);
  }, [query, askGroq]);

  const handleSelect = (r) => {
    const entry = r.label;
    const updated = [entry, ...recent.filter(x => x !== entry)].slice(0, 6);
    setRecent(updated);
    localStorage.setItem('sd-recent-search', JSON.stringify(updated));
    onClose(r);
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i+1, results.length-1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx(i => Math.max(i-1, 0)); }
    if (e.key === 'Enter' && results[selectedIdx]) handleSelect(results[selectedIdx]);
    if (e.key === 'Escape') onClose(null);
  };

  const TypeIcon = ({ type }) => {
    if (type === 'employee') return <span>👤</span>;
    if (type === 'policy')   return <span>📋</span>;
    return <span>🔗</span>;
  };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:99999, display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:80, background:'rgba(0,0,0,0.35)', backdropFilter:'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose(null)}>
      <div style={{ background:'#ffffff', border:'1px solid rgba(16,93,169,0.3)', borderRadius:16, width:'100%', maxWidth:600, boxShadow:'0 24px 80px rgba(16,93,169,0.2)', overflow:'hidden' }}>

        {/* Input */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', borderBottom:'1px solid #e2e8f0' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#105da9" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKey}
            placeholder="Search anything — employees, policies, or ask AI..."
            style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:'1rem', color:'#0f172a', fontFamily:"'DM Sans',sans-serif" }}/>
          {aiLoading && <div style={{ width:16, height:16, border:'2px solid #dbeafe', borderTop:'2px solid #105da9', borderRadius:'50%', animation:'spin .6s linear infinite', flexShrink:0 }}/>}
          <kbd style={{ fontFamily:'monospace', fontSize:'.7rem', padding:'2px 6px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:5, color:'#64748b' }}>ESC</kbd>
        </div>

        <div style={{ maxHeight:460, overflowY:'auto' }}>

          {/* AI Answer box */}
          {(aiAnswer || aiLoading) && query.length >= 3 && (
            <div style={{ margin:'12px 14px 4px', padding:'12px 14px', background:'linear-gradient(135deg,#eff8ff,#dbeafe)', border:'1px solid rgba(16,93,169,0.2)', borderRadius:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                <div style={{ width:20, height:20, borderRadius:6, background:'linear-gradient(135deg,#105da9,#1a7fd4)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/></svg>
                </div>
                <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.72rem', color:'#105da9', letterSpacing:'.05em' }}>AI ANSWER</span>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.65rem', color:'#94a3b8', marginLeft:'auto' }}>powered by Groq</span>
              </div>
              {aiLoading
                ? <div style={{ display:'flex', gap:4, alignItems:'center', padding:'4px 0' }}>
                    {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'#105da9', opacity:.5, animation:`dotPulse 1.2s ease-in-out ${i*0.2}s infinite` }}/>)}
                    <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.75rem', color:'#64748b', marginLeft:6 }}>Thinking...</span>
                  </div>
                : <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.84rem', color:'#1e3a5f', lineHeight:1.6, margin:0 }}>{aiAnswer}</p>
              }
            </div>
          )}

          {/* Recent */}
          {!query && recent.length > 0 && (
            <div style={{ padding:'10px 18px 6px' }}>
              <div style={{ fontSize:'.65rem', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, color:'#94a3b8', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:8 }}>Recent</div>
              {recent.map((r,i) => (
                <div key={i} onClick={() => setQuery(r)}
                  style={{ padding:'7px 10px', borderRadius:8, display:'flex', alignItems:'center', gap:10, cursor:'pointer', color:'#475569', fontSize:'.85rem' }}
                  onMouseEnter={e=>e.currentTarget.style.background='#f0f7ff'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <span>🕐</span>{r}
                </div>
              ))}
            </div>
          )}

          {!query && (
            <div style={{ padding:'14px 18px', fontSize:'.82rem', color:'#94a3b8', fontFamily:"'DM Sans',sans-serif", lineHeight:1.8 }}>
              <div style={{ fontWeight:600, color:'#64748b', marginBottom:6 }}>Try searching for:</div>
              {['how is the weather?', 'who is in IT?', 'Leave Policy', 'Anirudh Verma', 'attendance page', 'IFC employees'].map(s => (
                <span key={s} onClick={() => setQuery(s)}
                  style={{ display:'inline-block', margin:'3px 4px', padding:'3px 10px', background:'#f0f7ff', border:'1px solid rgba(16,93,169,0.2)', borderRadius:20, fontSize:'.75rem', color:'#105da9', cursor:'pointer', fontWeight:600 }}>
                  {s}
                </span>
              ))}
            </div>
          )}

          {query && results.length === 0 && !aiLoading && !aiAnswer && (
            <div style={{ padding:'28px 18px', textAlign:'center' }}>
              <div style={{ fontSize:'2rem', marginBottom:8 }}>🔍</div>
              <div style={{ color:'#64748b', fontSize:'.9rem' }}>No portal results for "<strong>{query}</strong>"</div>
              <div style={{ color:'#94a3b8', fontSize:'.78rem', marginTop:4 }}>AI answer loading above...</div>
            </div>
          )}

          {/* Local results */}
          {results.length > 0 && (
            <div style={{ padding:'6px 0' }}>
              {results.length > 0 && <div style={{ padding:'6px 18px 4px', fontSize:'.65rem', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, color:'#94a3b8', letterSpacing:'.12em', textTransform:'uppercase' }}>Portal Results</div>}
              {results.map((r,i) => (
                <div key={i} onClick={() => handleSelect(r)}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 18px', cursor:'pointer',
                    background: i===selectedIdx ? '#f0f7ff' : 'transparent',
                    borderLeft: i===selectedIdx ? '3px solid #105da9' : '3px solid transparent', transition:'all .1s' }}
                  onMouseEnter={() => setSelectedIdx(i)}>
                  <div style={{ width:34, height:34, borderRadius:9, background: i===selectedIdx ? 'rgba(16,93,169,0.12)':'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                    <TypeIcon type={r.type}/>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'.85rem', fontWeight:700, color:'#0f172a', fontFamily:"'Plus Jakarta Sans',sans-serif", whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.label}</div>
                    <div style={{ fontSize:'.72rem', color:'#64748b' }}>{r.sub}</div>
                  </div>
                  <span style={{ fontSize:'.65rem', padding:'2px 8px', borderRadius:20,
                    background: r.type==='employee'?'#dbeafe': r.type==='policy'?'#dcfce7':'#f3e8ff',
                    color: r.type==='employee'?'#1d4ed8': r.type==='policy'?'#166534':'#7c3aed',
                    fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, textTransform:'capitalize' }}>
                    {r.type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding:'8px 18px', borderTop:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', gap:16, fontSize:'.65rem', color:'#94a3b8' }}>
            <span>↑↓ navigate</span><span>↵ select</span><span>ESC close</span>
          </div>
          <div style={{ fontSize:'.65rem', color:'#105da9', fontWeight:600 }}>
            {loading ? '⏳ Loading...' : `${employees.length} employees · AI by Groq`}
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes dotPulse{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.4);opacity:1}}`}</style>
    </div>
  );
};

export default GlobalSearch;
