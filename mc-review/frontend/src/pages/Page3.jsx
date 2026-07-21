import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import api from '../api';
import { todayISO, fmtDMY } from '../utils/date';
import EndOfSheetMarker from '../components/EndOfSheetMarker';
import FileChips from '../components/FileChips';
import Modal from '../components/Modal';

// Exact column order from the reference prototype: S.No, PR No., Project,
// Location, Creator, NFA Initiated By, Description, Duration, Vendor Name,
// PR Budget, Orig. Value, Last Amend., This Variation, Revised Value,
// Reason, Validation of Rates, Vendors&PQ, NFA No., Pending With,
// resubmission remark, Downloadable Files, MC Comments, MC Approval/Status.
const COLS = 23;

export default function Page3() {
  const { isAdmin, reviewerIndex, reference } = useApp();
  const { push } = useToast();
  const today = todayISO();

  const [index, setIndex] = useState(reviewerIndex || 'MEP');
  const [date, setDate] = useState(today);
  const [sheet, setSheet] = useState(null);
  const [rows, setRows] = useState([]);
  const [decidedCount, setDecidedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [publishModal, setPublishModal] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.getMeeting(index, date);
      setSheet(data.sheet);
      setRows(data.rows || []);
      setDecidedCount(data.decidedCount || 0);
    } catch (e) { push(e.response?.data?.error || 'Failed to load', 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [index, date]);

  async function setDecision(row, decision) {
    try {
      await api.setDecision(index, date, row.id, decision);
      load();
    } catch (e) { push(e.response?.data?.error || 'Failed', 'error'); }
  }

  async function setComment(row, comment) {
    try { await api.setMcComment(index, date, row.id, comment); } catch (e) { /* best-effort */ }
  }

  async function doPublish(confirmed) {
    try {
      const res = await api.publish(index, date, confirmed);
      push(`Published — ${res.data.decidedCount} decided, ${res.data.undecidedCount} expired`);
      setPublishModal(null);
      load();
    } catch (e) {
      const data = e.response?.data;
      if (data?.requiresConfirm) {
        setPublishModal({ warning: data.warning });
      } else {
        push(data?.error || 'Publish failed', 'error');
      }
    }
  }

  const grouped = {};
  rows.forEach((r) => { (grouped[r.wt] = grouped[r.wt] || []).push(r); });
  const workTypes = Object.keys(grouped).sort();
  const publishDisabled = rows.length === 0 || sheet?.publishedRev > 0;

  const lockLabel = sheet
    ? `Locked snapshot v${sheet.version} · ${sheet.lockedAt ? new Date(sheet.lockedAt).toLocaleString() : ''}`
    : 'No locked snapshot yet — lock the sheet on Page 2 first';

  return (
    <div className="pagewrap">
      <div className="idxtabs">
        {['MEP', 'CIVIL'].map((i) => (
          <button key={i} className={`itab ${index === i ? 'active' : ''}`} onClick={() => setIndex(i)}>
            {reference?.indexNames?.[i] || i}
          </button>
        ))}
      </div>
      <div className="surface">
        <div className="sheethead">
          <div className="field">
            <label>Meeting date</label>
            <input type="date" className="inp" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
          </div>
          <span className={`lockstate ${sheet ? 'locked' : ''}`}>{lockLabel}</span>
          <span className="chip">{decidedCount} / {rows.length} decided</span>
          {sheet?.publishedRev > 0 && <span className="chip">Published Rev-{sheet.publishedRev}</span>}
          <div className="spacer" />
          <button className="btn primary" disabled={publishDisabled} onClick={() => doPublish(false)}>
            Publish {index}
          </button>
        </div>

        {loading ? <div className="empty">Loading…</div> : rows.length === 0 ? (
          <div className="empty">No NFAs for review.</div>
        ) : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>S.No</th><th>PR No.</th><th>Project</th><th>Location</th><th>Creator</th><th>NFA Initiated By</th>
                  <th>Description of Work</th><th>Duration</th><th>Vendor Name</th><th>PR Budget Value ₹L</th>
                  <th>Orig. Value ₹L (incl. GST)</th><th>Last Amend. ₹L</th><th>This Variation ₹L</th><th>Revised Value ₹L</th>
                  <th>Reason for this New work/variation</th><th>Validation of Rates</th><th>Vendors &amp; PQ</th>
                  <th>NFA No.</th><th>Pending With</th><th>Remark from NFA Creator (resubmission)</th>
                  <th>Downloadable Files</th><th>MC Comments</th><th>MC Approval / Status</th>
                </tr>
              </thead>
              <tbody>
                {workTypes.map((wt) => (
                  <FragmentGroup key={wt} wt={wt} label={reference?.workTypes?.[wt]}>
                    {grouped[wt].map((r, i) => (
                      <Page3Row
                        key={r.id}
                        row={r}
                        sno={i + 1}
                        published={sheet?.publishedRev > 0}
                        onDecide={(d) => setDecision(r, d)}
                        onComment={(c) => setComment(r, c)}
                      />
                    ))}
                  </FragmentGroup>
                ))}
                <EndOfSheetMarker colSpan={COLS} />
              </tbody>
            </table>
          </div>
        )}
        <div className="legendline">
          Yellow = operator-entered (MC comments) / user overrides · type MC comments directly in the cell (Excel-style) ·
          decisions: 👍 approve · ⏸ hold · 👎 reject — comments optional on all three · undecided rows are excluded from
          the PDF and expire · this table is the locked snapshot: Page 2 changes appear only after re-lock
        </div>
      </div>

      {publishModal && (
        <Modal
          title="Confirm publish"
          onClose={() => setPublishModal(null)}
          actions={<>
            <button className="btn ghost" onClick={() => setPublishModal(null)}>Cancel</button>
            <button className="btn primary" onClick={() => doPublish(true)}>Publish anyway</button>
          </>}
        >
          <p>{publishModal.warning}</p>
        </Modal>
      )}
    </div>
  );
}

