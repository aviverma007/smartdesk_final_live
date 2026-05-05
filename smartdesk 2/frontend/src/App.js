import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import LoginForm from "./components/LoginForm";
import EmployeeDirectory from "./components/EmployeeDirectory";
import Footer from "./components/Footer";
import { Toaster } from "./components/ui/sonner";
import Home from "./components/Home";
import Policies from "./components/Policies";
import MeetingRooms from "./components/MeetingRooms";
import HolidayCalendar from "./components/HolidayCalendar";
import Dashboard from "./components/Dashboard";
import LiveAttendance from "./components/LiveAttendance";
import MyProfile from "./components/MyProfile";
import GlobalSearch from "./components/GlobalSearch";

/* ── Icons ──────────────────────────────────────────────────────────────── */
const IcoHome     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IcoUsers    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IcoShield   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IcoRoom     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
const IcoCal      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IcoChart    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><polyline points="2 20 22 20"/></svg>;
const IcoBell     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const IcoSearch   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IcoSettings = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
const IcoSun      = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
const IcoMoon     = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
const IcoSend     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const IcoX        = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcoSparkle  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/></svg>;

/* ── Custom Cursor — SWD Logo + trailing particles only ─────────────────── */
const getSWDSvg = (color) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <circle cx="20" cy="26" r="12" stroke="${color}" stroke-width="2.5" fill="none"/>
  <line x1="20" y1="1" x2="20" y2="38" stroke="${color}" stroke-width="2.8"/>
  <polygon points="20,0 15,10 20,8 25,10" fill="${color}"/>
  <line x1="20" y1="20" x2="11" y2="29" stroke="${color}" stroke-width="2.2"/>
  <line x1="20" y1="20" x2="29" y2="29" stroke="${color}" stroke-width="2.2"/>
</svg>`)}`;

const CustomCursor = () => {
  const logoRef  = useRef(null);
  const imgRef   = useRef(null);
  const pos      = useRef({ x: -200, y: -200 });
  const rafRef   = useRef(null);
  const trailIdx = useRef(0);

  // Update cursor color when theme changes
  useEffect(() => {
    const updateColor = () => {
      const theme = document.documentElement.getAttribute("data-theme");
      const color = theme === "light" ? "#000000" : "white";
      const glow  = theme === "light" ? "drop-shadow(0 0 6px rgba(255,255,255,0.9))" : "drop-shadow(0 0 6px rgba(255,255,255,0.6))";
      if (imgRef.current) {
        imgRef.current.src = getSWDSvg(color);
        imgRef.current.style.filter = glow;
      }
    };
    updateColor();
    const observer = new MutationObserver(updateColor);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let lastTrail = 0;

    const spawnTrail = (x, y) => {
      const el = document.createElement("div");
      const size = 3 + Math.random() * 5;
      const theme = document.documentElement.getAttribute("data-theme");
      const colors = theme === "light"
        ? ["#7c3aed","#db2777","#2563eb","#000000","#4a4a4a"]
        : ["#9b6dff","#f472b6","#60a5fa","#4ade80","#ffffff"];
      const color = colors[trailIdx.current % colors.length];
      trailIdx.current++;
      Object.assign(el.style, {
        position: "fixed", borderRadius: "50%",
        width: size + "px", height: size + "px",
        background: color,
        boxShadow: `0 0 ${size * 2}px ${color}`,
        left: (x - size / 2) + "px",
        top:  (y - size / 2) + "px",
        pointerEvents: "none",
        zIndex: "999995",
        animation: "trailFade 0.5s ease forwards",
      });
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 500);
    };

    const onMove = (e) => {
      pos.current = { x: e.clientX, y: e.clientY };

      // Trail every 35ms
      const now = Date.now();
      if (now - lastTrail > 35) {
        spawnTrail(e.clientX, e.clientY);
        lastTrail = now;
      }

      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          if (logoRef.current) {
            logoRef.current.style.transform =
              `translate(${pos.current.x - 20}px, ${pos.current.y - 20}px)`;
          }
          rafRef.current = null;
        });
      }
    };

    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div ref={logoRef} style={{
      position: "fixed", top: 0, left: 0,
      width: 40, height: 40,
      pointerEvents: "none", zIndex: 999999,
      willChange: "transform",
      transform: "translate(-200px, -200px)",
      filter: "drop-shadow(0 0 6px rgba(255,255,255,0.6))",
    }}>
      <img ref={imgRef} src={getSWDSvg("white")} alt="" width={40} height={40} id="swd-cursor-img"
        draggable={false} style={{ display:"block", userSelect:"none", filter:"drop-shadow(0 0 6px rgba(255,255,255,0.6))" }}/>
    </div>
  );
};

