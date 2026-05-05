import React, { useState, useEffect, useCallback } from 'react';

const API = 'http://localhost:5001/api/attendance';

const STATUS_MAP = {
  P:'Present', PR:'Present', A:'Absent', AB:'Absent',
  L:'Leave', LV:'Leave', WO:'Weekly Off', WH:'Weekly Off',
  HD:'Half Day', OD:'On Duty', MT:'Muster'
};
const STATUS_COLOR = {
  Present: '#4ade80', Absent: '#f472b6', Leave: '#60a5fa',
  'Weekly Off': '#9b6dff', 'Half Day': '#fbbf24', 'On Duty': '#2dd4bf', Muster: '#94a3b8'
};

const fmt = (v) => v ? new Date(v).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true }) : '—';
const pct = (a, b) => b ? Math.round((a / b) * 100) : 0;

const StatCard = ({ label, value, color, sub }) => (
  <div style={{
    background:'rgba(10,16,32,0.72)',
    backdropFilter:'blur(16px)',
    WebkitBackdropFilter:'blur(16px)',
    border:`1px solid ${color}50`,
    borderRadius:12, padding:'16px 20px',
    position:'relative', overflow:'hidden',
    boxShadow:`0 4px 20px rgba(0,0,0,0.3), 0 0 12px ${color}18`
  }}>
    <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${color},transparent)`, opacity:.9 }}/>
    <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.72rem', color:'rgba(180,200,230,0.8)', marginBottom:6, textTransform:'uppercase', letterSpacing:'.1em', fontWeight:600 }}>{label}</div>
    <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'2rem', color, lineHeight:1, textShadow:`0 0 16px ${color}80` }}>{value ?? '—'}</div>
    {sub && <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.7rem', color:'rgba(150,180,220,0.7)', marginTop:4 }}>{sub}</div>}
  </div>
);

const DeptBar = ({ dept, present, total, absent }) => {
  const p = pct(present, total);
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
        <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.8rem', color:'var(--text-primary)' }}>{dept}</span>
        <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.78rem', color: p >= 80 ? '#4ade80' : p >= 60 ? '#fbbf24' : '#f472b6' }}>{present}/{total} ({p}%)</span>
      </div>
      <div style={{ height:6, borderRadius:6, background:'var(--bg-elevated)', overflow:'hidden' }}>
        <div style={{ height:'100%', borderRadius:6, width:`${p}%`, background: p >= 80 ? '#4ade80' : p >= 60 ? '#fbbf24' : '#f472b6', transition:'width .8s ease', boxShadow:`0 0 8px ${p >= 80 ? '#4ade8060' : p >= 60 ? '#fbbf2460' : '#f472b660'}` }}/>
      </div>
    </div>
  );
};

const LiveAttendance = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [view, setView] = useState('table');
  const [liveData, setLiveData] = useState(null);

  const fetchAll = useCallback(async (d) => {
    setLoading(true); setError('');
    try {
      const [sumRes, empRes, deptRes, liveRes] = await Promise.all([
        fetch(`${API}/summary?date=${d}`).then(r => r.json()),
        fetch(`${API}?date=${d}`).then(r => r.json()),
        fetch(`${API}/departments?date=${d}`).then(r => r.json()),
        fetch(`${API}/live`).then(r => r.json()),
      ]);
      if (!sumRes.success) throw new Error(sumRes.error);
      setSummary(sumRes.summary);
      setEmployees(empRes.data || []);
      setDepartments(deptRes.departments || []);
      setLiveData(liveRes.live);
      setConnected(true);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e.message);
      setConnected(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(date); }, [date, fetchAll]);

  // Auto-refresh every 60s for today
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (date !== today) return;
    const t = setInterval(() => fetchAll(date), 60000);
    return () => clearInterval(t);
  }, [date, fetchAll]);

  const filtered = employees.filter(e => {
    const s = search.toLowerCase();
    const matchSearch = !s || e.empName?.toLowerCase().includes(s) || e.empCode?.toLowerCase().includes(s) || e.department?.toLowerCase().includes(s);
    const matchDept = !deptFilter || e.department === deptFilter;
    const displayStatus = STATUS_MAP[e.status] || e.status || 'Absent';
    const matchStatus = !statusFilter || displayStatus === statusFilter;
    return matchSearch && matchDept && matchStatus;
  });

  const deptOptions = [...new Set(employees.map(e => e.department).filter(Boolean))].sort();

  return (
    <div style={{ padding:'0 0 32px' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'1.2rem', color:'var(--text-primary)', margin:0 }}>
            Live Attendance
          </h2>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.75rem', color:'var(--text-muted)', marginTop:3 }}>
            eTimeTracklite · 192.168.66.33 · etimetracklite1AI
            {lastUpdated && <span> · Updated {lastUpdated.toLocaleTimeString()}</span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ background:'rgba(8,14,28,0.60)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(14,165,233,0.15)', borderRadius:8, padding:'7px 12px', color:'var(--text-primary)', fontFamily:"'DM Sans',sans-serif", fontSize:'.82rem', outline:'none' }}/>
          <button onClick={() => fetchAll(date)} style={{ background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.4)', borderRadius:8, padding:'7px 16px', color:'var(--accent-purple)', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.8rem', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Refresh
          </button>
          {/* Connection status */}
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:20, background: connected ? 'rgba(74,222,128,0.1)' : 'rgba(244,114,182,0.1)', border:`1px solid ${connected ? 'rgba(74,222,128,0.3)' : 'rgba(244,114,182,0.3)'}` }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background: connected ? '#4ade80' : '#f472b6', boxShadow:`0 0 6px ${connected ? '#4ade80' : '#f472b6'}`, animation: connected ? 'dotPulse 2s ease-in-out infinite' : 'none' }}/>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.72rem', color: connected ? '#4ade80' : '#f472b6' }}>{connected ? 'Live' : 'Disconnected'}</span>
          </div>
        </div>
      </div>
      <div style={{ height:1, background:'var(--border)', marginBottom:20 }}/>

      {/* Error */}
      {error && (
        <div style={{ background:'rgba(244,114,182,0.08)', border:'1px solid rgba(244,114,182,0.3)', borderRadius:10, padding:'14px 18px', marginBottom:20 }}>
          <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.82rem', color:'var(--accent-pink)', marginBottom:4 }}>⚠ Connection Error</div>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.78rem', color:'var(--text-secondary)', lineHeight:1.5, marginBottom:8 }}>{error}</div>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.75rem', color:'var(--text-muted)', lineHeight:1.6 }}>
            Make sure the backend is running:<br/>
            <code style={{ background:'var(--bg-elevated)', padding:'2px 6px', borderRadius:4, fontSize:'.72rem' }}>cd backend-attendance && npm install && npm start</code>
          </div>
        </div>
      )}

      {loading && !summary && (
        <div style={{ display:'flex', justifyContent:'center', padding:'60px 0', flexDirection:'column', alignItems:'center', gap:14 }}>
          <div style={{ width:36, height:36, border:'3px solid rgba(139,92,246,0.2)', borderTop:'3px solid var(--accent-purple)', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.8rem', color:'var(--text-muted)' }}>Connecting to SQL Server...</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {summary && (
        <>
          {/* Live ticker */}
          {liveData && (
            <div style={{ background:'linear-gradient(135deg,rgba(124,58,237,0.1),rgba(74,222,128,0.05))', border:'1px solid rgba(139,92,246,0.2)', borderRadius:10, padding:'10px 16px', marginBottom:20, display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'#4ade80', boxShadow:'0 0 8px #4ade80', animation:'dotPulse 1.5s ease-in-out infinite' }}/>
                <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.8rem', color:'var(--text-primary)' }}>LIVE TODAY</span>
              </div>
              {[
                { label:'Currently In', value:liveData.currentlyIn, color:'#4ade80' },
                { label:'Checked Out', value:liveData.checkedOut, color:'#60a5fa' },
                { label:'Last Check-in', value:liveData.lastCheckIn ? fmt(liveData.lastCheckIn) : '—', color:'var(--text-secondary)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.72rem', color:'var(--text-muted)' }}>{label}:</span>
                  <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.82rem', color }}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Stat Cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:12, marginBottom:24 }}>
            <StatCard label="Total Employees" value={summary.totalEmployees} color="var(--accent-purple)" sub="Active staff"/>
            <StatCard label="Present" value={summary.present} color="#4ade80" sub={`${pct(summary.present, summary.totalEmployees)}% attendance`}/>
            <StatCard label="Absent" value={summary.absent} color="#f472b6" sub={`${pct(summary.absent, summary.totalEmployees)}% absenteeism`}/>
            <StatCard label="On Leave" value={summary.onLeave} color="#60a5fa" sub="Approved leaves"/>
            <StatCard label="Weekly Off" value={summary.weeklyOff} color="#9b6dff" sub="Week off"/>
            {summary.halfDay > 0 && <StatCard label="Half Day" value={summary.halfDay} color="#fbbf24" sub="Half day"/>}
            {summary.onDuty > 0 && <StatCard label="On Duty" value={summary.onDuty} color="#2dd4bf" sub="Outside duty"/>}
          </div>

          {/* Attendance Rate big bar */}
          <div style={{ background:'rgba(10,16,32,0.72)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', border:'1px solid rgba(14,165,233,0.20)', borderRadius:12, padding:'16px 20px', marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
              <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.85rem', color:'var(--text-primary)' }}>Overall Attendance Rate</span>
              <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'1rem', color: pct(summary.present, summary.totalEmployees) >= 80 ? '#4ade80' : '#fbbf24' }}>
                {pct(summary.present, summary.totalEmployees)}%
              </span>
            </div>
            <div style={{ height:10, borderRadius:10, background:'var(--bg-elevated)', overflow:'hidden', display:'flex' }}>
              {[
                { val:summary.present, color:'#4ade80' },
                { val:summary.onLeave, color:'#60a5fa' },
                { val:summary.onDuty, color:'#2dd4bf' },
                { val:summary.halfDay, color:'#fbbf24' },
                { val:summary.absent, color:'#f472b6' },
              ].filter(x => x.val > 0).map(({ val, color }, i) => (
                <div key={i} style={{ height:'100%', width:`${pct(val, summary.totalEmployees)}%`, background:color, transition:'width .8s ease' }}/>
              ))}
            </div>
            <div style={{ display:'flex', gap:16, marginTop:8, flexWrap:'wrap' }}>
              {[['#4ade80','Present'],['#60a5fa','Leave'],['#2dd4bf','On Duty'],['#fbbf24','Half Day'],['#f472b6','Absent']].map(([c,l]) => (
                <div key={l} style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:c }}/>
                  <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.68rem', color:'var(--text-muted)' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Department breakdown */}
          {departments.length > 0 && (
            <div style={{ background:'rgba(10,16,32,0.72)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', border:'1px solid rgba(14,165,233,0.20)', borderRadius:12, padding:'16px 20px', marginBottom:20 }}>
              <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.88rem', color:'var(--text-primary)', marginBottom:14 }}>Department Breakdown</div>
              {departments.map(d => <DeptBar key={d.department} dept={d.department} present={d.present} total={d.total} absent={d.absent}/>)}
            </div>
          )}

          {/* Employee table */}
          <div style={{ background:'rgba(10,16,32,0.72)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', border:'1px solid rgba(14,165,233,0.20)', borderRadius:12, overflow:'hidden' }}>
            {/* Filters */}
            <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(8,14,28,0.60)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(14,165,233,0.15)', borderRadius:8, padding:'7px 12px', flex:1, minWidth:160 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee..."
                  style={{ background:'transparent', border:'none', outline:'none', color:'var(--text-primary)', fontFamily:"'DM Sans',sans-serif", fontSize:'.82rem', width:'100%' }}/>
              </div>
              <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                style={{ background:'rgba(8,14,28,0.60)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(14,165,233,0.15)', borderRadius:8, padding:'7px 12px', color:'var(--text-primary)', fontFamily:"'DM Sans',sans-serif", fontSize:'.82rem', outline:'none' }}>
                <option value="">All Departments</option>
                {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                style={{ background:'rgba(8,14,28,0.60)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(14,165,233,0.15)', borderRadius:8, padding:'7px 12px', color:'var(--text-primary)', fontFamily:"'DM Sans',sans-serif", fontSize:'.82rem', outline:'none' }}>
                <option value="">All Status</option>
                {['Present','Absent','Leave','Weekly Off','Half Day','On Duty'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.75rem', color:'var(--text-muted)', marginLeft:'auto' }}>{filtered.length} records</span>
            </div>

            {/* Table */}
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid var(--border)' }}>
                    {['Emp Code','Name','Department','Designation','Status','In Time','Out Time','Duration'].map(h => (
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.68rem', color:'var(--text-muted)', letterSpacing:'.1em', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map((emp, i) => {
                    const displayStatus = STATUS_MAP[emp.status] || emp.status || 'Absent';
                    const color = STATUS_COLOR[displayStatus] || 'var(--text-muted)';
                    return (
                      <tr key={i} style={{ borderBottom:'1px solid var(--border)', transition:'background .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background='rgba(139,92,246,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        <td style={{ padding:'10px 14px', fontFamily:"'Share Tech Mono',monospace", fontSize:'.75rem', color:'var(--accent-purple)' }}>{emp.empCode}</td>
                        <td style={{ padding:'10px 14px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:600, fontSize:'.82rem', color:'var(--text-primary)', whiteSpace:'nowrap' }}>{emp.empName}</td>
                        <td style={{ padding:'10px 14px', fontFamily:"'DM Sans',sans-serif", fontSize:'.78rem', color:'var(--text-secondary)' }}>{emp.department}</td>
                        <td style={{ padding:'10px 14px', fontFamily:"'DM Sans',sans-serif", fontSize:'.75rem', color:'var(--text-muted)', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.designation}</td>
                        <td style={{ padding:'10px 14px' }}>
                          <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.7rem', padding:'3px 10px', borderRadius:20, background:`${color}18`, border:`1px solid ${color}40`, color }}>{displayStatus}</span>
                        </td>
                        <td style={{ padding:'10px 14px', fontFamily:"'Share Tech Mono',monospace", fontSize:'.75rem', color:'var(--text-secondary)' }}>{fmt(emp.inTime)}</td>
                        <td style={{ padding:'10px 14px', fontFamily:"'Share Tech Mono',monospace", fontSize:'.75rem', color:'var(--text-secondary)' }}>{fmt(emp.outTime)}</td>
                        <td style={{ padding:'10px 14px', fontFamily:"'Share Tech Mono',monospace", fontSize:'.75rem', color: emp.workDuration ? 'var(--accent-green)' : 'var(--text-muted)' }}>{emp.workDuration || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)', fontFamily:"'DM Sans',sans-serif", fontSize:'.85rem' }}>No records match the current filters</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LiveAttendance;
