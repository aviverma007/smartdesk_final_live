/**
 * Reference data shared across routes — mirrors the prototype's constants
 * (Workflow Definition v2.5 §11).
 */
const WORK_TYPES = {
  A: 'New Work',
  B: 'Deviation in Payment Terms',
  C: 'Qty Variation with Extra Items',
  D: 'Qty Variation Only (At Existing Rates)',
  E: 'Qty Variation with Change in Rates',
  F: 'Addendum',
  G: 'Amendment in Rates & Specs',
  H: 'Emergent Approval',
  I: 'Extra Items',
  J: 'Base Rate Approval',
};

const INDEX_NAMES = { MEP: 'MEP & Procurement', CIVIL: 'Civil & Consultancy' };

const ORDER_TYPES = ['PO', 'SO', 'WO', 'LOA'];

const RATE_VALIDATIONS = [
  'Competitive bidding',
  'Existing rate reference',
  'Rate analysis',
  'Existing Rate & Rate analysis',
];

const INITIATED_BY_OPTIONS = ['C&P Team', 'Site'];

// Server-date helpers — production MUST source "today" from this server's
// clock (I10, F9), never a client-supplied value.
function todayISO() {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
}
function isoToDMY(iso) {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')}-${MONTHS[m - 1]}-${y}`;
}
function addDaysISO(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function mmyyFromISO(iso) {
  const [y, m] = iso.split('-');
  return `${m}${y.slice(2)}`;
}

// Revised order value = (Last Amendment if numeric, else Original) + This
// variation; NA when no numeric variation. (v1.4 build changelog formula.)
function revisedVal(fields) {
  const num = (s) => parseFloat(String(s == null ? '' : s).replace('\u2212', '-').replace(/[^0-9.\-]/g, ''));
  const v = num(fields.variation);
  if (isNaN(v)) return 'NA';
  const lastAmd = num(fields.lastAmd);
  const base = isNaN(lastAmd) ? num(fields.val) : lastAmd;
  if (isNaN(base)) return 'NA';
  return String(Math.round((base + v) * 100) / 100);
}

module.exports = {
  WORK_TYPES, INDEX_NAMES, ORDER_TYPES, RATE_VALIDATIONS, INITIATED_BY_OPTIONS,
  todayISO, isoToDMY, addDaysISO, mmyyFromISO, revisedVal,
};