const IcoAttend  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>;
const IcoProfile = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;

/* ── Nav config ─────────────────────────────────────────────────────────── */
const NAV = [
  { id:"home",             label:"Home",              Icon:IcoHome },
  { id:"directory",        label:"Employee Directory", Icon:IcoUsers },
  { id:"attendance",       label:"Live Attendance",   Icon:IcoAttend },
  { id:"policies",         label:"Policies",           Icon:IcoShield },
  { id:"meeting-rooms",    label:"Meeting Rooms",      Icon:IcoRoom },
  { id:"holiday-calendar", label:"Holiday Calendar",  Icon:IcoCal },
  { id:"dashboard",        label:"Dashboard",          Icon:IcoChart },
  { id:"profile",          label:"My Profile",         Icon:IcoProfile },
];

/* ── Quick-Access ticker items ──────────────────────────────────────────── */
const TICKER_ITEMS = [
  "🏢 SmartWorld Developers",
  "📋 HR Portal — Adrenaline",
  "🔧 Manage Engine — ZOHO",
  "💼 Salesforce CRM",
  "📊 Power BI Dashboards",
  "🏗️ Projects: Sky Arc, The Edition, One DXP, Orchard, Gems",
  "📅 Holiday Calendar 2026",
  "👥 Employee Directory",
  "🏆 QMS Portal",
  "💡 New Features Coming Soon",
];

/* ── AI Chat responses ──────────────────────────────────────────────────── */
const AI_RESPONSES = {
  holiday: "📅 SmartWorld has 14 holidays in 2026. The next upcoming holiday is **Republic Day** on Jan 26. Check the Holiday Calendar tab for the full list.",
  meeting: "🏢 There are meeting rooms available across multiple floors. You can book a room in the **Meeting Rooms** tab. Rooms like Nexus-01 and Quantum-03 are currently free.",
  employee: "👥 Use the **Employee Directory** tab to search for any employee by name, ID, department, designation, or location.",
  policy: "📋 All company policies are available under the **Policies** tab — HR Policy, Admin Policy, and IT Policy documents.",
  dashboard: "📊 The **Dashboard** tab has 9 Power BI reports including Sales, PO, QMS, Attendance, Cost, and more.",
  default: "I'm SmartDesk AI, your enterprise portal assistant! I can help you find information about employees, policies, holidays, meeting rooms, and dashboards. What would you like to know?",
};

function getAIResponse(q) {
  const lq = q.toLowerCase();
  if (lq.includes('holiday') || lq.includes('leave')) return AI_RESPONSES.holiday;
  if (lq.includes('meeting') || lq.includes('room') || lq.includes('book')) return AI_RESPONSES.meeting;
  if (lq.includes('employee') || lq.includes('staff') || lq.includes('search') || lq.includes('who')) return AI_RESPONSES.employee;
  if (lq.includes('policy') || lq.includes('hr') || lq.includes('rule')) return AI_RESPONSES.policy;
  if (lq.includes('dashboard') || lq.includes('report') || lq.includes('analytics')) return AI_RESPONSES.dashboard;
  return AI_RESPONSES.default;
}

