/**
 * File converter engine for the "File Converter" tab.
 *
 * Most conversions run entirely in the browser (files never leave the PC):
 *   images  ⇄ png / jpg / webp / pdf
 *   pdf     → docx (editable Word) / png / jpg (one image per page) / txt, and merging PDFs
 *   sheets  ⇄ xlsx / xls / csv / ods / json / html
 *   docx    → html / txt
 *   text    → pdf / txt / docx
 * Office → PDF (Word, PowerPoint, Excel…) needs LibreOffice on the server and is
 * done by backend-userrights at /api/convert/office; those targets are only
 * offered when /api/convert/capabilities says LibreOffice is installed.
 *
 * Heavy libraries are imported lazily so they don't slow down the rest of the portal.
 */
import { URA_API } from '../context/AuthContext';

/* ── File kinds ───────────────────────────────────────────────────────────── */
const EXT_KIND = {
  png: 'image', jpg: 'image', jpeg: 'image', webp: 'image', bmp: 'image', gif: 'image', svg: 'image', ico: 'image', avif: 'image',
  pdf: 'pdf',
  xlsx: 'sheet', xls: 'sheet', xlsm: 'sheet', csv: 'sheet', ods: 'sheet', tsv: 'sheet',
  json: 'json',
  docx: 'docx',
  doc: 'office', odt: 'office', rtf: 'office', ppt: 'office', pptx: 'office', odp: 'office',
  txt: 'text', md: 'text', log: 'text', xml: 'text', html: 'text', htm: 'text',
};

export const extOf = (name) => (String(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
export const baseOf = (name) => String(name).replace(/\.[^.]+$/, '');
export const kindOf = (file) => EXT_KIND[extOf(file.name)] || 'unknown';

/* Conversion targets per kind. `office: true` = needs LibreOffice on the server. */
const TARGETS = {
  image: [{ ext: 'png' }, { ext: 'jpg' }, { ext: 'webp' }, { ext: 'pdf' }],
  pdf:   [{ ext: 'docx', note: 'editable Word document' }, { ext: 'png', note: 'one image per page' }, { ext: 'jpg', note: 'one image per page' }, { ext: 'txt', note: 'extract text' }],
  sheet: [{ ext: 'xlsx' }, { ext: 'csv' }, { ext: 'json' }, { ext: 'html' }, { ext: 'ods' }, { ext: 'pdf', office: true }],
  json:  [{ ext: 'xlsx' }, { ext: 'csv' }, { ext: 'html' }],
  docx:  [{ ext: 'pdf', office: true }, { ext: 'html' }, { ext: 'txt' }, { ext: 'odt', office: true }, { ext: 'doc', office: true }],
  office:[{ ext: 'pdf', office: true }, { ext: 'docx', office: true, only: ['doc', 'odt', 'rtf'] }, { ext: 'pptx', office: true, only: ['ppt', 'odp'] }],
  text:  [{ ext: 'pdf' }, { ext: 'txt' }, { ext: 'docx' }],
};

export const targetsFor = (file, officeAvailable) => {
  const ext = extOf(file.name);
  return (TARGETS[kindOf(file)] || [])
    .filter(t => !t.only || t.only.includes(ext))
    .filter(t => t.ext !== ext && !(t.ext === 'jpg' && ext === 'jpeg'))
    .map(t => ({ ...t, disabled: !!t.office && !officeAvailable }));
};

export const ACCEPT = Object.keys(EXT_KIND).map(e => '.' + e).join(',');

/* ── Server capability (LibreOffice) ─────────────────────────────────────── */
export async function getCapabilities() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(`${URA_API}/convert/capabilities`, { signal: ctrl.signal });
    clearTimeout(t);
    const j = await r.json();
    return { office: !!j.office, maxMb: j.maxMb || 25 };
  } catch (_) {
    return { office: false, maxMb: 25 };
  }
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const MIME = {
  png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf', txt: 'text/plain;charset=utf-8',
  csv: 'text/csv;charset=utf-8', json: 'application/json', html: 'text/html;charset=utf-8', zip: 'application/zip',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ods: 'application/vnd.oasis.opendocument.spreadsheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
const out = (name, blob) => ({ name, blob, size: blob.size });

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This image could not be read.')); };
    img.src = url;
  });
}

