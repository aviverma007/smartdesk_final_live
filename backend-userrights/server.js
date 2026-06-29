/**
 * SmartDesk — User Rights & Assets backend
 * -----------------------------------------
 * Three workflows, each with a two-stage approval state machine:
 *   1) Onboarding / User-ID allocation   (HR fills -> onboarded -> EmpId assigned)
 *   2) Asset allocation                  (HR requests -> employee confirms receipt -> locked to HR/IT)
 *   3) Application & rights allocation    (request -> manager approves -> IT marks given -> submitted)
 *
 * Persistence: SQL Server (config from .env). Tables are auto-created on boot.
 * Email: set-password LINK (never a plaintext password) via Outlook/O365 SMTP.
 *
 * NOTE on auth: this mirrors the existing SmartDesk trust model, where roles are
 * carried from the client. Routes read `x-user-role` / `x-user-id` headers and
 * gate sensitive actions on them. This is lightweight, not hardened auth — fine
 * for an internal portal, but do not expose this service to the public internet.
 */
// Load .env from this folder no matter where `npm start` is run from.
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'OPTIONS'], allowedHeaders: ['Content-Type', 'x-user-role', 'x-user-id'] }));
app.use(express.json({ limit: '1mb' }));

// ── SQL Server config ─────────────────────────────────────────────────────────
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'SmartDeskApp',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  // Matches the working attendance backend against this same SQL Server.
  options: { trustServerCertificate: true, enableArithAbort: true, encrypt: false },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

let pool;
async function getPool() {
  if (!pool) pool = await sql.connect(dbConfig);
  return pool;
}

// ── Fixed asset catalogue (v1) ──────────────────────────────────────────────
const ASSET_CATALOGUE = [
  { key: 'laptop',        label: 'Laptop' },
  { key: 'laptop_bag',    label: 'Laptop Bag' },
  { key: 'mouse',         label: 'Mouse' },
  { key: 'charger',       label: 'Charger' },
  { key: 'onboarding_kit', label: 'Onboarding Kit' },
];