/* ── Notification Panel ─────────────────────────────────────────────────── */
const NotifPanel = ({ onClose }) => {
  const notifs = [
    { icon:"🚀", title:"New Update Coming", body:"SmartDesk v3.0 with advanced analytics is in development.", time:"Just now", dot:"#9b6dff" },
    { icon:"📢", title:"Upcoming Feature", body:"AI-powered org chart builder will be available soon.", time:"2h ago", dot:"#f472b6" },
    { icon:"🔔", title:"Upcoming Feature", body:"Mobile app for SmartDesk is under development.", time:"Yesterday", dot:"#60a5fa" },
    { icon:"📅", title:"Upcoming Feature", body:"Automated leave management integration with Adrenaline.", time:"2 days ago", dot:"#4ade80" },
    { icon:"💡", title:"New Update Coming", body:"Dark/Light theme switcher now available in Settings.", time:"3 days ago", dot:"#2dd4bf" },
  ];
  return (
    <div className="notif-panel" style={{ right:0, top:50 }}>
      <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontFamily:"Plus Jakarta Sans,sans-serif", fontWeight:700, fontSize:".85rem", color:"var(--text-primary)" }}>Notifications</span>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)" }}><IcoX/></button>
      </div>
      <div style={{ maxHeight:360, overflowY:"auto" }}>
        {notifs.map((n,i) => (
          <div key={i} style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)", display:"flex", gap:12, alignItems:"flex-start", cursor:"pointer", transition:"background .15s" }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(139,92,246,0.06)"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}
          >
            <div style={{ width:36, height:36, borderRadius:10, background:"var(--bg-elevated)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{n.icon}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontFamily:"Plus Jakarta Sans,sans-serif", fontWeight:600, fontSize:".8rem", color:"var(--text-primary)" }}>{n.title}</span>
                <span style={{ fontSize:".65rem", color:"var(--text-muted)" }}>{n.time}</span>
              </div>
              <p style={{ fontSize:".75rem", color:"var(--text-secondary)", marginTop:3, lineHeight:1.45 }}>{n.body}</p>
            </div>
            <div style={{ width:8, height:8, borderRadius:"50%", background:n.dot, flexShrink:0, marginTop:4 }}/>
          </div>
        ))}
      </div>
      <div style={{ padding:"10px 16px", borderTop:"1px solid var(--border)", textAlign:"center" }}>
        <span style={{ fontSize:".75rem", color:"var(--accent-purple)", cursor:"pointer", fontFamily:"DM Sans,sans-serif" }}>View all notifications</span>
      </div>
    </div>
  );
};

