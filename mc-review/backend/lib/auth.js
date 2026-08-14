/**
 * Auth model: real login (bcrypt password + JWT session token). The
 * frontend logs in once, gets a signed token, and sends it as
 * `Authorization: Bearer <token>` on every request from then on.
 * `currentUser()` verifies that token and returns the identity encoded in
 * it — nothing is trusted from the client beyond the token's signature.
 *
 * The old `x-user-role`/`x-user-id` headers are kept as a fallback ONLY
 * for the seed script and any other trusted server-to-server caller that
 * has no session (see requireAuth's comment below) — real user traffic
 * from the frontend always goes through the token.
 */
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'mc-review-dev-secret-change-in-prod';
const TOKEN_TTL = '12h';

function signToken(user) {
  return jwt.sign({ loginId: user.LoginId, role: user.Role, displayName: user.DisplayName }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function currentUser(req) {
  const authHeader = req.header('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      return { loginId: payload.loginId, role: payload.role, displayName: payload.displayName, authenticated: true };
    } catch (e) {
      // Falls through to header fallback below (e.g. an expired token) —
      // routes that require real auth should use requireAuth() to reject
      // this case explicitly rather than silently trusting headers.
    }
  }
  // Fallback for trusted server-side callers only (seed script etc.) —
  // never reachable from the public frontend once requireAuth() is applied.
  const loginId = req.header('x-user-id') || 'unknown';
  const role = req.header('x-user-role') || 'user';
  return { loginId, role, authenticated: false };
}

// Rejects any request without a valid, unexpired token. Apply this to
// every route except /api/auth/login itself.
function requireAuth(req, res, next) {
  const u = currentUser(req);
  if (!u.authenticated) return res.status(401).json({ error: 'Not authenticated — please log in' });
  next();
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

module.exports = { currentUser, requireAuth, requireRole, requireReviewerOf, audit, signToken, JWT_SECRET };
