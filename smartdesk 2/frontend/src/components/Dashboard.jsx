import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, Play, BarChart3, TrendingUp, Users, FileText, BarChart2, ChevronRight, ArrowUpRight } from 'lucide-react';

/* ─── DATA ──────────────────────────────────────────────────────────────── */
const DASHBOARDS = [
  {
    id: 'po', title: 'PO Dashboard', subtitle: 'Purchase Orders',
    stat: '1,248', delta: '+12%',
    gradient: 'linear-gradient(135deg,#1a1040 0%,#4c1d95 40%,#7c3aed 70%,#c084fc 100%)',
    spotGrad: 'radial-gradient(ellipse at 30% 40%, rgba(196,132,252,0.5) 0%, transparent 60%)',
    textColor: '#c084fc',
    url:'https://app.powerbi.com/view?r=eyJrIjoiYWI3MmFhNmEtZGY4Yy00MjhkLTgwOTYtZDM2ZjEwMDFkY2QzIiwidCI6IjcxMWY0MDY2LTA3YjctNDVhMS05ZTMyLTk3OGU4NjUyOGNhZCJ9',
  },
  {
    id: 'pr', title: 'PR Dashboard', subtitle: 'Purchase Requests',
    stat: '384', delta: '+8%',
    gradient: 'linear-gradient(135deg,#0c1a40 0%,#1e3a8a 40%,#2563eb 70%,#60a5fa 100%)',
    spotGrad: 'radial-gradient(ellipse at 70% 30%, rgba(96,165,250,0.5) 0%, transparent 60%)',
    textColor: '#60a5fa',
    url:'https://app.powerbi.com/view?r=eyJrIjoiMjgyNTI0NzgtMmZiMS00MWFlLTkyMzUtNTMyNTYyY2I1MTZjIiwidCI6IjcxMWY0MDY2LTA3YjctNDVhMS05ZTMyLTk3OGU4NjUyOGNhZCJ9',
  },
  {
    id: 'qms', title: 'QMS Dashboard', subtitle: 'Quality Management',
    stat: '97.4%', delta: '+2.1%',
    gradient: 'linear-gradient(135deg,#0a2010 0%,#14532d 40%,#16a34a 70%,#4ade80 100%)',
    spotGrad: 'radial-gradient(ellipse at 20% 60%, rgba(74,222,128,0.5) 0%, transparent 60%)',
    textColor: '#4ade80',
    url:'https://app.powerbi.com/view?r=eyJrIjoiY2Y0YjA4ZDUtZjg5ZC00YjE5LThjYzYtY2QyOTE5YzlmYzk1IiwidCI6IjcxMWY0MDY2LTA3YjctNDVhMS05ZTMyLTk3OGU4NjUyOGNhZCJ9',
  },
  {
    id: 'cost', title: 'Cost Dashboard', subtitle: 'Cost Analytics',
    stat: '₹2.4Cr', delta: '-3.2%',
    gradient: 'linear-gradient(135deg,#1a0c00 0%,#7c2d12 40%,#ea580c 70%,#fb923c 100%)',
    spotGrad: 'radial-gradient(ellipse at 60% 20%, rgba(251,146,60,0.5) 0%, transparent 60%)',
    textColor: '#fb923c',
    url:'https://app.powerbi.com/view?r=eyJrIjoiZjBjYjk1MTItMjI4OS00Y2MzLTg1OGUtZWU1NjgzMTk3MDJlIiwidCI6IjcxMWY0MDY2LTA3YjctNDVhMS05ZTMyLTk3OGU4NjUyOGNhZCJ9',
  },
  {
    id: 'assets', title: 'Asset Dashboard', subtitle: 'Asset Tracking',
    stat: '3,892', delta: '+5%',
    gradient: 'linear-gradient(135deg,#0a1a1a 0%,#134e4a 40%,#0d9488 70%,#2dd4bf 100%)',
    spotGrad: 'radial-gradient(ellipse at 80% 50%, rgba(45,212,191,0.5) 0%, transparent 60%)',
    textColor: '#2dd4bf',
    url:'https://app.powerbi.com/view?r=eyJrIjoiNWM4YzRkMjctOTZmMC00ZDJhLWFhYmMtZWQ2MWU1ZDUyMzMzIiwidCI6IjcxMWY0MDY2LTA3YjctNDVhMS05ZTMyLTk3OGU4NjUyOGNhZCJ9',
  },
  {
    id: 'dpr', title: 'Daily Progress', subtitle: 'Progress Report',
    stat: '86%', delta: '+4%',
    gradient: 'linear-gradient(135deg,#1a1000 0%,#78350f 40%,#d97706 70%,#fbbf24 100%)',
    spotGrad: 'radial-gradient(ellipse at 30% 80%, rgba(251,191,36,0.5) 0%, transparent 60%)',
    textColor: '#fbbf24',
    url:'https://app.powerbi.com/view?r=eyJrIjoiOWJlZmRlYWMtYTkwMC00NWY4LWIzNTEtYzcxNDg2Zjg2Mjg0IiwidCI6IjcxMWY0MDY2LTA3YjctNDVhMS05ZTMyLTk3OGU4NjUyOGNhZCJ9',
  },
  {
    id: 'swdsales', title: 'Sales · Demand & Collection · CRM Case Management', subtitle: 'SWD Sales Portal · swdsales.com:90',
    stat: 'Open', delta: '',
    gradient: 'linear-gradient(135deg,#1a001a 0%,#701a75 35%,#c026d3 68%,#e879f9 100%)',
    spotGrad: 'radial-gradient(ellipse at 40% 70%, rgba(232,121,249,0.5) 0%, transparent 60%)',
    textColor: '#e879f9',
    url:'http://www.swdsales.com:90/',
  },
];

