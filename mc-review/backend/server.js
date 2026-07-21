/**
 * MC Review Dashboard — backend server.
 *
 * Four-page workflow: NFA Entry -> Pre-meeting Review -> MC Meeting ->
 * Order Numbering. See ../docs/ for the full Workflow Definition v2.5 and
 * the P4 Order-Number Syntax v1.0 that this server implements.
 *
 * Auth model mirrors the existing SmartDesk trust pattern: the client sends
 * `x-user-role` / `x-user-id`; routes gate on them. Lightweight, not
 * hardened auth (I4 — real AD/SSO is a separate IT lane).
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const path = require('path');

const { migrate } = require('./db/migrate');

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'x-user-role', 'x-user-id'] }));
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'SmartDeskApp',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  options: { trustServerCertificate: true, enableArithAbort: true, encrypt: false },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

let pool;
async function getPool() {
  if (!pool) {
    pool = await sql.connect(dbConfig);
    await migrate(pool);
  }
  return pool;
}

app.get('/api/health', async (req, res) => {
  try {
    await getPool();
    res.json({ ok: true, service: 'mc-review-backend', time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.use('/api/users', require('./routes/users')(getPool));
app.use('/api/entries', require('./routes/entries')(getPool));
app.use('/api/sheets', require('./routes/sheets')(getPool));
app.use('/api/meeting', require('./routes/meeting')(getPool));
app.use('/api/orders', require('./routes/orders')(getPool));
app.use('/api/pdf', require('./routes/pdf')(getPool));
app.use('/api', require('./routes/misc')(getPool));

const PORT = process.env.PORT || 5094;
app.listen(PORT, () => {
  console.log(`MC Review backend listening on :${PORT}`);
});
