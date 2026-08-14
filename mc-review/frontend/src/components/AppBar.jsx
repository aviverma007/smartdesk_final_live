import { useState } from 'react';
import { useApp } from '../context/AppContext';
import ChangePasswordModal from './ChangePasswordModal';

const PAGES = [
  { id: 1, label: 'Page 1 — NFA Entry' },
  { id: 2, label: 'Page 2 — Pre-meeting Review' },
  { id: 3, label: 'Page 3 — MC Meeting' },
  { id: 4, label: 'Page 4 — Order Numbering' },
];

export default function AppBar({ page, setPage }) {
  const { user, role, roleLabel, isAdmin, logout } = useApp();
  const [showChangePw, setShowChangePw] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="appbar">
      <div className="brand">
        <img src="/smartworld-logo.png" alt="Smart World Developers" className="brand-logo" />
        <div className="brand-text">
          <b>MC Review Dashboard</b>
          <span>CONTRACTS &amp; PROCUREMENT</span>
        </div>
      </div>
      <div className="tabs">
        {PAGES.map((p) => {
          const disabled = (p.id === 2 && role === 'user' ? false : p.id === 3 && role === 'user');
          return (
            <button
              key={p.id}
              className={`tab ${page === p.id ? 'active' : ''}`}
              disabled={disabled}
              title={disabled ? 'Reviewers/Admin only' : ''}
              onClick={() => !disabled && setPage(p.id)}
            >
              {p.label}
            </button>
          );
        })}
        {isAdmin && (
          <button className={`tab ${page === 5 ? 'active' : ''}`} onClick={() => setPage(5)}>
            Manage Users
          </button>
        )}
      </div>
      <div className="spacer" />
      <div className="userbox">
        <button className="userchip" onClick={() => setMenuOpen((v) => !v)}>
          {user?.displayName} <span className="rolepill">{roleLabel}</span> ▾
        </button>
        {menuOpen && (
          <div className="usermenu" onMouseLeave={() => setMenuOpen(false)}>
            <button onClick={() => { setShowChangePw(true); setMenuOpen(false); }}>Change password</button>
            <button onClick={logout}>Log out</button>
          </div>
        )}
      </div>

      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
    </div>
  );
}
