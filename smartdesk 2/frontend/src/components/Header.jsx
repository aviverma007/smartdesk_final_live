import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const Header = () => {
  const { isAdmin } = useAuth();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleLogoClick = () => { window.location.href = '/'; };

  const timeStr = time.toLocaleTimeString('en-US', { hour12: false });
  const dateStr = time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <header style={{
      background: 'linear-gradient(180deg, rgba(2,8,22,0.98) 0%, rgba(4,12,30,0.95) 100%)',
      borderBottom: '1px solid rgba(0,212,255,0.3)',
      boxShadow: '0 4px 30px rgba(0,0,0,0.6), 0 1px 0 rgba(0,212,255,0.2)',
      position: 'relative',
      zIndex: 50,
    }}>
      {/* Top accent line */}
      <div style={{
        height: '2px',
        background: 'linear-gradient(90deg, transparent 0%, #00d4ff 20%, #0066ff 50%, #7b2fff 80%, transparent 100%)',
        opacity: 0.8
      }} />

      <div style={{ padding: '10px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
          {/* Left: Logo + Name */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}
            onClick={handleLogoClick}
          >
            {/* Hexagon logo container */}
            <div style={{
              width: 44, height: 44,
              background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,102,255,0.2))',
              border: '1px solid rgba(0,212,255,0.5)',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 15px rgba(0,212,255,0.2)',
              overflow: 'hidden',
              position: 'relative',
            }}>
              <img
                src="/images/header-logo.png"
                alt="SmartDesk"
                style={{ width: 32, height: 32, objectFit: 'contain', position: 'relative', zIndex: 1 }}
                onError={e => { e.target.style.display='none'; }}
              />
              {/* Fallback icon */}
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Orbitron, monospace', fontSize: 16, fontWeight: 900, color: '#00d4ff',
                textShadow: '0 0 10px rgba(0,212,255,0.8)',
              }}>SD</div>
            </div>

            <div>
              <div style={{
                fontFamily: 'Orbitron, monospace',
                fontWeight: 800,
                fontSize: '1.15rem',
                letterSpacing: '0.15em',
                color: '#00d4ff',
                textShadow: '0 0 12px rgba(0,212,255,0.6), 0 0 25px rgba(0,212,255,0.3)',
                lineHeight: 1,
              }}>
                SMARTDESK
              </div>
              <div style={{
                fontFamily: 'Share Tech Mono, monospace',
                fontSize: '0.6rem',
                color: 'rgba(0,212,255,0.5)',
                letterSpacing: '0.25em',
                marginTop: 3,
              }}>
                ENTERPRISE INTELLIGENCE SYSTEM
              </div>
            </div>
          </div>

          {/* Center: Status indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <StatusPill label="SYSTEM" value="ONLINE" color="#00ff88" />
            <StatusPill label="NETWORK" value="SECURE" color="#00d4ff" />
            {isAdmin && <StatusPill label="MODE" value="ADMIN" color="#7b2fff" />}
          </div>

          {/* Right: Clock */}
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontFamily: 'Share Tech Mono, monospace',
              fontSize: '1.2rem',
              color: '#00d4ff',
              textShadow: '0 0 10px rgba(0,212,255,0.5)',
              letterSpacing: '0.05em',
              lineHeight: 1,
            }}>
              {timeStr}
            </div>
            <div style={{
              fontFamily: 'Exo 2, sans-serif',
              fontSize: '0.6rem',
              color: 'rgba(122,184,212,0.7)',
              letterSpacing: '0.15em',
              marginTop: 3,
              textTransform: 'uppercase',
            }}>
              {dateStr}
            </div>
          </div>
        </div>
      </div>

      {/* Animated scan line */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.4), transparent)',
      }} />
    </header>
  );
};

const StatusPill = ({ label, value, color }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: color, boxShadow: `0 0 6px ${color}`,
        animation: 'pulse-glow 2s ease-in-out infinite',
      }} />
      <span style={{
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '0.65rem',
        color,
        letterSpacing: '0.1em',
      }}>{value}</span>
    </div>
    <span style={{
      fontFamily: 'Exo 2, sans-serif',
      fontSize: '0.5rem',
      color: 'rgba(122,184,212,0.5)',
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
    }}>{label}</span>
  </div>
);

export default Header;
