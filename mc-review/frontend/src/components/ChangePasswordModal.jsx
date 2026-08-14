import { useState } from 'react';
import Modal from './Modal';
import api from '../api';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';

// forced=true: shown right after a fresh login when mustChangePassword is
// set (seeded account or admin reset) — no Cancel, no current-password
// field, since the just-used login password IS the current one.
export default function ChangePasswordModal({ forced, onClose }) {
  const { user, logout } = useApp();
  const { push } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (newPassword.length < 8) return setError('New password must be at least 8 characters');
    if (newPassword !== confirm) return setError('Passwords do not match');
    setBusy(true);
    try {
      await api.changePassword(forced ? undefined : currentPassword, newPassword);
      push('Password changed');
      onClose?.();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to change password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={forced ? 'Set a new password to continue' : 'Change password'}
      onClose={forced ? undefined : onClose}
      actions={<>
        {!forced && <button className="btn ghost" onClick={onClose}>Cancel</button>}
        {forced && <button className="btn ghost" onClick={logout}>Log out instead</button>}
        <button className="btn primary" disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Save'}</button>
      </>}
    >
      {forced && <p>Your account was just created or reset — set your own password before continuing, {user?.displayName}.</p>}
      {!forced && (
        <div className="field">
          <label>Current password</label>
          <input className="inp" style={{ width: '100%' }} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
      )}
      <div className="field">
        <label>New password</label>
        <input className="inp" style={{ width: '100%' }} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </div>
      <div className="field">
        <label>Confirm new password</label>
        <input className="inp" style={{ width: '100%' }} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && <div className="login-error">{error}</div>}
    </Modal>
  );
}
