const express = require('express');

module.exports = function usersRoutes(getPool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const pool = await getPool();
      const r = await pool.request().query('SELECT LoginId, DisplayName, Role FROM dbo.MC_Users WHERE IsActive=1 ORDER BY DisplayName');
      res.json(r.recordset);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/me', async (req, res) => {
    const loginId = req.header('x-user-id') || 'unknown';
    const role = req.header('x-user-role') || 'user';
    try {
      const pool = await getPool();
      const r = await pool.request().input('loginId', loginId)
        .query('SELECT LoginId, DisplayName, Role FROM dbo.MC_Users WHERE LoginId=@loginId');
      const u = r.recordset[0] || { LoginId: loginId, DisplayName: loginId, Role: role };
      res.json(u);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
