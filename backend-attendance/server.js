const express = require('express');
const sql = require('mssql');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ── SQL Server Config ────────────────────────────────────────────────────────
const config = {
  user: 'sa',
  password: 'smart@123',
  server: '192.168.66.33',
  database: 'etimetracklite1AI',
  options: {
    trustServerCertificate: true,
    enableArithAbort: true,
    encrypt: false,
    instanceName: 'MSSQLSERVER', // try 'SQLEXPRESS' if this fails
  },
  port: 1433,
  connectionTimeout: 30000,
  requestTimeout: 30000,
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

let pool;
async function getPool() {
  if (!pool) { pool = await sql.connect(config); }
  return pool;
}

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await getPool();
    res.json({ success: true, message: 'Connected to SQL Server', server: config.server, database: config.database });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Discover tables (for schema debugging) ────────────────────────────────────
app.get('/api/attendance/tables', async (req, res) => {
  try {
    const p = await getPool();
    const r = await p.request().query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME`
    );
    res.json({ success: true, tables: r.recordset.map(x => x.TABLE_NAME) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Summary counts for a date ─────────────────────────────────────────────────
app.get('/api/attendance/summary', async (req, res) => {
  try {
    const p = await getPool();
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const r = await p.request().input('date', sql.Date, date).query(`
      SELECT
        COUNT(DISTINCT e.EMPCODE) AS totalEmployees,
        SUM(CASE WHEN UPPER(att.ATTSTATUS) IN ('P','PR') THEN 1 ELSE 0 END)  AS present,
        SUM(CASE WHEN UPPER(att.ATTSTATUS) IN ('A','AB') THEN 1 ELSE 0 END)  AS absent,
        SUM(CASE WHEN UPPER(att.ATTSTATUS) IN ('L','LV') THEN 1 ELSE 0 END)  AS onLeave,
        SUM(CASE WHEN UPPER(att.ATTSTATUS) IN ('WO','WH') THEN 1 ELSE 0 END) AS weeklyOff,
        SUM(CASE WHEN UPPER(att.ATTSTATUS) IN ('HD') THEN 1 ELSE 0 END)      AS halfDay,
        SUM(CASE WHEN UPPER(att.ATTSTATUS) IN ('OD') THEN 1 ELSE 0 END)      AS onDuty
      FROM MSTEMPLOYEE e
      LEFT JOIN ATTLOG att ON e.EMPCODE = att.EMPCODE AND CAST(att.INTIME AS DATE) = @date
      WHERE e.EMPSTATUS = 'A'
    `);
    res.json({ success: true, date, summary: r.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Per-employee attendance list ───────────────────────────────────────────────
app.get('/api/attendance', async (req, res) => {
  try {
    const p = await getPool();
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const dept = req.query.dept || '';
    const r = await p.request().input('date', sql.Date, date).query(`
      SELECT
        e.EMPCODE     AS empCode,
        e.EMPNAME     AS empName,
        e.DEPTNAME    AS department,
        e.DESGNAME    AS designation,
        att.INTIME    AS inTime,
        att.OUTTIME   AS outTime,
        att.ATTSTATUS AS status,
        att.WORKDUR   AS workDuration,
        att.OVERTIME  AS overtime
      FROM MSTEMPLOYEE e
      LEFT JOIN ATTLOG att ON e.EMPCODE = att.EMPCODE AND CAST(att.INTIME AS DATE) = @date
      WHERE e.EMPSTATUS = 'A'
      ${dept ? `AND e.DEPTNAME = '${dept.replace(/'/g,"''")}' ` : ''}
      ORDER BY e.DEPTNAME, e.EMPNAME
    `);
    res.json({ success: true, date, count: r.recordset.length, data: r.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Department breakdown ───────────────────────────────────────────────────────
app.get('/api/attendance/departments', async (req, res) => {
  try {
    const p = await getPool();
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const r = await p.request().input('date', sql.Date, date).query(`
      SELECT
        e.DEPTNAME AS department,
        COUNT(DISTINCT e.EMPCODE) AS total,
        SUM(CASE WHEN UPPER(att.ATTSTATUS) IN ('P','PR') THEN 1 ELSE 0 END) AS present,
        SUM(CASE WHEN UPPER(att.ATTSTATUS) IN ('A','AB') THEN 1 ELSE 0 END) AS absent,
        SUM(CASE WHEN UPPER(att.ATTSTATUS) IN ('L','LV') THEN 1 ELSE 0 END) AS onLeave
      FROM MSTEMPLOYEE e
      LEFT JOIN ATTLOG att ON e.EMPCODE = att.EMPCODE AND CAST(att.INTIME AS DATE) = @date
      WHERE e.EMPSTATUS = 'A'
      GROUP BY e.DEPTNAME
      ORDER BY e.DEPTNAME
    `);
    res.json({ success: true, date, departments: r.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Live today refresh (real-time) ─────────────────────────────────────────────
app.get('/api/attendance/live', async (req, res) => {
  try {
    const p = await getPool();
    const today = new Date().toISOString().split('T')[0];
    const r = await p.request().input('date', sql.Date, today).query(`
      SELECT
        COUNT(DISTINCT e.EMPCODE) AS total,
        SUM(CASE WHEN UPPER(att.ATTSTATUS) IN ('P','PR') THEN 1 ELSE 0 END) AS present,
        SUM(CASE WHEN att.INTIME IS NOT NULL AND att.OUTTIME IS NULL THEN 1 ELSE 0 END) AS currentlyIn,
        SUM(CASE WHEN att.OUTTIME IS NOT NULL THEN 1 ELSE 0 END) AS checkedOut,
        MAX(att.INTIME) AS lastCheckIn
      FROM MSTEMPLOYEE e
      LEFT JOIN ATTLOG att ON e.EMPCODE = att.EMPCODE AND CAST(att.INTIME AS DATE) = @date
      WHERE e.EMPSTATUS = 'A'
    `);
    res.json({ success: true, timestamp: new Date(), live: r.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`\n✅ SmartDesk Attendance API`);
  console.log(`   http://localhost:${PORT}/api/health`);
  console.log(`   SQL Server: ${config.server} → ${config.database}\n`);
});
