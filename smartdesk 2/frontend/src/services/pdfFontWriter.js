/**
 * Write text into a PDF using a font that is ALREADY inside that PDF, so edited
 * text looks exactly like the original (same typeface, weight, ₹ sign, spacing).
 *
 * We find the original font dictionary (by its BaseFont name), invert its
 * ToUnicode map (unicode → character code) and draw the text with a TJ operator
 * that references that font. Embedded fonts are usually subsets, so only
 * characters that already appear in the document can be written this way —
 * `encode` reports any that are missing so the caller can fall back.
 */
import {
  PDFName, PDFDict, PDFRef, PDFArray, PDFNumber, PDFHexString, PDFRawStream,
  PDFOperator, PDFOperatorNames as Ops, decodePDFRawStream,
  pushGraphicsState, popGraphicsState, beginText, endText, setFontAndSize, setFillingRgbColor,
  rotateAndSkewTextDegreesAndTranslate, setCharacterSpacing, setWordSpacing,
} from 'pdf-lib';

const stripSubset = (n) => String(n || '').replace(/^\//, '').replace(/^[A-Z]{6}\+/, '');
const nameOf = (v) => (v instanceof PDFName ? v.decodeText() : '');

/* ── ToUnicode CMap → Map(unicode string → code) ─────────────────────────── */
const utf16 = (hex) => {
  const units = [];
  for (let i = 0; i + 3 < hex.length + 1; i += 4) units.push(parseInt(hex.slice(i, i + 4).padEnd(4, '0'), 16));
  return String.fromCharCode(...units);
};
function parseToUnicode(text) {
  const map = new Map();
  const add = (code, uni) => { if (uni && !map.has(uni)) map.set(uni, code); };
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) add(parseInt(m[1], 16), utf16(m[2]));
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]*)>|\[([^\]]*)\])/g)) {
      const lo = parseInt(m[1], 16), hi = parseInt(m[2], 16);
      if (hi - lo > 0xffff) continue;
      if (m[3] != null) {
        const base = m[3];
        const head = base.slice(0, -4), last = parseInt(base.slice(-4) || '0', 16);
        for (let c = lo; c <= hi; c++) add(c, utf16(head + (last + (c - lo)).toString(16).padStart(4, '0')));
      } else {
        const list = [...m[4].matchAll(/<([0-9a-fA-F]*)>/g)].map(x => x[1]);
        list.forEach((h, i) => add(lo + i, utf16(h)));
      }
    }
  }
  return map;
}

