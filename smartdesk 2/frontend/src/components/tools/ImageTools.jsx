import React, { useEffect, useState } from 'react';
import { ImageDown, Download, X, Trash2, Minimize2 } from 'lucide-react';
import { downloadBlob, baseOf, extOf } from '../../services/converter';
import { Btn, DropZone, Field, Notice, Panel, Segmented, ToolHeader, card, font, inputStyle, fmtBytes } from './shared';

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Not a readable image')); };
    img.src = url;
  });
}
const toBlob = (c, type, q) => new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Could not encode image'))), type, q));

function draw(img, w, h, whiteBg) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  if (whiteBg) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/** Process one image with the chosen options. Returns { blob, name, w, h }. */
async function processImage(file, o) {
  const { img, url } = await loadImage(file);
  try {
    const ow = img.naturalWidth, oh = img.naturalHeight;
    let w = ow, h = oh;
    if (o.resize === 'max') { const m = Math.max(16, Number(o.maxPx) || 1600); const s = Math.min(1, m / Math.max(ow, oh)); w = ow * s; h = oh * s; }
    if (o.resize === 'percent') { const s = Math.min(4, Math.max(0.01, (Number(o.percent) || 100) / 100)); w = ow * s; h = oh * s; }
    if (o.resize === 'exact') { w = Number(o.w) || ow; h = Number(o.h) || Math.round((w / ow) * oh); }

    let fmt = o.format === 'same' ? (extOf(file.name) === 'jpeg' ? 'jpg' : extOf(file.name)) : o.format;
    if (!MIME[fmt]) fmt = 'jpg';
    const lossy = fmt !== 'png';
    const name = `${baseOf(file.name)}${o.suffix ? '-' + o.suffix : ''}.${fmt}`;

    let canvas = draw(img, w, h, fmt === 'jpg');
    let blob = await toBlob(canvas, MIME[fmt], lossy ? o.quality : undefined);

    // Target size: lower quality first (binary search), then shrink dimensions if still too big.
    const target = Number(o.targetKb) * 1024;
    if (o.useTarget && target > 0 && blob.size > target) {
      if (!lossy) { fmt = 'jpg'; }
      const type = MIME[fmt];
      let scale = 1;
      for (let round = 0; round < 8 && blob.size > target; round++) {
        if (round > 0) { scale *= 0.82; canvas = draw(img, w * scale, h * scale, fmt === 'jpg'); }
        let lo = 0.3, hi = 0.92, best = null;
        for (let k = 0; k < 7; k++) {
          const q = (lo + hi) / 2;
          const b = await toBlob(canvas, type, q);
          if (b.size <= target) { best = b; lo = q; } else { hi = q; }
        }
        blob = best || await toBlob(canvas, type, 0.3);
      }
      return { blob, name: `${baseOf(file.name)}${o.suffix ? '-' + o.suffix : ''}.${fmt}`, w: canvas.width, h: canvas.height };
    }
    return { blob, name, w: canvas.width, h: canvas.height };
  } finally { URL.revokeObjectURL(url); }
}

