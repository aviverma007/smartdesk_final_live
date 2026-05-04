import React, { useState, useEffect } from "react";
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

/* ── Icons ───────────────────────────────────────────────────────────────── */
const IcoHome    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IcoUsers   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IcoShield  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IcoRoom    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
const IcoCal     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IcoChart   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><polyline points="2 20 22 20"/></svg>;
const IcoBell    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const IcoSearch  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IcoSettings= () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;

/* ── Nav config ──────────────────────────────────────────────────────────── */
const NAV = [
  { id:"home",             label:"Home",              Icon:IcoHome },
  { id:"directory",        label:"Employee Directory", Icon:IcoUsers },
  { id:"policies",         label:"Policies",           Icon:IcoShield },
  { id:"meeting-rooms",    label:"Meeting Rooms",      Icon:IcoRoom },
  { id:"holiday-calendar", label:"Holiday Calendar",   Icon:IcoCal },
  { id:"dashboard",        label:"Dashboard",          Icon:IcoChart },
];

/* ── Sidebar ─────────────────────────────────────────────────────────────── */
const Sidebar = ({ active, setActive }) => (
  <div style={{
    width:232, minWidth:232,
    background:'var(--bg-sidebar)',
    borderRight:'1px solid var(--border)',
    display:'flex', flexDirection:'column',
    padding:'22px 12px 16px',
    position:'sticky', top:0, height:'100vh',
    overflow:'hidden', zIndex:30,
  }}>
    {/* Logo */}
    <div style={{ display:'flex', alignItems:'center', gap:11, padding:'0 6px', marginBottom:28 }}>
      <div style={{
        width:40, height:40, borderRadius:12,
        background:'linear-gradient(135deg,#7c3aed,#f472b6)',
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 4px 18px rgba(124,58,237,0.45)', flexShrink:0,
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      </div>
      <div>
        <div style={{ fontFamily:'Plus Jakarta Sans,sans-serif', fontWeight:800, fontSize:'1.02rem', color:'var(--text-primary)', lineHeight:1 }}>SmartDesk</div>
        <div style={{ fontFamily:'DM Sans,sans-serif', fontSize:'0.62rem', color:'var(--text-muted)', marginTop:3, letterSpacing:'0.04em' }}>Enterprise Portal</div>
      </div>
    </div>

    <div style={{ fontFamily:'Plus Jakarta Sans,sans-serif', fontSize:'0.62rem', fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.14em', textTransform:'uppercase', padding:'0 8px', marginBottom:6 }}>
      Explore
    </div>

    {/* Nav items */}
    <div style={{ display:'flex', flexDirection:'column', gap:1, flex:1 }}>
      {NAV.map(({ id, label, Icon }) => (
        <div key={id} className={`nav-item${active===id?' active':''}`} onClick={() => setActive(id)}>
          <span style={{ opacity: active===id ? 1 : 0.6, color: active===id ? '#c084fc' : 'inherit' }}>
            <Icon/>
          </span>
          {label}
        </div>
      ))}
    </div>

    {/* Divider + settings */}
    <div style={{ borderTop:'1px solid var(--border)', paddingTop:10, marginBottom:4 }}>
      <div className="nav-item" style={{ opacity:0.6 }}>
        <span style={{ opacity:0.6 }}><IcoSettings/></span>
        Settings
      </div>
    </div>

    {/* User card */}
    <div style={{ paddingTop:6, borderTop:'1px solid var(--border)' }}>
      <div style={{
        display:'flex', alignItems:'center', gap:9,
        padding:'8px 8px', borderRadius:10,
        cursor:'pointer', transition:'background 0.2s',
      }}
        onMouseEnter={e=>e.currentTarget.style.background='rgba(155,109,255,0.07)'}
        onMouseLeave={e=>e.currentTarget.style.background='transparent'}
      >
        <div style={{
          width:34, height:34, borderRadius:'50%', flexShrink:0,
          background:'linear-gradient(135deg,#7c3aed,#f472b6)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:13, fontWeight:700, color:'white',
          fontFamily:'Plus Jakarta Sans,sans-serif',
          boxShadow:'0 2px 10px rgba(124,58,237,0.4)',
        }}>A</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:'Plus Jakarta Sans,sans-serif', fontSize:'0.8rem', fontWeight:600, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>Admin User</div>
          <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
            <span className="online-dot" style={{ width:6, height:6 }}/>
            <span style={{ fontFamily:'DM Sans,sans-serif', fontSize:'0.65rem', color:'var(--accent-green)' }}>Online</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

/* ── Top Bar ─────────────────────────────────────────────────────────────── */
const TopBar = ({ active }) => {
  const page = NAV.find(n => n.id === active);
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'13px 28px',
      borderBottom:'1px solid var(--border)',
      background:'rgba(13,11,26,0.85)',
      backdropFilter:'blur(16px)',
      WebkitBackdropFilter:'blur(16px)',
      position:'sticky', top:0, zIndex:20,
    }}>
      <div>
        <h1 style={{ fontFamily:'Plus Jakarta Sans,sans-serif', fontWeight:700, fontSize:'1.05rem', color:'var(--text-primary)', lineHeight:1 }}>
          {page?.label}
        </h1>
        <p style={{ fontFamily:'DM Sans,sans-serif', fontSize:'0.72rem', color:'var(--text-muted)', marginTop:3 }}>
          Smart World Developers · Internal Portal
        </p>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div className="search-wrap">
          <IcoSearch/>
          <input placeholder="Search..."/>
        </div>
        <div className="icon-btn" style={{ position:'relative' }}>
          <IcoBell/>
          <span style={{ position:'absolute', top:7, right:7, width:7, height:7, borderRadius:'50%', background:'var(--accent-pink)', border:'1.5px solid var(--bg-base)' }}/>
        </div>
        <div style={{
          width:34, height:34, borderRadius:'50%',
          background:'linear-gradient(135deg,#7c3aed,#f472b6)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:13, fontWeight:700, color:'white',
          fontFamily:'Plus Jakarta Sans,sans-serif', cursor:'pointer',
          boxShadow:'0 2px 10px rgba(124,58,237,0.4)',
        }}>A</div>
      </div>
    </div>
  );
};

/* ── App ─────────────────────────────────────────────────────────────────── */
const AppContent = () => {
  const { isAuthenticated, showLoading, initializeAuth } = useAuth();
  const [active, setActive] = useState("home");
  useEffect(() => { initializeAuth(); }, []);
  if (showLoading || !isAuthenticated) return <LoginForm/>;

  const CONTENT = {
    "home":             <Home/>,
    "directory":        <EmployeeDirectory/>,
    "policies":         <Policies/>,
    "meeting-rooms":    <MeetingRooms/>,
    "holiday-calendar": <HolidayCalendar/>,
    "dashboard":        <Dashboard/>,
  };

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg-base)', position:'relative' }}>
      {/* Ambient orbs */}
      <div className="orb orb-1"/><div className="orb orb-2"/><div className="orb orb-3"/>

      <BrowserRouter>
        <Routes>
          <Route path="/" element={
            <>
              <Sidebar active={active} setActive={setActive}/>
              <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative', zIndex:1 }}>
                <TopBar active={active}/>
                <div style={{ flex:1, overflowY:'auto', padding:'24px 28px 16px' }}>
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

export default function App() {
  return <AuthProvider><AppContent/></AuthProvider>;
}