// WinAnsi (cp1252) codes for the non-ASCII characters it supports
const WIN_ANSI_EXTRA = { '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f };

function streamText(doc, ref) {
  const s = doc.context.lookup(ref);
  if (!(s instanceof PDFRawStream)) return '';
  const bytes = decodePDFRawStream(s).decode();
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

/** Build an encoder for one font dictionary. */
function buildEncoder(doc, dict) {
  const subtype = nameOf(dict.get(PDFName.of('Subtype')));
  if (subtype === 'Type3') return null;
  const tu = dict.get(PDFName.of('ToUnicode'));
  const map = tu ? parseToUnicode(streamText(doc, tu)) : new Map();

  if (subtype === 'Type0') {
    const enc = nameOf(dict.get(PDFName.of('Encoding')));
    if (!/^Identity-[HV]$/.test(enc) || !map.size) return null; // other CMaps: not supported → fallback
    return { twoByte: true, map };
  }
  // Simple font: 1-byte codes. Only codes that have a glyph width (present in the subset).
  const first = (dict.lookup(PDFName.of('FirstChar'), PDFNumber) || PDFNumber.of(0)).asNumber();
  const widths = dict.lookup(PDFName.of('Widths'), PDFArray);
  const hasWidth = (code) => {
    if (!widths) return true;
    const i = code - first;
    if (i < 0 || i >= widths.size()) return false;
    const w = doc.context.lookup(widths.get(i));
    return w instanceof PDFNumber ? w.asNumber() > 0 : true;
  };
  if (!map.size) {
    const enc = dict.get(PDFName.of('Encoding'));
    const encName = nameOf(enc);
    if (enc && !(enc instanceof PDFName) && !(enc instanceof PDFRef)) return null; // custom /Differences without ToUnicode
    if (encName && !/WinAnsi|Standard/.test(encName)) return null;
    for (let c = 32; c < 127; c++) map.set(String.fromCharCode(c), c);
    Object.entries(WIN_ANSI_EXTRA).forEach(([ch, c]) => map.set(ch, c));
  }
  for (const [ch, code] of [...map]) if (!hasWidth(code)) map.delete(ch);
  return { twoByte: false, map };
}

/**
 * Locate the original font. Several font objects can share one BaseFont name (each a
 * different subset), so all candidates are collected and the one that can encode the
 * wanted text (and ideally the original text, which pins the exact subset) is used.
 */
export function makeFontWriter(doc) {
  const cands = new Map();
  const added = new Map();
  const collect = (page, want) => {
    const ck = `${page.ref.toString()}|${want}`;
    if (cands.has(ck)) return cands.get(ck);
    const list = [];
    const seen = new Set();
    const push = (key, ref, dict) => {
      const id = ref ? ref.toString() : `inline:${key ? key.toString() : list.length}`;
      if (seen.has(id)) return;
      seen.add(id);
      let encoder = null;
      try { encoder = buildEncoder(doc, dict); } catch (_) {}
      if (encoder) list.push({ key, ref, dict, encoder });
    };
    for (const exact of [true, false]) {
      const matches = (d) => {
        const bf = nameOf(d.get(PDFName.of('BaseFont')));
        return exact ? bf === want : stripSubset(bf) === stripSubset(want);
      };
      const res = page.node.Resources();
      const fonts = res && res.lookupMaybe(PDFName.of('Font'), PDFDict);
      if (fonts) for (const [key, val] of fonts.entries()) {
        const d = val instanceof PDFRef ? doc.context.lookup(val) : val;
        if (d instanceof PDFDict && matches(d)) push(key, val instanceof PDFRef ? val : null, d);
      }
      for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
        if (obj instanceof PDFDict && nameOf(obj.get(PDFName.of('Type'))) === 'Font' && matches(obj)) push(null, ref, obj);
      }
      if (list.length) break;
    }
    cands.set(ck, list);
    return list;
  };
  const keyFor = (page, cand) => {
    if (cand.key) return cand.key;
    const ak = `${page.ref.toString()}|${cand.ref.toString()}`;
    if (!added.has(ak)) added.set(ak, page.node.newFontDictionary('SDEdit', cand.ref));
    return added.get(ak);
  };
  return {
    /**
     * Plan how to write `text` with the original typeface. Each character comes from the
     * first copy (subset) of the font that has it — copies that can draw the original text
     * are preferred. Returns { runs: [{ cand, parts }] } or { missing: [chars] }.
     */
    plan(page, baseName, text, originalText = '') {
      const want = String(baseName || '').replace(/^\//, '');
      const list = want ? collect(page, want) : [];
      if (!list.length) return { missing: ['font'] };
      const coversOrig = (c) => !originalText || !encodeText(c.encoder, originalText).missing;
      const ordered = [...list.filter(coversOrig), ...list.filter(c => !coversOrig(c))];
      const missing = new Set();
      const runs = [];
      for (const ch of Array.from(text)) {
        const isSpace = ch === ' ' || ch === '\u00a0';
        let cand = ordered.find(c => c.encoder.map.has(ch));
        if (!cand && isSpace) cand = runs.length ? runs[runs.length - 1].cand : ordered[0];
        if (!cand) { missing.add(ch); continue; }
        const last = runs[runs.length - 1];
        if (last && last.cand === cand) last.text += ch; else runs.push({ cand, text: ch });
      }
      if (missing.size) return { missing: [...missing] };
      return { runs: runs.map(r => ({ cand: r.cand, parts: encodeText(r.cand.encoder, r.text).parts })) };
    },
    keyFor,
  };
}

/** Text → TJ array items, or { missing } listing characters the font can't draw. */
export function encodeText(encoder, text, spaceAdvance = 280) {
  const parts = [];
  const missing = new Set();
  let hex = '';
  const flush = () => { if (hex) { parts.push(PDFHexString.of(hex)); hex = ''; } };
  for (const ch of Array.from(text)) {
    const code = encoder.map.get(ch);
    if (code != null) hex += code.toString(16).padStart(encoder.twoByte ? 4 : 2, '0');
    else if (ch === ' ' || ch === ' ') { flush(); parts.push(PDFNumber.of(-spaceAdvance)); }
    else missing.add(ch);
  }
  flush();
  return missing.size ? { missing: [...missing] } : { parts };
}

/** Draw one line with the original typeface. Returns { ok } or { ok:false, missing }. */
export function drawWithOriginalFont(doc, page, writer, baseName, { text, originalText, x, y, size, rgb: [r, g, b], rotateDeg = 0 }) {
  const plan = writer.plan(page, baseName, text, originalText);
  if (plan.missing) return { ok: false, missing: plan.missing };
  const ops = [
    pushGraphicsState(),
    beginText(),
    setFillingRgbColor(r, g, b),
    setCharacterSpacing(0),
    setWordSpacing(0),
    PDFOperator.of(Ops.SetTextHorizontalScaling, [PDFNumber.of(100)]),
    rotateAndSkewTextDegreesAndTranslate(rotateDeg, 0, 0, x, y),
  ];
  for (const run of plan.runs) {
    ops.push(setFontAndSize(writer.keyFor(page, run.cand), size));
    ops.push(PDFOperator.of(Ops.ShowTextAdjusted, [doc.context.obj(run.parts)]));
  }
  ops.push(endText(), popGraphicsState());
  page.pushOperators(...ops);
  return { ok: true };
}
