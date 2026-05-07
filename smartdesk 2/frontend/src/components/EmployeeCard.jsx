import React, { useState, useRef } from "react";
import { User, Camera, Upload, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

const EmployeeCard = ({ employee, onImageUpdate, onClick, isDetailView, onViewAttendance }) => {
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [hovered, setHovered] = useState(false);
  const fileInputRef = useRef(null);
  const { isAdmin } = useAuth();

  const handleFileChange = e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 5*1024*1024) { toast.error('Image must be under 5MB'); return; }
    setImageFile(file);
    const r = new FileReader();
    r.onloadend = () => setImagePreview(r.result);
    r.readAsDataURL(file);
  };

  const handleImageSubmit = async () => {
    if (!imageFile || !employee) return;
    try {
      await onImageUpdate(employee.id, imageFile);
      toast.success("Profile image updated!");
      setImageFile(null); setImagePreview(""); if(fileInputRef.current) fileInputRef.current.value='';
    } catch(e) { toast.error("Failed to update image."); }
  };

  if (!employee) return null;

  const hasImage = employee.profileImage && employee.profileImage !== "/api/placeholder/150/150";
  const initials = employee.name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2) || '??';

  if (isDetailView) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:6 }}>
          <div style={{ width:56, height:56, borderRadius:'50%', background:'linear-gradient(135deg,rgba(0,212,255,0.2),rgba(0,102,255,0.15))', border:'2px solid rgba(0,212,255,0.4)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
            {hasImage ? <img src={employee.profileImage} alt={employee.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>e.target.style.display='none'} /> : null}
            {!hasImage && <span style={{ fontFamily:"'Orbitron', monospace", fontSize:'.85rem', fontWeight:700, color:'#00d4ff' }}>{initials}</span>}
          </div>
          <div>
            <div style={{ fontFamily:"'Orbitron', monospace", fontWeight:700, fontSize:'.9rem', color:'#e0f4ff' }}>{employee.name}</div>
            <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:'.6rem', color:'rgba(0,212,255,0.6)', letterSpacing:'.1em', marginTop:3 }}>{employee.id || employee.employeeId}</div>
          </div>
        </div>
        {[['Designation', employee.designation||employee.grade],['Department', employee.department],['Location', employee.location],['Email', employee.email],['Phone', employee.phone||employee.contact]].map(([k,v])=>v?(
          <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid rgba(0,212,255,0.07)' }}>
            <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:'.58rem', color:'rgba(0,212,255,0.5)', letterSpacing:'.1em' }}>{k.toUpperCase()}</span>
            <span style={{ fontFamily:"'Exo 2', sans-serif", fontSize:'.72rem', color:'#e0f4ff', textAlign:'right', maxWidth:'60%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</span>
          </div>
        ):null)}
      </div>
    );
  }

  return (
    <div
      onMouseEnter={()=>setHovered(true)}
      onMouseLeave={()=>setHovered(false)}
      onClick={onClick}
      style={{
        background:'rgba(6,20,45,0.85)', backdropFilter:'blur(12px)',
        border:`1px solid ${hovered?'rgba(0,212,255,0.5)':'rgba(0,212,255,0.18)'}`,
        borderRadius:8, padding:'16px 14px', cursor:'pointer',
        transition:'all .25s',
        boxShadow: hovered?'0 0 20px rgba(0,212,255,0.12)':'none',
        position:'relative', overflow:'hidden',
        display:'flex', flexDirection:'column', alignItems:'center', gap:10,
      }}
    >
      <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:'linear-gradient(90deg,transparent,rgba(0,212,255,0.5),transparent)', opacity:hovered?.8:.3 }} />

      {/* Avatar */}
      <div style={{ position:'relative' }}>
        <div style={{ width:52, height:52, borderRadius:'50%', background:'linear-gradient(135deg,rgba(0,212,255,0.2),rgba(0,102,255,0.15))', border:`2px solid ${hovered?'rgba(0,212,255,0.6)':'rgba(0,212,255,0.25)'}`, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', boxShadow:hovered?'0 0 12px rgba(0,212,255,0.3)':'none', transition:'all .25s' }}>
          {hasImage ? <img src={employee.profileImage} alt={employee.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>e.target.style.display='none'} /> : null}
          {!hasImage && <span style={{ fontFamily:"'Orbitron', monospace", fontSize:'.8rem', fontWeight:700, color:'#00d4ff' }}>{initials}</span>}
        </div>

        {isAdmin && (
          <Dialog>
            <DialogTrigger asChild>
              <button
                onClick={e=>e.stopPropagation()}
                style={{ position:'absolute', bottom:-2, right:-2, width:20, height:20, borderRadius:'50%', background:'rgba(0,212,255,0.9)', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', opacity:hovered?1:0, transition:'opacity .2s' }}
              >
                <Camera size={10} style={{ color:'#020816' }} />
              </button>
            </DialogTrigger>
            <DialogContent style={{ background:'rgba(6,20,45,0.98)', border:'1px solid rgba(0,212,255,0.3)', borderRadius:10 }}>
              <DialogHeader>
                <DialogTitle style={{ fontFamily:"'Orbitron', monospace", color:'#00d4ff', fontSize:'.75rem', letterSpacing:'.15em' }}>UPDATE PROFILE IMAGE</DialogTitle>
              </DialogHeader>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} style={{ background:'rgba(0,20,40,0.8)', border:'1px solid rgba(0,212,255,0.25)', borderRadius:5, padding:'8px', color:'#e0f4ff', fontFamily:"'Exo 2',sans-serif", fontSize:'.75rem', outline:'none' }} />
                <p style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:'.55rem', color:'rgba(0,212,255,0.4)', letterSpacing:'.1em' }}>SUPPORTS JPG, PNG, GIF // MAX 5MB</p>
                {imagePreview && <div style={{ width:60, height:60, borderRadius:'50%', overflow:'hidden', margin:'0 auto', border:'1px solid rgba(0,212,255,0.4)' }}><img src={imagePreview} alt="Preview" style={{ width:'100%', height:'100%', objectFit:'cover' }} /></div>}
                <button onClick={handleImageSubmit} disabled={!imageFile} style={{ background:imageFile?'rgba(0,212,255,0.15)':'rgba(0,212,255,0.05)', border:`1px solid ${imageFile?'rgba(0,212,255,0.5)':'rgba(0,212,255,0.2)'}`, color:imageFile?'#00d4ff':'rgba(0,212,255,0.3)', fontFamily:"'Orbitron', monospace", fontSize:'.6rem', letterSpacing:'.1em', padding:'8px', borderRadius:5, cursor:imageFile?'pointer':'default', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  <Upload size={12} /> UPDATE IMAGE
                </button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Info */}
      <div style={{ textAlign:'center', width:'100%' }}>
        <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:'.55rem', color:'rgba(0,212,255,0.5)', letterSpacing:'.1em', marginBottom:4 }}>
          {employee.id || employee.employeeId}
        </div>
        <div style={{ fontFamily:"'Orbitron', monospace", fontWeight:700, fontSize:'.72rem', color:'#e0f4ff', marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', width:'100%' }}>
          {employee.name}
        </div>
        <div style={{ fontFamily:"'Exo 2', sans-serif", fontSize:'.68rem', color:'rgba(0,212,255,0.7)', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {employee.designation || employee.grade}
        </div>
        <div style={{ fontFamily:"'Exo 2', sans-serif", fontSize:'.65rem', color:'rgba(122,184,212,0.55)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {employee.department}
        </div>
      </div>

      {hovered && (
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:4, fontFamily:"'Share Tech Mono', monospace", fontSize:'.55rem', color:'rgba(0,212,255,0.6)', letterSpacing:'.08em' }}>
            <Eye size={10} /> VIEW RECORD
          </div>
          {onViewAttendance && (
            <button
              onClick={e => { e.stopPropagation(); onViewAttendance(String(employee.id || employee.employeeId || employee.empCode || '')); }}
              style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(74,222,128,0.12)', border:'1px solid rgba(74,222,128,0.35)', borderRadius:5, padding:'3px 8px', color:'#4ade80', fontFamily:"'Share Tech Mono', monospace", fontSize:'.52rem', letterSpacing:'.06em', cursor:'pointer' }}
            >
              📋 ATTENDANCE
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmployeeCard;
