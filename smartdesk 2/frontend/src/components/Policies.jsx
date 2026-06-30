import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, ExternalLink } from 'lucide-react';

const POLICY_DATA = {
  "HR POLICY": [
    { title:"Working Hours & Attendance Policy", link:"/company policies/Working Hours & Attendance Policy.pdf", description:"Attendance requirements and working hours guidelines" },
    { title:"Sexual Harassment At Work Redressal Policy", link:"/company policies/_12_39_b356500c83384d2d_Sexual Harassment At Work Redressal Policy_26-Apr-22.pdf", description:"Workplace harassment prevention and redressal procedures" },
    { title:"Dress Code Policy", link:"/company policies/_13_55_00673d13502c42da_Dress code policy.pdf", description:"Professional dress code guidelines and standards" },
    { title:"Employee Referral Policy", link:"/company policies/_14_19_2fe9bd4b1c514d00_Employee referral policy.pdf", description:"Employee referral program guidelines and procedures" },
    { title:"Leave Policy (Revised)", link:"/company policies/_14_33_50e319284d7e4fe4_Leave Policy (Revised).pdf", description:"Comprehensive leave policy including all types of leaves" },
    { title:"Local Conveyance Policy", link:"/company policies/_15_9_02985794b8584650_Local Conveyance policy.pdf", description:"Local travel and conveyance reimbursement guidelines" },
    { title:"Whistle Blower Policy", link:"/company policies/_16_4_3edd02c8f36f429f_Whistle Blower Policy.pdf", description:"Whistleblower protection and reporting procedures" },
    { title:"Tour Travel Policy", link:"/company policies/_23_44_6eca6e909cee4aa7_Tour Travel Policy.pdf", description:"Business travel guidelines and expense policies" },
    { title:"Revised Attendance Policy", link:"/company policies/_36_12_f19af68b04f849ee_Revised Attendance Policy w.e.f 21st May 25.pdf", description:"Updated attendance policy effective from May 21, 2025" },
    { title:"Night Shift Meal & Conveyance Allowance", link:"/company policies/_38_0_62d66a9aaaf645cc_Meal and Conveyance for Employees Working at Night on Sites.pdf", description:"Allowance for employees working night shifts on sites" },
    { title:"Flexible Work Schedule Policy", link:"/company policies/Microsoft Word - Flexible Work Schedule.pdf", description:"Guidelines for flexible working arrangements and remote work" },
  ],
  "ADMIN POLICY": [
    { title:"Office Administration Guidelines", link:"/company policies/Office Administration Guidelines.pdf", description:"General office administration and management procedures" },
    { title:"Asset Management Policy", link:"/company policies/Asset Management Policy.pdf", description:"Company asset allocation, maintenance, and return procedures" },
    { title:"Visitor Management Policy", link:"/company policies/Visitor Management Policy.pdf", description:"Guidelines for visitor access and management procedures" },
    { title:"Document Management Policy", link:"/company policies/Document Management Policy.pdf", description:"Document creation, storage, and archival procedures" },
    { title:"Facility Management Guidelines", link:"/company policies/Facility Management Guidelines.pdf", description:"Facility maintenance and management procedures" },
  ],
  "IT POLICY": [
    { title:"IT Security Policy", link:"/company policies/IT Security Policy.pdf", description:"Information technology security guidelines and procedures" },
    { title:"Data Protection Policy", link:"/company policies/Data Protection Policy.pdf", description:"Data privacy and protection guidelines" },
    { title:"Acceptable Use Policy", link:"/company policies/Acceptable Use Policy.pdf", description:"Guidelines for acceptable use of company IT resources" },
  ],
};

const SECTION_COLORS = { "HR POLICY":"#00d4ff", "ADMIN POLICY":"#7b2fff", "IT POLICY":"#00ff88" };