function canvasToBlob(canvas, ext, quality = 0.92) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error(`Your browser cannot create ${ext.toUpperCase()} files.`))), MIME[ext], quality));
}

async function imageToCanvas(file, { whiteBg = false } = {}) {
  const { img, url } = await loadImage(file);
  try {
    const w = img.naturalWidth || 1024, h = img.naturalHeight || 1024;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (whiteBg) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(img, 0, 0, w, h);
    return c;
  } finally { URL.revokeObjectURL(url); }
}

async function zipOutputs(files, zipName) {
  const { default: JSZip } = await import('jszip');
  const z = new JSZip();
  files.forEach(f => z.file(f.name, f.blob));
  return out(zipName, await z.generateAsync({ type: 'blob', mimeType: MIME.zip }));
}

let pdfjsPromise;
export function pdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf').then(lib => {
      // Served from /public (copied there by scripts/copy-assets.js before start/build)
      lib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL || ''}/pdf.worker.min.js`;
      return lib;
    });
  }
  return pdfjsPromise;
}

/* ── Image conversions ───────────────────────────────────────────────────── */
async function imageTo(file, ext) {
  const name = `${baseOf(file.name)}.${ext}`;
  if (ext === 'pdf') return [await imagesToPdf([file], name)];
  const canvas = await imageToCanvas(file, { whiteBg: ext === 'jpg' }); // JPG has no transparency
  return [out(name, await canvasToBlob(canvas, ext))];
}

/** One or more images → a single PDF, one image per page (page sized to the image). */
export async function imagesToPdf(files, name = 'images.pdf') {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  for (const f of files) {
    const e = extOf(f.name);
    let bytes, embed;
    if (e === 'jpg' || e === 'jpeg') { bytes = await f.arrayBuffer(); embed = 'jpg'; }
    else if (e === 'png') { bytes = await f.arrayBuffer(); embed = 'png'; }
    else { bytes = await (await canvasToBlob(await imageToCanvas(f), 'png')).arrayBuffer(); embed = 'png'; }
    const img = embed === 'jpg' ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
    // Keep pages a sensible size: cap the longest side at A4-ish 842pt.
    const scale = Math.min(1, 842 / Math.max(img.width, img.height));
    const w = img.width * scale, h = img.height * scale;
    doc.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h });
  }
  return out(name, new Blob([await doc.save()], { type: MIME.pdf }));
}

/* ── PDF conversions ─────────────────────────────────────────────────────── */
async function pdfTo(file, ext, onProgress) {
  if (ext === 'docx') {
    const { pdfToDocx } = await import('./pdfToDocx');
    const { blob } = await pdfToDocx(file, { onProgress });
    return [out(`${baseOf(file.name)}.docx`, blob)];
  }
  const lib = await pdfjs();
  const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const base = baseOf(file.name);

  if (ext === 'txt') {
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // Start a new line when the text moves to a new baseline or pdf.js marks an end-of-line.
      let line = '', lastY = null;
      const flush = () => { text += line.trimEnd() + '\n'; line = ''; };
      for (const item of content.items) {
        if (!item.str) { if (item.hasEOL && line) flush(); continue; } // empty end-of-line markers
        const y = item.transform ? item.transform[5] : null;
        if (line && lastY !== null && y !== null && Math.abs(y - lastY) > 2) flush();
        line += item.str;
        if (item.hasEOL) flush();
        if (y !== null) lastY = y;
      }
      if (line) flush();
      text += `\n--- page ${i} ---\n\n`;
      onProgress && onProgress(i / pdf.numPages);
    }
    if (!text.replace(/--- page \d+ ---/g, '').trim()) throw new Error('No text found — this PDF is probably scanned images.');
    return [out(`${base}.txt`, new Blob([text], { type: MIME.txt }))];
  }

  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 }); // ~144 dpi
    const c = document.createElement('canvas');
    c.width = Math.ceil(viewport.width); c.height = Math.ceil(viewport.height);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push(out(pdf.numPages > 1 ? `${base}-page-${String(i).padStart(2, '0')}.${ext}` : `${base}.${ext}`, await canvasToBlob(c, ext)));
    onProgress && onProgress(i / pdf.numPages);
  }
  return pages.length > 1 ? [await zipOutputs(pages, `${base}-${ext}-pages.zip`)] : pages;
}

/** Merge several PDFs (in the given order) into one. */
export async function mergePdfs(files, name = 'merged.pdf') {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  for (const f of files) {
    let src;
    try { src = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true }); }
    catch (_) { throw new Error(`${f.name} could not be read (password-protected or damaged).`); }
    (await doc.copyPages(src, src.getPageIndices())).forEach(p => doc.addPage(p));
  }
  return out(name, new Blob([await doc.save()], { type: MIME.pdf }));
}

/* ── Spreadsheet / JSON conversions ──────────────────────────────────────── */
async function sheetTo(file, ext) {
  const XLSX = await import('xlsx');
  const base = baseOf(file.name);
  let wb;
  if (kindOf(file) === 'json') {
    let data;
    try { data = JSON.parse(await file.text()); } catch (_) { throw new Error('This is not valid JSON.'); }
    const rows = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : (Array.isArray(data?.records) ? data.records : [data]));
    wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.map(r => (r && typeof r === 'object' ? r : { value: r }))), 'Data');
  } else {
    wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  }

  if (ext === 'xlsx' || ext === 'ods') {
    const buf = XLSX.write(wb, { bookType: ext, type: 'array' });
    return [out(`${base}.${ext}`, new Blob([buf], { type: MIME[ext] }))];
  }

  // csv / json / html are one-sheet formats: one file per sheet, zipped if several.
  const perSheet = wb.SheetNames.map(sn => {
    const ws = wb.Sheets[sn];
    let content;
    if (ext === 'csv') content = '﻿' + XLSX.utils.sheet_to_csv(ws); // BOM so Excel opens UTF-8 correctly
    else if (ext === 'json') content = JSON.stringify(XLSX.utils.sheet_to_json(ws, { defval: '' }), null, 2);
    else content = `<!doctype html><meta charset="utf-8"><title>${sn}</title><style>body{font-family:Segoe UI,Arial,sans-serif}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}</style>${XLSX.utils.sheet_to_html(ws, { header: '', footer: '' })}`;
    const name = wb.SheetNames.length > 1 ? `${base}-${sn.replace(/[\\/:*?"<>|]/g, '_')}.${ext}` : `${base}.${ext}`;
    return out(name, new Blob([content], { type: MIME[ext] }));
  });
  return perSheet.length > 1 ? [await zipOutputs(perSheet, `${base}-${ext}.zip`)] : perSheet;
}

