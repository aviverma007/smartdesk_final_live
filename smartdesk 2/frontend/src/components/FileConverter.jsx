import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Upload, Download, X, ArrowUp, ArrowDown, Loader2, CheckCircle2, AlertCircle, Layers, Images,
  FileImage, FileText, FileSpreadsheet, FileJson, Presentation, File as FileIcon, ShieldCheck, Server, Trash2, Repeat,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  ACCEPT, kindOf, extOf, baseOf, targetsFor, convertFile, mergePdfs, imagesToPdf,
  getCapabilities, downloadBlob, fmtSize,
} from '../services/converter';

const MAX_BROWSER_MB = 200;
const MODES = [
  { id: 'convert', label: 'Convert files', Icon: Repeat, hint: 'Change any supported file into another format.' },
  { id: 'merge', label: 'Merge PDFs', Icon: Layers, hint: 'Join several PDFs into one, in the order you choose.' },
  { id: 'images', label: 'Images → one PDF', Icon: Images, hint: 'Put photos or scans into a single PDF, one per page.' },
];
const KIND_META = {
  image:  { Icon: FileImage, color: 'var(--chart-4)', label: 'Image' },
  pdf:    { Icon: FileText, color: 'var(--danger)', label: 'PDF' },
  sheet:  { Icon: FileSpreadsheet, color: 'var(--success)', label: 'Spreadsheet' },
  json:   { Icon: FileJson, color: 'var(--chart-3)', label: 'JSON' },
  docx:   { Icon: FileText, color: 'var(--info)', label: 'Word' },
  office: { Icon: Presentation, color: 'var(--chart-3)', label: 'Office' },
  text:   { Icon: FileText, color: 'var(--text-muted)', label: 'Text' },
  unknown:{ Icon: FileIcon, color: 'var(--text-muted)', label: 'Unsupported' },
};
const FORMAT_GUIDE = [
  { from: 'Images (PNG, JPG, WEBP, BMP, GIF, SVG)', to: 'PNG · JPG · WEBP · PDF' },
  { from: 'PDF', to: 'PNG / JPG (per page) · Text · Word*' },
  { from: 'Excel / CSV / ODS', to: 'XLSX · CSV · JSON · HTML · ODS · PDF*' },
  { from: 'JSON', to: 'XLSX · CSV · HTML' },
  { from: 'Word (.docx)', to: 'PDF* · HTML · Text · ODT* · DOC*' },
  { from: 'Word .doc / .odt / .rtf', to: 'PDF* · DOCX*' },
  { from: 'PowerPoint (.ppt / .pptx / .odp)', to: 'PDF* · PPTX*' },
  { from: 'Text / Markdown / HTML', to: 'PDF · TXT · Word*' },
];

