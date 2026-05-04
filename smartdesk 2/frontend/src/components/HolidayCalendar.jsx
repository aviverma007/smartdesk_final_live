import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

const HOLIDAYS = [
  { id:1, name:"New Year Day", date:"2026-01-01", day:"Thursday", type:"National" },
  { id:2, name:"Republic Day", date:"2026-01-26", day:"Monday", type:"National" },
  { id:3, name:"Holi", date:"2026-03-04", day:"Wednesday", type:"Religious" },
  { id:4, name:"Ram Navmi", date:"2026-03-26", day:"Thursday", type:"Religious" },
  { id:5, name:"Independence Day", date:"2026-08-15", day:"Saturday", type:"National" },
  { id:6, name:"Raksha Bandhan", date:"2026-08-28", day:"Friday", type:"Religious" },
  { id:7, name:"Janmashtami", date:"2026-09-04", day:"Friday", type:"Religious" },
  { id:8, name:"Gandhi Jayanti", date:"2026-10-02", day:"Friday", type:"National" },
  { id:9, name:"Dussehra", date:"2026-10-20", day:"Tuesday", type:"Religious" },
  { id:10, name:"Govardhan Puja", date:"2026-11-09", day:"Monday", type:"Religious" },
  { id:11, name:"Bhai Dooj", date:"2026-11-11", day:"Wednesday", type:"Religious" },
  { id:12, name:"Christmas Day", date:"2026-12-25", day:"Friday", type:"National" },
  { id:13, name:"Mahashiv Ratri", date:"2026-02-15", day:"Sunday", type:"Weekend Holiday" },
  { id:14, name:"Diwali", date:"2026-11-08", day:"Sunday", type:"Weekend Holiday" },
];

