import React, { useEffect, useMemo, useState } from 'react';
import { Table2, Combine, GitCompare, CopyMinus, SplitSquareHorizontal, X, Download } from 'lucide-react';
import { downloadBlob, baseOf } from '../../services/converter';
import { Btn, DropZone, Field, Notice, Panel, ResultRow, Segmented, ToolHeader, card, font, inputStyle, fmtBytes } from './shared';

const ACCEPT = '.xlsx,.xls,.xlsm,.csv,.ods,.tsv';
const MODES = [
  { value: 'merge', label: 'Merge files', icon: Combine },
  { value: 'compare', label: 'Compare two files', icon: GitCompare },
  { value: 'dedupe', label: 'Remove duplicates', icon: CopyMinus },
  { value: 'split', label: 'Split by column', icon: SplitSquareHorizontal },
];
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const xlsxLib = () => import('xlsx');
const norm = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').trim());
const safeSheet = (n, used = new Set()) => {
  let s = String(n || 'Sheet').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Sheet';
  let k = 2; const b = s;
  while (used.has(s.toLowerCase())) s = `${b.slice(0, 28)} ${k++}`;
  used.add(s.toLowerCase()); return s;
};

/** Read a workbook → [{ name, headers, rows(objects) }] */
async function readBook(file) {
  const XLSX = await xlsxLib();
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  return wb.SheetNames.map(name => {
    const ws = wb.Sheets[name];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
    const headers = (aoa[0] || []).map((h, i) => (String(h).trim() || `Column ${i + 1}`));
    // make header names unique
    const seen = {}; const uniq = headers.map(h => { seen[h] = (seen[h] || 0) + 1; return seen[h] > 1 ? `${h} (${seen[h]})` : h; });
    const rows = aoa.slice(1).map(r => Object.fromEntries(uniq.map((h, i) => [h, r[i] ?? ''])));
    return { name, headers: uniq, rows };
  });
}

async function writeBook(sheets, fileName) {
  const XLSX = await xlsxLib();
  const wb = XLSX.utils.book_new(); const used = new Set();
  sheets.forEach(s => {
    const ws = s.aoa ? XLSX.utils.aoa_to_sheet(s.aoa) : XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{}], { header: s.headers });
    XLSX.utils.book_append_sheet(wb, ws, safeSheet(s.name, used));
  });
  const blob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellDates: true })], { type: XLSX_MIME });
  return { name: fileName, blob, size: blob.size };
}

/* Small reusable sheet picker for a loaded book */
const SheetPick = ({ book, value, onChange }) => book && book.length > 1 ? (
  <Field label="Sheet">
    <select style={inputStyle} value={value} onChange={e => onChange(Number(e.target.value))}>
      {book.map((s, i) => <option key={s.name} value={i}>{s.name} ({s.rows.length} rows)</option>)}
    </select>
  </Field>
) : null;

const FileChip = ({ file, info, onRemove }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
    <Table2 size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: font.head, fontWeight: 700, fontSize: '.8rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
      <div style={{ fontFamily: font.body, fontSize: '.72rem', color: 'var(--text-muted)' }}>{fmtBytes(file.size)}{info ? ` · ${info}` : ''}</div>
    </div>
    {onRemove && <button type="button" onClick={onRemove} title="Remove" style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={15} /></button>}
  </div>
);

