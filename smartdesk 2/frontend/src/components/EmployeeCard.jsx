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
          <div style={{ width:56, height:56, borderRadius:'50%', background:'linear-gradient(135deg,color-mix(in srgb, var(--accent) 20%, transparent),color-mix(in srgb, var(--accent-light) 15%, transparent))', border:'2px solid color-mix(in srgb, var(--accent) 40%, transparent)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
            {hasImage ? <img src={employee.profileImage} alt={employee.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>e.target.style.display='none'} /> : null}
            {!hasImage && <span style={{ fontFamily:"'Plus Jakarta Sans', sans-serif", fontSize:'.85rem', fontWeight:700, color:'var(--accent)' }}>{initials}</span>}
          </div>
          <div>
            <div style={{ fontFamily:"'Plus Jakarta Sans', sans-serif", fontWeight:700, fontSize:'.9rem', color:'var(--text-primary)' }}>{employee.name}</div>
            <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:'.6rem', color:'var(--text-muted)', letterSpacing:'.1em', marginTop:3 }}>{employee.id || employee.employeeId}</div>
          </div>
        </div>
        {[['Designation', employee.designation||employee.grade],['Department', employee.department],['Location', employee.location],['Email', employee.email],['Phone', employee.phone||employee.contact]].map(([k,v])=>v?(
          <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid color-mix(in srgb, var(--accent) 7%, transparent)' }}>
            <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:'.58rem', color:'var(--text-muted)', letterSpacing:'.1em' }}>{k.toUpperCase()}</span>
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:'.72rem', color:'var(--text-primary)', textAlign:'right', maxWidth:'60%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</span>
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
        background:'var(--bg-card)', backdropFilter:'blur(12px)',
        border:`1px solid ${hovered?'color-mix(in srgb, var(--accent) 50%, transparent)':'color-mix(in srgb, var(--accent) 18%, transparent)'}`,
        borderRadius:8, padding:'16px 14px', cursor:'pointer',
        transition:'all .25s',
        boxShadow: hovered?'0 0 20px color-mix(in srgb, var(--accent) 12%, transparent)':'none',
        position:'relative', overflow:'hidden',
        display:'flex', flexDirection:'column', alignItems:'center', gap:10,
      }}
    >
      <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:'linear-gradient(90deg,transparent,color-mix(in srgb, var(--accent) 50%, transparent),transparent)', opacity:hovered?.8:.3 }} />

      {/* Avatar */}
      <div style={{ position:'relative' }}>
        <div style={{ width:52, height:52, borderRadius:'50%', background:'linear-gradient(135deg,color-mix(in srgb, var(--accent) 20%, transparent),color-mix(in srgb, var(--accent-light) 15%, transparent))', border:`2px solid ${hovered?'color-mix(in srgb, var(--accent) 60%, transparent)':'color-mix(in srgb, var(--accent) 25%, transparent)'}`, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', boxShadow:hovered?'0 0 12px color-mix(in srgb, var(--accent) 30%, transparent)':'none', transition:'all .25s' }}>
          {hasImage ? <img src={employee.profileImage} alt={employee.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>e.target.style.display='none'} /> : null}
          {!hasImage && <span style={{ fontFamily:"'Plus Jakarta Sans', sans-serif", fontSize:'.8rem', fontWeight:700, color:'var(--accent)' }}>{initials}</span>}
        </div>

        {isAdmin && (
          <Dialog>
            <DialogTrigger asChild>
              <button
                onClick={e=>e.stopPropagation()}
                style={{ position:'absolute', bottom:-2, right:-2, width:20, height:20, borderRadius:'50%', background:'var(--accent)', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', opacity:hovered?1:0, transition:'opacity .2s' }}
              >
                <Camera size={10} style={{ color:'#fff' }} />
              </button>
            </DialogTrigger>
            <DialogContent style={{ background:'var(--bg-card)', border:'1px solid color-mix(in srgb, var(--accent) 30%, transparent)', borderRadius:10 }}>
              <DialogHeader>
                <DialogTitle style={{ fontFamily:"'Plus Jakarta Sans', sans-serif", color:'var(--accent)', fontSize:'.75rem', letterSpacing:'.15em' }}>UPDATE PROFILE IMAGE</DialogTitle>
              </DialogHeader>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} style={{ background:'var(--bg-elevated)', border:'1px solid color-mix(in srgb, var(--accent) 25%, transparent)', borderRadius:5, padding:'8px', color:'var(--text-primary)', fontFamily:"'Exo 2',sans-serif", fontSize:'.75rem', outline:'none' }} />
                <p style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:'.55rem', color:'var(--text-muted)', letterSpacing:'.1em' }}>SUPPORTS JPG, PNG, GIF // MAX 5MB</p>
                {imagePreview && <div style={{ width:60, height:60, borderRadius:'50%', overflow:'hidden', margin:'0 auto', border:'1px solid color-mix(in srgb, var(--accent) 40%, transparent)' }}><img src={imagePreview} alt="Preview" style={{ width:'100%', height:'100%', objectFit:'cover' }} /></div>}
                <button onClick={handleImageSubmit} disabled={!imageFile} style={{ background:imageFile?'color-mix(in srgb, var(--accent) 15%, transparent)':'color-mix(in srgb, var(--accent) 5%, transparent)', border:`1px solid ${imageFile?'color-mix(in srgb, var(--accent) 50%, transparent)':'color-mix(in srgb, var(--accent) 20%, transparent)'}`, color:imageFile?'var(--accent)':'color-mix(in srgb, var(--accent) 30%, transparent)', fontFamily:"'Plus Jakarta Sans', sans-serif", fontSize:'.6rem', letterSpacing:'.1em', padding:'8px', borderRadius:5, cursor:imageFile?'pointer':'default', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  <Upload size={12} /> UPDATE IMAGE
                </button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Info */}
      <div style={{ textAlign:'center', width:'100%' }}>
        <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:'.55rem', color:'var(--text-muted)', letterSpacing:'.1em', marginBottom:4 }}>
          {employee.id || employee.employeeId}
        </div>
        <div style={{ fontFamily:"'Plus Jakarta Sans', sans-serif", fontWeight:700, fontSize:'.72rem', color:'var(--text-primary)', marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', width:'100%' }}>
          {employee.name}
        </div>
        <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:'.68rem', color:'var(--accent)', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {employee.designation || employee.grade}
        </div>
        <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:'.65rem', color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {employee.department}
        </div>
      </div>

      {hovered && (
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:4, fontFamily:"'Share Tech Mono', monospace", fontSize:'.55rem', color:'var(--text-muted)', letterSpacing:'.08em' }}>
            <Eye size={10} /> VIEW RECORD
          </div>
          {onViewAttendance && (
            <button
              onClick={e => { e.stopPropagation(); onViewAttendance(String(employee.id || employee.employeeId || employee.empCode || '')); }}
              style={{ display:'flex', alignItems:'center', gap:4, background:'color-mix(in srgb, var(--success) 12%, transparent)', border:'1px solid color-mix(in srgb, var(--success) 35%, transparent)', borderRadius:5, padding:'3px 8px', color:'var(--success)', fontFamily:"'Share Tech Mono', monospace", fontSize:'.52rem', letterSpacing:'.06em', cursor:'pointer' }}
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
