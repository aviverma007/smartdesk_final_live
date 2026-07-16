const express = require('express');
const PDFDocument = require('pdfkit');
const { WORK_TYPES, INDEX_NAMES } = require('../lib/reference');

/**
 * Published PDF output. Workflow v2.5 §9.1: decided entries only, Work-Type
 * grouped, "(Initiated on …)" sub-lines, undecided numbers-only note at the
 * foot, confidentiality note, Smart World branding. No end-of-sheet marker
 * in the PDF (that marker is a screen-only Pages 2/3 affordance).
 */
module.exports = function pdfRoutes(getPool) {
  const router = express.Router();

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

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="MC-Review-${index}-${date}.pdf"`);

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      doc.pipe(res);

      doc.fontSize(16).font('Helvetica-Bold').text(`MC REVIEW — ${INDEX_NAMES[index] || index} — ${date}`, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica').fillColor('#555').text(`Revision ${pub.Revision}${pub.Revision > 1 ? ' (Corrigendum)' : ''} · Published ${new Date(pub.PublishedAt).toDateString()} by ${pub.PublishedBy}`, { align: 'center' });
      doc.fillColor('#000');
      doc.moveDown(1);

      const grouped = {};
      decided.forEach((r) => { (grouped[r.WorkType] = grouped[r.WorkType] || []).push(r); });

      Object.keys(grouped).sort().forEach((wt) => {
        doc.fontSize(11).font('Helvetica-Bold').text(`${wt} — ${WORK_TYPES[wt] || ''}`);
        doc.moveDown(0.3);
        grouped[wt].forEach((r) => {
          const f = JSON.parse(r.FieldsJson || '{}');
          doc.fontSize(10).font('Helvetica-Bold').text(`${r.NfaNo}`, { continued: true })
            .font('Helvetica').text(`   ${f.desc || ''}`);
          if (f.initDt) doc.fontSize(8).fillColor('#555').text(`(Initiated on ${f.initDt})`).fillColor('#000');
          doc.fontSize(9).text(`Vendor: ${f.vendor || '—'}   Value: ₹${f.val || '—'} L`);
          const decisionLabel = { approved: 'APPROVED', hold: 'HOLD', rejected: 'REJECTED' }[r.Decision];
          doc.font('Helvetica-Bold').text(`Decision: ${decisionLabel}`, { continued: !!r.McComment });
          if (r.McComment) doc.font('Helvetica').text(`   — ${r.McComment}`);
          if (r.RelocatedTo) doc.fontSize(8).fillColor('#888').text(`(live entry relocated to ${r.RelocatedTo} — history only)`).fillColor('#000');
          doc.moveDown(0.5);
        });
        doc.moveDown(0.4);
      });

      if (undecidedNos.length) {
        doc.moveDown(0.5);
        doc.fontSize(9).font('Helvetica-Oblique')
          .text(`Undecided (excluded, expired): ${undecidedNos.join(', ')}`);
      }

      doc.moveDown(1);
      doc.fontSize(8).font('Helvetica').fillColor('#555')
        .text('Re-presentation of a rejected/held/expired NFA requires a fresh Page-1 entry with a mandatory resubmission comment.', { width: 500 })
        .moveDown(0.3)
        .text('Confidential — for internal circulation within Smart World Developers only. Not for external distribution.', { width: 500 });

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
