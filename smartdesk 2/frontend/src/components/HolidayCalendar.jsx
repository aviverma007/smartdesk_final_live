import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

const HOLIDAYS = [
  { id:1, name:"New Year Day", date:"2026-01-01", day:"Thursday", type:"National" },
  { id:2, name:"Republic Day", date:"2026-01-26", day:"Monday", type:"National" },
  { id:3, name:"Mahashiv Ratri", date:"2026-02-15", day:"Sunday", type:"Weekend Holiday" },
  { id:4, name:"Holi", date:"2026-03-04", day:"Wednesday", type:"Religious" },
  { id:5, name:"Ram Navmi", date:"2026-03-26", day:"Thursday", type:"Religious" },
  { id:6, name:"Independence Day", date:"2026-08-15", day:"Saturday", type:"National" },
  { id:7, name:"Raksha Bandhan", date:"2026-08-28", day:"Friday", type:"Religious" },
  { id:8, name:"Janmashtami", date:"2026-09-04", day:"Friday", type:"Religious" },
  { id:9, name:"Gandhi Jayanti", date:"2026-10-02", day:"Friday", type:"National" },
  { id:10, name:"Dussehra", date:"2026-10-20", day:"Tuesday", type:"Religious" },
  { id:11, name:"Diwali", date:"2026-11-08", day:"Sunday", type:"Weekend Holiday" },
  { id:12, name:"Govardhan Puja", date:"2026-11-09", day:"Monday", type:"Religious" },
  { id:13, name:"Bhai Dooj", date:"2026-11-11", day:"Wednesday", type:"Religious" },
  { id:14, name:"Christmas Day", date:"2026-12-25", day:"Friday", type:"National" },
];