const Policies = () => {
  const [expanded, setExpanded] = useState({ "HR POLICY": true, "ADMIN POLICY": false, "IT POLICY": false });

  const toggleSection = s => setExpanded(p => ({ ...p, [s]: !p[s] }));
  const handlePolicyClick = link => window.open(encodeURI(link), '_blank', 'noopener,noreferrer');

  const cs = {
    card: { background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:8, marginBottom:12, position:'relative', overflow:'hidden', boxShadow:'var(--shadow-card)' },
  };

  return (
    <div style={{ padding:'0 0 24px' }}>
      {/* Header */}
      <div style={{ marginBottom:16 }}>
        <h2 style={{ fontFamily:"'Orbitron', monospace", fontWeight:800, fontSize:'1.2rem', color:'var(--text-primary)', margin:0 }}>
          COMPANY <span className="neon-text">POLICIES</span>
        </h2>
        <div className="cyber-divider" style={{ marginTop:10 }} />
      </div>

      {/* Hero banner */}
      <div style={{
        background:'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(0,102,255,0.05), rgba(123,47,255,0.08))',
        border:'1px solid var(--border)', borderRadius:8, boxShadow:'var(--shadow-card)',
        padding:'20px 24px', marginBottom:20,
        display:'flex', alignItems:'center', gap:16,
        position:'relative', overflow:'hidden',
      }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:'linear-gradient(90deg,transparent,#00d4ff,#7b2fff,transparent)', opacity:.5 }} />
        <div style={{ width:52, height:52, borderRadius:8, background:'rgba(0,212,255,0.1)', border:'1px solid rgba(0,212,255,0.3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <FileText size={24} style={{ color:'#00d4ff' }} />
        </div>
        <div>
          <div style={{ fontFamily:"'Orbitron', monospace", fontWeight:700, fontSize:'.85rem', color:'var(--text-primary)', marginBottom:4 }}>CORPORATE POLICY CENTER</div>
          <div style={{ fontFamily:"'Exo 2', sans-serif", fontSize:'.75rem', color:'var(--text-muted)' }}>Your comprehensive guide to company policies and procedures</div>
        </div>
        <div style={{ marginLeft:'auto', fontFamily:"'Share Tech Mono', monospace", fontSize:'.6rem', color:'rgba(0,212,255,0.4)', letterSpacing:'.1em', textAlign:'right', flexShrink:0 }}>
          {Object.values(POLICY_DATA).reduce((a,b)=>a+b.length,0)} DOCUMENTS
        </div>
      </div>

      {/* Policy sections */}
      {Object.entries(POLICY_DATA).map(([section, policies]) => {
        const color = SECTION_COLORS[section] || '#00d4ff';
        const isExpanded = expanded[section];
        return (
          <div key={section} style={{ ...cs.card, border:`1px solid ${isExpanded ? color+'66' : 'var(--border)'}`, transition:'border-color .3s' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:`linear-gradient(90deg,transparent,${color},transparent)`, opacity:.4 }} />
            {/* Section header */}
            <div
              onClick={() => toggleSection(section)}
              style={{ padding:'14px 18px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', userSelect:'none' }}
            >
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                {isExpanded
                  ? <ChevronDown size={16} style={{ color }} />
                  : <ChevronRight size={16} style={{ color:'var(--text-muted)' }} />
                }
                <div style={{ width:3, height:20, background:color, borderRadius:2, boxShadow:`0 0 6px ${color}` }} />
                <span style={{ fontFamily:"'Orbitron', monospace", fontWeight:700, fontSize:'.75rem', color: isExpanded ? color : 'var(--text-secondary)', letterSpacing:'.1em', transition:'color .2s' }}>
                  {section}
                </span>
              </div>
              <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:'.6rem', padding:'2px 8px', borderRadius:3, background:`${color}15`, border:`1px solid ${color}30`, color }}>
                {policies.length} DOCS
              </div>
            </div>

            {/* Expanded policy list */}
            {isExpanded && (
              <div style={{ borderTop:`1px solid ${color}20`, padding:'8px 16px 12px' }}>
                {policies.map((p, i) => (
                  <div key={i} style={{
                    display:'flex', alignItems:'center', gap:12,
                    padding:'10px 12px', borderRadius:6, marginBottom:6,
                    background:'var(--bg-elevated)', border:'1px solid var(--border)',
                    cursor:'pointer', transition:'all .2s',
                  }}
                    onMouseEnter={e=>{ e.currentTarget.style.borderColor=color+'50'; e.currentTarget.style.background='var(--bg-hover)'; }}
                    onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--bg-elevated)'; }}
                    onClick={() => handlePolicyClick(p.link)}
                  >
                    <div style={{ width:32, height:32, borderRadius:5, background:`${color}10`, border:`1px solid ${color}25`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <FileText size={14} style={{ color:`${color}80` }} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:"'Exo 2', sans-serif", fontSize:'.75rem', fontWeight:600, color:'var(--text-primary)', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {p.title}
                      </div>
                      <div style={{ fontFamily:"'Exo 2', sans-serif", fontSize:'.65rem', color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {p.description}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:4, fontFamily:"'Share Tech Mono', monospace", fontSize:'.55rem', color:color, flexShrink:0, letterSpacing:'.05em' }}>
                      VIEW PDF <ExternalLink size={10} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Policies;
