import React from "react";
const Footer = () => (
  <div style={{
    padding:'10px 28px',
    borderTop:'1px solid var(--border)',
    display:'flex', justifyContent:'space-between', alignItems:'center',
    background:'var(--footer-bg)',
    backdropFilter:'blur(12px)',
    transition:'background .3s',
  }}>
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:'var(--success)', animation:'dotPulse 2s ease-in-out infinite' }} />
      <span style={{ fontFamily:'DM Sans,sans-serif', fontSize:'0.68rem', color:'var(--text-muted)', letterSpacing:'0.04em' }}>
        SmartDesk v2.0 · All systems operational
      </span>
    </div>
    <span style={{ fontFamily:'DM Sans,sans-serif', fontSize:'0.66rem', color:'var(--text-muted)' }}>
      © {new Date().getFullYear()} Smart World Developers
    </span>
  </div>
);
export default Footer;
