import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import api from '../api';
import { todayISO, fmtDMY } from '../utils/date';
import EndOfSheetMarker from '../components/EndOfSheetMarker';
import Modal from '../components/Modal';

const COLS = 7;

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
    try { await api.setMcComment(index, date, row.id, comment); } catch (e) { /* saved best-effort on blur */ }
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

  return (
    <div className="pagewrap">
      <div className="surface">
        <div className="toolbar">
          <div className="field">
            <label>Index</label>
            <select className="inp" value={index} onChange={(e) => setIndex(e.target.value)}>
              {reference && Object.keys(reference.indexNames).map((k) => <option key={k} value={k}>{reference.indexNames[k]}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Meeting Date</label>
            <input type="date" className="inp" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
          </div>
          {sheet && <span className="chip">Locked snapshot v{sheet.version}</span>}
          <span className="chip">{decidedCount} / {rows.length} decided</span>
          {sheet?.publishedRev > 0 && <span className="chip">Published</span>}
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
                  <th>NFA No.</th><th>WT</th><th>Project / Desc.</th><th>Vendor</th><th>Value</th><th>Decision</th><th>MC Comment</th>
                </tr>
              </thead>
              <tbody>
                {workTypes.map((wt) => (
                  <FragmentGroup key={wt} wt={wt} label={reference?.workTypes?.[wt]}>
                    {grouped[wt].map((r) => (
                      <tr key={r.id} className={r.relocatedTo ? 'rowdim' : ''}>
                        <td>
                          <span className="nfa">{r.nfa}</span>
                          {r.f?.initDt && <div className="sub">(Initiated on {fmtDMY(r.f.initDt)})</div>}
                          {r.relocatedTo && <div className="sub" style={{ color: '#9A6700' }}>live entry relocated to {r.relocatedTo} — decisions record to NFA history only</div>}
                        </td>
                        <td>{r.wt}</td>
                        <td>{r.f?.project} — {r.f?.desc}</td>
                        <td>{r.f?.vendor}</td>
                        <td>₹{r.f?.val} L</td>
                        <td>
                          <button className={`decbtn g ${r.decision === 'approved' ? 'sel' : r.decision ? 'dim' : ''}`} title="Approve" onClick={() => setDecision(r, 'approved')}>👍</button>
                          <button className={`decbtn y ${r.decision === 'hold' ? 'sel' : r.decision ? 'dim' : ''}`} title="Hold" onClick={() => setDecision(r, 'hold')}>⏸</button>
                          <button className={`decbtn r ${r.decision === 'rejected' ? 'sel' : r.decision ? 'dim' : ''}`} title="Reject" onClick={() => setDecision(r, 'rejected')}>👎</button>
                          {!r.decision && <div className="pend">pending — excluded from PDF if undecided</div>}
                        </td>
                        <td>
                          <div className="cellinput" contentEditable suppressContentEditableWarning
                            onBlur={(ev) => setComment(r, ev.target.textContent)}>
                            {r.mcComment}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </FragmentGroup>
                ))}
                <EndOfSheetMarker colSpan={COLS} />
              </tbody>
            </table>
          </div>
        )}
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
      <tr className="band"><td colSpan={COLS}>{wt} — {label}</td></tr>
      {children}
    </>
  );
}
