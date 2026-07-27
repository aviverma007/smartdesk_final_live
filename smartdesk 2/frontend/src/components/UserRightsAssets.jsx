import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth, URA_API } from '../context/AuthContext';
import { employeeAPI } from '../services/api';
import * as XLSX from 'xlsx';

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
  pending_hod: { label: 'Pending HOD', color: 'var(--accent-orange)' },
  hod_approved: { label: 'HOD Approved', color: 'var(--accent-sky)' },
  it_given: { label: 'IT Decided', color: 'var(--accent-teal)' },
  completed: { label: 'Completed', color: 'var(--accent-green)' },
  approved: { label: 'Approved', color: 'var(--accent-green)' },
  rejected: { label: 'Rejected', color: '#dc2626' },
  manager_approved: { label: 'Manager Approved', color: 'var(--accent-sky)' },
  offer_accepted: { label: 'Offer Accepted', color: 'var(--accent-sky)' },
  docs_pending: { label: 'Documents Pending', color: 'var(--accent-orange)' },
  docs_complete: { label: 'Documents Complete', color: 'var(--accent-teal)' },
  ready: { label: 'Ready for Handover', color: 'var(--accent-green)' },
  handed_over: { label: 'Handed Over', color: 'var(--text-muted)' },
  dropped: { label: 'Dropped', color: '#dc2626' },
  requisition: { label: '1 · JD', color: 'var(--accent-sky)' },
  jd: { label: '1 · JD & Requirement', color: 'var(--accent-sky)' },
  review_post: { label: '2 · Review & Post', color: 'var(--accent-sky)' },
  cv_shortlist: { label: '3 · CV Shortlist', color: 'var(--accent-teal)' },
  scheduling: { label: '4 · Scheduling', color: 'var(--accent-teal)' },
  interview: { label: '5 · Interview', color: 'var(--accent-orange)' },
  selection: { label: '6 · Selection', color: 'var(--accent-orange)' },
  offer: { label: '7 · Offer', color: 'var(--accent-purple)' },
  acceptance: { label: '8 · Acceptance', color: 'var(--accent-green)' },
  on_hold: { label: 'On Hold', color: 'var(--text-muted)' },
  closed: { label: 'Closed', color: 'var(--text-muted)' },
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
  const { isHr, isIt, isManager, isAdmin, isEmployee, user } = useAuth();
  const me = user?.empId || '';
  const canCreate = isEmployee || isAdmin;       // only the employee fills the form
  const canApprove = isIt || isAdmin;            // IT provisions (given/not) + edits
  const blank = { requestType: 'new', requesterName: '', company: '', department: '', empId: '', email: '', workLocation: '', language: 'EN-English', scopeOfWork: '', applications: [], details: '', hodId: '' };
  const [form, setForm] = useState(blank);
  const [list, setList] = useState([]);
  const [notes, setNotes] = useState({});
  const [viewing, setViewing] = useState(null);
  const [acSearch, setAcSearch] = useState('');
  const [acFilter, setAcFilter] = useState('all'); // all | pending | approved
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState('');
  const [directory, setDirectory] = useState([]);
  const [hodQuery, setHodQuery] = useState('');
  const [showHod, setShowHod] = useState(false);
  useEffect(() => {
    if (!canCreate) return;
    (async () => {
      try {
        const data = await employeeAPI.getAll();
        let onb = [];
        try { const r = await fetch(`${URA_API}/onboarding/directory`); const j = await r.json(); if (j.success) onb = j.records.map(o => ({ id: o.EmpId, name: o.FullName, department: o.Department || '' })); } catch (_) {}
        const ex = new Set(data.map(e => String(e.id)));
        setDirectory([...data, ...onb.filter(o => !ex.has(String(o.id)))]);
      } catch (_) { setDirectory([]); }
    })();
  }, [canCreate]);
  const hodMatches = hodQuery.trim()
    ? directory.filter(e => {
        if (String(e.id) === String(me)) return false; // can't pick yourself as HOD
        const s = hodQuery.trim().toLowerCase();
        return String(e.id).toLowerCase().includes(s) || (e.name || '').toLowerCase().includes(s);
      }).slice(0, 8)
    : [];
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleApp = (a) => setForm(f => ({ ...f, applications: f.applications.includes(a) ? f.applications.filter(x => x !== a) : [...f.applications, a] }));
  const load = useCallback(async () => { const d = await api('/access'); if (d.success) setList(d.records); }, [api]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.hodId.trim()) return setMsg('Enter your HOD’s Employee ID for approval.');
    if (String(form.hodId).trim() === String(me)) return setMsg('You can’t select yourself as your HOD.');
    const d = await api('/access', 'POST', form);
    if (d.success) { setForm(blank); setHodQuery(''); setShowForm(false); setMsg('Request submitted — awaiting HOD approval.'); load(); } else setMsg(d.error || 'Could not submit.');
  };
  const hodDecide = async (id, action) => { const d = await api(`/access/${id}/hod-decide`, 'POST', { action }); setMsg(d.success ? (action === 'reject' ? 'Rejected.' : 'Approved.') : (d.error || 'Failed.')); load(); };
  const itDecide = async (id, given) => { const d = await api(`/access/${id}/it-decide`, 'POST', { given, remarks: notes[id] || '' }); setMsg(d.success ? (given ? 'Marked as given.' : 'Marked as not given.') : (d.error || 'Failed.')); load(); };
  const employeeAccept = async (id, accepted) => { const d = await api(`/access/${id}/employee-accept`, 'POST', { accepted }); setMsg(d.success ? 'Recorded.' : (d.error || 'Failed.')); load(); };
  const [editRights, setEditRights] = useState(null); // request id being edited
  const [rightsDraft, setRightsDraft] = useState([]);
  const startEditRights = (r) => { let a = []; try { a = JSON.parse(r.Applications || '[]'); } catch {} setRightsDraft(a); setEditRights(r.Id); };
  const toggleDraft = (app) => setRightsDraft(d => d.includes(app) ? d.filter(x => x !== app) : [...d, app]);
  const saveRights = async (id) => {
    const d = await api(`/access/${id}/rights`, 'PUT', { applications: rightsDraft });
    setMsg(d.success ? 'Rights updated — sent back to the HOD for re-approval.' : (d.error || 'Failed.')); if (d.success) { setEditRights(null); load(); }
  };

  return (
    <div>
      <BackBar onBack={onBack} title="Application & Rights Allocation" subtitle={canCreate ? 'Fill the form to request application access. IT will review and approve.' : (canApprove ? 'Review requests, add remarks, and approve.' : 'View application & rights requests.')} />

      {canCreate && list.length > 0 && !showForm && (
        <button style={{ ...primaryBtn, marginBottom: 16 }} onClick={() => { setForm(blank); setHodQuery(''); setMsg(''); setShowForm(true); }}>+ New form</button>
      )}

      {canCreate && (list.length === 0 || showForm) && (
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
            <Field l="HOD Employee ID * (approver)">
              <div style={{ position: 'relative' }}>
                <input style={input} placeholder="Search HOD by name or ID…" value={hodQuery}
                  onChange={e => { setHodQuery(e.target.value); set('hodId', e.target.value); setShowHod(true); }}
                  onFocus={() => setShowHod(true)} onBlur={() => setTimeout(() => setShowHod(false), 150)} />
                {showHod && hodMatches.length > 0 && (
                  <div style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, top: 44, background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 9, maxHeight: 240, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
                    {hodMatches.map(e => (
                      <div key={e.id} onMouseDown={() => { set('hodId', String(e.id)); setHodQuery(`${e.name || ''} (${e.id})`); setShowHod(false); }}
                        style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: '.86rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{e.name || '(no name)'}</span>
                        <span style={{ color: 'var(--text-muted)' }}> · {e.id}{e.department ? ` · ${e.department}` : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Field>
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
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={primaryBtn} onClick={create}>Submit request</button>
            {list.length > 0 && <button style={ghostBtn} onClick={() => { setShowForm(false); setMsg(''); }}>Cancel</button>}
          </div>
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
            const done = r.Status === 'completed' || r.Status === 'rejected';
            const matchFilter = acFilter === 'all' || (acFilter === 'approved' ? done : !done);
            return matchSearch && matchFilter;
          });
          if (shown.length === 0) return <Empty text="No matching requests." />;
          return shown.map(r => {
          let apps = []; try { apps = JSON.parse(r.Applications || '[]'); } catch {}
          const isMyRequest = String(r.CreatedBy || '') === me;
          const isMyHodTask = String(r.HodId || '') === me && !isMyRequest;
          return (
            <div key={r.Id} style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{r.RequesterName || r.EmpId || `Request #${r.Id}`} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '.8rem' }}>· {r.RequestType}</span>{isMyHodTask && <span style={{ color: 'var(--accent)', fontSize: '.78rem' }}> · to approve (HOD)</span>}</div>
                  <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>{apps.join(', ') || '—'}{r.HodId ? ` · HOD: ${r.HodId}` : ''}</div>
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
                    <Field l="HOD Employee ID"><input style={input} value={r.HodId || ''} disabled /></Field>
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
              {r.Status === 'it_given' && <div style={{ fontSize: '.82rem', color: r.ItGiven ? 'var(--accent-green)' : '#dc2626', marginTop: 6 }}>IT decision: {r.ItGiven ? 'Given' : 'Not given'}</div>}
              {r.Status === 'completed' && <div style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginTop: 6 }}>Completed — IT: {r.ItGiven ? 'Given' : 'Not given'}, employee {r.EmployeeAccepted ? 'accepted' : 'noted'}.</div>}

              {/* Stage 1 — HOD approves/rejects (cannot give rights) */}
              {(isMyHodTask || isAdmin) && r.Status === 'pending_hod' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button style={primaryBtn} onClick={() => hodDecide(r.Id, 'approve')}>Approve (HOD)</button>
                  <button style={{ ...ghostBtn, color: '#dc2626', borderColor: '#dc2626' }} onClick={() => hodDecide(r.Id, 'reject')}>Reject</button>
                </div>
              )}

              {/* Stage 2 — IT marks given / not given after HOD approval */}
              {canApprove && r.Status === 'hod_approved' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <input placeholder="Remarks (optional)" style={{ ...input, marginBottom: 0, flex: 1, minWidth: 180 }} value={notes[r.Id] || ''} onChange={e => setNotes(s => ({ ...s, [r.Id]: e.target.value }))} />
                  <button style={primaryBtn} onClick={() => itDecide(r.Id, true)}>Given</button>
                  <button style={{ ...ghostBtn, color: '#dc2626', borderColor: '#dc2626' }} onClick={() => itDecide(r.Id, false)}>Not given</button>
                </div>
              )}

              {/* Stage 3 — requester accepts the IT decision */}
              {isMyRequest && r.Status === 'it_given' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button style={primaryBtn} onClick={() => employeeAccept(r.Id, true)}>Accept</button>
                </div>
              )}

              {/* IT can edit the granted applications once HOD-approved */}
              {canApprove && (r.Status === 'hod_approved' || r.Status === 'it_given' || r.Status === 'completed') && editRights !== r.Id && (
                <button style={{ ...ghostBtn, marginTop: 10, padding: '6px 12px', fontSize: '.8rem', alignSelf: 'flex-start' }} onClick={() => startEditRights(r)}>Edit rights</button>
              )}
              {canApprove && editRights === r.Id && (
                <div style={{ marginTop: 10 }}>
                  <div style={label}>Edit granted applications</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                    {APPLICATIONS.map(a => (
                      <label key={a} style={chip(rightsDraft.includes(a))}>
                        <input type="checkbox" checked={rightsDraft.includes(a)} onChange={() => toggleDraft(a)} style={{ marginRight: 7 }} />{a}
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button style={primaryBtn} onClick={() => saveRights(r.Id)}>Save rights</button>
                    <button style={ghostBtn} onClick={() => setEditRights(null)}>Cancel</button>
                  </div>
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
          fontSize: '.82rem', fontFamily: "'DM Sans',sans-serif", display: 'inline-flex', alignItems: 'center', gap: 7,
          border: `1px solid ${filter === o.key ? 'var(--accent)' : 'var(--border)'}`,
          background: filter === o.key ? 'var(--accent)' : 'transparent',
          color: filter === o.key ? '#fff' : 'var(--text-primary)' }}>
          {o.label}
          {o.count != null && <span style={{ fontSize: '.72rem', fontWeight: 700, lineHeight: 1, padding: '2px 7px', borderRadius: 10,
            background: filter === o.key ? 'rgba(255,255,255,0.25)' : 'color-mix(in srgb, var(--accent) 15%, transparent)',
            color: filter === o.key ? '#fff' : 'var(--accent)' }}>{o.count}</span>}
        </button>
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

/* ═══════════════════ EMPLOYEE OVERVIEW + EXCEL EXPORT (HR/IT) ═══════════════ */
const OverviewView = ({ onBack }) => {
  const api = useApi();
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState('combined'); // combined | assets | rights
  const [selected, setSelected] = useState(new Set());
  const [msg, setMsg] = useState('');

  useEffect(() => { (async () => { const d = await api('/employees-summary'); if (d.success) setRecords(d.records); else setMsg(d.error || 'Could not load.'); })(); }, [api]);

  const filtered = records.filter(r => {
    const s = search.trim().toLowerCase();
    return !s || String(r.empId).toLowerCase().includes(s) || (r.name || '').toLowerCase().includes(s);
  });
  const toggleSel = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allFilteredSelected = filtered.length > 0 && filtered.every(r => selected.has(r.empId));
  const toggleAll = () => setSelected(s => {
    const n = new Set(s);
    if (allFilteredSelected) filtered.forEach(r => n.delete(r.empId)); else filtered.forEach(r => n.add(r.empId));
    return n;
  });

  const exportRows = (rows, filename) => {
    if (rows.length === 0) { setMsg('Nothing to export.'); return; }
    const data = rows.map(r => ({
      'User ID': r.empId, 'Name': r.name, 'Email': r.email, 'Department': r.department, 'Designation': r.designation,
      'Manager': r.manager, 'Joining Date': r.joiningDate, 'Phone': r.phone, 'Gender': r.gender, 'Company': r.company,
      'Location': r.location, 'Assets': r.assets.join(', '), 'Application Rights': r.rights.join(', '),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [12, 22, 26, 18, 18, 18, 14, 16, 10, 18, 16, 40, 40].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, filename);
  };
  const selRows = records.filter(r => selected.has(r.empId));

  const th = { textAlign: 'left', padding: '10px 12px', fontSize: '.76rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' };
  const td = { padding: '10px 12px', fontSize: '.86rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', verticalAlign: 'top' };

  return (
    <div>
      <BackBar onBack={onBack} title="Employee Overview" subtitle="Search employees, review their assets and application rights, and export to Excel." />
      <div style={card}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <input placeholder="Search by User ID or name…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...input, marginBottom: 0, maxWidth: 300 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ k: 'combined', l: 'Combined' }, { k: 'assets', l: 'View all assets' }, { k: 'rights', l: 'Application rights' }].map(o => (
              <button key={o.k} onClick={() => setMode(o.k)} style={{ padding: '7px 14px', borderRadius: 20, cursor: 'pointer', fontSize: '.82rem',
                border: `1px solid ${mode === o.k ? 'var(--accent)' : 'var(--border)'}`, background: mode === o.k ? 'var(--accent)' : 'transparent', color: mode === o.k ? '#fff' : 'var(--text-primary)' }}>{o.l}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <button style={primaryBtn} onClick={() => exportRows(records, 'employees_all.xlsx')}>Download all</button>
          <button style={ghostBtn} onClick={() => exportRows(filtered, 'employees_filtered.xlsx')}>Download filtered</button>
          <button style={ghostBtn} onClick={() => exportRows(selRows, 'employees_selected.xlsx')}>Download selected ({selected.size})</button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 36 }}><input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} /></th>
                <th style={th}>User ID</th>
                <th style={th}>Name</th>
                <th style={th}>Email</th>
                <th style={th}>Department</th>
                <th style={th}>Designation</th>
                <th style={th}>Manager</th>
                <th style={th}>Joining Date</th>
                <th style={th}>Phone</th>
                {mode !== 'rights' && <th style={th}>Assets</th>}
                {mode !== 'assets' && <th style={th}>Application Rights</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td style={td} colSpan={11}><Empty text="No matching employees." /></td></tr>}
              {filtered.map(r => (
                <tr key={r.empId}>
                  <td style={td}><input type="checkbox" checked={selected.has(r.empId)} onChange={() => toggleSel(r.empId)} /></td>
                  <td style={{ ...td, fontWeight: 700 }}>{r.empId}</td>
                  <td style={td}>{r.name || '—'}</td>
                  <td style={td}>{r.email || '—'}</td>
                  <td style={td}>{r.department || '—'}</td>
                  <td style={td}>{r.designation || '—'}</td>
                  <td style={td}>{r.manager || '—'}</td>
                  <td style={td}>{r.joiningDate || '—'}</td>
                  <td style={td}>{r.phone || '—'}</td>
                  {mode !== 'rights' && <td style={td}>{r.assets.join(', ') || '—'}</td>}
                  {mode !== 'assets' && <td style={td}>{r.rights.join(', ') || '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {msg && <p style={{ fontSize: '.84rem', color: 'var(--text-muted)', marginTop: 10 }}>{msg}</p>}
      </div>
    </div>
  );
};

/* ═══════════════════ ADMIN APPROVAL / RIGHTS MATRIX (admin only) ════════════ */
const RIGHT_MODULES = [
  { key: 'onboarding', label: 'Onboarding', caps: ['view', 'approve', 'edit'] },
  { key: 'assets', label: 'Asset Management', caps: ['view', 'approve', 'edit'] },
  { key: 'access', label: 'Application & Rights', caps: ['view', 'approve', 'edit'] },
  { key: 'overview', label: 'Employee Overview', caps: ['view', 'edit'] },
  { key: 'directory', label: 'Employee Directory', caps: ['view', 'add', 'delete'] },
  { key: 'matrix', label: 'Rights Matrix', caps: ['view', 'edit'] },
];
const CAP_LABEL = { view: 'View', approve: 'Approve', edit: 'Edit', add: 'Add', delete: 'Delete' };
// Predefined profiles — selecting one pre-fills the grid; extra rights are then toggled per box.
const PROFILES = {
  HR: { onboarding: ['view', 'approve', 'edit'], assets: ['view', 'edit'], overview: ['view'], directory: ['view', 'add', 'delete'] },
  IT: { assets: ['view', 'approve', 'edit'], access: ['view', 'approve', 'edit'], overview: ['view'] },
  HOD: { access: ['view', 'approve'] },
  USER: { assets: ['view'], access: ['view'] },
};
const emptyModules = () => RIGHT_MODULES.reduce((o, m) => { o[m.key] = {}; m.caps.forEach(c => o[m.key][c] = false); return o; }, {});
const applyProfile = (name) => {
  const mods = emptyModules();
  const preset = PROFILES[name] || {};
  Object.entries(preset).forEach(([mod, caps]) => caps.forEach(c => { if (mods[mod]) mods[mod][c] = true; }));
  return mods;
};
const summariseRights = (mods) => {
  const parts = [];
  RIGHT_MODULES.forEach(m => {
    const on = (m.caps || []).filter(c => mods?.[m.key]?.[c]);
    if (on.length) parts.push(`${m.label} (${on.map(c => CAP_LABEL[c]).join('/')})`);
  });
  return parts.join('  ·  ');
};

const MatrixView = ({ onBack }) => {
  const api = useApi();
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ empId: '', name: '', profile: 'CUSTOM', modules: emptyModules() });
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => { const d = await api('/rights-matrix'); if (d.success) setRecords(d.records); else setMsg(d.error || 'Could not load.'); }, [api]);
  useEffect(() => { load(); }, [load]);

  const parseMods = (r) => { try { return { ...emptyModules(), ...JSON.parse(r || '{}') }; } catch { return emptyModules(); } };
  const startEdit = (rec) => {
    if (rec) setDraft({ empId: rec.EmpId, name: rec.Name || '', profile: rec.Profile || 'CUSTOM', modules: parseMods(rec.Rights) });
    else setDraft({ empId: '', name: '', profile: 'CUSTOM', modules: emptyModules() });
    setEditing(rec ? rec.EmpId : '__new'); setMsg('');
  };
  const pickProfile = (name) => setDraft(d => ({ ...d, profile: name, modules: name === 'CUSTOM' ? d.modules : applyProfile(name) }));
  const toggleCap = (mod, cap) => setDraft(d => ({ ...d, profile: 'CUSTOM', modules: { ...d.modules, [mod]: { ...d.modules[mod], [cap]: !d.modules[mod]?.[cap] } } }));
  const save = async () => {
    if (!draft.empId.trim()) return setMsg('Employee ID is required.');
    const d = await api(`/rights-matrix/${encodeURIComponent(draft.empId.trim())}`, 'PUT', { name: draft.name, profile: draft.profile, modules: draft.modules });
    setMsg(d.success ? 'Saved.' : (d.error || 'Failed.')); if (d.success) { setEditing(null); load(); }
  };
  const download = () => {
    const data = records.map(r => {
      const mods = parseMods(r.Rights); const row = { 'User ID': r.EmpId, 'Name': r.Name || '', 'Profile': r.Profile || 'CUSTOM' };
      RIGHT_MODULES.forEach(m => { row[m.label] = (m.caps || []).filter(c => mods?.[m.key]?.[c]).map(c => CAP_LABEL[c]).join(' / ') || '—'; });
      return row;
    });
    if (data.length === 0) { setMsg('Nothing to export.'); return; }
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rights Matrix'); XLSX.writeFile(wb, 'rights_matrix.xlsx');
  };
  const filtered = records.filter(r => { const s = search.trim().toLowerCase(); return !s || String(r.EmpId).toLowerCase().includes(s) || (r.Name || '').toLowerCase().includes(s); });
  const profileColor = { HR: 'var(--accent)', IT: 'var(--accent-teal)', HOD: 'var(--accent-orange)', USER: 'var(--accent-green)', CUSTOM: 'var(--text-muted)' };

  return (
    <div>
      <BackBar onBack={onBack} title="Approval & Rights Matrix" subtitle="Admin-only. Assign a profile (HR / HOD / IT / User) or tick exactly which buttons a person can view, approve or edit." />
      <div style={card}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <input placeholder="Search by User ID or name…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...input, marginBottom: 0, maxWidth: 280 }} />
          <button style={primaryBtn} onClick={() => startEdit(null)}>+ Assign rights</button>
          <button style={ghostBtn} onClick={download}>Download Excel</button>
        </div>

        {editing && (
          <div style={{ padding: 16, borderRadius: 10, background: 'var(--bg-base)', border: '1px solid var(--border)', marginBottom: 16 }}>
            <h2 style={h2}>{editing === '__new' ? 'Assign rights' : `Edit rights — ${draft.empId}`}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 10 }}>
              <Field l="Employee ID *"><input style={input} value={draft.empId} disabled={editing !== '__new'} onChange={e => setDraft(d => ({ ...d, empId: e.target.value }))} /></Field>
              <Field l="Name"><input style={input} value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} /></Field>
            </div>
            <div style={label}>Profile (pre-fills the rights below)</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {['HR', 'IT', 'HOD', 'USER', 'CUSTOM'].map(pf => (
                <button key={pf} onClick={() => pickProfile(pf)} style={{ padding: '7px 16px', borderRadius: 20, cursor: 'pointer', fontSize: '.82rem', fontWeight: 700,
                  border: `1px solid ${draft.profile === pf ? 'var(--accent)' : 'var(--border)'}`, background: draft.profile === pf ? 'var(--accent)' : 'transparent', color: draft.profile === pf ? '#fff' : 'var(--text-primary)' }}>{pf}</button>
              ))}
            </div>
            <div style={label}>Rights per button (tick extra rights to customise)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {RIGHT_MODULES.map(m => (
                <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, fontWeight: 600, color: 'var(--text-primary)', fontSize: '.88rem' }}>{m.label}</div>
                  {m.caps.map(c => (
                    <label key={c} style={{ fontSize: '.82rem', color: 'var(--text-muted)', minWidth: 78 }}>
                      <input type="checkbox" checked={!!draft.modules[m.key]?.[c]} onChange={() => toggleCap(m.key, c)} style={{ marginRight: 6 }} />{CAP_LABEL[c]}
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={primaryBtn} onClick={save}>Save</button>
              <button style={ghostBtn} onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        )}

        {filtered.length === 0 && <Empty text="No rights assigned yet." />}
        {filtered.map(r => {
          const mods = parseMods(r.Rights);
          return (
            <div key={r.EmpId} style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{r.EmpId}{r.Name ? ` · ${r.Name}` : ''}
                    <span style={{ marginLeft: 8, fontSize: '.72rem', fontWeight: 700, padding: '2px 9px', borderRadius: 12, color: '#fff', background: profileColor[r.Profile] || 'var(--text-muted)' }}>{r.Profile || 'CUSTOM'}</span>
                  </div>
                  <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: 3 }}>{summariseRights(mods) || 'No rights granted'}</div>
                </div>
                <button style={{ ...ghostBtn, padding: '6px 12px', fontSize: '.8rem' }} onClick={() => startEdit(r)}>Change</button>
              </div>
            </div>
          );
        })}
        {msg && <p style={{ fontSize: '.84rem', color: 'var(--text-muted)', marginTop: 10 }}>{msg}</p>}
      </div>
    </div>
  );
};

/* ═══════════════ DIRECTORY MANAGEMENT + AUDIT LOG (admin) ═══════════════════ */
const DirectoryView = ({ onBack }) => {
  const api = useApi();
  const [list, setList] = useState([]);
  const [log, setLog] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const [draft, setDraft] = useState({ empId: '', name: '', department: '', designation: '', email: '' });
  const [showAdd, setShowAdd] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const d = await api('/directory'); if (d.success) setList(d.records);
    const l = await api('/directory/log'); if (l.success) setLog(l.records);
  }, [api]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!draft.empId.trim()) return setMsg('Employee ID is required.');
    const d = await api('/directory', 'POST', draft);
    setMsg(d.success ? 'Employee added to the directory.' : (d.error || 'Failed.'));
    if (d.success) { setDraft({ empId: '', name: '', department: '', designation: '', email: '' }); setShowAdd(false); load(); }
  };
  const remove = async (empId) => {
    const d = await api(`/directory/${encodeURIComponent(empId)}`, 'DELETE');
    setMsg(d.success ? 'Employee removed (kept in the log).' : (d.error || 'Failed.')); if (d.success) load();
  };

  const active = list.filter(r => r.Status === 'active');
  const deleted = list.filter(r => r.Status === 'deleted');
  const fmt = (d) => d ? new Date(d).toLocaleString() : '';

  return (
    <div>
      <BackBar onBack={onBack} title="Directory Management" subtitle="Admin-only. Add or remove employees from the directory — every change is logged." />
      <div style={card}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <button style={primaryBtn} onClick={() => { setShowAdd(s => !s); setMsg(''); }}>{showAdd ? 'Close' : '+ Add employee'}</button>
          <button style={ghostBtn} onClick={() => setShowLog(s => !s)}>{showLog ? 'Hide user log' : 'User log'}</button>
        </div>

        {showAdd && (
          <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg-base)', border: '1px solid var(--border)', marginBottom: 16 }}>
            <h2 style={h2}>Add employee</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 10 }}>
              <Field l="Employee ID *"><input style={input} value={draft.empId} onChange={e => setDraft(d => ({ ...d, empId: e.target.value }))} /></Field>
              <Field l="Name"><input style={input} value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} /></Field>
              <Field l="Department"><input style={input} value={draft.department} onChange={e => setDraft(d => ({ ...d, department: e.target.value }))} /></Field>
              <Field l="Designation"><input style={input} value={draft.designation} onChange={e => setDraft(d => ({ ...d, designation: e.target.value }))} /></Field>
              <Field l="Email"><input style={input} value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} /></Field>
            </div>
            <button style={primaryBtn} onClick={add}>Add to directory</button>
          </div>
        )}

        {showLog && (
          <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg-base)', border: '1px solid var(--border)', marginBottom: 16 }}>
            <h2 style={h2}>User log</h2>
            {log.length === 0 && <Empty text="No directory changes yet." />}
            {log.map(e => (
              <div key={e.Id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: '.84rem' }}>
                <span style={{ fontWeight: 700, color: e.Action === 'delete' ? '#dc2626' : 'var(--accent-green)', minWidth: 64, textTransform: 'capitalize' }}>{e.Action}</span>
                <span style={{ flex: 1, color: 'var(--text-primary)' }}>{e.Name || ''} <span style={{ color: 'var(--text-muted)' }}>· {e.EmpId}</span></span>
                <span style={{ color: 'var(--text-muted)' }}>by {e.ActedBy || '—'} · {fmt(e.ActedAt)}</span>
              </div>
            ))}
          </div>
        )}

        <h2 style={h2}>Current employees ({active.length})</h2>
        {active.length === 0 && <Empty text="No employees added through this screen yet." />}
        {active.map(r => (
          <div key={r.EmpId} style={rowStyle}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{r.Name || '(no name)'} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '.8rem' }}>· {r.EmpId}</span></div>
              <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>{[r.Department, r.Designation, r.Email].filter(Boolean).join(' · ') || '—'}</div>
            </div>
            <button style={{ ...ghostBtn, color: '#dc2626', borderColor: '#dc2626', padding: '6px 12px', fontSize: '.8rem' }} onClick={() => remove(r.EmpId)}>Delete</button>
          </div>
        ))}

        {deleted.length > 0 && (
          <>
            <h2 style={{ ...h2, marginTop: 18 }}>Deleted employees ({deleted.length})</h2>
            {deleted.map(r => (
              <div key={r.EmpId} style={{ ...rowStyle, opacity: 0.7 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'line-through' }}>{r.Name || '(no name)'} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '.8rem' }}>· {r.EmpId}</span></div>
                  <div style={{ fontSize: '.78rem', color: '#dc2626' }}>Deleted by {r.DeletedBy || '—'} · {fmt(r.DeletedAt)}</div>
                </div>
              </div>
            ))}
          </>
        )}
        {msg && <p style={{ fontSize: '.84rem', color: 'var(--text-muted)', marginTop: 10 }}>{msg}</p>}
      </div>
    </div>
  );
};

