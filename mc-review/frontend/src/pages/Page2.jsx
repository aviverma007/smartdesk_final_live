import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import api from '../api';
import { todayISO, fmtDMY, addDaysISO } from '../utils/date';
import EndOfSheetMarker from '../components/EndOfSheetMarker';
import Modal from '../components/Modal';

const COLS = 11;

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
      await api.setPresentToMc(index, date, e.id, !e.mc);
      load();
    } catch (err) { push(err.response?.data?.error || 'Failed', 'error'); }
  }

  async function touch(e, field, value) {
    try {
      await api.touchCell(index, date, e.id, field, value);
    } catch (err) { push(err.response?.data?.error || 'Failed', 'error'); }
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
  const workTypes = Object.keys(grouped).sort();

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
          {viewOnly && <span className="viewbadge">VIEW-ONLY MODE</span>}
          {sheet?.locked && <span className="chip">Locked v{sheet.version}</span>}
          {sheet?.publishedRev > 0 && <span className="chip">Published</span>}
          <div className="spacer" />
          {canAct && !sheet?.publishedRev && (
            <>
              <button className="btn" onClick={() => setShowMigrate(true)}>Migrate sheet</button>
              <button className="btn primary" onClick={doLock}>Lock sheet → Page 3</button>
            </>
          )}
        </div>

        {loading ? <div className="empty">Loading…</div> : entries.length === 0 ? (
          <div className="empty">No entries on this sheet.</div>
        ) : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>NFA No.</th><th>WT</th><th>Project / Desc.</th><th>Vendor</th>
                  <th>Original Value</th><th>Reason</th><th>Validation of Rates</th>
                  <th>Considered Vendors &amp; PQ</th><th>Downloadable Files</th><th>Flags</th><th>Present to MC</th>
                </tr>
              </thead>
              <tbody>
                {workTypes.map((wt) => (
                  <FragmentGroup key={wt} wt={wt} label={reference?.workTypes?.[wt]}>
                    {grouped[wt].map((e) => (
                      <tr key={e.id} className={e.sel ? '' : 'rowdim'}>
                        <td>
                          <span className="nfa">{e.nfa}</span>
                          {e.initDt && <div className="sub">(Initiated on {fmtDMY(e.initDt)})</div>}
                          {e.resubReq && <span className="badge resub">RESUBMIT</span>}
                        </td>
                        <td>{e.wt}</td>
                        <td>{e.f?.project} — {e.f?.desc}</td>
                        <td>{e.f?.vendor}</td>
                        <td>₹{e.f?.val} L</td>
                        <td>
                          {viewOnly ? e.f?.reason : (
                            <div className="cellinput" contentEditable={canAct && !viewOnly} suppressContentEditableWarning
                              onBlur={(ev) => touch(e, 'reason', ev.target.textContent)}>
                              {e.f?.reason}
                            </div>
                          )}
                        </td>
                        <td>{e.f?.rateVal || '—'}</td>
                        <td>{e.f?.vendPQ}</td>
                        <td>
                          {(e.files || []).map((f, i) => (
                            <span key={i} className="minibtn">{f.n}</span>
                          ))}
                        </td>
                        <td>{e.resubReq ? <span className="badge resub">flag</span> : '—'}</td>
                        <td>
                          {viewOnly ? (e.mc ? 'Yes' : 'No') : (
                            <input type="checkbox" className="cbx" checked={e.mc} disabled={!canAct} onChange={() => togglePresent(e)} />
                          )}
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

function FragmentGroup({ wt, label, children }) {
  return (
    <>
      <tr className="band"><td colSpan={COLS}>{wt} — {label}</td></tr>
      {children}
    </>
  );
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
