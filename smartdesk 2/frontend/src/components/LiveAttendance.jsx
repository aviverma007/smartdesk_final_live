import React, { useState, useEffect, useCallback, useRef } from 'react';
import { employeeAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

// Dynamically use whatever host the app is running on — works on any machine
const API_HOST = `http://${window.location.hostname}:5082`;
const API = `${API_HOST}/api/attendance`;

const G = {
  card: { background:'#ffffff', border:'1px solid rgba(16,93,169,0.18)', borderRadius:14, position:'relative', overflow:'hidden', boxShadow:'0 2px 16px rgba(16,93,169,0.10)' },
  topLine: (c='#105da9') => ({ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${c},transparent)` }),
  label: { fontFamily:"'DM Sans',sans-serif", fontSize:'.7rem', color:'rgba(150,180,220,0.75)', textTransform:'uppercase', letterSpacing:'.1em', fontWeight:600 },
  val: (c) => ({ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'1.9rem', color:c, lineHeight:1, textShadow:`0 0 20px ${c}60` }),
  sub: { fontFamily:"'DM Sans',sans-serif", fontSize:'.68rem', color:'rgba(140,170,210,0.65)', marginTop:3 },
  input: { background:'rgba(8,14,28,0.7)', border:'1px solid rgba(14,165,233,0.22)', borderRadius:8, padding:'8px 12px', color:'rgba(220,235,255,0.95)', fontFamily:"'DM Sans',sans-serif", fontSize:'.83rem', outline:'none' },
  btn: (bg='rgba(16,93,169,0.15)', border='rgba(14,165,233,0.45)', c='#105da9') => ({ background:bg, border:`1px solid ${border}`, borderRadius:8, padding:'8px 16px', color:c, fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.78rem', cursor:'pointer', display:'flex', alignItems:'center', gap:6, transition:'all .2s' }),
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

const StatCard = ({ label, value, color, sub, icon, lightBg }) => (
  <div style={{
    background: lightBg || '#ffffff',
    border:`1px solid ${color}30`,
    borderRadius:14, padding:'18px 20px', position:'relative', overflow:'hidden',
    boxShadow:`0 2px 12px rgba(16,93,169,0.10), 0 0 0 1px ${color}15`
  }}>
    <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,transparent,${color},transparent)` }}/>
    <div style={{ position:'absolute', top:-20, right:-20, width:70, height:70, borderRadius:'50%', background:`${color}12`, filter:'blur(15px)' }}/>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
      <div>
        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.68rem', color:`${color}`, textTransform:'uppercase', letterSpacing:'.12em', fontWeight:700, marginBottom:10 }}>{label}</div>
        <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:900, fontSize:'2.2rem', color, lineHeight:1 }}>{value ?? '—'}</div>
        {sub && <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.68rem', color:'#64748b', marginTop:5 }}>{sub}</div>}
      </div>
      <div style={{ width:42, height:42, borderRadius:12, background:`${color}12`, border:`1px solid ${color}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>{icon}</div>
    </div>
  </div>
);

const DonutChart = ({ present, absent, leave, total }) => {
  const r = 52, cx = 70, cy = 70, circ = 2*Math.PI*r;
  const p1 = (present/total)*circ, p2 = (absent/total)*circ, p3 = (leave/total)*circ;
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="18"/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#4ade80" strokeWidth="18" strokeDasharray={`${p1} ${circ-p1}`} strokeDashoffset={circ*0.25} strokeLinecap="round" style={{transition:'stroke-dasharray 1s ease'}}/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f472b6" strokeWidth="18" strokeDasharray={`${p2} ${circ-p2}`} strokeDashoffset={circ*0.25-p1} strokeLinecap="round" style={{transition:'stroke-dasharray 1s ease'}}/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#60a5fa" strokeWidth="18" strokeDasharray={`${p3} ${circ-p3}`} strokeDashoffset={circ*0.25-p1-p2} strokeLinecap="round"/>
      <text x={cx} y={cy-6} textAnchor="middle" fill="rgba(220,235,255,0.95)" fontSize="18" fontWeight="800" fontFamily="Plus Jakarta Sans,sans-serif">{pct(present,total)}%</text>
      <text x={cx} y={cy+12} textAnchor="middle" fill="rgba(150,180,220,0.7)" fontSize="10" fontFamily="DM Sans,sans-serif">Attendance</text>
    </svg>
  );
};

const HoursBar = ({ data }) => {
  if (!data.length) return null;
  const max = Math.max(...data.map(d=>d.hours), 9);
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:80, padding:'0 4px' }}>
      {data.map((d,i) => (
        <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
          <div style={{ width:'100%', height:`${(d.hours/max)*70}px`, minHeight:4, background:`rgba(14,165,233,${0.4+d.hours/max*0.6})`, borderRadius:'3px 3px 0 0', transition:'height 1s ease', boxShadow: d.hours>8 ? '0 0 8px rgba(14,165,233,0.5)' : 'none' }} title={`${d.hours.toFixed(1)}h`}/>
          <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'rgba(140,170,210,0.6)', whiteSpace:'nowrap' }}>{d.code}</span>
        </div>
      ))}
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
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'#f0f7ff', border:'1px solid rgba(16,93,169,0.25)', borderRadius:8, padding:'6px 10px' }}>
            <label style={{ ...G.label, whiteSpace:'nowrap', fontSize:'.65rem', color:'#105da9' }}>FROM</label>
            <input type="date" value={fromDate} max={toDate}
              onChange={e => { setFromDate(e.target.value); if(e.target.value > toDate) setToDate(e.target.value); }}
              style={{ background:'transparent', border:'none', outline:'none', color:'#0f172a', fontFamily:"'DM Sans',sans-serif", fontSize:'.82rem' }}/>
          </div>
          {/* Arrow */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(16,93,169,0.6)" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          {/* To date */}
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'#f0f7ff', border:'1px solid rgba(16,93,169,0.25)', borderRadius:8, padding:'6px 10px' }}>
            <label style={{ ...G.label, whiteSpace:'nowrap', fontSize:'.65rem', color:'#105da9' }}>TO</label>
            <input type="date" value={toDate} min={fromDate} max={today}
              onChange={e => setToDate(e.target.value)}
              style={{ background:'transparent', border:'none', outline:'none', color:'#0f172a', fontFamily:"'DM Sans',sans-serif", fontSize:'.82rem' }}/>
          </div>
          {isRange && (
            <div style={{ padding:'5px 10px', borderRadius:6, background:'rgba(14,165,233,0.1)', border:'1px solid rgba(14,165,233,0.25)', fontFamily:"'DM Sans',sans-serif", fontSize:'.72rem', color:'#105da9', fontWeight:600, whiteSpace:'nowrap' }}>
              {getDatesInRange(fromDate, toDate).length} days
            </div>
          )}
          {/* Refresh */}
          <button style={G.btn()} onClick={()=>fetchAll(fromDate, toDate)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Refresh
          </button>
          {/* Live indicator */}
          <div style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:20, background: connected?'rgba(74,222,128,0.1)':'rgba(244,114,182,0.1)', border:`1px solid ${connected?'rgba(74,222,128,0.35)':'rgba(244,114,182,0.35)'}` }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:connected?'#4ade80':'#f472b6', boxShadow:`0 0 6px ${connected?'#4ade80':'#f472b6'}`, animation:'dotPulse 2s ease-in-out infinite' }}/>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.72rem', color:connected?'#4ade80':'#f472b6', fontWeight:600 }}>{connected?'Live':'Disconnected'}</span>
          </div>
        </div>
      </div>

      {/* ── ERROR ── */}
      {error && (
        <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:10, padding:'14px 18px', marginBottom:20 }}>
          <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.82rem', color:'#dc2626', marginBottom:4 }}>⚠ Connection Error</div>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.78rem', color:'var(--text-secondary)', lineHeight:1.5, marginBottom:8 }}>{error}</div>
          <code style={{ fontFamily:'monospace', fontSize:'.72rem', background:'rgba(0,0,0,0.3)', padding:'4px 8px', borderRadius:4, color:'rgba(200,220,255,0.8)' }}>cd backend-attendance && npm install && npm start</code>
        </div>
      )}

      {/* ── LOADING ── */}
      {loading && !summary && (
        <div style={{ display:'flex', justifyContent:'center', padding:'80px 0', flexDirection:'column', alignItems:'center', gap:14 }}>
          <div style={{ width:36, height:36, border:'3px solid rgba(16,93,169,0.15)', borderTop:'3px solid #0ea5e9', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.8rem', color:'var(--text-muted)' }}>Fetching attendance data...</div>
        </div>
      )}

      {summary && (
        <>
          {/* ── LIVE TICKER — admin only ── */}
          {liveData && !myEmpCode && (
            <div style={{ background:'#fff', border:'1px solid rgba(16,93,169,0.2)', borderRadius:12, padding:'10px 18px', marginBottom:18, display:'flex', alignItems:'center', gap:24, flexWrap:'wrap', boxShadow:'0 2px 10px rgba(16,93,169,0.08)', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,#105da9,transparent)' }}/>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 6px #22c55e', animation:'dotPulse 1.5s ease-in-out infinite' }}/>
                <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'.78rem', color:'#105da9', letterSpacing:'.05em' }}>LIVE TODAY</span>
              </div>
              {[
                { label:'Currently In', val:liveData.presentCount, color:'#16a34a' },
                { label:'Total Punches', val:liveData.totalPunches, color:'#105da9' },
                { label:'Last Punch', val:liveData.lastCheckIn ? fmtTime(liveData.lastCheckIn) : '—', color:'#374151' },
              ].map(({label,val,color})=>(
                <div key={label} style={{ display:'flex', gap:6, alignItems:'baseline' }}>
                  <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.72rem', color:'#64748b' }}>{label}:</span>
                  <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.85rem', color }}>{val}</span>
                </div>
              ))}
            </div>
          )}
          {/* Employee personal live status */}
          {myEmpCode && filtered.length > 0 && (
            <div style={{ background:'linear-gradient(135deg,#eff8ff,#dbeafe)', border:'1px solid rgba(16,93,169,0.25)', borderRadius:12, padding:'10px 18px', marginBottom:18, display:'flex', alignItems:'center', gap:20, flexWrap:'wrap', boxShadow:'0 2px 10px rgba(16,93,169,0.10)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 6px #22c55e', animation:'dotPulse 1.5s ease-in-out infinite' }}/>
                <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'.78rem', color:'#105da9' }}>MY ATTENDANCE TODAY</span>
              </div>
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.78rem', color:'#374151' }}>Punch In: <strong style={{color:'#16a34a'}}>{fmtTime(filtered[0]?.inTime)}</strong></span>
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.78rem', color:'#374151' }}>Punch Out: <strong style={{color:'#105da9'}}>{fmtTime(filtered[0]?.outTime)}</strong></span>
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.78rem', color:'#374151' }}>Hours: <strong style={{color:'#7c3aed'}}>{fmtHours(filtered[0]?.workMinutes)}</strong></span>
            </div>
          )}

          {/* ── STAT CARDS — employee sees own data, admin sees all ── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12, marginBottom:18 }}>
            {myEmpCode ? (
              // Employee view — personal stats only
              <>
                <StatCard label="My Punch In" value={filtered[0] ? fmtTime(filtered[0].inTime) : '—'} color="#105da9" sub={isRange ? `${fromDate} → ${toDate}` : fromDate} icon="🕐" lightBg="linear-gradient(135deg,#eff8ff,#dbeafe)"/>
                <StatCard label="My Punch Out" value={filtered[0] ? fmtTime(filtered[0].outTime) : '—'} color="#0d9488" sub="Last recorded punch" icon="🕕" lightBg="linear-gradient(135deg,#f0fdf9,#ccfbf1)"/>
                <StatCard label="Hours Worked" value={filtered[0] ? fmtHours(filtered[0].workMinutes) : '—'} color="#7c3aed" sub="Total today" icon="⏱" lightBg="linear-gradient(135deg,#faf5ff,#ede9fe)"/>
                <StatCard label="Total Punches" value={filtered[0]?.totalPunches || '—'} color="#ea580c" sub="Device logs today" icon="📍" lightBg="linear-gradient(135deg,#fff7ed,#fed7aa)"/>
              </>
            ) : (
              // Admin view — global stats
              <>
                <StatCard label="Total Present" value={summary.totalPresent} color="#105da9" sub={isRange ? `${fromDate} → ${toDate}` : fromDate} icon="✅" lightBg="linear-gradient(135deg,#eff8ff,#dbeafe)"/>
                <StatCard label="Total Punches" value={summary.totalPunches} color="#ea580c" sub="All device logs" icon="📍" lightBg="linear-gradient(135deg,#fff7ed,#fed7aa)"/>
                <StatCard label="Employees on Floor" value={liveData?.presentCount||'—'} color="#7c3aed" sub="Currently punched in today" icon="🏢" lightBg="linear-gradient(135deg,#faf5ff,#ede9fe)"/>
                <StatCard label="Unique Employees" value={[...new Set(enriched.map(e=>e.empCode))].length} color="#0d9488" sub="Distinct employees" icon="👥" lightBg="linear-gradient(135deg,#f0fdf9,#ccfbf1)"/>
              </>
            )}
          </div>

          {/* ── CHARTS ROW — admin only ── */}
          {!myEmpCode && <div style={{ display:'grid', gridTemplateColumns:'1fr 240px', gap:12, marginBottom:18 }}>



            {/* Hours bar chart */}
            <div style={{ ...G.card, padding:'16px' }}>
              <div style={G.topLine('#105da9')}/>
              <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.75rem', color:'rgba(200,220,255,0.9)', marginBottom:10 }}>Hours Worked — Top {topHours.length} Employees</div>
              {topHours.length > 0 ? <HoursBar data={topHours.map(e=>({code:e.empCode,hours:e.hoursWorked}))} /> : (
                <div style={{ textAlign:'center', padding:'20px 0', fontFamily:"'DM Sans',sans-serif", fontSize:'.78rem', color:'rgba(140,170,210,0.5)' }}>Hours data requires complete in/out punches</div>
              )}
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.65rem', color:'rgba(140,170,210,0.5)' }}>Emp Code (truncated)</span>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.65rem', color:'rgba(140,170,210,0.5)' }}>Bars = hours worked</span>
              </div>
            </div>

            {/* Punch timeline */}
            <div style={{ ...G.card, padding:'16px' }}>
              <div style={G.topLine('#9b6dff')}/>
              <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.75rem', color:'rgba(200,220,255,0.9)', marginBottom:12 }}>Punch Timeline</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {['06:00','07:00','08:00','09:00','10:00','11:00','12:00'].map(hr=>{
                  const hrNum = parseInt(hr);
                  const cnt = enriched.filter(e=>e.inTime && new Date(e.inTime).getHours()===hrNum).length;
                  const maxCnt = Math.max(...['06','07','08','09','10','11','12'].map(h=>enriched.filter(e=>e.inTime&&new Date(e.inTime).getHours()===parseInt(h)).length),1);
                  return (
                    <div key={hr} style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'.62rem', color:'rgba(140,170,210,0.6)', width:36, flexShrink:0 }}>{hr}</span>
                      <div style={{ flex:1, height:8, borderRadius:4, background:'rgba(255,255,255,0.05)', overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${cnt/maxCnt*100}%`, background:'linear-gradient(90deg,#9b6dff,#0ea5e9)', borderRadius:4, transition:'width .8s ease' }}/>
                      </div>
                      <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'.62rem', color:'rgba(200,220,255,0.7)', width:20, textAlign:'right' }}>{cnt}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>}

          {/* ── EMPLOYEE TABLE ── */}
          <div style={{ ...G.card }}>
            <div style={G.topLine()}/>
            {/* Table header + filters */}
            <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(14,165,233,0.12)', display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
              <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.82rem', color:'#0f172a' }}>
              {myEmpCode ? `My Attendance — ${myEmpCode}` : 'Employee Attendance Records'}
            </div>
              {!myEmpCode && <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                {/* Employee Code search */}
                <div style={{ display:'flex', alignItems:'center', gap:7, background:'rgba(8,14,28,0.7)', border:'1px solid rgba(14,165,233,0.22)', borderRadius:8, padding:'7px 12px', minWidth:200 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(16,93,169,0.6)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input
                    ref={searchRef}
                    value={empCodeSearch}
                    onChange={e=>setEmpCodeSearch(e.target.value)}
                    placeholder="Employee Code / Name..."
                    style={{ background:'transparent', border:'none', outline:'none', color:'#0f172a', fontFamily:"'DM Sans',sans-serif", fontSize:'.82rem', width:'100%' }}
                  />
                  {empCodeSearch && <span onClick={()=>setEmpCodeSearch('')} style={{ color:'rgba(16,93,169,0.6)', cursor:'pointer', fontSize:14, lineHeight:1 }}>✕</span>}
                </div>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.75rem', color:'rgba(140,170,210,0.6)' }}>{filtered.length} records</span>
                {/* Excel download */}
                <button style={G.btn('rgba(34,197,94,0.12)','rgba(34,197,94,0.4)','#22c55e')} onClick={exportExcel} disabled={!filtered.length}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Download Excel
                </button>
              </div>}
              {myEmpCode && (
                <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
                  <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.75rem', color:'rgba(140,170,210,0.6)' }}>{filtered.length} records</span>
                  <button style={G.btn('rgba(34,197,94,0.12)','rgba(34,197,94,0.4)','#22c55e')} onClick={exportExcel} disabled={!filtered.length}>
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
                  <tr style={{ background:'rgba(8,14,28,0.9)', borderBottom:'1px solid rgba(14,165,233,0.18)' }}>
                    {['Employee Code','Employee Name','Department','Date','Punch In','Punch Out','Hours Worked','Punches'].map(h=>(
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.67rem', color:'#105da9', letterSpacing:'.1em', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0,300).map((emp, i) => (
                    <tr key={i}
                      style={{ borderBottom:'1px solid rgba(14,165,233,0.07)', transition:'background .15s' }}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(16,93,169,0.06)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                    >
                      <td style={{ padding:'9px 14px', fontFamily:"'Share Tech Mono',monospace", fontSize:'.78rem', color:'#105da9', fontWeight:700 }}>{emp.empCode}</td>
                      <td style={{ padding:'9px 14px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.82rem', color:'#0f172a', whiteSpace:'nowrap' }}>{emp.empName}</td>
                      <td style={{ padding:'9px 14px', fontFamily:"'DM Sans',sans-serif", fontSize:'.78rem', color:'#64748b' }}>{emp.department||'—'}</td>
                      <td style={{ padding:'9px 14px', fontFamily:"'Share Tech Mono',monospace", fontSize:'.75rem', color:'#64748b' }}>
                        <div>{emp.date||fromDate}</div>
                        <div style={{ fontSize:'.65rem', color:'#105da9', fontWeight:700, marginTop:2 }}>
                          {new Date((emp.date||fromDate)+'T00:00:00').toLocaleDateString('en-IN',{weekday:'long'})}
                        </div>
                      </td>
                      <td style={{ padding:'9px 14px', fontFamily:"'Share Tech Mono',monospace", fontSize:'.78rem', color: emp.inTime ? '#4ade80' : 'rgba(140,170,210,0.4)' }}>{fmtTime(emp.inTime)}</td>
                      <td style={{ padding:'9px 14px', fontFamily:"'Share Tech Mono',monospace", fontSize:'.78rem', color: emp.outTime && emp.outTime !== emp.inTime ? '#60a5fa' : 'rgba(140,170,210,0.4)' }}>{emp.outTime && emp.outTime !== emp.inTime ? fmtTime(emp.outTime) : '—'}</td>
                      <td style={{ padding:'9px 14px', fontFamily:"'Share Tech Mono',monospace", fontSize:'.78rem', color: emp.workMinutes>0 ? '#fbbf24' : 'rgba(140,170,210,0.4)', fontWeight: emp.workMinutes>0 ? 700 : 400 }}>{fmtHours(emp.workMinutes)}</td>
                      <td style={{ padding:'9px 14px', textAlign:'center' }}>
                        <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'.75rem', padding:'2px 8px', borderRadius:10, background:'rgba(16,93,169,0.12)', border:'1px solid rgba(14,165,233,0.25)', color:'#105da9' }}>{emp.totalPunches}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && !loading && (
                <div style={{ textAlign:'center', padding:'40px 0', fontFamily:"'DM Sans',sans-serif", fontSize:'.85rem', color:'rgba(140,170,210,0.5)' }}>
                  {empCodeSearch ? `No records found for "${empCodeSearch}"` : 'No attendance records for this date'}
                </div>
              )}
            </div>
          </div>

          <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes dotPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:.6}}`}</style>
        </>
      )}
    </div>
  );
};

export default LiveAttendance;
