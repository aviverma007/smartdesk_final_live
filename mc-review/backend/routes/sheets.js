const express = require('express');
const { currentUser, audit, requireReviewerOf } = require('../lib/auth');
const { todayISO, addDaysISO } = require('../lib/reference');

/**
 * Page 2 — Pre-meeting Review & Check. Workflow v2.5 §5.
 * Reviewer: select/deselect for MC, in-cell touch-ups, Lock -> Page 3 (B1
 * end-of-sheet marker rendered client-side once rows.length > 0). Users:
 * view-only (§14 D12, closed).
 */
module.exports = function sheetsRoutes(getPool) {
  const router = express.Router();

  function rowToEntry(row) {
    return {
      id: row.Id, nfa: row.NfaNo, mode: row.Mode, index: row.IndexName, wt: row.WorkType,
      date: row.ReviewDate.toISOString().slice(0, 10),
      f: JSON.parse(row.FieldsJson || '{}'), hyb: JSON.parse(row.HybridJson || '{}'),
      touch: JSON.parse(row.TouchJson || '{}'), files: JSON.parse(row.FilesJson || '[]'),
      initiator: row.InitiatedBy, isProxy: !!row.IsProxy,
      initDt: row.InitiatedOn ? row.InitiatedOn.toISOString().slice(0, 10) : null,
      enteredBy: row.EnteredBy, status: row.Status, sel: !!row.Selected, mc: !!row.PresentToMC,
      resubReq: !!row.ResubRequired, resubComment: row.ResubComment,
    };
  }

  async function getOrCreateSheet(pool, indexName, dateISO) {
    let r = await pool.request().input('idx', indexName).input('d', dateISO)
      .query('SELECT * FROM dbo.MC_Sheets WHERE IndexName=@idx AND ReviewDate=@d');
    if (r.recordset[0]) return r.recordset[0];
    await pool.request().input('idx', indexName).input('d', dateISO)
      .query('INSERT INTO dbo.MC_Sheets(IndexName, ReviewDate) VALUES (@idx, @d)');
    r = await pool.request().input('idx', indexName).input('d', dateISO)
      .query('SELECT * FROM dbo.MC_Sheets WHERE IndexName=@idx AND ReviewDate=@d');
    return r.recordset[0];
  }

  function reviewerGate(req, res, next) {
    const { role } = currentUser(req);
    const map = { MEP: 'revMEP', CIVIL: 'revCIV' };
    if (role === 'admin' || role === map[req.params.index]) return next();
    return res.status(403).json({ error: 'Forbidden — requires reviewer of ' + req.params.index });
  }

  // ---- Get the sheet: entries + lock state --------------------------------
  router.get('/:index/:date', async (req, res) => {
    const { index, date } = req.params;
    try {
      const pool = await getPool();
      const sheet = await getOrCreateSheet(pool, index, date);
      const r = await pool.request().input('idx', index).input('d', date)
        .query(`SELECT * FROM dbo.MC_Entries
                WHERE IndexName=@idx AND ReviewDate=@d AND Status IN ('submitted','presented')
                ORDER BY WorkType, Id`);
      const entries = r.recordset.map(rowToEntry);
      res.json({
        sheet: { locked: !!sheet.Locked, version: sheet.Version, publishedRev: sheet.PublishedRev, lockedAt: sheet.LockedAt },
        entries,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Reviewer: select/deselect for MC (any change unlocks) --------------
  router.post('/:index/:date/entries/:id/mc', reviewerGate, async (req, res) => {
    const { loginId } = currentUser(req);
    const { index, date, id } = req.params;
    const { mc } = req.body;
    try {
      const pool = await getPool();
      await pool.request().input('id', id).input('mc', mc ? 1 : 0)
        .query('UPDATE dbo.MC_Entries SET PresentToMC=@mc, UpdatedAt=GETDATE() WHERE Id=@id');
      const sheet = await getOrCreateSheet(pool, index, date);
      if (sheet.Locked) {
        await pool.request().input('id', sheet.Id).query('UPDATE dbo.MC_Sheets SET Locked=0 WHERE Id=@id');
        await audit(pool, loginId, 'Sheet unlocked by curation', `${index}·${date}`);
      }
      res.json({ ok: true, unlocked: !!sheet.Locked });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Reviewer: in-cell touch-up (Rate / Reason / Resubmission etc.) -----
  router.post('/:index/:date/entries/:id/touch', reviewerGate, async (req, res) => {
    const { loginId } = currentUser(req);
    const { field, value } = req.body;
    const id = Number(req.params.id);
    try {
      const pool = await getPool();
      const r = await pool.request().input('id', id).query('SELECT * FROM dbo.MC_Entries WHERE Id=@id');
      const row = r.recordset[0];
      if (!row) return res.status(404).json({ error: 'Entry not found' });
      const touch = JSON.parse(row.TouchJson || '{}');
      touch[field] = { value, by: loginId, at: new Date().toISOString() };
      const fields = JSON.parse(row.FieldsJson || '{}');
      fields[field] = value;
      await pool.request().input('id', id).input('touch', JSON.stringify(touch)).input('fields', JSON.stringify(fields))
        .query('UPDATE dbo.MC_Entries SET TouchJson=@touch, FieldsJson=@fields, UpdatedAt=GETDATE() WHERE Id=@id');
      await audit(pool, loginId, 'Cell touch-up', `${row.NfaNo} — ${field} -> ${value}`);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Lock sheet -> Page 3 snapshot vN (zero-selection lock is valid) ----
  router.post('/:index/:date/lock', reviewerGate, async (req, res) => {
    const { loginId } = currentUser(req);
    const { index, date } = req.params;
    try {
      const pool = await getPool();
      const sheet = await getOrCreateSheet(pool, index, date);
      const newVersion = sheet.Version + 1;

      const r = await pool.request().input('idx', index).input('d', date)
        .query(`SELECT * FROM dbo.MC_Entries WHERE IndexName=@idx AND ReviewDate=@d AND Status IN ('submitted','presented')`);

      const priorDec = await pool.request().input('sheetId', sheet.Id)
        .query(`SELECT EntryId, Decision, McComment FROM dbo.MC_SnapshotRows WHERE SheetId=@sheetId AND Version=(SELECT MAX(Version) FROM dbo.MC_SnapshotRows WHERE SheetId=@sheetId)`);
      const priorMap = new Map(priorDec.recordset.map((row) => [row.EntryId, row]));

      let order = 0;
      for (const row of r.recordset) {
        if (!row.Selected) continue; // held rows never enter the snapshot
        const prior = priorMap.get(row.Id);
        // Carry initDt / resubmission remark into the frozen snapshot so the
        // published PDF (which reads only FieldsJson) can render them —
        // these live on MC_Entries, not in the QMS field blob itself.
        const fields = JSON.parse(row.FieldsJson || '{}');
        fields.initDt = fields.initDt || (row.InitiatedOn ? new Date(row.InitiatedOn).toISOString().slice(0, 10) : null);
        fields.initiator = fields.initiator || row.InitiatedBy;
        if (row.ResubRequired && row.ResubComment) fields.resubComment = row.ResubComment;
        await pool.request()
          .input('sheetId', sheet.Id).input('version', newVersion).input('entryId', row.Id)
          .input('nfa', row.NfaNo).input('wt', row.WorkType).input('fields', JSON.stringify(fields))
          .input('decision', prior ? prior.Decision : null).input('mcComment', prior ? prior.McComment : null)
          .input('rowOrder', order++)
          .query(`INSERT INTO dbo.MC_SnapshotRows(SheetId, Version, EntryId, NfaNo, WorkType, FieldsJson, Decision, McComment, RowOrder)
                  VALUES (@sheetId, @version, @entryId, @nfa, @wt, @fields, @decision, @mcComment, @rowOrder)`);
        await pool.request().input('id', row.Id).query(`UPDATE dbo.MC_Entries SET Status='presented' WHERE Id=@id`);
      }

      await pool.request().input('id', sheet.Id).input('v', newVersion)
        .query('UPDATE dbo.MC_Sheets SET Locked=1, Version=@v, LockedAt=GETDATE() WHERE Id=@id');
      await audit(pool, loginId, 'Sheet locked', `${index}·${date} v${newVersion}`);
      res.json({ locked: true, version: newVersion });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Migrate sheet (today <-> today+window, either direction) -----------
  router.post('/:index/:date/migrate', reviewerGate, async (req, res) => {
    const { loginId } = currentUser(req);
    const { index, date } = req.params;
    const { toDate } = req.body;
    try {
      const pool = await getPool();
      const cfgR = await pool.request().query(`SELECT [Value] FROM dbo.MC_Config WHERE [Key]='migrateWindowDays'`);
      const windowDays = Number(cfgR.recordset[0]?.Value || 10);
      const today = todayISO();
      const maxDate = addDaysISO(today, windowDays);
      if (toDate < today || toDate > maxDate) {
        return res.status(400).json({ error: `Migrate window is ${today} to ${maxDate}` });
      }
      if (toDate === date) return res.status(400).json({ error: 'Target date must differ from the source date' });

      const sourceSheet = await getOrCreateSheet(pool, index, date);
      if (sourceSheet.PublishedRev > 0) return res.status(409).json({ error: 'Cannot migrate a published sheet' });

      const targetSheet = await getOrCreateSheet(pool, index, toDate);
      if (targetSheet.PublishedRev > 0) return res.status(409).json({ error: 'Target date is published; migrate refused' });

      const r = await pool.request().input('idx', index).input('d', date)
        .query(`SELECT * FROM dbo.MC_Entries WHERE IndexName=@idx AND ReviewDate=@d AND Status IN ('submitted','presented')`);

      const arrivesDeselected = targetSheet.Locked;
      for (const row of r.recordset) {
        await pool.request().input('id', row.Id).input('d', toDate)
          .input('sel', arrivesDeselected ? 0 : row.Selected)
          .query(`UPDATE dbo.MC_Entries SET ReviewDate=@d, Status='submitted', Selected=@sel, UpdatedAt=GETDATE() WHERE Id=@id`);
      }

      await audit(pool, loginId, 'Sheet migrated', `${index}·${date} -> ${index}·${toDate} (${r.recordset.length} entries)${arrivesDeselected ? ' — target locked, arrivals deselected' : ''}`);
      res.json({ migrated: true, count: r.recordset.length, arrivedDeselected: !!arrivesDeselected });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
