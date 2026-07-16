import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import api from '../api';
import { todayISO, fmtDMY } from '../utils/date';
import Modal from '../components/Modal';

const STATUS_LABEL = {
  draft: 'Draft', submitted: 'Submitted', presented: 'Presented',
  approved: 'Approved', hold: 'Held', rejected: 'Rejected', expired: 'Expired', migrated: 'Migrated',
};
const STATUS_CLASS = { approved: 'ok', hold: 'hold', rejected: 'rej', expired: 'rej' };

export default function Page1() {
  const { reference } = useApp();
  const { push } = useToast();
  const today = todayISO();

  const [subTab, setSubTab] = useState('entries');
  const [dateView, setDateView] = useState('today');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  const [qeNfa, setQeNfa] = useState('');
  const [qeIndex, setQeIndex] = useState('MEP');
  const [qeWt, setQeWt] = useState('A');
  const [qeDate, setQeDate] = useState(today);
  const [showModeB, setShowModeB] = useState(false);

  const [pendingConfirm, setPendingConfirm] = useState(null);
  const [resubComment, setResubComment] = useState('');
  const [publishedPdfs, setPublishedPdfs] = useState([]);
  const [searchNfa, setSearchNfa] = useState('');
  const [searchResult, setSearchResult] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.listEntries(dateView);
      setEntries(data);
    } catch (e) {
      push(e.response?.data?.error || 'Failed to load entries', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [dateView]);
  useEffect(() => { if (subTab === 'pdfs') api.publishedPdfs().then(setPublishedPdfs).catch(() => {}); }, [subTab]);

  async function doFetch() {
    if (!qeNfa.trim()) return push('Enter an NFA number', 'error');
    try {
      const res = await api.fetchNfa({ nfa: qeNfa.trim(), index: qeIndex, wt: qeWt, date: qeDate });
      const d = res.data;
      if (d.created) push(`NFA ${qeNfa} fetched — draft created for ${fmtDMY(qeDate)}`);
      else if (d.repull) push(`Re-pulled ${qeNfa} — ${d.replaced} file(s) replaced, ${d.restored} restored${d.autoDeselected ? ' (locked sheet: auto-deselected)' : ''}`);
      else if (d.draftRetargeted) push(`Draft retargeted to ${qeIndex}/${qeWt}/${fmtDMY(qeDate)}`);
      else if (d.pendingMoveStaged) push(d.chip, 'warn');
      setQeNfa('');
      load();
    } catch (e) {
      const data = e.response?.data;
      if (data?.offerModeB) {
        push('NFA not found in QMS — you can enter it via Mode B', 'error');
        setShowModeB(true);
      } else {
        push(data?.error || 'Fetch failed', 'error');
      }
    }
  }

  async function toggleSelect(entry) {
    try {
      await api.selectEntry(entry.id, !entry.sel);
      load();
    } catch (e) { push(e.response?.data?.error || 'Failed', 'error'); }
  }

  async function doSubmit(entry, comment) {
    try {
      const res = await api.submitEntry(entry.id, comment);
      const d = res.data;
      if (d.submitted) push(`${entry.nfa} submitted — review date ${fmtDMY(entry.date)}`);
      else if (d.withdrawn) push(`${entry.nfa} withdrawn`);
      else if (d.relocated) push(`${entry.nfa} relocated`);
      else if (d.convertedToFreshEntry) push(`${entry.nfa} — old date published; converted to a fresh entry`, 'warn');
      setPendingConfirm(null);
      setResubComment('');
      load();
    } catch (e) {
      const data = e.response?.data;
      if (data?.requiresComment) {
        setPendingConfirm({ entry, requiresComment: true });
      } else {
        push(data?.error || 'Submit failed', 'error');
      }
    }
  }

  async function doSearch() {
    if (!searchNfa.trim()) return;
    try {
      const data = await api.searchNfa(searchNfa.trim());
      setSearchResult(data);
    } catch (e) { push(e.response?.data?.error || 'Search failed', 'error'); }
  }

  const filteredEntries = entries;

  return (
    <div className="pagewrap">
      <div className="subtabs">
        {['entries', 'pdfs', 'search'].map((t) => (
          <button key={t} className={`stab ${subTab === t ? 'active' : ''}`} onClick={() => setSubTab(t)}>
            {t === 'entries' ? 'My Entries' : t === 'pdfs' ? 'Published PDFs' : 'NFA Search & History'}
          </button>
        ))}
        <div className="spacer" />
        {subTab === 'entries' && (
          <div className="p1datebox">
            <span>Entry Date View:</span>
            <select className="inp" value={dateView} onChange={(e) => setDateView(e.target.value)}>
              <option value="today">Today (+ all future)</option>
              <option value="custom">Choose date…</option>
            </select>
            {dateView === 'custom' && (
              <input type="date" className="inp" min={today} onChange={(e) => setDateView(e.target.value)} />
            )}
          </div>
        )}
      </div>

      {subTab === 'entries' && (
        <div className="surface">
          <div className="qentry">
            <div className="field">
              <label>NFA No.</label>
              <input className="inp" value={qeNfa} onChange={(e) => setQeNfa(e.target.value)} placeholder="e.g. 14315" />
            </div>
            <div className="field">
              <label>Index</label>
              <select className="inp" value={qeIndex} onChange={(e) => setQeIndex(e.target.value)}>
                {reference && Object.keys(reference.indexNames).map((k) => (
                  <option key={k} value={k}>{reference.indexNames[k]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Work Type</label>
              <select className="inp" value={qeWt} onChange={(e) => setQeWt(e.target.value)}>
                {reference && Object.keys(reference.workTypes).map((k) => (
                  <option key={k} value={k}>{k} — {reference.workTypes[k]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Review Date</label>
              <input type="date" className="inp" value={qeDate} min={today} onChange={(e) => setQeDate(e.target.value)} />
            </div>
            <button className="btn primary" onClick={doFetch}>Fetch from QMS</button>
            <button className="modeb" onClick={() => setShowModeB(true)}>+ Mode B (manual entry)</button>
          </div>

          <div className="toolbar">
            <b>{loading ? 'Loading…' : `${filteredEntries.length} entr${filteredEntries.length === 1 ? 'y' : 'ies'}`}</b>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="empty">No entries for this view.</div>
          ) : (
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th></th><th>NFA No.</th><th>Index</th><th>WT</th><th>Review Date</th>
                    <th>Project / Description</th><th>Vendor</th><th>Value (₹L)</th><th>Status</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((e) => (
                    <tr key={e.id} className={e.status === 'draft' ? '' : 'rowdim'}>
                      <td>
                        {(e.status === 'draft' || e.status === 'submitted') && (
                          <input type="checkbox" className="cbx" checked={e.sel} onChange={() => toggleSelect(e)} />
                        )}
                      </td>
                      <td>
                        <span className="nfa">{e.nfa}</span>
                        {e.initDt && <div className="sub">(Initiated on {fmtDMY(e.initDt)})</div>}
                        {e.isProxy && <span className="redstar">*</span>}
                        {e.resubReq && <span className="badge resub">RESUBMIT</span>}
                        {e.pmv && (
                          <div className="pmvchip">
                            Pending move from {e.pmv.fromIndex}·{fmtDMY(e.pmv.fromDate)} — submit to apply · previous entry still on Page 2.
                          </div>
                        )}
                      </td>
                      <td>{e.pmv ? e.pmv.index : e.index}</td>
                      <td>{e.pmv ? e.pmv.wt : e.wt}</td>
                      <td>{fmtDMY(e.pmv ? e.pmv.date : e.date)}</td>
                      <td>{e.f?.project} — {e.f?.desc}</td>
                      <td>{e.f?.vendor}</td>
                      <td>{e.f?.val}</td>
                      <td><span className={`st ${STATUS_CLASS[e.status] || 'grey'}`}>{STATUS_LABEL[e.status] || e.status}</span></td>
                      <td>
                        {(e.status === 'draft' || e.status === 'submitted') && (
                          <button className="btn sm" onClick={() => doSubmit(e)}>
                            {e.pmv ? 'Submit (apply move)' : e.sel ? 'Submit' : 'Withdraw'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subTab === 'pdfs' && (
        <div className="surface">
          <div className="tablewrap">
            <table>
              <thead><tr><th>Index</th><th>Review Date</th><th>Revision</th><th>Published By</th><th>Published At</th><th>Decided</th><th></th></tr></thead>
              <tbody>
                {publishedPdfs.map((p, i) => (
                  <tr key={i}>
                    <td>{p.IndexName}</td>
                    <td>{new Date(p.ReviewDate).toDateString()}</td>
                    <td>{p.Revision}</td>
                    <td>{p.PublishedBy}</td>
                    <td>{new Date(p.PublishedAt).toLocaleString()}</td>
                    <td>{p.DecidedCount}</td>
                    <td>
                      <a className="minibtn" href={api.pdfUrl(p.IndexName, new Date(p.ReviewDate).toISOString().slice(0, 10))} target="_blank" rel="noreferrer">Open PDF</a>
                    </td>
                  </tr>
                ))}
                {publishedPdfs.length === 0 && <tr><td colSpan={7} className="empty">No published PDFs yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'search' && (
        <div className="surface">
          <div className="toolbar">
            <input className="inp" placeholder="NFA number" value={searchNfa} onChange={(e) => setSearchNfa(e.target.value)} />
            <button className="btn primary" onClick={doSearch}>Search</button>
          </div>
          {searchResult && (
            <div>
              <h4 style={{ marginBottom: 8 }}>Entries</h4>
              <div className="tablewrap" style={{ marginBottom: 14 }}>
                <table>
                  <thead><tr><th>Index</th><th>WT</th><th>Date</th><th>Status</th><th>Entered By</th></tr></thead>
                  <tbody>
                    {searchResult.entries.map((e) => (
                      <tr key={e.Id}><td>{e.IndexName}</td><td>{e.WorkType}</td><td>{new Date(e.ReviewDate).toDateString()}</td><td>{e.Status}</td><td>{e.EnteredBy}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h4 style={{ marginBottom: 8 }}>Sitting history</h4>
              <div className="tablewrap" style={{ marginBottom: 14 }}>
                <table>
                  <thead><tr><th>Work Type</th><th>Decision</th><th>MC Comment</th><th>Relocated?</th></tr></thead>
                  <tbody>
                    {searchResult.history.map((h) => (
                      <tr key={h.Id}><td>{h.WorkType}</td><td>{h.Decision || 'undecided'}</td><td>{h.McComment}</td><td>{h.RelocatedTo || '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h4 style={{ marginBottom: 8 }}>Orders</h4>
              <div className="tablewrap">
                <table>
                  <thead><tr><th>Order No.</th><th>Type</th><th>Vendor</th></tr></thead>
                  <tbody>
                    {searchResult.orders.map((o) => (
                      <tr key={o.Id}><td>{o.OrderNo}</td><td>{o.OrderType}</td><td>{o.Vendor}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {showModeB && (
        <ModeBForm
          reference={reference}
          today={today}
          onClose={() => setShowModeB(false)}
          onCreated={() => { setShowModeB(false); load(); }}
        />
      )}

      {pendingConfirm?.requiresComment && (
        <Modal
          title="Mandatory resubmission comment"
          onClose={() => setPendingConfirm(null)}
          actions={<>
            <button className="btn ghost" onClick={() => setPendingConfirm(null)}>Cancel</button>
            <button className="btn primary" onClick={() => doSubmit(pendingConfirm.entry, resubComment)}>Submit</button>
          </>}
        >
          <p>The old review date has published while this move was pending. This converts to a fresh entry — a resubmission comment is required.</p>
          <textarea className="inp" style={{ width: '100%', minHeight: 70 }} value={resubComment} onChange={(e) => setResubComment(e.target.value)} />
        </Modal>
      )}
    </div>
  );
}

function ModeBForm({ reference, today, onClose, onCreated }) {
  const { push } = useToast();
  const [index, setIndex] = useState('MEP');
  const [wt, setWt] = useState('A');
  const [date, setDate] = useState(today);
  const [initiator, setInitiator] = useState('');
  const [fields, setFields] = useState({ project: '', location: '', desc: '', vendor: '', val: '', reason: '', vendPQ: '', prBudget: '', initBy: '', rateVal: '' });

  async function submit() {
    try {
      await api.createModeB({ index, wt, date, initiator, fields });
      push('Mode B entry created');
      onCreated();
    } catch (e) { push(e.response?.data?.error || 'Failed to create', 'error'); }
  }

  return (
    <Modal
      title="Mode B — Manual NFA Entry"
      onClose={onClose}
      actions={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={submit}>Create</button>
      </>}
    >
      <p style={{ color: '#666' }}>An interim reference (e.g. EM/07-26/001) is auto-issued and should be cited in QMS at NFA initiation. Manual linking is via the Remarks breadcrumb.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="field"><label>Index</label>
          <select className="inp" value={index} onChange={(e) => setIndex(e.target.value)}>
            {reference && Object.keys(reference.indexNames).map((k) => <option key={k} value={k}>{reference.indexNames[k]}</option>)}
          </select>
        </div>
        <div className="field"><label>Work Type</label>
          <select className="inp" value={wt} onChange={(e) => setWt(e.target.value)}>
            {reference && Object.keys(reference.workTypes).map((k) => <option key={k} value={k}>{k} — {reference.workTypes[k]}</option>)}
          </select>
        </div>
        <div className="field"><label>Review Date</label><input type="date" className="inp" value={date} min={today} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="field"><label>Initiator (free text)</label><input className="inp" value={initiator} onChange={(e) => setInitiator(e.target.value)} /></div>
        <div className="field"><label>Project</label><input className="inp" value={fields.project} onChange={(e) => setFields({ ...fields, project: e.target.value })} /></div>
        <div className="field"><label>Location</label><input className="inp" value={fields.location} onChange={(e) => setFields({ ...fields, location: e.target.value })} /></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}><label>Description</label><input className="inp" style={{ width: '100%' }} value={fields.desc} onChange={(e) => setFields({ ...fields, desc: e.target.value })} /></div>
        <div className="field"><label>Vendor</label><input className="inp" value={fields.vendor} onChange={(e) => setFields({ ...fields, vendor: e.target.value })} /></div>
        <div className="field"><label>Value (₹L)</label><input className="inp" value={fields.val} onChange={(e) => setFields({ ...fields, val: e.target.value })} /></div>
        <div className="field"><label>PR Budget Value</label><input className="inp" value={fields.prBudget} onChange={(e) => setFields({ ...fields, prBudget: e.target.value })} /></div>
        <div className="field"><label>No. of Considered Vendors &amp; PQ</label><input className="inp" value={fields.vendPQ} onChange={(e) => setFields({ ...fields, vendPQ: e.target.value })} /></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}><label>Reason for this New Work/Variation</label><input className="inp" style={{ width: '100%' }} value={fields.reason} onChange={(e) => setFields({ ...fields, reason: e.target.value })} /></div>
        <div className="field"><label>NFA Initiated By</label>
          <select className="inp" value={fields.initBy} onChange={(e) => setFields({ ...fields, initBy: e.target.value })}>
            <option value="">—</option>
            {reference && reference.initiatedByOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="field"><label>Validation of Rates</label>
          <select className="inp" value={fields.rateVal} onChange={(e) => setFields({ ...fields, rateVal: e.target.value })}>
            <option value="">—</option>
            {reference && reference.rateValidations.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  );
}