let uid = 1;
const ImageTools = ({ onBack }) => {
  const [items, setItems] = useState([]); // { id, file, preview, dims, out, error, status }
  const [opts, setOpts] = useState({ resize: 'max', maxPx: 1600, percent: 50, w: 1200, h: '', format: 'jpg', quality: 0.8, useTarget: false, targetKb: 200, suffix: 'small' });
  const [busy, setBusy] = useState(false);

  useEffect(() => () => items.forEach(i => URL.revokeObjectURL(i.preview)), []);

  const add = (files) => {
    const imgs = files.filter(f => /^image\//.test(f.type) || /\.(png|jpe?g|webp|bmp|gif|svg)$/i.test(f.name));
    setItems(list => [...list, ...imgs.map(file => ({ id: uid++, file, preview: URL.createObjectURL(file), out: null, error: '', status: 'ready' }))]);
    imgs.forEach((file) => loadImage(file).then(({ img, url }) => {
      URL.revokeObjectURL(url);
      setItems(list => list.map(i => (i.file === file ? { ...i, dims: `${img.naturalWidth}×${img.naturalHeight}` } : i)));
    }).catch(() => setItems(list => list.map(i => (i.file === file ? { ...i, error: 'Not a readable image', status: 'error' } : i)))));
  };

  // Changing options invalidates previous results
  useEffect(() => { setItems(list => list.map(i => (i.status === 'done' ? { ...i, out: null, status: 'ready' } : i))); }, [opts]);

  const processAll = async () => {
    setBusy(true);
    for (const it of items) {
      if (it.status === 'error' && it.error === 'Not a readable image') continue;
      setItems(list => list.map(i => (i.id === it.id ? { ...i, status: 'working', error: '' } : i)));
      try {
        // eslint-disable-next-line no-await-in-loop
        const out = await processImage(it.file, opts);
        setItems(list => list.map(i => (i.id === it.id ? { ...i, out, status: 'done' } : i)));
      } catch (e) {
        setItems(list => list.map(i => (i.id === it.id ? { ...i, status: 'error', error: e.message } : i)));
      }
    }
    setBusy(false);
  };

  const outs = items.filter(i => i.out).map(i => i.out);
  const downloadAll = async () => {
    if (outs.length === 1) return downloadBlob(outs[0].blob, outs[0].name);
    const { default: JSZip } = await import('jszip');
    const z = new JSZip(); const seen = {};
    outs.forEach(o => { let n = o.name; seen[n] = (seen[n] || 0) + 1; if (seen[n] > 1) n = `${baseOf(n)} (${seen[n]}).${extOf(n)}`; z.file(n, o.blob); });
    downloadBlob(await z.generateAsync({ type: 'blob' }), 'images.zip');
  };
  const totalBefore = items.filter(i => i.out).reduce((s, i) => s + i.file.size, 0);
  const totalAfter = outs.reduce((s, o) => s + o.blob.size, 0);
  const set = (k) => (e) => setOpts(o => ({ ...o, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <div style={{ paddingBottom: 32 }}>
      <ToolHeader icon={ImageDown} color="var(--chart-4)" title="Image Tools" subtitle="Resize, compress to a target size, or change format — many images at once." onBack={onBack} />

      <Panel title="Options" style={{ marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14, alignItems: 'end' }}>
          <Field label="Resize">
            <select style={inputStyle} value={opts.resize} onChange={set('resize')}>
              <option value="none">Keep original size</option><option value="max">Longest side (px)</option><option value="percent">Percentage</option><option value="exact">Exact width/height</option>
            </select>
          </Field>
          {opts.resize === 'max' && <Field label="Longest side" hint="e.g. 1600 for email, 1080 for WhatsApp"><input style={inputStyle} type="number" min={16} value={opts.maxPx} onChange={set('maxPx')} /></Field>}
          {opts.resize === 'percent' && <Field label={`Scale · ${opts.percent}%`}><input type="range" min={5} max={200} value={opts.percent} onChange={set('percent')} /></Field>}
          {opts.resize === 'exact' && <>
            <Field label="Width (px)"><input style={inputStyle} type="number" min={1} value={opts.w} onChange={set('w')} /></Field>
            <Field label="Height (px)" hint="Blank = keep proportions"><input style={inputStyle} type="number" min={1} value={opts.h} onChange={set('h')} placeholder="auto" /></Field>
          </>}
          <Field label="Format">
            <select style={inputStyle} value={opts.format} onChange={set('format')}>
              <option value="jpg">JPG (smallest for photos)</option><option value="webp">WEBP</option><option value="png">PNG (lossless)</option><option value="same">Same as original</option>
            </select>
          </Field>
          {opts.format !== 'png' && <Field label={`Quality · ${Math.round(opts.quality * 100)}%`}><input type="range" min={0.3} max={1} step={0.01} value={opts.quality} onChange={set('quality')} /></Field>}
          <Field label="Name suffix" hint={`photo.jpg → photo${opts.suffix ? '-' + opts.suffix : ''}.jpg`}><input style={inputStyle} value={opts.suffix} onChange={set('suffix')} /></Field>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: font.body, fontSize: '.84rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            <input type="checkbox" checked={opts.useTarget} onChange={set('useTarget')} /> Make each file smaller than
          </label>
          <input style={{ ...inputStyle, width: 100 }} type="number" min={10} value={opts.targetKb} onChange={set('targetKb')} disabled={!opts.useTarget} />
          <span style={{ fontFamily: font.body, fontSize: '.8rem', color: 'var(--text-muted)' }}>KB</span>
          <Segmented value={String(opts.targetKb)} onChange={v => setOpts(o => ({ ...o, useTarget: true, targetKb: v }))} options={[{ value: '100', label: '100 KB' }, { value: '200', label: '200 KB' }, { value: '500', label: '500 KB' }, { value: '1024', label: '1 MB' }]} />
        </div>
      </Panel>

      <DropZone accept="image/*" onFiles={add} compact={items.length > 0} title={items.length ? 'Add more images' : 'Drop images here, or click to choose'} hint="PNG, JPG, WEBP, BMP, GIF, SVG · nothing is uploaded" />

      {items.length > 0 && (
        <div style={{ ...card, marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <div style={{ fontFamily: font.head, fontWeight: 700, fontSize: '.85rem', color: 'var(--text-primary)' }}>
              {items.length} image{items.length > 1 ? 's' : ''}
              {outs.length > 0 && <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '.78rem' }}> · {fmtBytes(totalBefore)} → <b style={{ color: 'var(--success)' }}>{fmtBytes(totalAfter)}</b></span>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn variant="ghost" icon={Trash2} onClick={() => setItems([])}>Clear</Btn>
              {outs.length > 0 && <Btn variant="success" icon={Download} onClick={downloadAll}>Download all{outs.length > 1 ? ' (.zip)' : ''}</Btn>}
              <Btn icon={Minimize2} busy={busy} onClick={processAll}>{busy ? 'Processing…' : `Process ${items.length > 1 ? 'all' : ''}`}</Btn>
            </div>
          </div>
          {items.map(it => (
            <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--chart-grid)', flexWrap: 'wrap' }}>
              <img src={it.preview} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)' }} />
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div style={{ fontFamily: font.head, fontWeight: 700, fontSize: '.82rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.file.name}</div>
                <div style={{ fontFamily: font.body, fontSize: '.74rem', color: 'var(--text-muted)' }}>
                  {it.dims || '…'} · {fmtBytes(it.file.size)}
                  {it.out && <> → <b style={{ color: 'var(--success)' }}>{it.out.w}×{it.out.h} · {fmtBytes(it.out.blob.size)}</b> ({Math.round((1 - it.out.blob.size / it.file.size) * 100)}% smaller)</>}
                  {it.status === 'working' && <> · processing…</>}
                  {it.error && <span style={{ color: 'var(--danger)' }}> · {it.error}</span>}
                </div>
              </div>
              {it.out && <Btn variant="success" icon={Download} onClick={() => downloadBlob(it.out.blob, it.out.name)}>{extOf(it.out.name).toUpperCase()}</Btn>}
              <button type="button" title="Remove" onClick={() => setItems(l => l.filter(x => x.id !== it.id))} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
      {opts.useTarget && opts.format === 'png' && <div style={{ marginTop: 12 }}><Notice type="info">PNG can't be compressed to a target size — images that are too big will be saved as JPG instead.</Notice></div>}
    </div>
  );
};

export default ImageTools;
