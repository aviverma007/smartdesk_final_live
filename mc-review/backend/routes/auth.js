const express = require('express');
const bcrypt = require('bcryptjs');
const { currentUser, requireAuth, requireRole, audit, signToken } = require('../lib/auth');

/**
 * Login, change-password, and admin user/role management. All password
 * comparisons happen with bcrypt; nothing plain-text is ever stored or
 * logged. See db/migrate.js for the seeded credentials (4 accounts, one
 * per role) and the README for what they are.
 */
module.exports = function authRoutes(getPool) {
  const router = express.Router();

  // ---- Login: LoginId + password -> JWT ------------------------------------
  router.post('/login', async (req, res) => {
    const { loginId, password } = req.body;
    if (!loginId || !password) return res.status(400).json({ error: 'Login ID and password are required' });
    try {
      const pool = await getPool();
      const r = await pool.request().input('loginId', loginId)
        .query('SELECT * FROM dbo.MC_Users WHERE LoginId=@loginId AND IsActive=1');
      const user = r.recordset[0];
      // Same generic error whether the account doesn't exist or the
      // password is wrong — don't leak which one it was.
      if (!user || !user.PasswordHash) return res.status(401).json({ error: 'Invalid login ID or password' });
      const ok = await bcrypt.compare(password, user.PasswordHash);
      if (!ok) return res.status(401).json({ error: 'Invalid login ID or password' });

      const token = signToken(user);
      await audit(pool, user.LoginId, 'Login', null);
      res.json({
        token,
        user: { loginId: user.LoginId, displayName: user.DisplayName, role: user.Role, mustChangePassword: !!user.MustChangePassword },
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Who am I (validates the current token) -----------------------------
  router.get('/me', requireAuth, async (req, res) => {
    const { loginId, role, displayName } = currentUser(req);
    try {
      const pool = await getPool();
      const r = await pool.request().input('loginId', loginId)
        .query('SELECT LoginId, DisplayName, Role, MustChangePassword FROM dbo.MC_Users WHERE LoginId=@loginId');
      const user = r.recordset[0];
      if (!user) return res.status(401).json({ error: 'Account no longer exists' });
      res.json({ loginId: user.LoginId, displayName: user.DisplayName, role: user.Role, mustChangePassword: !!user.MustChangePassword });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Change my own password ----------------------------------------------
  router.post('/change-password', requireAuth, async (req, res) => {
    const { loginId } = currentUser(req);
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    try {
      const pool = await getPool();
      const r = await pool.request().input('loginId', loginId).query('SELECT * FROM dbo.MC_Users WHERE LoginId=@loginId');
      const user = r.recordset[0];
      if (!user) return res.status(404).json({ error: 'Account not found' });
      // Skip the current-password check only for a forced first-login change
      // (MustChangePassword=1) coming right off a fresh seed/reset — the
      // temp password was just used to log in a moment ago in that flow.
      if (!user.MustChangePassword) {
        if (!currentPassword) return res.status(400).json({ error: 'Current password is required' });
        const ok = await bcrypt.compare(currentPassword, user.PasswordHash || '');
        if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
      }
      const hash = await bcrypt.hash(newPassword, 10);
      await pool.request().input('loginId', loginId).input('hash', hash)
        .query('UPDATE dbo.MC_Users SET PasswordHash=@hash, MustChangePassword=0 WHERE LoginId=@loginId');
      await audit(pool, loginId, 'Password changed', null);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Admin: list all accounts --------------------------------------------
  router.get('/users', requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const pool = await getPool();
      const r = await pool.request()
        .query('SELECT Id, LoginId, DisplayName, Role, IsActive, MustChangePassword, CreatedAt FROM dbo.MC_Users ORDER BY Id');
      res.json(r.recordset);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Admin: change a user's role -----------------------------------------
  router.post('/users/:loginId/role', requireAuth, requireRole('admin'), async (req, res) => {
    const { loginId: actorId } = currentUser(req);
    const { loginId } = req.params;
    const { role } = req.body;
    if (!['user', 'revMEP', 'revCIV', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    try {
      const pool = await getPool();
      await pool.request().input('loginId', loginId).input('role', role)
        .query('UPDATE dbo.MC_Users SET Role=@role WHERE LoginId=@loginId');
      await audit(pool, actorId, 'Role changed', `${loginId} -> ${role}`);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Admin: reset a user's password (forces change on next login) -------
  router.post('/users/:loginId/reset-password', requireAuth, requireRole('admin'), async (req, res) => {
    const { loginId: actorId } = currentUser(req);
    const { loginId } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    try {
      const pool = await getPool();
      const hash = await bcrypt.hash(newPassword, 10);
      await pool.request().input('loginId', loginId).input('hash', hash)
        .query('UPDATE dbo.MC_Users SET PasswordHash=@hash, MustChangePassword=1 WHERE LoginId=@loginId');
      await audit(pool, actorId, 'Password reset by admin', loginId);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Admin: activate/deactivate an account -------------------------------
  router.post('/users/:loginId/active', requireAuth, requireRole('admin'), async (req, res) => {
    const { loginId: actorId } = currentUser(req);
    const { loginId } = req.params;
    const { isActive } = req.body;
    try {
      const pool = await getPool();
      await pool.request().input('loginId', loginId).input('active', isActive ? 1 : 0)
        .query('UPDATE dbo.MC_Users SET IsActive=@active WHERE LoginId=@loginId');
      await audit(pool, actorId, isActive ? 'Account reactivated' : 'Account deactivated', loginId);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- Admin: create a new account -----------------------------------------
  router.post('/users', requireAuth, requireRole('admin'), async (req, res) => {
    const { loginId: actorId } = currentUser(req);
    const { loginId, displayName, role, password } = req.body;
    if (!loginId || !displayName || !role || !password) {
      return res.status(400).json({ error: 'loginId, displayName, role, and password are all required' });
    }
    if (!['user', 'revMEP', 'revCIV', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    try {
      const pool = await getPool();
      const existing = await pool.request().input('loginId', loginId).query('SELECT 1 FROM dbo.MC_Users WHERE LoginId=@loginId');
      if (existing.recordset.length) return res.status(409).json({ error: 'That login ID already exists' });
      const hash = await bcrypt.hash(password, 10);
      await pool.request().input('loginId', loginId).input('displayName', displayName).input('role', role).input('hash', hash)
        .query(`INSERT INTO dbo.MC_Users(LoginId, DisplayName, Role, PasswordHash, MustChangePassword)
                VALUES (@loginId, @displayName, @role, @hash, 1)`);
      await audit(pool, actorId, 'Account created', `${loginId} (${role})`);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
