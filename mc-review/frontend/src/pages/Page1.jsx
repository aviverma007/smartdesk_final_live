import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import api from '../api';
import { todayISO, fmtDMY } from '../utils/date';
import Modal from '../components/Modal';
import FileChips from '../components/FileChips';

// Exact column order from the reference prototype (checkbox, S.No, NFA No.,
// Index, Work Type, Project, Description of Work, Vendor Name, Original
// Order Value, PR Budget Value, Creator, NFA Initiated By, Review Date,
// Downloadable Files, Status).
const COLS = 15;

export default function Page1() {
  const { reference } = useApp();
  const { push } = useToast();
  const today = todayISO();

  const [subTab, setSubTab] = useState('entries');
  const [dateView, setDateView] = useState('today');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterQ, setFilterQ] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const [qeNfa, setQeNfa] = useState('');
  const [qeIndex, setQeIndex] = useState('');
  const [qeWt, setQeWt] = useState('');
  const [qeDate, setQeDate] = useState(today);
  const [showModeB, setShowModeB] = useState(false);

  const [pendingConfirm, setPendingConfirm] = useState(null);
  const [resubComment, setResubComment] = useState('');
  const [publishedPdfs, setPublishedPdfs] = useState([]);
  const [searchNfa, setSearchNfa] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [stagedFiles, setStagedFiles] = useState([]);
  const [allNfas, setAllNfas] = useState([]);
  const [allNfasTotal, setAllNfasTotal] = useState(0);
  const [allNfasLoading, setAllNfasLoading] = useState(false);
  const [allNfasError, setAllNfasError] = useState(null);
  const [allNfasFilter, setAllNfasFilter] = useState('');
  const [allNfasPageSize, setAllNfasPageSize] = useState(100);

  async function loadStaged() {
    try { const d = await api.getStagedFiles(); setStagedFiles(d.staged || []); } catch { /* ignore */ }
  }

  async function onPickStagedFiles(fileList) {
    if (!fileList || !fileList.length) return;
    try {
      const res = await api.stageFiles(fileList);
      setStagedFiles(res.data.staged || []);
      push(`${fileList.length} file(s) staged for the next entry`);
    } catch (e) { push('Upload failed', 'error'); }
  }

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
  useEffect(() => { loadStaged(); }, []);
  useEffect(() => { if (subTab === 'pdfs') api.publishedPdfs().then(setPublishedPdfs).catch(() => {}); }, [subTab]);

  async function loadAllNfas(limit) {
    setAllNfasLoading(true);
    setAllNfasError(null);
    try {
      const data = await api.allNfas(limit, 0);
      setAllNfas(data.rows);
      setAllNfasTotal(data.total);
      setAllNfasPageSize(limit);
    } catch (e) {
      setAllNfasError(e.response?.data?.error || 'Failed to load NFAs from QMS');
    } finally {
      setAllNfasLoading(false);
    }
  }

  async function loadMoreNfas() {
    const nextLimit = allNfasPageSize + 100;
    setAllNfasLoading(true);
    try {
      const data = await api.allNfas(nextLimit, 0);
      setAllNfas(data.rows);
      setAllNfasTotal(data.total);
      setAllNfasPageSize(nextLimit);
    } catch (e) {
      setAllNfasError(e.response?.data?.error || 'Failed to load more');
    } finally {
      setAllNfasLoading(false);
    }
  }

  useEffect(() => {
    if (subTab !== 'allnfas') return;
    loadAllNfas(100);
  }, [subTab]);

  async function doFetch() {
    if (!qeNfa.trim() || !qeIndex || !qeWt) return push('NFA number, Index, and Work Type are required', 'error');
    try {
      const res = await api.fetchNfa({ nfa: qeNfa.trim(), index: qeIndex, wt: qeWt, date: qeDate });
      const d = res.data;
      if (d.created) push(`NFA ${qeNfa} fetched — draft created for ${fmtDMY(qeDate)}`);
      else if (d.repull) push(`Re-pulled ${qeNfa} — ${d.replaced} file(s) replaced, ${d.restored} restored${d.autoDeselected ? ' (locked sheet: auto-deselected)' : ''}`);
      else if (d.draftRetargeted) push(`Draft retargeted to ${qeIndex}/${qeWt}/${fmtDMY(qeDate)}`);
      else if (d.pendingMoveStaged) push(d.chip, 'warn');
      setQeNfa('');
      setStagedFiles([]);
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

  async function submitChecked() {
    const checked = entries.filter((e) => e.sel && (e.status === 'draft' || e.status === 'submitted' || e.pmv));
    for (const e of checked) {
      // eslint-disable-next-line no-await-in-loop
      await doSubmit(e);
    }
    if (checked.length === 0) push('Nothing checked to submit', 'error');
  }

  async function doSearch() {
    if (!searchNfa.trim()) return;
    try {
      const data = await api.searchNfa(searchNfa.trim());
      setSearchResult(data);
    } catch (e) { push(e.response?.data?.error || 'Search failed', 'error'); }
  }

  const filterLower = filterQ.toLowerCase();
  const filteredEntries = entries.filter((e) => {
    if (!filterLower) return true;
    const hay = `${e.nfa} ${e.f?.desc || ''} ${e.f?.vendor || ''} ${e.f?.project || ''} ${e.initiator || ''}`.toLowerCase();
    return hay.includes(filterLower);
  });
  const checkedCount = filteredEntries.filter((e) => e.sel && (e.status === 'draft' || e.status === 'submitted' || e.pmv)).length;

  return (
    <div className="pagewrap">
      <div className="subtabs">
        {['entries', 'allnfas', 'pdfs', 'search'].map((t) => (
          <button key={t} className={`stab ${subTab === t ? 'active' : ''}`} onClick={() => setSubTab(t)}>
            {t === 'entries' ? 'My Entries' : t === 'allnfas' ? 'All NFAs (QMS)' : t === 'pdfs' ? 'Published PDFs' : 'NFA Search & History'}
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
              <label>NFA Number <span className="req">*</span></label>
              <input className="inp" style={{ width: 132 }} value={qeNfa} onChange={(e) => setQeNfa(e.target.value)} placeholder="e.g. 14315" />
            </div>
            <div className="field">
              <label>Index <span className="req">*</span></label>
              <select className="inp" value={qeIndex} onChange={(e) => setQeIndex(e.target.value)}>
                <option value="">Select…</option>
                {reference && Object.keys(reference.indexNames).map((k) => (
                  <option key={k} value={k}>{reference.indexNames[k]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Work Type <span className="req">*</span></label>
              <select className="inp" value={qeWt} onChange={(e) => setQeWt(e.target.value)}>
                <option value="">Select…</option>
                {reference && Object.keys(reference.workTypes).map((k) => (
                  <option key={k} value={k}>{k} · {reference.workTypes[k]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Review Date <span className="req">*</span></label>
              <input type="date" className="inp" value={qeDate} min={today} onChange={(e) => setQeDate(e.target.value)} />
            </div>
            <button className="btn primary" onClick={doFetch}>Fetch from QMS</button>
            <label className="btn ghost" style={{ cursor: 'pointer', marginBottom: 0 }}>
              Upload files
              <input type="file" multiple style={{ display: 'none' }} onChange={(e) => { onPickStagedFiles(e.target.files); e.target.value = ''; }} />
            </label>
            <button className="modeb" onClick={() => setShowModeB(true)}>No NFA in QMS yet? Manual entry (Mode B)</button>
          </div>
          {stagedFiles.length > 0 && (
            <div className="staged">
              Staged for next entry: <FileChips files={stagedFiles} />
            </div>
          )}

          <div className="toolbar">
            <input className="inp" style={{ width: 250 }} placeholder="Filter this date's list… (NFA / vendor / project)" value={filterQ} onChange={(e) => setFilterQ(e.target.value)} />
            <span className="filterlbl">Showing: <b>{dateView === 'today' ? `${fmtDMY(today)} · today view — all open entries incl. future dates` : fmtDMY(dateView)}</b></span>
            <div className="spacer" />
            <button className="btn primary" onClick={submitChecked}>Submit {checkedCount} checked → Page 2</button>
          </div>

          {loading ? <div className="empty">Loading…</div> : filteredEntries.length === 0 ? (
            <div className="empty">No entries for this view — fetch an NFA above, use Mode B, or pick another review date.</div>
          ) : (
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th></th><th>S.No</th><th>NFA No.</th><th>Index</th><th>Work Type</th><th>Project</th>
                    <th>Description of Work</th><th>Vendor Name</th><th>Original Order Value ₹L (incl. GST)</th>
                    <th>PR Budget Value ₹L</th><th>Creator</th><th>NFA Initiated By</th><th>Review Date</th>
                    <th>Downloadable Files (QMS + uploads)</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((e, i) => (
                    <PageOneRow
                      key={e.id}
                      entry={e}
                      sno={i + 1}
                      expanded={expandedId === e.id}
                      onExpand={() => setExpandedId(expandedId === e.id ? null : e.id)}
                      onToggleSelect={() => toggleSelect(e)}
                      onSubmit={(comment) => doSubmit(e, comment)}
                      onRefresh={load}
                      reference={reference}
                      today={today}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="legendline">
            Yellow = user-edited / manual · unmarked cells are QMS-sourced · <b>*</b> on NFA Initiator = proxy entry ·
            files: click to open/download, × to deselect · re-fetch an existing NFA to re-pull QMS fields &amp; restore its attachments ·
            today's view lists all open entries (today + every future review date); pick a future date to filter to that date only —
            history lives in Published PDFs &amp; NFA Search
          </div>
        </div>
      )}

      {subTab === 'allnfas' && (
        <div className="surface">
          <div className="toolbar">
            <input
              className="inp" style={{ width: 280 }}
              placeholder="Filter by NFA / project / vendor / description…"
              value={allNfasFilter}
              onChange={(e) => setAllNfasFilter(e.target.value)}
            />
            <span className="filterlbl">
              {allNfasLoading ? 'Loading from QMS…' : `Showing ${allNfas.length} of ${allNfasTotal} NFA(s) in the live feed window`}
            </span>
            <div className="spacer" />
            <button className="btn ghost" onClick={() => loadAllNfas(allNfasPageSize)}>Refresh</button>
          </div>

          {allNfasError ? (
            <div className="empty">{allNfasError}</div>
          ) : allNfasLoading ? (
            <div className="empty">Loading…</div>
          ) : (
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>NFA No.</th><th>Project</th><th>Location</th><th>Description of Work</th>
                    <th>Vendor(s)</th><th>Value (₹L)</th><th>PR No.</th><th>Initiated On</th>
                    <th>Initiator</th><th>Pending With</th><th>Package</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allNfas
                    .filter((n) => {
                      if (!allNfasFilter.trim()) return true;
                      const q = allNfasFilter.toLowerCase();
                      return `${n.nfa} ${n.project} ${n.vendor} ${n.desc}`.toLowerCase().includes(q);
                    })
                    .map((n) => (
                      <tr key={n.nfa}>
                        <td className="nfa">{n.nfa}</td>
                        <td>{n.project}</td>
                        <td>{n.location}</td>
                        <td>{n.desc}</td>
                        <td>{n.vendor}</td>
                        <td>{n.val}</td>
                        <td>{n.pr}</td>
                        <td>{n.initDt ? fmtDMY(n.initDt) : '—'}</td>
                        <td>{n.initiator}</td>
                        <td>{n.pendWith}</td>
                        <td>{n.initBy}</td>
                        <td>
                          <button className="btn sm" onClick={() => { setQeNfa(n.nfa); setSubTab('entries'); }}>
                            Use in Fetch
                          </button>
                        </td>
                      </tr>
                    ))}
                  {allNfas.length === 0 && !allNfasLoading && (
                    <tr><td colSpan={12} className="empty">No NFAs returned by the QMS feed for the current window.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!allNfasError && (
            <div className="toolbar" style={{ marginTop: 10 }}>
              {allNfasPageSize < allNfasTotal && (
                <button className="btn" disabled={allNfasLoading} onClick={loadMoreNfas}>
                  Load {Math.min(100, allNfasTotal - allNfasPageSize)} more
                </button>
              )}
              {allNfasPageSize < 500 && allNfasTotal > allNfasPageSize && (
                <button className="btn ghost" disabled={allNfasLoading} onClick={() => loadAllNfas(500)}>
                  Show 500
                </button>
              )}
              {allNfasPageSize < allNfasTotal && (
                <button className="btn ghost" disabled={allNfasLoading} onClick={() => loadAllNfas(allNfasTotal)}>
                  Show all ({allNfasTotal})
                </button>
              )}
            </div>
          )}

          <div className="legendline">
            Pulled live from the QMS PR/NFA feed (rolling last 3 months, enddate always today) — this is the full
            set currently available, not filtered to your own entries. Click "Use in Fetch" to pre-fill the NFA number on
            the My Entries tab, then pick Index/Work Type/Review Date and Fetch as usual.
          </div>
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

function statusCell(e) {
  if (e.status === 'draft') return <span className="st grey">Draft{e.mode === 'B' ? ' · Mode B' : ''}</span>;
  if (e.status === 'submitted') return <span className="st grey">Submitted → Page 2</span>;
  if (e.status === 'presented') return <span className="st grey">Locked for MC · {fmtDMY(e.date)}</span>;
  if (e.status === 'expired') return <span className="st pend">Expired (undecided {fmtDMY(e.date)})</span>;
  const cls = e.status === 'approved' ? 'ok' : e.status === 'hold' ? 'hold' : 'rej';
  return <span className={`st ${cls}`}>{e.status.toUpperCase()} · {fmtDMY(e.date)}</span>;
}

function PageOneRow({ entry: e, sno, expanded, onExpand, onToggleSelect, onSubmit, onRefresh, reference, today }) {
  const { push } = useToast();
  const editable = e.status === 'draft' || e.status === 'submitted';
  const locked = ['approved', 'hold', 'rejected', 'expired', 'presented'].includes(e.status);
  const dIndex = e.pmv ? e.pmv.index : e.index;
  const dWt = e.pmv ? e.pmv.wt : e.wt;
  const dDate = e.pmv ? e.pmv.date : e.date;
  const prBudget = e.hyb?.prBudget ? (e.hyb.prBudget.pfn ? e.hyb.prBudget.qms : (e.hyb.prBudget.user ?? e.hyb.prBudget.qms)) : (e.f?.prBudget || '—');
  const prBudgetIsUser = e.hyb?.prBudget && !e.hyb.prBudget.pfn;

  async function removeFile(i) {
    try { await api.removeFile(e.id, i); onRefresh(); } catch (err) { push('Failed to remove file', 'error'); }
  }

  return (
    <>
      <tr className={locked && e.status !== 'presented' ? 'rowlocked' : ''}>
        <td>
          {(editable || e.pmv) ? (
            <input type="checkbox" className="cbx" checked={e.sel} onChange={onToggleSelect} />
          ) : <input type="checkbox" className="cbx" disabled />}
        </td>
        <td>{sno}</td>
        <td className="nfa" style={{ cursor: 'pointer' }} onClick={onExpand}>
          {e.nfa}
          {e.initDt && <div className="sub">(Initiated on {fmtDMY(e.initDt)})</div>}
          {e.mode === 'B' && <div className="sub">Manual · Mode B · interim reference (cite it in QMS at NFA initiation)</div>}
          {e.isProxy && <span className="redstar" title="Proxy entry">*</span>}
          {e.resubReq && <div className="sub" style={{ color: '#9A6700', fontWeight: 700 }}>Resubmit flagged</div>}
          {e.pmv && (
            <div className="pmvchip">
              Pending move from {e.pmv.fromIndex}·{fmtDMY(e.pmv.fromDate)} — submit to apply · previous entry still on Page 2
            </div>
          )}
        </td>
        <td>{dIndex}</td>
        <td><b>{dWt}</b> · {reference?.workTypes?.[dWt]}</td>
        <td>{e.f?.project}</td>
        <td>{e.f?.desc}</td>
        <td>{e.f?.vendor}</td>
        <td><b>{e.f?.val}</b></td>
        <td className={prBudgetIsUser ? 'edit' : ''}>{prBudget}</td>
        <td>{e.initiator}{e.initiator !== e.enteredBy && <b className="redstar" title={`Proxy entry — entered by ${e.enteredBy}`}>*</b>}</td>
        <td>{e.f?.initBy || '—'}</td>
        <td>{fmtDMY(dDate)}</td>
        <td><FileChips files={e.files} removable={editable} onRemove={removeFile} /></td>
        <td>{statusCell(e)}</td>
      </tr>
      {expanded && (
        <tr className="editor-row">
          <td colSpan={COLS}>
            <EntryEditor entry={e} editable={editable} onSubmit={onSubmit} onRefresh={onRefresh} reference={reference} />
          </td>
        </tr>
      )}
    </>
  );
}

function HybridCard({ entry, field, label, editable, onRefresh }) {
  const { push } = useToast();
  const h = entry.hyb?.[field] || { pfn: true, qms: '', user: null };
  const [localVal, setLocalVal] = useState(h.user == null ? h.qms : h.user);

  async function togglePfn(checked) {
    try { await api.updateField(entry.id, { field, pfn: checked }); onRefresh(); } catch { push('Failed to update', 'error'); }
  }
  async function saveUserVal() {
    try { await api.updateField(entry.id, { field, userValue: localVal }); onRefresh(); } catch { push('Failed to save', 'error'); }
  }

  return (
    <div className="fcard">
      <h5>{label}
        <label className="pfn">
          <input type="checkbox" className="cbx" style={{ width: 12, height: 12 }} checked={h.pfn} disabled={!editable} onChange={(e) => togglePfn(e.target.checked)} />
          Pick from NFA
        </label>
      </h5>
      {h.pfn ? (
        <textarea className="fval" readOnly value={h.qms || '—'} />
      ) : (
        <>
          <textarea className="fval userv" readOnly={!editable} value={localVal ?? ''} onChange={(e) => setLocalVal(e.target.value)} onBlur={saveUserVal} />
          <div className="sub">QMS text pre-filled — edit any part; your text supersedes QMS.</div>
        </>
      )}
    </div>
  );
}

function EntryEditor({ entry: e, editable, onSubmit, onRefresh, reference }) {
  const { push } = useToast();
  const [resub, setResub] = useState(e.resubComment || '');

  async function setPlainField(field, value) {
    try { await api.updatePlainField(e.id, field, value); onRefresh(); } catch { push('Failed to update', 'error'); }
  }
  async function saveResub() {
    try { await api.setResubComment(e.id, resub); push('Resubmission comment saved'); onRefresh(); } catch { push('Failed to save', 'error'); }
  }
  async function refreshQms() {
    try {
      await api.fetchNfa({ nfa: e.nfa, index: e.index, wt: e.wt, date: e.date });
      push('Refreshed from QMS');
      onRefresh();
    } catch (err) { push(err.response?.data?.error || 'Refresh failed', 'error'); }
  }
  async function uploadToEntry(fileList) {
    if (!fileList || !fileList.length) return;
    try {
      const res = await api.uploadFilesToEntry(e.id, fileList);
      push(`${res.data.added.length} file(s) attached`);
      onRefresh();
    } catch (err) { push('Upload failed', 'error'); }
  }
  async function removeEntryFile(i) {
    try { await api.removeFile(e.id, i); onRefresh(); } catch { push('Failed to remove file', 'error'); }
  }

  return (
    <div className="editor-inner">
      <div className="ed-head">
        <b>{e.nfa} — entry editor</b>
        <span style={{ fontSize: 10, color: '#444' }}>
          {e.mode === 'A' ? 'QMS pulled at entry creation — re-fetch anytime to re-pull' : 'Manual entry — no QMS link yet'}
        </span>
      </div>
      <div className="fieldsrow">
        <HybridCard entry={e} field="prBudget" label="PR Budget Value ₹L" editable={editable} onRefresh={onRefresh} />
        <HybridCard entry={e} field="reason" label="Reason for this New Work/Variation" editable={editable} onRefresh={onRefresh} />
        <HybridCard entry={e} field="vendPQ" label="No's of Considered Vendors & PQ" editable={editable} onRefresh={onRefresh} />
        <HybridCard entry={e} field="remarks" label="Remarks / Status" editable={editable} onRefresh={onRefresh} />
      </div>
      <div className="fieldsrow" style={{ marginTop: 10 }}>
        <div className="fcard">
          <h5>NFA Initiated By <span className="pfn">dropdown</span></h5>
          <select className="inp" style={{ width: '100%' }} disabled={!editable} value={e.f?.initBy || ''} onChange={(ev) => setPlainField('initBy', ev.target.value)}>
            <option value="">—</option>
            {reference?.initiatedByOptions?.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="fcard">
          <h5>Validation of Rates <span className="pfn">dropdown</span></h5>
          <select className="inp" style={{ width: '100%' }} disabled={!editable} value={e.f?.rateVal || ''} onChange={(ev) => setPlainField('rateVal', ev.target.value)}>
            <option value="">—</option>
            {reference?.rateValidations?.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>
      {e.resubReq && (
        <div className="resub-card">
          <h5>Resubmission comment <em>* mandatory — NFA previously presented</em></h5>
          <textarea className="fval" style={{ minHeight: 36 }} readOnly={!editable} value={resub} onChange={(ev) => setResub(ev.target.value)} onBlur={saveResub} />
        </div>
      )}
      <div style={{ marginTop: 10 }}>
        <h5 style={{ fontSize: 9.5, textTransform: 'uppercase', color: '#000', marginBottom: 5 }}>Attached files</h5>
        <FileChips files={e.files} removable={editable} onRemove={removeEntryFile} />
        {editable && (
          <label className="btn sm ghost" style={{ marginTop: 5, cursor: 'pointer', display: 'inline-block' }}>
            + Upload file
            <input type="file" multiple style={{ display: 'none' }} onChange={(ev) => { uploadToEntry(ev.target.files); ev.target.value = ''; }} />
          </label>
        )}
      </div>
      <div className="ed-actions">
        {editable ? (
          <>
            {e.mode === 'A' && <button className="btn ghost" onClick={refreshQms}>Refresh from QMS</button>}
            <button className="btn ghost" onClick={() => onSubmit()}>{e.sel ? 'Submit' : 'Withdraw'}</button>
          </>
        ) : (
          <span className="st grey">
            Read-only — {e.status === 'presented' ? 'locked with reviewer for MC · Fetch from QMS to update (the update lands on Page 2 deselected)' : 'entry closed'}
          </span>
        )}
        <span className="audit-note">Every change is versioned &amp; audit-logged.</span>
      </div>
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
