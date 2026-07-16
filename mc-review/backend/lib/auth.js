/**
 * Auth model: mirrors the existing SmartDesk trust pattern — the client
 * sends `x-user-role` / `x-user-id`, and routes gate on them. Lightweight,
 * not hardened auth; fine for an internal portal (I4 — real AD/SSO is a
 * separate IT lane). Do not expose this service to the public internet.
 */
function currentUser(req) {
  const loginId = req.header('x-user-id') || 'unknown';
  const role = req.header('x-user-role') || 'user';
  return { loginId, role };
}

function requireRole(...roles) {
  return (req, res, next) => {
    const { role } = currentUser(req);
    if (!roles.includes(role)) {
      return res.status(403).json({ error: `Forbidden — requires role: ${roles.join(' or ')}` });
    }
    next();
  };
}

// Reviewer for a specific index, or admin.
function requireReviewerOf(indexName) {
  return (req, res, next) => {
    const { role } = currentUser(req);
    const map = { MEP: 'revMEP', CIVIL: 'revCIV' };
    if (role === 'admin' || role === map[indexName]) return next();
    return res.status(403).json({ error: `Forbidden — requires reviewer of ${indexName} or admin` });
  };
}

async function audit(pool, loginId, action, detail) {
  await pool.request()
    .input('loginId', loginId)
    .input('action', action)
    .input('detail', detail || null)
    .query(`INSERT INTO dbo.MC_AuditLog(LoginId, Action, Detail) VALUES (@loginId, @action, @detail)`);
}

module.exports = { currentUser, requireRole, requireReviewerOf, audit };
