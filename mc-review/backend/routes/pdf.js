const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');
const { WORK_TYPES, INDEX_NAMES, revisedVal } = require('../lib/reference');

const LOGO_PATH = path.join(__dirname, '..', 'lib', 'smartworld-logo.png');

/**
 * Published PDF output — Workflow v2.5 §9.1, matched verbatim against the
 * issued reference sample (05-PDF-Samples/mc-pdf-output-format-sample-mep-
 * 05jul2026-v3.pdf): landscape table, full field set (PR Budget / Orig.
 * Value / Last Amend. / This Variation / Revised Value / Reason /
 * Validation of Rates / Vend.&PQ / PR No. / NFA No. / resubmission remark /
 * Creator / MC Comments+Status), header counters line (Presented / Approved
 * / Hold / Rejected / Undecided), and the exact footer copy.
 */
module.exports = function pdfRoutes(getPool) {
  const router = express.Router();

  const DECISION_LABEL = { approved: 'APPROVED', hold: 'HOLD', rejected: 'REJECTED' };
  const money = (v) => (v === undefined || v === null || v === '' ? '—' : v);

  router.get('/:index/:date', async (req, res) => {
    const { index, date } = req.params;
    try {
      const pool = await getPool();
      const pubR = await pool.request().input('idx', index).input('d', date)
        .query(`SELECT TOP 1 * FROM dbo.MC_PublishedPdfs WHERE IndexName=@idx AND ReviewDate=@d ORDER BY Revision DESC`);
      const pub = pubR.recordset[0];
      if (!pub) return res.status(404).json({ error: 'No published PDF for this index/date' });

      const rowsR = await pool.request().input('sheetId', pub.SheetId)
        .query(`SELECT * FROM dbo.MC_SnapshotRows WHERE SheetId=@sheetId ORDER BY WorkType, RowOrder`);
      const rows = rowsR.recordset;
      const decided = rows.filter((r) => r.Decision);
      const undecidedNos = JSON.parse(pub.UndecidedNos || '[]');

      const counters = {
        presented: rows.length,
        approved: decided.filter((r) => r.Decision === 'approved').length,
        hold: decided.filter((r) => r.Decision === 'hold').length,
        rejected: decided.filter((r) => r.Decision === 'rejected').length,
        undecided: rows.length - decided.length,
      };

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="MC-Review-${index}-${date}-Rev${pub.Revision}.pdf"`);

      const doc = new PDFDocument({ margin: 24, size: 'A4', layout: 'landscape' });
      doc.pipe(res);

      const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // Smart World logo, top-right (Workflow v2.5 §6.5 requirement).
      try {
        doc.image(LOGO_PATH, doc.page.width - doc.page.margins.right - 110, doc.page.margins.top - 4, { width: 110 });
      } catch (e) { /* logo optional — never block PDF generation on it */ }

      // ---- Header ----
      doc.fontSize(15).font('Helvetica-Bold')
        .text(`MC REVIEW — ${(INDEX_NAMES[index] || index).toUpperCase()} — ${fmtDMY(date)}`, { align: 'center' });
      doc.fontSize(7).font('Helvetica').fillColor('#444')
        .text('S M A R T   W O R L D   D E V E L O P E R S   ·   C O N T R A C T S   &   P R O C U R E M E N T   ·   M A N A G E M E N T   C O M M I T T E E   R E V I E W', { align: 'center' });
      doc.fillColor('#000').moveDown(0.6);

      doc.fontSize(8).font('Helvetica')
        .text(
          `Meeting date: ${fmtDMY(date)}    Index: ${INDEX_NAMES[index] || index}    Locked snapshot: v${pub.Revision === 1 ? '1' : pub.SheetId}    ` +
          `Published: ${fmtDMY(pub.PublishedAt)} ${fmtTime(pub.PublishedAt)} by ${pub.PublishedBy}    Document: Rev-${pub.Revision} (${pub.Revision > 1 ? 'corrigendum' : 'original'})`,
        );
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').text(
        `Presented: ${counters.presented}    Approved: ${counters.approved}    Hold: ${counters.hold}    Rejected: ${counters.rejected}    Undecided (excluded, expired): ${counters.undecided}`,
      );
      doc.font('Helvetica').moveDown(0.5);

      // ---- Table ----
      const cols = [
        { key: 'sno', label: 'S.No', w: 18 },
        { key: 'project', label: 'Project', w: 55 },
        { key: 'loc', label: 'Loc.', w: 28 },
        { key: 'desc', label: 'Description of Work', w: 95 },
        { key: 'vendor', label: 'Vendor Name', w: 80 },
        { key: 'prBudget', label: 'PR Budget ₹L', w: 38 },
        { key: 'val', label: 'Orig. Value ₹L (incl. GST)', w: 42 },
        { key: 'lastAmd', label: 'Last Amend. ₹L', w: 36 },
        { key: 'variation', label: 'This Variation ₹L', w: 36 },
        { key: 'revised', label: 'Revised Value ₹L', w: 36 },
        { key: 'reason', label: 'Reason', w: 80 },
        { key: 'rateVal', label: 'Validation of Rates', w: 55 },
        { key: 'vendPQ', label: 'Vend. & PQ', w: 26 },
        { key: 'pr', label: 'PR No.', w: 38 },
        { key: 'nfa', label: 'NFA No.', w: 40 },
        { key: 'resub', label: 'Remark from NFA Creator (resubmission)', w: 60 },
        { key: 'creator', label: 'Creator', w: 40 },
        { key: 'mcComment', label: 'MC Comments', w: 55 },
        { key: 'status', label: 'MC Approval / Status', w: 45 },
      ];
      const scale = pageW / cols.reduce((s, c) => s + c.w, 0);
      cols.forEach((c) => { c.w *= scale; });

      function drawHeaderRow() {
        doc.fontSize(6).font('Helvetica-Bold');
        let x = doc.page.margins.left;
        const y = doc.y;
        cols.forEach((c) => { doc.text(c.label, x, y, { width: c.w, align: 'left' }); x += c.w; });
        doc.moveDown(1.2);
        doc.font('Helvetica');
      }

      function ensureSpace(minH) {
        if (doc.y + minH > doc.page.height - doc.page.margins.bottom - 40) {
          doc.addPage({ margin: 24, size: 'A4', layout: 'landscape' });
          drawHeaderRow();
        }
      }

      drawHeaderRow();

      const grouped = {};
      decided.forEach((r) => { (grouped[r.WorkType] = grouped[r.WorkType] || []).push(r); });

      Object.keys(grouped).sort().forEach((wt) => {
        ensureSpace(20);
        doc.fontSize(8).font('Helvetica-Bold').text(`${wt}. ${(WORK_TYPES[wt] || '').toUpperCase()}`);
        doc.moveDown(0.2);

        grouped[wt].forEach((r, i) => {
          const f = JSON.parse(r.FieldsJson || '{}');
          ensureSpace(28);
          const y = doc.y;
          let x = doc.page.margins.left;
          doc.fontSize(6.3).font('Helvetica');

          const cells = {
            sno: String(i + 1),
            project: f.project || '',
            loc: f.location || '',
            desc: f.desc || '',
            vendor: f.vendor || '',
            prBudget: money(f.prBudget),
            val: money(f.val),
            lastAmd: money(f.lastAmd),
            variation: money(f.variation),
            revised: revisedVal(f),
            reason: f.reason || '—',
            rateVal: f.rateVal || '—',
            vendPQ: money(f.vendPQ),
            pr: money(f.pr),
            nfa: r.NfaNo,
            resub: f.resubComment || '—',
            creator: f.initiator || '',
            mcComment: r.McComment || '—',
            status: DECISION_LABEL[r.Decision] || '',
          };

          cols.forEach((c) => {
            const bold = c.key === 'nfa' || c.key === 'status';
            doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').text(String(cells[c.key] ?? ''), x, y, { width: c.w - 2 });
            x += c.w;
          });

          if (f.initDt) {
            doc.fontSize(5.5).fillColor('#666').text(`(Initiated on ${fmtDMY(f.initDt)})`, doc.page.margins.left + cols[0].w + cols[1].w + cols[2].w + cols[3].w, doc.y);
            doc.fillColor('#000');
          }
          if (r.RelocatedTo) {
            doc.fontSize(5.5).fillColor('#888').text(`(live entry relocated to ${r.RelocatedTo} — decisions record to NFA history only)`);
            doc.fillColor('#000');
          }
          doc.moveDown(0.9);
        });
        doc.moveDown(0.3);
      });

      // ---- Footer ----
      doc.moveDown(0.5);
      doc.fontSize(7).font('Helvetica')
        .text(`Undecided & excluded from this document: ${undecidedNos.length ? undecidedNos.join(', ') : '—'}.`);
      doc.text('Held/Rejected NFAs re-presentations require a fresh entry with mandatory resubmission comment.');
      doc.moveDown(0.4);
      doc.fontSize(6.5).fillColor('#555')
        .text(
          'System-generated on Publish · locked & immutable · corrections by admin corrigendum (Rev-2) only          ' +
          'Confidential — For internal circulation within Smartworld Developers and associated entities only. Unauthorized sharing, ' +
          'reproduction, or distribution of this document, in whole or in part, is strictly prohibited without prior written approval.',
        );
      doc.fillColor('#000');

      doc.end();
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // List all published PDFs (Page-1 "Published PDFs" tab + date-wise library).
  router.get('/', async (req, res) => {
    try {
      const pool = await getPool();
      const r = await pool.request().query(`SELECT IndexName, ReviewDate, Revision, PublishedBy, PublishedAt, DecidedCount
                                             FROM dbo.MC_PublishedPdfs ORDER BY PublishedAt DESC`);
      res.json(r.recordset);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};

function fmtDMY(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(dt.getDate()).padStart(2, '0')}-${MONTHS[dt.getMonth()]}-${dt.getFullYear()}`;
}
function fmtTime(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toTimeString().slice(0, 5);
}
