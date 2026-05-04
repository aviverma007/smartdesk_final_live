import React from "react";

const Footer = () => (
  <footer style={{
    background: 'linear-gradient(180deg, rgba(2,8,22,0) 0%, rgba(2,8,22,0.98) 100%)',
    borderTop: '1px solid rgba(0,212,255,0.15)',
    padding: '12px 24px',
    marginTop: 'auto',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="pulse-dot" />
        <span style={{
          fontFamily: 'Share Tech Mono, monospace',
          fontSize: '0.6rem',
          color: 'rgba(0,212,255,0.5)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
        }}>
          SMARTDESK v2.0 // ALL SYSTEMS OPERATIONAL
        </span>
      </div>
      <span style={{
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '0.55rem',
        color: 'rgba(122,184,212,0.3)',
        letterSpacing: '0.1em',
      }}>
        © 2025 SMART WORLD DEVELOPERS
      </span>
    </div>
  </footer>
);

export default Footer;
