import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import api from '../api';
import { todayISO, fmtDMY, addDaysISO } from '../utils/date';
import EndOfSheetMarker from '../components/EndOfSheetMarker';
import FileChips from '../components/FileChips';
import Modal from '../components/Modal';

// Exact column order from the reference prototype: S.No, PR No., NFA No.,
// Project, Location, Creator, NFA Initiated By, Description of Work,
// Duration, Vendor Name, PR Budget, Orig. Value, Last Amend., This
// Variation, Revised Order Value, Reason, Validation of Rates, Vendors&PQ,
// NFA Approval Pending With, Resubmission remark, [Entered By - admin only],
// Downloadable Files, Flags, Present to MC.
export default function Page2() {
  const { role, reviewerIndex, isAdmin, reference } = useApp();
  const { push } = useToast();
  const today = todayISO();

  const [index, setIndex] = useState(reviewerIndex || 'MEP');
  const [date, setDate] = useState(today);
  const [sheet, setSheet] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showMigrate, setShowMigrate] = useState(false);

  const viewOnly = role === 'user';
  const canAct = isAdmin || (role === 'revMEP' && index === 'MEP') || (role === 'revCIV' && index === 'CIVIL');
  const admin = isAdmin;
  const cols = admin ? 24 : 23;

  async function load() {
    setLoading(true);
    try {
      const data = await api.getSheet(index, date);
      setSheet(data.sheet);
      setEntries(data.entries);
    } catch (e) { push(e.response?.data?.error || 'Failed to load sheet', 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [index, date]);

  async function togglePresent(e) {
    try {
      const res = await api.setPresentToMc(index, date, e.id, !e.mc);
      if (res.data.unlocked) push('Sheet unlocked — Page 3 continues to show the last locked version', 'warn');
      load();
    } catch (err) { push(err.response?.data?.error || 'Failed', 'error'); }
  }

  async function touch(e, field, value) {
    try { await api.touchCell(index, date, e.id, field, value); load(); }
    catch (err) { push(err.response?.data?.error || 'Failed', 'error'); }
  }

  async function doLock() {
    try {
      const res = await api.lockSheet(index, date);
      push(`Sheet locked — v${res.data.version}`);
      load();
    } catch (e) { push(e.response?.data?.error || 'Lock failed', 'error'); }
  }

  const grouped = {};
  entries.forEach((e) => { (grouped[e.wt] = grouped[e.wt] || []).push(e); });
  Object.keys(grouped).forEach((wt) => {
    grouped[wt].sort((a, b) => (b.mc ? 1 : 0) - (a.mc ? 1 : 0) || a.id - b.id);
  });
  const workTypes = Object.keys(grouped).sort();
  const selCount = entries.filter((e) => e.mc).length;

  const lockStateLabel = sheet?.publishedRev
    ? `PUBLISHED Rev-${sheet.publishedRev} — sheet closed for this date`
    : sheet?.locked
      ? `SHEET LOCKED v${sheet.version} — any select/deselect will unlock; Page 3 shows v${sheet.version}`
      : sheet?.version > 0
        ? `SHEET UNLOCKED — Page 3 keeps showing snapshot v${sheet.version} until you lock again`
        : 'Not locked yet — Page 3 is empty for this sheet';

  return (
    <div className="pagewrap">
      <div className="surface">
        <div className="toolbar">
          <div className="field">
            <label>Index</label>
            <select className="inp" value={index} onChange={(e) => setIndex(e.target.value)} disabled={!isAdmin && role !== 'user'}>
              {reference && Object.keys(reference.indexNames).map((k) => <option key={k} value={k}>{reference.indexNames[k]}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Sheet Date</label>
            <input type="date" className="inp" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
          </div>
          <span className="counter"><b>{selCount} selected</b> of {entries.length} submitted</span>
          <span className={`lockstate ${sheet?.locked ? 'locked' : ''}`}>{lockStateLabel}</span>
          <div className="spacer" />
          {viewOnly ? (
            <span className="viewbadge">VIEW-ONLY — reviewer curates &amp; locks this sheet</span>
          ) : (
            <>
              <button className="btn ghost" disabled={sheet?.publishedRev > 0 || entries.length === 0} onClick={() => setShowMigrate(true)}>
                Migrate sheet (today ↔ +10 days) ▾
              </button>
              <button className="btn primary" disabled={sheet?.publishedRev > 0 || sheet?.locked} onClick={doLock}>
                Lock sheet → Page 3
              </button>
            </>
          )}
        </div>

        {loading ? <div className="empty">Loading…</div> : entries.length === 0 ? (
          <div className="empty">No submitted entries for this index + date yet.</div>
        ) : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>S.No</th><th>PR No.</th><th>NFA No.</th><th>Project</th><th>Location</th><th>Creator</th>
                  <th>NFA Initiated By</th><th>Description of Work</th><th>Duration</th><th>Vendor Name</th>
                  <th>PR Budget Value ₹L</th><th>Original Order Value ₹L (incl. GST)</th><th>Last Amend. Value ₹L</th>
                  <th>This Variation ₹L</th><th>Revised Order Value ₹L</th><th>Reason for this New work/variation</th>
                  <th>Validation of Rates</th><th>Vendors &amp; PQ</th><th>NFA Approval Pending With</th>
                  <th>Remark from NFA Creator (resubmission)</th>
                  {admin && <th>Entered By <em style={{ fontStyle: 'normal', fontSize: 8, border: '1px solid #C4CAD2', padding: '0 2px' }}>ADMIN</em></th>}
                  <th>Downloadable Files (shown on P2 &amp; P3)</th><th>Flags</th><th>Present to MC</th>
                </tr>
              </thead>
              <tbody>
                {workTypes.map((wt) => (
                  <FragmentGroup key={wt} wt={wt} label={reference?.workTypes?.[wt]} colSpan={cols}>
                    {grouped[wt].map((e, i) => (
                      <Page2Row
                        key={e.id}
                        entry={e}
                        sno={i + 1}
                        admin={admin}
                        canEdit={canAct && !sheet?.locked && !sheet?.publishedRev && ['submitted', 'presented'].includes(e.status)}
                        viewOnly={viewOnly}
                        publishedRev={sheet?.publishedRev}
                        onTogglePresent={() => togglePresent(e)}
                        onTouch={(field, value) => touch(e, field, value)}
                        reference={reference}
                      />
                    ))}
                  </FragmentGroup>
                ))}
                <EndOfSheetMarker colSpan={cols} />
              </tbody>
            </table>
          </div>
        )}
        <div className="legendline">
          Yellow = user-edited / manual / resubmit flag · <b className="redstar">*</b> red asterisk at field start = reviewer touch-up (audit-attributed) ·
          <b> *</b> on NFA Initiator = proxy entry · click a PR Budget / Reason / Vendors &amp; PQ / Resubmission cell to touch-up in place, or set the dropdowns (pre-lock) ·
          unselected entries stay at the bottom of their category and remain selectable · <b>nothing reaches Page 3 until you press Lock sheet</b>
          {viewOnly && <> · <b>your access here is view-only</b></>}
        </div>
      </div>

      {showMigrate && (
        <MigrateModal
          index={index} date={date} today={today}
          onClose={() => setShowMigrate(false)}
          onDone={() => { setShowMigrate(false); load(); }}
        />
      )}
    </div>
  );
}

function FragmentGroup({ wt, label, colSpan, children }) {
  return (
    <>
      <tr className="band"><td colSpan={colSpan}>{wt}. {(label || '').toUpperCase()}</td></tr>
      {children}
    </>
  );
}

function EditableCell({ value, canEdit, isUser, onSave }) {
  const [val, setVal] = useState(value || '');
  return (
    <td className={isUser ? 'edit' : ''}>
      {canEdit ? (
        <div className="cellinput" contentEditable suppressContentEditableWarning
          onBlur={(ev) => onSave(ev.target.textContent)}>
          {isUser && <span className="redstar">*</span>}{value}
        </div>
      ) : (
        <>{isUser && <span className="redstar">*</span>}{value}</>
      )}
    </td>
  );
}

function SelectCell({ value, options, canEdit, onSave }) {
  if (!canEdit) return <td>{value || '—'}</td>;
  return (
    <td>
      <select className="inp sm" defaultValue={value || ''} onChange={(e) => onSave(e.target.value)}>
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </td>
  );
}

function Page2Row({ entry: e, sno, admin, canEdit, viewOnly, publishedRev, onTogglePresent, onTouch, reference }) {
  const dim = !e.mc;
  const flagged = e.resubReq;

  const prBudget = e.hyb?.prBudget ? (e.hyb.prBudget.pfn ? e.hyb.prBudget.qms : (e.hyb.prBudget.user ?? e.hyb.prBudget.qms)) : e.f?.prBudget;
  const reason = e.hyb?.reason ? (e.hyb.reason.pfn ? e.hyb.reason.qms : (e.hyb.reason.user ?? e.hyb.reason.qms)) : e.f?.reason;
  const vendPQ = e.hyb?.vendPQ ? (e.hyb.vendPQ.pfn ? e.hyb.vendPQ.qms : (e.hyb.vendPQ.user ?? e.hyb.vendPQ.qms)) : e.f?.vendPQ;
  const revised = revisedValLocal(e.f);

  return (
    <tr className={dim ? 'rowdim' : ''}>
      <td>{sno}</td>
      <td>{e.f?.pr || '—'}</td>
      <td className="nfa">{e.nfa}{e.initDt && <div className="sub">(Initiated on {fmtDMY(e.initDt)})</div>}</td>
      <td>{e.f?.project}</td>
      <td>{e.f?.location}</td>
      <td>{e.initiator}{e.initiator !== e.enteredBy && <b className="redstar" title={`Proxy — entered by ${e.enteredBy}`}>*</b>}</td>
      <SelectCell value={e.f?.initBy} options={reference?.initiatedByOptions || []} canEdit={canEdit} onSave={(v) => onTouch('initBy', v)} />
      <td>{e.f?.desc}</td>
      <td>{e.f?.duration || '—'}</td>
      <td>{e.f?.vendor}</td>
      <EditableCell value={prBudget} canEdit={canEdit} isUser={e.hyb?.prBudget && !e.hyb.prBudget.pfn} onSave={(v) => onTouch('prBudget', v)} />
      <td><b>{e.f?.val}</b></td>
      <td>{e.f?.lastAmd}</td>
      <td>{e.f?.variation}</td>
      <td><b>{revised}</b></td>
      <EditableCell value={reason} canEdit={canEdit} isUser={e.hyb?.reason && !e.hyb.reason.pfn} onSave={(v) => onTouch('reason', v)} />
      <SelectCell value={e.f?.rateVal} options={reference?.rateValidations || []} canEdit={canEdit} onSave={(v) => onTouch('rateVal', v)} />
      <EditableCell value={vendPQ} canEdit={canEdit} isUser={e.hyb?.vendPQ && !e.hyb.vendPQ.pfn} onSave={(v) => onTouch('vendPQ', v)} />
      <td>{e.f?.pendWith || '—'}</td>
      <EditableCell value={e.resubComment} canEdit={canEdit} isUser={!!e.resubComment} onSave={(v) => onTouch('resubComment', v)} />
      {admin && <td>{e.enteredBy}</td>}
      <td><FileChips files={e.files} /></td>
      <td className={flagged ? 'yellowcell' : ''}>
        {flagged && <div>Resubmit flagged</div>}
        {e.mode === 'B' && <div>Mode B · interim reference</div>}
        {!e.mc && <div>not selected — held at bottom, still selectable</div>}
        {!flagged && e.mode !== 'B' && e.mc && <span className="st grey">—</span>}
      </td>
      <td style={{ textAlign: 'center' }}>
        {(publishedRev || viewOnly) ? (
          <input type="checkbox" className="cbx" disabled checked={e.mc} />
        ) : (
          <input type="checkbox" className="cbx" checked={e.mc} onChange={onTogglePresent} />
        )}
      </td>
    </tr>
  );
}

function revisedValLocal(f) {
  if (!f) return 'NA';
  const num = (s) => parseFloat(String(s ?? '').replace(/[^0-9.-]/g, ''));
  const v = num(f.variation);
  if (isNaN(v)) return 'NA';
  const lastAmd = num(f.lastAmd);
  const base = isNaN(lastAmd) ? num(f.val) : lastAmd;
  if (isNaN(base)) return 'NA';
  return String(Math.round((base + v) * 100) / 100);
}

function MigrateModal({ index, date, today, onClose, onDone }) {
  const { push } = useToast();
  const maxDate = addDaysISO(today, 10);
  const [toDate, setToDate] = useState(today);

  async function doMigrate() {
    try {
      const res = await api.migrateSheet(index, date, toDate);
      push(`Migrated ${res.data.count} entries to ${fmtDMY(toDate)}${res.data.arrivedDeselected ? ' (target locked: arrived deselected)' : ''}`);
      onDone();
    } catch (e) { push(e.response?.data?.error || 'Migrate failed', 'error'); }
  }

  return (
    <Modal
      title="Migrate sheet"
      onClose={onClose}
      actions={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={doMigrate}>Migrate</button>
      </>}
    >
      <p>Window: {fmtDMY(today)} to {fmtDMY(maxDate)}, either direction. Locked targets are allowed — arrivals land deselected.</p>
      <input type="date" className="inp" value={toDate} min={today} max={maxDate} onChange={(e) => setToDate(e.target.value)} />
    </Modal>
  );
}
