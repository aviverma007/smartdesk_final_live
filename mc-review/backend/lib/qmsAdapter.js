/**
 * QMS adapter — read-only, one-way QMS -> Dashboard (Workflow v2.5 §1.1).
 *
 * Production wires this up to the real QMS OData endpoint (API due 10-Jul,
 * Chintoo Kumar / vendor Globe — I1/I2/I3 in the readiness doc). Until then,
 * this module simulates the same NFA records the prototype used, so the
 * rest of the app (fetch/re-pull, pending-move, hybrid Pick-from-NFA
 * fields, PDF rendering) can be built and demoed against a realistic shape.
 *
 * Swap point: replace `lookupNfa()` with a real HTTP call and keep the
 * returned shape identical so nothing else in the codebase has to change.
 */

// Simulated QMS records (mirrors the prototype's seed set).
const QMS_SIM = {
  '14315': { project:'Gems 89', location:'Sec 89', desc:'Supply of utilities items at Clubhouse for SW Gems 89 site', vendor:'M/s Gunwant Electrical & Hardware Store', val:'0.76', lastAmd:'NA', variation:'NA', reason:'As requested by site', vendPQ:'3', pr:'10462', initDt:'2026-06-24', initiator:'Dhruv', prBudget:'0.80', initBy:'Site', rateVal:'Competitive bidding', files:[{n:'NFA_14315_v00.pdf',t:'pdf'},{n:'Quotation_Gunwant.pdf',t:'pdf'},{n:'Comparative_3bids.xlsx',t:'xls'}] },
  '14306': { project:'One DXP 113', location:'113', desc:'Sale order of scrap — TMT reinforcement steel (2 months)', vendor:'M/s Brown Traders', val:'19.82', lastAmd:'NA', variation:'NA', reason:'—', vendPQ:'5', pr:'8140001162', initDt:'2026-06-23', initiator:'Manish', prBudget:'20.00', initBy:'C&P Team', rateVal:'Competitive bidding', files:[{n:'NFA_14306_v00.pdf',t:'pdf'},{n:'Scrap_bids_5vendors.xlsx',t:'xls'}] },
  '14331': { project:'Orchard 61', location:'61', desc:'Supply & installation of club upgradation landscape items', vendor:'M/s Ascent Homes / Vimal Probuild / Oraa Enterprises', val:'9.82', lastAmd:'NA', variation:'NA', reason:'Club upgradation items per landscape scheme', vendPQ:'3', pr:'13302', initDt:'2026-06-26', initiator:'Jai Tyagi', prBudget:'10.00', initBy:'Site', rateVal:'Competitive bidding', files:[{n:'NFA_14331_v00.pdf',t:'pdf'},{n:'Landscape_BOQ.xlsx',t:'xls'},{n:'Vendor_offers',t:'fld'}] },
  '13594': { project:'Orchard 61', location:'61', desc:'Amendment-02 to Order 1566 — SITC of DG exhaust pipeline works (Ph-3)', vendor:'M/s Satkartar Electricals & Electronics Pvt. Ltd.', val:'39.82', lastAmd:'NA', variation:'-7.83', reason:'Qty per actual certified quantity; extra item missing from initial BOQ', vendPQ:'1', pr:'10022', initDt:'2026-06-25', initiator:'Bhavdeep Pilania', prBudget:'32.00', initBy:'Site', rateVal:'Rate analysis', files:[{n:'NFA_13594_v01.pdf',t:'pdf'},{n:'Amendment_annexure.xlsx',t:'xls'},{n:'Certified_qty_mail.msg',t:'msg'}] },
  '14319': { project:'Orchard 61', location:'61', desc:'Amendment 01 to PO SRPL/Paver/2321 — supply of pavers', vendor:'M/s Shree Balaji Pavers', val:'23.99', lastAmd:'NA', variation:'0.77', reason:'Additional item included in scope; vendor declined further discount', vendPQ:'1', pr:'10539', initDt:'2026-06-25', initiator:'Manish', prBudget:'25.00', initBy:'Site', rateVal:'Existing rate reference', files:[{n:'NFA_14319_v00.pdf',t:'pdf'}] },
  '14401': { project:'One DXP 113', location:'113', desc:'Base rates — Z-Black granite (18–20 mm)', vendor:'M/s Servesar Granite', val:'21.43', lastAmd:'NA', variation:'NA', reason:'—', vendPQ:'1', pr:'—', initDt:'2026-07-02', initiator:'Manish', prBudget:'—', initBy:'C&P Team', rateVal:'Rate analysis', files:[{n:'Granite_rate_offer.pdf',t:'pdf'},{n:'Sample_photos',t:'img'}] },
  '14402': { project:'One DXP 113', location:'113', desc:'Base rates — steel grey granite (20 mm+)', vendor:'M/s Servesar Granite', val:'4.03', lastAmd:'NA', variation:'NA', reason:'—', vendPQ:'1', pr:'—', initDt:'2026-07-02', initiator:'Manish', prBudget:'—', initBy:'C&P Team', rateVal:'Rate analysis', files:[{n:'Granite_rate_offer.pdf',t:'pdf'}] },
  '14355': { project:'Sky Arc 69', location:'69', desc:'Supply of misc. consumables — details incomplete', vendor:'M/s A-One Traders', val:'1.12', lastAmd:'NA', variation:'NA', reason:'—', vendPQ:'1', pr:'—', initDt:'2026-07-03', initiator:'Kunal Mehra', prBudget:'—', initBy:'Site', rateVal:'', files:[{n:'NFA_14355_v00.pdf',t:'pdf'}] },
  '14350': { project:'Orchard 61', location:'61', desc:'Boundary wall & RCC works — phase 2 stretch', vendor:'M/s Jagrati Construction', val:'41.20', lastAmd:'NA', variation:'NA', reason:'Phase-2 site development', vendPQ:'4', pr:'11208', initDt:'2026-07-01', initiator:'Dhruv', prBudget:'42.00', initBy:'Site', rateVal:'Competitive bidding', files:[{n:'NFA_14350_v00.pdf',t:'pdf'},{n:'RCC_BOQ.xlsx',t:'xls'}] },
  '14352': { project:'The Edition', location:'Sec 66', desc:'Structural consultancy — peer review, Towers C & D', vendor:'M/s StruCon Consultants LLP', val:'14.50', lastAmd:'NA', variation:'NA', reason:'Peer review mandated for high-rise', vendPQ:'2', pr:'11544', initDt:'2026-06-30', initiator:'Priya Nair', prBudget:'15.00', initBy:'C&P Team', rateVal:'Rate analysis', files:[{n:'NFA_14352_v00.pdf',t:'pdf'},{n:'Scope_note.pdf',t:'pdf'}] },
  '14333': { project:'One DXP-2 113', location:'113', desc:'SITC of dust separation system works', vendor:'M/s Oxy Green Landscape and Infra LLP', val:'11.88', lastAmd:'NA', variation:'NA', reason:'Dust control at batching zone', vendPQ:'2', pr:'8140001160', initDt:'2026-06-26', initiator:'Yash Sharma', prBudget:'12.00', initBy:'Site', rateVal:'Competitive bidding', files:[{n:'NFA_14333_v00.pdf',t:'pdf'},{n:'DustSys_BOQ.xlsx',t:'xls'},{n:'L1_L2_mail.msg',t:'msg'}] },
  '14313': { project:'One DXP', location:'113', desc:'Sale order — shifting of 30 kVA DG set from Sales Gallery Sec-111 to Sky Arc Sec-69', vendor:'M/s Riverday Infrastructure Pvt. Ltd.', val:'2.06', lastAmd:'NA', variation:'NA', reason:'Internal shifting of DG set', vendPQ:'1', pr:'8140001174', initDt:'2026-06-26', initiator:'Suraj Bhan Bhardwaj', prBudget:'2.10', initBy:'C&P Team', rateVal:'', files:[{n:'NFA_14313_v00.pdf',t:'pdf'}] },
  '14344': { project:'Orchard 61', location:'61', desc:'Sale order of scrap — TMT reinforcement steel', vendor:'M/s Brown Traders', val:'3.78', lastAmd:'NA', variation:'NA', reason:'Collection from multiple locations', vendPQ:'3', pr:'10321', initDt:'2026-06-29', initiator:'Yash Sharma', prBudget:'4.00', initBy:'Site', rateVal:'Competitive bidding', files:[{n:'NFA_14344_v00.pdf',t:'pdf'}] },
};

/**
 * Look up an NFA in QMS. Returns null if not found (Mode A validation #1 —
 * "NFA not in QMS -> error + offer Mode B").
 */
async function lookupNfa(nfaNo) {
  const rec = QMS_SIM[nfaNo];
  if (!rec) return null;
  return { ...rec, files: rec.files.map((f) => ({ ...f })) };
}

module.exports = { lookupNfa, QMS_SIM };
