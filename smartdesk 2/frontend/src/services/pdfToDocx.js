/**
 * PDF → Word (.docx), entirely in the browser.
 *
 * Rebuilds an editable document from the PDF's text layer:
 *   - lines are grouped into paragraphs (by spacing, indent and font size)
 *   - headings (larger text), bold / italic and centred lines are kept
 *   - wide gaps inside a line become tabs, so simple tables stay readable
 *   - each PDF page starts on a new Word page
 *   - pages with (almost) no text — scans, photos — are inserted as a picture
 * Complex layouts (multi-column, text over images) come out as plain flowing text.
 */
import { pdfjs } from './converter';

const PT_TO_TWIP = 20;
const PX_PER_PT = 96 / 72;

const isBold = (name = '') => /bold|black|heavy|semibold|demi/i.test(name);
const isItalic = (name = '') => /italic|oblique/i.test(name);

/** Font names (for bold/italic detection) — only available once the page's operators are loaded. */
async function fontInfo(page, items) {
  const info = {};
  try { await page.getOperatorList(); } catch (_) { return info; }
  for (const it of items) {
    if (!it.fontName || info[it.fontName]) continue;
    try {
      const f = page.commonObjs.get(it.fontName);
      const n = (f && (f.name || f.loadedName)) || '';
      info[it.fontName] = { bold: !!(f && f.bold) || isBold(n), italic: !!(f && f.italic) || isItalic(n), name: n };
    } catch (_) { info[it.fontName] = { bold: false, italic: false, name: '' }; }
  }
  return info;
}

/** Group text items into visual lines (top → bottom, left → right). */
function buildLines(items, fonts, pageH, offX = 0) {
  const glyphs = items
    .filter(it => it.str && it.str.length && it.transform)
    .map(it => {
      const [a, b, c, d, e, f] = it.transform;
      const size = Math.max(1, Math.hypot(c, d) || it.height || 10);
      const fi = fonts[it.fontName] || {};
      return { str: it.str, x: e - offX, y: pageH - f, w: it.width || 0, size, bold: !!fi.bold, italic: !!fi.italic, rotated: Math.abs(b) > 0.01 };
    })
    .filter(g => !g.rotated);
  glyphs.sort((p, q) => (Math.abs(p.y - q.y) < Math.min(p.size, q.size) * 0.45 ? p.x - q.x : p.y - q.y));

  const lines = [];
  for (const g of glyphs) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - g.y) < Math.min(last.size, g.size) * 0.45) last.items.push(g);
    else lines.push({ y: g.y, size: g.size, items: [g] });
  }
  for (const l of lines) {
    l.items.sort((p, q) => p.x - q.x);
    l.size = Math.max(...l.items.map(i => i.size));
    l.x0 = l.items[0].x;
    l.x1 = Math.max(...l.items.map(i => i.x + i.w));
    // Runs with spaces / tabs between items
    const runs = [];
    let prev = null;
    for (const it of l.items) {
      let gapText = '';
      if (prev) {
        const gap = it.x - (prev.x + prev.w);
        if (gap > it.size * 0.9) gapText = '\t';
        else if (gap > it.size * 0.18 && !/\s$/.test(prev.str) && !/^\s/.test(it.str)) gapText = ' ';
      }
      const fmt = { bold: it.bold, italic: it.italic, size: Math.round(it.size * 2) / 2 };
      const tail = runs[runs.length - 1];
      if (tail && tail.bold === fmt.bold && tail.italic === fmt.italic && tail.size === fmt.size) tail.text += gapText + it.str;
      else {
        if (gapText && tail) tail.text += gapText;
        runs.push({ ...fmt, text: it.str });
      }
      prev = it;
    }
    l.runs = runs;
    l.text = runs.map(r => r.text).join('');
    l.bold = runs.every(r => r.bold || !r.text.trim());
  }
  return lines.filter(l => l.text.trim());
}

/** Merge lines into paragraphs. */
function buildParagraphs(lines, pageW, bodySize) {
  const paras = [];
  let cur = null;
  lines.forEach((l, i) => {
    const prev = lines[i - 1];
    const center = (l.x0 + l.x1) / 2;
    const centred = !l.text.includes('\t') && Math.abs(center - pageW / 2) < pageW * 0.06 && (l.x1 - l.x0) < pageW * 0.7 && l.x0 > pageW * 0.15;
    const heading = l.size >= bodySize * 1.25 || (l.bold && l.text.length < 90 && l.size >= bodySize * 0.98 && !(prev && prev.bold && cur && cur.lines.length > 1));
    let join = false;
    if (cur && prev) {
      const gap = l.y - prev.y;
      const lh = Math.max(prev.size, l.size);
      const sameSize = Math.abs(l.size - prev.size) < 0.6;
      const indentJump = l.x0 - cur.x0 > l.size * 1.5;      // first-line indent of a new paragraph
      const prevShort = prev.x1 < cur.maxX1 - prev.size * 4; // previous line ended early → paragraph ended
      const bullet = /^\s*([•●▪◦\-–*]|\d{1,2}[.)]|[a-z][.)])\s/i.test(l.text);
      join = gap < lh * 1.75 && sameSize && !indentJump && !prevShort && !bullet && !heading && !cur.heading && !cur.centred && !l.text.includes('\t') && !prev.text.includes('\t');
    }
    if (join) {
      // Join with a space; drop a trailing hyphen from a word split across lines
      const lastRun = cur.runs[cur.runs.length - 1];
      if (/[A-Za-z]-$/.test(lastRun.text)) lastRun.text = lastRun.text.slice(0, -1);
      else lastRun.text += ' ';
      l.runs.forEach(r => {
        const t = cur.runs[cur.runs.length - 1];
        if (t.bold === r.bold && t.italic === r.italic && t.size === r.size) t.text += r.text; else cur.runs.push({ ...r });
      });
      cur.lines.push(l);
      cur.maxX1 = Math.max(cur.maxX1, l.x1);
    } else {
      const spaceBefore = prev ? Math.max(0, l.y - prev.y - Math.max(prev.size, l.size) * 1.2) : 0;
      cur = { runs: l.runs.map(r => ({ ...r })), lines: [l], x0: l.x0, maxX1: l.x1, heading, centred, size: l.size, spaceBefore };
      paras.push(cur);
    }
  });
  return paras;
}

