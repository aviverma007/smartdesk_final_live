import { useApp } from '../context/AppContext';

const PAGES = [
  { id: 1, label: 'Page 1 — NFA Entry' },
  { id: 2, label: 'Page 2 — Pre-meeting Review' },
  { id: 3, label: 'Page 3 — MC Meeting' },
  { id: 4, label: 'Page 4 — Order Numbering' },
];

export default function AppBar({ page, setPage }) {
  const { role, setRole, ROLE_LABEL, isReviewerish } = useApp();

  return (
    <div className="appbar">
      <div className="brand">
        <b>MC Review Dashboard</b>
        <span>SMART WORLD DEVELOPERS</span>
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
      </div>
      <div className="spacer" />
      <div className="rolebox">
        <span>Role:</span>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          {Object.keys(ROLE_LABEL).map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
