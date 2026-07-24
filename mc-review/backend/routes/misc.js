const express = require('express');
const { WORK_TYPES, INDEX_NAMES, ORDER_TYPES, RATE_VALIDATIONS, INITIATED_BY_OPTIONS } = require('../lib/reference');
const { listAll } = require('../lib/qmsAdapter');

module.exports = function miscRoutes(getPool) {
  const router = express.Router();

  // ---- Reference data for dropdowns/labels --------------------------------
  router.get('/reference', (req, res) => {
    res.json({ workTypes: WORK_TYPES, indexNames: INDEX_NAMES, orderTypes: ORDER_TYPES, rateValidations: RATE_VALIDATIONS, initiatedByOptions: INITIATED_BY_OPTIONS });
  });

  // ---- All NFAs currently in the QMS feed (Page-1 "All NFAs" browse tab) --
  router.get('/qms/all-nfas', async (req, res) => {
    try {
      const nfas = await listAll();
      res.json(nfas);
    } catch (e) {
      res.status(502).json({ error: `QMS feed unavailable: ${e.message}` });
    }
  });

  // ---- Audit trail (admin-viewable; §9.4) ---------------------------------
  router.get('/audit', async (req, res) => {
    try {
      const pool = await getPool();
      const r = await pool.request().query('SELECT TOP 500 * FROM dbo.MC_AuditLog ORDER BY Id DESC');
      res.json(r.recordset);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Per-NFA search & history (timeline across sittings + PDFs) --------
  router.get('/search/:nfa', async (req, res) => {
    const { nfa } = req.params;
    try {
      const pool = await getPool();
      const entries = await pool.request().input('nfa', nfa)
        .query('SELECT * FROM dbo.MC_Entries WHERE NfaNo=@nfa ORDER BY Id DESC');
      const snapshots = await pool.request().input('nfa', nfa)
        .query('SELECT * FROM dbo.MC_SnapshotRows WHERE NfaNo=@nfa ORDER BY Id DESC');
      const orders = await pool.request().input('nfa', nfa)
        .query(`SELECT * FROM dbo.MC_OrderRegister WHERE NfaNo=@nfa AND Status='active' ORDER BY Id`);
      res.json({
        entries: entries.recordset,
        history: snapshots.recordset,
        orders: orders.recordset,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
