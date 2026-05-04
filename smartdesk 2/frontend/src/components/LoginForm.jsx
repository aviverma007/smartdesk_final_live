import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const LoginForm = () => {
  const { login, isAuthenticated } = useAuth();
  const [step, setStep] = useState(0); // 0=loading, 1=form, 2=autologin
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef(null);

  const STEPS = ['Initializing modules', 'Loading resources', 'Establishing connection', 'Ready'];

  useEffect(() => {
    // Animate progress to 100 over 2.8s
    const start = Date.now();
    const dur = 2800;
    const raf = setInterval(() => {
      const p = Math.min(100, Math.round(((Date.now()-start)/dur)*100));
      setProgress(p);
      setStep(Math.min(3, Math.floor(p/25)));
      if (p >= 100) clearInterval(raf);
    }, 30);

    const loginTimer = setTimeout(() => {
      if (!isAuthenticated) {
        login({ name: 'User', role: 'user', employeeId: '', loginTime: new Date().toISOString() });
        toast.success('Welcome to SmartDesk', { description: 'Enterprise portal ready', duration: 3000 });
      }
    }, 3000);

    return () => { clearInterval(raf); clearTimeout(loginTimer); };
  }, [login, isAuthenticated]);

  // Particle canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({length:80}, () => ({
      x: Math.random()*canvas.width, y: Math.random()*canvas.height,
      vx: (Math.random()-.5)*.4, vy: (Math.random()-.5)*.4,
      r: Math.random()*1.5+.3,
      c: Math.random()>.6 ? 'rgba(124,58,237,' : Math.random()>.5 ? 'rgba(244,114,182,' : 'rgba(96,165,250,',
    }));

    let raf;
    function draw() {
      ctx.fillStyle='rgba(13,11,26,0.18)';
      ctx.fillRect(0,0,canvas.width,canvas.height);

      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if(p.x<0||p.x>canvas.width) p.vx*=-1;
        if(p.y<0||p.y>canvas.height) p.vy*=-1;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle=p.c+'0.7)'; ctx.fill();
      });

      // Connect nearby particles
      for(let i=0;i<particles.length;i++) {
        for(let j=i+1;j<particles.length;j++) {
          const dx=particles[i].x-particles[j].x, dy=particles[i].y-particles[j].y;
          const d=Math.hypot(dx,dy);
          if(d<100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x,particles[i].y);
            ctx.lineTo(particles[j].x,particles[j].y);
            ctx.strokeStyle=`rgba(124,58,237,${(1-d/100)*.12})`;
            ctx.lineWidth=.5; ctx.stroke();
          }
        }
      }
      raf=requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{ position:'relative', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', background:'#0d0b1a' }}>
      {/* Ambient orbs */}
      <div style={{ position:'absolute', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle,rgba(124,58,237,0.25),transparent)', top:-120, left:-100, filter:'blur(60px)', pointerEvents:'none' }}/>
      <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle,rgba(244,114,182,0.2),transparent)', bottom:-80, right:-60, filter:'blur(60px)', pointerEvents:'none' }}/>

      <canvas ref={canvasRef} style={{ position:'absolute', inset:0, zIndex:0 }}/>

      {/* Card */}
      <div style={{
        position:'relative', zIndex:10,
        width:340, padding:'36px 32px',
        background:'rgba(22,18,46,0.85)',
        border:'1px solid rgba(139,92,246,0.3)',
        borderRadius:20,
        backdropFilter:'blur(24px)',
        WebkitBackdropFilter:'blur(24px)',
        boxShadow:'0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.1)',
        animation:'loginIn 0.5s cubic-bezier(.22,.68,0,1.2)',
      }}>
        {/* Top gradient line */}
        <div style={{ position:'absolute', top:0, left:'20%', right:'20%', height:2, background:'linear-gradient(90deg,transparent,#7c3aed,#f472b6,transparent)', borderRadius:1 }}/>

        {/* Logo */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:28 }}>
          <div style={{
            width:60, height:60, borderRadius:16,
            background:'linear-gradient(135deg,#7c3aed,#f472b6)',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 8px 28px rgba(124,58,237,0.55)',
            marginBottom:14,
            animation:'logoFloat 4s ease-in-out infinite',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <div style={{ fontFamily:'Plus Jakarta Sans,sans-serif', fontWeight:800, fontSize:'1.5rem', color:'#f1eeff', letterSpacing:'-0.01em' }}>SmartDesk</div>
          <div style={{ fontFamily:'DM Sans,sans-serif', fontSize:'0.78rem', color:'rgba(177,168,216,0.6)', marginTop:4 }}>Enterprise Intelligence Portal</div>
        </div>

        {/* Loading section */}
        <div>
          {/* Status text */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <span style={{ fontFamily:'DM Sans,sans-serif', fontSize:'0.78rem', color:'rgba(177,168,216,0.7)' }}>
              {STEPS[step]}...
            </span>
            <span style={{ fontFamily:'Plus Jakarta Sans,sans-serif', fontWeight:700, fontSize:'0.78rem', color:'#9b6dff' }}>
              {progress}%
            </span>
          </div>

          {/* Progress track */}
          <div style={{ height:6, borderRadius:6, background:'rgba(255,255,255,0.07)', overflow:'hidden', marginBottom:18 }}>
            <div style={{
              height:'100%', borderRadius:6,
              background:'linear-gradient(90deg,#7c3aed,#f472b6)',
              width:`${progress}%`,
              transition:'width 0.06s linear',
              boxShadow:'0 0 12px rgba(124,58,237,0.6)',
            }}/>
          </div>

          {/* Step dots */}
          <div style={{ display:'flex', justifyContent:'center', gap:8 }}>
            {STEPS.map((_,i) => (
              <div key={i} style={{
                width: i===step ? 20 : 7, height:7, borderRadius:4,
                background: i<=step
                  ? 'linear-gradient(90deg,#7c3aed,#f472b6)'
                  : 'rgba(255,255,255,0.1)',
                transition:'width 0.4s, background 0.4s',
                boxShadow: i===step ? '0 0 8px rgba(124,58,237,0.7)' : 'none',
              }}/>
            ))}
          </div>
        </div>

        {/* Bottom note */}
        <div style={{ marginTop:22, textAlign:'center', fontFamily:'DM Sans,sans-serif', fontSize:'0.65rem', color:'rgba(107,100,145,0.6)', letterSpacing:'0.03em' }}>
          Auto-login enabled · Secured connection
        </div>
      </div>

      <style>{`
        @keyframes loginIn { from{opacity:0;transform:translateY(20px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes logoFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
      `}</style>
    </div>
  );
};

export default LoginForm;