const TYPE_COLORS = {
  'National':       { bg:'rgba(0,212,255,0.12)', border:'rgba(0,212,255,0.35)', color:'#00d4ff' },
  'Religious':      { bg:'rgba(123,47,255,0.12)', border:'rgba(123,47,255,0.35)', color:'#7b2fff' },
  'Weekend Holiday':{ bg:'rgba(255,107,0,0.12)',  border:'rgba(255,107,0,0.35)',  color:'#ff6b00' },
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

const HolidayCalendar = () => {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState(null);

  const getHoliday = (d, m, y) => HOLIDAYS.find(h => {
    const hd = new Date(h.date);
    return hd.getDate()===d && hd.getMonth()===m && hd.getFullYear()===y;
  });

  const monthHolidays = HOLIDAYS.filter(h => {
    const hd = new Date(h.date);
    return hd.getMonth()===month && hd.getFullYear()===year;
  });

  const navigate = dir => {
    if (dir==='prev') { if (month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); }
    else { if (month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); }
    setSelectedDay(null);
  };

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const cells = [...Array(firstDayOfWeek).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)];

  const selectedHoliday = selectedDay ? getHoliday(selectedDay, month, year) : null;
  const allYearHolidays = HOLIDAYS.sort((a,b) => new Date(a.date)-new Date(b.date));

  const cs = {
    card: { background:'rgba(6,20,45,0.85)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:8, backdropFilter:'blur(12px)', position:'relative', overflow:'hidden' },
    topLine: { position:'absolute', top:0, left:0, right:0, height:1, background:'linear-gradient(90deg,transparent,#00d4ff,transparent)', opacity:.5 },
  };

  return (
    <div style={{ padding:'0 0 24px' }}>
      {/* Header */}
      <div style={{ marginBottom:16 }}>
        <div className="section-title" style={{ marginBottom:6 }}>// TEMPORAL SCHEDULE</div>
        <h2 style={{ fontFamily:"'Orbitron', monospace", fontWeight:800, fontSize:'1.2rem', color:'#e0f4ff', margin:0 }}>
          HOLIDAY <span className="neon-text">CALENDAR</span> 2026
        </h2>
        <div className="cyber-divider" style={{ marginTop:10 }} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* Calendar */}
        <div style={{ ...cs.card }}>
          <div style={cs.topLine} />
          {/* Month nav */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'12px 16px',
            borderBottom:'1px solid rgba(0,212,255,0.1)',
            background:'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(0,102,255,0.05))',
          }}>
            <button onClick={()=>navigate('prev')} style={{ background:'none', border:'none', color:'rgba(0,212,255,0.7)', cursor:'pointer', padding:4, borderRadius:4, display:'flex', alignItems:'center', transition:'color .2s' }}>
              <ChevronLeft size={16} />
            </button>
            <div style={{ fontFamily:"'Orbitron', monospace", fontWeight:700, fontSize:'.8rem', color:'#00d4ff', letterSpacing:'.1em' }}>
              {MONTHS[month].toUpperCase()} {year}
            </div>
            <button onClick={()=>navigate('next')} style={{ background:'none', border:'none', color:'rgba(0,212,255,0.7)', cursor:'pointer', padding:4, borderRadius:4, display:'flex', alignItems:'center', transition:'color .2s' }}>
              <ChevronRight size={16} />
            </button>
          </div>

          <div style={{ padding:'12px 14px' }}>
            {/* Weekday headers */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, marginBottom:6 }}>
              {WEEKDAYS.map(d => (
                <div key={d} style={{ textAlign:'center', fontFamily:"'Orbitron', monospace", fontSize:'.48rem', letterSpacing:'.08em', color:'rgba(0,212,255,0.4)', padding:'4px 0' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3 }}>
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const isToday = month===today.getMonth() && year===today.getFullYear() && day===today.getDate();
                const hol = getHoliday(day, month, year);
                const isWeekend = i%7===0 || i%7===6;
                const isSelected = selectedDay===day;
                const tc = TYPE_COLORS[hol?.type] || {};
                return (
                  <div
                    key={i}
                    onClick={() => setSelectedDay(day===selectedDay ? null : day)}
                    style={{
                      aspectRatio:'1', display:'flex', alignItems:'center', justifyContent:'center',
                      borderRadius:5, cursor:'pointer', position:'relative',
                      fontFamily:"'Share Tech Mono', monospace", fontSize:'.72rem',
                      transition:'all .2s',
                      background: isToday ? 'rgba(0,212,255,0.2)' : hol ? tc.bg : isSelected ? 'rgba(0,212,255,0.08)' : 'transparent',
                      border: isToday ? '1px solid rgba(0,212,255,0.6)' : hol ? `1px solid ${tc.border}` : isSelected ? '1px solid rgba(0,212,255,0.3)' : '1px solid transparent',
                      color: isToday ? '#00d4ff' : hol ? tc.color : isWeekend ? 'rgba(122,184,212,0.4)' : 'rgba(122,184,212,0.8)',
                      boxShadow: isToday ? '0 0 8px rgba(0,212,255,0.25)' : 'none',
                      fontWeight: isToday ? 700 : 400,
                    }}
                  >
                    {day}
                    {hol && <div style={{ position:'absolute', top:2, right:2, width:4, height:4, borderRadius:'50%', background:tc.color, boxShadow:`0 0 4px ${tc.color}` }} />}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display:'flex', gap:12, marginTop:12, flexWrap:'wrap' }}>
              {Object.entries(TYPE_COLORS).map(([type,c]) => (
                <div key={type} style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:c.color, boxShadow:`0 0 5px ${c.color}` }} />
                  <span style={{ fontFamily:"'Exo 2', sans-serif", fontSize:'.6rem', color:'rgba(122,184,212,0.6)' }}>{type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {/* Selected day info */}
          {selectedDay && (
            <div style={{ ...cs.card, padding:'14px 16px' }}>
              <div style={cs.topLine} />
              <div style={{ fontFamily:"'Orbitron', monospace", fontSize:'.6rem', letterSpacing:'.15em', color:'rgba(0,212,255,0.5)', marginBottom:8 }}>
                {MONTHS[month].toUpperCase()} {selectedDay}, {year}
              </div>
              {selectedHoliday ? (
                <div>
                  <div style={{ fontFamily:"'Orbitron', monospace", fontSize:'.85rem', fontWeight:700, color:'#e0f4ff', marginBottom:6 }}>{selectedHoliday.name}</div>
                  <div style={{ fontFamily:"'Exo 2', sans-serif", fontSize:'.7rem', color:'rgba(122,184,212,0.7)', marginBottom:8 }}>{selectedHoliday.day}</div>
                  <div style={{ display:'inline-block', padding:'3px 10px', borderRadius:3, ...TYPE_COLORS[selectedHoliday.type], fontFamily:"'Share Tech Mono', monospace", fontSize:'.6rem', letterSpacing:'.1em' }}>
                    {selectedHoliday.type.toUpperCase()}
                  </div>
                </div>
              ) : (
                <div style={{ fontFamily:"'Exo 2', sans-serif", fontSize:'.75rem', color:'rgba(122,184,212,0.5)' }}>No holiday on this date</div>
              )}
            </div>
          )}

          {/* This month's holidays */}
          <div style={{ ...cs.card, flex:1 }}>
            <div style={cs.topLine} />
            <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(0,212,255,0.08)' }}>
              <div style={{ fontFamily:"'Orbitron', monospace", fontSize:'.65rem', fontWeight:700, color:'#e0f4ff', letterSpacing:'.1em' }}>
                {monthHolidays.length > 0 ? `${monthHolidays.length} HOLIDAY${monthHolidays.length>1?'S':''} THIS MONTH` : 'NO HOLIDAYS THIS MONTH'}
              </div>
            </div>
            <div style={{ padding:'10px 16px', maxHeight:200, overflowY:'auto' }}>
              {monthHolidays.length === 0 ? (
                <div style={{ textAlign:'center', padding:'20px 0', fontFamily:"'Share Tech Mono', monospace", fontSize:'.6rem', color:'rgba(0,212,255,0.3)', letterSpacing:'.1em' }}>
                  NO ENTRIES
                </div>
              ) : monthHolidays.map(h => {
                const d = new Date(h.date).getDate();
                const c = TYPE_COLORS[h.type];
                return (
                  <div key={h.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid rgba(0,212,255,0.07)' }}>
                    <div style={{ width:28, height:28, borderRadius:5, background:c.bg, border:`1px solid ${c.border}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontFamily:"'Orbitron', monospace", fontSize:'.6rem', fontWeight:700, color:c.color }}>
                      {d}
                    </div>
                    <div>
                      <div style={{ fontFamily:"'Exo 2', sans-serif", fontSize:'.72rem', color:'#e0f4ff', fontWeight:600 }}>{h.name}</div>
                      <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:'.55rem', color:c.color, letterSpacing:'.08em' }}>{h.type.toUpperCase()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full year list */}
          <div style={{ ...cs.card }}>
            <div style={cs.topLine} />
            <div style={{ padding:'10px 14px', borderBottom:'1px solid rgba(0,212,255,0.08)' }}>
              <div style={{ fontFamily:"'Orbitron', monospace", fontSize:'.6rem', fontWeight:700, color:'rgba(0,212,255,0.7)', letterSpacing:'.1em' }}>
                ALL {HOLIDAYS.length} HOLIDAYS 2026
              </div>
            </div>
            <div style={{ padding:'8px 14px', maxHeight:160, overflowY:'auto' }}>
              {allYearHolidays.map(h => {
                const hd = new Date(h.date);
                const c = TYPE_COLORS[h.type];
                return (
                  <div key={h.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:'1px solid rgba(0,212,255,0.05)' }}>
                    <span style={{ fontFamily:"'Exo 2', sans-serif", fontSize:'.68rem', color:'rgba(122,184,212,0.8)' }}>{h.name}</span>
                    <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:'.58rem', color:c.color, flexShrink:0, marginLeft:8 }}>
                      {hd.toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HolidayCalendar;