function FragmentGroup({ wt, label, children }) {
  return (
    <>
      <tr className="band"><td colSpan={COLS}>{wt}. {(label || '').toUpperCase()}</td></tr>
      {children}
    </>
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

function Page3Row({ row: r, sno, published, onDecide, onComment }) {
  return (
    <tr className={r.relocatedTo ? 'rowdim' : ''}>
      <td>{sno}</td>
      <td>{r.f?.pr || '—'}</td>
      <td>{r.f?.project}</td>
      <td>{r.f?.location}</td>
      <td>{r.f?.initiator}</td>
      <td>{r.f?.initBy || '—'}</td>
      <td>{r.f?.desc}</td>
      <td>{r.f?.duration || '—'}</td>
      <td>{r.f?.vendor}</td>
      <td>{r.f?.prBudget}</td>
      <td><b>{r.f?.val}</b></td>
      <td>{r.f?.lastAmd}</td>
      <td>{r.f?.variation}</td>
      <td><b>{revisedValLocal(r.f)}</b></td>
      <td>{r.f?.reason}</td>
      <td>{r.f?.rateVal || '—'}</td>
      <td>{r.f?.vendPQ}</td>
      <td className="nfa">
        {r.nfa}
        {r.f?.initDt && <div className="sub">(Initiated on {fmtDMY(r.f.initDt)})</div>}
        {r.relocatedTo && <div className="sub pmvchip">live entry relocated to {r.relocatedTo} — decisions record to NFA history only</div>}
      </td>
      <td>{r.f?.pendWith || '—'}</td>
      <td>{r.f?.resubComment || '—'}</td>
      <td><FileChips files={r.files} /></td>
      <td className="yellowcell">
        <div className="cellinput" contentEditable={!published} suppressContentEditableWarning
          onBlur={(ev) => onComment(ev.target.textContent)}>
          {r.mcComment}
        </div>
      </td>
      <td>
        {published ? (
          r.decision ? <span className={`st ${r.decision === 'approved' ? 'ok' : r.decision === 'hold' ? 'hold' : 'rej'}`}>{r.decision.toUpperCase()}</span> : <span className="st pend">—</span>
        ) : (
          <>
            <button className={`decbtn g ${r.decision === 'approved' ? 'sel' : r.decision ? 'dim' : ''}`} title="Approve" onClick={() => onDecide('approved')}>👍</button>
            <button className={`decbtn y ${r.decision === 'hold' ? 'sel' : r.decision ? 'dim' : ''}`} title="Hold" onClick={() => onDecide('hold')}>⏸</button>
            <button className={`decbtn r ${r.decision === 'rejected' ? 'sel' : r.decision ? 'dim' : ''}`} title="Reject" onClick={() => onDecide('rejected')}>👎</button>
            <div className="sub">
              {r.decision ? <b className={r.decision === 'approved' ? 'ok' : r.decision === 'hold' ? 'hold' : 'rej'}>{r.decision.toUpperCase()}</b> : <span className="pend">pending — excluded from PDF if undecided</span>}
            </div>
          </>
        )}
      </td>
    </tr>
  );
}
