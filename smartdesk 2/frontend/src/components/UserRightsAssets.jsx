import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, URA_API } from '../context/AuthContext';
import { employeeAPI } from '../services/api';

/* ── Static config (mirrors backend) ─────────────────────────────────────── */
const ASSET_CATALOGUE = [
  { key: 'laptop', label: 'Laptop' },
  { key: 'laptop_bag', label: 'Laptop Bag' },
  { key: 'mouse', label: 'Mouse' },
  { key: 'charger', label: 'Charger' },
  { key: 'onboarding_kit', label: 'Onboarding Kit' },
];
const APPLICATIONS = ['SAP', 'Sales Force', '4QT', 'Farvision', 'Novade', 'QMS/Vendor Globe', 'DMS', 'Tally', 'Reloy', 'ManageEngine', 'Computax'];
const REQUEST_TYPES = [
  { key: 'new', label: 'New ID / Application' },
  { key: 'authorization', label: 'Authorization' },
  { key: 'deletion', label: 'ID Deletion' },
];

/* ── Status display ──────────────────────────────────────────────────────── */
const STATUS_META = {
  pending: { label: 'Pending', color: 'var(--accent-orange)' },
  onboarded: { label: 'Onboarded', color: 'var(--accent-green)' },
  credentials_sent: { label: 'Credentials Sent', color: 'var(--accent-sky)' },
  employee_review: { label: 'Pending', color: 'var(--accent-orange)' },
  submitted: { label: 'Submitted', color: 'var(--accent-green)' },
  pending_manager: { label: 'Pending', color: 'var(--accent-orange)' },
  approved: { label: 'Approved', color: 'var(--accent-green)' },
  rejected: { label: 'Rejected', color: '#dc2626' },
  manager_approved: { label: 'Manager Approved', color: 'var(--accent-sky)' },
  it_given: { label: 'IT — Given', color: 'var(--accent-teal)' },
};
const Pill = ({ status }) => {
  const m = STATUS_META[status] || { label: status, color: 'var(--text-muted)' };
  return <span style={{ fontSize: '.72rem', fontWeight: 700, color: m.color, background: `color-mix(in srgb, ${m.color} 14%, transparent)`,
    border: `1px solid ${m.color}`, borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>{m.label}</span>;
};

/* ── Shared styles ───────────────────────────────────────────────────────── */
const card = { background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 14, padding: 20, marginBottom: 16 };
const label = { display: 'block', fontSize: '.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, fontFamily: "'DM Sans',sans-serif" };
const input = { width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '.88rem', fontFamily: "'DM Sans',sans-serif", outline: 'none', marginBottom: 12 };
const primaryBtn = { padding: '10px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: '.86rem' };
const ghostBtn = { ...primaryBtn, background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)' };
const h2 = { fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)', margin: '0 0 4px' };

/* ── API helper (sends role headers) ─────────────────────────────────────── */
function useApi() {
  const { user } = useAuth();
  return useCallback(async (path, method = 'GET', body) => {
    try {
      const res = await fetch(`${URA_API}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-user-role': user?.role || '', 'x-user-id': user?.empId || '' },
        body: body ? JSON.stringify(body) : undefined,
      });
      return await res.json();
    } catch (e) {
      return { success: false, offline: true, error: 'Cannot reach the User Rights service (port 5093). Is the backend running?' };
    }
  }, [user]);
}

/* ═══════════════════════════ 1) ONBOARDING ═════════════════════════════════ */
const OnboardingView = ({ onBack }) => {
  const api = useApi();
  const blank = { fullName: '', dob: '', gender: '', pastCompany: '', profile: '', managerName: '', department: '', joiningDate: '', phone: '' };
  const [form, setForm] = useState(blank);
  const [records, setRecords] = useState([]);
  const [msg, setMsg] = useState('');
  const [empIds, setEmpIds] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const load = useCallback(async () => { const d = await api('/onboarding'); if (d.success) setRecords(d.records); }, [api]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.fullName.trim()) return setMsg('Full name is required.');
    const d = await api('/onboarding', 'POST', form);
    if (d.success) { setForm(blank); setMsg('Saved — pending onboarding.'); load(); } else setMsg(d.error || 'Could not save.');
  };
  const complete = async (id) => {
    const empId = (empIds[id] || '').trim();
    if (!empId) return setMsg('Enter an Employee ID to complete onboarding.');
    const d = await api(`/onboarding/${id}/complete`, 'POST', { empId });
    if (d.success) { setMsg('Onboarded and saved.'); load(); } else setMsg(d.error || 'Could not complete.');
  };

  return (
    <div>
      <BackBar onBack={onBack} title="User ID Allocation — Onboarding" subtitle="Capture a new joiner before onboarding. Assign the Employee ID once they join." />
      <div style={card}>
        <h2 style={h2}>New joiner details</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
          <Field l="Full name *"><input style={input} value={form.fullName} onChange={e => set('fullName', e.target.value)} /></Field>
          <Field l="Date of birth"><input type="date" style={input} value={form.dob} onChange={e => set('dob', e.target.value)} /></Field>
          <Field l="Gender"><select style={input} value={form.gender} onChange={e => set('gender', e.target.value)}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></Field>
          <Field l="Past company"><input style={input} value={form.pastCompany} onChange={e => set('pastCompany', e.target.value)} /></Field>
          <Field l="Profile / role"><input style={input} value={form.profile} onChange={e => set('profile', e.target.value)} /></Field>
          <Field l="Manager name"><input style={input} value={form.managerName} onChange={e => set('managerName', e.target.value)} /></Field>
          <Field l="Department"><input style={input} value={form.department} onChange={e => set('department', e.target.value)} /></Field>
          <Field l="Joining date"><input type="date" style={input} value={form.joiningDate} onChange={e => set('joiningDate', e.target.value)} /></Field>
          <Field l="Phone number"><input style={input} value={form.phone} onChange={e => set('phone', e.target.value)} /></Field>
        </div>
        <button style={primaryBtn} onClick={create}>Save joiner</button>
        {msg && <span style={{ marginLeft: 12, fontSize: '.84rem', color: 'var(--text-muted)' }}>{msg}</span>}
      </div>

      <div style={card}>
        <h2 style={h2}>Joiners</h2>
        {records.length === 0 && <Empty text="No joiners yet." />}
        {records.map(r => (
          <div key={r.Id} style={rowStyle}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{r.FullName}</div>
              <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>{[r.Department, r.ManagerName, r.EmpId && `ID: ${r.EmpId}`].filter(Boolean).join(' · ')}</div>
            </div>
            <Pill status={r.Status} />
            {r.Status === 'pending' && (
              <div style={{ display: 'flex', gap: 8, marginLeft: 12 }}>
                <input placeholder="Employee ID" style={{ ...input, marginBottom: 0, width: 130 }}
                  value={empIds[r.Id] || ''} onChange={e => setEmpIds(s => ({ ...s, [r.Id]: e.target.value }))} />
                <button style={primaryBtn} onClick={() => complete(r.Id)}>Complete</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ═══════════════════════════ 2) ASSETS ═════════════════════════════════════ */
const AssetsView = ({ onBack }) => {
  const api = useApi();
  const { isHr, isIt, isAdmin, user } = useAuth();
  const staff = isHr || isIt || isAdmin;     // can view all requests + send link
  const canCreate = isHr || isAdmin;          // only HR creates requests
  const [empId, setEmpId] = useState('');
  const [empQuery, setEmpQuery] = useState('');
  const [showDir, setShowDir] = useState(false);
  const [directory, setDirectory] = useState([]);
  const [email, setEmail] = useState('');
  const [picked, setPicked] = useState([]);

  // Load the employee directory (Excel + onboarded) for the picker — HR only
  useEffect(() => {
    if (!canCreate) return;
    (async () => {
      try {
        const data = await employeeAPI.getAll();
        let onb = [];
        try {
          const r = await fetch(`${URA_API}/onboarding/directory`); const j = await r.json();
          if (j.success) onb = j.records.map(o => ({ id: o.EmpId, name: o.FullName, department: o.Department || '', email: '' }));
        } catch (_) {}
        const ex = new Set(data.map(e => String(e.id)));
        setDirectory([...data, ...onb.filter(o => !ex.has(String(o.id)))]);
      } catch (_) { setDirectory([]); }
    })();
  }, [canCreate]);
  const dirMatches = empQuery.trim()
    ? directory.filter(e => {
        const s = empQuery.trim().toLowerCase();
        return String(e.id).toLowerCase().includes(s) || (e.name || '').toLowerCase().includes(s);
      }).slice(0, 8)
    : [];
  const [list, setList] = useState([]);
  const [aSearch, setASearch] = useState('');
  const [aFilter, setAFilter] = useState('all'); // all | pending | submitted
  const [detail, setDetail] = useState(null);
  const [msg, setMsg] = useState('');

  const loadList = useCallback(async () => { const d = await api('/assets'); if (d.success) setList(d.records); }, [api]);
  const loadMine = useCallback(async () => { const d = await api(`/assets/by-emp/${encodeURIComponent(user?.empId || '')}`); if (d.success) setDetail(d.record); }, [api, user]);
  useEffect(() => { if (staff) loadList(); else loadMine(); }, [staff, loadList, loadMine]);

  const toggle = (k) => setPicked(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);
  const create = async () => {
    if (!empId.trim() || !email.trim()) return setMsg('Employee ID and email are required.');
    const d = await api('/assets', 'POST', { empId: empId.trim(), email: email.trim(), items: picked });
    if (d.success) { setMsg('Asset request created.'); setEmpId(''); setEmpQuery(''); setEmail(''); setPicked([]); loadList(); } else setMsg(d.error || 'Could not create.');
  };
  const openDetail = async (id) => {
    if (detail?.Id === id) { setDetail(null); return; } // clicking View again hides it
    const d = await api(`/assets/${id}`); if (d.success) setDetail(d.record);
  };
  // Re-fetch the open request without toggling it closed (used after save/submit)
  const refreshDetail = async (id) => { const d = await api(`/assets/${id}`); if (d.success) setDetail(d.record); };
  const sendCreds = async (id) => { const d = await api(`/assets/${id}/send-credentials`, 'POST'); setMsg(d.success ? (d.emailed ? 'Login credentials emailed.' : 'Saved, but SMTP is not configured — set SMTP_PASS in .env to send.') : (d.error || 'Failed.')); loadList(); };

  // employee confirm (Received / Not required)
  const [confirmItems, setConfirmItems] = useState({});
  // IT confirm (Given / Not given)
  const [itItems, setItItems] = useState({});
  const [itEditing, setItEditing] = useState(false);   // re-open IT list after IT submit
  const [empEditing, setEmpEditing] = useState(false); // admin re-opens employee list after emp submit
  useEffect(() => {
    if (detail?.items) {
      const m = {}, n = {};
      detail.items.forEach(i => {
        m[i.ItemKey] = { received: !!i.Received, notRequired: !!i.NotRequired };
        n[i.ItemKey] = { given: !!i.Given, notGiven: !!i.NotGiven };
      });
      setConfirmItems(m); setItItems(n);
    }
    setItEditing(false); setEmpEditing(false);
  }, [detail]);
  const isItRole = isIt || isAdmin;
  const itSubmitted = !!detail?.ITSubmittedAt;
  const empSubmitted = detail?.Status === 'submitted';
  // IT can edit Given/Not-given until they submit; after submit, only via the Edit button
  const canEditIT = isItRole && (!itSubmitted || itEditing);
  // Employee edits Received/Not-required until they submit. After submit, ONLY admin (via Edit).
  const canEditEmp = (!staff && !empSubmitted) || (isAdmin && (!empSubmitted || empEditing));
  const refreshAll = (id) => { if (staff) { refreshDetail(id); loadList(); } else { loadMine(); } };
  const saveConfirm = async () => {
    const items = Object.entries(confirmItems).map(([key, v]) => ({ key, received: v.received, notRequired: v.notRequired }));
    const d = await api(`/assets/${detail.Id}/employee-confirm`, 'PUT', { items });
    setMsg(d.success ? 'Saved.' : (d.error || 'Failed.')); if (d.success) refreshAll(detail.Id);
  };
  const submitConfirm = async () => {
    await saveConfirm();
    const d = await api(`/assets/${detail.Id}/submit`, 'POST');
    setMsg(d.success ? 'Submitted.' : (d.error || 'Failed.')); if (d.success) refreshAll(detail.Id);
  };
  const saveIT = async () => {
    const items = Object.entries(itItems).map(([key, v]) => ({ key, given: v.given, notGiven: v.notGiven }));
    const d = await api(`/assets/${detail.Id}/it-confirm`, 'PUT', { items });
    setMsg(d.success ? 'Saved.' : (d.error || 'Failed.')); if (d.success) refreshAll(detail.Id);
  };
  const submitIT = async () => {
    await saveIT();
    const d = await api(`/assets/${detail.Id}/it-submit`, 'POST');
    setMsg(d.success ? 'Handover submitted — now pending the employee’s approval.' : (d.error || 'Failed.')); if (d.success) refreshAll(detail.Id);
  };

  return (
    <div>
      <BackBar onBack={onBack} title="Asset Management" subtitle={canCreate ? 'Request assets for an employee, then send their welcome link.' : (staff ? 'Review asset requests and send welcome links.' : 'Confirm the assets you received.')} />

      {canCreate && (
        <div style={card}>
          <h2 style={h2}>New asset request</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
            <Field l="Employee ID *">
              <div style={{ position: 'relative' }}>
                <input style={input} placeholder="Search name or ID…" value={empQuery}
                  onChange={e => { setEmpQuery(e.target.value); setEmpId(e.target.value); setShowDir(true); }}
                  onFocus={() => setShowDir(true)} onBlur={() => setTimeout(() => setShowDir(false), 150)} />
                {showDir && dirMatches.length > 0 && (
                  <div style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, top: 44, background: 'var(--bg-base)',
                    border: '1px solid var(--border)', borderRadius: 9, maxHeight: 240, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
                    {dirMatches.map(e => (
                      <div key={e.id} onMouseDown={() => { setEmpId(String(e.id)); setEmail(e.email || ''); setEmpQuery(`${e.name || ''} (${e.id})`); setShowDir(false); }}
                        style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: '.86rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{e.name || '(no name)'}</span>
                        <span style={{ color: 'var(--text-muted)' }}> · {e.id}{e.department ? ` · ${e.department}` : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Field>
            <Field l="Employee email *"><input style={input} value={email} onChange={e => setEmail(e.target.value)} /></Field>
          </div>
          <div style={label}>Assets to allocate</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            {ASSET_CATALOGUE.map(a => (
              <label key={a.key} style={chip(picked.includes(a.key))}>
                <input type="checkbox" checked={picked.includes(a.key)} onChange={() => toggle(a.key)} style={{ marginRight: 7 }} />{a.label}
              </label>
            ))}
          </div>
          <button style={primaryBtn} onClick={create}>Create request</button>
          {msg && <span style={{ marginLeft: 12, fontSize: '.84rem', color: 'var(--text-muted)' }}>{msg}</span>}
        </div>
      )}

      {staff && (
        <div style={card}>
          <h2 style={h2}>Asset requests</h2>
          <FilterBar search={aSearch} setSearch={setASearch} filter={aFilter} setFilter={setAFilter}
            placeholder="Search by Employee ID or email…"
            options={[{ key: 'all', label: 'All' }, { key: 'pending', label: 'Pending' }, { key: 'submitted', label: 'Submitted' }]} />
          {(() => {
            const shown = list.filter(r => {
              const s = aSearch.trim().toLowerCase();
              const matchSearch = !s || String(r.EmpId).toLowerCase().includes(s) || (r.Email || '').toLowerCase().includes(s);
              const matchFilter = aFilter === 'all' || (aFilter === 'submitted' ? r.Status === 'submitted' : r.Status !== 'submitted');
              return matchSearch && matchFilter;
            });
            return shown.length === 0
              ? <Empty text="No matching requests." />
              : shown.map(r => (
                <div key={r.Id} style={rowStyle}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>ID {r.EmpId}</div>
                    <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>{r.Email}</div>
                  </div>
                  <Pill status={r.Status} />
                  <button style={{ ...ghostBtn, marginLeft: 10 }} onClick={() => openDetail(r.Id)}>View</button>
                  {(isHr || isAdmin) ? <button style={{ ...primaryBtn, marginLeft: 8 }} onClick={() => sendCreds(r.Id)}>Send welcome link</button> : null}
                </div>
              ));
          })()}
        </div>
      )}

      {detail && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={h2}>Assets for {detail.EmpId}</h2><Pill status={detail.Status} />
          </div>

          {/* IT HANDOVER — Given / Not given */}
          {isItRole && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <strong style={{ color: 'var(--text-primary)' }}>IT handover</strong>
                {itSubmitted && !itEditing && <button style={{ ...ghostBtn, padding: '6px 12px', fontSize: '.8rem' }} onClick={() => setItEditing(true)}>Edit</button>}
              </div>
              {itSubmitted && !itEditing
                ? <p style={{ fontSize: '.82rem', color: 'var(--accent-green)', marginTop: 0 }}>Handover submitted. Click Edit to change.</p>
                : <p style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginTop: 0 }}>Mark what you handed over, then Submit.</p>}
              {detail.items?.filter(i => i.Requested || isItRole).map(i => (
                <div key={i.ItemKey} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, fontWeight: 600, color: 'var(--text-primary)' }}>{i.ItemLabel}{i.Requested ? '' : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> (not requested)</span>}</div>
                  <label style={{ fontSize: '.84rem', color: 'var(--text-muted)' }}>
                    <input type="checkbox" disabled={!canEditIT || !i.Requested} checked={!!itItems[i.ItemKey]?.given}
                      onChange={e => setItItems(s => ({ ...s, [i.ItemKey]: { given: e.target.checked, notGiven: false } }))} /> Given
                  </label>
                  <label style={{ fontSize: '.84rem', color: 'var(--text-muted)' }}>
                    <input type="checkbox" disabled={!canEditIT || !i.Requested} checked={!!itItems[i.ItemKey]?.notGiven}
                      onChange={e => setItItems(s => ({ ...s, [i.ItemKey]: { given: false, notGiven: e.target.checked } }))} /> Not given
                  </label>
                </div>
              ))}
              {canEditIT && (
                <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                  <button style={ghostBtn} onClick={saveIT}>Save</button>
                  <button style={primaryBtn} onClick={submitIT}>Submit</button>
                </div>
              )}
            </div>
          )}

          {/* EMPLOYEE RECEIPT — Received / Not required (employee + admin) */}
          {(!staff || isAdmin) && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Employee receipt</strong>
                {isAdmin && empSubmitted && !empEditing && <button style={{ ...ghostBtn, padding: '6px 12px', fontSize: '.8rem' }} onClick={() => setEmpEditing(true)}>Edit (admin)</button>}
              </div>
              {empSubmitted && !empEditing
                ? <p style={{ fontSize: '.82rem', color: 'var(--accent-orange)', marginTop: 0 }}>{isAdmin ? 'Submitted and locked. Click Edit to override.' : 'Submitted and locked. Only an admin can change it.'}</p>
                : <p style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginTop: 0 }}>Tick what you received, then Submit.</p>}
              {detail.items?.filter(i => i.Requested || isAdmin).map(i => (
                <div key={i.ItemKey} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, fontWeight: 600, color: 'var(--text-primary)' }}>{i.ItemLabel}{i.Requested ? '' : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> (not requested)</span>}</div>
                  <label style={{ fontSize: '.84rem', color: 'var(--text-muted)' }}>
                    <input type="checkbox" disabled={!canEditEmp || !i.Requested} checked={!!confirmItems[i.ItemKey]?.received}
                      onChange={e => setConfirmItems(s => ({ ...s, [i.ItemKey]: { received: e.target.checked, notRequired: false } }))} /> Received
                  </label>
                  <label style={{ fontSize: '.84rem', color: 'var(--text-muted)' }}>
                    <input type="checkbox" disabled={!canEditEmp || !i.Requested} checked={!!confirmItems[i.ItemKey]?.notRequired}
                      onChange={e => setConfirmItems(s => ({ ...s, [i.ItemKey]: { received: false, notRequired: e.target.checked } }))} /> Not required
                  </label>
                </div>
              ))}
              {canEditEmp && (
                <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                  <button style={ghostBtn} onClick={saveConfirm}>Save</button>
                  {!staff && <button style={primaryBtn} onClick={submitConfirm}>Submit</button>}
                </div>
              )}
            </div>
          )}

          {/* HR read-only summary */}
          {isHr && !isAdmin && (
            <div style={{ marginTop: 12 }}>
              {detail.items?.filter(i => i.Requested).map(i => (
                <div key={i.ItemKey} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, fontWeight: 600, color: 'var(--text-primary)' }}>{i.ItemLabel}</div>
                  <div style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
                    IT: {i.Given ? 'Given' : i.NotGiven ? 'Not given' : '—'} · Emp: {i.Received ? 'Received' : i.NotRequired ? 'Not required' : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {msg && <p style={{ fontSize: '.84rem', color: 'var(--text-muted)', marginTop: 10 }}>{msg}</p>}
        </div>
      )}

      <AssetRequestsSection />
    </div>
  );
};

/* ═══════════ EMPLOYEE SELF-SERVICE ASSET REQUESTS (with IT approval) ════════ */
const AssetRequestsSection = () => {
  const api = useApi();
  const { isHr, isIt, isManager, isAdmin, isEmployee } = useAuth();
  const isReviewer = isIt || isAdmin;
  const [list, setList] = useState([]);
  const [picked, setPicked] = useState([]);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState({});
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => { const d = await api('/asset-requests'); if (d.success) setList(d.records); }, [api]);
  useEffect(() => { load(); }, [load]);
  const toggle = (k) => setPicked(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);
  const submit = async () => {
    if (picked.length === 0) return setMsg('Select at least one asset.');
    const items = ASSET_CATALOGUE.filter(a => picked.includes(a.key));
    const d = await api('/asset-requests', 'POST', { items, reason });
    if (d.success) { setMsg('Request submitted — pending IT approval.'); setPicked([]); setReason(''); load(); } else setMsg(d.error || 'Failed.');
  };
  const decide = async (id, action) => {
    const d = await api(`/asset-requests/${id}/decide`, 'POST', { action, remarks: notes[id] || '' });
    setMsg(d.success ? (action === 'approve' ? 'Approved.' : 'Rejected.') : (d.error || 'Failed.')); load();
  };

  return (
    <>
      {isEmployee && (
        <div style={card}>
          <h2 style={h2}>Request a new asset</h2>
          <div style={label}>Assets needed</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            {ASSET_CATALOGUE.map(a => (
              <label key={a.key} style={chip(picked.includes(a.key))}>
                <input type="checkbox" checked={picked.includes(a.key)} onChange={() => toggle(a.key)} style={{ marginRight: 7 }} />{a.label}
              </label>
            ))}
          </div>
          <Field l="Reason (optional)"><textarea style={{ ...input, minHeight: 56 }} value={reason} onChange={e => setReason(e.target.value)} /></Field>
          <button style={primaryBtn} onClick={submit}>Submit request</button>
          {msg && <span style={{ marginLeft: 12, fontSize: '.84rem', color: 'var(--text-muted)' }}>{msg}</span>}
        </div>
      )}

      <div style={card}>
        <h2 style={h2}>{isEmployee ? 'My asset requests' : 'New-asset requests'}</h2>
        {list.length === 0 && <Empty text="No requests yet." />}
        {list.map(r => {
          let items = []; try { items = JSON.parse(r.Items || '[]'); } catch {}
          const decided = r.Status !== 'pending';
          return (
            <div key={r.Id} style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{isEmployee ? '' : `ID ${r.EmpId} · `}{items.map(i => i.label).join(', ') || '—'}</div>
                  {r.Reason && <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>{r.Reason}</div>}
                </div>
                <Pill status={r.Status} />
              </div>
              {r.ITRemarks && <div style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginTop: 8 }}>IT remarks: {r.ITRemarks}</div>}
              {isReviewer && !decided && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <input placeholder="Remarks (optional)" style={{ ...input, marginBottom: 0, flex: 1, minWidth: 180 }} value={notes[r.Id] || ''} onChange={e => setNotes(s => ({ ...s, [r.Id]: e.target.value }))} />
                  <button style={primaryBtn} onClick={() => decide(r.Id, 'approve')}>Approve</button>
                  <button style={{ ...ghostBtn, color: '#dc2626', borderColor: '#dc2626' }} onClick={() => decide(r.Id, 'reject')}>Reject</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};

/* ═══════════════════════════ 3) ACCESS / RIGHTS ════════════════════════════ */
const AccessView = ({ onBack }) => {
  const api = useApi();
  const { isHr, isIt, isManager, isAdmin, isEmployee } = useAuth();
  const canCreate = isEmployee || isAdmin;       // only the employee fills the form
  const canApprove = isIt || isAdmin;            // only IT approves + adds remarks
  const blank = { requestType: 'new', requesterName: '', company: '', department: '', empId: '', email: '', workLocation: '', language: 'EN-English', scopeOfWork: '', applications: [], details: '' };
  const [form, setForm] = useState(blank);
  const [list, setList] = useState([]);
  const [notes, setNotes] = useState({});
  const [viewing, setViewing] = useState(null);
  const [acSearch, setAcSearch] = useState('');
  const [acFilter, setAcFilter] = useState('all'); // all | pending | approved
  const [msg, setMsg] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleApp = (a) => setForm(f => ({ ...f, applications: f.applications.includes(a) ? f.applications.filter(x => x !== a) : [...f.applications, a] }));
  const load = useCallback(async () => { const d = await api('/access'); if (d.success) setList(d.records); }, [api]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const d = await api('/access', 'POST', form);
    if (d.success) { setForm(blank); setMsg('Request submitted — awaiting IT approval.'); load(); } else setMsg(d.error || 'Could not submit.');
  };
  const decide = async (id, action) => {
    const d = await api(`/access/${id}/it-${action}`, 'POST', { remarks: notes[id] || '' });
    setMsg(d.success ? (action === 'approve' ? 'Approved.' : 'Rejected.') : (d.error || 'Failed.')); load();
  };

  return (
    <div>
      <BackBar onBack={onBack} title="Application & Rights Allocation" subtitle={canCreate ? 'Fill the form to request application access. IT will review and approve.' : (canApprove ? 'Review requests, add remarks, and approve.' : 'View application & rights requests.')} />

      {canCreate && (
        <div style={card}>
          <h2 style={h2}>Request form</h2>
          <div style={{ display: 'flex', gap: 18, margin: '12px 0' }}>
            {REQUEST_TYPES.map(t => (
              <label key={t.key} style={{ fontSize: '.86rem', color: 'var(--text-primary)' }}>
                <input type="radio" name="rtype" checked={form.requestType === t.key} onChange={() => set('requestType', t.key)} style={{ marginRight: 6 }} />{t.label}
              </label>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field l="Requester name"><input style={input} value={form.requesterName} onChange={e => set('requesterName', e.target.value)} /></Field>
            <Field l="Company"><input style={input} value={form.company} onChange={e => set('company', e.target.value)} /></Field>
            <Field l="Department"><input style={input} value={form.department} onChange={e => set('department', e.target.value)} /></Field>
            <Field l="Employee ID"><input style={input} value={form.empId} onChange={e => set('empId', e.target.value)} /></Field>
            <Field l="Email"><input style={input} value={form.email} onChange={e => set('email', e.target.value)} /></Field>
            <Field l="Work location"><input style={input} value={form.workLocation} onChange={e => set('workLocation', e.target.value)} /></Field>
          </div>
          <div style={label}>Applications</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            {APPLICATIONS.map(a => (
              <label key={a} style={chip(form.applications.includes(a))}>
                <input type="checkbox" checked={form.applications.includes(a)} onChange={() => toggleApp(a)} style={{ marginRight: 7 }} />{a}
              </label>
            ))}
          </div>
          <Field l="Scope of work & function"><textarea style={{ ...input, minHeight: 60 }} value={form.scopeOfWork} onChange={e => set('scopeOfWork', e.target.value)} /></Field>
          <Field l="Description of required authorization"><textarea style={{ ...input, minHeight: 60 }} value={form.details} onChange={e => set('details', e.target.value)} /></Field>
          <button style={primaryBtn} onClick={create}>Submit request</button>
          {msg && <span style={{ marginLeft: 12, fontSize: '.84rem', color: 'var(--text-muted)' }}>{msg}</span>}
        </div>
      )}

      <div style={card}>
        <h2 style={h2}>Requests</h2>
        {(isIt || isHr || isAdmin) && (
          <FilterBar search={acSearch} setSearch={setAcSearch} filter={acFilter} setFilter={setAcFilter}
            placeholder="Search by name, ID, email or app…"
            options={[{ key: 'all', label: 'All' }, { key: 'pending', label: 'Pending' }, { key: 'approved', label: 'Approved' }]} />
        )}
        {(() => {
          const shown = list.filter(r => {
            const s = acSearch.trim().toLowerCase();
            const hay = `${r.RequesterName || ''} ${r.EmpId || ''} ${r.Email || ''} ${r.Applications || ''}`.toLowerCase();
            const matchSearch = !s || hay.includes(s);
            const matchFilter = acFilter === 'all' || (acFilter === 'approved' ? r.Status === 'approved' : r.Status !== 'approved');
            return matchSearch && matchFilter;
          });
          if (shown.length === 0) return <Empty text="No matching requests." />;
          return shown.map(r => {
          let apps = []; try { apps = JSON.parse(r.Applications || '[]'); } catch {}
          const approved = r.Status === 'approved';
          const rejected = r.Status === 'rejected';
          const decided = approved || rejected;
          return (
            <div key={r.Id} style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{r.RequesterName || r.EmpId || `Request #${r.Id}`} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '.8rem' }}>· {r.RequestType}</span></div>
                  <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>{apps.join(', ') || '—'}</div>
                </div>
                <Pill status={r.Status} />
                <button style={{ ...ghostBtn, marginLeft: 8, padding: '6px 12px', fontSize: '.8rem' }}
                  onClick={() => setViewing(viewing === r.Id ? null : r.Id)}>
                  {viewing === r.Id ? 'Hide form' : 'View form'}
                </button>
              </div>

              {viewing === r.Id && (
                <div style={{ marginTop: 12, padding: 16, borderRadius: 10, background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 18, marginBottom: 12 }}>
                    {REQUEST_TYPES.map(t => (
                      <label key={t.key} style={{ fontSize: '.86rem', color: r.RequestType === t.key ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        <input type="radio" checked={r.RequestType === t.key} readOnly disabled style={{ marginRight: 6 }} />{t.label}
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <Field l="Requester name"><input style={input} value={r.RequesterName || ''} disabled /></Field>
                    <Field l="Company"><input style={input} value={r.Company || ''} disabled /></Field>
                    <Field l="Department"><input style={input} value={r.Department || ''} disabled /></Field>
                    <Field l="Employee ID"><input style={input} value={r.EmpId || ''} disabled /></Field>
                    <Field l="Email"><input style={input} value={r.Email || ''} disabled /></Field>
                    <Field l="Work location"><input style={input} value={r.WorkLocation || ''} disabled /></Field>
                  </div>
                  <div style={label}>Applications</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                    {APPLICATIONS.map(a => <span key={a} style={chip(apps.includes(a))}>{a}</span>)}
                  </div>
                  <Field l="Scope of work & function"><textarea style={{ ...input, minHeight: 60 }} value={r.ScopeOfWork || ''} disabled /></Field>
                  <Field l="Description of required authorization"><textarea style={{ ...input, minHeight: 60 }} value={r.Details || ''} disabled /></Field>
                  {r.ManagerNote && <Field l="IT remarks"><input style={input} value={r.ManagerNote} disabled /></Field>}
                  <p style={{ fontSize: '.74rem', color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>Read-only view.</p>
                </div>
              )}

              {r.ManagerNote && <div style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginTop: 8 }}>IT remarks: {r.ManagerNote}</div>}
              {/* IT: remarks + approve/reject (only while not yet decided) */}
              {canApprove && !decided && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <input placeholder="Remarks (optional)" style={{ ...input, marginBottom: 0, flex: 1, minWidth: 180 }} value={notes[r.Id] || ''} onChange={e => setNotes(s => ({ ...s, [r.Id]: e.target.value }))} />
                  <button style={primaryBtn} onClick={() => decide(r.Id, 'approve')}>Approve</button>
                  <button style={{ ...ghostBtn, color: '#dc2626', borderColor: '#dc2626' }} onClick={() => decide(r.Id, 'reject')}>Reject</button>
                </div>
              )}
            </div>
          );
        });
        })()}
      </div>
    </div>
  );
};

/* ── Small helpers ───────────────────────────────────────────────────────── */
const rowStyle = { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' };
const Field = ({ l, children }) => <div><div style={label}>{l}</div>{children}</div>;
const ViewField = ({ l, v }) => (
  <div style={{ marginBottom: 4 }}>
    <span style={{ color: 'var(--text-muted)' }}>{l}: </span>
    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{v || '—'}</span>
  </div>
);
const Empty = ({ text }) => <p style={{ color: 'var(--text-muted)', fontSize: '.88rem', padding: '8px 0' }}>{text}</p>;
const FilterBar = ({ search, setSearch, filter, setFilter, options, placeholder }) => (
  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
    <input placeholder={placeholder} value={search} onChange={e => setSearch(e.target.value)} style={{ ...input, marginBottom: 0, maxWidth: 300 }} />
    <div style={{ display: 'flex', gap: 8 }}>
      {options.map(o => (
        <button key={o.key} onClick={() => setFilter(o.key)} style={{ padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
          fontSize: '.82rem', fontFamily: "'DM Sans',sans-serif",
          border: `1px solid ${filter === o.key ? 'var(--accent)' : 'var(--border)'}`,
          background: filter === o.key ? 'var(--accent)' : 'transparent',
          color: filter === o.key ? '#fff' : 'var(--text-primary)' }}>{o.label}</button>
      ))}
    </div>
  </div>
);
const chip = (on) => ({ display: 'inline-flex', alignItems: 'center', padding: '7px 13px', borderRadius: 9, cursor: 'pointer',
  fontSize: '.84rem', fontFamily: "'DM Sans',sans-serif", border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
  background: on ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--bg-base)', color: on ? 'var(--accent)' : 'var(--text-primary)' });
const BackBar = ({ onBack, title, subtitle }) => (
  <div style={{ marginBottom: 18 }}>
    <button onClick={onBack} style={{ ...ghostBtn, padding: '6px 12px', fontSize: '.8rem', marginBottom: 12 }}>← Back</button>
    <h1 style={{ ...h2, fontSize: '1.5rem' }}>{title}</h1>
    <p style={{ color: 'var(--text-muted)', fontSize: '.9rem', margin: 0 }}>{subtitle}</p>
  </div>
);

/* ── Landing buttons ─────────────────────────────────────────────────────── */
const BUTTONS = [
  { id: 'onboarding', title: 'User ID Allocation', desc: 'Onboard a new joiner and assign their Employee ID.', grad: 'linear-gradient(135deg,#0c1a40,#2563eb)', roles: ['hr', 'admin'] },
  { id: 'assets', title: 'Asset Management', desc: 'Allocate assets and let employees confirm receipt.', grad: 'linear-gradient(135deg,#0a2010,#16a34a)', roles: ['hr', 'it', 'admin', 'employee'] },
  { id: 'access', title: 'Application & Rights', desc: 'Request app access with manager + IT approval.', grad: 'linear-gradient(135deg,#1a1040,#7c3aed)', roles: ['hr', 'it', 'manager', 'admin', 'employee'] },
];

const UserRightsAssets = () => {
  const { user } = useAuth();
  const api = useApi();
  const r = user?.role || '';
  const [view, setView] = useState('home');
  const [offline, setOffline] = useState(false);
  const visible = BUTTONS.filter(b => b.roles.includes(r));

  useEffect(() => { api('/health').then(d => setOffline(!d.success)); }, [api]);

  const banner = offline ? (
    <div style={{ background: 'color-mix(in srgb, var(--accent-orange) 12%, transparent)', border: '1px solid var(--accent-orange)',
      borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: '.85rem', color: 'var(--accent-orange)' }}>
      The User Rights service isn’t reachable yet (port 5093). Start <code>backend-userrights</code> and set up the database — actions here won’t save until then.
    </div>
  ) : null;

  if (view === 'onboarding') return <><div style={{ padding: '0 0 0' }}>{banner}</div><OnboardingView onBack={() => setView('home')} /></>;
  if (view === 'assets') return <>{banner}<AssetsView onBack={() => setView('home')} /></>;
  if (view === 'access') return <>{banner}<AccessView onBack={() => setView('home')} /></>;

  return (
    <div>
      {banner}
      <div style={{ marginBottom: 22 }}>
        <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: '.68rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 5 }}>HR · IT · Manager</p>
        <h1 style={{ ...h2, fontSize: '1.6rem' }}>User Rights & Assets</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '.9rem', margin: 0 }}>Onboarding, asset allocation, and application access — each with two levels of approval.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 16 }}>
        {visible.map(b => (
          <div key={b.id} onClick={() => setView(b.id)} style={{ background: b.grad, borderRadius: 14, padding: 22, cursor: 'pointer', color: '#fff',
            minHeight: 130, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 6px 22px rgba(0,0,0,0.28)' }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: '1.15rem' }}>{b.title}</div>
            <div style={{ fontSize: '.84rem', opacity: .85, marginTop: 8 }}>{b.desc}</div>
          </div>
        ))}
        {visible.length === 0 && <Empty text="Your role has no actions here. Sign in as HR, IT, or Manager." />}
      </div>
    </div>
  );
};

export default UserRightsAssets;