let nextId = 1;
const card = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-card)', position: 'relative', overflow: 'hidden' };
const btn = (variant = 'primary', disabled = false) => ({
  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9, cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: '.8rem', transition: 'all .15s', opacity: disabled ? .5 : 1,
  ...(variant === 'primary'
    ? { background: 'linear-gradient(135deg,#105da9,#1a7fd4)', color: '#fff', border: 'none', boxShadow: disabled ? 'none' : 'var(--shadow-active)' }
    : variant === 'success'
      ? { background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid color-mix(in srgb, var(--success) 45%, transparent)' }
      : { background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }),
});
const iconBtn = { width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };

const FileConverter = () => {
  const { user } = useAuth();
  const [mode, setMode] = useState('convert');
  const [items, setItems] = useState([]);           // { id, file, kind, target, status, progress, outputs, error }
  const [caps, setCaps] = useState({ office: false, maxMb: 25, checked: false });
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { getCapabilities().then(c => setCaps({ ...c, checked: true })); }, []);

  const defaultTarget = useCallback((file) => (targetsFor(file, caps.office).find(t => !t.disabled) || {}).ext || '', [caps.office]);

  // Re-pick default targets once we know whether the server can do Office conversions.
  useEffect(() => {
    setItems(list => list.map(it => (it.target && !targetsFor(it.file, caps.office).find(t => t.ext === it.target)?.disabled) ? it : { ...it, target: defaultTarget(it.file) }));
  }, [caps.office, defaultTarget]);

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const tooBig = files.filter(f => f.size > MAX_BROWSER_MB * 1048576);
    const accepted = files.filter(f => f.size <= MAX_BROWSER_MB * 1048576);
    setNotice(tooBig.length ? `${tooBig.map(f => f.name).join(', ')} ${tooBig.length > 1 ? 'are' : 'is'} over ${MAX_BROWSER_MB} MB and was skipped.` : '');
    setItems(list => [...list, ...accepted.map(file => ({
      id: nextId++, file, kind: kindOf(file), target: defaultTarget(file), status: 'ready', progress: 0, outputs: [], error: '',
    }))]);
  };

  const update = (id, patch) => setItems(list => list.map(it => (it.id === id ? { ...it, ...patch } : it)));
  const remove = (id) => setItems(list => list.filter(it => it.id !== id));
  const move = (id, dir) => setItems(list => {
    const i = list.findIndex(x => x.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return list;
    const copy = [...list]; [copy[i], copy[j]] = [copy[j], copy[i]]; return copy;
  });

  const convertOne = async (it) => {
    if (!it.target) return;
    const t = targetsFor(it.file, caps.office).find(x => x.ext === it.target);
    if (t?.office && it.file.size > caps.maxMb * 1048576) {
      update(it.id, { status: 'error', error: `Office conversions are limited to ${caps.maxMb} MB per file.` });
      return;
    }
    update(it.id, { status: 'working', progress: 0, error: '', outputs: [] });
    try {
      const outputs = await convertFile(it.file, it.target, { user, onProgress: p => update(it.id, { progress: p }) });
      update(it.id, { status: 'done', progress: 1, outputs });
    } catch (e) {
      update(it.id, { status: 'error', error: e?.message || 'Conversion failed.' });
    }
  };

  const convertAll = async () => {
    setBusy(true);
    for (const it of items.filter(x => x.kind !== 'unknown' && x.target && x.status !== 'done')) {
      // eslint-disable-next-line no-await-in-loop
      await convertOne(it);
    }
    setBusy(false);
  };

  const allOutputs = items.flatMap(it => it.outputs);
  const downloadAll = async () => {
    if (allOutputs.length === 1) return downloadBlob(allOutputs[0].blob, allOutputs[0].name);
    const { default: JSZip } = await import('jszip');
    const z = new JSZip(); const used = {};
    allOutputs.forEach(o => { let n = o.name; if (used[n]) n = `${baseOf(n)} (${used[n]}).${extOf(n)}`; used[o.name] = (used[o.name] || 0) + 1; z.file(n, o.blob); });
    downloadBlob(await z.generateAsync({ type: 'blob' }), 'converted-files.zip');
  };

  // Merge / images-to-PDF modes
  const combineList = items.filter(it => (mode === 'merge' ? it.kind === 'pdf' : it.kind === 'image'));
  const [combineName, setCombineName] = useState('');
  const [combineState, setCombineState] = useState({ status: 'idle', error: '' });
  useEffect(() => { setCombineState({ status: 'idle', error: '' }); }, [mode, items.length]);
  const combine = async () => {
    setCombineState({ status: 'working', error: '' });
    try {
      const name = (combineName.trim() || (mode === 'merge' ? 'merged' : 'images')).replace(/\.pdf$/i, '') + '.pdf';
      const outFile = mode === 'merge' ? await mergePdfs(combineList.map(x => x.file), name) : await imagesToPdf(combineList.map(x => x.file), name);
      downloadBlob(outFile.blob, outFile.name);
      setCombineState({ status: 'done', error: '', size: outFile.size, name: outFile.name });
    } catch (e) { setCombineState({ status: 'error', error: e?.message || 'Could not create the PDF.' }); }
  };

  const visible = mode === 'convert' ? items : combineList;
  const hidden = items.length - visible.length;
  const doneCount = items.filter(i => i.status === 'done').length;
  const readyCount = items.filter(i => i.kind !== 'unknown' && i.target && i.status !== 'done').length;
  const modeMeta = MODES.find(m => m.id === mode);

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: '.68rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 5 }}>Tools</p>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: '1.5rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>File Converter</h2>
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '.82rem', color: 'var(--text-muted)', marginTop: 6 }}>Upload files, choose a format, convert and download.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span title="Images, PDFs, spreadsheets and text are converted inside your browser" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: 'var(--success-bg)', border: '1px solid color-mix(in srgb, var(--success) 35%, transparent)', color: 'var(--success)', fontFamily: "'DM Sans',sans-serif", fontSize: '.74rem', fontWeight: 600 }}>
            <ShieldCheck size={14} /> Most files never leave your PC
          </span>
          <span title={caps.office ? 'Word / PowerPoint / Excel → PDF are converted on the SmartDesk server' : 'LibreOffice is not installed on the SmartDesk server'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: caps.office ? 'var(--info-bg)' : 'var(--bg-elevated)', border: '1px solid var(--border)', color: caps.office ? 'var(--info)' : 'var(--text-muted)', fontFamily: "'DM Sans',sans-serif", fontSize: '.74rem', fontWeight: 600 }}>
            <Server size={14} /> {!caps.checked ? 'Checking Office support…' : caps.office ? 'Office → PDF available' : 'Office → PDF unavailable'}
          </span>
        </div>
      </div>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {MODES.map(({ id, label, Icon }) => {
          const on = mode === id;
          return (
            <button key={id} onClick={() => setMode(id)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
              fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: '.8rem', transition: 'all .15s',
              border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent)' : 'var(--bg-card)', color: on ? '#fff' : 'var(--text-secondary)',
            }}><Icon size={15} />{label}</button>
          );
        })}
      </div>

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        role="button" tabIndex={0}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        style={{
          ...card, padding: '30px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: 16,
          border: `2px dashed ${drag ? 'var(--accent)' : 'var(--border)'}`,
          background: drag ? 'color-mix(in srgb, var(--accent) 7%, var(--bg-card))' : 'var(--bg-card)',
          transform: drag ? 'scale(1.005)' : 'none', transition: 'all .18s',
        }}>
        <input ref={inputRef} type="file" multiple hidden
          accept={mode === 'merge' ? '.pdf' : mode === 'images' ? 'image/*' : ACCEPT}
          onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
        <div style={{ width: 54, height: 54, borderRadius: 16, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)' }}>
          <Upload size={24} />
        </div>
        <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: '.98rem', color: 'var(--text-primary)' }}>
          {drag ? 'Drop to add' : 'Drag & drop files here, or click to browse'}
        </div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '.78rem', color: 'var(--text-muted)', marginTop: 5 }}>
          {modeMeta.hint} {mode === 'convert' && 'Images, PDF, Excel/CSV, Word, PowerPoint, text.'}
        </div>
      </div>

      {notice && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, marginBottom: 14, background: 'var(--warning-bg)', border: '1px solid color-mix(in srgb, var(--warning) 40%, transparent)', color: 'var(--warning)', fontFamily: "'DM Sans',sans-serif", fontSize: '.8rem' }}>
          <AlertCircle size={15} /> {notice}
        </div>
      )}

      {/* File list */}
      {visible.length > 0 && (
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: '.85rem', color: 'var(--text-primary)' }}>
              {mode === 'convert' ? `${visible.length} file${visible.length > 1 ? 's' : ''}` : `${visible.length} ${mode === 'merge' ? 'PDF' : 'image'}${visible.length > 1 ? 's' : ''} — use ↑ ↓ to set the order`}
              {hidden > 0 && <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '.75rem' }}> · {hidden} other file{hidden > 1 ? 's' : ''} hidden in this mode</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button style={btn('ghost')} onClick={() => setItems([])}><Trash2 size={14} />Clear</button>
              {mode === 'convert' && <>
                {doneCount > 0 && <button style={btn('success')} onClick={downloadAll}><Download size={14} />Download all{allOutputs.length > 1 ? ' (.zip)' : ''}</button>}
                <button style={btn('primary', busy || !readyCount)} disabled={busy || !readyCount} onClick={convertAll}>
                  {busy ? <Loader2 size={14} className="spin" /> : <Repeat size={14} />}{busy ? 'Converting…' : `Convert ${readyCount > 1 ? `all (${readyCount})` : ''}`}
                </button>
              </>}
            </div>
          </div>

          {visible.map((it, idx) => {
            const meta = KIND_META[it.kind] || KIND_META.unknown;
            const targets = targetsFor(it.file, caps.office);
            return (
              <div key={it.id} className="tab-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--chart-grid)', flexWrap: 'wrap' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${meta.color} 12%, transparent)`, color: meta.color }}>
                  <meta.Icon size={19} />
                </div>
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <div title={it.file.name} style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: '.84rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.file.name}</div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {meta.label} · .{extOf(it.file.name) || '?'} · {fmtSize(it.file.size)}
                    {it.status === 'error' && <span style={{ color: 'var(--danger)', fontWeight: 600 }}> · {it.error}</span>}
                    {it.status === 'done' && <span style={{ color: 'var(--success)', fontWeight: 600 }}> · Converted</span>}
                  </div>
                  {it.status === 'working' && (
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--chart-track)', marginTop: 7, overflow: 'hidden', maxWidth: 320 }}>
                      <div style={{ height: '100%', width: `${Math.max(it.progress, .12) * 100}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width .3s' }} />
                    </div>
                  )}
                </div>

                {mode === 'convert' && (it.kind === 'unknown' ? (
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '.76rem', color: 'var(--text-muted)' }}>This file type isn't supported</span>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '.74rem', color: 'var(--text-muted)' }}>to</span>
                    <select value={it.target} disabled={it.status === 'working'}
                      onChange={e => update(it.id, { target: e.target.value, status: 'ready', outputs: [], error: '' })}
                      style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontFamily: "'DM Sans',sans-serif", fontSize: '.8rem', fontWeight: 600, minWidth: 150, cursor: 'pointer' }}>
                      {targets.map(t => (
                        <option key={t.ext} value={t.ext} disabled={t.disabled}>
                          {t.ext.toUpperCase()}{t.note ? ` — ${t.note}` : ''}{t.disabled ? ' (server not set up)' : ''}
                        </option>
                      ))}
                    </select>
                    {it.status === 'done' ? (
                      it.outputs.map(o => (
                        <button key={o.name} style={btn('success')} onClick={() => downloadBlob(o.blob, o.name)} title={`${o.name} · ${fmtSize(o.size)}`}>
                          <Download size={14} />{extOf(o.name).toUpperCase()} · {fmtSize(o.size)}
                        </button>
                      ))
                    ) : (
                      <button style={btn('primary', it.status === 'working' || !it.target)} disabled={it.status === 'working' || !it.target} onClick={() => convertOne(it)}>
                        {it.status === 'working' ? <Loader2 size={14} className="spin" /> : it.status === 'error' ? <AlertCircle size={14} /> : <Repeat size={14} />}
                        {it.status === 'working' ? 'Converting' : it.status === 'error' ? 'Retry' : 'Convert'}
                      </button>
                    )}
                  </div>
                ))}

                <div style={{ display: 'flex', gap: 6 }}>
                  {mode !== 'convert' && <>
                    <button style={iconBtn} title="Move up" onClick={() => move(it.id, -1)} disabled={idx === 0}><ArrowUp size={14} /></button>
                    <button style={iconBtn} title="Move down" onClick={() => move(it.id, 1)} disabled={idx === visible.length - 1}><ArrowDown size={14} /></button>
                  </>}
                  {it.status === 'done' && mode === 'convert' && <span style={{ ...iconBtn, border: 'none', background: 'transparent', color: 'var(--success)' }}><CheckCircle2 size={18} /></span>}
                  <button style={iconBtn} title="Remove" onClick={() => remove(it.id)}><X size={14} /></button>
                </div>
              </div>
            );
          })}

          {mode !== 'convert' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '14px 16px', background: 'var(--bg-elevated)' }}>
              <input value={combineName} onChange={e => setCombineName(e.target.value)} placeholder={mode === 'merge' ? 'merged' : 'images'}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontFamily: "'DM Sans',sans-serif", fontSize: '.82rem', width: 220 }} />
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '.8rem', color: 'var(--text-muted)' }}>.pdf</span>
              <button style={btn('primary', combineList.length < (mode === 'merge' ? 2 : 1) || combineState.status === 'working')}
                disabled={combineList.length < (mode === 'merge' ? 2 : 1) || combineState.status === 'working'} onClick={combine}>
                {combineState.status === 'working' ? <Loader2 size={14} className="spin" /> : mode === 'merge' ? <Layers size={14} /> : <Images size={14} />}
                {mode === 'merge' ? `Merge ${combineList.length} PDFs & download` : `Create PDF from ${combineList.length} image${combineList.length > 1 ? 's' : ''}`}
              </button>
              {mode === 'merge' && combineList.length === 1 && <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '.76rem', color: 'var(--text-muted)' }}>Add at least one more PDF</span>}
              {combineState.status === 'done' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: "'DM Sans',sans-serif", fontSize: '.78rem', color: 'var(--success)', fontWeight: 600 }}><CheckCircle2 size={15} />Downloaded {combineState.name} · {fmtSize(combineState.size)}</span>}
              {combineState.status === 'error' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: "'DM Sans',sans-serif", fontSize: '.78rem', color: 'var(--danger)', fontWeight: 600 }}><AlertCircle size={15} />{combineState.error}</span>}
            </div>
          )}
        </div>
      )}

      {/* Supported formats */}
      <div style={{ ...card, padding: '16px 18px' }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: '.85rem', color: 'var(--text-primary)', marginBottom: 12 }}>Supported conversions</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
          {FORMAT_GUIDE.map(g => (
            <div key={g.from} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: '.78rem', color: 'var(--text-primary)' }}>{g.from}</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '.74rem', color: 'var(--text-muted)', marginTop: 3 }}>→ {g.to}</div>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '.72rem', color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.5 }}>
          * Converted on the SmartDesk server with LibreOffice{caps.office ? '' : ' (not installed yet — ask IT)'}; limit {caps.maxMb} MB per file. Everything else is converted in your browser.
          PDF → Word works best on text PDFs; scanned PDFs can't be turned into editable text. Text → PDF uses a standard font, so non-English characters (e.g. Hindi) appear as "?" — use Word → PDF for those.
        </div>
      </div>

      <style>{`.spin{animation:spin .8s linear infinite}`}</style>
    </div>
  );
};

export default FileConverter;