/* ── Word (.docx) in the browser ─────────────────────────────────────────── */
async function docxTo(file, ext) {
  const mammoth = (await import('mammoth/mammoth.browser')).default || (await import('mammoth/mammoth.browser'));
  const arrayBuffer = await file.arrayBuffer();
  const base = baseOf(file.name);
  if (ext === 'txt') {
    const r = await mammoth.extractRawText({ arrayBuffer });
    return [out(`${base}.txt`, new Blob([r.value], { type: MIME.txt }))];
  }
  const r = await mammoth.convertToHtml({ arrayBuffer });
  const html = `<!doctype html><meta charset="utf-8"><title>${base}</title><style>body{font-family:Segoe UI,Arial,sans-serif;max-width:820px;margin:40px auto;line-height:1.5}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}img{max-width:100%}</style>${r.value}`;
  return [out(`${base}.html`, new Blob([html], { type: MIME.html }))];
}

/* ── Plain text → PDF / TXT ──────────────────────────────────────────────── */
async function textTo(file, ext) {
  const base = baseOf(file.name);
  let text = await file.text();
  if (/^html?$/.test(extOf(file.name))) {
    const d = new DOMParser().parseFromString(text, 'text/html');
    text = d.body ? d.body.innerText || d.body.textContent : text;
  }
  if (ext === 'txt') return [out(`${base}.txt`, new Blob([text], { type: MIME.txt }))];
  if (ext === 'docx') {
    const { textToDocx } = await import('./pdfToDocx');
    return [out(`${base}.docx`, await textToDocx(text, base))];
  }

  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const size = 10.5, lineH = 14, margin = 50, pageW = 595, pageH = 842, maxW = pageW - margin * 2;
  // Standard PDF fonts only cover Western characters; anything else becomes "?".
  const safe = s => s.replace(/\t/g, '    ').replace(/[^\x20-\x7E -ÿ–—‘’“”•…€]/g, '?');
  const lines = [];
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const words = safe(raw).split(/(\s+)/);
    let cur = '';
    for (const w of words) {
      const next = cur + w;
      if (font.widthOfTextAtSize(next, size) <= maxW) { cur = next; continue; }
      if (cur.trim()) lines.push(cur.trimEnd());
      // Break very long words (URLs etc.)
      let rest = w.trimStart();
      while (font.widthOfTextAtSize(rest, size) > maxW) {
        let n = rest.length; while (n > 1 && font.widthOfTextAtSize(rest.slice(0, n), size) > maxW) n--;
        lines.push(rest.slice(0, n)); rest = rest.slice(n);
      }
      cur = rest;
    }
    lines.push(cur.trimEnd());
  }
  let page, y = 0;
  lines.forEach(l => {
    if (!page || y < margin) { page = doc.addPage([pageW, pageH]); y = pageH - margin; }
    if (l) page.drawText(l, { x: margin, y, size, font, color: rgb(0.1, 0.1, 0.12) });
    y -= lineH;
  });
  if (!page) doc.addPage([pageW, pageH]);
  return [out(`${base}.pdf`, new Blob([await doc.save()], { type: MIME.pdf }))];
}

