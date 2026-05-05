const express = require('express');
const sql = require('mssql');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ── SQL Server Config ─────────────────────────────────────────────────────────
const config = {
  user: 'smartdesk_user',
  password: 'SmartDesk@2026',
  server: '192.168.66.33',
  database: 'etimetracklite1AI',
  options: { trustServerCertificate: true, enableArithAbort: true, encrypt: false },
  port: 1433,
  connectionTimeout: 30000,
  requestTimeout: 30000,
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

let pool;
async function getPool() {
  if (!pool) pool = await sql.connect(config);
  return pool;
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await getPool();
    res.json({ success: true, message: 'Connected!', server: config.server, database: config.database });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Summary for a date ────────────────────────────────────────────────────────
// Columns: DeviceLogId, DownloadDate, DeviceId, UserId, LogDate, Direction, AttDirection
app.get('/api/attendance/summary', async (req, res) => {
  try {
    const p = await getPool();
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const r = await p.request().input('date', sql.Date, date).query(`
      SELECT
        COUNT(DISTINCT UserId)                                                    AS totalPresent,
        COUNT(DISTINCT CASE WHEN Direction = 'in'  THEN UserId END)              AS currentlyIn,
        COUNT(DISTINCT CASE WHEN Direction = 'out' THEN UserId END)              AS checkedOut,
        MIN(LogDate)                                                              AS firstCheckIn,
        MAX(LogDate)                                                              AS lastCheckIn,
        COUNT(*)                                                                  AS totalPunches
      FROM dbo.vw_DeviceLogs_All
      WHERE CAST(LogDate AS DATE) = @date
    `);
    res.json({ success: true, date, summary: r.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Per-employee attendance ───────────────────────────────────────────────────
app.get('/api/attendance', async (req, res) => {
  try {
    const p = await getPool();
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const r = await p.request().input('date', sql.Date, date).query(`
      SELECT
        UserId                                                  AS empCode,
        MIN(LogDate)                                            AS inTime,
        MAX(LogDate)                                            AS outTime,
        COUNT(*)                                                AS totalPunches,
        DATEDIFF(MINUTE, MIN(LogDate), MAX(LogDate))            AS workMinutes,
        CASE
          WHEN COUNT(*) > 1 THEN 'Present'
          ELSE 'Present'
        END                                                     AS status
      FROM dbo.vw_DeviceLogs_All
      WHERE CAST(LogDate AS DATE) = @date
      GROUP BY UserId
      ORDER BY MIN(LogDate)
    `);
    res.json({ success: true, date, count: r.recordset.length, data: r.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Live today ────────────────────────────────────────────────────────────────
app.get('/api/attendance/live', async (req, res) => {
  try {
    const p = await getPool();
    const today = new Date().toISOString().split('T')[0];
    const r = await p.request().input('date', sql.Date, today).query(`
      SELECT
        COUNT(DISTINCT UserId)                        AS presentCount,
        CONVERT(VARCHAR(23), MAX(LogDate), 126)       AS lastCheckIn,
        COUNT(*)                AS totalPunches
      FROM dbo.vw_DeviceLogs_All
      WHERE CAST(LogDate AS DATE) = @date
    `);
    res.json({ success: true, timestamp: new Date(), live: r.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Department breakdown (using AttDirection / Direction for in/out) ───────────
app.get('/api/attendance/departments', async (req, res) => {
  try {
    const p = await getPool();
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const r = await p.request().input('date', sql.Date, date).query(`
      SELECT
        DeviceId                  AS department,
        COUNT(DISTINCT UserId)    AS present,
        COUNT(DISTINCT UserId)    AS total,
        0                         AS absent
      FROM dbo.vw_DeviceLogs_All
      WHERE CAST(LogDate AS DATE) = @date
      GROUP BY DeviceId
      ORDER BY DeviceId
    `);
    res.json({ success: true, date, departments: r.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`\n✅ SmartDesk Attendance API`);
  console.log(`   http://localhost:${PORT}/api/health`);
  console.log(`   SQL: ${config.server} → ${config.database} as ${config.user}\n`);
});
