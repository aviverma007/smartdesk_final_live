import React from "react";
import { User, Eye } from "lucide-react";

const EmployeeList = ({ employees, onEmployeeClick }) => {
  if (!employees.length) return (
    <div style={{ textAlign:'center', padding:'40px 0' }}>
      <div style={{ fontFamily:"'Orbitron', monospace", fontSize:'.7rem', color:'rgba(0,212,255,0.4)', letterSpacing:'.15em' }}>NO RECORDS</div>
    </div>
  );

  const COLS = [
    { key:'id', label:'EMP ID', w:100 },
    { key:'name', label:'NAME', w:180 },
    { key:'designation', label:'DESIGNATION', w:160, alt:'grade' },
    { key:'department', label:'DEPARTMENT', w:160 },
    { key:'location', label:'LOCATION', w:120 },
    { key:'email', label:'EMAIL', w:200 },
  ];

  return (
    <div style={{ background:'rgba(6,20,45,0.85)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:8, overflow:'hidden', backdropFilter:'blur(12px)' }}>
      {/* Header */}
      <div style={{ display:'grid', gridTemplateColumns:COLS.map(c=>`${c.w}px`).join(' ')+' 60px', borderBottom:'1px solid rgba(0,212,255,0.15)', padding:'0 8px' }}>
        {COLS.map(c=>(
          <div key={c.key} style={{ padding:'9px 10px', fontFamily:"'Orbitron', monospace", fontSize:'.55rem', letterSpacing:'.15em', color:'rgba(0,212,255,0.5)', textTransform:'uppercase' }}>{c.label}</div>
        ))}
        <div />
      </div>
      {/* Rows */}
      <div style={{ maxHeight:500, overflowY:'auto' }}>
        {employees.map((emp, i)=>(
          <div key={emp.id||i}
            onClick={()=>onEmployeeClick(emp)}
            style={{ display:'grid', gridTemplateColumns:COLS.map(c=>`${c.w}px`).join(' ')+' 60px', borderBottom:'1px solid rgba(0,212,255,0.06)', padding:'0 8px', cursor:'pointer', transition:'background .2s', alignItems:'center' }}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(0,212,255,0.05)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}
          >
            {COLS.map(c=>{
              const v = emp[c.key] || (c.alt?emp[c.alt]:'')||'—';
              return (
                <div key={c.key} style={{ padding:'9px 10px', fontFamily:"'Exo 2', sans-serif", fontSize:'.72rem', color:c.key==='id'?'rgba(0,212,255,0.7)':c.key==='name'?'#e0f4ff':'rgba(122,184,212,0.75)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</div>
              );
            })}
            <div style={{ padding:'9px 10px', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Eye size={13} style={{ color:'rgba(0,212,255,0.4)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmployeeList;
