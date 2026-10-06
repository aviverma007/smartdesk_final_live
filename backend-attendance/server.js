const express = require('express');
const sql = require('mssql');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
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

// ── Does this employee code exist in the attendance system? ─────────────────
// Used by the SmartDesk login: people who punch in/out but are missing from the
// Excel directory must still be able to sign in. "Exists" = at least one punch
// in the last LOGIN_LOOKBACK_DAYS days (so people who have left drop out).
const LOGIN_LOOKBACK_DAYS = parseInt(process.env.LOGIN_LOOKBACK_DAYS || '90', 10);

app.get('/api/employees/:code', async (req, res) => {
  const code = String(req.params.code || '').trim();
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(code)) return res.json({ success: true, exists: false });
  try {
    const p = await getPool();
    const since = new Date(Date.now() - LOGIN_LOOKBACK_DAYS * 86400000);
    const r = await p.request()
      .input('code', sql.NVarChar(50), code)
      .input('since', sql.DateTime, since)
      .query(`
        SELECT TOP 1 CONVERT(VARCHAR(23), MAX(LogDate), 126) AS lastPunch
        FROM dbo.vw_DeviceLogs_All
        WHERE LogDate >= @since
          AND LTRIM(RTRIM(CAST(UserId AS NVARCHAR(50)))) = @code
        HAVING COUNT(*) > 0
      `);
    const row = r.recordset[0];
    res.json({ success: true, exists: !!row, lastPunch: row ? row.lastPunch : null, lookbackDays: LOGIN_LOOKBACK_DAYS });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── All employee codes seen in attendance (for the directory) ───────────────
// Returns every code with a punch in the last LOGIN_LOOKBACK_DAYS days. The
// frontend appends the ones missing from employee_directory.xlsx.
// Names/departments come from eTimeTrack's own Employees/Departments tables when
// they exist; if that lookup fails (different schema), codes are returned alone.
let empLookupMode = null; // null = untested, 'joined' | 'codes'
app.get('/api/employees', async (req, res) => {
  try {
    const p = await getPool();
    const since = new Date(Date.now() - LOGIN_LOOKBACK_DAYS * 86400000);
    const codesSql = `
      SELECT LTRIM(RTRIM(CAST(UserId AS NVARCHAR(50)))) AS code,
             CONVERT(VARCHAR(23), MAX(LogDate), 126)       AS lastPunch
      FROM dbo.vw_DeviceLogs_All
      WHERE LogDate >= @since AND UserId IS NOT NULL
      GROUP BY LTRIM(RTRIM(CAST(UserId AS NVARCHAR(50))))`;
    const joinedSql = `
      WITH c AS (${codesSql})
      SELECT c.code, c.lastPunch,
             LTRIM(RTRIM(e.EmployeeName))    AS name,
             LTRIM(RTRIM(d.DepartmentFName)) AS department
      FROM c
      OUTER APPLY (SELECT TOP 1 EmployeeName, DepartmentId FROM dbo.Employees
                   WHERE LTRIM(RTRIM(CAST(EmployeeCode AS NVARCHAR(50)))) = c.code) e
      LEFT JOIN dbo.Departments d ON d.DepartmentId = e.DepartmentId`;

    let rows;
    if (empLookupMode !== 'codes') {
      try {
        rows = (await p.request().input('since', sql.DateTime, since).query(joinedSql)).recordset;
        empLookupMode = 'joined';
      } catch (e) {
        console.warn(`   ! Employees/Departments lookup unavailable (${e.message}) — returning codes only`);
        empLookupMode = 'codes';
      }
    }
    if (!rows) rows = (await p.request().input('since', sql.DateTime, since).query(codesSql)).recordset;

    const employees = rows
      .filter(r => r.code && String(r.code).trim())
      .map(r => ({ code: r.code, name: r.name || null, department: r.department || null, lastPunch: r.lastPunch }));
    res.json({ success: true, count: employees.length, lookbackDays: LOGIN_LOOKBACK_DAYS, names: empLookupMode === 'joined', employees });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 5092;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ SmartDesk Attendance API`);
  console.log(`   Local:   http://localhost:${PORT}/api/health  (backend port 5092)`);
  console.log(`   Network: http://192.168.66.107:${PORT}/api/health`);
  console.log(`   SQL: ${config.server} → ${config.database} as ${config.user}\n`);
});
