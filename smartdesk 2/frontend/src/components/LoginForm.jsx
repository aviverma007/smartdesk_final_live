import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

/* Right-hand slideshow. Add/replace slides here (images live in public/images). */
const SLIDES = [
  { src: '/images/login/office-gallery.webp',        tag: 'Smart World',  caption: 'Our sales gallery' },
  { src: '/images/smart-world-sky-arc.webp',         tag: 'Project',      caption: 'Smart World Sky Arc' },
  { src: '/images/login/celebrations.webp',          tag: 'Culture',      caption: 'Celebrating together' },
  { src: '/images/smart-world-the-edition.webp',     tag: 'Project',      caption: 'Smart World The Edition' },
  { src: '/images/login/workplace.webp',             tag: 'Workplace',    caption: 'Where we build every day' },
  { src: '/images/smart-world-one-dxp.webp',         tag: 'Project',      caption: 'Smart World One DXP' },
  { src: '/images/login/together.webp',              tag: 'People',       caption: 'One team, one family' },
  { src: '/images/smart-world-orchard.webp',         tag: 'Project',      caption: 'Smart World Orchard' },
];
const SLIDE_MS = 5500;
const BRAND = 'SMARTDESK';

const Icon = {
  user: <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>,
  lock: <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>,
  eye: <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeOff: <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.3 2 12 2 12s3.6 7 10 7c1.8 0 3.4-.5 4.8-1.3"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>,
  alert: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>,
  arrow: <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
};

