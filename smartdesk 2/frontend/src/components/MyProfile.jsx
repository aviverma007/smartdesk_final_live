import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const MyProfile = () => {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: user?.name || 'Admin User', email: user?.email || '', phone: '', department: '', designation: '' });

  return (
    <div style={{ padding: '0 0 24px', maxWidth: 700 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-primary)', margin: 0 }}>My Profile</h2>
        <div style={{ height: 1, background: 'var(--border)', marginTop: 10 }} />
      </div>

      {/* Avatar + name */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(124,58,237,0.4),rgba(244,114,182,0.3))', border: '2px solid rgba(139,92,246,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, color: 'var(--accent-purple)' }}>
            {form.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}
          </div>
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid var(--bg-card)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </div>
        </div>
        <div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: '1.3rem', color: 'var(--text-primary)' }}>{form.name}</div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '.82rem', color: 'var(--text-muted)', marginTop: 3 }}>{form.designation || 'Employee'} · {form.department || 'Smart World Developers'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 6px rgba(74,222,128,0.7)' }} />
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '.72rem', color: 'var(--accent-green)' }}>Active</span>
          </div>
        </div>
        <button onClick={() => setEditing(e => !e)} style={{ marginLeft: 'auto', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, padding: '7px 16px', color: 'var(--accent-purple)', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: '.8rem', cursor: 'pointer' }}>
          {editing ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>

      {/* Fields */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[['name','Full Name'],['email','Email Address'],['phone','Phone Number'],['department','Department'],['designation','Designation']].map(([key, label]) => (
            <div key={key} style={key === 'email' ? { gridColumn: 'span 2' } : {}}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
              {editing ? (
                <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text-primary)', fontFamily: "'DM Sans', sans-serif", fontSize: '.85rem', outline: 'none' }}
                  onFocus={e => e.target.style.borderColor='var(--border-hover)'} onBlur={e => e.target.style.borderColor='var(--border)'} />
              ) : (
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '.88rem', color: form[key] ? 'var(--text-primary)' : 'var(--text-muted)', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                  {form[key] || `— not set —`}
                </div>
              )}
            </div>
          ))}
        </div>
        {editing && (
          <button onClick={() => setEditing(false)} style={{ marginTop: 20, background: 'linear-gradient(135deg,rgba(124,58,237,0.8),rgba(109,40,217,0.7))', border: 'none', borderRadius: 8, padding: '10px 24px', color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: '.85rem', cursor: 'pointer' }}>
            Save Changes
          </button>
        )}
      </div>
    </div>
  );
};

export default MyProfile;