/* ═══════════════════════ HR PRE-ONBOARDING ═════════════════════════════════ */
const PRE_DOCS = [
  { key: 'idProof', label: 'ID proof' },
  { key: 'addressProof', label: 'Address proof' },
  { key: 'education', label: 'Education certificates' },
  { key: 'relieving', label: 'Relieving / experience letter' },
  { key: 'bank', label: 'Bank details' },
  { key: 'photo', label: 'Photograph' },
];
const PRE_STATUS = {
  offer_accepted: { label: 'Offer Accepted', color: 'var(--accent-sky)' },
  docs_pending: { label: 'Documents Pending', color: 'var(--accent-orange)' },
  docs_complete: { label: 'Documents Complete', color: 'var(--accent-teal)' },
  ready: { label: 'Ready for Handover', color: 'var(--accent-green)' },
  handed_over: { label: 'Handed Over', color: 'var(--text-muted)' },
  dropped: { label: 'Dropped', color: '#dc2626' },
};

const PreOnboardingView = ({ onBack }) => {
  const api = useApi();
  const [list, setList] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('active'); // active | ready | handed_over | all
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [msg, setMsg] = useState('');
  const blank = { candidateName: '', role: '', grade: '', department: '', hiringManager: '', phone: '', email: '', mrfRef: '', joiningDate: '' };
  const [form, setForm] = useState(blank);
  const [staged, setStaged] = useState([]);   // candidates parsed from an upload, pending review
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => { const d = await api('/preonboarding'); if (d.success) setList(d.records); }, [api]);
  useEffect(() => { load(); }, [load]);

  // ── Bulk uploader ──────────────────────────────────────────────
  const TEMPLATE_COLS = ['Candidate Name', 'Role', 'Grade', 'Department', 'Hiring Manager', 'Phone', 'Email', 'MRF Reference', 'Joining Date (YYYY-MM-DD)'];
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      TEMPLATE_COLS,
      ['Asha Rao', 'Sales Executive', 'M2', 'Sales', 'R. Mehta', '9876543210', 'asha@example.com', 'MRF-2026-014', '2026-08-18'],
    ]);
    ws['!cols'] = TEMPLATE_COLS.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Candidates');
    XLSX.writeFile(wb, 'preonboarding_candidates_template.xlsx');
  };
  const toISO = (v) => {
    if (!v) return '';
    if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
    const d = new Date(v);
    return isNaN(d) ? String(v) : d.toISOString().slice(0, 10);
  };
  const pick = (row, ...keys) => { for (const k of keys) { if (row[k] !== undefined && String(row[k]).trim() !== '') return String(row[k]).trim(); } return ''; };
  const cleanName = (s) => String(s).replace(/^[=+\-@]+/, '').trim(); // neutralise CSV formula injection
  const validRow = (c, i, all) => {
    const errs = [];
    if (c.joiningDate && !/^\d{4}-\d{2}-\d{2}$/.test(c.joiningDate)) errs.push('joining date not YYYY-MM-DD');
    if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) errs.push('email looks invalid');
    const dupExisting = list.some(r => (r.CandidateName || '').trim().toLowerCase() === c.candidateName.toLowerCase() && !['dropped'].includes(r.Status));
    const dupInBatch = all.findIndex(x => x.candidateName.toLowerCase() === c.candidateName.toLowerCase()) !== i;
    if (dupExisting) errs.push('already in the list');
    else if (dupInBatch) errs.push('duplicate in this file');
    return errs;
  };
  const onUploadFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        let rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        // trim/normalise header keys so " Candidate Name " still matches
        rows = rows.map(r => { const o = {}; Object.keys(r).forEach(k => { o[String(k).trim()] = r[k]; }); return o; });
        const mapped = rows.map(r => ({
          candidateName: cleanName(pick(r, 'Candidate Name', 'Candidate name', 'Name')),
          role: pick(r, 'Role', 'Designation'),
          grade: pick(r, 'Grade', 'Band'),
          department: pick(r, 'Department', 'Dept'),
          hiringManager: pick(r, 'Hiring Manager', 'Manager'),
          phone: pick(r, 'Phone', 'Mobile', 'Contact'),
          email: pick(r, 'Email', 'Email ID'),
          mrfRef: pick(r, 'MRF Reference', 'MRF Ref', 'MRF'),
          joiningDate: toISO(r['Joining Date (YYYY-MM-DD)'] || r['Joining Date'] || r['Joining'] || ''),
        })).filter(x => x.candidateName);
        if (!mapped.length) { window.alert('No valid rows found. Make sure the first row has the column headers from the template (e.g. "Candidate Name") and that names are filled in.'); return; }
        const withErrs = mapped.map((c, i, all) => ({ ...c, _errs: validRow(c, i, all) }));
        setStaged(withErrs);
        setShowForm(false);
        const bad = withErrs.filter(c => c._errs.length).length;
        window.alert(`${withErrs.length} candidate(s) read from the file.` + (bad ? `\n\n${bad} row(s) have warnings — shown in red below. Fix them in the file and re-upload, or delete them before saving.` : '\n\nReview the list below and remove any wrong entries, then click "Save".'));
      } catch (err) {
        window.alert('Could not read that file. Please upload the .xlsx template (or a .csv with the same column headers).');
      }
    };
    reader.readAsArrayBuffer(file);
  };
  const removeStaged = (i) => setStaged(s => s.filter((_, idx) => idx !== i));
  const saveStaged = async () => {
    if (!staged.length) return;
    const blocked = staged.filter(c => c._errs && c._errs.length);
    if (blocked.length) {
      const ok = window.confirm(`${blocked.length} row(s) still have warnings and will be SKIPPED. Save the ${staged.length - blocked.length} clean row(s) anyway?`);
      if (!ok) return;
    }
    const toSave = staged.filter(c => !(c._errs && c._errs.length));
    if (!toSave.length) { window.alert('Nothing to save — every row has a warning. Delete or fix them first.'); return; }
    setSaving(true);
    let okc = 0; const failed = [];
    for (const c of toSave) {
      const { _errs, ...payload } = c;
      try { const d = await api('/preonboarding', 'POST', payload); if (d.success) okc++; else failed.push(`${c.candidateName}: ${d.error || 'failed'}`); }
      catch { failed.push(`${c.candidateName}: request failed`); }
    }
    setSaving(false);
    setStaged([]);
    load();
    window.alert(`Added ${okc} candidate(s).` + (failed.length ? `\n\nCould not add ${failed.length}:\n\u2022 ${failed.join('\n\u2022 ')}` : ''));
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const create = async () => {
    if (!form.candidateName.trim()) return setMsg('Candidate name is required.');
    const d = await api('/preonboarding', 'POST', form);
    if (d.success) { setForm(blank); setShowForm(false); setMsg('Candidate added.'); load(); } else setMsg(d.error || 'Failed.');
  };

  const docsOf = (r) => { try { return JSON.parse(r.Documents || '[]'); } catch { return PRE_DOCS.map(d => ({ ...d, received: false })); } };
  const dispStatus = (r) => {
    if (['ready', 'handed_over', 'dropped'].includes(r.Status)) return r.Status;
    const d = docsOf(r);
    if (d.length && d.every(x => x.received)) return 'docs_complete';
    if (d.some(x => x.received) || r.OfferAcceptedDate) return 'docs_pending';
    return 'offer_accepted';
  };
  const daysToJoin = (r) => r.JoiningDate ? Math.ceil((new Date(r.JoiningDate) - new Date()) / 86400000) : null;
  const deadlineDays = (r) => r.JoiningDate ? Math.ceil((new Date(r.JoiningDate) - new Date()) / 86400000) - 7 : null;

  const fmt = (d) => d ? new Date(d).toISOString().slice(0, 10) : '';
  const filtered = list.filter(r => {
    const s = search.trim().toLowerCase();
    const ms = !s || (r.CandidateName || '').toLowerCase().includes(s) || (r.AssignedEmpId || '').toLowerCase().includes(s) || (r.Department || '').toLowerCase().includes(s);
    const mf = filter === 'all' || (filter === 'active' ? !['ready', 'handed_over', 'dropped'].includes(r.Status) : r.Status === filter);
    return ms && mf;
  });

  return (
    <div>
      <BackBar onBack={onBack} title="Pre-Onboarding" subtitle="Prepare each accepted candidate before day one: acceptance, documents, ID, and handover." />

      {!showForm && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <button style={primaryBtn} onClick={() => { setForm(blank); setMsg(''); setShowForm(true); }}>+ New candidate</button>
          <button style={ghostBtn} onClick={downloadTemplate}>Download uploader template</button>
          <label style={{ ...ghostBtn, cursor: 'pointer', marginBottom: 0 }}>
            Upload candidates
            <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
              onChange={e => { onUploadFile(e.target.files[0]); e.target.value = ''; }} />
          </label>
        </div>
      )}

      {staged.length > 0 && (
        <div style={{ ...card, border: '1px solid var(--accent)' }}>
          <h2 style={h2}>Review upload — {staged.length} candidate(s)</h2>
          <p style={{ fontSize: '.84rem', color: 'var(--text-muted)', marginTop: -4, marginBottom: 12 }}>Check the rows below. Remove anything uploaded by mistake, then save the rest.</p>
          {staged.map((c, i) => (
            <div key={i} style={{ ...rowStyle, ...(c._errs && c._errs.length ? { border: '1px solid #dc2626', borderRadius: 8 } : {}) }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.candidateName}</div>
                <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>{[c.role, c.department, c.joiningDate ? `joins ${c.joiningDate}` : '', c.email].filter(Boolean).join(' · ') || '—'}</div>
                {c._errs && c._errs.length > 0 && <div style={{ fontSize: '.78rem', color: '#dc2626', marginTop: 3 }}>⚠ {c._errs.join(' · ')}</div>}
              </div>
              <button style={{ ...ghostBtn, color: '#dc2626', borderColor: '#dc2626', padding: '6px 12px', fontSize: '.8rem' }} onClick={() => removeStaged(i)}>Delete</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button style={primaryBtn} disabled={saving} onClick={saveStaged}>{saving ? 'Saving…' : `Save ${staged.length} candidate(s)`}</button>
            <button style={ghostBtn} disabled={saving} onClick={() => setStaged([])}>Discard upload</button>
          </div>
        </div>
      )}
      {showForm && (
        <div style={card}>
          <h2 style={h2}>New candidate</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 8 }}>
            <Field l="Candidate name *"><input style={input} value={form.candidateName} onChange={e => set('candidateName', e.target.value)} /></Field>
            <Field l="Role"><input style={input} value={form.role} onChange={e => set('role', e.target.value)} /></Field>
            <Field l="Grade / band"><input style={input} value={form.grade} onChange={e => set('grade', e.target.value)} /></Field>
            <Field l="Department"><input style={input} value={form.department} onChange={e => set('department', e.target.value)} /></Field>
            <Field l="Hiring manager"><input style={input} value={form.hiringManager} onChange={e => set('hiringManager', e.target.value)} /></Field>
            <Field l="MRF reference"><input style={input} value={form.mrfRef} onChange={e => set('mrfRef', e.target.value)} /></Field>
            <Field l="Phone"><input style={input} value={form.phone} onChange={e => set('phone', e.target.value)} /></Field>
            <Field l="Email"><input style={input} value={form.email} onChange={e => set('email', e.target.value)} /></Field>
            <Field l="Offered joining date"><input type="date" style={input} value={form.joiningDate} onChange={e => set('joiningDate', e.target.value)} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={primaryBtn} onClick={create}>Add candidate</button>
            <button style={ghostBtn} onClick={() => { setShowForm(false); setMsg(''); }}>Cancel</button>
          </div>
          {msg && <span style={{ marginLeft: 12, fontSize: '.84rem', color: 'var(--text-muted)' }}>{msg}</span>}
        </div>
      )}

      <div style={card}>
        <h2 style={h2}>Candidates</h2>
        <FilterBar search={search} setSearch={setSearch} filter={filter} setFilter={setFilter}
          placeholder="Search by name, ID or department…"
          options={[
            { key: 'active', label: 'Active', count: list.filter(x => !['ready', 'handed_over', 'dropped'].includes(x.Status)).length },
            { key: 'ready', label: 'Ready', count: list.filter(x => x.Status === 'ready').length },
            { key: 'handed_over', label: 'Handed over', count: list.filter(x => x.Status === 'handed_over').length },
            { key: 'all', label: 'All', count: list.length },
          ]} />
        {filtered.length === 0 && <Empty text="No candidates." />}
        {filtered.map(r => {
          const dd = deadlineDays(r);
          const late = dd !== null && dd < 0 && !docsOf(r).every(d => d.received) && !['handed_over', 'dropped'].includes(r.Status);
          const soon = dd !== null && dd >= 0 && dd <= 3 && !docsOf(r).every(d => d.received);
          return (
            <div key={r.Id} style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{r.CandidateName}</div>
                  <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>{[r.Role, r.Department].filter(Boolean).join(' · ') || '—'}{r.JoiningDate ? ` · joins ${fmt(r.JoiningDate)}` : ''}</div>
                </div>
                {r.DeleteRequested && <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#fff', background: '#dc2626', borderRadius: 12, padding: '2px 9px' }}>Delete requested</span>}
                {late && <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#fff', background: '#dc2626', borderRadius: 12, padding: '2px 9px' }}>Docs overdue</span>}
                {!late && soon && <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#fff', background: 'var(--accent-orange)', borderRadius: 12, padding: '2px 9px' }}>Docs due in {dd}d</span>}
                <Pill status={dispStatus(r)} />
                <button style={{ ...ghostBtn, padding: '6px 12px', fontSize: '.8rem' }} onClick={() => setOpenId(openId === r.Id ? null : r.Id)}>{openId === r.Id ? 'Close' : 'Manage'}</button>
              </div>
              {openId === r.Id && <PreOnboardingDetail record={r} api={api} reload={load} onClose={() => setOpenId(null)} />}
            </div>
          );
        })}
        {msg && !showForm && <p style={{ fontSize: '.84rem', color: 'var(--text-muted)', marginTop: 10 }}>{msg}</p>}
      </div>
    </div>
  );
};

const PreOnboardingDetail = ({ record, api, reload, onClose }) => {
  const { isAdmin, user } = useAuth();
  const [r, setR] = useState(record);
  const [msg, setMsg] = useState('');
  useEffect(() => { setR(record); }, [record]);
  const docs = (() => { try { return JSON.parse(r.Documents || '[]'); } catch { return PRE_DOCS.map(d => ({ ...d, received: false })); } })();
  const allDocs = docs.every(d => d.received);

  // View an uploaded file: fetch WITH the role header (a plain link fails the role check), then open it.
  const viewFile = async (key) => {
    try {
      const res = await fetch(`${URA_API}/preonboarding/${r.Id}/file/${key}`, {
        headers: { 'x-user-role': user?.role || '', 'x-user-id': user?.empId || '' },
      });
      if (!res.ok) { window.alert('Could not open the document (' + res.status + ').'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { window.alert('Could not reach the server to open the document.'); }
  };
  const deleteFile = async (key, label) => {
    if (!window.confirm(`Remove the uploaded file for "${label}"? The item will be un-ticked so you can upload the correct file.`)) return;
    const d = await api(`/preonboarding/${r.Id}/file/${key}`, 'DELETE');
    if (d.success) { const fresh = await api('/preonboarding'); if (fresh.success) { const u = fresh.records.find(x => x.Id === r.Id); if (u) setR(u); } reload(); setMsg('File removed.'); }
    else window.alert(d.error || 'Could not delete the file.');
  };

  const save = async (patch) => {
    const d = await api(`/preonboarding/${r.Id}`, 'PUT', patch);
    if (d.success) { const nx = { ...r, ...toRow(patch) }; setR(nx); setMsg('Saved.'); reload(); }
    else setMsg(d.error || 'Failed.');
  };
  const toRow = (patch) => {
    const m = { offerAcceptedDate: 'OfferAcceptedDate', resignationAcceptedDate: 'ResignationAcceptedDate', joiningDate: 'JoiningDate', status: 'Status', notes: 'Notes', documents: 'Documents', droppedReason: 'DroppedReason' };
    const o = {}; Object.entries(patch).forEach(([k, v]) => { if (m[k]) o[m[k]] = k === 'documents' ? JSON.stringify(v) : v; }); return o;
  };
  const toggleDoc = (key) => { const nd = docs.map(d => d.key === key ? { ...d, received: !d.received } : d); save({ documents: nd }); };

  // Delete request (HR) -> admin approval
  const requestDelete = async () => {
    const why = window.prompt('Delete this entry? A reason will be sent to Admin for approval:');
    if (why === null) return;
    const d = await api(`/preonboarding/${r.Id}/request-delete`, 'POST', { reason: why });
    if (d.success) { window.alert('Deletion requested \u2014 pending Admin approval.'); reload(); onClose && onClose(); }
    else window.alert(d.error || 'Failed.');
  };
  const approveDelete = async () => {
    if (!window.confirm('Approve deletion? This permanently removes the entry.')) return;
    const d = await api(`/preonboarding/${r.Id}/approve-delete`, 'POST', {});
    if (d.success) { window.alert('Entry deleted.'); reload(); onClose && onClose(); }
    else window.alert(d.error || 'Failed.');
  };
  const rejectDelete = async () => {
    const d = await api(`/preonboarding/${r.Id}/reject-delete`, 'POST', {});
    if (d.success) { window.alert('Deletion request rejected.'); reload(); onClose && onClose(); }
    else window.alert(d.error || 'Failed.');
  };

  const markReady = async () => {
    const missing = [];
    if (!r.OfferAcceptedDate) missing.push('Offer acceptance date');
    if (!r.ResignationAcceptedDate) missing.push('Resignation acceptance date');
    if (!r.JoiningDate) missing.push('Confirmed joining date');
    if (!allDocs) missing.push('All documents received');
    if (missing.length) {
      window.alert('Cannot mark Ready for handover yet.\n\nStill pending:\n\u2022 ' + missing.join('\n\u2022 '));
      return;
    }
    const d = await api(`/preonboarding/${r.Id}`, 'PUT', { status: 'ready' });
    if (d.success) {
      window.alert('Marked ready \u2014 moved to \u201cReady for Handover\u201d.');
      reload();
      onClose && onClose();
    } else window.alert(d.error || 'Failed.');
  };
  const upload = async (key, file) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const d = await api(`/preonboarding/${r.Id}/upload`, 'POST', { key, fileName: file.name, dataBase64: reader.result });
      if (d.success) { setMsg('Uploaded.'); reload(); const fresh = await api('/preonboarding'); if (fresh.success) { const u = fresh.records.find(x => x.Id === r.Id); if (u) setR(u); } }
      else setMsg(d.error || 'Upload failed.');
    };
    reader.readAsDataURL(file);
  };
  const dateVal = (d) => d ? new Date(d).toISOString().slice(0, 10) : '';
  const done = ['handed_over', 'dropped'].includes(r.Status);

  return (
    <div style={{ marginTop: 12, padding: 14, borderRadius: 10, background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field l="Offer acceptance date"><input type="date" style={input} disabled={done} value={dateVal(r.OfferAcceptedDate)} onChange={e => save({ offerAcceptedDate: e.target.value })} /></Field>
        <Field l="Resignation acceptance date"><input type="date" style={input} disabled={done} value={dateVal(r.ResignationAcceptedDate)} onChange={e => save({ resignationAcceptedDate: e.target.value })} /></Field>
        <Field l="Confirmed joining date"><input type="date" style={input} disabled={done} value={dateVal(r.JoiningDate)} onChange={e => save({ joiningDate: e.target.value })} /></Field>
      </div>
      {r.JoiningDate && <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: 2 }}>Document deadline (7 days before joining): <strong>{new Date(new Date(r.JoiningDate).getTime() - 7 * 86400000).toISOString().slice(0, 10)}</strong></p>}

      <div style={label}>Documents (tick when received; upload is optional)</div>
      {docs.map(d => (
        <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
          <label style={{ flex: 1, fontSize: '.86rem', color: 'var(--text-primary)' }}>
            <input type="checkbox" disabled={done} checked={!!d.received} onChange={() => toggleDoc(d.key)} style={{ marginRight: 8 }} />{d.label}
          </label>
          {d.fileName && <span style={{ fontSize: '.78rem', color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.fileName}</span>}
          {d.fileName && <button style={{ ...ghostBtn, padding: '4px 10px', fontSize: '.76rem', marginBottom: 0 }} onClick={() => viewFile(d.key)}>View</button>}
          {d.fileName && !done && <button style={{ ...ghostBtn, color: '#dc2626', borderColor: '#dc2626', padding: '4px 10px', fontSize: '.76rem', marginBottom: 0 }} onClick={() => deleteFile(d.key, d.label)}>Delete file</button>}
          {!done && <label style={{ ...ghostBtn, padding: '4px 10px', fontSize: '.76rem', cursor: 'pointer', marginBottom: 0 }}>
            {d.fileName ? 'Replace' : 'Upload'}<input type="file" style={{ display: 'none' }} onChange={e => e.target.files[0] && upload(d.key, e.target.files[0])} />
          </label>}
        </div>
      ))}

      <div style={label}>Engagement notes</div>
      <textarea style={{ ...input, minHeight: 54 }} disabled={done} defaultValue={r.Notes || ''} onBlur={e => save({ notes: e.target.value })} placeholder="Touchpoints with the candidate…" />

      {r.DeleteRequested ? (
        <div style={{ marginTop: 10, padding: 12, borderRadius: 8, background: 'color-mix(in srgb, #dc2626 8%, transparent)', border: '1px solid #dc2626' }}>
          <div style={{ fontSize: '.84rem', color: '#dc2626', fontWeight: 700 }}>Deletion requested{r.DeleteRequestedBy ? ` by ${r.DeleteRequestedBy}` : ''}</div>
          {r.DeleteReason && <div style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginTop: 3 }}>Reason: {r.DeleteReason}</div>}
          {isAdmin ? (
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button style={{ ...primaryBtn, background: '#dc2626' }} onClick={approveDelete}>Approve deletion</button>
              <button style={ghostBtn} onClick={rejectDelete}>Reject</button>
            </div>
          ) : (
            <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: 6 }}>Awaiting Admin approval.</div>
          )}
        </div>
      ) : (
        <>
          {!done && (
            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              {r.Status !== 'ready' && <button style={primaryBtn} onClick={markReady}>Mark Ready for handover</button>}
              {r.Status === 'ready' && <button style={primaryBtn} onClick={() => save({ status: 'handed_over' })}>Confirm handover to Operations</button>}
              <button style={{ ...ghostBtn, color: '#dc2626', borderColor: '#dc2626' }} onClick={() => { const why = window.prompt('Reason for dropping this candidate?') || ''; save({ status: 'dropped', droppedReason: why }); }}>Mark dropped</button>
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <button style={{ ...ghostBtn, color: '#dc2626', borderColor: '#dc2626', fontSize: '.8rem', padding: '6px 12px' }} onClick={requestDelete}>Delete entry</button>
          </div>
        </>
      )}
      {r.Status !== 'ready' && !done && !r.DeleteRequested && <p style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: 8 }}>Ready-for-handover needs: offer + resignation dates, confirmed joining date, and all documents ticked.</p>}
      {r.DroppedReason && <p style={{ fontSize: '.8rem', color: '#dc2626', marginTop: 8 }}>Dropped: {r.DroppedReason}</p>}
      {msg && <p style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginTop: 8 }}>{msg}</p>}
    </div>
  );
};