const TYPE_COLORS = {
  National: { bg:"rgba(0,212,255,0.16)", border:"rgba(0,212,255,0.55)", color:"#00d4ff" },
  Religious: { bg:"rgba(123,47,255,0.18)", border:"rgba(123,47,255,0.55)", color:"#9b6dff" },
  "Weekend Holiday": { bg:"rgba(255,107,0,0.18)", border:"rgba(255,107,0,0.55)", color:"#ff7a18" },
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

const HolidayCalendar = () => {
  const today = new Date();

  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState(today.getDate());

  const getHoliday = (d, m, y) =>
    HOLIDAYS.find(h => {
      const hd = new Date(h.date);
      return hd.getDate() === d && hd.getMonth() === m && hd.getFullYear() === y;
    });

  const monthHolidays = HOLIDAYS.filter(h => {
    const hd = new Date(h.date);
    return hd.getMonth() === month && hd.getFullYear() === year;
  });

  const navigate = dir => {
    if (dir === "prev") {
      if (month === 0) {
        setMonth(11);
        setYear(y => y - 1);
      } else {
        setMonth(m => m - 1);
      }
    } else {
      if (month === 11) {
        setMonth(0);
        setYear(y => y + 1);
      } else {
        setMonth(m => m + 1);
      }
    }
    setSelectedDay(null);
  };

  const goToday = () => {
    setMonth(today.getMonth());
    setYear(today.getFullYear());
    setSelectedDay(today.getDate());
  };

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
  ];

  const selectedHoliday = selectedDay ? getHoliday(selectedDay, month, year) : null;
  const allYearHolidays = [...HOLIDAYS].sort((a, b) => new Date(a.date) - new Date(b.date));

  const cs = {
    card: {
      background:"var(--bg-card)",
      border:"1px solid var(--border)",
      borderRadius:16,
      backdropFilter:"blur(14px)",
      position:"relative",
      overflow:"hidden",
      boxShadow:"var(--shadow-card)"
    },
    topLine: {
      position:"absolute",
      top:0,
      left:0,
      right:0,
      height:1,
      background:"linear-gradient(90deg,transparent,#00d4ff,transparent)",
      opacity:.7
    }
  };

  return (
    <div style={{ padding:"0 0 24px" }}>
      <style>
        {`
          .calendar-day-cell:hover {
            transform: translateY(-4px) scale(1.03);
            box-shadow: 0 12px 28px rgba(0,212,255,.18);
            border-color: rgba(0,212,255,.55) !important;
          }
        `}
      </style>

      <div style={{ marginBottom:16 }}>
        <div className="section-title" style={{ marginBottom:6 }}>// TEMPORAL SCHEDULE</div>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
          <h2 style={{ fontFamily:"'Orbitron', monospace", fontWeight:800, fontSize:"1.2rem", color:"var(--text-primary)", margin:0 }}>
            HOLIDAY <span className="neon-text">CALENDAR</span> 2026
          </h2>

          <button
            onClick={goToday}
            style={{
              display:"flex",
              alignItems:"center",
              gap:8,
              background:"rgba(0,212,255,.12)",
              border:"1px solid rgba(0,212,255,.38)",
              color:"#00d4ff",
              borderRadius:10,
              padding:"8px 12px",
              cursor:"pointer",
              fontFamily:"'Share Tech Mono', monospace",
              fontSize:".72rem"
            }}
          >
            <Calendar size={14} />
            TODAY: {today.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })}
          </button>
        </div>

        <div className="cyber-divider" style={{ marginTop:10 }} />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1.15fr .85fr", gap:16 }}>

        <div style={{ ...cs.card }}>
          <div style={cs.topLine} />

          <div style={{
            display:"flex",
            alignItems:"center",
            justifyContent:"space-between",
            padding:"14px 18px",
            borderBottom:"1px solid var(--border)",
            background:"linear-gradient(135deg, rgba(0,212,255,0.10), rgba(123,47,255,0.08))",
          }}>
            <button onClick={() => navigate("prev")} style={navBtn}>
              <ChevronLeft size={18} />
            </button>

            <div style={{ fontFamily:"'Orbitron', monospace", fontWeight:800, fontSize:".9rem", color:"#00d4ff", letterSpacing:".14em" }}>
              {MONTHS[month].toUpperCase()} {year}
            </div>

            <button onClick={() => navigate("next")} style={navBtn}>
              <ChevronRight size={18} />
            </button>
          </div>

          <div style={{ padding:"16px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:8, marginBottom:8 }}>
              {WEEKDAYS.map(d => (
                <div key={d} style={{
                  textAlign:"center",
                  fontFamily:"'Orbitron', monospace",
                  fontSize:".58rem",
                  letterSpacing:".1em",
                  color:"rgba(0,212,255,0.75)",
                  padding:"6px 0",
                  fontWeight:800
                }}>
                  {d}
                </div>
              ))}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:8 }}>
              {cells.map((day, i) => {
                if (!day) return <div key={i} style={{ minHeight:76 }} />;

                const hol = getHoliday(day, month, year);
                const isToday = month === today.getMonth() && year === today.getFullYear() && day === today.getDate();
                const isWeekend = i % 7 === 0 || i % 7 === 6;
                const isSelected = selectedDay === day;
                const tc = TYPE_COLORS[hol?.type];

                return (
                  <div
                    key={i}
                    className="calendar-day-cell"
                    onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                    style={{
                      minHeight:76,
                      borderRadius:14,
                      cursor:"pointer",
                      position:"relative",
                      padding:"10px",
                      transition:"all .22s ease",
                      background: hol
                        ? tc.bg
                        : isSelected
                          ? "rgba(0,212,255,.15)"
                          : "var(--bg-elevated)",
                      border: hol
                        ? `1px solid ${tc.border}`
                        : isToday
                          ? "1px solid rgba(0,212,255,.75)"
                          : isSelected
                            ? "1px solid rgba(0,212,255,.55)"
                            : "1px solid var(--border)",
                      color: hol ? tc.color : isWeekend ? "var(--text-muted)" : "var(--text-primary)",
                      boxShadow: isToday ? "0 0 22px rgba(0,212,255,.34)" : "none"
                    }}
                  >
                    <div style={{
                      fontFamily:"'Plus Jakarta Sans', sans-serif",
                      fontSize:"1rem",
                      fontWeight:900,
                      color: hol ? tc.color : "var(--text-primary)"
                    }}>
                      {day}
                    </div>

                    {isToday && (
                      <div style={{
                        position:"absolute",
                        top:8,
                        right:8,
                        fontSize:".48rem",
                        color:"#00d4ff",
                        fontWeight:900,
                        letterSpacing:".08em"
                      }}>
                        TODAY
                      </div>
                    )}

                    {hol && (
                      <div style={{
                        marginTop:8,
                        padding:"4px 6px",
                        borderRadius:999,
                        background:"rgba(16,93,169,0.10)",
                        border:`1px solid ${tc.border}`,
                        color:tc.color,
                        fontSize:".56rem",
                        fontWeight:800,
                        whiteSpace:"nowrap",
                        overflow:"hidden",
                        textOverflow:"ellipsis"
                      }}>
                        {hol.name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display:"flex", gap:14, marginTop:14, flexWrap:"wrap" }}>
              {Object.entries(TYPE_COLORS).map(([type, c]) => (
                <div key={type} style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{ width:9, height:9, borderRadius:"50%", background:c.color, boxShadow:`0 0 8px ${c.color}` }} />
                  <span style={{ fontFamily:"'Exo 2', sans-serif", fontSize:".68rem", color:"var(--text-muted)" }}>{type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ ...cs.card, padding:"16px 18px", minHeight:145 }}>
            <div style={cs.topLine} />
            <div style={{ fontFamily:"'Orbitron', monospace", fontSize:".65rem", letterSpacing:".15em", color:"rgba(0,212,255,0.75)", marginBottom:10 }}>
              {selectedDay ? `${MONTHS[month].toUpperCase()} ${selectedDay}, ${year}` : "SELECT A DATE"}
            </div>

            {selectedDay ? (
              selectedHoliday ? (
                <div>
                  <div style={{ fontFamily:"'Orbitron', monospace", fontSize:"1rem", fontWeight:800, color:"var(--text-primary)", marginBottom:6 }}>
                    {selectedHoliday.name}
                  </div>
                  <div style={{ fontFamily:"'Exo 2', sans-serif", fontSize:".78rem", color:"var(--text-muted)", marginBottom:10 }}>
                    {selectedHoliday.day}
                  </div>
                  <div style={{
                    display:"inline-block",
                    padding:"6px 12px",
                    borderRadius:999,
                    background:TYPE_COLORS[selectedHoliday.type].bg,
                    border:`1px solid ${TYPE_COLORS[selectedHoliday.type].border}`,
                    color:TYPE_COLORS[selectedHoliday.type].color,
                    fontFamily:"'Share Tech Mono', monospace",
                    fontSize:".65rem",
                    letterSpacing:".1em"
                  }}>
                    {selectedHoliday.type.toUpperCase()}
                  </div>
                </div>
              ) : (
                <div style={{ fontFamily:"'Exo 2', sans-serif", fontSize:".82rem", color:"var(--text-muted)" }}>
                  No holiday on this date.
                </div>
              )
            ) : (
              <div style={{ fontFamily:"'Exo 2', sans-serif", fontSize:".82rem", color:"var(--text-muted)" }}>
                Click any date to view details.
              </div>
            )}
          </div>

          <div style={{ ...cs.card, flex:1 }}>
            <div style={cs.topLine} />
            <div style={{ padding:"13px 16px", borderBottom:"1px solid rgba(0,212,255,0.1)" }}>
              <div style={{ fontFamily:"'Orbitron', monospace", fontSize:".68rem", fontWeight:800, color:"var(--text-primary)", letterSpacing:".1em" }}>
                {monthHolidays.length > 0 ? `${monthHolidays.length} HOLIDAY${monthHolidays.length > 1 ? "S" : ""} THIS MONTH` : "NO HOLIDAYS THIS MONTH"}
              </div>
            </div>

            <div style={{ padding:"12px 16px", maxHeight:230, overflowY:"auto" }}>
              {monthHolidays.length === 0 ? (
                <div style={{ textAlign:"center", padding:"30px 0", fontFamily:"'Share Tech Mono', monospace", fontSize:".7rem", color:"rgba(0,212,255,0.42)", letterSpacing:".12em" }}>
                  NO ENTRIES
                </div>
              ) : monthHolidays.map(h => {
                const d = new Date(h.date).getDate();
                const c = TYPE_COLORS[h.type];

                return (
                  <div key={h.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid rgba(0,212,255,0.08)" }}>
                    <div style={{
                      width:38,
                      height:38,
                      borderRadius:10,
                      background:c.bg,
                      border:`1px solid ${c.border}`,
                      display:"flex",
                      alignItems:"center",
                      justifyContent:"center",
                      flexShrink:0,
                      fontFamily:"'Orbitron', monospace",
                      fontSize:".75rem",
                      fontWeight:800,
                      color:c.color
                    }}>
                      {d}
                    </div>

                    <div>
                      <div style={{ fontFamily:"'Exo 2', sans-serif", fontSize:".82rem", color:"var(--text-primary)", fontWeight:700 }}>{h.name}</div>
                      <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:".58rem", color:c.color, letterSpacing:".08em" }}>{h.type.toUpperCase()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ ...cs.card }}>
            <div style={cs.topLine} />
            <div style={{ padding:"12px 16px", borderBottom:"1px solid rgba(0,212,255,0.1)" }}>
              <div style={{ fontFamily:"'Orbitron', monospace", fontSize:".65rem", fontWeight:800, color:"rgba(0,212,255,0.85)", letterSpacing:".1em" }}>
                ALL {HOLIDAYS.length} HOLIDAYS 2026
              </div>
            </div>

            <div style={{ padding:"10px 16px", maxHeight:190, overflowY:"auto" }}>
              {allYearHolidays.map(h => {
                const hd = new Date(h.date);
                const c = TYPE_COLORS[h.type];

                return (
                  <div key={h.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid rgba(0,212,255,0.06)" }}>
                    <span style={{ fontFamily:"'Exo 2', sans-serif", fontSize:".76rem", color:"var(--text-secondary)" }}>{h.name}</span>
                    <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:".65rem", color:c.color, flexShrink:0, marginLeft:8 }}>
                      {hd.toLocaleDateString("en-US", { month:"short", day:"numeric" })}
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

const navBtn = {
  background:"rgba(0,212,255,.10)",
  border:"1px solid rgba(0,212,255,.35)",
  color:"#00d4ff",
  cursor:"pointer",
  width:36,
  height:36,
  borderRadius:10,
  display:"flex",
  alignItems:"center",
  justifyContent:"center"
};

export default HolidayCalendar;