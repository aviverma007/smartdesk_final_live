import { useState } from 'react';
import { useApp } from '../context/AppContext';
import api from '../api';

export default function LoginPage() {
  const { login } = useApp();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!loginId.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api.login(loginId.trim(), password);
      login(data.token, data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="loginwrap">
      <form className="loginbox" onSubmit={submit}>
        <img src="/smartworld-logo.png" alt="Smart World Developers" className="login-logo" />
        <h2>MC Review Dashboard</h2>
        <p className="login-sub">Contracts &amp; Procurement — Management Committee Review</p>

        <div className="field">
          <label>Login ID</label>
          <input className="inp" style={{ width: '100%' }} autoFocus value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="e.g. dhruv" />
        </div>
        <div className="field">
          <label>Password</label>
          <input className="inp" style={{ width: '100%' }} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error && <div className="login-error">{error}</div>}

        <button className="btn primary" type="submit" disabled={busy} style={{ width: '100%', marginTop: 6 }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