/* ═══════════════════════ RECRUITMENT (stages 1–9) ══════════════════════════ */
const REC_STAGES = ['jd', 'review_post', 'cv_shortlist', 'scheduling', 'interview', 'selection', 'offer', 'acceptance'];
const REC_DOCS = [
  { key: 'idProof', label: 'ID proof' }, { key: 'addressProof', label: 'Address proof' },
  { key: 'education', label: 'Education certificates' }, { key: 'relieving', label: 'Relieving / experience letter' },
  { key: 'bank', label: 'Bank details' }, { key: 'photo', label: 'Photograph' },
];
const POST_CHANNELS = ['Company website', 'Naukri', 'LinkedIn', 'Referrals', 'Consultants', 'Internal posting'];
const ASSESS_CRITERIA = ['Education / Training', 'Work Experience', 'Technical skills', 'Personality', 'Communication Skills', 'Others'];
const ASSESS_RATINGS = [{ v: 5, l: 'Excellent' }, { v: 4, l: 'Good' }, { v: 3, l: 'Average' }, { v: 2, l: 'Below Average' }];
const OUTCOME_META = { Selected: 'var(--accent-green)', 'On Hold': 'var(--accent-orange)', 'Not Suitable': '#dc2626' };

const readBase64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });

const RecruitmentView = ({ onBack }) => {
  const api = useApi();
  const { isManager, isInterviewer } = useAuth();
  const [list, setList] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(isManager ? 'hod' : 'active');
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState(null);
  const blank = { department: '', role: '', grade: '', positions: 1, justification: '', targetDate: '', mrfRef: '', jdText: '' };
  const [form, setForm] = useState(blank);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => { const d = await api('/recruitment'); if (d.success) setList(d.records); }, [api]);
  const verRef = useRef('');
  useEffect(() => {
    let alive = true;
    load();
    const t = setInterval(async () => {
      const v = await api('/recruitment/version');
      if (alive && v.success && v.version !== verRef.current) { verRef.current = v.version; load(); }
    }, 500);
    return () => { alive = false; clearInterval(t); };
  }, [load, api]);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const create = async () => {
    if (!form.role && !form.department) return setMsg('Enter at least a role or department.');
    const d = await api('/recruitment', 'POST', form);
    if (d.success) { setForm(blank); setShowForm(false); setMsg('Requirement created.'); load(); } else setMsg(d.error || 'Failed.');
  };
  const needsHod = (r) => r.Stage === 'cv_shortlist' && (r.candidates || []).some(c => (c.HodDecision || 'pending') === 'pending');
  const filtered = list.filter(r => {
    const s = search.trim().toLowerCase();
    const ms = !s || [r.Role, r.Department, r.MrfRef].filter(Boolean).some(x => x.toLowerCase().includes(s));
    const mf = filter === 'all' ? true : filter === 'hod' ? needsHod(r) : filter === 'active' ? r.Status === 'active' : filter === 'on_hold' ? r.Status === 'on_hold' : r.Status === filter;
    return ms && mf;
  });

  const openRec = openId ? list.find(x => x.Id === openId) : null;
  if (openRec) return <div><RecruitmentDetail record={openRec} api={api} reload={load} onClose={() => setOpenId(null)} /></div>;

  return (
    <div>
      <BackBar onBack={onBack} title="Recruitment" subtitle="JD to offer acceptance — HOD shares the JD, HR sources and schedules, the panel interviews, HR closes." />
      {!showForm && !isInterviewer && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}><button style={primaryBtn} onClick={() => { setForm(blank); setMsg(''); setShowForm(true); }}>+ New requirement (JD)</button></div>}
      {showForm && (
        <div style={card}>
          <h2 style={h2}>New requirement — Stage 1 (JD)</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 8 }}>
            <Field l="Department"><input style={input} value={form.department} onChange={e => set('department', e.target.value)} /></Field>
            <Field l="Role / position"><input style={input} value={form.role} onChange={e => set('role', e.target.value)} /></Field>
            <Field l="Grade / band"><input style={input} value={form.grade} onChange={e => set('grade', e.target.value)} /></Field>
            <Field l="No. of positions"><input type="number" min="1" style={input} value={form.positions} onChange={e => set('positions', e.target.value)} /></Field>
            <Field l="MRF reference"><input style={input} value={form.mrfRef} onChange={e => set('mrfRef', e.target.value)} /></Field>
            <Field l="Target date"><input type="date" style={input} value={form.targetDate} onChange={e => set('targetDate', e.target.value)} /></Field>
          </div>
          <Field l="Job description (JD)"><textarea style={{ ...input, minHeight: 70 }} value={form.jdText} onChange={e => set('jdText', e.target.value)} placeholder="Paste the JD here (you can also upload a JD file after creating)." /></Field>
          <div style={{ display: 'flex', gap: 10 }}><button style={primaryBtn} onClick={create}>Create</button><button style={ghostBtn} onClick={() => { setShowForm(false); setMsg(''); }}>Cancel</button></div>
          {msg && <span style={{ marginLeft: 12, fontSize: '.84rem', color: 'var(--text-muted)' }}>{msg}</span>}
        </div>
      )}
      <div style={card}>
        <h2 style={{ ...h2, display: 'flex', alignItems: 'center', gap: 8 }}>Requirements
          <span style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--accent-green)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-green)', display: 'inline-block' }} />LIVE · auto-updates</span>
        </h2>
        <FilterBar search={search} setSearch={setSearch} filter={filter} setFilter={setFilter}
          placeholder="Search by role, department or MRF…"
          options={[
            { key: 'active', label: 'Active', count: list.filter(r => r.Status === 'active').length },
            { key: 'hod', label: 'HOD review', count: list.filter(needsHod).length },
            { key: 'on_hold', label: 'On hold', count: list.filter(r => r.Status === 'on_hold').length },
            { key: 'all', label: 'All', count: list.length },
          ]} />
        {filtered.length === 0 && <Empty text="No requirements." />}
        {filtered.map(r => (
          <div key={r.Id} style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{r.Role || '(role)'} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '.82rem' }}>· {r.Department || '—'}{r.Positions ? ` · ${r.Positions} pos` : ''}{r.MrfRef ? ` · ${r.MrfRef}` : ''}</span></div>
                <div style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{(r.candidates || []).length} candidate(s){r.Status !== 'active' ? ` · ${STATUS_META[r.Status]?.label || r.Status}` : ''}</div>
              </div>
              {needsHod(r) && <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#fff', background: 'var(--accent-orange)', borderRadius: 12, padding: '2px 9px' }}>HOD review</span>}
              {r.DeleteRequested && <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#fff', background: '#dc2626', borderRadius: 12, padding: '2px 9px' }}>Delete requested</span>}
              <Pill status={r.Stage} />
              <button style={{ ...ghostBtn, padding: '6px 12px', fontSize: '.8rem' }} onClick={() => setOpenId(r.Id)}>Open</button>
            </div>
          </div>
        ))}
        {msg && !showForm && <p style={{ fontSize: '.84rem', color: 'var(--text-muted)', marginTop: 10 }}>{msg}</p>}
      </div>
    </div>
  );
};