const LoginForm = () => {
  const { tryLogin, tryEmployeeLogin, tryAppLogin } = useAuth();
  const [phase, setPhase] = useState('loading'); // 'loading' | 'login'
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(0);
  const [empId, setEmpId] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const canvasRef = useRef(null);
  const STEPS = ['Initializing modules', 'Loading resources', 'Establishing connection', 'Ready'];

  // Loading animation, then the sign-in form
  useEffect(() => {
    const start = Date.now(), dur = 2800;
    const interval = setInterval(() => {
      const p = Math.min(100, Math.round(((Date.now() - start) / dur) * 100));
      setProgress(p);
      setStep(Math.min(3, Math.floor(p / 25)));
      if (p >= 100) { clearInterval(interval); setTimeout(() => setPhase('login'), 400); }
    }, 30);
    return () => clearInterval(interval);
  }, []);

  // Slideshow timer (pauses on hover)
  useEffect(() => {
    if (paused) return undefined;
    const t = setTimeout(() => setSlide(s => (s + 1) % SLIDES.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [slide, paused]);

  // Preload slide images
  useEffect(() => { SLIDES.forEach(s => { const i = new Image(); i.src = s.src; }); }, []);

  // Twinkling star field behind the form panel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, raf;
    const resize = () => {
      const r = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const stars = Array.from({ length: 90 }, () => ({
      x: Math.random(), y: Math.random(), r: Math.random() * 1.3 + 0.3,
      p: Math.random() * Math.PI * 2, s: 0.6 + Math.random() * 1.6, v: 0.00004 + Math.random() * 0.00008,
    }));
    let shoot = null;
    const draw = (t) => {
      ctx.clearRect(0, 0, w, h);
      stars.forEach(st => {
        if (!reduce) st.y -= st.v; if (st.y < 0) st.y = 1;
        const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(st.p + t * 0.001 * st.s));
        ctx.beginPath(); ctx.arc(st.x * w, st.y * h, st.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,225,255,${reduce ? 0.5 : a})`; ctx.fill();
      });
      if (!reduce) {
        if (!shoot && Math.random() < 0.004) shoot = { x: Math.random() * w * 0.8 + w * 0.2, y: Math.random() * h * 0.4, l: 0 };
        if (shoot) {
          shoot.l += 1;
          const x = shoot.x - shoot.l * 7, y = shoot.y + shoot.l * 3.5, a = Math.max(0, 1 - shoot.l / 45);
          const g = ctx.createLinearGradient(x, y, x + 70, y - 35);
          g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 70, y - 35); ctx.stroke();
          if (shoot.l > 45) shoot = null;
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!empId.trim()) { setError('Please enter your Employee ID'); return; }
    if (!password.trim()) { setError('Please enter your password'); return; }
    setSubmitting(true); setError('');
    setTimeout(async () => {
      // 1) Fixed accounts: admin / dashboard / hr / it / manager
      const result = tryLogin(empId.trim(), password.trim());
      if (result.success) {
        toast.success('Welcome to SmartDesk', { description: 'Portal ready', duration: 3000 });
        return;
      }
      // 2) Employee with the formula password — only if the ID is in the directory
      const empResult = await tryEmployeeLogin(empId.trim(), password.trim());
      if (empResult.success) {
        toast.success('Welcome to SmartDesk', { description: 'Portal ready', duration: 3000 });
        return;
      }
      // 3) Employee who set their own password via the welcome-email link
      const appResult = await tryAppLogin(empId.trim(), password.trim());
      if (appResult.success) {
        toast.success('Welcome to SmartDesk', { description: 'Portal ready', duration: 3000 });
      } else {
        setError(empResult.error || appResult.error || 'Invalid credentials');
        setSubmitting(false);
      }
    }, 600);
  };

  const cur = SLIDES[slide];

  return (
    <div className="sdl-page">
      <div className="sdl-glow sdl-glow-a" />
      <div className="sdl-glow sdl-glow-b" />

      <div className="sdl-shell">
        {/* ── LEFT: credentials ── */}
        <section className="sdl-left">
          <canvas ref={canvasRef} className="sdl-stars" />
          <div className="sdl-planet" />
          <div className="sdl-moon" />

          <div className="sdl-form-wrap">
            <div className="sdl-brandrow">
              <div className="sdl-logo"><img src="/images/swd-logo.png" alt="" /></div>
              <div>
                <div className="sdl-brandname">SmartDesk</div>
                <div className="sdl-brandsub">Smart World Developers · Enterprise Portal</div>
              </div>
            </div>

            {phase === 'loading' && (
              <div className="sdl-loading">
                <h1 className="sdl-title">Welcome</h1>
                <div className="sdl-load-row">
                  <span>{STEPS[step]}…</span><b>{progress}%</b>
                </div>
                <div className="sdl-bar"><div style={{ width: `${progress}%` }} /></div>
                <div className="sdl-steps">
                  {STEPS.map((_, i) => <i key={i} className={i === step ? 'on' : i < step ? 'done' : ''} />)}
                </div>
              </div>
            )}

            {phase === 'login' && (
              <form onSubmit={handleLogin} className="sdl-form" noValidate>
                <h1 className="sdl-title">Sign in</h1>
                <p className="sdl-lead">Use your employee code to open your workspace.</p>

                <label className="sdl-field" style={{ '--d': '0.05s' }}>
                  <span className="sdl-ico">{Icon.user}</span>
                  <input type="text" inputMode="text" autoComplete="username" placeholder="Employee ID (e.g. 81096)"
                    value={empId} onChange={e => { setEmpId(e.target.value); setError(''); }} autoFocus aria-label="Employee ID" />
                </label>

                <label className="sdl-field" style={{ '--d': '0.12s' }}>
                  <span className="sdl-ico">{Icon.lock}</span>
                  <input type={showPw ? 'text' : 'password'} autoComplete="current-password" placeholder="Password"
                    value={password} onChange={e => { setPassword(e.target.value); setError(''); }} aria-label="Password" />
                  <button type="button" className="sdl-eye" onClick={() => setShowPw(s => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? Icon.eyeOff : Icon.eye}
                  </button>
                </label>
                <div className="sdl-hint">Password format: Smart@ + your ID reversed — e.g. 81096 → Smart@69018</div>

                {error && <div className="sdl-error" role="alert">{Icon.alert}<span>{error}</span></div>}

                <button type="submit" className="sdl-submit" disabled={submitting}>
                  {submitting ? <><span className="sdl-spin" /> Signing in…</> : <>Sign in {Icon.arrow}</>}
                </button>

                <div className="sdl-divider"><span>Quick help</span></div>
                <div className="sdl-help">
                  Can't sign in? Contact the <b>IT Service Desk</b> — itservicedesk@smartworlddevelopers.com
                </div>
              </form>
            )}
          </div>

          <div className="sdl-foot">© {new Date().getFullYear()} Smart World Developers · Secured connection</div>
        </section>

        {/* ── RIGHT: slideshow + floating brand ── */}
        <section className="sdl-right" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-label="Smart World highlights">
          {SLIDES.map((s, i) => (
            <div key={s.src} className={`sdl-slide ${i === slide ? 'active' : ''}`} aria-hidden={i !== slide}>
              <img src={s.src} alt={s.caption} loading={i < 2 ? 'eager' : 'lazy'} />
            </div>
          ))}
          <div className="sdl-shade" />

          <div className="sdl-float">
            <div className="sdl-float-word" aria-label={BRAND}>
              {BRAND.split('').map((ch, i) => <span key={i} style={{ '--i': i }}>{ch}</span>)}
            </div>
            <div className="sdl-float-sub">Everything you need at work — <em>in one place.</em></div>
          </div>

          <div className="sdl-caption" key={slide}>
            <span className="sdl-tag">{cur.tag}</span>
            <span className="sdl-cap-text">{cur.caption}</span>
          </div>

          <div className="sdl-dots">
            {SLIDES.map((_, i) => (
              <button key={i} type="button" aria-label={`Slide ${i + 1}`} className={i === slide ? 'on' : ''} onClick={() => setSlide(i)}>
                {i === slide && <i key={`${slide}-${paused}`} style={{ animationDuration: `${SLIDE_MS}ms`, animationPlayState: paused ? 'paused' : 'running' }} />}
              </button>
            ))}
          </div>
        </section>
      </div>

      <style>{CSS}</style>
    </div>
  );
};

const CSS = `
.sdl-page{position:relative;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:28px;overflow:hidden;
  background:radial-gradient(1200px 700px at 15% 10%,#13306b 0%,transparent 60%),radial-gradient(900px 600px at 90% 100%,#2a1d6e 0%,transparent 60%),#070d22;
  font-family:'DM Sans',sans-serif;color:#fff}
.sdl-glow{position:absolute;border-radius:50%;filter:blur(90px);pointer-events:none;opacity:.55}
.sdl-glow-a{width:520px;height:520px;background:#1d5fd1;top:-180px;left:-160px;animation:sdlDrift 16s ease-in-out infinite}
.sdl-glow-b{width:460px;height:460px;background:#5b3fd6;bottom:-200px;right:-140px;animation:sdlDrift 19s ease-in-out infinite reverse}
@keyframes sdlDrift{0%,100%{transform:translate(0,0)}50%{transform:translate(40px,30px)}}

.sdl-shell{position:relative;z-index:2;width:100%;max-width:1240px;height:min(740px,calc(100vh - 56px));min-height:600px;display:grid;grid-template-columns:minmax(380px,0.82fr) 1.18fr;
  border-radius:26px;overflow:hidden;background:#0b1636;box-shadow:0 40px 120px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.07);animation:sdlShellIn .8s cubic-bezier(.2,.8,.2,1) both}
@keyframes sdlShellIn{from{opacity:0;transform:translateY(24px) scale(.985)}to{opacity:1;transform:none}}

/* left */
.sdl-left{position:relative;display:flex;flex-direction:column;justify-content:center;padding:48px 52px 30px;overflow:hidden;
  background:linear-gradient(160deg,#0f1f4d 0%,#0b1636 55%,#120f3a 100%)}
.sdl-stars{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.sdl-planet{position:absolute;width:260px;height:260px;border-radius:50%;top:-120px;right:-110px;pointer-events:none;
  background:radial-gradient(circle at 35% 35%,#4f8fe8 0%,#245bb5 45%,#123173 75%);box-shadow:0 0 80px rgba(79,143,232,.35);opacity:.55;animation:sdlBob 9s ease-in-out infinite}
.sdl-moon{position:absolute;width:70px;height:70px;border-radius:50%;bottom:90px;left:-24px;pointer-events:none;
  background:radial-gradient(circle at 35% 35%,#b9a6f5,#6a51c9 70%);opacity:.35;animation:sdlBob 7s ease-in-out infinite reverse}
@keyframes sdlBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}

.sdl-form-wrap{position:relative;z-index:2;width:100%;max-width:380px;margin:0 auto}
.sdl-brandrow{display:flex;align-items:center;gap:12px;margin-bottom:38px;animation:sdlUp .6s .1s both}
.sdl-logo{width:46px;height:46px;border-radius:13px;display:grid;place-items:center;background:linear-gradient(135deg,rgba(255,255,255,.18),rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.18)}
.sdl-logo img{width:30px;height:30px;object-fit:contain;filter:brightness(0) invert(1)}
.sdl-brandname{font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:1.08rem;letter-spacing:-.01em}
.sdl-brandsub{font-size:.72rem;color:rgba(214,226,255,.6);margin-top:1px}

.sdl-title{font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:2.6rem;line-height:1;letter-spacing:-.02em;margin:0 0 10px;text-transform:uppercase;
  background:linear-gradient(180deg,#fff 30%,#b9cdf7);-webkit-background-clip:text;background-clip:text;color:transparent;animation:sdlUp .6s .15s both}
.sdl-lead{margin:0 0 26px;font-size:.88rem;color:rgba(214,226,255,.65);animation:sdlUp .6s .2s both}
@keyframes sdlUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}

.sdl-form{display:flex;flex-direction:column}
.sdl-field{position:relative;display:flex;align-items:center;margin-bottom:14px;border-radius:14px;background:rgba(30,42,98,.94);border:1px solid rgba(160,175,255,.18);
  transition:border-color .2s,background .2s,box-shadow .2s;animation:sdlUp .55s calc(.25s + var(--d)) both}
.sdl-field:focus-within{border-color:rgba(120,170,255,.7);background:rgba(36,50,116,.97);box-shadow:0 0 0 4px rgba(80,140,255,.15)}
.sdl-ico{position:absolute;left:16px;color:rgba(200,214,255,.6);display:flex;transition:color .2s}
.sdl-field:focus-within .sdl-ico{color:#9cc2ff}
.sdl-field input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:#fff;font:inherit;font-size:.93rem;padding:16px 16px 16px 46px}
.sdl-field input::placeholder{color:rgba(200,214,255,.45)}
.sdl-field input:-webkit-autofill{-webkit-text-fill-color:#fff;-webkit-box-shadow:0 0 0 1000px #1a2a5e inset;caret-color:#fff;border-radius:14px}
.sdl-eye{background:none;border:0;color:rgba(200,214,255,.6);cursor:pointer;padding:0 16px;height:100%;display:flex;align-items:center}
.sdl-eye:hover{color:#fff}
.sdl-hint{font-size:.7rem;color:rgba(200,214,255,.45);margin:-4px 2px 16px;animation:sdlUp .55s .4s both}
.sdl-error{display:flex;align-items:flex-start;gap:8px;margin-bottom:14px;padding:10px 13px;border-radius:12px;background:rgba(239,68,68,.14);border:1px solid rgba(248,113,113,.35);color:#fecaca;font-size:.8rem;animation:sdlShake .4s}
.sdl-error svg{flex:none;margin-top:1px}
@keyframes sdlShake{0%,100%{transform:none}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}

.sdl-submit{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;gap:8px;height:52px;border:0;border-radius:14px;cursor:pointer;
  font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:.9rem;letter-spacing:.08em;text-transform:uppercase;color:#fff;
  background:linear-gradient(100deg,#5b3fd6 0%,#2f6fe0 55%,#3aa0e8 100%);background-size:160% 100%;box-shadow:0 12px 30px rgba(47,111,224,.35);
  transition:background-position .4s,transform .15s,box-shadow .2s;animation:sdlUp .55s .45s both}
.sdl-submit:hover:not(:disabled){background-position:100% 0;box-shadow:0 16px 36px rgba(47,111,224,.5);transform:translateY(-1px)}
.sdl-submit:active:not(:disabled){transform:translateY(1px)}
.sdl-submit:disabled{opacity:.75;cursor:wait}
.sdl-submit svg{transition:transform .2s}.sdl-submit:hover svg{transform:translateX(3px)}
.sdl-submit::after{content:'';position:absolute;top:0;left:-60%;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent);transform:skewX(-20deg);animation:sdlSheen 4.5s 1.5s infinite}
@keyframes sdlSheen{0%{left:-60%}30%,100%{left:130%}}
.sdl-spin{width:16px;height:16px;border-radius:50%;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;animation:sdlRot .7s linear infinite}
@keyframes sdlRot{to{transform:rotate(360deg)}}

.sdl-divider{display:flex;align-items:center;gap:12px;margin:26px 0 12px;font-size:.7rem;color:rgba(200,214,255,.45);text-transform:uppercase;letter-spacing:.12em;animation:sdlUp .55s .5s both}
.sdl-divider::before,.sdl-divider::after{content:'';flex:1;height:1px;background:rgba(200,214,255,.15)}
.sdl-help{font-size:.78rem;color:rgba(200,214,255,.6);line-height:1.5;animation:sdlUp .55s .55s both}
.sdl-help b{color:#a9c4ff;font-weight:600}

.sdl-loading{animation:sdlUp .5s both}
.sdl-load-row{display:flex;justify-content:space-between;font-size:.8rem;color:rgba(214,226,255,.75);margin:22px 0 10px}
.sdl-load-row b{font-family:'Plus Jakarta Sans',sans-serif}
.sdl-bar{height:6px;border-radius:6px;background:rgba(255,255,255,.1);overflow:hidden}
.sdl-bar div{height:100%;border-radius:6px;background:linear-gradient(90deg,#5b3fd6,#3aa0e8);box-shadow:0 0 14px rgba(58,160,232,.7);transition:width .06s linear}
.sdl-steps{display:flex;gap:7px;margin-top:16px}
.sdl-steps i{width:7px;height:7px;border-radius:4px;background:rgba(255,255,255,.18);transition:all .4s}
.sdl-steps i.done{background:rgba(160,190,255,.7)}.sdl-steps i.on{width:24px;background:#9cc2ff;box-shadow:0 0 10px rgba(156,194,255,.8)}

.sdl-foot{position:relative;z-index:2;margin-top:auto;padding-top:26px;text-align:center;font-size:.68rem;color:rgba(200,214,255,.35)}
.sdl-left{justify-content:flex-start}.sdl-form-wrap{margin-top:auto}

/* right */
.sdl-right{position:relative;overflow:hidden;background:#0a1430}
.sdl-slide{position:absolute;inset:0;opacity:0;transition:opacity 1.2s ease}
.sdl-slide img{width:100%;height:100%;object-fit:cover;transform:scale(1.12);transition:transform 7s ease-out}
.sdl-slide.active{opacity:1}
.sdl-slide.active img{transform:scale(1)}
.sdl-shade{position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(90deg,rgba(11,22,54,.85) 0%,rgba(11,22,54,.15) 30%,transparent 55%),linear-gradient(0deg,rgba(7,13,34,.92) 0%,rgba(7,13,34,.35) 38%,transparent 62%),linear-gradient(180deg,rgba(7,13,34,.45),transparent 22%)}

.sdl-float{position:absolute;left:48px;right:48px;bottom:96px;pointer-events:none;animation:sdlFloat 6s ease-in-out infinite}
@keyframes sdlFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
.sdl-float-word{display:flex;font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:clamp(2.6rem,5.4vw,4.6rem);line-height:1;letter-spacing:.04em;filter:drop-shadow(0 8px 30px rgba(0,0,0,.45))}
.sdl-float-word span{display:inline-block;background:linear-gradient(180deg,#ffffff 0%,#cfe0ff 55%,#8fb4ff 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
  animation:sdlLetterIn .8s calc(.4s + var(--i) * .07s) cubic-bezier(.2,.9,.3,1.3) both,sdlWave 3.2s calc(1.6s + var(--i) * .12s) ease-in-out infinite}
.sdl-float-word span:nth-child(n+6){background:linear-gradient(180deg,#b8a4ff 0%,#7f6bf0 50%,#4f8fe8 100%);-webkit-background-clip:text;background-clip:text}
@keyframes sdlLetterIn{from{opacity:0;transform:translateY(40px) rotateX(70deg);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
@keyframes sdlWave{0%,100%{transform:translateY(0)}20%{transform:translateY(-7px)}40%{transform:translateY(0)}}
.sdl-float-sub{margin-top:12px;font-size:1.02rem;color:rgba(230,236,255,.85);animation:sdlUp .8s 1.2s both;text-shadow:0 2px 12px rgba(0,0,0,.5)}
.sdl-float-sub em{font-style:normal;color:#b8a4ff;font-weight:600}

.sdl-caption{position:absolute;top:26px;right:28px;display:flex;align-items:center;gap:10px;padding:7px 14px 7px 7px;border-radius:999px;
  background:rgba(10,20,48,.55);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);animation:sdlCap .6s both}
@keyframes sdlCap{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
.sdl-tag{font-size:.64rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:4px 9px;border-radius:999px;background:linear-gradient(100deg,#5b3fd6,#2f6fe0)}
.sdl-cap-text{font-size:.82rem;font-weight:600}

.sdl-dots{position:absolute;left:48px;bottom:44px;display:flex;gap:8px}
.sdl-dots button{position:relative;width:10px;height:6px;border-radius:4px;border:0;padding:0;cursor:pointer;background:rgba(255,255,255,.3);overflow:hidden;transition:width .4s,background .3s}
.sdl-dots button:hover{background:rgba(255,255,255,.55)}
.sdl-dots button.on{width:44px;background:rgba(255,255,255,.22)}
.sdl-dots button i{position:absolute;inset:0;transform-origin:left;background:linear-gradient(90deg,#9cc2ff,#b8a4ff);animation:sdlFill linear both}
@keyframes sdlFill{from{transform:scaleX(0)}to{transform:scaleX(1)}}

/* responsive: slideshow on top, form below (like the phone layout) */
@media (max-width: 900px){
  .sdl-page{padding:0;align-items:stretch}
  .sdl-shell{grid-template-columns:1fr;grid-template-rows:260px auto;height:auto;min-height:100vh;border-radius:0;max-width:none}
  .sdl-right{grid-row:1}
  .sdl-left{grid-row:2;padding:30px 22px 22px}
  .sdl-float{left:22px;right:22px;bottom:44px}
  .sdl-float-word{font-size:2.4rem}
  .sdl-float-sub{font-size:.85rem;margin-top:6px}
  .sdl-dots{left:22px;bottom:20px}
  .sdl-caption{top:14px;right:14px}
  .sdl-brandrow{margin-bottom:24px}
  .sdl-title{font-size:2rem}
  .sdl-shade{background:linear-gradient(0deg,rgba(11,22,54,1) 0%,rgba(11,22,54,.4) 45%,rgba(7,13,34,.2) 100%)}
}
@media (prefers-reduced-motion: reduce){
  .sdl-page *{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
}
`;

export default LoginForm;