/* ─── HERO CARD (featured, full-width or large) ────────────────────────── */
const HeroCard = ({ item }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={() => window.open(item.url, '_blank')}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: item.gradient,
        borderRadius: 16,
        padding: '28px 28px 22px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.35s cubic-bezier(.22,.68,0,1.2), box-shadow 0.35s',
        transform: hov ? 'translateY(-4px) scale(1.01)' : 'translateY(0) scale(1)',
        boxShadow: hov
          ? `0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px ${item.textColor}40`
          : '0 8px 32px rgba(0,0,0,0.45)',
        minHeight: 190,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}
    >
      {/* Spot light */}
      <div style={{ position:'absolute', inset:0, background: item.spotGrad, pointerEvents:'none' }} />
      {/* Noise texture overlay */}
      <div style={{
        position:'absolute', inset:0, opacity:.04, pointerEvents:'none',
        backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: '200px 200px',
      }} />
      {/* Scan lines */}
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.06) 3px,rgba(0,0,0,0.06) 4px)',
      }} />
      {/* Hover shimmer */}
      <div style={{
        position:'absolute', top:0, left: hov ? '120%' : '-40%', width:'35%', height:'100%',
        background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)',
        transition:'left 0.7s ease', pointerEvents:'none',
        transform:'skewX(-20deg)',
      }} />

      {/* Top row */}
      <div style={{ position:'relative', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{
            fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:800,
            fontSize:'1.4rem', color:'#fff', lineHeight:1,
            textShadow:'0 2px 12px rgba(0,0,0,0.4)',
          }}>{item.title}</div>
          <div style={{
            fontFamily:'DM Sans, sans-serif', fontSize:'0.8rem',
            color:'rgba(255,255,255,0.6)', marginTop:5,
          }}>{item.subtitle}</div>
        </div>
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: `${item.textColor}22`,
          border: `1.5px solid ${item.textColor}60`,
          display:'flex', alignItems:'center', justifyContent:'center',
          backdropFilter:'blur(8px)',
          transition:'transform 0.3s, background 0.3s',
          transform: hov ? 'scale(1.15)' : 'scale(1)',
        }}>
          <Play size={14} fill={item.textColor} color={item.textColor} />
        </div>
      </div>

      {/* Stats + CTA */}
      <div style={{ position:'relative', display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
        <div>
          <div style={{
            fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:800,
            fontSize:'2.1rem', color:'#fff', lineHeight:1,
            textShadow:`0 0 24px ${item.textColor}80`,
          }}>{item.stat}</div>
          <div style={{
            fontFamily:'DM Sans, sans-serif', fontSize:'0.72rem',
            color: item.delta.startsWith('+') ? '#4ade80' : '#f87171',
            marginTop: 4, display:'flex', alignItems:'center', gap:3,
          }}>
            <span>{item.delta}</span>
            <span style={{color:'rgba(255,255,255,0.4)'}}>vs last month</span>
          </div>
        </div>
        <div style={{
          display:'flex', alignItems:'center', gap:6,
          fontFamily:'Plus Jakarta Sans, sans-serif', fontSize:'0.72rem', fontWeight:600,
          color: item.textColor,
          opacity: hov ? 1 : 0.7, transition:'opacity 0.3s',
        }}>
          Open Report <ArrowUpRight size={13} />
        </div>
      </div>

      {/* Waveform decoration */}
      <svg style={{ position:'absolute', bottom:0, right:0, opacity:0.12, pointerEvents:'none' }}
        width="120" height="60" viewBox="0 0 120 60">
        {[10,24,38,52,66,80,94,108].map((x,i) => (
          <rect key={i} x={x} y={60 - [20,40,28,50,34,44,24,38][i]} width="6" rx="3"
            height={[20,40,28,50,34,44,24,38][i]} fill="white"/>
        ))}
      </svg>
    </div>
  );
};