/* ── Office → PDF/DOCX on the server (LibreOffice) ───────────────────────── */
async function officeTo(file, ext, user) {
  const dataBase64 = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',').pop());
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.readAsDataURL(file);
  });
  const res = await fetch(`${URA_API}/convert/office`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-role': user?.role || '', 'x-user-id': user?.empId || '' },
    body: JSON.stringify({ fileName: file.name, dataBase64, target: ext }),
  });
  if (!res.ok) {
    let msg = `Server conversion failed (${res.status}).`;
    try { msg = (await res.json()).error || msg; } catch (_) {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  return [out(`${baseOf(file.name)}.${ext}`, blob)];
}

/* ── Entry point ─────────────────────────────────────────────────────────── */
export async function convertFile(file, ext, { user, onProgress } = {}) {
  const kind = kindOf(file);
  const target = (TARGETS[kind] || []).find(t => t.ext === ext);
  if (!target) throw new Error(`Can't convert .${extOf(file.name)} to .${ext}.`);
  if (target.office) return officeTo(file, ext, user);
  switch (kind) {
    case 'image': return imageTo(file, ext);
    case 'pdf':   return pdfTo(file, ext, onProgress);
    case 'sheet':
    case 'json':  return sheetTo(file, ext);
    case 'docx':  return docxTo(file, ext);
    case 'text':  return textTo(file, ext);
    default: throw new Error('Unsupported file type.');
  }
}

export function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export const fmtSize = (n) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
