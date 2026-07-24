const express = require('express');
const sql = require('mssql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { currentUser, audit } = require('../lib/auth');
const { lookupNfa } = require('../lib/qmsAdapter');
const { todayISO, revisedVal } = require('../lib/reference');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    // Prefix with a timestamp so same-named files from different entries
    // never collide on disk; the original name is preserved in FilesJson
    // and shown to the user, only the on-disk name is mangled.
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
});

// Typed file chips, matching the prototype's PDF/XLS/MAIL/IMG/FLD scheme.
function fileTypeFromName(name) {
  if (/\.pdf$/i.test(name)) return 'pdf';
  if (/\.(xlsx?|csv)$/i.test(name)) return 'xls';
  if (/\.(msg|eml)$/i.test(name)) return 'msg';
  if (/\.(png|jpe?g|gif|webp)$/i.test(name)) return 'img';
  return 'fld';
}

/**
 * Page 1 — NFA Entry. Implements Workflow v2.5 §4 + the B2 pending-move
 * ticket model (§0-1, §3 lifecycle, §14 D5).
 *
 * Key invariants held throughout:
 *  - D5 / one open entry per NFA at a time.
 *  - P2-uniqueness: an entry has at most one live presence on Page 2 in
 *    every intermediate state (a pending move never creates a second row).
 *  - Re-fetch with the SAME index/WT/date on an open entry = re-pull
 *    (refresh fields/files in place, B7). Re-fetch with a DIFFERING
 *    index/WT/date on a submitted/presented entry stages a pending-move
 *    ticket (B2) instead of editing anything immediately.
 */
