import React from "react";
import { User, Eye } from "lucide-react";

const EmployeeList = ({ employees, onEmployeeClick }) => {
  if (!employees.length) return (
    <div style={{ textAlign:'center', padding:'40px 0' }}>
      <div style={{ fontFamily:"'Plus Jakarta Sans', sans-serif", fontSize:'.7rem', color:'var(--text-muted)', letterSpacing:'.15em' }}>NO RECORDS</div>
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
    <div style={{ background:'var(--bg-card)', border:'1px solid color-mix(in srgb, var(--accent) 20%, transparent)', borderRadius:8, overflow:'hidden', backdropFilter:'blur(12px)' }}>
      {/* Header */}
      <div style={{ display:'grid', gridTemplateColumns:COLS.map(c=>`${c.w}px`).join(' ')+' 60px', borderBottom:'1px solid color-mix(in srgb, var(--accent) 15%, transparent)', padding:'0 8px' }}>
        {COLS.map(c=>(
          <div key={c.key} style={{ padding:'9px 10px', fontFamily:"'Plus Jakarta Sans', sans-serif", fontSize:'.55rem', letterSpacing:'.15em', color:'var(--text-muted)', textTransform:'uppercase' }}>{c.label}</div>
        ))}
        <div />
      </div>
      {/* Rows */}
      <div style={{ maxHeight:500, overflowY:'auto' }}>
        {employees.map((emp, i)=>(
          <div key={emp.id||i}
            onClick={()=>onEmployeeClick(emp)}
            style={{ display:'grid', gridTemplateColumns:COLS.map(c=>`${c.w}px`).join(' ')+' 60px', borderBottom:'1px solid color-mix(in srgb, var(--accent) 6%, transparent)', padding:'0 8px', cursor:'pointer', transition:'background .2s', alignItems:'center' }}
            onMouseEnter={e=>e.currentTarget.style.background='color-mix(in srgb, var(--accent) 5%, transparent)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}
          >
            {COLS.map(c=>{
              const v = emp[c.key] || (c.alt?emp[c.alt]:'')||'—';
              return (
                <div key={c.key} style={{ padding:'9px 10px', fontFamily:"'DM Sans', sans-serif", fontSize:'.72rem', color:c.key==='id'?'color-mix(in srgb, var(--accent) 70%, transparent)':c.key==='name'?'var(--text-primary)':'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</div>
              );
            })}
            <div style={{ padding:'9px 10px', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Eye size={13} style={{ color:'var(--text-muted)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmployeeList;