const ExcelTools = ({ onBack }) => {
  const [mode, setMode] = useState('merge');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [summary, setSummary] = useState(null);

  // merge
  const [mergeFiles, setMergeFiles] = useState([]); // { file, book }
  const [mergeHow, setMergeHow] = useState('stack');
  const [addSource, setAddSource] = useState(true);
  // single-file modes (dedupe / split) and compare
  const [one, setOne] = useState(null); const [oneSheet, setOneSheet] = useState(0);
  const [a, setA] = useState(null); const [aSheet, setASheet] = useState(0);
  const [b, setB] = useState(null); const [bSheet, setBSheet] = useState(0);
  const [keyCol, setKeyCol] = useState('');
  const [dedupeCols, setDedupeCols] = useState([]);
  const [splitCol, setSplitCol] = useState('');
  const [splitOut, setSplitOut] = useState('sheets');

  useEffect(() => { setResult(null); setSummary(null); setError(''); }, [mode]);

  const load = async (file) => ({ file, book: await readBook(file) });
  const guard = async (fn) => { setBusy(true); setError(''); setResult(null); setSummary(null); try { await fn(); } catch (e) { setError(e?.message || 'Could not read this file.'); } setBusy(false); };

  const oneData = one?.book[oneSheet];
  const aData = a?.book[aSheet], bData = b?.book[bSheet];
  const commonCols = useMemo(() => (aData && bData ? aData.headers.filter(h => bData.headers.includes(h)) : []), [aData, bData]);
  useEffect(() => { if (commonCols.length && !commonCols.includes(keyCol)) setKeyCol(commonCols[0]); }, [commonCols, keyCol]);
  useEffect(() => { if (oneData) { setDedupeCols(oneData.headers); if (!oneData.headers.includes(splitCol)) setSplitCol(oneData.headers[0] || ''); } }, [oneData]);

  /* ── Merge ── */
  const doMerge = () => guard(async () => {
    if (mergeFiles.length < 2) throw new Error('Add at least two files to merge.');
    if (mergeHow === 'sheets') {
      const sheets = mergeFiles.flatMap(({ file, book }) => book.map(s => ({ name: book.length > 1 ? `${baseOf(file.name)} - ${s.name}` : baseOf(file.name), headers: s.headers, rows: s.rows })));
      setResult(await writeBook(sheets, 'merged-workbook.xlsx'));
      setSummary(`${sheets.length} sheets from ${mergeFiles.length} files.`);
      return;
    }
    const headers = []; const rows = [];
    mergeFiles.forEach(({ file, book }) => book.forEach(s => {
      s.headers.forEach(h => { if (!headers.includes(h)) headers.push(h); });
      s.rows.forEach(r => rows.push(addSource ? { 'Source file': file.name, ...(book.length > 1 ? { 'Source sheet': s.name } : {}), ...r } : r));
    }));
    const multiSheet = mergeFiles.some(m => m.book.length > 1);
    const allHeaders = [...(addSource ? ['Source file', ...(multiSheet ? ['Source sheet'] : [])] : []), ...headers];
    setResult(await writeBook([{ name: 'Merged', headers: allHeaders, rows }], 'merged.xlsx'));
    setSummary(`${rows.length.toLocaleString('en-IN')} rows · ${headers.length} columns from ${mergeFiles.length} files.`);
  });

  /* ── Compare ── */
  const doCompare = () => guard(async () => {
    if (!aData || !bData) throw new Error('Choose both files.');
    if (!keyCol) throw new Error('The two sheets have no column in common.');
    const index = (rows) => { const m = new Map(); const dups = []; rows.forEach(r => { const k = norm(r[keyCol]); if (!k) return; if (m.has(k)) dups.push(k); else m.set(k, r); }); return { m, dups }; };
    const A = index(aData.rows), B = index(bData.rows);
    const cols = [...new Set([...aData.headers, ...bData.headers])].filter(h => h !== keyCol);
    const added = [], removed = [], changed = [];
    B.m.forEach((r, k) => { if (!A.m.has(k)) added.push(r); });
    A.m.forEach((r, k) => {
      if (!B.m.has(k)) { removed.push(r); return; }
      const nb = B.m.get(k);
      cols.forEach(c => { const o = norm(r[c]), n = norm(nb[c]); if (o !== n) changed.push([k, c, o, n]); });
    });
    const changedKeys = new Set(changed.map(x => x[0])).size;
    setResult(await writeBook([
      { name: 'Summary', aoa: [['Compared on', keyCol], ['Old file', a.file.name], ['New file', b.file.name], [], ['Added rows', added.length], ['Removed rows', removed.length], ['Changed rows', changedKeys], ['Changed cells', changed.length], ['Unchanged rows', [...A.m.keys()].filter(k => B.m.has(k)).length - changedKeys], ...(A.dups.length || B.dups.length ? [[], ['Duplicate keys ignored', [...new Set([...A.dups, ...B.dups])].join(', ')]] : [])] },
      { name: 'Added', headers: bData.headers, rows: added },
      { name: 'Removed', headers: aData.headers, rows: removed },
      { name: 'Changed', aoa: [[keyCol, 'Column', 'Old value', 'New value'], ...changed] },
    ], `compare-${baseOf(a.file.name)}-vs-${baseOf(b.file.name)}.xlsx`));
    setSummary({ added: added.length, removed: removed.length, changed: changedKeys, cells: changed.length, preview: changed.slice(0, 8), dups: A.dups.length + B.dups.length });
  });

  /* ── Remove duplicates ── */
  const doDedupe = () => guard(async () => {
    if (!oneData) throw new Error('Choose a file.');
    if (!dedupeCols.length) throw new Error('Tick at least one column to compare.');
    const seen = new Set(); const keep = [], dropped = [];
    oneData.rows.forEach(r => { const k = dedupeCols.map(c => norm(r[c]).toLowerCase()).join('\u0001'); if (seen.has(k)) dropped.push(r); else { seen.add(k); keep.push(r); } });
    setResult(await writeBook([{ name: oneData.name, headers: oneData.headers, rows: keep }, { name: 'Removed duplicates', headers: oneData.headers, rows: dropped }], `${baseOf(one.file.name)}-no-duplicates.xlsx`));
    setSummary(`${dropped.length.toLocaleString('en-IN')} duplicate row(s) removed · ${keep.length.toLocaleString('en-IN')} rows kept. Removed rows are in the second sheet.`);
  });

  /* ── Split by column ── */
  const doSplit = () => guard(async () => {
    if (!oneData || !splitCol) throw new Error('Choose a file and a column.');
    const groups = new Map();
    oneData.rows.forEach(r => { const k = norm(r[splitCol]) || '(blank)'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
    if (groups.size > 300) throw new Error(`"${splitCol}" has ${groups.size} different values — too many to split. Pick a column like Site or Department.`);
    const base = baseOf(one.file.name);
    if (splitOut === 'sheets') {
      setResult(await writeBook([...groups].map(([k, rows]) => ({ name: k, headers: oneData.headers, rows })), `${base}-by-${splitCol}.xlsx`));
    } else {
      const { default: JSZip } = await import('jszip'); const z = new JSZip();
      for (const [k, rows] of groups) z.file(`${base}-${k.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60)}.xlsx`, (await writeBook([{ name: k, headers: oneData.headers, rows }], 'x')).blob);
      const blob = await z.generateAsync({ type: 'blob' });
      setResult({ name: `${base}-by-${splitCol}.zip`, blob, size: blob.size });
    }
    setSummary(`${groups.size} group(s): ${[...groups].slice(0, 12).map(([k, r]) => `${k} (${r.length})`).join(', ')}${groups.size > 12 ? '…' : ''}`);
  });

  const run = { merge: doMerge, compare: doCompare, dedupe: doDedupe, split: doSplit }[mode];
  const runLabel = { merge: 'Merge files', compare: 'Compare', dedupe: 'Remove duplicates', split: 'Split file' }[mode];
  const canRun = mode === 'merge' ? mergeFiles.length >= 2 : mode === 'compare' ? !!(aData && bData && keyCol) : !!oneData;

  const pickOne = (setter, sheetSetter) => (files) => guard(async () => { setter(await load(files[0])); sheetSetter(0); });

  return (
    <div style={{ paddingBottom: 32 }}>
      <ToolHeader icon={Table2} color="var(--success)" title="Excel Tools" subtitle="Merge, compare, de-duplicate or split spreadsheets (XLSX, XLS, CSV, ODS) in your browser." onBack={onBack} />
      <div style={{ marginBottom: 14 }}><Segmented value={mode} onChange={setMode} options={MODES} /></div>

      <Panel style={{ marginBottom: 14 }}>
        {mode === 'merge' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <DropZone accept={ACCEPT} compact onFiles={fs => guard(async () => { const loaded = []; for (const f of fs) loaded.push(await load(f)); setMergeFiles(m => [...m, ...loaded]); })} title="Add spreadsheets to merge" hint="Add 2 or more files" />
            {mergeFiles.map((m, i) => <FileChip key={i} file={m.file} info={`${m.book.length} sheet(s), ${m.book.reduce((s, x) => s + x.rows.length, 0)} rows`} onRemove={() => setMergeFiles(l => l.filter((_, k) => k !== i))} />)}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <Segmented value={mergeHow} onChange={setMergeHow} options={[{ value: 'stack', label: 'All rows into one sheet' }, { value: 'sheets', label: 'Each file as its own sheet' }]} />
              {mergeHow === 'stack' && <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: font.body, fontSize: '.82rem', color: 'var(--text-secondary)' }}><input type="checkbox" checked={addSource} onChange={e => setAddSource(e.target.checked)} />Add “Source file” column</label>}
            </div>
          </div>
        )}

        {mode === 'compare' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 }}>
            {[['Old / original file', a, setA, aSheet, setASheet], ['New / updated file', b, setB, bSheet, setBSheet]].map(([label, val, setter, sh, setSh]) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontFamily: font.body, fontSize: '.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
                {val ? <FileChip file={val.file} info={`${val.book[sh].rows.length} rows`} onRemove={() => setter(null)} /> : <DropZone accept={ACCEPT} multiple={false} compact onFiles={pickOne(setter, setSh)} title="Choose file" />}
                <SheetPick book={val?.book} value={sh} onChange={setSh} />
              </div>
            ))}
            {aData && bData && (
              <Field label="Match rows by" hint={commonCols.length ? 'A column that is unique per row, e.g. Employee Code, PO number' : 'No common column names found'} style={{ gridColumn: '1 / -1', maxWidth: 360 }}>
                <select style={inputStyle} value={keyCol} onChange={e => setKeyCol(e.target.value)}>{commonCols.map(c => <option key={c}>{c}</option>)}</select>
              </Field>
            )}
          </div>
        )}

        {(mode === 'dedupe' || mode === 'split') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {one ? <FileChip file={one.file} info={`${oneData?.rows.length ?? 0} rows · ${oneData?.headers.length ?? 0} columns`} onRemove={() => setOne(null)} /> : <DropZone accept={ACCEPT} multiple={false} compact onFiles={pickOne(setOne, setOneSheet)} title="Choose a spreadsheet" />}
            <div style={{ maxWidth: 360 }}><SheetPick book={one?.book} value={oneSheet} onChange={setOneSheet} /></div>
            {mode === 'dedupe' && oneData && (
              <Field label="A row is a duplicate when these columns match">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {oneData.headers.map(h => {
                    const on = dedupeCols.includes(h);
                    return <button key={h} type="button" onClick={() => setDedupeCols(c => on ? c.filter(x => x !== h) : [...c, h])} style={{ padding: '5px 11px', borderRadius: 20, cursor: 'pointer', fontFamily: font.body, fontSize: '.78rem', fontWeight: 600, border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent)' : 'var(--bg-elevated)', color: on ? '#fff' : 'var(--text-secondary)' }}>{h}</button>;
                  })}
                </div>
              </Field>
            )}
            {mode === 'split' && oneData && (
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'end' }}>
                <Field label="Split by column" style={{ minWidth: 240 }}><select style={inputStyle} value={splitCol} onChange={e => setSplitCol(e.target.value)}>{oneData.headers.map(h => <option key={h}>{h}</option>)}</select></Field>
                <Segmented value={splitOut} onChange={setSplitOut} options={[{ value: 'sheets', label: 'One workbook, sheet per value' }, { value: 'files', label: 'Separate files (.zip)' }]} />
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 16 }}><Btn icon={MODES.find(m => m.value === mode).icon} busy={busy} disabled={!canRun} onClick={run}>{busy ? 'Working…' : runLabel}</Btn></div>
        {error && <div style={{ marginTop: 12 }}><Notice>{error}</Notice></div>}
        {result && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {typeof summary === 'string' && <Notice type="success">{summary}</Notice>}
            {summary && typeof summary === 'object' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
                  {[['Added', summary.added, 'var(--success)'], ['Removed', summary.removed, 'var(--danger)'], ['Changed rows', summary.changed, 'var(--warning)'], ['Changed cells', summary.cells, 'var(--info)']].map(([l, v, c]) => (
                    <div key={l} style={{ ...card, padding: '12px 14px', boxShadow: 'none' }}>
                      <div style={{ fontFamily: font.body, fontSize: '.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{l}</div>
                      <div style={{ fontFamily: font.head, fontWeight: 800, fontSize: '1.5rem', color: c }}>{v.toLocaleString('en-IN')}</div>
                    </div>
                  ))}
                </div>
                {summary.preview.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: font.body, fontSize: '.78rem' }}>
                      <thead><tr>{[keyCol, 'Column', 'Old', 'New'].map(h => <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>{h}</th>)}</tr></thead>
                      <tbody>{summary.preview.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={{ padding: '6px 10px', borderBottom: '1px solid var(--chart-grid)', color: j === 2 ? 'var(--danger)' : j === 3 ? 'var(--success)' : 'var(--text-primary)' }}>{c || '—'}</td>)}</tr>)}</tbody>
                    </table>
                    {summary.cells > summary.preview.length && <div style={{ fontFamily: font.body, fontSize: '.74rem', color: 'var(--text-muted)', marginTop: 6 }}>Showing {summary.preview.length} of {summary.cells} changes — all are in the downloaded file.</div>}
                  </div>
                )}
                {summary.dups > 0 && <Notice type="warning">Some “{keyCol}” values appear more than once; only the first of each was compared. Check the Summary sheet.</Notice>}
              </>
            )}
            <ResultRow name={result.name} size={result.size} onDownload={() => downloadBlob(result.blob, result.name)} />
          </div>
        )}
      </Panel>
      <div style={{ fontFamily: font.body, fontSize: '.74rem', color: 'var(--text-muted)' }}>
        <Download size={12} style={{ verticalAlign: '-2px' }} /> Results are new .xlsx files — your original files are never changed. Formulas are saved as their values; formatting (colours, column widths) is not kept.
      </div>
    </div>
  );
};

export default ExcelTools;