/** Most common font size, weighted by characters = body text size. */
function bodySizeOf(lines) {
  const counts = {};
  lines.forEach(l => l.runs.forEach(r => { counts[r.size] = (counts[r.size] || 0) + r.text.length; }));
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best ? Number(best[0]) : 11;
}

async function renderPagePng(page, maxWidthPx) {
  const v1 = page.getViewport({ scale: 1 });
  const scale = Math.min(2, (maxWidthPx * 2) / v1.width);
  const viewport = page.getViewport({ scale });
  const c = document.createElement('canvas');
  c.width = Math.ceil(viewport.width); c.height = Math.ceil(viewport.height);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  return { data: new Uint8Array(await blob.arrayBuffer()), w: c.width, h: c.height };
}

export async function pdfToDocx(file, { onProgress } = {}) {
  const D = await import('docx');
  const { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType, HeadingLevel, PageBreak } = D;
  const lib = await pdfjs();
  const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;

  const first = (await pdf.getPage(1)).getViewport({ scale: 1 });
  const pageWpt = first.width, pageHpt = first.height;
  const marginPt = 54; // 0.75"
  const contentWpx = (pageWpt - marginPt * 2) * PX_PER_PT;
  const contentHpx = (pageHpt - marginPt * 2) * PX_PER_PT;

  const children = [];
  let textChars = 0;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const fonts = await fontInfo(page, content.items);
    // Use the un-rotated page height for y-flipping (text coords are in page space)
    const [offX, , , pageTop] = page.view;
    const lines = buildLines(content.items, fonts, pageTop, offX);
    const chars = lines.reduce((n, l) => n + l.text.replace(/\s/g, '').length, 0);
    textChars += chars;

    if (i > 1) children.push(new Paragraph({ children: [new PageBreak()] }));

    if (chars < 25) {
      // Scanned / picture page → keep it as an image so nothing is lost
      const img = await renderPagePng(page, contentWpx);
      const k = Math.min(contentWpx / img.w, contentHpx / img.h);
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data: img.data, transformation: { width: Math.round(img.w * k), height: Math.round(img.h * k) } })] }));
    } else {
      const body = bodySizeOf(lines);
      const paras = buildParagraphs(lines, vp.width, body);
      paras.forEach(p => {
        const big = p.size >= body * 1.6 ? HeadingLevel.HEADING_1 : p.size >= body * 1.25 ? HeadingLevel.HEADING_2 : undefined;
        children.push(new Paragraph({
          heading: big,
          alignment: p.centred ? AlignmentType.CENTER : undefined,
          spacing: { before: Math.min(480, Math.round(p.spaceBefore * PT_TO_TWIP)), after: 80 },
          indent: !p.centred && p.x0 - (marginPt * 0.8) > body * 2 && p.x0 < vp.width / 2 ? { left: Math.round(Math.min(p.x0 - marginPt, 200) * PT_TO_TWIP) } : undefined,
          children: p.runs.flatMap(r => r.text.split('\t').flatMap((part, j) => [
            ...(j > 0 ? [new TextRun({ text: '', tab: true })] : []),
            new TextRun({ text: part, bold: r.bold || undefined, italics: r.italic || undefined, size: Math.round(Math.max(6, Math.min(r.size, 72)) * 2), color: big ? '1F3864' : undefined }),
          ])),
        }));
      });
    }
    onProgress && onProgress(i / pdf.numPages);
  }

  if (!textChars && pdf.numPages) {
    // Nothing but pictures: still useful, but tell the user why it's not editable
    console.warn('pdfToDocx: no text layer found; pages inserted as images');
  }

  const doc = new Document({
    creator: 'SmartDesk',
    title: file.name.replace(/\.pdf$/i, ''),
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{
      properties: { page: { size: { width: Math.round(pageWpt * PT_TO_TWIP), height: Math.round(pageHpt * PT_TO_TWIP) }, margin: { top: marginPt * PT_TO_TWIP, bottom: marginPt * PT_TO_TWIP, left: marginPt * PT_TO_TWIP, right: marginPt * PT_TO_TWIP } } },
      children,
    }],
  });
  const blob = await Packer.toBlob(doc);
  return { blob, scannedOnly: textChars === 0 };
}

/** Plain text → .docx (one paragraph per line). */
export async function textToDocx(text, title = 'document') {
  const { Document, Packer, Paragraph, TextRun } = await import('docx');
  const doc = new Document({
    creator: 'SmartDesk', title,
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ children: text.replace(/\r\n?/g, '\n').split('\n').map(l => new Paragraph({ children: [new TextRun(l)] })) }],
  });
  return Packer.toBlob(doc);
}