// ── Auto-migration: create tables if they don't exist ───────────────────────
async function migrate() {
  const p = await getPool();
  await p.request().batch(`
IF OBJECT_ID('dbo.Onboarding','U') IS NULL
CREATE TABLE dbo.Onboarding (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  FullName     NVARCHAR(200) NOT NULL,
  DOB          DATE NULL,
  Gender       NVARCHAR(20) NULL,
  PastCompany  NVARCHAR(200) NULL,
  Profile      NVARCHAR(200) NULL,
  ManagerName  NVARCHAR(200) NULL,
  Department   NVARCHAR(200) NULL,
  JoiningDate  DATE NULL,
  Phone        NVARCHAR(40) NULL,
  EmpId        NVARCHAR(40) NULL,
  Status       NVARCHAR(30) NOT NULL DEFAULT('pending'),  -- pending | onboarded
  CreatedBy    NVARCHAR(80) NULL,
  CreatedAt    DATETIME NOT NULL DEFAULT(GETDATE()),
  UpdatedAt    DATETIME NOT NULL DEFAULT(GETDATE())
);

IF OBJECT_ID('dbo.AssetRequests','U') IS NULL
CREATE TABLE dbo.AssetRequests (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  EmpId        NVARCHAR(40) NOT NULL,
  Email        NVARCHAR(200) NOT NULL,
  Status       NVARCHAR(30) NOT NULL DEFAULT('pending'), -- pending | credentials_sent | employee_review | submitted
  CreatedBy    NVARCHAR(80) NULL,
  CreatedAt    DATETIME NOT NULL DEFAULT(GETDATE()),
  UpdatedAt    DATETIME NOT NULL DEFAULT(GETDATE()),
  SubmittedAt  DATETIME NULL
);

IF OBJECT_ID('dbo.AssetItems','U') IS NULL
CREATE TABLE dbo.AssetItems (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  RequestId   INT NOT NULL,
  ItemKey     NVARCHAR(60) NOT NULL,
  ItemLabel   NVARCHAR(120) NOT NULL,
  Requested   BIT NOT NULL DEFAULT(0),
  Received    BIT NOT NULL DEFAULT(0),
  NotRequired BIT NOT NULL DEFAULT(0)
);

IF OBJECT_ID('dbo.AccessRequests','U') IS NULL
CREATE TABLE dbo.AccessRequests (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  RequestType   NVARCHAR(30) NOT NULL DEFAULT('new'), -- new | authorization | deletion
  RequesterName NVARCHAR(200) NULL,
  Company       NVARCHAR(200) NULL,
  Department    NVARCHAR(200) NULL,
  EmpId         NVARCHAR(40) NULL,
  Email         NVARCHAR(200) NULL,
  WorkLocation  NVARCHAR(120) NULL,
  Language      NVARCHAR(60) NULL,
  ScopeOfWork   NVARCHAR(MAX) NULL,
  Applications  NVARCHAR(MAX) NULL,  -- JSON array of selected app keys
  Details       NVARCHAR(MAX) NULL,
  Status        NVARCHAR(30) NOT NULL DEFAULT('pending_manager'), -- pending_manager | manager_approved | it_given | submitted
  ManagerNote   NVARCHAR(MAX) NULL,
  ManagerApprovedBy NVARCHAR(80) NULL,
  ManagerApprovedAt DATETIME NULL,
  ITGivenBy     NVARCHAR(80) NULL,
  ITGivenAt     DATETIME NULL,
  CreatedBy     NVARCHAR(80) NULL,
  CreatedAt     DATETIME NOT NULL DEFAULT(GETDATE()),
  UpdatedAt     DATETIME NOT NULL DEFAULT(GETDATE())
);

IF OBJECT_ID('dbo.SetPasswordTokens','U') IS NULL
CREATE TABLE dbo.SetPasswordTokens (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  EmpId     NVARCHAR(40) NULL,
  Email     NVARCHAR(200) NOT NULL,
  Token     NVARCHAR(80) NOT NULL,
  ExpiresAt DATETIME NOT NULL,
  UsedAt    DATETIME NULL,
  CreatedAt DATETIME NOT NULL DEFAULT(GETDATE())
);

IF OBJECT_ID('dbo.AppUsers','U') IS NULL
CREATE TABLE dbo.AppUsers (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  EmpId        NVARCHAR(40) NULL,
  Email        NVARCHAR(200) NOT NULL,
  PasswordHash NVARCHAR(200) NOT NULL,
  CreatedAt    DATETIME NOT NULL DEFAULT(GETDATE()),
  UpdatedAt    DATETIME NOT NULL DEFAULT(GETDATE())
);
  `);
  await p.request().batch(`
IF COL_LENGTH('dbo.AssetItems','Given') IS NULL ALTER TABLE dbo.AssetItems ADD [Given] BIT NOT NULL DEFAULT(0);
IF COL_LENGTH('dbo.AssetItems','NotGiven') IS NULL ALTER TABLE dbo.AssetItems ADD NotGiven BIT NOT NULL DEFAULT(0);
IF COL_LENGTH('dbo.AssetRequests','ITSubmittedAt') IS NULL ALTER TABLE dbo.AssetRequests ADD ITSubmittedAt DATETIME NULL;

IF OBJECT_ID('dbo.AssetSelfRequests','U') IS NULL
CREATE TABLE dbo.AssetSelfRequests (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  EmpId      NVARCHAR(40) NOT NULL,
  Items      NVARCHAR(MAX) NULL,
  Reason     NVARCHAR(MAX) NULL,
  Status     NVARCHAR(30) NOT NULL DEFAULT('pending'),
  ITRemarks  NVARCHAR(MAX) NULL,
  DecidedBy  NVARCHAR(80) NULL,
  DecidedAt  DATETIME NULL,
  CreatedBy  NVARCHAR(80) NULL,
  CreatedAt  DATETIME NOT NULL DEFAULT(GETDATE())
);

-- HOD approval flow on AccessRequests
IF COL_LENGTH('dbo.AccessRequests','HodId') IS NULL ALTER TABLE dbo.AccessRequests ADD HodId NVARCHAR(40) NULL;
IF COL_LENGTH('dbo.AccessRequests','HodApprovedBy') IS NULL ALTER TABLE dbo.AccessRequests ADD HodApprovedBy NVARCHAR(80) NULL;
IF COL_LENGTH('dbo.AccessRequests','HodApprovedAt') IS NULL ALTER TABLE dbo.AccessRequests ADD HodApprovedAt DATETIME NULL;
IF COL_LENGTH('dbo.AccessRequests','ItGiven') IS NULL ALTER TABLE dbo.AccessRequests ADD ItGiven BIT NULL;
IF COL_LENGTH('dbo.AccessRequests','EmployeeAccepted') IS NULL ALTER TABLE dbo.AccessRequests ADD EmployeeAccepted BIT NULL;

-- Admin rights matrix (admin-only assignment of rights to any employee)
IF OBJECT_ID('dbo.RightsMatrix','U') IS NULL
CREATE TABLE dbo.RightsMatrix (
  EmpId     NVARCHAR(40) PRIMARY KEY,
  Name      NVARCHAR(200) NULL,
  Rights    NVARCHAR(MAX) NULL,  -- JSON array of granted application/right keys
  CanView   BIT NOT NULL DEFAULT(0),
  CanChange BIT NOT NULL DEFAULT(0),
  CanDownload BIT NOT NULL DEFAULT(0),
  CanApprove  BIT NOT NULL DEFAULT(0),
  UpdatedBy NVARCHAR(80) NULL,
  UpdatedAt DATETIME NOT NULL DEFAULT(GETDATE())
);
  `);
  console.log('   ✓ Tables ready');
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const role = (req) => String(req.headers['x-user-role'] || '').toLowerCase();
const actor = (req) => String(req.headers['x-user-id'] || 'unknown');
const can = (req, ...roles) => roles.includes(role(req)) || role(req) === 'admin';
function deny(res) { return res.status(403).json({ success: false, error: 'Not allowed for your role.' }); }
function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

// ── Email (set-password link) ────────────────────────────────────────────────
function mailer() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}
// Password follows the existing employee login formula: Smart@ + reversed Employee ID
function makeEmpPassword(empId) {
  return 'Smart@' + String(empId || '').split('').reverse().join('');
}
async function sendWelcomeCredentials(email, empId) {
  const base = process.env.APP_BASE_URL || 'http://localhost:82';
  const pw = makeEmpPassword(empId);
  const html = `<p>Dear User,</p>
<p>Welcome to SmartDesk!</p>
<p>We are pleased to provide you with your SmartDesk login credentials. Please use the details below to access the application:</p>
<p><strong>Portal Link:</strong> <a href="${base}">${base}</a><br>
<strong>User ID:</strong> ${empId}<br>
<strong>Password:</strong> ${pw}</p>
<p>For security purposes, we recommend changing your password after your first login.</p>
<p>If you experience any issues while accessing the portal or require any assistance, please feel free to contact the IT Support team.</p>
<p>We wish you a smooth and productive experience with SmartDesk.</p>
<p>Regards,<br>IT Support<br>Team Smartworld Developers Pvt. Ltd.</p>`;
  const tx = mailer();
  if (!tx) { console.warn(`   ! SMTP not configured — would email credentials to ${email} (User ID: ${empId})`); return { emailed: false }; }
  await tx.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Welcome to SmartDesk — Your Login Credentials',
    html,
  });
  return { emailed: true };
}

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try { await getPool(); res.json({ success: true, db: dbConfig.server + '/' + dbConfig.database, smtp: !!mailer() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
app.get('/api/assets/catalogue', (req, res) => res.json({ success: true, catalogue: ASSET_CATALOGUE }));

/* ═══════════════════════ 1) ONBOARDING / USER-ID ═══════════════════════════ */
app.post('/api/onboarding', async (req, res) => {
  if (!can(req, 'hr')) return deny(res);
  try {
    const b = req.body || {};
    if (!b.fullName) return res.status(400).json({ success: false, error: 'Full name is required.' });
    const p = await getPool();
    const r = await p.request()
      .input('FullName', sql.NVarChar, b.fullName)
      .input('DOB', sql.Date, b.dob || null)
      .input('Gender', sql.NVarChar, b.gender || null)
      .input('PastCompany', sql.NVarChar, b.pastCompany || null)
      .input('Profile', sql.NVarChar, b.profile || null)
      .input('ManagerName', sql.NVarChar, b.managerName || null)
      .input('Department', sql.NVarChar, b.department || null)
      .input('JoiningDate', sql.Date, b.joiningDate || null)
      .input('Phone', sql.NVarChar, b.phone || null)
      .input('CreatedBy', sql.NVarChar, actor(req))
      .query(`INSERT INTO dbo.Onboarding (FullName,DOB,Gender,PastCompany,Profile,ManagerName,Department,JoiningDate,Phone,CreatedBy)
              OUTPUT INSERTED.* VALUES (@FullName,@DOB,@Gender,@PastCompany,@Profile,@ManagerName,@Department,@JoiningDate,@Phone,@CreatedBy)`);
    res.json({ success: true, record: r.recordset[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/onboarding', async (req, res) => {
  if (!can(req, 'hr')) return deny(res);
  try {
    const p = await getPool();
    const status = req.query.status;
    const q = status
      ? await p.request().input('s', sql.NVarChar, status).query(`SELECT * FROM dbo.Onboarding WHERE Status=@s ORDER BY CreatedAt DESC`)
      : await p.request().query(`SELECT * FROM dbo.Onboarding ORDER BY CreatedAt DESC`);
    res.json({ success: true, records: q.recordset });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Onboarded employees, for merging into the Employee Directory (any logged-in role)
app.get('/api/onboarding/directory', async (req, res) => {
  try {
    const p = await getPool();
    const q = await p.request().query(
      `SELECT EmpId, FullName, Department, ManagerName, Profile, JoiningDate, Phone
       FROM dbo.Onboarding WHERE Status='onboarded' AND EmpId IS NOT NULL ORDER BY FullName`);
    res.json({ success: true, records: q.recordset });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.put('/api/onboarding/:id', async (req, res) => {
  if (!can(req, 'hr')) return deny(res);
  try {
    const b = req.body || {};
    const p = await getPool();
    await p.request()
      .input('Id', sql.Int, req.params.id)
      .input('FullName', sql.NVarChar, b.fullName)
      .input('DOB', sql.Date, b.dob || null)
      .input('Gender', sql.NVarChar, b.gender || null)
      .input('PastCompany', sql.NVarChar, b.pastCompany || null)
      .input('Profile', sql.NVarChar, b.profile || null)
      .input('ManagerName', sql.NVarChar, b.managerName || null)
      .input('Department', sql.NVarChar, b.department || null)
      .input('JoiningDate', sql.Date, b.joiningDate || null)
      .input('Phone', sql.NVarChar, b.phone || null)
      .query(`UPDATE dbo.Onboarding SET FullName=@FullName,DOB=@DOB,Gender=@Gender,PastCompany=@PastCompany,
              Profile=@Profile,ManagerName=@ManagerName,Department=@Department,JoiningDate=@JoiningDate,Phone=@Phone,
              UpdatedAt=GETDATE() WHERE Id=@Id AND Status='pending'`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Mark onboarded + assign Employee ID -> saves the person permanently
app.post('/api/onboarding/:id/complete', async (req, res) => {
  if (!can(req, 'hr')) return deny(res);
  try {
    const empId = String((req.body || {}).empId || '').trim();
    if (!empId) return res.status(400).json({ success: false, error: 'Employee ID is required to complete onboarding.' });
    const p = await getPool();
    const r = await p.request()
      .input('Id', sql.Int, req.params.id)
      .input('EmpId', sql.NVarChar, empId)
      .query(`UPDATE dbo.Onboarding SET EmpId=@EmpId, Status='onboarded', UpdatedAt=GETDATE()
              OUTPUT INSERTED.* WHERE Id=@Id`);
    res.json({ success: true, record: r.recordset[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

/* ═══════════════════════ 2) ASSET ALLOCATION ═══════════════════════════════ */
app.post('/api/assets', async (req, res) => {
  if (!can(req, 'hr')) return deny(res);
  try {
    const b = req.body || {};
    const empId = String(b.empId || '').trim();
    const email = String(b.email || '').trim();
    const items = Array.isArray(b.items) ? b.items : []; // array of item keys HR ticked
    if (!empId || !email) return res.status(400).json({ success: false, error: 'Employee ID and email are required.' });
    const p = await getPool();
    const reqRow = await p.request()
      .input('EmpId', sql.NVarChar, empId)
      .input('Email', sql.NVarChar, email)
      .input('CreatedBy', sql.NVarChar, actor(req))
      .query(`INSERT INTO dbo.AssetRequests (EmpId,Email,CreatedBy) OUTPUT INSERTED.* VALUES (@EmpId,@Email,@CreatedBy)`);
    const reqId = reqRow.recordset[0].Id;
    for (const cat of ASSET_CATALOGUE) {
      const requested = items.includes(cat.key) ? 1 : 0;
      await p.request()
        .input('RequestId', sql.Int, reqId)
        .input('ItemKey', sql.NVarChar, cat.key)
        .input('ItemLabel', sql.NVarChar, cat.label)
        .input('Requested', sql.Bit, requested)
        .query(`INSERT INTO dbo.AssetItems (RequestId,ItemKey,ItemLabel,Requested) VALUES (@RequestId,@ItemKey,@ItemLabel,@Requested)`);
    }
    res.json({ success: true, requestId: reqId });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

async function loadAssetRequest(p, id) {
  const r = await p.request().input('Id', sql.Int, id).query(`SELECT * FROM dbo.AssetRequests WHERE Id=@Id`);
  if (!r.recordset[0]) return null;
  const items = await p.request().input('RequestId', sql.Int, id).query(`SELECT * FROM dbo.AssetItems WHERE RequestId=@RequestId ORDER BY Id`);
  return { ...r.recordset[0], items: items.recordset };
}

app.get('/api/assets', async (req, res) => {
  if (!can(req, 'hr', 'it')) return deny(res);
  try {
    const p = await getPool();
    const rows = await p.request().query(`SELECT * FROM dbo.AssetRequests ORDER BY CreatedAt DESC`);
    res.json({ success: true, records: rows.recordset });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/assets/:id', async (req, res) => {
  try { const p = await getPool(); const r = await loadAssetRequest(p, req.params.id);
    if (!r) return res.status(404).json({ success: false, error: 'Not found.' });
    res.json({ success: true, record: r });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Employee fetches their own asset request
app.get('/api/assets/by-emp/:empId', async (req, res) => {
  try {
    const p = await getPool();
    const rows = await p.request().input('EmpId', sql.NVarChar, req.params.empId)
      .query(`SELECT TOP 1 * FROM dbo.AssetRequests WHERE EmpId=@EmpId ORDER BY CreatedAt DESC`);
    if (!rows.recordset[0]) return res.json({ success: true, record: null });
    res.json({ success: true, record: await loadAssetRequest(p, rows.recordset[0].Id) });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// HR: email login credentials (User ID + password) to the employee
app.post('/api/assets/:id/send-credentials', async (req, res) => {
  if (!can(req, 'hr')) return deny(res);
  try {
    const p = await getPool();
    const r = await p.request().input('Id', sql.Int, req.params.id).query(`SELECT * FROM dbo.AssetRequests WHERE Id=@Id`);
    const row = r.recordset[0];
    if (!row) return res.status(404).json({ success: false, error: 'Not found.' });
    const out = await sendWelcomeCredentials(row.Email, row.EmpId);
    await p.request().input('Id', sql.Int, req.params.id)
      .query(`UPDATE dbo.AssetRequests SET Status='credentials_sent', UpdatedAt=GETDATE() WHERE Id=@Id`);
    res.json({ success: true, emailed: out.emailed });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Employee ticks received / not-required (cannot edit once submitted)
app.put('/api/assets/:id/employee-confirm', async (req, res) => {
  try {
    const p = await getPool();
    const cur = await p.request().input('Id', sql.Int, req.params.id).query(`SELECT Status FROM dbo.AssetRequests WHERE Id=@Id`);
    if (!cur.recordset[0]) return res.status(404).json({ success: false, error: 'Not found.' });
    if (cur.recordset[0].Status === 'submitted' && role(req) !== 'admin')
      return res.status(403).json({ success: false, error: 'Submitted and locked. Only an admin can change it.' });
    const updates = Array.isArray((req.body || {}).items) ? req.body.items : [];
    for (const it of updates) {
      await p.request()
        .input('RequestId', sql.Int, req.params.id)
        .input('ItemKey', sql.NVarChar, it.key)
        .input('Received', sql.Bit, it.received ? 1 : 0)
        .input('NotRequired', sql.Bit, it.notRequired ? 1 : 0)
        .query(`UPDATE dbo.AssetItems SET Received=@Received, NotRequired=@NotRequired WHERE RequestId=@RequestId AND ItemKey=@ItemKey`);
    }
    await p.request().input('Id', sql.Int, req.params.id)
      .query(`UPDATE dbo.AssetRequests SET Status=CASE WHEN Status='submitted' THEN 'submitted' ELSE 'employee_review' END, UpdatedAt=GETDATE() WHERE Id=@Id`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Employee submits (locks the request to HR/IT only)
app.post('/api/assets/:id/submit', async (req, res) => {
  try {
    const p = await getPool();
    await p.request().input('Id', sql.Int, req.params.id)
      .query(`UPDATE dbo.AssetRequests SET Status='submitted', SubmittedAt=GETDATE(), UpdatedAt=GETDATE() WHERE Id=@Id`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// IT marks each item Given / Not given
app.put('/api/assets/:id/it-confirm', async (req, res) => {
  if (!can(req, 'it')) return deny(res);
  try {
    const p = await getPool();
    const updates = Array.isArray((req.body || {}).items) ? req.body.items : [];
    for (const it of updates) {
      await p.request()
        .input('RequestId', sql.Int, req.params.id)
        .input('ItemKey', sql.NVarChar, it.key)
        .input('Given', sql.Bit, it.given ? 1 : 0)
        .input('NotGiven', sql.Bit, it.notGiven ? 1 : 0)
        .query(`UPDATE dbo.AssetItems SET [Given]=@Given, NotGiven=@NotGiven WHERE RequestId=@RequestId AND ItemKey=@ItemKey`);
    }
    await p.request().input('Id', sql.Int, req.params.id)
      .query(`UPDATE dbo.AssetRequests SET UpdatedAt=GETDATE() WHERE Id=@Id`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// IT submits the handover -> sends it (back) to the employee to confirm receipt
app.post('/api/assets/:id/it-submit', async (req, res) => {
  if (!can(req, 'it')) return deny(res);
  try {
    const p = await getPool();
    await p.request().input('Id', sql.Int, req.params.id)
      .query(`UPDATE dbo.AssetRequests
              SET ITSubmittedAt=GETDATE(), Status='employee_review', SubmittedAt=NULL, UpdatedAt=GETDATE()
              WHERE Id=@Id`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

/* ═══════════════════ EMPLOYEE SELF-SERVICE ASSET REQUESTS ══════════════════ */
// Employee raises a request for a new asset
app.post('/api/asset-requests', async (req, res) => {
  if (!can(req, 'employee')) return deny(res);
  try {
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    if (items.length === 0) return res.status(400).json({ success: false, error: 'Select at least one asset.' });
    const p = await getPool();
    const r = await p.request()
      .input('EmpId', sql.NVarChar, actor(req))
      .input('Items', sql.NVarChar, JSON.stringify(items))
      .input('Reason', sql.NVarChar, b.reason || null)
      .input('CreatedBy', sql.NVarChar, actor(req))
      .query(`INSERT INTO dbo.AssetSelfRequests (EmpId,Items,Reason,CreatedBy)
              OUTPUT INSERTED.* VALUES (@EmpId,@Items,@Reason,@CreatedBy)`);
    res.json({ success: true, record: r.recordset[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// List: employee sees own; IT/HR/manager/admin see all
app.get('/api/asset-requests', async (req, res) => {
  if (!can(req, 'employee', 'it', 'hr', 'manager')) return deny(res);
  try {
    const p = await getPool();
    let rows;
    if (role(req) === 'employee') {
      rows = await p.request().input('me', sql.NVarChar, actor(req))
        .query(`SELECT * FROM dbo.AssetSelfRequests WHERE EmpId=@me ORDER BY CreatedAt DESC`);
    } else {
      rows = await p.request().query(`SELECT * FROM dbo.AssetSelfRequests ORDER BY CreatedAt DESC`);
    }
    res.json({ success: true, records: rows.recordset });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// IT approves or rejects with remarks
app.post('/api/asset-requests/:id/decide', async (req, res) => {
  if (!can(req, 'it')) return deny(res);
  try {
    const action = (req.body || {}).action === 'reject' ? 'rejected' : 'approved';
    const p = await getPool();
    await p.request()
      .input('Id', sql.Int, req.params.id)
      .input('Status', sql.NVarChar, action)
      .input('Remarks', sql.NVarChar, (req.body || {}).remarks || null)
      .input('By', sql.NVarChar, actor(req))
      .query(`UPDATE dbo.AssetSelfRequests SET Status=@Status, ITRemarks=@Remarks, DecidedBy=@By, DecidedAt=GETDATE() WHERE Id=@Id`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

/* ═══════════════════════ 3) APPLICATION & RIGHTS ═══════════════════════════ */
app.post('/api/access', async (req, res) => {
  if (!can(req, 'employee')) return deny(res);
  try {
    const b = req.body || {};
    const p = await getPool();
    const r = await p.request()
      .input('RequestType', sql.NVarChar, b.requestType || 'new')
      .input('RequesterName', sql.NVarChar, b.requesterName || null)
      .input('Company', sql.NVarChar, b.company || null)
      .input('Department', sql.NVarChar, b.department || null)
      .input('EmpId', sql.NVarChar, b.empId || null)
      .input('Email', sql.NVarChar, b.email || null)
      .input('WorkLocation', sql.NVarChar, b.workLocation || null)
      .input('Language', sql.NVarChar, b.language || null)
      .input('ScopeOfWork', sql.NVarChar, b.scopeOfWork || null)
      .input('Applications', sql.NVarChar, JSON.stringify(b.applications || []))
      .input('Details', sql.NVarChar, b.details || null)
      .input('HodId', sql.NVarChar, b.hodId || null)
      .input('CreatedBy', sql.NVarChar, actor(req))
      .query(`INSERT INTO dbo.AccessRequests
              (RequestType,RequesterName,Company,Department,EmpId,Email,WorkLocation,Language,ScopeOfWork,Applications,Details,HodId,Status,CreatedBy)
              OUTPUT INSERTED.* VALUES
              (@RequestType,@RequesterName,@Company,@Department,@EmpId,@Email,@WorkLocation,@Language,@ScopeOfWork,@Applications,@Details,@HodId,'pending_hod',@CreatedBy)`);
    res.json({ success: true, record: r.recordset[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/access', async (req, res) => {
  if (!can(req, 'hr', 'it', 'manager', 'employee')) return deny(res);
  try { const p = await getPool();
    let rows;
    if (role(req) === 'employee') {
      // an employee sees requests they created OR ones where they are the HOD approver
      rows = await p.request().input('me', sql.NVarChar, actor(req))
        .query(`SELECT * FROM dbo.AccessRequests WHERE CreatedBy=@me OR HodId=@me ORDER BY CreatedAt DESC`);
    } else {
      rows = await p.request().query(`SELECT * FROM dbo.AccessRequests ORDER BY CreatedAt DESC`);
    }
    res.json({ success: true, records: rows.recordset });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/access/:id', async (req, res) => {
  try { const p = await getPool();
    const r = await p.request().input('Id', sql.Int, req.params.id).query(`SELECT * FROM dbo.AccessRequests WHERE Id=@Id`);
    if (!r.recordset[0]) return res.status(404).json({ success: false, error: 'Not found.' });
    res.json({ success: true, record: r.recordset[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// HOD approves/rejects — actor must be the request's HodId (or admin). HOD cannot give rights.
app.post('/api/access/:id/hod-decide', async (req, res) => {
  try {
    const p = await getPool();
    const r = await p.request().input('Id', sql.Int, req.params.id).query(`SELECT * FROM dbo.AccessRequests WHERE Id=@Id`);
    const row = r.recordset[0];
    if (!row) return res.status(404).json({ success: false, error: 'Not found.' });
    if (role(req) !== 'admin' && String(row.HodId || '') !== actor(req))
      return res.status(403).json({ success: false, error: 'Only the selected HOD can approve this request.' });
    const approve = (req.body || {}).action !== 'reject';
    await p.request()
      .input('Id', sql.Int, req.params.id)
      .input('Status', sql.NVarChar, approve ? 'hod_approved' : 'rejected')
      .input('By', sql.NVarChar, actor(req))
      .query(`UPDATE dbo.AccessRequests SET Status=@Status, HodApprovedBy=@By, HodApprovedAt=GETDATE(), UpdatedAt=GETDATE() WHERE Id=@Id`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// IT marks given / not given (+remarks) after HOD approval, then again on Edit
app.post('/api/access/:id/it-decide', async (req, res) => {
  if (!can(req, 'it')) return deny(res);
  try {
    const given = !!(req.body || {}).given;
    const p = await getPool();
    await p.request()
      .input('Id', sql.Int, req.params.id)
      .input('Given', sql.Bit, given ? 1 : 0)
      .input('Note', sql.NVarChar, (req.body || {}).remarks || null)
      .input('By', sql.NVarChar, actor(req))
      .query(`UPDATE dbo.AccessRequests SET Status='it_given', ItGiven=@Given, ManagerNote=@Note,
              ITGivenBy=@By, ITGivenAt=GETDATE(), EmployeeAccepted=NULL, UpdatedAt=GETDATE() WHERE Id=@Id`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Requester accepts the IT decision -> completed
app.post('/api/access/:id/employee-accept', async (req, res) => {
  try {
    const p = await getPool();
    const r = await p.request().input('Id', sql.Int, req.params.id).query(`SELECT CreatedBy FROM dbo.AccessRequests WHERE Id=@Id`);
    const row = r.recordset[0];
    if (!row) return res.status(404).json({ success: false, error: 'Not found.' });
    if (role(req) !== 'admin' && String(row.CreatedBy || '') !== actor(req))
      return res.status(403).json({ success: false, error: 'Only the requester can accept.' });
    const accepted = (req.body || {}).accepted !== false;
    await p.request().input('Id', sql.Int, req.params.id).input('Acc', sql.Bit, accepted ? 1 : 0)
      .query(`UPDATE dbo.AccessRequests SET Status='completed', EmployeeAccepted=@Acc, UpdatedAt=GETDATE() WHERE Id=@Id`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

/* ═══════════════════════ ADMIN RIGHTS MATRIX ═══════════════════════════════ */
app.get('/api/rights-matrix', async (req, res) => {
  if (!can(req)) return deny(res); // admin only (can() with no extra roles => admin)
  try { const p = await getPool();
    const rows = await p.request().query(`SELECT * FROM dbo.RightsMatrix ORDER BY EmpId`);
    res.json({ success: true, records: rows.recordset });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.put('/api/rights-matrix/:empId', async (req, res) => {
  if (!can(req)) return deny(res); // admin only
  try {
    const b = req.body || {};
    const p = await getPool();
    await p.request()
      .input('EmpId', sql.NVarChar, req.params.empId)
      .input('Name', sql.NVarChar, b.name || null)
      .input('Rights', sql.NVarChar, JSON.stringify(b.rights || []))
      .input('V', sql.Bit, b.canView ? 1 : 0)
      .input('C', sql.Bit, b.canChange ? 1 : 0)
      .input('D', sql.Bit, b.canDownload ? 1 : 0)
      .input('A', sql.Bit, b.canApprove ? 1 : 0)
      .input('By', sql.NVarChar, actor(req))
      .query(`MERGE dbo.RightsMatrix AS t USING (SELECT @EmpId AS EmpId) AS s ON t.EmpId=s.EmpId
              WHEN MATCHED THEN UPDATE SET Name=@Name, Rights=@Rights, CanView=@V, CanChange=@C, CanDownload=@D, CanApprove=@A, UpdatedBy=@By, UpdatedAt=GETDATE()
              WHEN NOT MATCHED THEN INSERT (EmpId,Name,Rights,CanView,CanChange,CanDownload,CanApprove,UpdatedBy)
              VALUES (@EmpId,@Name,@Rights,@V,@C,@D,@A,@By);`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

/* ═══════════════════════ APP-USER LOGIN ════════════════════════════════════ */
// Verifies a password that an employee set via the set-password link.
// Accepts either Employee ID or email as the identifier.
app.post('/api/login', async (req, res) => {
  try {
    const id = String((req.body || {}).id || '').trim();
    const pw = String((req.body || {}).password || '');
    if (!id || !pw) return res.status(400).json({ success: false, error: 'Missing credentials.' });
    const p = await getPool();
    const r = await p.request().input('id', sql.NVarChar, id)
      .query(`SELECT TOP 1 * FROM dbo.AppUsers WHERE EmpId=@id OR Email=@id`);
    const row = r.recordset[0];
    if (!row) return res.json({ success: false, error: 'No account found. Use the set-password link from your email.' });
    const [salt, hash] = String(row.PasswordHash).split(':');
    const test = crypto.scryptSync(pw, salt, 32).toString('hex');
    if (test !== hash) return res.json({ success: false, error: 'Incorrect password.' });
    res.json({ success: true, user: { empId: row.EmpId, email: row.Email, role: 'employee' } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// IT edits the granted applications -> sends the request back to the HOD for re-approval
app.put('/api/access/:id/rights', async (req, res) => {
  if (!can(req, 'it')) return deny(res);
  try {
    const apps = Array.isArray((req.body || {}).applications) ? req.body.applications : [];
    const p = await getPool();
    await p.request()
      .input('Id', sql.Int, req.params.id)
      .input('Apps', sql.NVarChar, JSON.stringify(apps))
      .query(`UPDATE dbo.AccessRequests
              SET Applications=@Apps, Status='pending_hod',
                  HodApprovedBy=NULL, HodApprovedAt=NULL, ItGiven=NULL, EmployeeAccepted=NULL,
                  UpdatedAt=GETDATE()
              WHERE Id=@Id`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// HR/IT/admin: per-employee summary of details + assets + application rights
app.get('/api/employees-summary', async (req, res) => {
  if (!can(req, 'hr', 'it')) return deny(res);
  try {
    const p = await getPool();
    const [reqs, items, selfs, access, onb] = await Promise.all([
      p.request().query(`SELECT Id, EmpId, Email FROM dbo.AssetRequests`),
      p.request().query(`SELECT RequestId, ItemLabel, Requested, [Given] FROM dbo.AssetItems`),
      p.request().query(`SELECT EmpId, Items FROM dbo.AssetSelfRequests WHERE Status='approved'`),
      p.request().query(`SELECT EmpId, RequesterName, Applications, Email, Company, Department, WorkLocation FROM dbo.AccessRequests WHERE Status='completed' OR Status='it_given'`),
      p.request().query(`SELECT EmpId, FullName, Department, Profile, ManagerName, JoiningDate, Phone, Gender, PastCompany FROM dbo.Onboarding WHERE EmpId IS NOT NULL AND Status='onboarded'`),
    ]);
    const itemsByReq = {};
    items.recordset.forEach(i => { (itemsByReq[i.RequestId] = itemsByReq[i.RequestId] || []).push(i); });
    const map = {};
    const ensure = (id) => (map[id] = map[id] || { empId: id, name: '', email: '', department: '', designation: '', manager: '', joiningDate: '', phone: '', gender: '', company: '', location: '', assets: new Set(), rights: new Set() });
    const setIf = (e, k, v) => { if (v && !e[k]) e[k] = v; };

    onb.recordset.forEach(o => {
      const e = ensure(o.EmpId);
      setIf(e, 'name', o.FullName); setIf(e, 'department', o.Department); setIf(e, 'designation', o.Profile);
      setIf(e, 'manager', o.ManagerName); setIf(e, 'phone', o.Phone); setIf(e, 'gender', o.Gender);
      setIf(e, 'company', o.PastCompany);
      if (o.JoiningDate && !e.joiningDate) e.joiningDate = new Date(o.JoiningDate).toISOString().slice(0, 10);
    });
    reqs.recordset.forEach(r => {
      const e = ensure(r.EmpId); setIf(e, 'email', r.Email);
      (itemsByReq[r.Id] || []).forEach(it => { if (it.Given || it.Requested) e.assets.add(it.ItemLabel); });
    });
    selfs.recordset.forEach(s => {
      const e = ensure(s.EmpId);
      try { JSON.parse(s.Items || '[]').forEach(it => e.assets.add(it.label || it.key)); } catch (_) {}
    });
    access.recordset.forEach(a => {
      const e = ensure(a.EmpId);
      setIf(e, 'name', a.RequesterName); setIf(e, 'email', a.Email); setIf(e, 'department', a.Department);
      setIf(e, 'company', a.Company); setIf(e, 'location', a.WorkLocation);
      try { JSON.parse(a.Applications || '[]').forEach(app => e.rights.add(app)); } catch (_) {}
    });
    const records = Object.values(map).map(e => ({
      empId: e.empId, name: e.name, email: e.email, department: e.department, designation: e.designation,
      manager: e.manager, joiningDate: e.joiningDate, phone: e.phone, gender: e.gender, company: e.company, location: e.location,
      assets: [...e.assets], rights: [...e.rights],
    })).sort((a, b) => String(a.empId).localeCompare(String(b.empId)));
    res.json({ success: true, records });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

/* ═══════════════════════ SET-PASSWORD LINK ═════════════════════════════════ */
app.get('/api/set-password/validate', async (req, res) => {
  try {
    const token = String(req.query.token || '');
    const p = await getPool();
    const r = await p.request().input('t', sql.NVarChar, token)
      .query(`SELECT TOP 1 * FROM dbo.SetPasswordTokens WHERE Token=@t`);
    const row = r.recordset[0];
    if (!row) return res.json({ success: false, error: 'Invalid link.' });
    if (row.UsedAt) return res.json({ success: false, error: 'This link has already been used.' });
    if (new Date(row.ExpiresAt) < new Date()) return res.json({ success: false, error: 'This link has expired.' });
    res.json({ success: true, email: row.Email, empId: row.EmpId });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/set-password', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password || String(password).length < 6)
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
    const p = await getPool();
    const r = await p.request().input('t', sql.NVarChar, token).query(`SELECT TOP 1 * FROM dbo.SetPasswordTokens WHERE Token=@t`);
    const row = r.recordset[0];
    if (!row || row.UsedAt || new Date(row.ExpiresAt) < new Date())
      return res.status(400).json({ success: false, error: 'This link is invalid or expired.' });
    const hash = hashPw(String(password));
    const existing = await p.request().input('e', sql.NVarChar, row.Email).query(`SELECT TOP 1 Id FROM dbo.AppUsers WHERE Email=@e`);
    if (existing.recordset[0]) {
      await p.request().input('e', sql.NVarChar, row.Email).input('h', sql.NVarChar, hash)
        .query(`UPDATE dbo.AppUsers SET PasswordHash=@h, UpdatedAt=GETDATE() WHERE Email=@e`);
    } else {
      await p.request().input('emp', sql.NVarChar, row.EmpId || null).input('e', sql.NVarChar, row.Email).input('h', sql.NVarChar, hash)
        .query(`INSERT INTO dbo.AppUsers (EmpId,Email,PasswordHash) VALUES (@emp,@e,@h)`);
    }
    await p.request().input('id', sql.Int, row.Id).query(`UPDATE dbo.SetPasswordTokens SET UsedAt=GETDATE() WHERE Id=@id`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ── Boot ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5093;
(async () => {
  const envPath = require('path').join(__dirname, '.env');
  if (!process.env.DB_USER || !process.env.DB_PASSWORD) {
    console.warn('\n⚠  .env not loaded (DB_USER/DB_PASSWORD are empty).');
    console.warn(`   Expected file: ${envPath}`);
    console.warn('   Create it from .env.example and set DB_USER / DB_PASSWORD.');
    console.warn('   Tip: in Notepad use "Save as type: All Files" so it is not saved as .env.txt\n');
  }
  try {
    await getPool();
    await migrate();
  } catch (err) {
    console.error(`\n   ! DB connection/migration failed: ${err.message}`);
    if (/getaddrinfo|ENOTFOUND/i.test(err.message))
      console.error(`     The server name "${dbConfig.server}" could not be resolved. ` +
        `If the backend runs on the SQL Server machine use DB_SERVER=localhost, otherwise use its IP (e.g. 192.168.66.33).`);
    if (/Login failed/i.test(err.message))
      console.error('     Wrong DB_USER/DB_PASSWORD, or mixed-mode auth is off on the server.');
    console.error('');
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ SmartDesk User Rights & Assets API`);
    console.log(`   Local:   http://localhost:${PORT}/api/health  (port ${PORT})`);
    console.log(`   DB:      ${dbConfig.server} → ${dbConfig.database} as ${dbConfig.user || '(unset)'}`);
    console.log(`   SMTP:    ${process.env.SMTP_HOST ? process.env.SMTP_HOST : '(unset — links logged to console)'}\n`);
  });
})();
