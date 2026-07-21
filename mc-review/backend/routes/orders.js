const express = require('express');
const sql = require('mssql');
const { currentUser, audit } = require('../lib/auth');
const { mmyyFromISO, todayISO } = require('../lib/reference');

/**
 * Page 4 — Order Numbering. Implements the P4 Order-Number Syntax doc v1.0
 * verbatim:
 *   - Interim syntax ORD/{MEP|CIV}/MMYY-#### (§1); MMYY from the SERVER
 *     date at allocation time (issue-month, never the NFA's review/approval
 *     month — §1.1, I10/F9).
 *   - Per-index monotonic sequence, DB-allocated inside the same
 *     transaction as the insert, collision-safe against BOTH the live
 *     register and the permanent retired ledger (§1.2, §3, checklist #9).
 *   - Retire-forever (O1 OPEN — do not decide it): deletion is permanent
 *     along every allocation path; the release-policy switch is a config
 *     value only, with no release path wired (§4).
 */
module.exports = function ordersRoutes(getPool) {
  const router = express.Router();

  const idxToken = (indexName) => (indexName === 'MEP' ? 'MEP' : 'CIV');

  async function isTaken(pool, orderNo) {
    const live = await pool.request().input('n', orderNo).query('SELECT 1 FROM dbo.MC_OrderRegister WHERE OrderNo=@n');
    if (live.recordset.length) return 'live';
    const retired = await pool.request().input('n', orderNo).query('SELECT 1 FROM dbo.MC_OrderRetired WHERE OrderNo=@n');
    if (retired.recordset.length) return 'retired';
    return null;
  }

  // Allocates N order numbers for one NFA/index inside a single transaction,
  // advancing the per-index sequence past any collision (manual overrides
  // ahead of the counter, or retired numbers) so no path ever mints a dupe.
  async function allocateOrders(pool, indexName, nfaNo, orderType, count, loginId) {
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const mmyy = mmyyFromISO(todayISO());
      const created = [];
      for (let i = 0; i < count; i++) {
        let candidate, seqVal;
        // Loop guards against a pathological run of collisions; DB uniqueness
        // constraints are the real backstop.
        for (let guard = 0; guard < 100000; guard++) {
          const seqR = await new sql.Request(tx).input('idx', indexName)
            .query('SELECT NextSeq FROM dbo.MC_OrderSeq WITH (UPDLOCK, HOLDLOCK) WHERE IndexName=@idx');
          seqVal = seqR.recordset[0].NextSeq;
          await new sql.Request(tx).input('idx', indexName).input('n', seqVal + 1)
            .query('UPDATE dbo.MC_OrderSeq SET NextSeq=@n WHERE IndexName=@idx');
          candidate = `ORD/${idxToken(indexName)}/${mmyy}-${String(seqVal).padStart(4, '0')}`;
          const liveHit = await new sql.Request(tx).input('n', candidate).query('SELECT 1 FROM dbo.MC_OrderRegister WHERE OrderNo=@n');
          const retiredHit = await new sql.Request(tx).input('n', candidate).query('SELECT 1 FROM dbo.MC_OrderRetired WHERE OrderNo=@n');
          if (!liveHit.recordset.length && !retiredHit.recordset.length) break;
        }
        await new sql.Request(tx)
          .input('orderNo', candidate).input('idx', indexName).input('seqIndex', seqVal).input('mmyy', mmyy)
          .input('nfa', nfaNo).input('type', orderType).input('by', loginId)
          .query(`INSERT INTO dbo.MC_OrderRegister(OrderNo, IndexName, SeqIndex, Mmyy, NfaNo, OrderType, Vendor, IsOverride, GeneratedBy)
                  VALUES (@orderNo, @idx, @seqIndex, @mmyy, @nfa, @type, '', 0, @by)`);
        created.push(candidate);
      }
      await tx.commit();
      return created;
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  }

  // ---- List orders for an approved NFA ------------------------------------
  router.get('/nfa/:nfa', async (req, res) => {
    try {
      const pool = await getPool();
      const r = await pool.request().input('nfa', req.params.nfa)
        .query(`SELECT * FROM dbo.MC_OrderRegister WHERE NfaNo=@nfa AND Status='active' ORDER BY Id`);
      res.json(r.recordset);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- All orders (reviewer/admin) or own (user) --------------------------
  router.get('/', async (req, res) => {
    const { loginId, role } = currentUser(req);
    try {
      const pool = await getPool();
      let query = 'SELECT * FROM dbo.MC_OrderRegister WHERE Status=\'active\'';
      const request = pool.request();
      if (role === 'user') { query += ' AND GeneratedBy=@who'; request.input('who', loginId); }
      query += ' ORDER BY Id DESC';
      const r = await request.query(query);
      res.json(r.recordset);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Generate (default count 1; admin-configurable max) -----------------
  router.post('/generate', async (req, res) => {
    const { loginId } = currentUser(req);
    const { nfa, index, count, orderType } = req.body;
    if (!nfa || !index) return res.status(400).json({ error: 'nfa and index are required' });
    try {
      const pool = await getPool();
      const cfg = await pool.request().query(`SELECT [Value] FROM dbo.MC_Config WHERE [Key]='maxOrdersPerNfa'`);
      const maxOrders = Number(cfg.recordset[0]?.Value || 10);
      const n = Math.max(1, Math.min(Number(count) || 1, maxOrders));
      const created = await allocateOrders(pool, index, nfa, orderType || 'PO', n, loginId);
      await audit(pool, loginId, 'Orders generated', `${nfa} × ${n}`);
      res.json({ created });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Add more orders (B6) — one-line confirm happens client-side --------
  router.post('/add-more', async (req, res) => {
    const { loginId } = currentUser(req);
    const { nfa, index, count, orderType } = req.body;
    if (!nfa || !index) return res.status(400).json({ error: 'nfa and index are required' });
    try {
      const pool = await getPool();
      const cfg = await pool.request().query(`SELECT [Value] FROM dbo.MC_Config WHERE [Key]='maxOrdersPerNfa'`);
      const maxOrders = Number(cfg.recordset[0]?.Value || 10);
      const n = Math.max(1, Math.min(Number(count) || 1, maxOrders));
      const created = await allocateOrders(pool, index, nfa, orderType || 'PO', n, loginId);
      await audit(pool, loginId, 'Orders generated', `${nfa} × ${n} (add-more)`);
      res.json({ created });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Manual override (uniqueness + revert + audit) -----------------------
  router.post('/:id/override', async (req, res) => {
    const { loginId } = currentUser(req);
    const { newValue } = req.body;
    const id = Number(req.params.id);
    try {
      const pool = await getPool();
      const r = await pool.request().input('id', id).query('SELECT * FROM dbo.MC_OrderRegister WHERE Id=@id');
      const row = r.recordset[0];
      if (!row) return res.status(404).json({ error: 'Order not found' });

      if (!newValue || !newValue.trim()) {
        return res.status(400).json({ reverted: true, value: row.OrderNo }); // empty input -> revert, no audit
      }
      if (newValue === row.OrderNo) return res.json({ ok: true, value: row.OrderNo, unchanged: true });

      const clashLive = await pool.request().input('n', newValue).input('id', id)
        .query('SELECT 1 FROM dbo.MC_OrderRegister WHERE OrderNo=@n AND Id<>@id');
      if (clashLive.recordset.length) {
        return res.status(409).json({ reverted: true, value: row.OrderNo, error: `Order number must be unique — ${newValue} already exists` });
      }
      const clashRetired = await pool.request().input('n', newValue).query('SELECT 1 FROM dbo.MC_OrderRetired WHERE OrderNo=@n');
      if (clashRetired.recordset.length) {
        return res.status(409).json({
          reverted: true, value: row.OrderNo,
          error: `Order number ${newValue} was deleted earlier — retired, permanently unavailable (never re-issued)`,
        });
      }

      await pool.request().input('id', id).input('n', newValue)
        .query('UPDATE dbo.MC_OrderRegister SET OrderNo=@n, IsOverride=1 WHERE Id=@id');
      await audit(pool, loginId, 'Order no. override', `${row.NfaNo} -> ${newValue}`);
      res.json({ ok: true, value: newValue });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Vendor / order type edits ------------------------------------------
  router.post('/:id/vendor', async (req, res) => {
    const { vendor } = req.body;
    try {
      const pool = await getPool();
      await pool.request().input('id', req.params.id).input('v', vendor)
        .query('UPDATE dbo.MC_OrderRegister SET Vendor=@v WHERE Id=@id');
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/:id/type', async (req, res) => {
    const { orderType } = req.body;
    try {
      const pool = await getPool();
      await pool.request().input('id', req.params.id).input('t', orderType)
        .query('UPDATE dbo.MC_OrderRegister SET OrderType=@t WHERE Id=@id');
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Delete = permanent retirement (O1: retire-forever, do not decide) --
  router.delete('/:id', async (req, res) => {
    const { loginId } = currentUser(req);
    const { reason } = req.body || {};
    const id = Number(req.params.id);
    try {
      const pool = await getPool();
      const r = await pool.request().input('id', id).query('SELECT * FROM dbo.MC_OrderRegister WHERE Id=@id');
      const row = r.recordset[0];
      if (!row) return res.status(404).json({ error: 'Order not found' });

      const tx = new sql.Transaction(pool);
      await tx.begin();
      try {
        await new sql.Request(tx).input('id', id).query(`UPDATE dbo.MC_OrderRegister SET Status='retired' WHERE Id=@id`);
        await new sql.Request(tx).input('n', row.OrderNo).input('nfa', row.NfaNo).input('by', loginId).input('reason', reason || null)
          .query(`INSERT INTO dbo.MC_OrderRetired(OrderNo, OriginalNfaNo, RetiredBy, Reason) VALUES (@n, @nfa, @by, @reason)`);
        await tx.commit();
      } catch (e) { await tx.rollback(); throw e; }

      await audit(pool, loginId, 'Order number deleted', `${row.OrderNo} (${row.NfaNo}) — retired forever`);
      res.json({ deleted: true, orderNo: row.OrderNo });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Admin: max orders per NFA config -----------------------------------
  router.post('/config/max-orders', async (req, res) => {
    const { loginId, role } = currentUser(req);
    if (role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { value } = req.body;
    try {
      const pool = await getPool();
      await pool.request().input('v', String(value))
        .query(`UPDATE dbo.MC_Config SET [Value]=@v WHERE [Key]='maxOrdersPerNfa'`);
      await audit(pool, loginId, 'Max orders/NFA set', String(value));
      res.json({ ok: true, value });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/config', async (req, res) => {
    try {
      const pool = await getPool();
      const r = await pool.request().query('SELECT [Key], [Value] FROM dbo.MC_Config');
      const cfg = {};
      r.recordset.forEach((row) => { cfg[row.Key] = row.Value; });
      res.json(cfg);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Approved NFAs + their orders (Page 4 primary data source) ---------
  // Joins MC_Entries (status='approved') with any MC_OrderRegister rows so
  // the UI can render the prototype's rowspan table (NFA/project/desc/
  // vendor/value/MC-comment on the left, one row per generated order on
  // the right, zero orders shows a single "—" row).
  router.get('/approved-nfas', async (req, res) => {
    const { loginId, role } = currentUser(req);
    try {
      const pool = await getPool();
      let entryQuery = `SELECT e.Id, e.NfaNo, e.IndexName, e.WorkType, e.ReviewDate, e.FieldsJson, e.UpdatedAt
                         FROM dbo.MC_Entries e WHERE e.Status='approved'`;
      const request = pool.request();
      if (role === 'user') { entryQuery += ' AND (e.EnteredBy=@who OR e.InitiatedBy=@who)'; request.input('who', loginId); }
      entryQuery += ' ORDER BY e.UpdatedAt DESC';
      const entriesR = await request.query(entryQuery);

      // Pull the MC comment recorded at decision time from the snapshot row, if any.
      const nfas = entriesR.recordset.map((e) => e.NfaNo);
      let commentsByNfa = {};
      if (nfas.length) {
        const inClause = nfas.map((_, i) => `@nfa${i}`).join(',');
        const cReq = pool.request();
        nfas.forEach((n, i) => cReq.input(`nfa${i}`, n));
        const cRes = await cReq.query(`SELECT NfaNo, McComment FROM dbo.MC_SnapshotRows WHERE NfaNo IN (${inClause}) AND Decision='approved' ORDER BY Id DESC`);
        cRes.recordset.forEach((row) => { if (!commentsByNfa[row.NfaNo]) commentsByNfa[row.NfaNo] = row.McComment; });
      }

      const ordersR = await pool.request().query(`SELECT * FROM dbo.MC_OrderRegister WHERE Status='active' ORDER BY Id`);
      const ordersByNfa = {};
      ordersR.recordset.forEach((o) => { (ordersByNfa[o.NfaNo] = ordersByNfa[o.NfaNo] || []).push(o); });

      const result = entriesR.recordset.map((e) => {
        const f = JSON.parse(e.FieldsJson || '{}');
        return {
          nfa: e.NfaNo,
          index: e.IndexName,
          approvedOn: e.UpdatedAt,
          project: f.project, desc: f.desc, vendor: f.vendor, val: f.val,
          mcComment: commentsByNfa[e.NfaNo] || null,
          orders: ordersByNfa[e.NfaNo] || [],
        };
      });
      res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
