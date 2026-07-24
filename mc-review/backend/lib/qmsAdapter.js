/**
 * QMS adapter — read-only, one-way QMS -> Dashboard (Workflow v2.5 §1.1).
 *
 * Wired to the real live PR/NFA feed:
 *   https://smartworlddevelopersonline.com/SapPrNFATatReport.php
 *     ?startdate=YYYY-MM-DD&enddate=YYYY-MM-DD
 *
 * Per instruction: startdate is fixed at 2025-01-01 and enddate is always
 * "today" (the server's own clock — never a client-supplied value, per
 * I10/F9), so every fetch pulls the full available history through now.
 *
 * The feed returns one JSON object per PR/NFA row with SAP-style field
 * names (NFA_No, NFA_Title, Vendor_Name, NFA_Budget, ...). This module
 * normalizes that shape into the field names the rest of the app expects
 * (project, desc, vendor, val, reason, ...) — see mapRecord() below. No
 * attached-file data is provided by this endpoint; `files` stays empty
 * until the QMS file-store/OData integration (a separate, still-pending
 * piece per the readiness doc's I1/I2/I3) is wired in.
 *
 * A short in-memory cache avoids re-fetching the (potentially large) feed
 * on every keystroke/request; call invalidateCache() if a manual refresh
 * is ever needed.
 */

const BASE_URL = 'https://smartworlddevelopersonline.com/SapPrNFATatReport.php';
const FIXED_START_DATE = '2025-01-01';
const CACHE_TTL_MS = 60 * 1000; // 60s — balances freshness against hammering the feed

let cache = { at: 0, byNfa: new Map() };

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Normalizes an NFA number for lookup: strips leading zeros so "0000014315"
// and "14315" match the same record (QMS pads to 10 digits; the dashboard
// and people type the short form).
function normalizeNfa(nfa) {
  return String(nfa || '').replace(/^0+/, '') || '0';
}

// "0000014315" -> "14315" for display; falls back to the raw value if it
// doesn't look like a zero-padded numeric NFA.
function displayNfa(rawNfaNo) {
  const n = normalizeNfa(rawNfaNo);
  return /^\d+$/.test(n) ? n : rawNfaNo;
}

// "0.80 Lacs" / "23.00 Lacs" -> "0.80" / "23.00"; leaves non-numeric as-is.
function lacsToNumberString(s) {
  if (!s) return '—';
  const m = String(s).match(/-?[\d,]+\.?\d*/);
  return m ? m[0].replace(/,/g, '') : String(s).trim();
}

// DD/MM/YYYY -> YYYY-MM-DD (the feed's date fields use this format).
function dmyToIso(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// Collapses Vendor_One..Vendor_Five into a single "1. X · 2. Y" string,
// matching how the dashboard already displays multi-vendor NFAs.
function combineVendors(rec) {
  const names = [rec.Vendor_One, rec.Vendor_Two, rec.Vendor_Three, rec.Vendor_Four, rec.Vendor_Five]
    .map((v) => (v || '').trim())
    .filter((v) => v && v !== '0');
  if (names.length === 0) return rec.Vendor_Name || '—';
  if (names.length === 1) return names[0];
  return names.map((n, i) => `${i + 1}. ${n}`).join(' · ');
}

function mapRecord(rec) {
  return {
    project: rec.Project_Name || rec.NFA_Location || '—',
    location: rec.NFA_Location || rec.PR_Location || '—',
    desc: rec.NFA_Title || rec.Scope || '—',
    duration: rec.Contract_Duration || '—',
    vendor: combineVendors(rec),
    val: lacsToNumberString(rec.NFA_Budget),
    lastAmd: 'NA', // not separately exposed by this feed; revisedVal() falls back to val
    variation: 'NA',
    reason: rec.Subject_Of_NFA || rec.Scope || '—',
    reasonability: rec.Rate_Recommendations || '—',
    rateVal: rec.Vendor_Recommendations || '',
    vendPQ: String([rec.Vendor_One, rec.Vendor_Two, rec.Vendor_Three, rec.Vendor_Four, rec.Vendor_Five]
      .filter((v) => v && v.trim() && v.trim() !== '0').length || 1),
    pr: rec.EPR_No || '—',
    initDt: dmyToIso(rec.PRN_Date) || (rec.PR_Created_Date || '').slice(0, 10) || null,
    pendWith: rec.NFA_Pending_With || rec.PR_Pending_With || '—',
    initiator: rec.recomender_name || rec.cp_name || '—',
    prBudget: lacsToNumberString(rec.NFA_Budget),
    initBy: rec.PRH_Package || 'Site',
    files: [], // real QMS file-store integration pending (I1/I2/I3)
  };
}

async function loadCache() {
  const now = Date.now();
  if (now - cache.at < CACHE_TTL_MS && cache.byNfa.size > 0) return cache.byNfa;

  const url = `${BASE_URL}?startdate=${FIXED_START_DATE}&enddate=${todayISO()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`QMS feed returned HTTP ${res.status}`);
  const data = await res.json();
  const rows = Array.isArray(data.results) ? data.results : [];

  const byNfa = new Map();
  rows.forEach((rec) => {
    const key = normalizeNfa(rec.NFA_No);
    // Later rows (feed order) win on duplicate NFA numbers — the feed can
    // return the same NFA multiple times across amendment versions.
    byNfa.set(key, rec);
  });

  cache = { at: now, byNfa };
  return byNfa;
}

/**
 * Look up an NFA in QMS. Returns null if not found (Mode A validation #1 —
 * "NFA not in QMS -> error + offer Mode B").
 */
async function lookupNfa(nfaNo) {
  const byNfa = await loadCache();
  const rec = byNfa.get(normalizeNfa(nfaNo));
  if (!rec) return null;
  return mapRecord(rec);
}

/**
 * List every NFA currently in the feed's result window, mapped to the same
 * shape as lookupNfa() plus the display-friendly NFA number. Backs the
 * Page-1 "All NFAs" browse tab.
 */
async function listAll() {
  const byNfa = await loadCache();
  const out = [];
  byNfa.forEach((rec, key) => {
    out.push({ nfa: displayNfa(rec.NFA_No), ...mapRecord(rec) });
  });
  // Most-recently-initiated first, matching the feed's own ordering intent.
  out.sort((a, b) => (b.initDt || '').localeCompare(a.initDt || ''));
  return out;
}

function invalidateCache() {
  cache = { at: 0, byNfa: new Map() };
}

module.exports = { lookupNfa, listAll, invalidateCache, mapRecord, normalizeNfa, displayNfa };
