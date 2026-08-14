import { useEffect, useState } from 'react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';

const ROLE_LABEL = { user: 'User', revMEP: 'Reviewer — MEP', revCIV: 'Reviewer — Civil', admin: 'Admin' };

// Admin-only screen: list every login, change role, reset password
// (forces the user to set a new one on next login), create new accounts,
// activate/deactivate. Reached via the "Manage users" link in the app bar
// (admin role only).
export default function AdminUsers() {
  const { push } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);

  async function load() {
    setLoading(true);
    try { setUsers(await api.adminListUsers()); }
    catch (e) { push(e.response?.data?.error || 'Failed to load users', 'error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function changeRole(loginId, role) {
    try { await api.adminChangeRole(loginId, role); push(`${loginId} is now ${ROLE_LABEL[role]}`); load(); }
    catch (e) { push(e.response?.data?.error || 'Failed', 'error'); }
  }
  async function toggleActive(u) {
    try { await api.adminSetActive(u.LoginId, !u.IsActive); load(); }
    catch (e) { push(e.response?.data?.error || 'Failed', 'error'); }
  }

  return (
    <div className="pagewrap">
      <div className="surface">
        <div className="toolbar">
          <b>User accounts &amp; roles</b>
          <div className="spacer" />
          <button className="btn primary" onClick={() => setShowCreate(true)}>+ New account</button>
        </div>

        {loading ? <div className="empty">Loading…</div> : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>Login ID</th><th>Display Name</th><th>Role</th><th>Status</th><th>Password</th><th>Created</th><th></th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.Id} className={!u.IsActive ? 'rowdim' : ''}>
                    <td className="nfa">{u.LoginId}</td>
                    <td>{u.DisplayName}</td>
                    <td>
                      <select className="inp sm" value={u.Role} onChange={(e) => changeRole(u.LoginId, e.target.value)}>
                        {Object.keys(ROLE_LABEL).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                    </td>
                    <td>
                      <button className={`btn sm ${u.IsActive ? 'ghost' : ''}`} onClick={() => toggleActive(u)}>
                        {u.IsActive ? 'Active — deactivate' : 'Inactive — reactivate'}
                      </button>
                    </td>
                    <td>
                      {u.MustChangePassword && <span className="badge resub">must change on next login</span>}
                      <button className="btn sm ghost" onClick={() => setResetTarget(u)}>Reset password</button>
                    </td>
                    <td>{new Date(u.CreatedAt).toLocaleDateString()}</td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="legendline">
          Changing a role takes effect the next time that person's token refreshes (up to 12h) or on their next login.
          Resetting a password sets a temporary one and forces them to choose their own on next login.
        </div>
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
      {resetTarget && <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} onDone={() => { setResetTarget(null); load(); }} />}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }) {
  const { push } = useToast();
  const [loginId, setLoginId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('user');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  async function submit() {
    setError(null);
    try {
      await api.adminCreateUser({ loginId, displayName, role, password });
      push(`Account created for ${loginId}`);
      onCreated();
    } catch (e) { setError(e.response?.data?.error || 'Failed to create account'); }
  }

  return (
    <Modal
      title="New account"
      onClose={onClose}
      actions={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={submit}>Create</button>
      </>}
    >
      <div className="field"><label>Login ID</label><input className="inp" style={{ width: '100%' }} value={loginId} onChange={(e) => setLoginId(e.target.value)} /></div>
      <div className="field"><label>Display name</label><input className="inp" style={{ width: '100%' }} value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
      <div className="field"><label>Role</label>
        <select className="inp" style={{ width: '100%' }} value={role} onChange={(e) => setRole(e.target.value)}>
          {Object.keys(ROLE_LABEL).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </div>
      <div className="field"><label>Temporary password (8+ chars)</label><input className="inp" style={{ width: '100%' }} type="text" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      {error && <div className="login-error">{error}</div>}
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose, onDone }) {
  const { push } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState(null);

  async function submit() {
    setError(null);
    if (newPassword.length < 8) return setError('Must be at least 8 characters');
    try {
      await api.adminResetPassword(user.LoginId, newPassword);
      push(`Password reset for ${user.LoginId} — they must set a new one on next login`);
      onDone();
    } catch (e) { setError(e.response?.data?.error || 'Failed to reset'); }
  }

  return (
    <Modal
      title={`Reset password — ${user.LoginId}`}
      onClose={onClose}
      actions={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={submit}>Reset</button>
      </>}
    >
      <p>Sets a temporary password. {user.DisplayName} will be forced to choose their own on next login.</p>
      <div className="field"><label>Temporary password (8+ chars)</label><input className="inp" style={{ width: '100%' }} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
      {error && <div className="login-error">{error}</div>}
    </Modal>
  );
}