const RecruitmentDetail = ({ record, api, reload, onClose }) => {
  const { isAdmin, isManager, isHod, isInterviewer, isHr, user } = useAuth();
  // Rights matrix: which roles may ACT on each stage (admin can always act).
  const STAGE_ACT = {
    jd: ['hod', 'hr'], review_post: ['hr'], cv_shortlist: ['hr', 'hod'], scheduling: ['hr', 'interviewer'],
    interview: ['interviewer'], selection: ['hr'], offer: ['hr'], acceptance: ['hr'],
  };
  const STAGE_OWNER = { jd: 'HOD', review_post: 'HR', cv_shortlist: 'HOD / HR', scheduling: 'Interviewer + HR', interview: 'Interviewer', selection: 'HR', offer: 'HR', acceptance: 'HR' };
  const myRole = user?.role;
  const canActStage = (st) => isAdmin || (STAGE_ACT[st] || []).includes(myRole);
  const [r, setR] = useState(record);
  const [cand, setCand] = useState({ name: '', phone: '', email: '', source: '' });
  const [assessFor, setAssessFor] = useState(null);
  const [msg, setMsg] = useState('');
  const [viewStage, setViewStage] = useState(record.Stage);
  useEffect(() => { setR(record); }, [record]);
  useEffect(() => { setViewStage(r.Stage); }, [r.Stage]);
  const idx = REC_STAGES.indexOf(r.Stage);
  const dv = (d) => d ? new Date(d).toISOString().slice(0, 10) : '';
  const cands = r.candidates || [];

  const refresh = async () => { const d = await api('/recruitment'); if (d.success) { const u = d.records.find(x => x.Id === r.Id); if (u) setR(u); } };
  const save = async (patch) => { const d = await api(`/recruitment/${r.Id}`, 'PUT', patch); if (d.success) { await refresh(); setMsg('Saved.'); reload(); } else window.alert(d.error || 'Failed.'); };
  const goStage = (s) => save({ stage: s });
  const saveCand = async (cid, patch) => { const d = await api(`/recruitment/candidates/${cid}`, 'PUT', patch); if (d.success) { await refresh(); reload(); } else window.alert(d.error || 'Failed.'); };
  const addCand = async () => { if (!cand.name.trim()) return; const d = await api(`/recruitment/${r.Id}/candidates`, 'POST', cand); if (d.success) { setCand({ name: '', phone: '', email: '', source: '' }); await refresh(); reload(); } };
  const delCand = async (cid) => { if (!window.confirm('Remove this candidate?')) return; const d = await api(`/recruitment/candidates/${cid}`, 'DELETE'); if (d.success) { await refresh(); reload(); } };
  const uploadCVs = async (files) => { for (const f of files) { const b64 = await readBase64(f); await api(`/recruitment/${r.Id}/cv`, 'POST', { fileName: f.name, dataBase64: b64 }); } await refresh(); reload(); };
  const uploadJd = async (file) => { const b64 = await readBase64(file); const d = await api(`/recruitment/${r.Id}/jd-upload`, 'POST', { fileName: file.name, dataBase64: b64 }); if (d.success) { await refresh(); reload(); } };
  const viewServerFile = async (path) => { try { const res = await fetch(`${URA_API}${path}`, { headers: { 'x-user-role': user?.role || '', 'x-user-id': user?.empId || '' } }); if (!res.ok) return window.alert('Could not open (' + res.status + ').'); const b = await res.blob(); const u = URL.createObjectURL(b); window.open(u, '_blank'); setTimeout(() => URL.revokeObjectURL(u), 60000); } catch { window.alert('Could not reach server.'); } };

  const requestDelete = async () => { const why = window.prompt('Delete this requirement? Reason goes to Admin for approval:'); if (why === null) return; const d = await api(`/recruitment/${r.Id}/request-delete`, 'POST', { reason: why }); if (d.success) { window.alert('Deletion requested — pending Admin approval.'); await refresh(); reload(); } };
  const approveDelete = async () => { if (!window.confirm('Approve deletion? Permanently removes this requirement and its candidates.')) return; const d = await api(`/recruitment/${r.Id}/approve-delete`, 'POST', {}); if (d.success) { window.alert('Deleted.'); reload(); onClose && onClose(); } };
  const rejectDelete = async () => { const d = await api(`/recruitment/${r.Id}/reject-delete`, 'POST', {}); if (d.success) { await refresh(); reload(); } };

  const channels = (() => { try { return JSON.parse(r.SourcingChannels || '[]'); } catch { return []; } })();
  const toggleChannel = (c) => { const nx = channels.includes(c) ? channels.filter(x => x !== c) : [...channels, c]; save({ sourcingChannels: nx }); };
  const box = { padding: 0 };
  const accepted = cands.filter(c => c.HodDecision === 'accepted');
  const selectedCount = cands.filter(c => c.Outcome === 'Selected').length;
  const gateMsg = (() => {
    switch (r.Stage) {
      case 'jd': return (r.JdText && String(r.JdText).trim()) || r.JdFileName ? null : 'Add the JD (text or file).';
      case 'review_post': return channels.length ? null : 'Tick where the JD was posted.';
      case 'cv_shortlist': {
        if (!cands.length) return 'Upload at least one CV.';
        const pend = cands.filter(c => (c.HodDecision || 'pending') === 'pending');
        if (pend.length) return `HOD must review ${pend.length} CV(s).`;
        if (!cands.some(c => c.HodDecision === 'accepted')) return 'HOD has not accepted any candidate.';
        return null;
      }
      case 'scheduling': return accepted.some(c => c.InterviewStatus === 'scheduled') ? null : 'HR must approve at least one interview time.';
      case 'interview': return cands.some(c => c.Outcome) ? null : 'Record at least one interview outcome.';
      case 'selection': return r.SelectedCandidateId ? null : 'Take a candidate forward.';
      case 'offer': return r.OfferReleasedDate ? null : 'Enter the offer released date.';
      default: return null;
    }
  })();

  return (
    <div style={box}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button style={{ ...ghostBtn, padding: '6px 12px', fontSize: '.8rem' }} onClick={onClose}>← All requirements</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)' }}>{r.Role || '(role)'} — {STATUS_META[r.Stage]?.label}</div>
          <div style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>{[r.Department, `${r.Positions || 1} position(s)`, `owned by ${STAGE_OWNER[r.Stage]}`, r.MrfRef].filter(Boolean).join('  ·  ')}</div>
        </div>
        <Pill status={r.Stage} />
      </div>

      {/* page selector — jump between the requirement's stage pages (● marks the current stage) */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12, overflowX: 'auto' }}>
        {REC_STAGES.map((s, i) => (
          <button key={s} onClick={() => setViewStage(s)}
            style={{ padding: '6px 11px', borderRadius: '8px 8px 0 0', fontSize: '.75rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              border: '1px solid var(--border)', borderBottom: s === viewStage ? '3px solid var(--accent)' : '1px solid var(--border)',
              background: s === viewStage ? 'var(--bg-card)' : 'transparent',
              color: s === viewStage ? 'var(--accent)' : (s === r.Stage ? 'var(--text-primary)' : 'var(--text-muted)') }}>
            {i + 1}. {(STATUS_META[s]?.label || s).replace(/^\d+\s·\s/, '')}{s === r.Stage ? ' ●' : ''}
          </button>
        ))}
      </div>

      <div style={{ ...card }}>

      {r.DeleteRequested && (
        <div style={{ padding: 12, borderRadius: 8, background: 'color-mix(in srgb,#dc2626 8%,transparent)', border: '1px solid #dc2626', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: '#dc2626', fontSize: '.84rem' }}>Deletion requested{r.DeleteRequestedBy ? ` by ${r.DeleteRequestedBy}` : ''}</div>
          {r.DeleteReason && <div style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>Reason: {r.DeleteReason}</div>}
          {isAdmin ? <div style={{ display: 'flex', gap: 10, marginTop: 8 }}><button style={{ ...primaryBtn, background: '#dc2626' }} onClick={approveDelete}>Approve deletion</button><button style={ghostBtn} onClick={rejectDelete}>Reject</button></div>
            : <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: 4 }}>Awaiting Admin approval.</div>}
        </div>
      )}

      {canActStage(viewStage) ? (<>
      {/* STAGE 1 — JD */}
      {viewStage === 'jd' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field l="Department"><input style={input} defaultValue={r.Department || ''} onBlur={e => save({ department: e.target.value })} /></Field>
            <Field l="Role"><input style={input} defaultValue={r.Role || ''} onBlur={e => save({ role: e.target.value })} /></Field>
            <Field l="Grade"><input style={input} defaultValue={r.Grade || ''} onBlur={e => save({ grade: e.target.value })} /></Field>
            <Field l="Positions"><input type="number" style={input} defaultValue={r.Positions || 1} onBlur={e => save({ positions: e.target.value })} /></Field>
          </div>
          <Field l="Job description (text)"><textarea style={{ ...input, minHeight: 90 }} defaultValue={r.JdText || ''} onBlur={e => save({ jdText: e.target.value })} /></Field>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <label style={{ ...ghostBtn, cursor: 'pointer', marginBottom: 0 }}>{r.JdFileName ? 'Replace JD file' : 'Upload JD file'}<input type="file" style={{ display: 'none' }} onChange={e => e.target.files[0] && uploadJd(e.target.files[0])} /></label>
            {r.JdFileName && <button style={ghostBtn} onClick={() => viewServerFile(`/recruitment/${r.Id}/jd-file`)}>View JD ({r.JdFileName})</button>}
          </div>
          <p style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>HOD shares the JD here, then advances to hand it to HR.</p>
        </div>
      )}

      {/* STAGE 2 — REVIEW & POST */}
      {viewStage === 'review_post' && (
        <div>
          <p style={{ fontSize: '.85rem', color: 'var(--text-muted)', marginTop: 0 }}>HR reviews the requirement and posts the JD. Tick where it was posted.</p>
          {r.JdFileName && <button style={{ ...ghostBtn, marginBottom: 10 }} onClick={() => viewServerFile(`/recruitment/${r.Id}/jd-file`)}>View JD ({r.JdFileName})</button>}
          <div style={label}>Posted on</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>{POST_CHANNELS.map(c => <span key={c} onClick={() => toggleChannel(c)} style={chip(channels.includes(c))}>{c}</span>)}</div>
          <Field l="Notes"><textarea style={{ ...input, minHeight: 44 }} defaultValue={r.SourcingNotes || ''} onBlur={e => save({ sourcingNotes: e.target.value })} /></Field>
        </div>
      )}

      {/* STAGE 3 — CV SHORTLIST (HR uploads, HOD accept/reject) */}
      {viewStage === 'cv_shortlist' && (
        <div>
          {(isHr || isAdmin) && (
            <div style={{ padding: 10, borderRadius: 8, background: 'color-mix(in srgb, var(--accent-orange) 10%, transparent)', border: '1px solid var(--accent-orange)', marginBottom: 10, fontSize: '.82rem', color: 'var(--text-primary)' }}>
              This step belongs to the <strong>HOD</strong>. Upload the CVs here — the HOD reviews each one and marks Accept / Reject. You can advance to Scheduling only once the HOD has reviewed <strong>every</strong> CV.
            </div>
          )}
          <label style={{ ...primaryBtn, cursor: 'pointer', display: 'inline-block' }}>+ Upload CVs (multiple)<input type="file" multiple style={{ display: 'none' }} onChange={e => { if (e.target.files.length) uploadCVs([...e.target.files]); e.target.value = ''; }} /></label>
          <p style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>{isHod ? 'Open each CV and Accept or Reject it.' : 'HR uploads CVs; the HOD opens each and accepts or rejects.'}</p>
          {cands.length === 0 && <Empty text="No CVs uploaded yet." />}
          {cands.map(c => (
            <div key={c.Id} style={{ ...rowStyle, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <input style={{ ...input, marginBottom: 0, maxWidth: 220, padding: '5px 8px' }} defaultValue={c.Name} onBlur={e => saveCand(c.Id, { name: e.target.value })} />
                {c.HodRemark && <div style={{ fontSize: '.76rem', color: 'var(--text-muted)' }}>Remark: {c.HodRemark}</div>}
              </div>
              {c.CvFileName && <button style={{ ...ghostBtn, padding: '5px 10px', fontSize: '.78rem' }} onClick={() => viewServerFile(`/recruitment/candidates/${c.Id}/cv`)}>View CV</button>}
              <Pill status={c.HodDecision === 'accepted' ? 'approved' : c.HodDecision === 'rejected' ? 'rejected' : 'pending'} />
              {(isManager || isHod) && c.HodDecision !== 'accepted' && <button style={{ ...ghostBtn, padding: '5px 10px', fontSize: '.78rem', color: 'var(--accent-green)', borderColor: 'var(--accent-green)' }} onClick={() => saveCand(c.Id, { hodDecision: 'accepted' })}>Accept</button>}
              {(isManager || isHod) && c.HodDecision !== 'rejected' && <button style={{ ...ghostBtn, padding: '5px 10px', fontSize: '.78rem', color: '#dc2626', borderColor: '#dc2626' }} onClick={() => { const rm = window.prompt('Reject — remark (optional):') || ''; saveCand(c.Id, { hodDecision: 'rejected', hodRemark: rm }); }}>Reject</button>}
              <button style={{ ...ghostBtn, padding: '5px 8px', fontSize: '.74rem', color: '#dc2626', borderColor: '#dc2626' }} onClick={() => delCand(c.Id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* STAGE 4 — SCHEDULING (interviewer proposes a time, HR approves/edits) */}
      {viewStage === 'scheduling' && (
        <div>
          <p style={{ fontSize: '.85rem', color: 'var(--text-muted)', marginTop: 0 }}>The interviewer proposes a time; HR approves or edits it. The interview then starts automatically at the approved time.</p>
          {accepted.length === 0 && <Empty text="No HOD-accepted candidates yet." />}
          {accepted.map(c => (
            <InterviewLifecycle key={c.Id} c={c} phase="schedule" api={api} reload={async () => { await refresh(); reload(); }}
              save={(patch) => saveCand(c.Id, patch)} isHr={isHr} isInterviewer={isInterviewer} isAdmin={isAdmin} req={r} />
          ))}
        </div>
      )}

      {/* STAGE 5 — INTERVIEW (auto/manual start; interviewer marks arrival & fills the form) */}
      {viewStage === 'interview' && (
        <div>
          <p style={{ fontSize: '.85rem', color: 'var(--text-muted)', marginTop: 0 }}>Interviews start automatically at the scheduled time (or the interviewer can start manually). The interviewer marks Arrived / Reschedule / No-show — Reschedule and No-show reopen the ticket for a new time.</p>
          {accepted.length === 0 && <Empty text="No scheduled candidates yet." />}
          {accepted.map(c => (
            <InterviewLifecycle key={c.Id} c={c} phase="interview" api={api} reload={async () => { await refresh(); reload(); }}
              save={(patch) => saveCand(c.Id, patch)} isHr={isHr} isInterviewer={isInterviewer} isAdmin={isAdmin} req={r} />
          ))}
        </div>
      )}

      {/* STAGE 6 — SELECTION */}
      {viewStage === 'selection' && (
        <div>
          <p style={{ fontSize: '.85rem', color: 'var(--text-muted)', marginTop: 0 }}>Positions: {r.Positions || 1}. Selected so far: {selectedCount}. Choose who to take forward to offer.</p>
          {cands.filter(c => c.Outcome).map(c => (
            <div key={c.Id} style={{ ...rowStyle, alignItems: 'center', background: r.SelectedCandidateId === c.Id ? 'color-mix(in srgb, var(--accent-green) 8%, transparent)' : undefined }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.Name}{r.SelectedCandidateId === c.Id ? ' ★' : ''}</div>
                <div style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>Interview outcome: {c.Outcome}{c.InterviewerName ? ` · by ${c.InterviewerName}` : ''}</div>
              </div>
              <span style={{ fontSize: '.74rem', fontWeight: 700, color: '#fff', background: OUTCOME_META[c.Outcome] || 'var(--text-muted)', borderRadius: 12, padding: '2px 9px' }}>{c.Outcome}</span>
              {c.Outcome === 'Selected' && <button style={{ ...ghostBtn, padding: '5px 10px', fontSize: '.78rem' }} onClick={() => { save({ selectedCandidateId: c.Id }); saveCand(c.Id, { candStatus: 'selected' }); }}>Take forward</button>}
            </div>
          ))}
          {cands.filter(c => c.Outcome).length === 0 && <Empty text="No interview outcomes yet." />}
        </div>
      )}

      {/* STAGE 7 — OFFER */}
      {viewStage === 'offer' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field l="Offer released date"><input type="date" style={input} defaultValue={dv(r.OfferReleasedDate)} onBlur={e => save({ offerReleasedDate: e.target.value })} /></Field>
          <div style={{ gridColumn: '1 / -1' }}><Field l="Offer notes"><textarea style={{ ...input, minHeight: 44 }} defaultValue={r.OfferNotes || ''} onBlur={e => save({ offerNotes: e.target.value })} /></Field></div>
        </div>
      )}

      {/* STAGE 8 — ACCEPTANCE */}
      {viewStage === 'acceptance' && ((() => { const sel = cands.find(c => c.Id === r.SelectedCandidateId);
        return sel ? <RecCandidateAcceptance c={sel} api={api} reload={async () => { await refresh(); reload(); }} user={user} />
          : <p style={{ fontSize: '.85rem', color: '#dc2626' }}>Take a candidate forward at the Selection stage first.</p>; })())}

      {/* manual add candidate (HR only, pre-interview) */}
      {['cv_shortlist', 'scheduling'].includes(viewStage) && (isHr || isAdmin) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <input placeholder="Add candidate name" style={{ ...input, marginBottom: 0, maxWidth: 180 }} value={cand.name} onChange={e => setCand(s => ({ ...s, name: e.target.value }))} />
          <input placeholder="Email" style={{ ...input, marginBottom: 0, maxWidth: 170 }} value={cand.email} onChange={e => setCand(s => ({ ...s, email: e.target.value }))} />
          <button style={ghostBtn} onClick={addCand}>+ Add manually</button>
        </div>
      )}
      </>) : (
        <div style={{ padding: 14, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', fontSize: '.86rem', color: 'var(--text-muted)' }}>
          This step — <strong style={{ color: 'var(--text-primary)' }}>{STATUS_META[viewStage]?.label}</strong> — is handled by <strong>{STAGE_OWNER[viewStage]}</strong>. There's nothing for your role here; you'll see this requirement again when it reaches your step.
        </div>
      )}

      {/* Orchestration bar: HR/admin drive the pipeline; the HOD only hands off the JD at stage 1 */}
      {(isHr || isAdmin || (isHod && r.Stage === 'jd')) && (
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          {(isHr || isAdmin) && idx > 0 && <button style={ghostBtn} onClick={() => goStage(REC_STAGES[idx - 1])}>← Back</button>}
          {idx < REC_STAGES.length - 1 && <button style={primaryBtn} onClick={() => goStage(REC_STAGES[idx + 1])}>Advance to {STATUS_META[REC_STAGES[idx + 1]]?.label} →</button>}
          {(isHr || isAdmin) && (r.Status === 'active' ? <button style={ghostBtn} onClick={() => save({ status: 'on_hold' })}>Put on hold</button> : r.Status === 'on_hold' ? <button style={ghostBtn} onClick={() => save({ status: 'active' })}>Resume</button> : null)}
          {(isHr || isAdmin) && <button style={{ ...ghostBtn, color: '#dc2626', borderColor: '#dc2626' }} onClick={() => { const why = window.prompt('Reason for dropping / closing?') || ''; save({ status: 'dropped', dropReason: why }); }}>Drop</button>}
          {(isHr || isAdmin) && !r.DeleteRequested && <button style={{ ...ghostBtn, color: '#dc2626', borderColor: '#dc2626' }} onClick={requestDelete}>Delete entry</button>}
          {idx < REC_STAGES.length - 1 && (gateMsg
            ? <span style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--accent-orange)' }}>⚠ Pending to advance: {gateMsg}</span>
            : <span style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--accent-green)' }}>✓ Ready to advance</span>)}
          {viewStage !== r.Stage && <span style={{ fontSize: '.76rem', color: 'var(--text-muted)' }}>· Viewing {STATUS_META[viewStage]?.label} (current: {STATUS_META[r.Stage]?.label})</span>}
        </div>
      )}
      {msg && <p style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginTop: 8 }}>{msg}</p>}
      </div>
    </div>
  );
};

// Per-candidate interview lifecycle: interviewer proposes time -> HR approves/edits ->
// auto/manual start -> interviewer marks Arrived/Reschedule/No-show -> Arrived opens the form.
const InterviewLifecycle = ({ c, save, api, reload, isHr, isInterviewer, isAdmin, req }) => {
  const { user } = useAuth();
  const [assess, setAssess] = useState(false);
  const dv = (d) => d ? new Date(d).toISOString().slice(0, 10) : '';
  const [d, setD] = useState(dv(c.InterviewDate));
  const [t, setT] = useState(c.InterviewTime || '');
  const [, tick] = useState(0);
  useEffect(() => { setD(dv(c.InterviewDate)); setT(c.InterviewTime || ''); }, [c.Id, c.InterviewDate, c.InterviewTime]);
  useEffect(() => { const iv = setInterval(() => tick(x => x + 1), 20000); return () => clearInterval(iv); }, []); // re-check auto-start
  const st = c.InterviewStatus || 'none';
  const schedDT = c.InterviewDate && c.InterviewTime ? new Date(`${dv(c.InterviewDate)}T${c.InterviewTime}`) : (c.InterviewDate ? new Date(dv(c.InterviewDate)) : null);
  const due = schedDT && !isNaN(schedDT) && Date.now() >= schedDT.getTime();
  const live = st === 'in_progress' || (st === 'scheduled' && due);
  const canPropose = isInterviewer || isAdmin;
  const canApprove = isHr || isAdmin;
  const canRun = isInterviewer || isAdmin;

  const badge = (txt, col) => <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#fff', background: col, borderRadius: 12, padding: '2px 9px' }}>{txt}</span>;
  const row = { ...rowStyle, flexDirection: 'column', alignItems: 'stretch' };
  const fld = { ...input, marginBottom: 0, maxWidth: 150, padding: '5px 8px' };
  const sb = (txt, col, on) => <button style={{ ...ghostBtn, padding: '5px 10px', fontSize: '.78rem', color: col, borderColor: col }} onClick={on}>{txt}</button>;

  return (
    <div style={row}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, fontWeight: 700, color: 'var(--text-primary)' }}>{c.Name}</div>
        {st === 'none' && badge('No time yet', 'var(--text-muted)')}
        {st === 'time_proposed' && badge('Time proposed · awaiting HR', 'var(--accent-orange)')}
        {st === 'scheduled' && !live && badge(`Scheduled · ${dv(c.InterviewDate)} ${c.InterviewTime || ''}`, 'var(--accent-sky)')}
        {live && !['arrived'].includes(st) && !c.Outcome && badge('In progress', 'var(--accent-teal)')}
        {st === 'arrived' && !c.Outcome && badge('Arrived · assessment pending', 'var(--accent-teal)')}
        {st === 'reschedule' && badge('Rescheduled — needs new time', 'var(--accent-orange)')}
        {st === 'no_show' && badge('No-show — needs new time', '#dc2626')}
        {c.Outcome && badge(c.Outcome, OUTCOME_META[c.Outcome] || 'var(--text-muted)')}
      </div>

      {/* Needs a time: interviewer proposes */}
      {['none', 'reschedule', 'no_show'].includes(st) && !c.Outcome && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
          {canPropose ? (<>
            <input type="date" style={fld} value={d} onChange={e => setD(e.target.value)} />
            <input placeholder="Time (e.g. 15:30)" style={{ ...fld, maxWidth: 120 }} value={t} onChange={e => setT(e.target.value)} />
            {sb('Propose time → HR', 'var(--accent)', () => { if (!d) return window.alert('Pick a date.'); save({ interviewDate: d, interviewTime: t, interviewStatus: 'time_proposed' }); })}
          </>) : <span style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>Waiting for the interviewer to propose a time.</span>}
        </div>
      )}

      {/* Proposed: HR edits/approves */}
      {st === 'time_proposed' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
          {canApprove ? (<>
            <input type="date" style={fld} value={d} onChange={e => setD(e.target.value)} />
            <input placeholder="Time" style={{ ...fld, maxWidth: 120 }} value={t} onChange={e => setT(e.target.value)} />
            {sb('Approve time', 'var(--accent-green)', () => save({ interviewDate: d, interviewTime: t, interviewStatus: 'scheduled' }))}
          </>) : <span style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>Proposed {dv(c.InterviewDate)} {c.InterviewTime} — awaiting HR approval. {canPropose && '(You can re-propose above.)'}</span>}
          {canPropose && !canApprove && <>
            <input type="date" style={fld} value={d} onChange={e => setD(e.target.value)} />
            <input placeholder="Time" style={{ ...fld, maxWidth: 120 }} value={t} onChange={e => setT(e.target.value)} />
            {sb('Re-propose', 'var(--accent)', () => save({ interviewDate: d, interviewTime: t, interviewStatus: 'time_proposed' }))}
          </>}
        </div>
      )}

      {/* Scheduled but not yet due: auto-start note + manual start */}
      {st === 'scheduled' && !live && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>Starts automatically at {dv(c.InterviewDate)} {c.InterviewTime}.</span>
          {canRun && sb('Start now', 'var(--accent-teal)', () => save({ interviewStatus: 'in_progress' }))}
          {canApprove && sb('Edit time', 'var(--accent)', () => save({ interviewStatus: 'time_proposed' }))}
        </div>
      )}

      {/* Live (auto-started or manually): interviewer marks outcome of attendance */}
      {live && st !== 'arrived' && !c.Outcome && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
          {canRun ? (<>
            {sb('Arrived', 'var(--accent-green)', () => save({ interviewStatus: 'arrived' }))}
            {sb('Reschedule', 'var(--accent-orange)', () => { if (window.confirm('Reschedule reopens the ticket for a new time. Continue?')) save({ interviewStatus: 'reschedule', interviewDate: null, interviewTime: null }); })}
            {sb('No-show', '#dc2626', () => { if (window.confirm('Mark No-show? This reopens the ticket for a new time.')) save({ interviewStatus: 'no_show', interviewDate: null, interviewTime: null }); })}
          </>) : <span style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>Interview in progress — the interviewer will mark the result.</span>}
        </div>
      )}

      {/* Arrived: interviewer fills the assessment form */}
      {(st === 'arrived' || c.Outcome) && (
        <div style={{ marginTop: 8 }}>
          {canRun && <button style={{ ...ghostBtn, padding: '5px 10px', fontSize: '.78rem' }} onClick={() => setAssess(a => !a)}>{assess ? 'Close form' : (c.Assessment ? 'Edit assessment' : 'Fill assessment form')}</button>}
          {!canRun && !c.Outcome && <span style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>Awaiting the interviewer's assessment.</span>}
          {assess && <AssessmentForm c={c} req={req} onSave={(patch) => { save(patch); setAssess(false); }} />}
        </div>
      )}
    </div>
  );
};

