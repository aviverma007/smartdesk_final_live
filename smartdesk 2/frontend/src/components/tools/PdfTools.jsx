import React, { useEffect, useRef, useState } from 'react';
import { FileCog, RotateCw, RotateCcw, Trash2, Undo2, Scissors, Droplets, Hash, Minimize2, LayoutGrid, Repeat, X } from 'lucide-react';
import { pdfjs, downloadBlob, baseOf } from '../../services/converter';
import { Btn, DropZone, Field, Notice, Panel, ResultRow, Segmented, ToolHeader, card, font, inputStyle, fmtBytes } from './shared';

const ACTIONS = [
  { value: 'organise', label: 'Organise pages', icon: LayoutGrid },
  { value: 'split', label: 'Split / Extract', icon: Scissors },
  { value: 'watermark', label: 'Watermark', icon: Droplets },
  { value: 'numbers', label: 'Page numbers', icon: Hash },
  { value: 'compress', label: 'Compress', icon: Minimize2 },
];
const MAX_THUMBS = 400;

// Standard PDF fonts only cover Western characters.
const winAnsi = (s) => String(s).replace(/[^\x20-\x7E -ÿ]/g, '?');

/** "1-3, 5, 8-" → [[1,3],[5,5],[8,total]] (1-based, clamped, validated) */
export function parseRanges(text, total) {
  const parts = String(text).split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  if (!parts.length) throw new Error('Enter page numbers, e.g. 1-3, 5, 8-');
  return parts.map(p => {
    const m = p.match(/^(\d*)\s*-\s*(\d*)$/) || p.match(/^(\d+)$/);
    if (!m) throw new Error(`"${p}" is not a valid page or range.`);
    let a, b;
    if (m.length === 2) { a = b = Number(m[1]); } else { a = m[1] ? Number(m[1]) : 1; b = m[2] ? Number(m[2]) : total; }
    if (a < 1 || b < 1 || a > total || b > total) throw new Error(`"${p}" is outside 1–${total}.`);
    if (a > b) [a, b] = [b, a];
    return [a, b];
  });
}

async function loadPdfLib() { return import('pdf-lib'); }