/* ─── COMPACT CARD ─────────────────────────────────────────────────────── */
const CompactCard = ({ item }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={() => window.open(item.url, '_blank')}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: item.gradient,
        borderRadius: 12,
        padding: '18px 16px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.3s cubic-bezier(.22,.68,0,1.2), box-shadow 0.3s',
        transform: hov ? 'translateY(-3px) scale(1.02)' : 'translateY(0) scale(1)',
        boxShadow: hov
          ? `0 16px 40px rgba(0,0,0,0.55), 0 0 0 1px ${item.textColor}40`
          : '0 4px 20px rgba(0,0,0,0.4)',
        minHeight: 130,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}
    >
      <div style={{ position:'absolute', inset:0, background: item.spotGrad, pointerEvents:'none' }} />
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.05) 3px,rgba(0,0,0,0.05) 4px)',
      }} />
      {/* Shimmer */}
      <div style={{
        position:'absolute', top:0, left: hov ? '120%' : '-40%', width:'40%', height:'100%',
        background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.09),transparent)',
        transition:'left 0.6s ease', pointerEvents:'none', transform:'skewX(-15deg)',
      }} />

      <div style={{ position:'relative', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div style={{
          fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:700,
          fontSize:'0.88rem', color:'#fff', lineHeight:1.2,
        }}>{item.title}</div>
        <ArrowUpRight size={14} color={item.textColor} style={{ opacity: hov ? 1 : 0.5, transition:'opacity 0.3s', flexShrink:0, marginLeft:4 }} />
      </div>

      <div style={{ position:'relative' }}>
        <div style={{
          fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:800,
          fontSize:'1.55rem', color:'#fff', lineHeight:1,
          textShadow:`0 0 18px ${item.textColor}70`,
        }}>{item.stat}</div>
        <div style={{
          fontFamily:'DM Sans, sans-serif', fontSize:'0.68rem',
          color: item.delta.startsWith('+') ? '#4ade80' : '#f87171',
          marginTop:3,
        }}>{item.delta} <span style={{color:'rgba(255,255,255,0.35)'}}>· {item.subtitle}</span></div>
      </div>
    </div>
  );
};

/* ─── MAIN DASHBOARD ───────────────────────────────────────────────────── */
const Dashboard = () => {
  const [featured, setFeatured] = useState(0);

  // Auto-rotate featured
  useEffect(() => {
    const t = setInterval(() => setFeatured(f => (f + 1) % 3), 6000);
    return () => clearInterval(t);
  }, []);

  const heroItems = DASHBOARDS.slice(0, 3);
  const gridItems = DASHBOARDS.slice(3);

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Section header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom: 20 }}>
        <div>
          <p style={{
            fontFamily:'Plus Jakarta Sans, sans-serif', fontSize:'0.68rem',
            fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase',
            color:'var(--accent-purple)', marginBottom:5,
          }}>Power BI Analytics</p>
          <h2 style={{
            fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:800,
            fontSize:'1.5rem', color:'var(--text-primary)', lineHeight:1, margin:0,
          }}>Live Dashboards</h2>
        </div>
        <p style={{
          fontFamily:'DM Sans, sans-serif', fontSize:'0.78rem',
          color:'var(--text-muted)',
        }}>{DASHBOARDS.length} reports connected</p>
      </div>

      {/* FEATURED ROW — 3 hero cards side by side */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.5fr 1fr 1fr',
        gap: 14,
        marginBottom: 14,
      }}>
        {heroItems.map((item, i) => (
          <div key={item.id} style={{
            opacity: i === featured ? 1 : 0.88,
            transition: 'opacity 0.5s',
          }}>
            <HeroCard item={item} />
          </div>
        ))}
      </div>

      {/* Dots indicator */}
      <div style={{ display:'flex', justifyContent:'center', gap:6, marginBottom:20 }}>
        {heroItems.map((_, i) => (
          <button key={i} onClick={() => setFeatured(i)} style={{
            width: i === featured ? 20 : 7, height: 7, borderRadius: 4,
            background: i === featured ? 'var(--accent-purple)' : 'rgba(255,255,255,0.15)',
            border: 'none', cursor:'pointer', padding:0,
            transition: 'width 0.4s, background 0.4s',
            boxShadow: i === featured ? '0 0 8px rgba(139,92,246,0.6)' : 'none',
          }} />
        ))}
      </div>

      {/* GRID — remaining cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
        gap: 12,
      }}>
        {gridItems.map(item => <CompactCard key={item.id} item={item} />)}
      </div>

      {/* Bottom CTA strip */}
      <div style={{
        marginTop: 20,
        background: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(244,114,182,0.08) 100%)',
        border: '1px solid rgba(139,92,246,0.25)',
        borderRadius: 12, padding: '14px 20px',
        display: 'flex', justifyContent:'space-between', alignItems:'center',
      }}>
        <div>
          <div style={{
            fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:700,
            fontSize:'0.88rem', color:'var(--text-primary)',
          }}>Need a custom report?</div>
          <div style={{
            fontFamily:'DM Sans, sans-serif', fontSize:'0.74rem',
            color:'var(--text-muted)', marginTop:2,
          }}>Contact the analytics team to build tailored Power BI dashboards</div>
        </div>
        <button style={{
          fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:600,
          fontSize:'0.78rem', color:'white', padding:'9px 18px',
          background:'linear-gradient(135deg,#7c3aed,#f472b6)',
          border:'none', borderRadius:9, cursor:'pointer',
          boxShadow:'0 4px 16px rgba(124,58,237,0.45)',
          display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap',
          transition:'opacity 0.2s',
        }}
          onMouseEnter={e=>e.currentTarget.style.opacity='.85'}
          onMouseLeave={e=>e.currentTarget.style.opacity='1'}
        >
          Request Report <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
