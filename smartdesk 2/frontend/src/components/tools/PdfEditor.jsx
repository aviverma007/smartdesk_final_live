import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FilePen, MousePointer2, Type, PenLine, Highlighter, Eraser, Square, ImagePlus, PenTool, Undo2, Redo2, Trash2,
  ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Download, Bold, X, Check, CalendarDays, FileUp,
} from 'lucide-react';
import { pdfjs, baseOf, downloadBlob } from '../../services/converter';
import { DropZone, ToolHeader, Notice, Btn, btnStyle, font, card } from './shared';

/*
 * PDF Editor — add text, freehand drawing, highlights, white-out, boxes, images and a
 * drawn signature to any page, then download the edited PDF. Runs in the browser.
 * Item coordinates are stored in page units (1 unit = 1 pt at zoom 1, top-left origin of
 * the page as displayed) and converted to PDF space only when saving.
 */

const TOOLS = [
  { id: 'select', label: 'Select / move', Icon: MousePointer2, key: 'v' },
  { id: 'text', label: 'Add text', Icon: Type, key: 't' },
  { id: 'draw', label: 'Draw', Icon: PenLine, key: 'd' },
  { id: 'highlight', label: 'Highlight', Icon: Highlighter, key: 'h' },
  { id: 'whiteout', label: 'White-out (hide text)', Icon: Eraser, key: 'w' },
  { id: 'box', label: 'Rectangle', Icon: Square, key: 'r' },
];
const INK = ['#111827', '#1d4ed8', '#dc2626', '#15803d', '#7c3aed', '#ffffff'];
const MARKER = ['#fde047', '#86efac', '#93c5fd', '#f9a8d4'];
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48];
const TEXT_FONT = 'Helvetica, Arial, sans-serif';
const LINE_H = 1.2;

let uid = 0;
const newId = () => `i${Date.now().toString(36)}${(uid++).toString(36)}`;

const measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
const textBox = (it) => {
  const lines = String(it.text || ' ').split('\n');
  let w = 20;
  if (measureCtx) {
    measureCtx.font = `${it.bold ? 'bold ' : ''}${it.size}px ${TEXT_FONT}`;
    w = Math.max(...lines.map(l => measureCtx.measureText(l || ' ').width), it.size);
  }
  return { w: w + 2, h: lines.length * it.size * LINE_H };
};

const hexToRgb = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
// Standard PDF fonts only cover Western (WinAnsi) characters
const winAnsiSafe = (s) => s.replace(/[^\x20-\x7E\xA0-\xFF–—‘’“”•…€™]/g, '?');

const readAsDataURL = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
const imgSize = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res({ w: 200, h: 100 }); i.src = src; });

/* ── Signature pad ─────────────────────────────────────────────────────────── */
function SignaturePad({ onClose, onUse }) {
  const ref = useRef(null);
  const [ink, setInk] = useState('#1d3a8a');
  const [empty, setEmpty] = useState(true);
  const drawing = useRef(null);
  useEffect(() => {
    const c = ref.current, dpr = window.devicePixelRatio || 1;
    c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr;
    c.getContext('2d').scale(dpr, dpr);
  }, []);
  const pos = (e) => { const r = ref.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const down = (e) => { ref.current.setPointerCapture(e.pointerId); drawing.current = pos(e); setEmpty(false); };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = ref.current.getContext('2d'), p = pos(e);
    ctx.strokeStyle = ink; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(...drawing.current); ctx.lineTo(...p); ctx.stroke();
    drawing.current = p;
  };
  const up = () => { drawing.current = null; };
  const clear = () => { const c = ref.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); setEmpty(true); };
  const use = () => {
    // Trim transparent edges so the signature is placed tightly
    const c = ref.current, ctx = c.getContext('2d');
    const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
    let x0 = width, y0 = height, x1 = 0, y1 = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 <= x0 || y1 <= y0) return;
    const pad = 6, out = document.createElement('canvas');
    out.width = x1 - x0 + pad * 2; out.height = y1 - y0 + pad * 2;
    out.getContext('2d').drawImage(c, x0 - pad, y0 - pad, out.width, out.height, 0, 0, out.width, out.height);
    onUse(out.toDataURL('image/png'), out.width, out.height);
  };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(2,6,23,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, width: 'min(560px,100%)', padding: 18, animation: 'tabIn .25s ease both' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontFamily: font.head, fontWeight: 800, color: 'var(--text-primary)' }}>Draw your signature</div>
          <button type="button" onClick={onClose} style={{ ...btnStyle('ghost'), padding: 6 }} aria-label="Close"><X size={15} /></button>
        </div>
        <canvas ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          style={{ width: '100%', height: 190, borderRadius: 12, background: '#fff', border: '1px dashed var(--border)', touchAction: 'none', cursor: 'crosshair', display: 'block' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {['#1d3a8a', '#111827', '#1d4ed8'].map(c => (
            <button key={c} type="button" onClick={() => setInk(c)} aria-label={`Ink ${c}`} style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: ink === c ? '3px solid var(--accent)' : '2px solid var(--border)', cursor: 'pointer' }} />
          ))}
          <span style={{ flex: 1 }} />
          <Btn variant="ghost" onClick={clear}>Clear</Btn>
          <Btn icon={Check} disabled={empty} onClick={use}>Use signature</Btn>
        </div>
      </div>
    </div>
  );
}