// Digitised Interview Assessment Form (matches the paper form)
const AssessmentForm = ({ c, req, onSave }) => {
  const init = (() => { try { return JSON.parse(c.Assessment || 'null'); } catch { return null; } })() || {
    position: req.Role || '', department: req.Department || '', expectedCtc: '', currentCtc: '', noticePeriod: '', experience: '',
    dob: '', qualification: '', maritalStatus: '', source: '', interviewedEarlier: 'No',
    ratings: {}, comments: {}, knowledge: '', experienceInput: '', exposure: '', date: new Date().toISOString().slice(0, 10),
  };
  const [f, setF] = useState(init);
  const [interviewer, setInterviewer] = useState(c.InterviewerName || '');
  const [outcome, setOutcome] = useState(c.Outcome || '');
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const setRating = (crit, v) => setF(s => ({ ...s, ratings: { ...s.ratings, [crit]: v } }));
  const setComment = (crit, v) => setF(s => ({ ...s, comments: { ...s.comments, [crit]: v } }));
  const submit = () => { if (!outcome) return window.alert('Please select a status (Selected / On Hold / Not Suitable).'); onSave({ assessment: f, interviewerName: interviewer, outcome, candStatus: outcome === 'Selected' ? 'selected' : outcome === 'Not Suitable' ? 'rejected' : 'interviewing' }); };

  return (
    <div style={{ marginTop: 10, padding: 14, borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Interview Assessment — {c.Name}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Field l="Position"><input style={input} value={f.position} onChange={e => set('position', e.target.value)} /></Field>
        <Field l="Department"><input style={input} value={f.department} onChange={e => set('department', e.target.value)} /></Field>
        <Field l="Qualification"><input style={input} value={f.qualification} onChange={e => set('qualification', e.target.value)} /></Field>
        <Field l="Experience"><input style={input} value={f.experience} onChange={e => set('experience', e.target.value)} /></Field>
        <Field l="Current CTC"><input style={input} value={f.currentCtc} onChange={e => set('currentCtc', e.target.value)} /></Field>
        <Field l="Expected CTC"><input style={input} value={f.expectedCtc} onChange={e => set('expectedCtc', e.target.value)} /></Field>
        <Field l="Notice period"><input style={input} value={f.noticePeriod} onChange={e => set('noticePeriod', e.target.value)} /></Field>
        <Field l="DOB"><input type="date" style={input} value={f.dob} onChange={e => set('dob', e.target.value)} /></Field>
        <Field l="Marital status"><input style={input} value={f.maritalStatus} onChange={e => set('maritalStatus', e.target.value)} /></Field>
        <Field l="Source / reference"><input style={input} value={f.source} onChange={e => set('source', e.target.value)} /></Field>
        <Field l="Interviewed earlier?"><select style={input} value={f.interviewedEarlier} onChange={e => set('interviewedEarlier', e.target.value)}><option>No</option><option>Yes</option></select></Field>
      </div>
      <div style={label}>Evaluation (mark one rating per criterion)</div>
      {ASSESS_CRITERIA.map(crit => (
        <div key={crit} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{ minWidth: 150, fontSize: '.82rem', color: 'var(--text-primary)' }}>{crit}</span>
          {ASSESS_RATINGS.map(rt => (
            <label key={rt.v} style={{ fontSize: '.76rem', color: 'var(--text-muted)' }}>
              <input type="radio" name={`r-${c.Id}-${crit}`} checked={f.ratings[crit] === rt.v} onChange={() => setRating(crit, rt.v)} style={{ marginRight: 3 }} />{rt.l} ({rt.v})
            </label>
          ))}
          <input placeholder="Comment" style={{ ...input, marginBottom: 0, maxWidth: 150, padding: '4px 8px' }} value={f.comments[crit] || ''} onChange={e => setComment(crit, e.target.value)} />
        </div>
      ))}
      <Field l="Knowledge"><textarea style={{ ...input, minHeight: 38 }} value={f.knowledge} onChange={e => set('knowledge', e.target.value)} /></Field>
      <Field l="Experience"><textarea style={{ ...input, minHeight: 38 }} value={f.experienceInput} onChange={e => set('experienceInput', e.target.value)} /></Field>
      <Field l="Exposure"><textarea style={{ ...input, minHeight: 38 }} value={f.exposure} onChange={e => set('exposure', e.target.value)} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field l="Interviewer name"><input style={input} value={interviewer} onChange={e => setInterviewer(e.target.value)} /></Field>
        <Field l="Date"><input type="date" style={input} value={f.date} onChange={e => set('date', e.target.value)} /></Field>
      </div>
      <div style={label}>Status</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {['Selected', 'On Hold', 'Not Suitable'].map(o => (
          <span key={o} onClick={() => setOutcome(o)} style={{ ...chip(outcome === o), borderColor: outcome === o ? (OUTCOME_META[o]) : 'var(--border)', color: outcome === o ? '#fff' : 'var(--text-primary)', background: outcome === o ? OUTCOME_META[o] : 'var(--bg-base)' }}>{o}</span>
        ))}
      </div>
      <button style={primaryBtn} onClick={submit}>Save assessment</button>
    </div>
  );
};

// Stage-8 acceptance for the selected candidate (documents + acceptance dates)
const RecCandidateAcceptance = ({ c, api, reload, user }) => {
  const docs = (() => { try { return JSON.parse(c.Documents || '[]'); } catch { return REC_DOCS.map(d => ({ ...d, received: false })); } })();
  const dv = (d) => d ? new Date(d).toISOString().slice(0, 10) : '';
  const save = (patch) => api(`/recruitment/candidates/${c.Id}`, 'PUT', patch).then(d => { if (d.success) reload(); else window.alert(d.error || 'Failed.'); });
  const toggleDoc = (key) => save({ documents: docs.map(d => d.key === key ? { ...d, received: !d.received } : d) });
  const upload = (key, file) => { const rd = new FileReader(); rd.onload = async () => { const d = await api(`/recruitment/candidates/${c.Id}/upload`, 'POST', { key, fileName: file.name, dataBase64: rd.result }); if (d.success) reload(); else window.alert(d.error || 'Upload failed.'); }; rd.readAsDataURL(file); };
  const viewFile = async (key) => { try { const res = await fetch(`${URA_API}/recruitment/candidates/${c.Id}/file/${key}`, { headers: { 'x-user-role': user?.role || '', 'x-user-id': user?.empId || '' } }); if (!res.ok) return window.alert('Could not open (' + res.status + ').'); const b = await res.blob(); const u = URL.createObjectURL(b); window.open(u, '_blank'); setTimeout(() => URL.revokeObjectURL(u), 60000); } catch { window.alert('Could not reach server.'); } };
  const delFile = async (key, lbl) => { if (!window.confirm(`Remove the file for "${lbl}"?`)) return; const d = await api(`/recruitment/candidates/${c.Id}/file/${key}`, 'DELETE'); if (d.success) reload(); };
  return (
    <div>
      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Acceptance & Pre-Onboarding — {c.Name}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field l="Offer acceptance"><input type="date" style={input} defaultValue={dv(c.OfferAcceptedDate)} onBlur={e => save({ offerAcceptedDate: e.target.value })} /></Field>
        <Field l="Resignation acceptance"><input type="date" style={input} defaultValue={dv(c.ResignationAcceptedDate)} onBlur={e => save({ resignationAcceptedDate: e.target.value })} /></Field>
        <Field l="Joining date"><input type="date" style={input} defaultValue={dv(c.JoiningDate)} onBlur={e => save({ joiningDate: e.target.value })} /></Field>
      </div>
      {c.JoiningDate && <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: 0 }}>Document deadline (7 days before joining): <strong>{new Date(new Date(c.JoiningDate).getTime() - 7 * 86400000).toISOString().slice(0, 10)}</strong></p>}
      <div style={label}>Documents (tick when received; upload optional)</div>
      {docs.map(d => (
        <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
          <label style={{ flex: 1, fontSize: '.85rem', color: 'var(--text-primary)' }}><input type="checkbox" checked={!!d.received} onChange={() => toggleDoc(d.key)} style={{ marginRight: 8 }} />{d.label}</label>
          {d.fileName && <span style={{ fontSize: '.76rem', color: 'var(--text-muted)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.fileName}</span>}
          {d.fileName && <button style={{ ...ghostBtn, padding: '3px 9px', fontSize: '.74rem', marginBottom: 0 }} onClick={() => viewFile(d.key)}>View</button>}
          {d.fileName && <button style={{ ...ghostBtn, padding: '3px 9px', fontSize: '.74rem', marginBottom: 0, color: '#dc2626', borderColor: '#dc2626' }} onClick={() => delFile(d.key, d.label)}>Delete</button>}
          <label style={{ ...ghostBtn, padding: '3px 9px', fontSize: '.74rem', cursor: 'pointer', marginBottom: 0 }}>{d.fileName ? 'Replace' : 'Upload'}<input type="file" style={{ display: 'none' }} onChange={e => e.target.files[0] && upload(d.key, e.target.files[0])} /></label>
        </div>
      ))}
      <Field l="Engagement notes"><textarea style={{ ...input, minHeight: 44, marginTop: 8 }} defaultValue={c.EngagementNotes || ''} onBlur={e => save({ engagementNotes: e.target.value })} /></Field>
    </div>
  );
};

/* ── Landing buttons ─────────────────────────────────────────────────────── */
const BUTTONS = [
  { id: 'recruitment', title: 'Recruitment', desc: 'Full hiring pipeline — requisition through offer acceptance.', grad: 'linear-gradient(135deg,#0c1a40,#2563eb)', roles: ['hr', 'manager', 'hod', 'interviewer', 'admin'] },
  { id: 'onboarding', title: 'User ID Allocation', desc: 'Onboard a new joiner and assign their Employee ID.', grad: 'linear-gradient(135deg,#0c1a40,#2563eb)', roles: ['admin'] },
  { id: 'assets', title: 'Asset Management', desc: 'Allocate assets and let employees confirm receipt.', grad: 'linear-gradient(135deg,#0a2010,#16a34a)', roles: ['it', 'admin', 'employee'] },
  { id: 'access', title: 'Application & Rights', desc: 'Request app access with manager + IT approval.', grad: 'linear-gradient(135deg,#1a1040,#7c3aed)', roles: ['it', 'manager', 'admin', 'employee'] },
  { id: 'overview', title: 'Employee Overview', desc: 'Search employees, view assets & rights, export to Excel.', grad: 'linear-gradient(135deg,#07212b,#0e7490)', roles: ['hr', 'it', 'admin'] },
  { id: 'matrix', title: 'Approval & Rights Matrix', desc: 'Admin-only. Assign or change any rights for anyone.', grad: 'linear-gradient(135deg,#2a0a0a,#b91c1c)', roles: ['admin'] },
  { id: 'directory', title: 'Directory Management', desc: 'Admin-only. Add or remove employees, with a full change log.', grad: 'linear-gradient(135deg,#0a2540,#1d4ed8)', roles: ['admin'] },
];

const UserRightsAssets = () => {
  const { user, isHr, isIt, isAdmin, isEmployee } = useAuth();
  const api = useApi();
  const r = user?.role || '';
  const me = user?.empId || '';
  const [view, setView] = useState('home');
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState({});
  const visible = BUTTONS.filter(b => b.roles.includes(r));

  useEffect(() => { api('/health').then(d => setOffline(!d.success)); }, [api]);

  // Pending items awaiting THIS user's action, per module (for the badges)
  useEffect(() => {
    let cancel = false;
    (async () => {
      const counts = {};
      try {
        const d = await api('/access');
        if (d.success) {
          const rows = d.records;
          if (isIt || isAdmin) counts.access = rows.filter(x => x.Status === 'hod_approved').length;
          else if (isEmployee) counts.access = rows.filter(x => (String(x.HodId) === me && x.Status === 'pending_hod') || (String(x.CreatedBy) === me && x.Status === 'it_given')).length;
        }
      } catch (_) {}
      try {
        if (isIt || isAdmin) {
          let n = 0;
          const sr = await api('/asset-requests'); if (sr.success) n += sr.records.filter(x => x.Status === 'pending').length;
          const al = await api('/assets'); if (al.success) n += al.records.filter(x => x.Status === 'credentials_sent' && !x.ITSubmittedAt).length;
          counts.assets = n;
        } else if (isEmployee) {
          const mine = await api(`/assets/by-emp/${encodeURIComponent(me)}`);
          if (mine.success && mine.record && ['credentials_sent', 'employee_review'].includes(mine.record.Status)) counts.assets = 1;
        }
      } catch (_) {}
      if (!cancel) setPending(counts);
    })();
    return () => { cancel = true; };
  }, [api, isIt, isAdmin, isEmployee, me, view]);

  const totalPending = Object.values(pending).reduce((a, b) => a + (b || 0), 0);

  const banner = offline ? (
    <div style={{ background: 'color-mix(in srgb, var(--accent-orange) 12%, transparent)', border: '1px solid var(--accent-orange)',
      borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: '.85rem', color: 'var(--accent-orange)' }}>
      The User Rights service isn’t reachable yet (port 5093). Start <code>backend-userrights</code> and set up the database — actions here won’t save until then.
    </div>
  ) : null;

  if (view === 'recruitment') return <>{banner}<RecruitmentView onBack={() => setView('home')} /></>;
  if (view === 'onboarding') return <><div style={{ padding: '0 0 0' }}>{banner}</div><OnboardingView onBack={() => setView('home')} /></>;
  if (view === 'assets') return <>{banner}<AssetsView onBack={() => setView('home')} /></>;
  if (view === 'access') return <>{banner}<AccessView onBack={() => setView('home')} /></>;
  if (view === 'overview') return <>{banner}<OverviewView onBack={() => setView('home')} /></>;
  if (view === 'matrix') return <>{banner}<MatrixView onBack={() => setView('home')} /></>;
  if (view === 'directory') return <>{banner}<DirectoryView onBack={() => setView('home')} /></>;

  return (
    <div>
      {banner}
      <div style={{ marginBottom: 22 }}>
        <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: '.68rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 5 }}>HR · IT · Manager</p>
        <h1 style={{ ...h2, fontSize: '1.6rem' }}>User Rights & Assets</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '.9rem', margin: 0 }}>Onboarding, asset allocation, and application access — each with two levels of approval.</p>
        {totalPending > 0 && (
          <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 8, background: 'color-mix(in srgb, var(--accent-orange) 12%, transparent)',
            border: '1px solid var(--accent-orange)', color: 'var(--accent-orange)', borderRadius: 999, padding: '6px 14px', fontSize: '.84rem', fontWeight: 700 }}>
            🔔 You have {totalPending} item{totalPending > 1 ? 's' : ''} awaiting your action
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 16 }}>
        {visible.map(b => (
          <div key={b.id} onClick={() => setView(b.id)} style={{ position: 'relative', background: b.grad, borderRadius: 14, padding: 22, cursor: 'pointer', color: '#fff',
            minHeight: 130, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 6px 22px rgba(0,0,0,0.28)' }}>
            {pending[b.id] > 0 && (
              <span style={{ position: 'absolute', top: 12, right: 12, background: '#dc2626', color: '#fff', borderRadius: 999, minWidth: 24, height: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.76rem', fontWeight: 800, padding: '0 7px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>{pending[b.id]}</span>
            )}
            <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: '1.15rem' }}>{b.title}</div>
            <div style={{ fontSize: '.84rem', opacity: .85, marginTop: 8 }}>{b.desc}{pending[b.id] > 0 ? ` · ${pending[b.id]} pending` : ''}</div>
          </div>
        ))}
        {visible.length === 0 && <Empty text="Your role has no actions here. Sign in as HR, IT, or Manager." />}
      </div>
    </div>
  );
};

export default UserRightsAssets;
