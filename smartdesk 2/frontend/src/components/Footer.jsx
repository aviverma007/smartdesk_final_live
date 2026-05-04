import React from "react";
const Footer = () => (
  <div style={{
    padding:'10px 28px',
    borderTop:'1px solid rgba(139,92,246,0.12)',
    display:'flex', justifyContent:'space-between', alignItems:'center',
    background:'rgba(13,11,26,0.7)',
    backdropFilter:'blur(12px)',
  }}>
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:'#4ade80', boxShadow:'0 0 6px rgba(74,222,128,0.7)', animation:'dotPulse 2s ease-in-out infinite' }} />
      <span style={{ fontFamily:'DM Sans,sans-serif', fontSize:'0.68rem', color:'rgba(177,168,216,0.5)', letterSpacing:'0.04em' }}>
        SmartDesk v2.0 · All systems operational
      </span>
    </div>
    <span style={{ fontFamily:'DM Sans,sans-serif', fontSize:'0.62rem', color:'rgba(107,100,145,0.6)' }}>
      © 2025 Smart World Developers
    </span>
  </div>
);
export default Footer;