/* ── Editor ───────────────────────────────────────────────────────────────── */
export default function PdfEditor({ onBack }) {
  const [file, setFile] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [pages, setPages] = useState([]);        // [{w,h}] at zoom 1
  const [thumbs, setThumbs] = useState([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [items, setItems] = useState({});        // { [page]: Item[] }
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [tool, setTool] = useState('select');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [pending, setPending] = useState(null);  // image waiting to be placed {src,w,h,sig}
  const [style, setStyle] = useState({ textColor: '#111827', size: 14, bold: false, ink: '#1d4ed8', width: 2, marker: '#fde047', boxColor: '#dc2626' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sigOpen, setSigOpen] = useState(false);
  const [saved, setSaved] = useState('');

  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const stageRef = useRef(null);
  const imgInputRef = useRef(null);
  const drag = useRef(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const pageItems = items[pageIdx] || [];
  const sel = pageItems.find(i => i.id === selected) || null;
  const dims = pages[pageIdx];
  const editCount = Object.values(items).reduce((n, l) => n + l.length, 0);

  /* history */
  const snapshot = useCallback(() => { setPast(p => [...p.slice(-60), itemsRef.current]); setFuture([]); }, []);
  const undo = useCallback(() => {
    if (!past.length) return;
    setFuture(f => [itemsRef.current, ...f]); setItems(past[past.length - 1]); setPast(past.slice(0, -1));
    setSelected(null); setEditing(null);
  }, [past]);
  const redo = useCallback(() => {
    if (!future.length) return;
    setPast(p => [...p, itemsRef.current]); setItems(future[0]); setFuture(future.slice(1));
    setSelected(null); setEditing(null);
  }, [future]);

  const updatePage = useCallback((fn) => setItems(all => ({ ...all, [pageIdx]: fn(all[pageIdx] || []) })), [pageIdx]);
  const patchItem = useCallback((id, patch) => updatePage(list => list.map(i => (i.id === id ? { ...i, ...(typeof patch === 'function' ? patch(i) : patch) } : i))), [updatePage]);
  const removeItem = useCallback((id) => { snapshot(); updatePage(list => list.filter(i => i.id !== id)); setSelected(null); setEditing(null); }, [snapshot, updatePage]);

  /* load */
  const open = async (files) => {
    const f = files.find(x => /\.pdf$/i.test(x.name) || x.type === 'application/pdf');
    if (!f) { setError('Please choose a PDF file.'); return; }
    setError(''); setBusy(true); setSaved('');
    try {
      const lib = await pdfjs();
      const doc = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
      const dimsList = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const v = (await doc.getPage(i)).getViewport({ scale: 1 });
        dimsList.push({ w: v.width, h: v.height });
      }
      setFile(f); setPdf(doc); setPages(dimsList); setItems({}); setPast([]); setFuture([]); setPageIdx(0); setSelected(null); setEditing(null); setThumbs([]);
    } catch (e) {
      setError(/password/i.test(String(e?.message)) ? 'This PDF is password-protected. Remove the password first.' : 'This PDF could not be opened (it may be damaged).');
    } finally { setBusy(false); }
  };

  /* fit page width when a document opens */
  useEffect(() => {
    if (!pdf || !pages.length || !stageRef.current) return;
    const avail = stageRef.current.clientWidth - 40;
    setZoom(Math.max(0.4, Math.min(1.6, avail / pages[0].w)));
  }, [pdf, pages]);

  /* render current page (one render at a time on the canvas) */
  const renderRef = useRef(null);
  useEffect(() => {
    if (!pdf || !canvasRef.current) return undefined;
    let task, cancelled = false;
    (async () => {
      if (renderRef.current) { renderRef.current.cancel(); try { await renderRef.current.promise; } catch (_) {} }
      const page = await pdf.getPage(pageIdx + 1);
      if (cancelled) return;
      const dpr = window.devicePixelRatio || 1;
      const vp = page.getViewport({ scale: zoom * dpr });
      const c = canvasRef.current; if (!c) return;
      c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
      c.style.width = `${vp.width / dpr}px`; c.style.height = `${vp.height / dpr}px`;
      task = page.render({ canvasContext: c.getContext('2d'), viewport: vp });
      renderRef.current = task;
      try { await task.promise; } catch (_) { /* cancelled */ }
      if (renderRef.current === task) renderRef.current = null;
    })();
    return () => { cancelled = true; if (task) task.cancel(); };
  }, [pdf, pageIdx, zoom]);

  /* thumbnails */
  useEffect(() => {
    if (!pdf) return undefined;
    let stop = false;
    (async () => {
      const list = [];
      for (let i = 1; i <= Math.min(pdf.numPages, 80) && !stop; i++) {
        const page = await pdf.getPage(i);
        const v1 = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: 96 / v1.width });
        const c = document.createElement('canvas');
        c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
        await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
        list.push(c.toDataURL('image/jpeg', 0.7));
        if (i % 4 === 0 || i === pdf.numPages) setThumbs([...list]);
      }
    })();
    return () => { stop = true; };
  }, [pdf]);

  /* keyboard */
  useEffect(() => {
    if (!pdf) return undefined;
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'textarea' || tag === 'input' || tag === 'select';
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); return; }
      if (typing) { if (e.key === 'Escape') { setEditing(null); e.target.blur(); } return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); removeItem(selected); return; }
      if (e.key === 'Escape') { setSelected(null); setPending(null); setTool('select'); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = TOOLS.find(x => x.key === e.key.toLowerCase());
      if (t) { setTool(t.id); setPending(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pdf, selected, undo, redo, removeItem]);

  /* pointer → page units */
  const toPage = (e) => {
    const r = overlayRef.current.getBoundingClientRect();
    return [(e.clientX - r.left) / zoom, (e.clientY - r.top) / zoom];
  };

  const onDown = (e) => {
    if (e.button !== 0 || !dims) return;
    if ((e.target.tagName || '').toLowerCase() === 'textarea') return;
    e.preventDefault(); // keep focus where we put it (e.g. a new text box) — no mousedown focus change
    if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') document.activeElement.blur();
    const [x, y] = toPage(e);
    const hit = e.target.closest && e.target.closest('[data-id]');
    const hitId = hit && hit.getAttribute('data-id');
    const handle = e.target.closest && e.target.closest('[data-handle]');

    if (pending) {
      snapshot();
      const w = pending.sig ? Math.min(170, dims.w * 0.35) : Math.min(220, dims.w * 0.4, pending.w);
      const h = w * (pending.h / pending.w);
      const it = { id: newId(), type: 'image', x: x - w / 2, y: y - h / 2, w, h, src: pending.src };
      updatePage(l => [...l, it]); setSelected(it.id); setPending(null); setTool('select');
      return;
    }

    if (tool === 'select') {
      if (handle) {
        const it = pageItems.find(i => i.id === handle.getAttribute('data-handle'));
        if (it) drag.current = { mode: 'resize', id: it.id, start: [x, y], orig: it, pushed: false };
      } else if (hitId) {
        const it = pageItems.find(i => i.id === hitId);
        setSelected(hitId); if (editing !== hitId) setEditing(null);
        if (it) drag.current = { mode: 'move', id: it.id, start: [x, y], orig: it, pushed: false };
      } else { setSelected(null); setEditing(null); return; }
    } else if (tool === 'text') {
      const it = hitId && pageItems.find(i => i.id === hitId && i.type === 'text');
      if (it) { setSelected(it.id); setEditing(it.id); return; }
      snapshot();
      const nt = { id: newId(), type: 'text', x, y: y - style.size * 0.6, text: '', size: style.size, color: style.textColor, bold: style.bold };
      updatePage(l => [...l, nt]); setSelected(nt.id); setEditing(nt.id);
      return;
    } else if (tool === 'draw') {
      snapshot();
      const it = { id: newId(), type: 'pen', points: [[x, y]], color: style.ink, width: style.width };
      updatePage(l => [...l, it]);
      drag.current = { mode: 'pen', id: it.id };
    } else {
      snapshot();
      const kind = tool;
      const it = { id: newId(), type: 'rect', kind, x, y, w: 0, h: 0,
        color: kind === 'highlight' ? style.marker : kind === 'whiteout' ? '#ffffff' : style.boxColor, width: style.width };
      updatePage(l => [...l, it]);
      drag.current = { mode: 'rect', id: it.id, start: [x, y] };
    }
    try { overlayRef.current.setPointerCapture(e.pointerId); } catch (_) {}
  };

  const onMove = (e) => {
    const d = drag.current; if (!d) return;
    const [x, y] = toPage(e);
    const cx = Math.max(0, Math.min(dims.w, x)), cy = Math.max(0, Math.min(dims.h, y));
    if (d.mode === 'pen') {
      patchItem(d.id, it => {
        const last = it.points[it.points.length - 1];
        return Math.hypot(cx - last[0], cy - last[1]) < 0.8 / zoom ? {} : { points: [...it.points, [cx, cy]] };
      });
    } else if (d.mode === 'rect') {
      const [sx, sy] = d.start;
      patchItem(d.id, { x: Math.min(sx, cx), y: Math.min(sy, cy), w: Math.abs(cx - sx), h: Math.abs(cy - sy) });
    } else if (d.mode === 'move' || d.mode === 'resize') {
      const dx = x - d.start[0], dy = y - d.start[1];
      if (!d.pushed) { if (Math.hypot(dx, dy) < 1.5 / zoom) return; snapshot(); d.pushed = true; }
      const o = d.orig;
      if (d.mode === 'move') {
        if (o.type === 'pen') patchItem(d.id, { points: o.points.map(([px, py]) => [px + dx, py + dy]) });
        else patchItem(d.id, { x: o.x + dx, y: o.y + dy });
      } else if (o.type === 'image') {
        const w = Math.max(16, o.w + dx);
        patchItem(d.id, { w, h: w * (o.h / o.w) });
      } else {
        patchItem(d.id, { w: Math.max(4, o.w + dx), h: Math.max(4, o.h + dy) });
      }
    }
  };

  const onUp = (e) => {
    const d = drag.current; drag.current = null;
    try { overlayRef.current.releasePointerCapture(e.pointerId); } catch (_) {}
    if (!d) return;
    if (d.mode === 'rect') {
      const it = (itemsRef.current[pageIdx] || []).find(i => i.id === d.id);
      if (it && (it.w < 3 || it.h < 3)) { updatePage(l => l.filter(i => i.id !== d.id)); setPast(p => p.slice(0, -1)); }
    }
    if (d.mode === 'pen') {
      const it = (itemsRef.current[pageIdx] || []).find(i => i.id === d.id);
      if (it && it.points.length === 1) patchItem(d.id, { points: [...it.points, [it.points[0][0] + 0.5, it.points[0][1] + 0.5]] });
    }
  };

  /* property changes apply to the selected item and become the new default */
  const setProp = (key, value) => {
    setStyle(s => ({ ...s, [key]: value }));
    if (!sel) return;
    const map = {
      text: { textColor: 'color', size: 'size', bold: 'bold' },
      pen: { ink: 'color', width: 'width' },
      rect: sel.kind === 'highlight' ? { marker: 'color' } : sel.kind === 'box' ? { boxColor: 'color', width: 'width' } : {},
    }[sel.type] || {};
    if (map[key]) { snapshot(); patchItem(sel.id, { [map[key]]: value }); }
  };

  const addImage = async (f) => {
    if (!f) return;
    if (!/^image\/(png|jpe?g)$/i.test(f.type)) { setError('Use a PNG or JPG image.'); return; }
    const src = await readAsDataURL(f);
    const { w, h } = await imgSize(src);
    setPending({ src, w, h, sig: false }); setTool('select'); setError('');
  };

  const addDate = () => {
    if (!dims) return;
    snapshot();
    const d = new Date();
    const txt = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const it = { id: newId(), type: 'text', x: dims.w / 2 - 35, y: dims.h / 2, text: txt, size: style.size, color: style.textColor, bold: style.bold };
    updatePage(l => [...l, it]); setSelected(it.id); setTool('select');
  };

  /* save */
  const save = async () => {
    if (!file) return;
    setBusy(true); setError(''); setSaved('');
    try {
      const { PDFDocument, StandardFonts, rgb, degrees, LineCapStyle, BlendMode } = await import('pdf-lib');
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const regular = await doc.embedFont(StandardFonts.Helvetica);
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);
      const imgCache = {};
      let replaced = false;
      for (const [k, list] of Object.entries(items)) {
        if (!list.length) continue;
        const idx = Number(k);
        const page = doc.getPage(idx);
        const vp = (await pdf.getPage(idx + 1)).getViewport({ scale: 1 });
        const P = (x, y) => vp.convertToPdfPoint(x, y);
        const rot = degrees(((vp.rotation % 360) + 360) % 360);
        for (const it of list) {
          if (it.type === 'rect') {
            const [ax, ay] = P(it.x, it.y), [bx, by] = P(it.x + it.w, it.y + it.h);
            const box = { x: Math.min(ax, bx), y: Math.min(ay, by), width: Math.abs(bx - ax), height: Math.abs(by - ay) };
            const c = rgb(...hexToRgb(it.color));
            if (it.kind === 'highlight') page.drawRectangle({ ...box, color: c, opacity: 0.4, blendMode: BlendMode.Multiply });
            else if (it.kind === 'whiteout') page.drawRectangle({ ...box, color: c });
            else page.drawRectangle({ ...box, borderColor: c, borderWidth: it.width });
          } else if (it.type === 'pen') {
            const c = rgb(...hexToRgb(it.color));
            for (let i = 1; i < it.points.length; i++) {
              const [x1, y1] = P(...it.points[i - 1]), [x2, y2] = P(...it.points[i]);
              page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: it.width, color: c, lineCap: LineCapStyle.Round });
            }
          } else if (it.type === 'text') {
            if (!it.text.trim()) continue;
            const fnt = it.bold ? bold : regular;
            it.text.split('\n').forEach((line, n) => {
              const safe = winAnsiSafe(line);
              if (safe !== line) replaced = true;
              const [x, y] = P(it.x + 1, it.y + it.size * (n * LINE_H + 0.95));
              page.drawText(safe, { x, y, size: it.size, font: fnt, color: rgb(...hexToRgb(it.color)), rotate: rot });
            });
          } else if (it.type === 'image') {
            if (!imgCache[it.src]) {
              const bytes = await (await fetch(it.src)).arrayBuffer();
              imgCache[it.src] = /^data:image\/jpe?g/i.test(it.src) ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
            }
            const [x, y] = P(it.x, it.y + it.h);
            page.drawImage(imgCache[it.src], { x, y, width: it.w, height: it.h, rotate: rot });
          }
        }
      }
      const name = `${baseOf(file.name)}-edited.pdf`;
      downloadBlob(new Blob([await doc.save()], { type: 'application/pdf' }), name);
      setSaved(replaced ? `${name} downloaded. Note: some characters (e.g. Hindi) can't be written with the standard PDF font and were replaced with "?".` : `${name} downloaded.`);
    } catch (e) {
      setError(`Could not save: ${e?.message || e}`);
    } finally { setBusy(false); }
  };

  /* ── upload screen ── */
  if (!pdf) {
    return (
      <div style={{ paddingBottom: 32 }}>
        <ToolHeader icon={FilePen} color="var(--accent-purple)" title="PDF Editor" subtitle="Add text, signatures, highlights, drawings and images to a PDF — or white-out what you need to hide." onBack={onBack} />
        <div style={{ display: 'grid', gap: 14, maxWidth: 760 }}>
          <DropZone accept=".pdf,application/pdf" multiple={false} onFiles={open} title={busy ? 'Opening…' : 'Drop a PDF here, or click to choose'} hint="The file is edited in your browser — it is never uploaded." />
          {error && <Notice>{error}</Notice>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
            {[[Type, 'Type on any page', 'Fill forms, add notes'], [PenTool, 'Sign', 'Draw your signature once, place it anywhere'], [Highlighter, 'Highlight & draw', 'Mark up for review'], [Eraser, 'White-out', 'Cover text or numbers before sharing']].map(([I, t, d]) => (
              <div key={t} style={{ ...card, padding: 14, display: 'flex', gap: 10 }}>
                <I size={18} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
                <div><div style={{ fontFamily: font.head, fontWeight: 700, fontSize: '.84rem', color: 'var(--text-primary)' }}>{t}</div><div style={{ fontFamily: font.body, fontSize: '.76rem', color: 'var(--text-muted)', marginTop: 2 }}>{d}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── editor ── */
  const toolBtn = (on) => ({
    width: 38, height: 38, borderRadius: 10, border: on ? '1px solid var(--accent)' : '1px solid transparent', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s',
    background: on ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text-secondary)',
  });
  const swatch = (c, on, onClick, label) => (
    <button key={c} type="button" onClick={onClick} title={label || c} aria-label={label || c}
      style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', flexShrink: 0, border: on ? '3px solid var(--accent)' : '1px solid var(--border)', boxShadow: c === '#ffffff' ? 'inset 0 0 0 1px #cbd5e1' : 'none' }} />
  );
  const kindNow = sel ? (sel.type === 'rect' ? sel.kind : sel.type === 'pen' ? 'draw' : sel.type) : tool;
  const cursor = pending ? 'copy' : tool === 'text' ? 'text' : tool === 'select' ? 'default' : 'crosshair';
  const divider = <span style={{ width: 1, height: 26, background: 'var(--border)', margin: '0 4px' }} />;

  return (
    <div style={{ paddingBottom: 24 }}>
      <ToolHeader icon={FilePen} color="var(--accent-purple)" title="PDF Editor" subtitle={`${file.name} · ${pages.length} page${pages.length > 1 ? 's' : ''}`} onBack={onBack} />

      {/* Toolbar */}
      <div style={{ ...card, overflow: 'visible', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 20, marginBottom: 12 }}>
        {TOOLS.map(t => (
          <button key={t.id} type="button" title={`${t.label} (${t.key.toUpperCase()})`} aria-label={t.label} style={toolBtn(tool === t.id && !pending)}
            onClick={() => { setTool(t.id); setPending(null); if (t.id !== 'select') { setSelected(null); setEditing(null); } }}><t.Icon size={18} /></button>
        ))}
        <button type="button" title="Signature" aria-label="Signature" style={toolBtn(!!pending && pending.sig)} onClick={() => setSigOpen(true)}><PenTool size={18} /></button>
        <button type="button" title="Insert image (PNG/JPG)" aria-label="Insert image" style={toolBtn(!!pending && !pending.sig)} onClick={() => imgInputRef.current?.click()}><ImagePlus size={18} /></button>
        <button type="button" title="Insert today's date" aria-label="Insert date" style={toolBtn(false)} onClick={addDate}><CalendarDays size={18} /></button>
        <input ref={imgInputRef} type="file" hidden accept="image/png,image/jpeg" onChange={e => { addImage(e.target.files?.[0]); e.target.value = ''; }} />
        {divider}
        <button type="button" title="Undo (Ctrl+Z)" aria-label="Undo" style={{ ...toolBtn(false), opacity: past.length ? 1 : .4 }} disabled={!past.length} onClick={undo}><Undo2 size={18} /></button>
        <button type="button" title="Redo (Ctrl+Y)" aria-label="Redo" style={{ ...toolBtn(false), opacity: future.length ? 1 : .4 }} disabled={!future.length} onClick={redo}><Redo2 size={18} /></button>
        <button type="button" title="Delete selected (Del)" aria-label="Delete selected" style={{ ...toolBtn(false), opacity: sel ? 1 : .4, color: sel ? 'var(--danger)' : 'var(--text-secondary)' }} disabled={!sel} onClick={() => sel && removeItem(sel.id)}><Trash2 size={18} /></button>
        {divider}

        {/* Context properties */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minHeight: 38 }}>
          {kindNow === 'text' && (<>
            {INK.slice(0, 5).map(c => swatch(c, (sel ? sel.color : style.textColor) === c, () => setProp('textColor', c)))}
            <select value={sel ? sel.size : style.size} onChange={e => setProp('size', Number(e.target.value))} aria-label="Font size"
              style={{ height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontFamily: font.body, fontSize: '.8rem', padding: '0 6px' }}>
              {SIZES.map(s => <option key={s} value={s}>{s} pt</option>)}
            </select>
            <button type="button" aria-label="Bold" title="Bold" onClick={() => setProp('bold', !(sel ? sel.bold : style.bold))} style={{ ...toolBtn(sel ? sel.bold : style.bold), width: 32, height: 30 }}><Bold size={15} /></button>
          </>)}
          {kindNow === 'draw' && (<>
            {INK.slice(0, 5).map(c => swatch(c, (sel ? sel.color : style.ink) === c, () => setProp('ink', c)))}
            {[1, 2, 4, 6].map(w => (
              <button key={w} type="button" title={`${w}px`} aria-label={`Line ${w}`} onClick={() => setProp('width', w)} style={{ ...toolBtn((sel ? sel.width : style.width) === w), width: 30, height: 30 }}>
                <span style={{ width: 14, height: w + 1, borderRadius: 4, background: 'currentColor' }} />
              </button>
            ))}
          </>)}
          {kindNow === 'highlight' && MARKER.map(c => swatch(c, (sel ? sel.color : style.marker) === c, () => setProp('marker', c)))}
          {kindNow === 'box' && (<>
            {INK.slice(0, 5).map(c => swatch(c, (sel ? sel.color : style.boxColor) === c, () => setProp('boxColor', c)))}
            {[1, 2, 4].map(w => (
              <button key={w} type="button" aria-label={`Border ${w}`} onClick={() => setProp('width', w)} style={{ ...toolBtn((sel ? sel.width : style.width) === w), width: 30, height: 30 }}>
                <span style={{ width: 14, height: w + 1, borderRadius: 4, background: 'currentColor' }} />
              </button>
            ))}
          </>)}
          {kindNow === 'whiteout' && <span style={{ fontFamily: font.body, fontSize: '.76rem', color: 'var(--text-muted)' }}>Drag over text to cover it with white</span>}
          {kindNow === 'select' && !sel && <span style={{ fontFamily: font.body, fontSize: '.76rem', color: 'var(--text-muted)' }}>{pending ? 'Click on the page to place it' : 'Pick a tool, or click an item to move it'}</span>}
          {kindNow === 'image' && <span style={{ fontFamily: font.body, fontSize: '.76rem', color: 'var(--text-muted)' }}>Drag to move · drag the corner to resize</span>}
        </div>

        <span style={{ flex: 1 }} />
        <button type="button" aria-label="Zoom out" title="Zoom out" style={toolBtn(false)} onClick={() => setZoom(z => Math.max(0.3, +(z / 1.2).toFixed(2)))}><ZoomOut size={18} /></button>
        <span style={{ fontFamily: font.body, fontSize: '.76rem', color: 'var(--text-muted)', minWidth: 40, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Zoom in" title="Zoom in" style={toolBtn(false)} onClick={() => setZoom(z => Math.min(3, +(z * 1.2).toFixed(2)))}><ZoomIn size={18} /></button>
        {divider}
        <Btn variant="ghost" icon={FileUp} onClick={() => { setPdf(null); setFile(null); setItems({}); setSaved(''); }}>Other file</Btn>
        <Btn icon={Download} busy={busy} disabled={!editCount} onClick={save}>Download PDF</Btn>
      </div>

      {error && <div style={{ marginBottom: 10 }}><Notice>{error}</Notice></div>}
      {saved && <div style={{ marginBottom: 10 }}><Notice type="success">{saved}</Notice></div>}
      {pending && <div style={{ marginBottom: 10 }}><Notice type="info">{pending.sig ? 'Signature ready — click on the page where it should go.' : 'Image ready — click on the page where it should go.'} Press Esc to cancel.</Notice></div>}

      <div className="pdfed-layout" style={{ display: 'grid', gridTemplateColumns: '128px 1fr', gap: 12, alignItems: 'start' }}>
        {/* Thumbnails */}
        <div className="pdfed-thumbs" style={{ ...card, padding: 8, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '78vh', overflowY: 'auto' }}>
          {pages.map((p, i) => {
            const n = (items[i] || []).length;
            return (
              <button key={i} type="button" onClick={() => { setPageIdx(i); setSelected(null); setEditing(null); }} aria-label={`Page ${i + 1}`}
                style={{ position: 'relative', padding: 4, borderRadius: 8, cursor: 'pointer', background: i === pageIdx ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent', border: i === pageIdx ? '2px solid var(--accent)' : '2px solid transparent' }}>
                {thumbs[i]
                  ? <img src={thumbs[i]} alt="" style={{ width: '100%', display: 'block', borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,.2)' }} />
                  : <div style={{ width: '100%', aspectRatio: `${p.w} / ${p.h}`, background: 'var(--bg-elevated)', borderRadius: 4 }} />}
                <div style={{ fontFamily: font.body, fontSize: '.7rem', color: 'var(--text-muted)', marginTop: 3 }}>{i + 1}</div>
                {n > 0 && <span style={{ position: 'absolute', top: 2, right: 2, minWidth: 18, height: 18, borderRadius: 9, background: 'var(--accent)', color: '#fff', fontFamily: font.head, fontSize: '.62rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{n}</span>}
              </button>
            );
          })}
        </div>

        {/* Stage */}
        <div ref={stageRef} style={{ ...card, background: 'var(--bg-elevated)', padding: 20, overflow: 'auto', maxHeight: '78vh', minHeight: 300 }}>
          {dims && (
            <div style={{ position: 'relative', width: dims.w * zoom, height: dims.h * zoom, margin: '0 auto', boxShadow: '0 6px 24px rgba(0,0,0,.25)', background: '#fff' }}>
              <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, display: 'block' }} />
              <div ref={overlayRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                style={{ position: 'absolute', inset: 0, cursor, touchAction: 'none' }}>
                <svg width={dims.w * zoom} height={dims.h * zoom} viewBox={`0 0 ${dims.w} ${dims.h}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
                  {pageItems.map(it => {
                    const on = it.id === selected;
                    if (it.type === 'rect') return (
                      <g key={it.id}>
                        <rect data-id={it.id} x={it.x} y={it.y} width={it.w} height={it.h}
                          fill={it.kind === 'box' ? 'transparent' : it.color} fillOpacity={it.kind === 'highlight' ? 0.4 : 1}
                          style={it.kind === 'highlight' ? { mixBlendMode: 'multiply' } : undefined}
                          stroke={it.kind === 'box' ? it.color : on ? 'var(--accent)' : 'none'} strokeWidth={it.kind === 'box' ? it.width : 1 / zoom}
                          strokeDasharray={it.kind !== 'box' && on ? `${4 / zoom} ${3 / zoom}` : undefined} />
                        {on && <><rect x={it.x - 2 / zoom} y={it.y - 2 / zoom} width={it.w + 4 / zoom} height={it.h + 4 / zoom} fill="none" stroke="var(--accent)" strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`} pointerEvents="none" />
                          <rect data-handle={it.id} x={it.x + it.w - 5 / zoom} y={it.y + it.h - 5 / zoom} width={10 / zoom} height={10 / zoom} rx={2 / zoom} fill="#fff" stroke="var(--accent)" strokeWidth={1.5 / zoom} style={{ cursor: 'nwse-resize' }} /></>}
                      </g>
                    );
                    if (it.type === 'pen') {
                      const dpath = it.points.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
                      return (
                        <g key={it.id}>
                          <path d={dpath} fill="none" stroke={it.color} strokeWidth={it.width} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
                          <path data-id={it.id} d={dpath} fill="none" stroke="transparent" strokeWidth={Math.max(10 / zoom, it.width + 6)} strokeLinecap="round" />
                          {on && (() => { const xs = it.points.map(p => p[0]), ys = it.points.map(p => p[1]); const x0 = Math.min(...xs), y0 = Math.min(...ys); return <rect x={x0 - 4 / zoom} y={y0 - 4 / zoom} width={Math.max(...xs) - x0 + 8 / zoom} height={Math.max(...ys) - y0 + 8 / zoom} fill="none" stroke="var(--accent)" strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`} pointerEvents="none" />; })()}
                        </g>
                      );
                    }
                    if (it.type === 'image') return (
                      <g key={it.id}>
                        <image data-id={it.id} href={it.src} x={it.x} y={it.y} width={it.w} height={it.h} preserveAspectRatio="none" />
                        {on && <><rect x={it.x} y={it.y} width={it.w} height={it.h} fill="none" stroke="var(--accent)" strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`} pointerEvents="none" />
                          <rect data-handle={it.id} x={it.x + it.w - 5 / zoom} y={it.y + it.h - 5 / zoom} width={10 / zoom} height={10 / zoom} rx={2 / zoom} fill="#fff" stroke="var(--accent)" strokeWidth={1.5 / zoom} style={{ cursor: 'nwse-resize' }} /></>}
                      </g>
                    );
                    return null;
                  })}
                </svg>

                {pageItems.filter(i => i.type === 'text').map(it => {
                  const box = textBox(it);
                  const common = { position: 'absolute', left: it.x * zoom, top: it.y * zoom, fontFamily: TEXT_FONT, fontSize: it.size * zoom, lineHeight: LINE_H, fontWeight: it.bold ? 700 : 400, color: it.color, whiteSpace: 'pre', padding: 0, margin: 0 };
                  if (editing === it.id) return (
                    <textarea key={it.id} autoFocus value={it.text} spellCheck={false}
                      onFocus={e => { const v = e.target.value; e.target.setSelectionRange(v.length, v.length); }}
                      onChange={e => patchItem(it.id, { text: e.target.value })}
                      onBlur={() => { setEditing(null); if (!it.text.trim()) updatePage(l => l.filter(i => i.id !== it.id)); }}
                      placeholder="Type here"
                      style={{ ...common, width: (box.w + it.size * 2) * zoom, height: box.h * zoom + 4, border: '1px dashed var(--accent)', outline: 'none', background: 'rgba(255,255,255,.6)', resize: 'none', overflow: 'hidden', borderRadius: 2 }} />
                  );
                  return (
                    <div key={it.id} data-id={it.id}
                      onDoubleClick={() => { setSelected(it.id); setEditing(it.id); }}
                      style={{ ...common, minWidth: 8, minHeight: it.size * LINE_H * zoom, cursor: tool === 'select' ? 'move' : 'text', outline: it.id === selected ? '1px dashed var(--accent)' : 'none', outlineOffset: 2, userSelect: 'none' }}>{it.text || ' '}</div>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 14 }}>
            <button type="button" aria-label="Previous page" style={{ ...toolBtn(false), opacity: pageIdx ? 1 : .4 }} disabled={!pageIdx} onClick={() => { setPageIdx(i => i - 1); setSelected(null); }}><ChevronLeft size={18} /></button>
            <span style={{ fontFamily: font.body, fontSize: '.8rem', color: 'var(--text-secondary)' }}>Page {pageIdx + 1} of {pages.length}</span>
            <button type="button" aria-label="Next page" style={{ ...toolBtn(false), opacity: pageIdx < pages.length - 1 ? 1 : .4 }} disabled={pageIdx >= pages.length - 1} onClick={() => { setPageIdx(i => i + 1); setSelected(null); }}><ChevronRight size={18} /></button>
          </div>
        </div>
      </div>

      <p style={{ fontFamily: font.body, fontSize: '.72rem', color: 'var(--text-muted)', marginTop: 10 }}>
        Tip: double-click text to edit it · Del removes the selected item · Ctrl+Z undo. White-out covers content visually; to remove text completely, re-create the PDF from the original document.
      </p>

      {sigOpen && <SignaturePad onClose={() => setSigOpen(false)} onUse={(src, w, h) => { setPending({ src, w, h, sig: true }); setSigOpen(false); setTool('select'); setSelected(null); }} />}

      <style>{`
        @media (max-width: 760px){ .pdfed-layout{ grid-template-columns: 1fr !important; } .pdfed-thumbs{ flex-direction: row !important; max-height: none !important; overflow-x: auto; } .pdfed-thumbs > button{ width: 80px; flex-shrink: 0; } }
      `}</style>
    </div>
  );
}