module.exports = function entriesRoutes(getPool) {
  const router = express.Router();

  function hybridInit(qmsRec) {
    return {
      prBudget: { pfn: true, qms: qmsRec.prBudget || '—', user: null },
      reason: { pfn: true, qms: qmsRec.reason, user: null },
      vendPQ: { pfn: true, qms: qmsRec.vendPQ, user: null },
      remarks: { pfn: true, qms: `Value ₹${qmsRec.val} L. ${qmsRec.reasonability === '—' ? '' : qmsRec.reasonability}`, user: null },
    };
  }

  function rowToEntry(row) {
    return {
      id: row.Id,
      nfa: row.NfaNo,
      mode: row.Mode,
      index: row.IndexName,
      wt: row.WorkType,
      date: row.ReviewDate.toISOString().slice(0, 10),
      f: JSON.parse(row.FieldsJson || '{}'),
      hyb: JSON.parse(row.HybridJson || '{}'),
      touch: JSON.parse(row.TouchJson || '{}'),
      files: JSON.parse(row.FilesJson || '[]'),
      initiator: row.InitiatedBy,
      isProxy: !!row.IsProxy,
      initDt: row.InitiatedOn ? row.InitiatedOn.toISOString().slice(0, 10) : null,
      enteredBy: row.EnteredBy,
      interimRef: row.InterimRef,
      status: row.Status,
      sel: !!row.Selected,
      mc: !!row.PresentToMC,
      resubReq: !!row.ResubRequired,
      resubComment: row.ResubComment,
      isOpen: !!row.IsOpen,
    };
  }

  async function getEntryRow(pool, id) {
    const r = await pool.request().input('id', id).query('SELECT * FROM dbo.MC_Entries WHERE Id=@id');
    return r.recordset[0] || null;
  }

  async function getOpenEntryForNfa(pool, nfaNo) {
    const r = await pool.request().input('nfa', nfaNo)
      .query(`SELECT TOP 1 * FROM dbo.MC_Entries WHERE NfaNo=@nfa AND IsOpen=1 ORDER BY Id DESC`);
    return r.recordset[0] || null;
  }

  async function getSheet(pool, indexName, dateISO) {
    let r = await pool.request().input('idx', indexName).input('d', dateISO)
      .query('SELECT * FROM dbo.MC_Sheets WHERE IndexName=@idx AND ReviewDate=@d');
    if (r.recordset[0]) return r.recordset[0];
    await pool.request().input('idx', indexName).input('d', dateISO)
      .query('INSERT INTO dbo.MC_Sheets(IndexName, ReviewDate) VALUES (@idx, @d)');
    r = await pool.request().input('idx', indexName).input('d', dateISO)
      .query('SELECT * FROM dbo.MC_Sheets WHERE IndexName=@idx AND ReviewDate=@d');
    return r.recordset[0];
  }

  async function findPendingMove(pool, entryId) {
    const r = await pool.request().input('id', entryId)
      .query(`SELECT TOP 1 * FROM dbo.MC_PendingMoves WHERE EntryId=@id AND Status='pending' ORDER BY Id DESC`);
    return r.recordset[0] || null;
  }

  // ---- Upload & attach files directly to an existing entry ---------------
  router.post('/:id/files/upload', upload.array('files', 10), async (req, res) => {
    const { loginId } = currentUser(req);
    const id = Number(req.params.id);
    try {
      const pool = await getPool();
      const row = await getEntryRow(pool, id);
      if (!row) return res.status(404).json({ error: 'Entry not found' });
      const existing = JSON.parse(row.FilesJson || '[]');
      const added = (req.files || []).map((f) => ({
        n: f.originalname, t: fileTypeFromName(f.originalname), src: 'upload', storedAs: f.filename,
      }));
      const merged = [...existing, ...added];
      await pool.request().input('id', id).input('files', JSON.stringify(merged))
        .query('UPDATE dbo.MC_Entries SET FilesJson=@files, UpdatedAt=GETDATE() WHERE Id=@id');
      await audit(pool, loginId, 'File upload', `${row.NfaNo}: ${added.map((f) => f.n).join(', ')}`);
      res.json({ ok: true, added });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Upload files with no entry yet — staged for the next Fetch/Mode-B --
  // In-memory per-login staging area (dev-scale; fine for a single-process
  // deployment). Cleared once consumed by fetch/mode-b.
  const stagedByUser = new Map();
  router.post('/stage-files', upload.array('files', 10), async (req, res) => {
    const { loginId } = currentUser(req);
    const added = (req.files || []).map((f) => ({
      n: f.originalname, t: fileTypeFromName(f.originalname), src: 'upload', storedAs: f.filename,
    }));
    const cur = stagedByUser.get(loginId) || [];
    stagedByUser.set(loginId, [...cur, ...added]);
    res.json({ ok: true, staged: stagedByUser.get(loginId) });
  });
  router.get('/stage-files', async (req, res) => {
    const { loginId } = currentUser(req);
    res.json({ staged: stagedByUser.get(loginId) || [] });
  });
  router.delete('/stage-files', async (req, res) => {
    const { loginId } = currentUser(req);
    stagedByUser.delete(loginId);
    res.json({ ok: true });
  });
  // Expose so /fetch and /mode-b can pull + clear the staged set.
  router._takeStaged = (loginId) => {
    const s = stagedByUser.get(loginId) || [];
    stagedByUser.delete(loginId);
    return s;
  };

  // ---- List "My Entries" (Entry Date View — B3/F14) ----------------------
  router.get('/', async (req, res) => {
    const { loginId, role } = currentUser(req);
    const dateView = req.query.dateView || 'today';
    try {
      const pool = await getPool();
      const today = todayISO();
      let query = `SELECT e.*, pm.Id AS PmId, pm.ToIndexName, pm.ToWorkType, pm.ToReviewDate,
                          pm.FromIndexName, pm.FromReviewDate, pm.FieldsJson AS PmFieldsJson
                   FROM dbo.MC_Entries e
                   LEFT JOIN dbo.MC_PendingMoves pm ON pm.EntryId = e.Id AND pm.Status='pending'
                   WHERE 1=1 `;
      if (role !== 'admin') {
        query += ` AND (e.EnteredBy=@who OR e.InitiatedBy=@who) `;
      }
      if (dateView === 'today') {
        query += ` AND (e.ReviewDate >= @today OR (e.Status IN ('approved','rejected','expired') AND CAST(e.UpdatedAt AS DATE)=@today)) `;
      } else {
        query += ` AND e.ReviewDate = @dateView `;
      }
      query += ` ORDER BY e.ReviewDate, e.Id`;

      const request = pool.request().input('today', today).input('dateView', dateView);
      if (role !== 'admin') request.input('who', loginId);
      const r = await request.query(query);

      const entries = r.recordset.map((row) => {
        const e = rowToEntry(row);
        if (row.PmId) {
          e.pmv = {
            id: row.PmId,
            index: row.ToIndexName,
            wt: row.ToWorkType,
            date: row.ToReviewDate.toISOString().slice(0, 10),
            fromIndex: row.FromIndexName,
            fromDate: row.FromReviewDate.toISOString().slice(0, 10),
          };
        }
        return e;
      });
      res.json(entries);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Fetch from QMS (Mode A: create OR re-pull OR stage pending-move) --
  router.post('/fetch', async (req, res) => {
    const { loginId } = currentUser(req);
    const { nfa, index, wt, date } = req.body;
    if (!nfa || !index || !wt || !date) return res.status(400).json({ error: 'nfa, index, wt, date are required' });

    try {
      const pool = await getPool();
      const qmsRec = await lookupNfa(nfa);
      if (!qmsRec) {
        return res.status(404).json({ error: 'NFA not found in QMS', offerModeB: true });
      }

      const targetSheet = await getSheet(pool, index, date);
      if (targetSheet.PublishedRev > 0) {
        return res.status(409).json({ error: 'published; the date is closed' });
      }

      const open = await getOpenEntryForNfa(pool, nfa);

      if (!open) {
        const priorPub = await pool.request().input('nfa', nfa)
          .query(`SELECT TOP 1 sr.* FROM dbo.MC_SnapshotRows sr WHERE sr.NfaNo=@nfa AND sr.Decision IS NOT NULL ORDER BY sr.Id DESC`);
        const resubReq = priorPub.recordset.length > 0;

        const fields = { ...qmsRec };
        const hyb = hybridInit(qmsRec);
        const staged = router._takeStaged(loginId);
        const allFiles = [...qmsRec.files.map((f) => ({ ...f, src: 'qms' })), ...staged];
        const ins = await pool.request()
          .input('nfa', nfa).input('mode', 'A').input('idx', index).input('wt', wt).input('d', date)
          .input('fields', JSON.stringify(fields)).input('hyb', JSON.stringify(hyb))
          .input('files', JSON.stringify(allFiles))
          .input('initiator', qmsRec.initiator).input('isProxy', qmsRec.initiator !== loginId ? 1 : 0)
          .input('initDt', qmsRec.initDt).input('enteredBy', loginId)
          .input('resubReq', resubReq ? 1 : 0)
          .query(`INSERT INTO dbo.MC_Entries
                    (NfaNo, Mode, IndexName, WorkType, ReviewDate, FieldsJson, HybridJson, FilesJson,
                     InitiatedBy, IsProxy, InitiatedOn, EnteredBy, Status, ResubRequired)
                  OUTPUT INSERTED.Id
                  VALUES (@nfa, @mode, @idx, @wt, @d, @fields, @hyb, @files,
                          @initiator, @isProxy, @initDt, @enteredBy, 'draft', @resubReq)`);
        const newId = ins.recordset[0].Id;
        await audit(pool, loginId, 'NFA fetched (new draft)', `${nfa} -> ${index}/${wt}/${date}`);
        const row = await getEntryRow(pool, newId);
        return res.json({ created: true, entry: rowToEntry(row) });
      }

      const sameSlot = open.IndexName === index && open.WorkType === wt
        && open.ReviewDate.toISOString().slice(0, 10) === date;

      if (sameSlot) {
        const existingFiles = JSON.parse(open.FilesJson || '[]');
        let restored = 0, replaced = 0;
        const byName = new Map(existingFiles.map((f) => [f.n, f]));
        qmsRec.files.forEach((f) => {
          const cur = byName.get(f.n);
          if (!cur) { byName.set(f.n, { ...f, src: 'qms' }); restored++; }
          else if (cur.src === 'qms') { byName.set(f.n, { ...f, src: 'qms' }); replaced++; }
        });
        const mergedFiles = Array.from(byName.values());

        const onLockedSheet = targetSheet.Locked;
        const newStatus = onLockedSheet ? 'submitted' : open.Status;
        const newSelected = onLockedSheet ? 0 : (open.Status === 'draft' ? 0 : open.Selected);

        await pool.request().input('id', open.Id)
          .input('fields', JSON.stringify(qmsRec))
          .input('files', JSON.stringify(mergedFiles))
          .input('status', newStatus).input('selected', newSelected)
          .query(`UPDATE dbo.MC_Entries SET FieldsJson=@fields, FilesJson=@files,
                    Status=@status, Selected=@selected, UpdatedAt=GETDATE() WHERE Id=@id`);

        await pool.request().input('id', open.Id)
          .query(`UPDATE dbo.MC_PendingMoves SET Status='cancelled' WHERE EntryId=@id AND Status='pending'`);

        await audit(pool, loginId, 'NFA re-pulled', `${nfa} — replaced ${replaced}, restored ${restored}${onLockedSheet ? ' (locked sheet: auto-deselected)' : ''}`);
        const row = await getEntryRow(pool, open.Id);
        return res.json({ repull: true, replaced, restored, autoDeselected: !!onLockedSheet, entry: rowToEntry(row) });
      }

      if (open.Status === 'draft') {
        await pool.request().input('id', open.Id).input('idx', index).input('wt', wt).input('d', date)
          .query('UPDATE dbo.MC_Entries SET IndexName=@idx, WorkType=@wt, ReviewDate=@d, UpdatedAt=GETDATE() WHERE Id=@id');
        await audit(pool, loginId, 'Draft target changed', `${nfa} -> ${index}/${wt}/${date}`);
        const row = await getEntryRow(pool, open.Id);
        return res.json({ draftRetargeted: true, entry: rowToEntry(row) });
      }

      await pool.request().input('id', open.Id)
        .query(`UPDATE dbo.MC_PendingMoves SET Status='cancelled' WHERE EntryId=@id AND Status='pending'`);

      await pool.request()
        .input('entryId', open.Id)
        .input('fromIdx', open.IndexName).input('fromDate', open.ReviewDate)
        .input('toIdx', index).input('toWt', wt).input('toDate', date)
        .input('fields', JSON.stringify(qmsRec))
        .input('files', JSON.stringify(qmsRec.files.map((f) => ({ ...f, src: 'qms' }))))
        .query(`INSERT INTO dbo.MC_PendingMoves
                  (EntryId, FromIndexName, FromReviewDate, ToIndexName, ToWorkType, ToReviewDate, FieldsJson, FilesJson)
                VALUES (@entryId, @fromIdx, @fromDate, @toIdx, @toWt, @toDate, @fields, @files)`);

      await audit(pool, loginId, 'Pending-move ticket staged', `${nfa}: ${open.IndexName}·${open.ReviewDate.toISOString().slice(0, 10)} -> ${index}·${date} (submit to apply)`);
      const row = await getEntryRow(pool, open.Id);
      const pm = await findPendingMove(pool, open.Id);
      return res.json({
        pendingMoveStaged: true,
        entry: rowToEntry(row),
        pendingMove: {
          id: pm.Id, index: pm.ToIndexName, wt: pm.ToWorkType, date: pm.ToReviewDate.toISOString().slice(0, 10),
          fromIndex: pm.FromIndexName, fromDate: pm.FromReviewDate.toISOString().slice(0, 10),
        },
        chip: `Pending move from ${open.IndexName}·${open.ReviewDate.toISOString().slice(0, 10)} — submit to apply · previous entry still on Page 2.`,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Mode B: full manual form (F13 — no link-NFA control) ---------------
  router.post('/mode-b', async (req, res) => {
    const { loginId } = currentUser(req);
    const { index, wt, date, fields, initiator } = req.body;
    if (!index || !wt || !date) return res.status(400).json({ error: 'index, wt, date are required' });
    try {
      const pool = await getPool();
      const targetSheet = await getSheet(pool, index, date);
      if (targetSheet.PublishedRev > 0) return res.status(409).json({ error: 'published; the date is closed' });

      const seqR = await pool.request().query(`
        SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(InterimRef, 9, 10) AS INT)), 0) + 1 AS nextSeq
        FROM dbo.MC_Entries WHERE InterimRef LIKE 'EM/%'`);
      const seqNo = seqR.recordset[0].nextSeq;
      const now = new Date();
      const yy = String(now.getFullYear()).slice(2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const interimRef = `EM/${mm}-${yy}/${String(seqNo).padStart(3, '0')}`;
      const nfaNo = interimRef;

      const ins = await pool.request()
        .input('nfa', nfaNo).input('idx', index).input('wt', wt).input('d', date)
        .input('fields', JSON.stringify(fields || {})).input('hyb', JSON.stringify({}))
        .input('files', JSON.stringify(router._takeStaged(loginId)))
        .input('initiator', initiator || loginId).input('isProxy', (initiator && initiator !== loginId) ? 1 : 0)
        .input('interimRef', interimRef).input('enteredBy', loginId)
        .query(`INSERT INTO dbo.MC_Entries
                  (NfaNo, Mode, IndexName, WorkType, ReviewDate, FieldsJson, HybridJson, FilesJson,
                   InitiatedBy, IsProxy, InterimRef, EnteredBy, Status)
                OUTPUT INSERTED.Id
                VALUES (@nfa, 'B', @idx, @wt, @d, @fields, @hyb, @files, @initiator, @isProxy, @interimRef, @enteredBy, 'draft')`);
      await audit(pool, loginId, 'Mode B entry created', `${interimRef} -> ${index}/${wt}/${date}`);
      const row = await getEntryRow(pool, ins.recordset[0].Id);
      res.json({ created: true, entry: rowToEntry(row) });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Checkbox toggle (pre-submit selection) -----------------------------
  router.post('/:id/select', async (req, res) => {
    const { selected } = req.body;
    try {
      const pool = await getPool();
      await pool.request().input('id', req.params.id).input('sel', selected ? 1 : 0)
        .query('UPDATE dbo.MC_Entries SET Selected=@sel, UpdatedAt=GETDATE() WHERE Id=@id');
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Delete an entry outright — only while it's still draft/submitted; --
  // once presented/decided it's real workflow history and must not be
  // removable (use Withdraw on Page 1 or a decision on Page 3 instead).
  router.delete('/:id', async (req, res) => {
    const { loginId } = currentUser(req);
    const id = Number(req.params.id);
    try {
      const pool = await getPool();
      const row = await getEntryRow(pool, id);
      if (!row) return res.status(404).json({ error: 'Entry not found' });
      if (!['draft', 'submitted'].includes(row.Status)) {
        return res.status(409).json({ error: `Cannot delete a ${row.Status} entry — it's already part of workflow history` });
      }
      const pm = await findPendingMove(pool, id);
      if (pm) {
        await pool.request().input('id', pm.Id).query(`UPDATE dbo.MC_PendingMoves SET Status='cancelled' WHERE Id=@id`);
      }
      await pool.request().input('id', id).query('DELETE FROM dbo.MC_Entries WHERE Id=@id');
      await audit(pool, loginId, 'Entry deleted', `${row.NfaNo} (was ${row.Status})`);
      res.json({ deleted: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Submit: pushes checked set to Page 2, applies pending moves --------
  router.post('/:id/submit', async (req, res) => {
    const { loginId } = currentUser(req);
    const { comment } = req.body;
    const id = Number(req.params.id);
    try {
      const pool = await getPool();
      const open = await getEntryRow(pool, id);
      if (!open) return res.status(404).json({ error: 'Entry not found' });

      const pm = await findPendingMove(pool, id);

      if (pm) {
        const fromSheet = await getSheet(pool, open.IndexName, open.ReviewDate.toISOString().slice(0, 10));
        const toDateISO = pm.ToReviewDate.toISOString().slice(0, 10);
        const toSheet = await getSheet(pool, pm.ToIndexName, toDateISO);

        if (fromSheet.PublishedRev > 0) {
          if (!comment || !comment.trim()) {
            return res.status(409).json({
              error: 'Old date has published while this move was pending — this converts to a fresh entry and requires a mandatory resubmission comment.',
              requiresComment: true,
            });
          }
          await pool.request().input('id', pm.Id).query(`UPDATE dbo.MC_PendingMoves SET Status='cancelled' WHERE Id=@id`);
          await pool.request().input('id', id).input('idx', pm.ToIndexName).input('wt', pm.ToWorkType).input('d', toDateISO)
            .input('comment', comment).input('fields', pm.FieldsJson).input('files', pm.FilesJson)
            .query(`UPDATE dbo.MC_Entries SET IndexName=@idx, WorkType=@wt, ReviewDate=@d, FieldsJson=@fields,
                      FilesJson=@files, ResubComment=@comment, ResubRequired=1, Status='draft', Selected=0, UpdatedAt=GETDATE() WHERE Id=@id`);
          await audit(pool, loginId, 'Pending-move converted to fresh entry', `${open.NfaNo}: old date published mid-pending`);
          const row = await getEntryRow(pool, id);
          return res.json({ convertedToFreshEntry: true, entry: rowToEntry(row) });
        }

        if (toSheet.PublishedRev > 0) {
          return res.status(409).json({ error: 'Target date has published — pending move refused; ticket stays editable.' });
        }

        if (open.Status === 'presented') {
          const snap = await pool.request().input('entryId', id)
            .query(`SELECT TOP 1 * FROM dbo.MC_SnapshotRows WHERE EntryId=@entryId ORDER BY Id DESC`);
          if (snap.recordset[0] && snap.recordset[0].Decision) {
            return res.status(409).json({
              error: 'already reviewed in MC — outcome will publish; re-present via a fresh entry after the PDF (O7). The MC operator can clear the decision to release this move.',
            });
          }
        }

        const wasPresented = open.Status === 'presented';
        await pool.request().input('id', pm.Id).query(`UPDATE dbo.MC_PendingMoves SET Status='applied' WHERE Id=@id`);
        await pool.request().input('id', id).input('idx', pm.ToIndexName).input('wt', pm.ToWorkType).input('d', toDateISO)
          .input('fields', pm.FieldsJson).input('files', pm.FilesJson)
          .query(`UPDATE dbo.MC_Entries SET IndexName=@idx, WorkType=@wt, ReviewDate=@d, FieldsJson=@fields,
                    FilesJson=@files, Status='submitted', Selected=0, UpdatedAt=GETDATE() WHERE Id=@id`);

        if (wasPresented) {
          await pool.request().input('entryId', id).input('idx1', open.IndexName).input('d1', open.ReviewDate)
            .input('rel', `${pm.ToIndexName}·${toDateISO}`)
            .query(`UPDATE dbo.MC_SnapshotRows SET RelocatedTo=@rel, RelocatedAt=GETDATE()
                      WHERE EntryId=@entryId AND SheetId=(SELECT TOP 1 Id FROM dbo.MC_Sheets WHERE IndexName=@idx1 AND ReviewDate=@d1)`);
        }

        await audit(pool, loginId, 'Entry relocated (submit-gated)',
          `${open.IndexName}·${open.ReviewDate.toISOString().slice(0, 10)} -> ${pm.ToIndexName}·${toDateISO}`);
        const row = await getEntryRow(pool, id);
        return res.json({ relocated: true, entry: rowToEntry(row) });
      }

      const sheetDate = open.ReviewDate.toISOString().slice(0, 10);
      const targetSheet = await getSheet(pool, open.IndexName, sheetDate);
      if (targetSheet.PublishedRev > 0) return res.status(409).json({ error: 'published; the date is closed' });

      if (!open.Selected) {
        await pool.request().input('id', id)
          .query(`UPDATE dbo.MC_Entries SET Status='draft', PresentToMC=0, UpdatedAt=GETDATE() WHERE Id=@id`);
        await audit(pool, loginId, 'Entry withdrawn', open.NfaNo);
        const row = await getEntryRow(pool, id);
        return res.json({ withdrawn: true, entry: rowToEntry(row) });
      }

      const landsDeselected = targetSheet.Locked;
      await pool.request().input('id', id).input('status', 'submitted').input('sel', landsDeselected ? 0 : 1)
        .query(`UPDATE dbo.MC_Entries SET Status=@status, Selected=@sel, UpdatedAt=GETDATE() WHERE Id=@id`);
      await audit(pool, loginId, 'Entry submitted', `${open.NfaNo} -> Page 2 (${sheetDate})${landsDeselected ? ' [locked sheet: auto-deselected]' : ''}`);
      const row = await getEntryRow(pool, id);
      res.json({ submitted: true, autoDeselected: !!landsDeselected, entry: rowToEntry(row) });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Hybrid Pick-from-NFA field edit ------------------------------------
  router.post('/:id/field', async (req, res) => {
    const { field, pfn, userValue } = req.body;
    const id = Number(req.params.id);
    try {
      const pool = await getPool();
      const row = await getEntryRow(pool, id);
      if (!row) return res.status(404).json({ error: 'Entry not found' });
      const hyb = JSON.parse(row.HybridJson || '{}');
      hyb[field] = hyb[field] || { pfn: true, qms: '', user: null };
      if (typeof pfn === 'boolean') hyb[field].pfn = pfn;
      if (typeof userValue === 'string') hyb[field].user = userValue;
      await pool.request().input('id', id).input('hyb', JSON.stringify(hyb))
        .query('UPDATE dbo.MC_Entries SET HybridJson=@hyb, UpdatedAt=GETDATE() WHERE Id=@id');
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Plain (non-hybrid) dropdown fields: NFA Initiated By, Validation of Rates --
  router.post('/:id/plain-field', async (req, res) => {
    const { field, value } = req.body; // field: 'initBy' | 'rateVal'
    const id = Number(req.params.id);
    if (!['initBy', 'rateVal'].includes(field)) return res.status(400).json({ error: 'Unsupported field' });
    try {
      const pool = await getPool();
      const row = await getEntryRow(pool, id);
      if (!row) return res.status(404).json({ error: 'Entry not found' });
      const fields = JSON.parse(row.FieldsJson || '{}');
      fields[field] = value;
      await pool.request().input('id', id).input('fields', JSON.stringify(fields))
        .query('UPDATE dbo.MC_Entries SET FieldsJson=@fields, UpdatedAt=GETDATE() WHERE Id=@id');
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Mandatory resubmission comment (entry editor, resub-flagged entries) --
  router.post('/:id/resub-comment', async (req, res) => {
    const { comment } = req.body;
    const id = Number(req.params.id);
    try {
      const pool = await getPool();
      await pool.request().input('id', id).input('c', comment)
        .query('UPDATE dbo.MC_Entries SET ResubComment=@c, UpdatedAt=GETDATE() WHERE Id=@id');
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Remove a single attached file by index (deselect, B7-compatible) --
  router.post('/:id/files/remove', async (req, res) => {
    const { index: fileIndex } = req.body;
    const id = Number(req.params.id);
    try {
      const pool = await getPool();
      const row = await getEntryRow(pool, id);
      if (!row) return res.status(404).json({ error: 'Entry not found' });
      const files = JSON.parse(row.FilesJson || '[]');
      files.splice(fileIndex, 1);
      await pool.request().input('id', id).input('files', JSON.stringify(files))
        .query('UPDATE dbo.MC_Entries SET FilesJson=@files, UpdatedAt=GETDATE() WHERE Id=@id');
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