const PdfTools = ({ onBack }) => {
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState([]); // { index, rot, deleted, thumb }
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState('organise');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { name, blob, size, before }
  const dragFrom = useRef(null);
  const loadToken = useRef(0);

  // split options
  const [splitMode, setSplitMode] = useState('extract');
  const [ranges, setRanges] = useState('');
  const [everyN, setEveryN] = useState(1);
  // watermark options
  const [wm, setWm] = useState({ text: 'CONFIDENTIAL', size: 60, opacity: 0.18, color: 'gray', position: 'diagonal' });
  // page number options
  const [pn, setPn] = useState({ format: 'Page {n} of {total}', position: 'bottom-center', start: 1, size: 10, skipFirst: false });
  // compress
  const [quality, setQuality] = useState('medium');

  const load = async (f) => {
    const token = ++loadToken.current;
    setFile(f); setPages([]); setResult(null); setError(''); setLoading(true);
    try {
      const lib = await pdfjs();
      const pdf = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
      const list = Array.from({ length: pdf.numPages }, (_, i) => ({ index: i, rot: 0, deleted: false, thumb: null }));
      if (token !== loadToken.current) return;
      setPages(list);
      setLoading(false);
      // Render thumbnails progressively
      for (let i = 0; i < Math.min(pdf.numPages, MAX_THUMBS); i++) {
        if (token !== loadToken.current) return;
        const page = await pdf.getPage(i + 1);
        const vp0 = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: 150 / vp0.width });
        const c = document.createElement('canvas');
        c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        const thumb = c.toDataURL('image/jpeg', 0.7);
        setPages(ps => ps.map(p => (p.index === i ? { ...p, thumb } : p)));
      }
    } catch (e) {
      if (token !== loadToken.current) return;
      setLoading(false); setFile(null);
      setError(/password/i.test(e?.message || '') ? 'This PDF is password-protected. Remove the password first.' : 'This file could not be opened as a PDF.');
    }
  };

  useEffect(() => { setResult(null); setError(''); }, [action]);

  const total = pages.length;
  const kept = pages.filter(p => !p.deleted);
  const changed = pages.some((p, i) => p.rot || p.deleted || p.index !== i);
  // Split / watermark / numbers / compress work on the PDF as loaded, so show it unmodified there.
  const shown = action === 'organise' ? pages : [...pages].sort((a, b) => a.index - b.index).map(p => ({ ...p, rot: 0, deleted: false }));

  const finish = (bytesOrBlob, name, isZip) => {
    const blob = bytesOrBlob instanceof Blob ? bytesOrBlob : new Blob([bytesOrBlob], { type: isZip ? 'application/zip' : 'application/pdf' });
    setResult({ name, blob, size: blob.size, before: file.size, isZip });
  };

  const run = async (fn) => {
    setBusy(true); setError(''); setResult(null);
    try { await fn(); } catch (e) { setError(e?.message || 'Something went wrong.'); }
    setBusy(false);
  };

  const srcDoc = async () => {
    const { PDFDocument } = await loadPdfLib();
    try { return await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true }); }
    catch (_) { throw new Error('This PDF could not be read (damaged or protected).'); }
  };

  /* ── Organise: reorder / rotate / delete ── */
  const doOrganise = () => run(async () => {
    if (!kept.length) throw new Error('All pages are deleted — keep at least one.');
    const { PDFDocument, degrees } = await loadPdfLib();
    const src = await srcDoc();
    const doc = await PDFDocument.create();
    const copied = await doc.copyPages(src, kept.map(p => p.index));
    copied.forEach((pg, i) => {
      if (kept[i].rot) pg.setRotation(degrees(((pg.getRotation().angle || 0) + kept[i].rot + 360) % 360));
      doc.addPage(pg);
    });
    finish(await doc.save(), `${baseOf(file.name)}-organised.pdf`);
  });

  /* ── Split / extract ── */
  const doSplit = () => run(async () => {
    const { PDFDocument } = await loadPdfLib();
    const src = await srcDoc();
    const make = async (idxs) => { const d = await PDFDocument.create(); (await d.copyPages(src, idxs)).forEach(p => d.addPage(p)); return d.save(); };
    const base = baseOf(file.name);
    if (splitMode === 'extract') {
      const rs = parseRanges(ranges, total);
      const idxs = rs.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, k) => a - 1 + k));
      return finish(await make(idxs), `${base}-pages-${ranges.replace(/\s+/g, '').replace(/[^0-9,-]/g, '')}.pdf`);
    }
    let groups;
    if (splitMode === 'ranges') groups = parseRanges(ranges, total).map(([a, b]) => ({ name: a === b ? `p${a}` : `p${a}-${b}`, idxs: Array.from({ length: b - a + 1 }, (_, k) => a - 1 + k) }));
    else {
      const n = Math.max(1, Math.floor(Number(everyN) || 1));
      groups = [];
      for (let s = 0; s < total; s += n) { const e = Math.min(total, s + n); groups.push({ name: n === 1 ? `p${s + 1}` : `p${s + 1}-${e}`, idxs: Array.from({ length: e - s }, (_, k) => s + k) }); }
    }
    if (groups.length === 1) return finish(await make(groups[0].idxs), `${base}-${groups[0].name}.pdf`);
    const { default: JSZip } = await import('jszip');
    const z = new JSZip();
    for (const g of groups) z.file(`${base}-${g.name}.pdf`, await make(g.idxs));
    finish(await z.generateAsync({ type: 'blob' }), `${base}-split-${groups.length}-files.zip`, true);
  });

  /* ── Watermark ── */
  const doWatermark = () => run(async () => {
    const text = winAnsi(wm.text.trim());
    if (!text) throw new Error('Enter the watermark text.');
    const { StandardFonts, rgb, degrees } = await loadPdfLib();
    const doc = await srcDoc();
    const f = await doc.embedFont(StandardFonts.HelveticaBold);
    const color = { gray: rgb(0.45, 0.45, 0.45), red: rgb(0.8, 0.1, 0.1), blue: rgb(0.06, 0.36, 0.66) }[wm.color];
    doc.getPages().forEach(pg => {
      const { width, height } = pg.getSize();
      const size = Number(wm.size) || 60;
      const tw = f.widthOfTextAtSize(text, size), th = f.heightAtSize(size);
      if (wm.position === 'diagonal') {
        const ang = Math.atan2(height, width), cos = Math.cos(ang), sin = Math.sin(ang);
        pg.drawText(text, { x: width / 2 - (tw / 2) * cos + (th / 3) * sin, y: height / 2 - (tw / 2) * sin - (th / 3) * cos, size, font: f, color, opacity: Number(wm.opacity), rotate: degrees((ang * 180) / Math.PI) });
      } else {
        const y = wm.position === 'center' ? height / 2 - th / 3 : wm.position === 'top' ? height - th - 24 : 24;
        pg.drawText(text, { x: (width - tw) / 2, y, size, font: f, color, opacity: Number(wm.opacity) });
      }
    });
    finish(await doc.save(), `${baseOf(file.name)}-watermarked.pdf`);
  });

  /* ── Page numbers ── */
  const doNumbers = () => run(async () => {
    const { StandardFonts, rgb } = await loadPdfLib();
    const doc = await srcDoc();
    const f = await doc.embedFont(StandardFonts.Helvetica);
    const all = doc.getPages();
    const count = pn.skipFirst ? all.length - 1 : all.length;
    const start = Number(pn.start) || 1;
    all.forEach((pg, i) => {
      if (pn.skipFirst && i === 0) return;
      const n = start + i - (pn.skipFirst ? 1 : 0);
      const label = winAnsi(pn.format.replace('{n}', n).replace('{total}', start + count - 1));
      const size = Number(pn.size) || 10;
      const { width, height } = pg.getSize();
      const tw = f.widthOfTextAtSize(label, size), m = 28;
      const [v, h] = pn.position.split('-');
      const x = h === 'left' ? m : h === 'right' ? width - m - tw : (width - tw) / 2;
      const y = v === 'top' ? height - m : m - size / 2;
      pg.drawText(label, { x, y, size, font: f, color: rgb(0.2, 0.2, 0.25) });
    });
    finish(await doc.save(), `${baseOf(file.name)}-numbered.pdf`);
  });

  /* ── Compress (re-render pages as JPEG) ── */
  const doCompress = () => run(async () => {
    const q = { low: { scale: 1, jpg: 0.5 }, medium: { scale: 1.4, jpg: 0.62 }, high: { scale: 2, jpg: 0.78 } }[quality];
    const lib = await pdfjs();
    const { PDFDocument } = await loadPdfLib();
    const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const doc = await PDFDocument.create();
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: q.scale });
      const c = document.createElement('canvas');
      c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const jpg = await new Promise(r => c.toBlob(r, 'image/jpeg', q.jpg));
      const img = await doc.embedJpg(await jpg.arrayBuffer());
      doc.addPage([base.width, base.height]).drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
    }
    finish(await doc.save(), `${baseOf(file.name)}-compressed.pdf`);
  });

  const runAction = { organise: doOrganise, split: doSplit, watermark: doWatermark, numbers: doNumbers, compress: doCompress }[action];

  const rotate = (i, d) => setPages(ps => ps.map((p, k) => (k === i ? { ...p, rot: (p.rot + d + 360) % 360 } : p)));
  const toggleDelete = (i) => setPages(ps => ps.map((p, k) => (k === i ? { ...p, deleted: !p.deleted } : p)));
  const moveTo = (from, to) => setPages(ps => { if (from === to) return ps; const c = [...ps]; const [x] = c.splice(from, 1); c.splice(to, 0, x); return c; });

  const continueWith = () => {
    if (!result || result.isZip) return;
    load(new File([result.blob], result.name, { type: 'application/pdf' }));
  };

  return (
    <div style={{ paddingBottom: 32 }}>
      <ToolHeader icon={FileCog} color="var(--danger)" title="PDF Tools" subtitle="Organise, split, watermark, number or compress a PDF — all in your browser." onBack={onBack} />

      {!file ? (
        <>
          <DropZone accept=".pdf,application/pdf" multiple={false} onFiles={fs => load(fs[0])} title="Drop a PDF here, or click to choose" hint="One PDF at a time. To combine PDFs use File Converter → Merge PDFs." />
          {error && <div style={{ marginTop: 12 }}><Notice>{error}</Notice></div>}
        </>
      ) : (
        <>
          {/* File bar */}
          <div style={{ ...card, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontFamily: font.head, fontWeight: 700, fontSize: '.88rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
              <div style={{ fontFamily: font.body, fontSize: '.74rem', color: 'var(--text-muted)' }}>{loading ? 'Reading…' : `${total} page${total === 1 ? '' : 's'} · ${fmtBytes(file.size)}`}</div>
            </div>
            <Btn variant="ghost" icon={X} onClick={() => { loadToken.current++; setFile(null); setPages([]); setResult(null); }}>Choose another PDF</Btn>
          </div>

          <div style={{ marginBottom: 14 }}><Segmented value={action} onChange={setAction} options={ACTIONS} /></div>

          {/* Options per action */}
          <Panel style={{ marginBottom: 14 }}>
            {action === 'organise' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 240, fontFamily: font.body, fontSize: '.8rem', color: 'var(--text-muted)' }}>
                  Drag thumbnails to reorder. Use the buttons on each page to rotate or delete. {kept.length !== total && <b style={{ color: 'var(--danger)' }}>{total - kept.length} page(s) will be removed.</b>}
                </div>
                <Btn variant="ghost" icon={RotateCw} onClick={() => setPages(ps => ps.map(p => ({ ...p, rot: (p.rot + 90) % 360 })))}>Rotate all</Btn>
                <Btn variant="ghost" icon={Undo2} disabled={!changed} onClick={() => setPages(ps => [...ps].sort((a, b) => a.index - b.index).map(p => ({ ...p, rot: 0, deleted: false })))}>Reset</Btn>
              </div>
            )}
            {action !== 'organise' && changed && (
              <div style={{ marginBottom: 12 }}><Notice type="warning">Your changes in “Organise pages” aren't saved yet. Go back, click “Save organised PDF”, then “Keep editing this result” to use them here.</Notice></div>
            )}
            {action === 'split' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14, alignItems: 'end' }}>
                <Field label="Mode">
                  <select style={inputStyle} value={splitMode} onChange={e => setSplitMode(e.target.value)}>
                    <option value="extract">Extract pages into one PDF</option>
                    <option value="ranges">One PDF per range</option>
                    <option value="every">Split every N pages</option>
                  </select>
                </Field>
                {splitMode !== 'every' ? (
                  <Field label="Pages" hint={`e.g. 1-3, 5, 8-  (1 to ${total})`}>
                    <input style={inputStyle} value={ranges} onChange={e => setRanges(e.target.value)} placeholder="1-3, 5, 8-" />
                  </Field>
                ) : (
                  <Field label="Pages per file" hint={`Makes ${Math.ceil(total / Math.max(1, Number(everyN) || 1))} file(s)`}>
                    <input style={inputStyle} type="number" min={1} max={total} value={everyN} onChange={e => setEveryN(e.target.value)} />
                  </Field>
                )}
              </div>
            )}
            {action === 'watermark' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 14 }}>
                <Field label="Text" style={{ gridColumn: 'span 2' }}><input style={inputStyle} value={wm.text} onChange={e => setWm({ ...wm, text: e.target.value })} /></Field>
                <Field label="Position">
                  <select style={inputStyle} value={wm.position} onChange={e => setWm({ ...wm, position: e.target.value })}>
                    <option value="diagonal">Diagonal</option><option value="center">Centre</option><option value="top">Top</option><option value="bottom">Bottom</option>
                  </select>
                </Field>
                <Field label="Colour">
                  <select style={inputStyle} value={wm.color} onChange={e => setWm({ ...wm, color: e.target.value })}>
                    <option value="gray">Grey</option><option value="red">Red</option><option value="blue">Blue</option>
                  </select>
                </Field>
                <Field label={`Size · ${wm.size}pt`}><input type="range" min={16} max={120} value={wm.size} onChange={e => setWm({ ...wm, size: e.target.value })} /></Field>
                <Field label={`Opacity · ${Math.round(wm.opacity * 100)}%`}><input type="range" min={0.05} max={0.8} step={0.01} value={wm.opacity} onChange={e => setWm({ ...wm, opacity: e.target.value })} /></Field>
              </div>
            )}
            {action === 'numbers' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 14, alignItems: 'end' }}>
                <Field label="Format">
                  <select style={inputStyle} value={pn.format} onChange={e => setPn({ ...pn, format: e.target.value })}>
                    <option value="{n}">1</option><option value="Page {n}">Page 1</option><option value="Page {n} of {total}">Page 1 of N</option><option value="{n} / {total}">1 / N</option>
                  </select>
                </Field>
                <Field label="Position">
                  <select style={inputStyle} value={pn.position} onChange={e => setPn({ ...pn, position: e.target.value })}>
                    <option value="bottom-center">Bottom centre</option><option value="bottom-right">Bottom right</option><option value="bottom-left">Bottom left</option>
                    <option value="top-right">Top right</option><option value="top-center">Top centre</option>
                  </select>
                </Field>
                <Field label="Start at"><input style={inputStyle} type="number" min={1} value={pn.start} onChange={e => setPn({ ...pn, start: e.target.value })} /></Field>
                <Field label="Font size"><input style={inputStyle} type="number" min={6} max={24} value={pn.size} onChange={e => setPn({ ...pn, size: e.target.value })} /></Field>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: font.body, fontSize: '.8rem', color: 'var(--text-secondary)', paddingBottom: 8 }}>
                  <input type="checkbox" checked={pn.skipFirst} onChange={e => setPn({ ...pn, skipFirst: e.target.checked })} /> Skip cover page
                </label>
              </div>
            )}
            {action === 'compress' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Segmented value={quality} onChange={setQuality} options={[
                  { value: 'low', label: 'Smallest file' }, { value: 'medium', label: 'Balanced' }, { value: 'high', label: 'Best quality' },
                ]} />
                <Notice type="info">Best for scanned PDFs and photos. Pages are re-saved as images, so text will no longer be selectable or searchable. Keep the original for records.</Notice>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
              <Btn icon={ACTIONS.find(a => a.value === action).icon} busy={busy} disabled={loading || !total} onClick={runAction}>
                {busy ? 'Working…' : { organise: 'Save organised PDF', split: 'Split PDF', watermark: 'Add watermark', numbers: 'Add page numbers', compress: 'Compress PDF' }[action]}
              </Btn>
            </div>
            {error && <div style={{ marginTop: 12 }}><Notice>{error}</Notice></div>}
            {result && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <ResultRow name={result.name} size={result.size} before={action === 'compress' ? result.before : null} onDownload={() => downloadBlob(result.blob, result.name)} />
                {action === 'compress' && result.size >= result.before && <Notice type="warning">This PDF is already well compressed — the result is not smaller. Keep the original.</Notice>}
                {!result.isZip && <div><Btn variant="ghost" icon={Repeat} onClick={continueWith}>Keep editing this result</Btn></div>}
              </div>
            )}
          </Panel>

          {/* Thumbnails */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {shown.map((p, i) => (
              <div key={`${p.index}`}
                draggable={action === 'organise'}
                onDragStart={() => { dragFrom.current = i; }}
                onDragOver={e => action === 'organise' && e.preventDefault()}
                onDrop={e => { e.preventDefault(); if (dragFrom.current !== null) moveTo(dragFrom.current, i); dragFrom.current = null; }}
                style={{ ...card, padding: 8, cursor: action === 'organise' ? 'grab' : 'default', opacity: p.deleted ? 0.4 : 1, transition: 'opacity .2s, transform .2s',
                  outline: p.deleted ? '2px solid var(--danger)' : 'none' }}>
                <div style={{ height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elevated)', borderRadius: 8, overflow: 'hidden' }}>
                  {p.thumb
                    ? <img src={p.thumb} alt={`Page ${p.index + 1}`} style={{ maxWidth: '100%', maxHeight: '100%', transform: `rotate(${p.rot}deg)`, transition: 'transform .25s', boxShadow: '0 1px 4px rgba(0,0,0,.15)' }} />
                    : <span style={{ fontFamily: font.body, fontSize: '.72rem', color: 'var(--text-muted)' }}>{i < MAX_THUMBS ? 'Loading…' : 'No preview'}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 7, gap: 4 }}>
                  <span style={{ fontFamily: font.head, fontWeight: 700, fontSize: '.74rem', color: 'var(--text-secondary)' }}>
                    {i + 1}{p.index !== i && <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> (was {p.index + 1})</span>}
                  </span>
                  {action === 'organise' && (
                    <span style={{ display: 'flex', gap: 3 }}>
                      {[[RotateCcw, -90, 'Rotate left'], [RotateCw, 90, 'Rotate right']].map(([Ic, d, t]) => (
                        <button key={t} type="button" title={t} onClick={() => rotate(i, d)} style={miniBtn}><Ic size={12} /></button>
                      ))}
                      <button type="button" title={p.deleted ? 'Restore' : 'Delete'} onClick={() => toggleDelete(i)} style={{ ...miniBtn, color: p.deleted ? 'var(--success)' : 'var(--danger)' }}>
                        {p.deleted ? <Undo2 size={12} /> : <Trash2 size={12} />}
                      </button>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const miniBtn = { width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 };

export default PdfTools;
