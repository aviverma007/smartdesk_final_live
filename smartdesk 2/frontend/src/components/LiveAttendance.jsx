import React, { useState, useEffect, useCallback, useRef } from 'react';
import { employeeAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

// Dynamically use whatever host the app is running on — works on any machine
const API_HOST = `http://${window.location.hostname}:5092`;
const API = `${API_HOST}/api/attendance`;

const G = {
  card: { background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:14, position:'relative', overflow:'hidden', boxShadow:'var(--shadow-card)' },
  topLine: (c='var(--accent)') => ({ position:'absolute', top:0, left:0, right:0, height:2, background:c, opacity:.7 }),
  label: { fontFamily:"'DM Sans',sans-serif", fontSize:'.7rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.1em', fontWeight:600 },
  val: (c) => ({ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'1.9rem', color:c, lineHeight:1, textShadow:`0 0 20px ${c}60` }),
  sub: { fontFamily:"'DM Sans',sans-serif", fontSize:'.68rem', color:'var(--text-muted)', marginTop:3 },
  input: { background:'rgba(8,14,28,0.7)', border:'1px solid rgba(14,165,233,0.22)', borderRadius:8, padding:'8px 12px', color:'rgba(220,235,255,0.95)', fontFamily:"'DM Sans',sans-serif", fontSize:'.83rem', outline:'none' },
  btn: (bg='color-mix(in srgb, var(--accent) 12%, transparent)', border='color-mix(in srgb, var(--accent) 45%, transparent)', c='var(--accent)') => ({ background:bg, border:`1px solid ${border}`, borderRadius:8, padding:'8px 16px', color:c, fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.78rem', cursor:'pointer', display:'flex', alignItems:'center', gap:6, transition:'all .2s' }),
};

const fmtTime = v => {
  if (!v) return '—';
  // SQL Server datetimes have no timezone — parse as local (IST), not UTC
  // Stripping 'Z' or 'T' suffix forces local interpretation
  const raw = String(v).replace('T', ' ').replace('Z', '').split('.')[0];
  const d = new Date(raw);
  if (isNaN(d)) return '—';
  return d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true });
};
const fmtHours = mins => {
  if (!mins || mins <= 0) return '—';
  const h = Math.floor(mins/60), m = mins%60;
  return `${h}h ${m.toString().padStart(2,'0')}m`;
};
const pct = (a,b) => b ? Math.round((a/b)*100) : 0;

// Theme-aware stat card. `color` is a CSS colour or var(--token); the tint is
// mixed into the card background so it works in both light and dark mode.
const StatCard = ({ label, value, color, sub, icon }) => (
  <div style={{
    background:`color-mix(in srgb, ${color} 7%, var(--bg-card))`,
    border:`1px solid color-mix(in srgb, ${color} 28%, transparent)`,
    borderRadius:14, padding:'18px 20px', position:'relative', overflow:'hidden',
    boxShadow:'var(--shadow-card)', minHeight:118,
  }}>
    <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:color, opacity:.85 }}/>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
      <div style={{ minWidth:0 }}>
        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.68rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.1em', fontWeight:700, marginBottom:10 }}>{label}</div>
        <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'2.1rem', color, lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{value ?? '—'}</div>
        {sub && <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.7rem', color:'var(--text-muted)', marginTop:6 }}>{sub}</div>}
      </div>
      <div style={{ width:42, height:42, flexShrink:0, borderRadius:12, background:`color-mix(in srgb, ${color} 14%, transparent)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{icon}</div>
    </div>
  </div>
);

// Vertical bar chart: hours worked per employee, with gridlines, an 8h
// "full day" reference line, value labels and short-day highlighting.
const FULL_DAY_HOURS = 8;
const HoursBar = ({ data, height = 290 }) => {
  if (!data.length) return null;
  const top = Math.max(12, Math.ceil(Math.max(...data.map(d => d.hours)) / 3) * 3);
  const ticks = Array.from({ length: top / 3 + 1 }, (_, i) => i * 3);
  const y = h => (h / top) * 100;
  return (
    <div style={{ display:'flex', gap:8 }}>
      {/* y-axis */}
      <div style={{ position:'relative', width:26, height, flexShrink:0 }}>
        {ticks.map(t => (
          <span key={t} style={{ position:'absolute', right:0, bottom:`calc(${y(t)}% - 6px)`, fontFamily:"'DM Sans',sans-serif", fontSize:10, color:'var(--chart-label)' }}>{t}h</span>
        ))}
        <span style={{ position:'absolute', right:0, bottom:`calc(${y(FULL_DAY_HOURS)}% - 6px)`, fontFamily:"'DM Sans',sans-serif", fontSize:10, fontWeight:700, color:'var(--chart-3)', background:'var(--bg-card)', paddingLeft:2 }}>{FULL_DAY_HOURS}h</span>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ position:'relative', height }}>
          {ticks.map(t => (
            <div key={t} style={{ position:'absolute', left:0, right:0, bottom:`${y(t)}%`, borderTop:`1px ${t ? 'dashed' : 'solid'} var(--chart-grid)` }}/>
          ))}
          <div style={{ position:'absolute', left:0, right:0, bottom:`${y(FULL_DAY_HOURS)}%`, borderTop:'1.5px dashed var(--chart-3)', opacity:.7, zIndex:1, pointerEvents:'none' }}/>
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'flex-end', gap:'clamp(4px,1.2%,12px)', padding:'0 2px' }}>
            {data.map((d, i) => {
              const short = d.hours < FULL_DAY_HOURS;
              return (
                <div key={i} title={`${d.name || d.code}: ${d.hours.toFixed(1)}h`}
                  style={{ flex:1, maxWidth:56, height:'100%', display:'flex', flexDirection:'column', justifyContent:'flex-end', alignItems:'center' }}>
                  <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, fontWeight:700, color: short ? 'var(--warning)' : 'var(--text-secondary)', marginBottom:3, fontVariantNumeric:'tabular-nums' }}>{d.hours.toFixed(1)}</span>
                  <div style={{ width:'100%', height:`${y(d.hours)}%`, minHeight:3, borderRadius:'6px 6px 2px 2px',
                    background: short ? 'var(--chart-3)' : 'var(--chart-1)', opacity: short ? .85 : 1,
                    animation:`barGrow .7s cubic-bezier(.2,.8,.2,1) ${i * 35}ms both`, transformOrigin:'bottom' }}/>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display:'flex', gap:'clamp(4px,1.2%,12px)', padding:'6px 2px 0' }}>
          {data.map((d, i) => (
            <span key={i} style={{ flex:1, maxWidth:56, textAlign:'center', fontFamily:"'DM Sans',sans-serif", fontSize:10, color:'var(--chart-label)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.code}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

// Generate array of dates between from and to (outside component to avoid stale closure)
const getDatesInRange = (from, to) => {
  const dates = [];
  let cur = new Date(from);
  const end = new Date(to);
  while (cur <= end) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates.slice(0, 31);
};

const LiveAttendance = ({ initEmpCode = '', onCodeUsed }) => {
  const today = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [empCodeSearch, setEmpCodeSearch] = useState('');
  const [attData, setAttData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [dirEmployees, setDirEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const { user, isAdmin, isEmployee } = useAuth();
  const searchRef = useRef(null);

  // Employees can only see their own attendance
  const myEmpCode = isEmployee ? String(user?.empId || '').trim() : null;

  // Pre-fill search — employee sees only their own, admin can use initEmpCode
  useEffect(() => {
    if (myEmpCode) {
      setEmpCodeSearch(myEmpCode);
    } else if (initEmpCode) {
      setEmpCodeSearch(initEmpCode);
      if (onCodeUsed) onCodeUsed();
    }
  }, [initEmpCode, myEmpCode]);
  const isRange = fromDate !== toDate;

  // Load employee directory for name matching
  useEffect(() => {
    employeeAPI.getAll().then(data => setDirEmployees(data || [])).catch(()=>{});
  }, []);

  const getEmpName = useCallback((code) => {
    if (!code) return '—';
    const c = String(code).trim();
    const emp = dirEmployees.find(e =>
      String(e.id||e.employeeId||e.empCode||'').trim() === c ||
      String(e.employee_id||'').trim() === c
    );
    return emp ? emp.name : `EMP-${c}`;
  }, [dirEmployees]);

  const getEmpDept = useCallback((code) => {
    if (!code) return '';
    const c = String(code).trim();
    const emp = dirEmployees.find(e =>
      String(e.id||e.employeeId||e.empCode||'').trim() === c
    );
    return emp?.department || '';
  }, [dirEmployees]);

  const fetchAll = useCallback(async (from, to) => {
    setLoading(true); setError('');
    try {
      const dates = getDatesInRange(from, to);
      const isMulti = dates.length > 1;

      // Fetch all dates in parallel
      const [allEmpResults, liveRes] = await Promise.all([
        Promise.all(dates.map(d => fetch(`${API}?date=${d}`).then(r=>r.json()))),
        fetch(`${API}/live`).then(r=>r.json()),
      ]);

      // Merge rows across dates
      const allRows = [];
      let totalPresent = 0, firstIn = null, lastIn = null, totalPunches = 0;

      allEmpResults.forEach((empRes, idx) => {
        const d = dates[idx];
        if (!empRes.success) return;
        totalPresent += empRes.count || 0;
        totalPunches += (empRes.data||[]).reduce((s,e) => s + (e.totalPunches||0), 0);
        (empRes.data||[]).forEach(e => {
          if (e.inTime && (!firstIn || e.inTime < firstIn)) firstIn = e.inTime;
          if (e.inTime && (!lastIn  || e.inTime > lastIn))  lastIn  = e.inTime;
          allRows.push({
            empCode: String(e.empCode||e.UserId||'').trim(),
            date: d,
            inTime: e.inTime,
            outTime: e.outTime,
            workMinutes: e.workMinutes || 0,
            totalPunches: e.totalPunches || 0,
          });
        });
      });

      setSummary({
        totalPresent: isMulti ? totalPresent : (allEmpResults[0]?.data?.length || 0),
        firstCheckIn: firstIn,
        lastCheckIn: lastIn,
        totalPunches,
      });
      setAttData(allRows);
      setLiveData(liveRes.live);
      setConnected(true);
      setLastUpdated(new Date());
    } catch(e) {
      setError(e.message);
      setConnected(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(fromDate, toDate); }, [fromDate, toDate, fetchAll]);
  useEffect(() => {
    if (fromDate !== today || toDate !== today) return;
    const t = setInterval(() => fetchAll(fromDate, toDate), 60000);
    return () => clearInterval(t);
  }, [fromDate, toDate, fetchAll, today]);

  // Enrich with directory data
  const enriched = attData.map(r => ({
    ...r,
    empName: getEmpName(r.empCode),
    department: getEmpDept(r.empCode),
    hoursWorked: r.workMinutes > 0 ? r.workMinutes/60 : 0,
  }));

  // Sort by latest punch in time — most recent first
  const sorted = [...enriched].sort((a, b) => {
    const ta = a.inTime ? new Date(String(a.inTime).replace('T',' ').replace('Z','')) : new Date(0);
    const tb = b.inTime ? new Date(String(b.inTime).replace('T',' ').replace('Z','')) : new Date(0);
    return tb - ta;
  });

  // Employees: locked to their own empCode only
  const filtered = sorted.filter(e => {
    const code = e.empCode.toLowerCase();
    const name = e.empName.toLowerCase();
    if (myEmpCode) return code === myEmpCode.toLowerCase();
    if (!empCodeSearch) return true;
    return code.includes(empCodeSearch.toLowerCase()) || name.includes(empCodeSearch.toLowerCase());
  });

  // Excel export
  const exportExcel = () => {
    const rows = filtered.map(e => ({
      'Employee Code': e.empCode,
      'Employee Name': e.empName,
      'Department': e.department,
      'Date': e.date || fromDate,
      'Punch In': fmtTime(e.inTime),
      'Punch Out': fmtTime(e.outTime),
      'Total Hours': fmtHours(e.workMinutes),
      'Total Punches': e.totalPunches,
    }));
    const header = Object.keys(rows[0]||{});
    const csv = [header.join(','), ...rows.map(r => header.map(h => `"${r[h]||''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type:'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const fname = isRange
      ? `attendance_${fromDate}_to_${toDate}${empCodeSearch?'_'+empCodeSearch:''}.csv`
      : `attendance_${fromDate}${empCodeSearch?'_'+empCodeSearch:''}.csv`;
    a.download = fname;
    a.click();
  };

  // Top hours workers for chart
  const topHours = [...enriched].sort((a,b)=>b.hoursWorked-a.hoursWorked).slice(0,12);

  return (
    <div style={{ paddingBottom:32 }}>

      {/* ── HEADER ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'1.25rem', color:'var(--text-primary)', margin:0 }}>
            Live Attendance Dashboard
          </h2>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.75rem', color:'var(--text-muted)', marginTop:3 }}>
            eTimeTracklite · 192.168.66.33 · etimetracklite1AI
            {isRange ? ` · ${fromDate} → ${toDate}` : ` · ${fromDate}`}
            {lastUpdated && ` · Updated ${lastUpdated.toLocaleTimeString()}`}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {/* From date */}
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 10px' }}>
            <label style={{ ...G.label, whiteSpace:'nowrap', fontSize:'.65rem', color:'var(--accent)' }}>FROM</label>
            <input type="date" value={fromDate} max={toDate}
              onChange={e => { setFromDate(e.target.value); if(e.target.value > toDate) setToDate(e.target.value); }}
              style={{ background:'transparent', border:'none', outline:'none', color:'var(--text-primary)', fontFamily:"'DM Sans',sans-serif", fontSize:'.82rem' }}/>
          </div>
          {/* Arrow */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          {/* To date */}
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 10px' }}>
            <label style={{ ...G.label, whiteSpace:'nowrap', fontSize:'.65rem', color:'var(--accent)' }}>TO</label>
            <input type="date" value={toDate} min={fromDate} max={today}
              onChange={e => setToDate(e.target.value)}
              style={{ background:'transparent', border:'none', outline:'none', color:'var(--text-primary)', fontFamily:"'DM Sans',sans-serif", fontSize:'.82rem' }}/>
          </div>
          {isRange && (
            <div style={{ padding:'5px 10px', borderRadius:6, background:'var(--info-bg)', border:'1px solid var(--border)', fontFamily:"'DM Sans',sans-serif", fontSize:'.72rem', color:'var(--accent)', fontWeight:600, whiteSpace:'nowrap' }}>
              {getDatesInRange(fromDate, toDate).length} days
            </div>
          )}
          {/* Refresh */}
          <button style={G.btn()} onClick={()=>fetchAll(fromDate, toDate)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Refresh
          </button>
          {/* Live indicator */}
          <div style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:20, background: connected?'var(--success-bg)':'var(--danger-bg)', border:`1px solid ${connected?'color-mix(in srgb, var(--success) 40%, transparent)':'color-mix(in srgb, var(--danger) 40%, transparent)'}` }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:connected?'var(--success)':'var(--danger)', animation:'dotPulse 2s ease-in-out infinite' }}/>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.72rem', color:connected?'var(--success)':'var(--danger)', fontWeight:700 }}>{connected?'Live':'Disconnected'}</span>
          </div>
        </div>
      </div>

      {/* ── ERROR ── */}
      {error && (
        <div style={{ background:'var(--danger-bg)', border:'1px solid color-mix(in srgb, var(--danger) 40%, transparent)', borderRadius:10, padding:'14px 18px', marginBottom:20 }}>
          <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.82rem', color:'var(--danger)', marginBottom:4 }}>⚠ Connection Error</div>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.78rem', color:'var(--text-secondary)', lineHeight:1.5, marginBottom:8 }}>{error}</div>
          <code style={{ fontFamily:'monospace', fontSize:'.72rem', background:'var(--bg-elevated)', padding:'4px 8px', borderRadius:4, color:'var(--text-secondary)' }}>cd backend-attendance && npm install && npm start</code>
        </div>
      )}

      {/* ── LOADING ── */}
      {loading && !summary && (
        <div style={{ display:'flex', justifyContent:'center', padding:'80px 0', flexDirection:'column', alignItems:'center', gap:14 }}>
          <div style={{ width:36, height:36, border:'3px solid var(--chart-track)', borderTop:'3px solid var(--accent)', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.8rem', color:'var(--text-muted)' }}>Fetching attendance data...</div>
        </div>
      )}

      {summary && (
        <>
          {/* ── LIVE TICKER — admin only ── */}
          {liveData && !myEmpCode && (
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12, padding:'10px 18px', marginBottom:18, display:'flex', alignItems:'center', gap:24, flexWrap:'wrap', boxShadow:'var(--shadow-sm)', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'var(--accent)', opacity:.6 }}/>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--success)', animation:'dotPulse 1.5s ease-in-out infinite' }}/>
                <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'.78rem', color:'var(--accent)', letterSpacing:'.05em' }}>LIVE TODAY</span>
              </div>
              {[
                { label:'Currently In', val:liveData.presentCount, color:'var(--success)' },
                { label:'Total Punches', val:liveData.totalPunches, color:'var(--accent)' },
                { label:'Last Punch', val:liveData.lastCheckIn ? fmtTime(liveData.lastCheckIn) : '—', color:'var(--text-primary)' },
              ].map(({label,val,color})=>(
                <div key={label} style={{ display:'flex', gap:6, alignItems:'baseline' }}>
                  <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.72rem', color:'var(--text-secondary)' }}>{label}:</span>
                  <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.85rem', color }}>{val}</span>
                </div>
              ))}
            </div>
          )}
          {/* Employee personal live status */}
          {myEmpCode && filtered.length > 0 && (
            <div style={{ background:'color-mix(in srgb, var(--accent) 8%, var(--bg-card))', border:'1px solid var(--border)', borderRadius:12, padding:'10px 18px', marginBottom:18, display:'flex', alignItems:'center', gap:20, flexWrap:'wrap', boxShadow:'var(--shadow-sm)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--success)', animation:'dotPulse 1.5s ease-in-out infinite' }}/>
                <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'.78rem', color:'var(--accent)' }}>MY ATTENDANCE TODAY</span>
              </div>
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.78rem', color:'var(--text-secondary)' }}>Punch In: <strong style={{color:'var(--success)'}}>{fmtTime(filtered[0]?.inTime)}</strong></span>
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.78rem', color:'var(--text-secondary)' }}>Punch Out: <strong style={{color:'var(--info)'}}>{fmtTime(filtered[0]?.outTime)}</strong></span>
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.78rem', color:'var(--text-secondary)' }}>Hours: <strong style={{color:'var(--chart-4)'}}>{fmtHours(filtered[0]?.workMinutes)}</strong></span>
            </div>
          )}

          {/* ── STAT CARDS — employee sees own data, admin sees all ── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:14, marginBottom:18 }}>
            {myEmpCode ? (
              // Employee view — personal stats only
              <>
                <StatCard label="My Punch In" value={filtered[0] ? fmtTime(filtered[0].inTime) : '—'} color="var(--chart-1)" sub={isRange ? `${fromDate} → ${toDate}` : fromDate} icon="🕐"/>
                <StatCard label="My Punch Out" value={filtered[0] ? fmtTime(filtered[0].outTime) : '—'} color="var(--chart-2)" sub="Last recorded punch" icon="🕕"/>
                <StatCard label="Hours Worked" value={filtered[0] ? fmtHours(filtered[0].workMinutes) : '—'} color="var(--chart-4)" sub="Total today" icon="⏱"/>
                <StatCard label="Total Punches" value={filtered[0]?.totalPunches || '—'} color="var(--chart-3)" sub="Device logs today" icon="📍"/>
              </>
            ) : (
              // Admin view — global stats
              <>
                <StatCard label="Total Present" value={summary.totalPresent} color="var(--chart-1)" sub={isRange ? `${fromDate} → ${toDate}` : fromDate} icon="✅"/>
                <StatCard label="Total Punches" value={summary.totalPunches} color="var(--chart-3)" sub="All device logs" icon="📍"/>
                <StatCard label="Employees on Floor" value={liveData?.presentCount||'—'} color="var(--chart-4)" sub="Currently punched in today" icon="🏢"/>
                <StatCard label="Unique Employees" value={[...new Set(enriched.map(e=>e.empCode))].length} color="var(--chart-2)" sub="Distinct employees" icon="👥"/>
              </>
            )}
          </div>

          {/* ── CHARTS ROW — admin only ── */}
          {!myEmpCode && <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) 300px', gap:14, marginBottom:18, alignItems:'stretch' }}>



            {/* Hours bar chart */}
            <div style={{ ...G.card, padding:'16px' }}>
              <div style={G.topLine('var(--chart-1)')}/>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:14, gap:12, flexWrap:'wrap' }}>
                <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.85rem', color:'var(--text-primary)' }}>Hours Worked — Top {topHours.length} Employees</div>
                <div style={{ display:'flex', gap:14, fontFamily:"'DM Sans',sans-serif", fontSize:'.7rem', color:'var(--text-muted)' }}>
                  <span style={{ display:'flex', alignItems:'center', gap:5 }}><i style={{ width:10, height:10, borderRadius:3, background:'var(--chart-1)' }}/>Full day (≥ {FULL_DAY_HOURS}h)</span>
                  <span style={{ display:'flex', alignItems:'center', gap:5 }}><i style={{ width:10, height:10, borderRadius:3, background:'var(--chart-3)' }}/>Short day</span>
                </div>
              </div>
              {topHours.length > 0 ? <HoursBar data={topHours.map(e=>({code:e.empCode,name:e.empName,hours:e.hoursWorked}))} /> : (
                <div style={{ textAlign:'center', padding:'60px 0', fontFamily:"'DM Sans',sans-serif", fontSize:'.8rem', color:'var(--text-muted)' }}>Hours data requires complete in/out punches</div>
              )}
            </div>

            {/* Punch timeline */}
            <div style={{ ...G.card, padding:'16px' }}>
              <div style={G.topLine('var(--chart-2)')}/>
              <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.85rem', color:'var(--text-primary)', marginBottom:2 }}>Punch-in Timeline</div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.7rem', color:'var(--text-muted)', marginBottom:12 }}>Employees by first punch hour</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {(() => {
                  // Build all hours that have punches + always show 06-20
                  const allHours = Array.from({length:15}, (_,i) => i+6); // 06 to 20
                  const counts = allHours.map(h => enriched.filter(e => e.inTime && new Date(String(e.inTime).replace('T',' ').replace('Z','')).getHours() === h).length);
                  const maxCnt = Math.max(...counts, 1);
                  return allHours.map((h, i) => {
                    const cnt = counts[i];
                    const label = `${String(h).padStart(2,'0')}:00`;
                    const pct = (cnt/maxCnt)*100;
                    return (
                      <div key={h} style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.68rem', color: cnt > 0 ? 'var(--text-secondary)' : 'var(--chart-label)', width:38, flexShrink:0, fontWeight: cnt > 0 ? 700 : 400, fontVariantNumeric:'tabular-nums' }}>{label}</span>
                        <div style={{ flex:1, height:8, borderRadius:4, background:'var(--chart-track)', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${pct}%`, background: cnt === maxCnt ? 'var(--chart-1)' : 'var(--chart-2)', borderRadius:4, transition:'width .8s cubic-bezier(.2,.8,.2,1)', minWidth: cnt > 0 ? 6 : 0 }}/>
                        </div>
                        <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.7rem', color:'var(--text-secondary)', width:22, textAlign:'right', fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{cnt > 0 ? cnt : ''}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>}

          {/* ── EMPLOYEE TABLE ── */}
          <div style={{ ...G.card }}>
            <div style={G.topLine()}/>
            {/* Table header + filters */}
            <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
              <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.82rem', color:'var(--text-primary)' }}>
              {myEmpCode ? `My Attendance — ${myEmpCode}` : 'Employee Attendance Records'}
            </div>
              {!myEmpCode && <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                {/* Employee Code search */}
                <div style={{ display:'flex', alignItems:'center', gap:7, background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, padding:'7px 12px', minWidth:200 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input
                    ref={searchRef}
                    value={empCodeSearch}
                    onChange={e=>setEmpCodeSearch(e.target.value)}
                    placeholder="Employee Code / Name..."
                    style={{ background:'transparent', border:'none', outline:'none', color:'var(--text-primary)', fontFamily:"'DM Sans',sans-serif", fontSize:'.82rem', width:'100%' }}
                  />
                  {empCodeSearch && <span onClick={()=>setEmpCodeSearch('')} style={{ color:'var(--text-muted)', cursor:'pointer', fontSize:14, lineHeight:1 }}>✕</span>}
                </div>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.75rem', color:'var(--text-muted)' }}>{filtered.length} records</span>
                {/* Excel download */}
                <button style={G.btn('var(--success-bg)','color-mix(in srgb, var(--success) 45%, transparent)','var(--success)')} onClick={exportExcel} disabled={!filtered.length}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Download Excel
                </button>
              </div>}
              {myEmpCode && (
                <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
                  <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.75rem', color:'var(--text-muted)' }}>{filtered.length} records</span>
                  <button style={G.btn('var(--success-bg)','color-mix(in srgb, var(--success) 45%, transparent)','var(--success)')} onClick={exportExcel} disabled={!filtered.length}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download My Attendance
                  </button>
                </div>
              )}
            </div>

            {/* Table */}
            <div style={{ overflowX:'auto', maxHeight:420, overflowY:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
                <thead style={{ position:'sticky', top:0, zIndex:2 }}>
                  <tr style={{ background:'var(--bg-elevated)', borderBottom:'1px solid var(--border)' }}>
                    {['Employee Code','Employee Name','Department','Date','Punch In','Punch Out','Hours Worked','Punches'].map(h=>(
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.67rem', color:'var(--text-muted)', letterSpacing:'.1em', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0,300).map((emp, i) => (
                    <tr key={i}
                      style={{ borderBottom:'1px solid var(--chart-grid)', transition:'background .15s' }}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                    >
                      <td style={{ padding:'9px 14px', fontFamily:"'Share Tech Mono',monospace", fontSize:'.8rem', color:'var(--accent)', fontWeight:700 }}>{emp.empCode}</td>
                      <td style={{ padding:'9px 14px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.82rem', color:'var(--text-primary)', whiteSpace:'nowrap' }}>{emp.empName}</td>
                      <td style={{ padding:'9px 14px', fontFamily:"'DM Sans',sans-serif", fontSize:'.78rem', color:'var(--text-secondary)' }}>{emp.department||'—'}</td>
                      <td style={{ padding:'9px 14px', fontFamily:"'Share Tech Mono',monospace", fontSize:'.75rem', color:'var(--text-secondary)' }}>
                        <div>{emp.date||fromDate}</div>
                        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.66rem', color:'var(--text-muted)', fontWeight:600, marginTop:2 }}>
                          {new Date((emp.date||fromDate)+'T00:00:00').toLocaleDateString('en-IN',{weekday:'long'})}
                        </div>
                      </td>
                      <td style={{ padding:'9px 14px', fontFamily:"'Share Tech Mono',monospace", fontSize:'.78rem', color: emp.inTime ? 'var(--success)' : 'var(--text-muted)' }}>{fmtTime(emp.inTime)}</td>
                      <td style={{ padding:'9px 14px', fontFamily:"'Share Tech Mono',monospace", fontSize:'.78rem', color: emp.outTime && emp.outTime !== emp.inTime ? 'var(--info)' : 'var(--text-muted)' }}>{emp.outTime && emp.outTime !== emp.inTime ? fmtTime(emp.outTime) : '—'}</td>
                      <td style={{ padding:'9px 14px', fontFamily:"'Share Tech Mono',monospace", fontSize:'.78rem', color: emp.workMinutes>0 ? (emp.workMinutes < 480 ? 'var(--warning)' : 'var(--text-primary)') : 'var(--text-muted)', fontWeight: emp.workMinutes>0 ? 700 : 400 }}>{fmtHours(emp.workMinutes)}</td>
                      <td style={{ padding:'9px 14px', textAlign:'center' }}>
                        <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'.75rem', padding:'2px 8px', borderRadius:10, background:'var(--info-bg)', border:'1px solid var(--border)', color:'var(--accent)' }}>{emp.totalPunches}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && !loading && (
                <div style={{ textAlign:'center', padding:'40px 0', fontFamily:"'DM Sans',sans-serif", fontSize:'.85rem', color:'var(--text-muted)' }}>
                  {empCodeSearch ? `No records found for "${empCodeSearch}"` : 'No attendance records for this date'}
                </div>
              )}
            </div>
          </div>

          <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes barGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}} @keyframes dotPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:.6}}`}</style>
        </>
      )}
    </div>
  );
};

export default LiveAttendance;
