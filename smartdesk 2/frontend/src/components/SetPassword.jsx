import React, { useEffect, useState } from 'react';
import { URA_API } from '../context/AuthContext';

// Rendered when the URL carries ?setpw=<token> (from the welcome email).
const SetPassword = ({ token }) => {
  const [phase, setPhase] = useState('checking'); // checking | form | done | invalid
  const [info, setInfo] = useState({ email: '', empId: '' });
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${URA_API}/set-password/validate?token=${encodeURIComponent(token)}`);
        const d = await r.json();
        if (d.success) { setInfo({ email: d.email, empId: d.empId }); setPhase('form'); }
        else { setError(d.error || 'This link is not valid.'); setPhase('invalid'); }
      } catch {
        setError('Could not reach the server. Try again later.'); setPhase('invalid');
      }
    })();
  }, [token]);

  const submit = async () => {
    setError('');
    if (pw.length < 6) return setError('Password must be at least 6 characters.');
    if (pw !== pw2) return setError('Passwords do not match.');
    setBusy(true);
    try {
      const r = await fetch(`${URA_API}/set-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: pw }),
      });
      const d = await r.json();
      if (d.success) setPhase('done');
      else { setError(d.error || 'Could not set password.'); }
    } catch { setError('Could not reach the server.'); }
    setBusy(false);
  };

  const wrap = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg,#0a2548 0%,#105da9 45%,#0d3d7a 100%)', fontFamily: "'DM Sans',sans-serif", padding: 20 };
  const card = { width: '100%', maxWidth: 420, background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.18)', borderRadius: 16, padding: 32, color: '#fff' };
  const inp = { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10,
    padding: '11px 14px', color: '#fff', fontSize: '.92rem', outline: 'none', width: '100%', marginTop: 8 };
  const btn = { width: '100%', marginTop: 18, padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
    background: '#fff', color: '#0a2548', fontWeight: 700, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: '.95rem' };
  const goLogin = () => { window.location.href = window.location.origin + window.location.pathname; };

  return (
    <div style={wrap}>
      <div style={card}>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: '1.4rem', margin: 0 }}>
          Set your SmartDesk password
        </h1>
        {phase === 'checking' && <p style={{ opacity: .8, marginTop: 14 }}>Checking your link…</p>}

        {phase === 'invalid' && (
          <>
            <p style={{ marginTop: 14, color: '#fecaca' }}>{error}</p>
            <button style={btn} onClick={goLogin}>Go to login</button>
          </>
        )}

        {phase === 'form' && (
          <>
            <p style={{ opacity: .8, marginTop: 10, fontSize: '.88rem' }}>
              Account: <strong>{info.empId || info.email}</strong>
            </p>
            <label style={{ display: 'block', marginTop: 16, fontSize: '.82rem', opacity: .85 }}>New password</label>
            <input type="password" style={inp} value={pw} onChange={e => setPw(e.target.value)} placeholder="At least 6 characters" />
            <label style={{ display: 'block', marginTop: 14, fontSize: '.82rem', opacity: .85 }}>Confirm password</label>
            <input type="password" style={inp} value={pw2} onChange={e => setPw2(e.target.value)} placeholder="Re-enter password" />
            {error && <p style={{ color: '#fecaca', marginTop: 12, fontSize: '.85rem' }}>{error}</p>}
            <button style={{ ...btn, opacity: busy ? .6 : 1 }} disabled={busy} onClick={submit}>
              {busy ? 'Saving…' : 'Set password'}
            </button>
          </>
        )}

        {phase === 'done' && (
          <>
            <p style={{ marginTop: 14 }}>Your password is set. You can now sign in.</p>
            <button style={btn} onClick={goLogin}>Go to login</button>
          </>
        )}
      </div>
    </div>
  );
};

export default SetPassword;