/* ── AI Chat Panel ──────────────────────────────────────────────────────── */
const AIChatPanel = ({ onClose }) => {
  const [msgs, setMsgs] = useState([
    { role:"bot", text:"👋 Hi! I'm **SmartDesk AI**. Ask me anything about employees, policies, holidays, meeting rooms, or dashboards." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const send = () => {
    const q = input.trim();
    if (!q) return;
    setMsgs(m => [...m, { role:"user", text:q }]);
    setInput("");
    setLoading(true);
    setTimeout(() => {
      setMsgs(m => [...m, { role:"bot", text:getAIResponse(q) }]);
      setLoading(false);
    }, 700);
  };

  const suggestions = ["What holidays are coming?", "How to book a meeting room?", "Show me HR policies", "Where to find dashboards?"];

  return (
    <div className="ai-panel">
      {/* Header */}
      <div style={{ padding:"14px 18px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center", background:"var(--bg-elevated)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:"rgba(13,43,110,0.3)", border:"1px solid rgba(255,255,255,0.15)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <img src="/images/swd-logo.png" alt="AI" width={24} height={24} style={{ objectFit:"contain", filter:"brightness(0) invert(1)" }}/>
          </div>
          <div>
            <div style={{ fontFamily:"Plus Jakarta Sans,sans-serif", fontWeight:700, fontSize:".88rem", color:"var(--text-primary)" }}>SmartDesk AI</div>
            <div style={{ fontSize:".65rem", color:"var(--accent-green)" }}>● Online</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", padding:4 }}><IcoX/></button>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", padding:"16px 14px", display:"flex", flexDirection:"column", gap:10 }}>
        {msgs.map((m,i) => (
          <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
            <div className={`ai-msg ${m.role}`}
              dangerouslySetInnerHTML={{ __html: m.text.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\n/g,"<br/>") }}
            />
          </div>
        ))}
        {loading && (
          <div style={{ display:"flex" }}>
            <div className="ai-msg bot" style={{ display:"flex", gap:4, alignItems:"center" }}>
              {[0,1,2].map(i=><div key={i} style={{ width:6,height:6,borderRadius:"50%",background:"var(--accent-purple)",opacity:.6,animation:`dotPulse 1.2s ease-in-out ${i*0.2}s infinite` }}/>)}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Suggestions */}
      {msgs.length <= 1 && (
        <div style={{ padding:"0 14px 10px", display:"flex", flexWrap:"wrap", gap:6 }}>
          {suggestions.map((s,i)=>(
            <button key={i} onClick={()=>{setInput(s); setTimeout(()=>inputRef.current?.focus(),50);}}
              style={{ background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:8, padding:"5px 10px", fontSize:".72rem", color:"var(--text-secondary)", cursor:"pointer", fontFamily:"DM Sans,sans-serif", transition:"all .15s" }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--border-hover)";e.currentTarget.style.color="var(--text-primary)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text-secondary)";}}
            >{s}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding:"10px 14px", borderTop:"1px solid var(--border)", display:"flex", gap:8, alignItems:"center" }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="Ask anything about SmartDesk..."
          style={{ flex:1, background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:10, padding:"9px 13px", color:"var(--text-primary)", fontFamily:"DM Sans,sans-serif", fontSize:".83rem", outline:"none", transition:"border-color .2s" }}
          onFocus={e=>e.target.style.borderColor="var(--border-hover)"}
          onBlur={e=>e.target.style.borderColor="var(--border)"}
        />
        <button onClick={send} style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#7c3aed,#6d28d9)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"white", flexShrink:0, boxShadow:"0 2px 10px rgba(124,58,237,0.4)", transition:"opacity .15s" }}
          onMouseEnter={e=>e.currentTarget.style.opacity=".85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}
        ><IcoSend/></button>
      </div>
    </div>
  );
};

/* ── Settings Panel ─────────────────────────────────────────────────────── */
const SettingsPanel = ({ theme, setTheme, onClose }) => (
  <div className="settings-panel">
    <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <span style={{ fontFamily:"Plus Jakarta Sans,sans-serif", fontWeight:700, fontSize:".85rem", color:"var(--text-primary)" }}>Settings</span>
      <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)" }}><IcoX/></button>
    </div>
    <div style={{ padding:"14px 16px" }}>
      <div style={{ fontSize:".72rem", color:"var(--text-muted)", fontFamily:"Plus Jakarta Sans,sans-serif", fontWeight:600, letterSpacing:".1em", textTransform:"uppercase", marginBottom:10 }}>Appearance</div>
      {/* Theme toggle */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 12px", background:"var(--bg-elevated)", borderRadius:10, marginBottom:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {theme==="dark" ? <IcoMoon/> : <IcoSun/>}
          <div>
            <div style={{ fontFamily:"Plus Jakarta Sans,sans-serif", fontSize:".82rem", fontWeight:600, color:"var(--text-primary)" }}>Theme</div>
            <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:".7rem", color:"var(--text-muted)" }}>{theme==="dark"?"Dark mode":"Light mode"}</div>
          </div>
        </div>
        {/* Toggle switch */}
        <div onClick={()=>setTheme(t=>t==="dark"?"light":"dark")}
          style={{ width:46, height:26, borderRadius:13, background:theme==="dark"?"#7c3aed":"#e9d5ff", cursor:"pointer", position:"relative", transition:"background .3s", flexShrink:0 }}
        >
          <div style={{ position:"absolute", top:3, left:theme==="dark"?22:3, width:20, height:20, borderRadius:"50%", background:"white", transition:"left .3s", boxShadow:"0 2px 6px rgba(0,0,0,0.25)" }}/>
        </div>
      </div>
      <div style={{ fontSize:".7rem", color:"var(--text-muted)", fontFamily:"DM Sans,sans-serif", lineHeight:1.5, padding:"0 4px" }}>
        Switch between dark and light mode. Your preference is saved automatically.
      </div>
    </div>
  </div>
);

/* ── Sidebar ─────────────────────────────────────────────────────────────── */
const Sidebar = ({ active, setActive, theme, setTheme }) => {
  const [showSettings, setShowSettings] = useState(false);
  return (
    <div style={{ width:232, minWidth:232, background:"var(--bg-sidebar)", backdropFilter:"blur(24px) saturate(180%)", WebkitBackdropFilter:"blur(24px) saturate(180%)", borderRight:"1px solid var(--glass-border, rgba(255,255,255,0.12))", display:"flex", flexDirection:"column", padding:"22px 12px 16px", position:"sticky", top:0, height:"100vh", overflow:"hidden", zIndex:30, transition:"background .3s" }}>
      {/* Logo */}
      <div style={{ display:"flex", alignItems:"center", gap:11, padding:"0 6px", marginBottom:28 }}>
        <div style={{ width:40, height:40, borderRadius:12, background:"rgba(13,43,110,0.3)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 18px rgba(13,43,110,0.45)", flexShrink:0, border:"1px solid rgba(255,255,255,0.1)" }}>
          <img src="/images/swd-logo.png" alt="SWD" width={32} height={32} style={{ objectFit:"contain", filter:"brightness(0) invert(1)" }}/>
        </div>
        <div>
          <div style={{ fontFamily:"Plus Jakarta Sans,sans-serif", fontWeight:800, fontSize:"1.02rem", color:"var(--text-primary)", lineHeight:1 }}>SmartDesk</div>
          <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.62rem", color:"var(--text-muted)", marginTop:3, letterSpacing:"0.04em" }}>Enterprise Portal</div>
        </div>
      </div>

      <div style={{ fontFamily:"Plus Jakarta Sans,sans-serif", fontSize:"0.62rem", fontWeight:700, color:"var(--text-muted)", letterSpacing:"0.14em", textTransform:"uppercase", padding:"0 8px", marginBottom:6 }}>
        Explore
      </div>

      {/* Nav items */}
      <div style={{ display:"flex", flexDirection:"column", gap:1, flex:1 }}>
        {NAV.map(({ id, label, Icon }) => (
          <div key={id} className={`nav-item${active===id?" active":""}`} onClick={() => setActive(id)}>
            <span style={{ opacity:active===id?1:0.6, color:active===id?"#c084fc":"inherit" }}><Icon/></span>
            {label}
          </div>
        ))}
      </div>

      {/* Settings */}
      <div style={{ borderTop:"1px solid var(--border)", paddingTop:10, marginBottom:4, position:"relative" }}>
        {showSettings && <SettingsPanel theme={theme} setTheme={setTheme} onClose={()=>setShowSettings(false)}/>}
        <div className="nav-item" style={{ opacity:0.7 }} onClick={()=>setShowSettings(s=>!s)}>
          <span style={{ opacity:0.6 }}><IcoSettings/></span>
          Settings
        </div>
      </div>

      {/* User card — no A avatar, just name + status */}
      <div style={{ paddingTop:6, borderTop:"1px solid var(--border)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 8px", borderRadius:10, cursor:"pointer", transition:"background .2s" }}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(155,109,255,0.07)"}
          onMouseLeave={e=>e.currentTarget.style.background="transparent"}
        >
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:"Plus Jakarta Sans,sans-serif", fontSize:"0.8rem", fontWeight:600, color:"var(--text-primary)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>Admin User</div>
            <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:2 }}>
              <span className="online-dot" style={{ width:6, height:6 }}/>
              <span style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.65rem", color:"var(--accent-green)" }}>Online</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Top Bar ─────────────────────────────────────────────────────────────── */
const TopBar = ({ active, theme, setTheme, onSearch }) => {
  const page = NAV.find(n => n.id === active);
  const [showNotif, setShowNotif] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    const handler = e => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 28px", borderBottom:"1px solid var(--border)", background:"var(--bg-sidebar)", backdropFilter:"blur(24px) saturate(180%)", WebkitBackdropFilter:"blur(24px) saturate(180%)", position:"sticky", top:0, zIndex:20, transition:"background .3s" }}>
        <div>
          <h1 style={{ fontFamily:"Plus Jakarta Sans,sans-serif", fontWeight:700, fontSize:"1.05rem", color:"var(--text-primary)", lineHeight:1 }}>{page?.label}</h1>
          <p style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.72rem", color:"var(--text-muted)", marginTop:3 }}>Smart World Developers · Internal Portal</p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {/* Search bar → opens GlobalSearch */}
          <div className="search-wrap" onClick={onSearch} style={{ cursor:"pointer" }}>
            <IcoSearch/>
            <input placeholder="Search anything..." readOnly style={{ cursor:"pointer", width:180 }}/>
            <kbd style={{ fontFamily:"monospace", fontSize:".65rem", padding:"2px 6px", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:5, color:"var(--text-muted)", whiteSpace:"nowrap" }}>Ctrl K</kbd>
          </div>

          {/* Theme toggle */}
          <button className="theme-toggle" onClick={() => setTheme(t => t==="dark"?"light":"dark")} title="Toggle theme">
            {theme==="dark" ? <IcoMoon/> : <IcoSun/>}
            {theme==="dark" ? "Dark" : "Light"}
          </button>

          {/* Bell */}
          <div ref={notifRef} style={{ position:"relative" }}>
            <div className="icon-btn" onClick={() => setShowNotif(s => !s)} style={{ position:"relative" }}>
              <IcoBell/>
              <span style={{ position:"absolute", top:7, right:7, width:7, height:7, borderRadius:"50%", background:"var(--accent-pink)", border:"1.5px solid var(--bg-base)" }}/>
            </div>
            {showNotif && <NotifPanel onClose={() => setShowNotif(false)}/>}
          </div>
        </div>
      </div>
      {showChat && <AIChatPanel onClose={() => setShowChat(false)}/>}
    </>
  );
};

/* ── Quick-Access Ticker ────────────────────────────────────────────────── */
const QuickTicker = () => {
  const doubled = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div style={{ overflow:"hidden", background:"var(--bg-elevated)", borderBottom:"1px solid var(--border)", padding:"8px 0", position:"relative" }}>
      {/* fade edges */}
      <div style={{ position:"absolute", left:0, top:0, bottom:0, width:60, background:"linear-gradient(to right, var(--bg-elevated), transparent)", zIndex:2, pointerEvents:"none" }}/>
      <div style={{ position:"absolute", right:0, top:0, bottom:0, width:60, background:"linear-gradient(to left, var(--bg-elevated), transparent)", zIndex:2, pointerEvents:"none" }}/>
      <div className="ticker-track">
        {doubled.map((item,i) => (
          <span key={i} style={{ fontFamily:"DM Sans,sans-serif", fontSize:".78rem", color:"var(--text-secondary)", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:10 }}>
            {item}
            <span style={{ opacity:.3, color:"var(--accent-purple)" }}>◆</span>
          </span>
        ))}
      </div>
    </div>
  );
};

/* ── AppContent ─────────────────────────────────────────────────────────── */
const AppContent = () => {
  const { isAuthenticated, showLoading, initializeAuth } = useAuth();
  const [active, setActive] = useState("home");
  const [theme, setTheme] = useState(() => localStorage.getItem("sd-theme") || "dark");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("sd-sidebar-collapsed") === "true");
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => { initializeAuth(); }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("sd-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("sd-sidebar-collapsed", sidebarCollapsed);
  }, [sidebarCollapsed]);

  // Ctrl+K to open search
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setShowSearch(true); }
      if (e.key === 'Escape') setShowSearch(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (showLoading || !isAuthenticated) return <LoginForm/>;

  const handleSearchResult = (result) => {
    setShowSearch(false);
    if (!result) return;
    if (result.type === 'nav') setActive(result.navId);
    else if (result.type === 'employee') setActive('directory');
  };

  const CONTENT = {
    "home":             <Home/>,
    "directory":        <EmployeeDirectory/>,
    "attendance":       <LiveAttendance/>,
    "policies":         <Policies/>,
    "meeting-rooms":    <MeetingRooms/>,
    "holiday-calendar": <HolidayCalendar/>,
    "dashboard":        <Dashboard/>,
    "profile":          <MyProfile/>,
  };

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"var(--bg-base)", position:"relative", transition:"background .3s" }}>
      <CustomCursor/>
      <div className="orb orb-1"/><div className="orb orb-2"/><div className="orb orb-3"/>

      {/* Global search overlay */}
      {showSearch && <GlobalSearch onClose={handleSearchResult}/>}

      <BrowserRouter>
        <Routes>
          <Route path="/" element={
            <>
              {/* Collapsible Sidebar */}
              <div style={{
                width: sidebarCollapsed ? 64 : 232,
                minWidth: sidebarCollapsed ? 64 : 232,
                background:"var(--bg-sidebar)", backdropFilter:"blur(24px) saturate(180%)", WebkitBackdropFilter:"blur(24px) saturate(180%)", borderRight:"1px solid var(--glass-border, rgba(255,255,255,0.12))",
                display:"flex", flexDirection:"column",
                padding: sidebarCollapsed ? "22px 10px 16px" : "22px 12px 16px",
                position:"sticky", top:0, height:"100vh", overflow:"hidden",
                zIndex:30, transition:"all .25s ease",
              }}>
                {/* Logo + collapse toggle */}
                <div style={{ display:"flex", alignItems:"center", gap:11, padding:"0 4px", marginBottom:28, justifyContent: sidebarCollapsed ? "center" : "flex-start" }}>
                  <div style={{ width:40, height:40, borderRadius:12, background:"rgba(13,43,110,0.3)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 18px rgba(13,43,110,0.45)", flexShrink:0, border:"1px solid rgba(255,255,255,0.1)", cursor:"pointer" }}
                    onClick={() => setSidebarCollapsed(c => !c)} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
                    <img src="/images/swd-logo.png" alt="SWD" width={28} height={28} style={{ objectFit:"contain", filter:"brightness(0) invert(1)" }}/>
                  </div>
                  {!sidebarCollapsed && (
                    <div style={{ overflow:"hidden" }}>
                      <div style={{ fontFamily:"Plus Jakarta Sans,sans-serif", fontWeight:800, fontSize:"1.02rem", color:"var(--text-primary)", lineHeight:1, whiteSpace:"nowrap" }}>SmartDesk</div>
                      <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.62rem", color:"var(--text-muted)", marginTop:3, letterSpacing:"0.04em" }}>Enterprise Portal</div>
                    </div>
                  )}
                </div>

                {!sidebarCollapsed && (
                  <div style={{ fontFamily:"Plus Jakarta Sans,sans-serif", fontSize:"0.62rem", fontWeight:700, color:"var(--text-muted)", letterSpacing:"0.14em", textTransform:"uppercase", padding:"0 8px", marginBottom:6 }}>Explore</div>
                )}

                {/* Nav */}
                <div style={{ display:"flex", flexDirection:"column", gap:2, flex:1, overflowY:"auto" }}>
                  {NAV.map(({ id, label, Icon }) => (
                    <div key={id}
                      className={`nav-item${active===id?" active":""}`}
                      onClick={() => setActive(id)}
                      title={sidebarCollapsed ? label : ""}
                      style={{ justifyContent: sidebarCollapsed ? "center" : "flex-start", padding: sidebarCollapsed ? "10px" : "10px 14px", position:"relative" }}>
                      <span style={{ opacity:active===id?1:0.6, color:active===id?"#c084fc":"inherit", flexShrink:0 }}><Icon/></span>
                      {!sidebarCollapsed && <span style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{label}</span>}
                      {/* Live badge on attendance */}
                      {id === "attendance" && !sidebarCollapsed && (
                        <span style={{ marginLeft:"auto", fontFamily:"Plus Jakarta Sans,sans-serif", fontSize:".6rem", fontWeight:800, padding:"2px 7px", borderRadius:20, background:"rgba(74,222,128,0.15)", border:"1px solid rgba(74,222,128,0.35)", color:"#4ade80", letterSpacing:".05em" }}>LIVE</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Settings */}
                <div style={{ borderTop:"1px solid var(--border)", paddingTop:10, marginBottom:4, position:"relative" }}>
                  <SettingsDropdown theme={theme} setTheme={setTheme} collapsed={sidebarCollapsed}/>
                </div>

                {/* User */}
                {!sidebarCollapsed && (
                  <div style={{ paddingTop:6, borderTop:"1px solid var(--border)" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:9, padding:"8px", borderRadius:10, cursor:"pointer", transition:"background .2s" }}
                      onClick={() => setActive("profile")}
                      onMouseEnter={e=>e.currentTarget.style.background="rgba(155,109,255,0.07)"}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:"Plus Jakarta Sans,sans-serif", fontSize:"0.8rem", fontWeight:600, color:"var(--text-primary)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>Admin User</div>
                        <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:2 }}>
                          <span className="online-dot" style={{ width:6, height:6 }}/>
                          <span style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.65rem", color:"var(--accent-green)" }}>Online</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Main */}
              <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", position:"relative", zIndex:1 }}>
                <TopBar active={active} theme={theme} setTheme={setTheme} onSearch={() => setShowSearch(true)}/>
                <QuickTicker/>
                <div style={{ flex:1, overflowY:"auto", padding:"24px 28px 16px" }}>
                  <div className="tab-fade-in" key={active}>
                    {CONTENT[active]}
                  </div>
                </div>
                <Footer/>
              </div>
            </>
          }/>
        </Routes>
      </BrowserRouter>
      <Toaster/>
    </div>
  );
};

/* ── Settings Dropdown (works in collapsed sidebar too) ─────────────────── */
const SettingsDropdown = ({ theme, setTheme, collapsed }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position:"relative" }}>
      {open && (
        <div className="settings-panel" style={{ bottom:50, left:0, right:0 }}>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontFamily:"Plus Jakarta Sans,sans-serif", fontWeight:700, fontSize:".85rem", color:"var(--text-primary)" }}>Settings</span>
            <button onClick={() => setOpen(false)} style={{ background:"none", border:"none", color:"var(--text-muted)" }}><IcoX/></button>
          </div>
          <div style={{ padding:"14px 16px" }}>
            <div style={{ fontSize:".72rem", color:"var(--text-muted)", fontFamily:"Plus Jakarta Sans,sans-serif", fontWeight:600, letterSpacing:".1em", textTransform:"uppercase", marginBottom:10 }}>Appearance</div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 12px", background:"var(--bg-elevated)", borderRadius:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                {theme==="dark" ? <IcoMoon/> : <IcoSun/>}
                <div>
                  <div style={{ fontFamily:"Plus Jakarta Sans,sans-serif", fontSize:".82rem", fontWeight:600, color:"var(--text-primary)" }}>Theme</div>
                  <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:".7rem", color:"var(--text-muted)" }}>{theme==="dark"?"Dark":"Light"} mode</div>
                </div>
              </div>
              <div onClick={() => setTheme(t => t==="dark"?"light":"dark")}
                style={{ width:46, height:26, borderRadius:13, background:theme==="dark"?"#7c3aed":"#e9d5ff", cursor:"pointer", position:"relative", transition:"background .3s", flexShrink:0 }}>
                <div style={{ position:"absolute", top:3, left:theme==="dark"?22:3, width:20, height:20, borderRadius:"50%", background:"white", transition:"left .3s", boxShadow:"0 2px 6px rgba(0,0,0,0.25)" }}/>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="nav-item" style={{ opacity:0.7, justifyContent: collapsed ? "center" : "flex-start", padding: collapsed ? "10px" : "10px 14px" }} onClick={() => setOpen(s => !s)} title="Settings">
        <span style={{ opacity:0.6 }}><IcoSettings/></span>
        {!collapsed && "Settings"}
      </div>
    </div>
  );
};

export default function App() { return <AuthProvider><AppContent/></AuthProvider>; }
