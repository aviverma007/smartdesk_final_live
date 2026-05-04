import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const LoginForm = () => {
  const { login, isAuthenticated } = useAuth();
  const [loadingText, setLoadingText] = useState('INITIALIZING SYSTEM');
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef(null);

  useEffect(() => {
    // Progress bar
    const prog = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(prog); return 100; }
        return p + 2;
      });
    }, 55);

    const texts = [
      [600, 'LOADING RESOURCES'],
      [1200, 'AUTHENTICATING'],
      [1800, 'ESTABLISHING CONNECTION'],
      [2400, 'SYSTEM READY'],
    ];
    const timers = texts.map(([d, t]) => setTimeout(() => setLoadingText(t), d));
    const loginTimer = setTimeout(() => {
      if (!isAuthenticated) {
        login({ name: 'User', role: 'user', employeeId: '', loginTime: new Date().toISOString() });
        toast.success('Welcome to SmartDesk 2.0', { description: 'Futuristic enterprise intelligence activated', duration: 3000 });
      }
    }, 3000);

    return () => { timers.forEach(clearTimeout); clearTimeout(loginTimer); clearInterval(prog); };
  }, [login, isAuthenticated]);

  // Canvas star background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    const stars = Array.from({length: 150}, () => ({
      x: Math.random()*W, y: Math.random()*H,
      r: Math.random()*.8+.1, s: Math.random()*.4+.05, t: Math.random()*Math.PI*2,
    }));
    let raf;
    function draw() {
      ctx.fillStyle = '#020816';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(0,212,255,0.04)';
      ctx.lineWidth = .5;
      for(let x=0;x<W;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
      for(let y=0;y<H;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
      stars.forEach(s => {
        s.t += s.s * .015;
        const a = .3 + .7*(Math.sin(s.t)+1)/2;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(0,212,255,${a})`; ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

      {/* Center content */}
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        {/* Logo glow */}
        <div style={{ position: 'relative', animation: 'loginFloat 4s ease-in-out infinite' }}>
          <div style={{
            position: 'absolute', inset: -20,
            background: 'radial-gradient(circle, rgba(0,212,255,0.2) 0%, transparent 70%)',
            borderRadius: '50%', animation: 'loginPulse 3s ease-in-out infinite',
          }} />
          <div style={{
            width: 80, height: 80, borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,102,255,0.2))',
            border: '1px solid rgba(0,212,255,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 30px rgba(0,212,255,0.3)',
            position: 'relative',
          }}>
            <img src="/images/header-logo.png" alt="SmartDesk" style={{ width: 52, height: 52, objectFit: 'contain' }}
              onError={e => { e.target.style.display='none'; }} />
            <span style={{
              position: 'absolute', fontFamily: 'Orbitron, monospace', fontWeight: 900,
              fontSize: 22, color: '#00d4ff', textShadow: '0 0 15px rgba(0,212,255,0.8)',
            }}>SD</span>
          </div>
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: 'Orbitron, monospace', fontWeight: 900, fontSize: '2.2rem',
            letterSpacing: '.2em', color: '#00d4ff',
            textShadow: '0 0 30px rgba(0,212,255,0.7), 0 0 60px rgba(0,212,255,0.3)',
            animation: 'loginGlow 3s ease-in-out infinite',
          }}>
            SMARTDESK
          </div>
          <div style={{
            fontFamily: 'Share Tech Mono, monospace', fontSize: '.65rem',
            letterSpacing: '.3em', color: 'rgba(0,212,255,0.4)',
            textTransform: 'uppercase', marginTop: 8,
          }}>
            ENTERPRISE INTELLIGENCE SYSTEM v2.0
          </div>
        </div>

        {/* Loading card */}
        <div style={{
          width: 280,
          background: 'rgba(6,20,45,0.9)',
          border: '1px solid rgba(0,212,255,0.3)',
          borderRadius: 10, padding: '20px 24px',
          boxShadow: '0 0 40px rgba(0,212,255,0.1)',
          position: 'relative', overflow: 'hidden',
          animation: 'fadeInCard .5s ease',
        }}>
          {/* Scan line */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 1,
            background: 'linear-gradient(90deg, transparent, #00d4ff, transparent)',
            opacity: .7,
          }} />
          <div style={{
            position: 'absolute', left: 0, right: 0, height: 2,
            background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.5), transparent)',
            animation: 'scanDown 2s linear infinite',
          }} />

          <div style={{
            fontFamily: 'Share Tech Mono, monospace', fontSize: '.6rem',
            letterSpacing: '.1em', color: 'rgba(0,212,255,0.5)',
            textTransform: 'uppercase', textAlign: 'center', marginBottom: 14,
          }}>
            {loadingText}
          </div>

          {/* Progress bar */}
          <div style={{ background: 'rgba(0,212,255,0.08)', borderRadius: 3, height: 4, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{
              height: '100%', borderRadius: 3,
              background: 'linear-gradient(90deg, #0066ff, #00d4ff)',
              width: `${progress}%`,
              transition: 'width .1s linear',
              boxShadow: '0 0 8px rgba(0,212,255,0.5)',
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {[0, 150, 300].map(d => (
                <div key={d} style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: '#00d4ff', boxShadow: '0 0 6px #00d4ff',
                  animation: `loginBounce 1.2s ease-in-out ${d}ms infinite`,
                }} />
              ))}
            </div>
            <span style={{
              fontFamily: 'Share Tech Mono, monospace', fontSize: '.6rem',
              color: '#00d4ff', letterSpacing: '.05em',
            }}>
              {progress}%
            </span>
          </div>

          <div style={{
            marginTop: 12,
            fontFamily: 'Share Tech Mono, monospace', fontSize: '.5rem',
            color: 'rgba(0,212,255,0.25)', textAlign: 'center', letterSpacing: '.1em',
          }}>
            SECURED BY AES-256 // ZERO-TRUST PROTOCOL
          </div>
        </div>
      </div>

      <style>{`
        @keyframes loginFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes loginPulse { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.15)} }
        @keyframes loginGlow { 0%,100%{text-shadow:0 0 30px rgba(0,212,255,.7),0 0 60px rgba(0,212,255,.3)} 50%{text-shadow:0 0 40px rgba(0,212,255,1),0 0 80px rgba(0,212,255,.5)} }
        @keyframes scanDown { 0%{top:0} 100%{top:100%} }
        @keyframes loginBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes fadeInCard { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
};

export default LoginForm;
