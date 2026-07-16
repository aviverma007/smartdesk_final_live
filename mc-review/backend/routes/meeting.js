const express = require('express');
const { currentUser, audit } = require('../lib/auth');

/**
 * Page 3 — MC Meeting Review. Workflow v2.5 §6.
 * Decisions save versioned through the session; publish gates on the
 * confirmation modal (B4 zero-decided warning / disabled-on-empty), closes
 * the date, and writes the F8 publish guard (a live entry that departed
 * via a permitted relocation is left untouched — its ghost row's outcome
 * is history-only).
 */
module.exports = function meetingRoutes(getPool) {
  const router = express.Router();

  function reviewerGate(req, res, next) {
    const { role } = currentUser(req);
    const map = { MEP: 'revMEP', CIVIL: 'revCIV' };
    if (role === 'admin' || role === map[req.params.index]) return next();
    return res.status(403).json({ error: 'Forbidden — requires reviewer of ' + req.params.index });
  }

  // ---- Get the last locked snapshot ---------------------------------------
  router.get('/:index/:date', async (req, res) => {
    const { index, date } = req.params;
    try {
      const pool = await getPool();
      const sheetR = await pool.request().input('idx', index).input('d', date)
        .query('SELECT * FROM dbo.MC_Sheets WHERE IndexName=@idx AND ReviewDate=@d');
      const sheet = sheetR.recordset[0];
      if (!sheet || sheet.Version === 0) return res.json({ sheet: null, rows: [] });

      const rowsR = await pool.request().input('sheetId', sheet.Id).input('v', sheet.Version)
        .query(`SELECT * FROM dbo.MC_SnapshotRows WHERE SheetId=@sheetId AND Version=@v ORDER BY WorkType, RowOrder`);
      const rows = rowsR.recordset.map((r) => ({
        id: r.Id, entryId: r.EntryId, nfa: r.NfaNo, wt: r.WorkType,
        f: JSON.parse(r.FieldsJson || '{}'), decision: r.Decision, mcComment: r.McComment,
        relocatedTo: r.RelocatedTo, relocatedAt: r.RelocatedAt,
      }));
      res.json({
        sheet: { version: sheet.Version, publishedRev: sheet.PublishedRev, lockedAt: sheet.LockedAt },
        rows,
        decidedCount: rows.filter((r) => r.decision).length,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Decision buttons: thumbs-up / pause / thumbs-down (same-click clears)
  router.post('/:index/:date/rows/:rowId/decision', reviewerGate, async (req, res) => {
    const { loginId } = currentUser(req);
    const { decision } = req.body; // 'approved' | 'hold' | 'rejected' | null (clear)
    const rowId = Number(req.params.rowId);
    try {
      const pool = await getPool();
      const r = await pool.request().input('id', rowId).query('SELECT * FROM dbo.MC_SnapshotRows WHERE Id=@id');
      const row = r.recordset[0];
      if (!row) return res.status(404).json({ error: 'Snapshot row not found' });

      const next = row.Decision === decision ? null : decision; // same-button toggle clears
      await pool.request().input('id', rowId).input('dec', next)
        .query('UPDATE dbo.MC_SnapshotRows SET Decision=@dec, DecidedAt=GETDATE() WHERE Id=@id');
      await audit(pool, loginId, 'MC decision', `${row.NfaNo} -> ${next || 'cleared'}`);
      res.json({ ok: true, decision: next });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/:index/:date/rows/:rowId/comment', reviewerGate, async (req, res) => {
    const { loginId } = currentUser(req);
    const { comment } = req.body;
    const rowId = Number(req.params.rowId);
    try {
      const pool = await getPool();
      await pool.request().input('id', rowId).input('c', comment)
        .query('UPDATE dbo.MC_SnapshotRows SET McComment=@c WHERE Id=@id');
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Publish per index (B4: zero-decided warning / disabled-on-empty) ---
  router.post('/:index/:date/publish', reviewerGate, async (req, res) => {
    const { loginId } = currentUser(req);
    const { index, date } = req.params;
    const { confirmed } = req.body;
    try {
      const pool = await getPool();
      const sheetR = await pool.request().input('idx', index).input('d', date)
        .query('SELECT * FROM dbo.MC_Sheets WHERE IndexName=@idx AND ReviewDate=@d');
      const sheet = sheetR.recordset[0];
      if (!sheet || sheet.Version === 0) return res.status(400).json({ error: 'No locked snapshot to publish' });
      if (sheet.PublishedRev > 0) return res.status(409).json({ error: 'One publish per index per date — already published' });

      const rowsR = await pool.request().input('sheetId', sheet.Id).input('v', sheet.Version)
        .query(`SELECT * FROM dbo.MC_SnapshotRows WHERE SheetId=@sheetId AND Version=@v`);
      const rows = rowsR.recordset;

      if (rows.length === 0) {
        return res.status(400).json({ error: 'Publish is disabled on an empty snapshot (zero presented).' });
      }

      const decided = rows.filter((r) => r.Decision);
      if (decided.length === 0 && !confirmed) {
        return res.status(409).json({
          requiresConfirm: true,
          warning: `0 decided — publishing will expire all ${rows.length} presented entries.`,
        });
      }

      const undecided = rows.filter((r) => !r.Decision);

      for (const row of decided) {
        // F8 publish guard: only touch the live entry's status if it still
        // resides on the publishing index+date. A relocated ghost row
        // (RelocatedTo set) records to NFA history only — its live entry,
        // which departed via a permitted relocation, is left untouched.
        if (row.RelocatedTo) continue;
        const statusMap = { approved: 'approved', hold: 'hold', rejected: 'rejected' };
        await pool.request().input('id', row.EntryId).input('status', statusMap[row.Decision])
          .input('isOpen', row.Decision === 'hold' ? 1 : 0)
          .query('UPDATE dbo.MC_Entries SET Status=@status, IsOpen=@isOpen, UpdatedAt=GETDATE() WHERE Id=@id');
      }
      for (const row of undecided) {
        if (row.RelocatedTo) continue; // ghost row — nothing to expire on a departed live entry
        await pool.request().input('id', row.EntryId)
          .query(`UPDATE dbo.MC_Entries SET Status='expired', IsOpen=0, UpdatedAt=GETDATE() WHERE Id=@id`);
      }

      await pool.request().input('id', sheet.Id).query('UPDATE dbo.MC_Sheets SET PublishedRev=1, PublishedAt=GETDATE() WHERE Id=@id');

      const undecidedNos = JSON.stringify(undecided.map((r) => r.NfaNo));
      await pool.request()
        .input('idx', index).input('d', date).input('sheetId', sheet.Id).input('by', loginId)
        .input('decidedCount', decided.length).input('undecidedNos', undecidedNos)
        .query(`INSERT INTO dbo.MC_PublishedPdfs(IndexName, ReviewDate, SheetId, Revision, PublishedBy, DecidedCount, UndecidedNos)
                VALUES (@idx, @d, @sheetId, 1, @by, @decidedCount, @undecidedNos)`);

      await audit(pool, loginId, 'Sheet published', `${index}·${date} — ${decided.length} decided, ${undecided.length} expired`);
      res.json({ published: true, decidedCount: decided.length, undecidedCount: undecided.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
