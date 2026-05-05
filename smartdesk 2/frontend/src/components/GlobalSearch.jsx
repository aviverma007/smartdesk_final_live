import React, { useState, useEffect, useRef } from 'react';
import { employeeAPI, meetingRoomAPI } from '../services/api';

const POLICIES = [
  "Working Hours & Attendance Policy","Sexual Harassment Policy","Dress Code Policy",
  "Leave Policy","Employee Referral Policy","Local Conveyance Policy","Tour Travel Policy",
  "IT Security Policy","Data Protection Policy","Acceptable Use Policy",
];

const GlobalSearch = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [recent, setRecent] = useState(() => JSON.parse(localStorage.getItem('sd-recent-search') || '[]'));
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    employeeAPI.getAll().then(setEmployees).catch(() => {});
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSelectedIdx(0); return; }
    const q = query.toLowerCase();
    const empResults = employees.filter(e =>
      e.name?.toLowerCase().includes(q) || e.department?.toLowerCase().includes(q) ||
      e.designation?.toLowerCase().includes(q) || (e.employeeId || e.id)?.toString().toLowerCase().includes(q)
    ).slice(0, 4).map(e => ({ type: 'employee', label: e.name, sub: `${e.designation} · ${e.department}`, data: e }));

    const polResults = POLICIES.filter(p => p.toLowerCase().includes(q)).slice(0, 3)
      .map(p => ({ type: 'policy', label: p, sub: 'Company Policy' }));

    const navResults = [
      { id: 'home', label: 'Home', sub: 'Dashboard & Quick Links' },
      { id: 'directory', label: 'Employee Directory', sub: 'Search employees' },
      { id: 'meeting-rooms', label: 'Meeting Rooms', sub: 'Book a room' },
      { id: 'holiday-calendar', label: 'Holiday Calendar', sub: 'View holidays 2026' },
      { id: 'dashboard', label: 'Power BI Dashboard', sub: 'Analytics reports' },
      { id: 'policies', label: 'Policies', sub: 'HR, Admin, IT policies' },
    ].filter(n => n.label.toLowerCase().includes(q) || n.sub.toLowerCase().includes(q))
     .slice(0, 3).map(n => ({ type: 'nav', label: n.label, sub: n.sub, navId: n.id }));

    setResults([...empResults, ...polResults, ...navResults]);
    setSelectedIdx(0);
  }, [query, employees]);

  const handleSelect = (r) => {
    const entry = r.label;
    const updated = [entry, ...recent.filter(x => x !== entry)].slice(0, 6);
    setRecent(updated);
    localStorage.setItem('sd-recent-search', JSON.stringify(updated));
    onClose(r);
  };

  const onKey = (e) => {
    const list = query ? results : [];
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, list.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && list[selectedIdx]) handleSelect(list[selectedIdx]);
    if (e.key === 'Escape') onClose(null);
  };

  const TypeIcon = ({ type }) => {
    if (type === 'employee') return <span style={{ fontSize: 16 }}>👤</span>;
    if (type === 'policy')   return <span style={{ fontSize: 16 }}>📋</span>;
    return <span style={{ fontSize: 16 }}>🔗</span>;
  };

  const list = query ? results : [];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80 }}
      onClick={e => e.target === e.currentTarget && onClose(null)}>
      <div style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-hover)', borderRadius: 16, width: '100%', maxWidth: 560, boxShadow: '0 24px 80px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKey}
            placeholder="Search employees, policies, pages..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '1rem', color: 'var(--text-primary)', fontFamily: "'DM Sans', sans-serif" }} />
          <kbd style={{ fontFamily: 'monospace', fontSize: '.7rem', padding: '2px 6px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-muted)' }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {!query && recent.length > 0 && (
            <div style={{ padding: '10px 18px 6px' }}>
              <div style={{ fontSize: '.65rem', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 8 }}>Recent</div>
              {recent.map((r, i) => (
                <div key={i} onClick={() => setQuery(r)} style={{ padding: '7px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '.85rem' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(139,92,246,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <span style={{ fontSize: 13 }}>🕐</span>{r}
                </div>
              ))}
            </div>
          )}
          {!query && <div style={{ padding: '12px 18px', fontSize: '.8rem', color: 'var(--text-muted)', fontFamily: "'DM Sans', sans-serif" }}>Type to search employees, policies, and more...</div>}
          {query && results.length === 0 && <div style={{ padding: '24px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '.85rem' }}>No results for "{query}"</div>}
          {list.map((r, i) => (
            <div key={i} onClick={() => handleSelect(r)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', cursor: 'pointer', background: i === selectedIdx ? 'rgba(139,92,246,0.1)' : 'transparent', borderLeft: i === selectedIdx ? '2px solid var(--accent-purple)' : '2px solid transparent', transition: 'all .1s' }}
              onMouseEnter={() => setSelectedIdx(i)}>
              <TypeIcon type={r.type} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</div>
                <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', fontFamily: "'DM Sans', sans-serif" }}>{r.sub}</div>
              </div>
              <span style={{ fontSize: '.65rem', padding: '2px 8px', borderRadius: 20, background: 'var(--bg-elevated)', color: 'var(--text-muted)', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, textTransform: 'capitalize' }}>{r.type}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: '8px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, fontSize: '.65rem', color: 'var(--text-muted)', fontFamily: "'DM Sans', sans-serif" }}>
          <span>↑↓ navigate</span><span>↵ select</span><span>ESC close</span>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
