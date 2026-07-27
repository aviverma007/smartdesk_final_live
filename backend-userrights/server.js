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
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'x-user-role', 'x-user-id'] }));
app.use(express.json({ limit: '25mb' }));

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
IF COL_LENGTH('dbo.RightsMatrix','Profile') IS NULL ALTER TABLE dbo.RightsMatrix ADD Profile NVARCHAR(40) NULL;

-- Directory of employees managed in-app (add / soft-delete) + audit log
IF OBJECT_ID('dbo.DirectoryEmployees','U') IS NULL
CREATE TABLE dbo.DirectoryEmployees (
  EmpId       NVARCHAR(40) PRIMARY KEY,
  Name        NVARCHAR(200) NULL,
  Department  NVARCHAR(120) NULL,
  Designation NVARCHAR(120) NULL,
  Email       NVARCHAR(200) NULL,
  Status      NVARCHAR(20) NOT NULL DEFAULT('active'), -- active | deleted
  CreatedBy   NVARCHAR(80) NULL,
  CreatedAt   DATETIME NOT NULL DEFAULT(GETDATE()),
  DeletedBy   NVARCHAR(80) NULL,
  DeletedAt   DATETIME NULL
);
IF OBJECT_ID('dbo.DirectoryLog','U') IS NULL
CREATE TABLE dbo.DirectoryLog (
  Id      INT IDENTITY(1,1) PRIMARY KEY,
  Action  NVARCHAR(20) NOT NULL,  -- add | delete
  EmpId   NVARCHAR(40) NULL,
  Name    NVARCHAR(200) NULL,
  ActedBy NVARCHAR(80) NULL,
  ActedAt DATETIME NOT NULL DEFAULT(GETDATE())
);
IF OBJECT_ID('dbo.PreOnboarding','U') IS NULL
CREATE TABLE dbo.PreOnboarding (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  CandidateName NVARCHAR(200) NOT NULL,
  Role NVARCHAR(150) NULL,
  Grade NVARCHAR(80) NULL,
  Department NVARCHAR(150) NULL,
  HiringManager NVARCHAR(200) NULL,
  Phone NVARCHAR(60) NULL,
  Email NVARCHAR(200) NULL,
  MrfRef NVARCHAR(100) NULL,
  JoiningDate DATE NULL,
  OfferAcceptedDate DATE NULL,
  ResignationAcceptedDate DATE NULL,
  Documents NVARCHAR(MAX) NULL,
  AssignedEmpId NVARCHAR(40) NULL,
  Notes NVARCHAR(MAX) NULL,
  Status NVARCHAR(30) NOT NULL DEFAULT('offer_accepted'),
  DroppedReason NVARCHAR(300) NULL,
  CreatedBy NVARCHAR(80) NULL,
  CreatedAt DATETIME NOT NULL DEFAULT(GETDATE()),
  UpdatedAt DATETIME NOT NULL DEFAULT(GETDATE())
);
IF COL_LENGTH('dbo.PreOnboarding','DeleteRequested') IS NULL ALTER TABLE dbo.PreOnboarding ADD DeleteRequested BIT NOT NULL DEFAULT(0);
IF COL_LENGTH('dbo.PreOnboarding','DeleteReason') IS NULL ALTER TABLE dbo.PreOnboarding ADD DeleteReason NVARCHAR(300) NULL;
IF COL_LENGTH('dbo.PreOnboarding','DeleteRequestedBy') IS NULL ALTER TABLE dbo.PreOnboarding ADD DeleteRequestedBy NVARCHAR(80) NULL;
IF COL_LENGTH('dbo.PreOnboarding','DeleteRequestedAt') IS NULL ALTER TABLE dbo.PreOnboarding ADD DeleteRequestedAt DATETIME NULL;

IF OBJECT_ID('dbo.Recruitment','U') IS NULL
CREATE TABLE dbo.Recruitment (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Department NVARCHAR(150) NULL, Role NVARCHAR(150) NULL, Grade NVARCHAR(80) NULL,
  Positions INT NULL, Justification NVARCHAR(600) NULL, TargetDate DATE NULL, MrfRef NVARCHAR(100) NULL,
  AopApproved BIT NOT NULL DEFAULT(0),
  Stage NVARCHAR(30) NOT NULL DEFAULT('requisition'),
  Status NVARCHAR(20) NOT NULL DEFAULT('active'),  -- active | on_hold | dropped | closed
  DropReason NVARCHAR(300) NULL,
  JdConfirmed BIT NOT NULL DEFAULT(0), KraConfirmed BIT NOT NULL DEFAULT(0),
  SourcingChannels NVARCHAR(MAX) NULL, SourcingNotes NVARCHAR(600) NULL,
  NumScreened INT NULL, NumShortlisted INT NULL, ScreeningNotes NVARCHAR(600) NULL,
  FitmentNotes NVARCHAR(600) NULL, BudgetOk BIT NOT NULL DEFAULT(0), SelectedCandidateId INT NULL,
  OfferReleasedDate DATE NULL, OfferNotes NVARCHAR(600) NULL,
  ReqApproverRole NVARCHAR(30) NULL, ReqApprovalStatus NVARCHAR(20) NOT NULL DEFAULT('pending'),
  ReqApprovalBy NVARCHAR(80) NULL, ReqApprovalAt DATETIME NULL, ReqApprovalRemark NVARCHAR(300) NULL,
  OfferApprovalStatus NVARCHAR(20) NOT NULL DEFAULT('pending'),
  OfferApprovalBy NVARCHAR(80) NULL, OfferApprovalAt DATETIME NULL, OfferApprovalRemark NVARCHAR(300) NULL,
  DeleteRequested BIT NOT NULL DEFAULT(0), DeleteReason NVARCHAR(300) NULL, DeleteRequestedBy NVARCHAR(80) NULL, DeleteRequestedAt DATETIME NULL,
  CreatedBy NVARCHAR(80) NULL, CreatedByRole NVARCHAR(30) NULL,
  CreatedAt DATETIME NOT NULL DEFAULT(GETDATE()), UpdatedAt DATETIME NOT NULL DEFAULT(GETDATE())
);
IF OBJECT_ID('dbo.RecruitmentCandidates','U') IS NULL
CREATE TABLE dbo.RecruitmentCandidates (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ReqId INT NOT NULL,
  Name NVARCHAR(200) NOT NULL, Phone NVARCHAR(60) NULL, Email NVARCHAR(200) NULL, Source NVARCHAR(120) NULL,
  CandStatus NVARCHAR(20) NOT NULL DEFAULT('shortlisted'), -- shortlisted | interviewing | selected | rejected
  Interviews NVARCHAR(MAX) NULL,  -- JSON [{round,date,panel,outcome,notes}]
  OfferAcceptedDate DATE NULL, ResignationAcceptedDate DATE NULL, JoiningDate DATE NULL,
  Documents NVARCHAR(MAX) NULL, EngagementNotes NVARCHAR(600) NULL,
  CreatedAt DATETIME NOT NULL DEFAULT(GETDATE())
);
IF COL_LENGTH('dbo.Recruitment','JdText') IS NULL ALTER TABLE dbo.Recruitment ADD JdText NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.Recruitment','JdFileName') IS NULL ALTER TABLE dbo.Recruitment ADD JdFileName NVARCHAR(255) NULL;
IF COL_LENGTH('dbo.RecruitmentCandidates','CvFileName') IS NULL ALTER TABLE dbo.RecruitmentCandidates ADD CvFileName NVARCHAR(255) NULL;
IF COL_LENGTH('dbo.RecruitmentCandidates','HodDecision') IS NULL ALTER TABLE dbo.RecruitmentCandidates ADD HodDecision NVARCHAR(20) NOT NULL DEFAULT('pending');
IF COL_LENGTH('dbo.RecruitmentCandidates','HodRemark') IS NULL ALTER TABLE dbo.RecruitmentCandidates ADD HodRemark NVARCHAR(300) NULL;
IF COL_LENGTH('dbo.RecruitmentCandidates','InterviewDate') IS NULL ALTER TABLE dbo.RecruitmentCandidates ADD InterviewDate DATE NULL;
IF COL_LENGTH('dbo.RecruitmentCandidates','InterviewTime') IS NULL ALTER TABLE dbo.RecruitmentCandidates ADD InterviewTime NVARCHAR(30) NULL;
IF COL_LENGTH('dbo.RecruitmentCandidates','InterviewStatus') IS NULL ALTER TABLE dbo.RecruitmentCandidates ADD InterviewStatus NVARCHAR(20) NOT NULL DEFAULT('none');
IF COL_LENGTH('dbo.RecruitmentCandidates','InterviewerName') IS NULL ALTER TABLE dbo.RecruitmentCandidates ADD InterviewerName NVARCHAR(200) NULL;
IF COL_LENGTH('dbo.RecruitmentCandidates','Assessment') IS NULL ALTER TABLE dbo.RecruitmentCandidates ADD Assessment NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.RecruitmentCandidates','Outcome') IS NULL ALTER TABLE dbo.RecruitmentCandidates ADD Outcome NVARCHAR(20) NULL;
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
    // managed directory: active adds appear, deleted ones are filtered out
    let added = [], deleted = [];
    try {
      const dir = await p.request().query(`SELECT EmpId, Name, Department, Designation, Status FROM dbo.DirectoryEmployees`);
      added = dir.recordset.filter(d => d.Status === 'active').map(d => ({ EmpId: d.EmpId, FullName: d.Name, Department: d.Department, ManagerName: null, Profile: d.Designation, JoiningDate: null, Phone: null }));
      deleted = dir.recordset.filter(d => d.Status === 'deleted').map(d => String(d.EmpId));
    } catch (_) {}
    const have = new Set(q.recordset.map(r => String(r.EmpId)));
    const merged = [...q.recordset, ...added.filter(a => !have.has(String(a.EmpId)))]
      .filter(r => !deleted.includes(String(r.EmpId)));
    res.json({ success: true, records: merged, deleted });
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
    if (b.hodId && String(b.hodId).trim() === String(actor(req)))
      return res.status(400).json({ success: false, error: 'You cannot select yourself as your HOD.' });
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
      .input('Profile', sql.NVarChar, b.profile || 'CUSTOM')
      .input('Rights', sql.NVarChar, JSON.stringify(b.modules || {}))
      .input('By', sql.NVarChar, actor(req))
      .query(`MERGE dbo.RightsMatrix AS t USING (SELECT @EmpId AS EmpId) AS s ON t.EmpId=s.EmpId
              WHEN MATCHED THEN UPDATE SET Name=@Name, Profile=@Profile, Rights=@Rights, UpdatedBy=@By, UpdatedAt=GETDATE()
              WHEN NOT MATCHED THEN INSERT (EmpId,Name,Profile,Rights,UpdatedBy)
              VALUES (@EmpId,@Name,@Profile,@Rights,@By);`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

/* ═══════════════════════ DIRECTORY MANAGEMENT + LOG ════════════════════════ */
// Add an employee to the directory (admin)
app.post('/api/directory', async (req, res) => {
  if (!can(req)) return deny(res);
  try {
    const b = req.body || {};
    if (!b.empId) return res.status(400).json({ success: false, error: 'Employee ID is required.' });
    const p = await getPool();
    await p.request()
      .input('EmpId', sql.NVarChar, String(b.empId).trim())
      .input('Name', sql.NVarChar, b.name || null)
      .input('Department', sql.NVarChar, b.department || null)
      .input('Designation', sql.NVarChar, b.designation || null)
      .input('Email', sql.NVarChar, b.email || null)
      .input('By', sql.NVarChar, actor(req))
      .query(`MERGE dbo.DirectoryEmployees AS t USING (SELECT @EmpId AS EmpId) AS s ON t.EmpId=s.EmpId
              WHEN MATCHED THEN UPDATE SET Name=@Name, Department=@Department, Designation=@Designation, Email=@Email, Status='active', DeletedBy=NULL, DeletedAt=NULL
              WHEN NOT MATCHED THEN INSERT (EmpId,Name,Department,Designation,Email,CreatedBy) VALUES (@EmpId,@Name,@Department,@Designation,@Email,@By);`);
    await p.request().input('A', sql.NVarChar, 'add').input('E', sql.NVarChar, String(b.empId).trim()).input('N', sql.NVarChar, b.name || null).input('By', sql.NVarChar, actor(req))
      .query(`INSERT INTO dbo.DirectoryLog (Action,EmpId,Name,ActedBy) VALUES (@A,@E,@N,@By)`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Soft-delete an employee from the directory (admin) — kept for the log
app.delete('/api/directory/:empId', async (req, res) => {
  if (!can(req)) return deny(res);
  try {
    const p = await getPool();
    const r = await p.request().input('E', sql.NVarChar, req.params.empId).query(`SELECT Name FROM dbo.DirectoryEmployees WHERE EmpId=@E`);
    await p.request().input('E', sql.NVarChar, req.params.empId).input('By', sql.NVarChar, actor(req))
      .query(`UPDATE dbo.DirectoryEmployees SET Status='deleted', DeletedBy=@By, DeletedAt=GETDATE() WHERE EmpId=@E`);
    await p.request().input('A', sql.NVarChar, 'delete').input('E', sql.NVarChar, req.params.empId).input('N', sql.NVarChar, (r.recordset[0] || {}).Name || null).input('By', sql.NVarChar, actor(req))
      .query(`INSERT INTO dbo.DirectoryLog (Action,EmpId,Name,ActedBy) VALUES (@A,@E,@N,@By)`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// List managed directory (current + deleted)
app.get('/api/directory', async (req, res) => {
  if (!can(req, 'hr', 'it')) return deny(res);
  try {
    const p = await getPool();
    const rows = await p.request().query(`SELECT * FROM dbo.DirectoryEmployees ORDER BY Status, EmpId`);
    res.json({ success: true, records: rows.recordset });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Audit log of directory changes (admin)
app.get('/api/directory/log', async (req, res) => {
  if (!can(req)) return deny(res);
  try {
    const p = await getPool();
    const rows = await p.request().query(`SELECT TOP 500 * FROM dbo.DirectoryLog ORDER BY ActedAt DESC`);
    res.json({ success: true, records: rows.recordset });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

/* ═══════════════════════ HR PRE-ONBOARDING ═════════════════════════════════ */
const fs = require('fs');
const pathmod = require('path');
const PRE_DIR = pathmod.join(__dirname, 'uploads', 'preonboarding');
const DOC_CHECKLIST = [
  { key: 'idProof', label: 'ID proof' },
  { key: 'addressProof', label: 'Address proof' },
  { key: 'education', label: 'Education certificates' },
  { key: 'relieving', label: 'Relieving / experience letter' },
  { key: 'bank', label: 'Bank details' },
  { key: 'photo', label: 'Photograph' },
];
const freshDocs = () => DOC_CHECKLIST.map(d => ({ key: d.key, label: d.label, received: false, fileName: null }));

// Create a candidate record
app.post('/api/preonboarding', async (req, res) => {
  if (!can(req, 'hr')) return deny(res);
  try {
    const b = req.body || {};
    if (!b.candidateName) return res.status(400).json({ success: false, error: 'Candidate name is required.' });
    const p = await getPool();
    const r = await p.request()
      .input('Name', sql.NVarChar, b.candidateName)
      .input('Role', sql.NVarChar, b.role || null)
      .input('Grade', sql.NVarChar, b.grade || null)
      .input('Dept', sql.NVarChar, b.department || null)
      .input('HM', sql.NVarChar, b.hiringManager || null)
      .input('Phone', sql.NVarChar, b.phone || null)
      .input('Email', sql.NVarChar, b.email || null)
      .input('Mrf', sql.NVarChar, b.mrfRef || null)
      .input('JD', sql.Date, b.joiningDate || null)
      .input('Docs', sql.NVarChar, JSON.stringify(freshDocs()))
      .input('By', sql.NVarChar, actor(req))
      .query(`INSERT INTO dbo.PreOnboarding
        (CandidateName,Role,Grade,Department,HiringManager,Phone,Email,MrfRef,JoiningDate,Documents,CreatedBy)
        OUTPUT INSERTED.* VALUES
        (@Name,@Role,@Grade,@Dept,@HM,@Phone,@Email,@Mrf,@JD,@Docs,@By)`);
    res.json({ success: true, record: r.recordset[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// List (HR/admin)
app.get('/api/preonboarding', async (req, res) => {
  if (!can(req, 'hr')) return deny(res);
  try {
    const p = await getPool();
    const rows = await p.request().query(`SELECT * FROM dbo.PreOnboarding ORDER BY
      CASE Status WHEN 'handed_over' THEN 2 WHEN 'dropped' THEN 3 ELSE 1 END, JoiningDate ASC, CreatedAt DESC`);
    res.json({ success: true, records: rows.recordset, checklist: DOC_CHECKLIST });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Update fields / dates / checklist ticks / assigned ID / status / notes
app.put('/api/preonboarding/:id', async (req, res) => {
  if (!can(req, 'hr')) return deny(res);
  try {
    const b = req.body || {};
    const p = await getPool();
    const cur = (await p.request().input('Id', sql.Int, req.params.id).query(`SELECT * FROM dbo.PreOnboarding WHERE Id=@Id`)).recordset[0];
    if (!cur) return res.status(404).json({ success: false, error: 'Not found.' });

    // requested status change is validated below
    let status = b.status || cur.Status;
    let docs = cur.Documents;
    if (Array.isArray(b.documents)) docs = JSON.stringify(b.documents);

    const allDocsIn = () => { try { return JSON.parse(docs || '[]').every(d => d.received); } catch { return false; } };
    const assigned = b.assignedEmpId !== undefined ? b.assignedEmpId : cur.AssignedEmpId;
    const offer = b.offerAcceptedDate !== undefined ? b.offerAcceptedDate : cur.OfferAcceptedDate;
    const resign = b.resignationAcceptedDate !== undefined ? b.resignationAcceptedDate : cur.ResignationAcceptedDate;
    const jd = b.joiningDate !== undefined ? b.joiningDate : cur.JoiningDate;

    if (status === 'ready') {
      if (!offer || !resign || !jd || !allDocsIn())
        return res.status(400).json({ success: false, error: 'To mark Ready: offer acceptance, resignation acceptance, confirmed joining date, and all documents are required.' });
    }

    await p.request()
      .input('Id', sql.Int, req.params.id)
      .input('Name', sql.NVarChar, b.candidateName ?? cur.CandidateName)
      .input('Role', sql.NVarChar, b.role ?? cur.Role)
      .input('Grade', sql.NVarChar, b.grade ?? cur.Grade)
      .input('Dept', sql.NVarChar, b.department ?? cur.Department)
      .input('HM', sql.NVarChar, b.hiringManager ?? cur.HiringManager)
      .input('Phone', sql.NVarChar, b.phone ?? cur.Phone)
      .input('Email', sql.NVarChar, b.email ?? cur.Email)
      .input('Mrf', sql.NVarChar, b.mrfRef ?? cur.MrfRef)
      .input('JD', sql.Date, jd || null)
      .input('Offer', sql.Date, offer || null)
      .input('Resign', sql.Date, resign || null)
      .input('Docs', sql.NVarChar, docs)
      .input('Emp', sql.NVarChar, assigned || null)
      .input('Notes', sql.NVarChar, b.notes ?? cur.Notes)
      .input('Status', sql.NVarChar, status)
      .input('Drop', sql.NVarChar, b.droppedReason ?? cur.DroppedReason)
      .query(`UPDATE dbo.PreOnboarding SET CandidateName=@Name, Role=@Role, Grade=@Grade, Department=@Dept,
        HiringManager=@HM, Phone=@Phone, Email=@Email, MrfRef=@Mrf, JoiningDate=@JD,
        OfferAcceptedDate=@Offer, ResignationAcceptedDate=@Resign, Documents=@Docs, AssignedEmpId=@Emp,
        Notes=@Notes, Status=@Status, DroppedReason=@Drop, UpdatedAt=GETDATE() WHERE Id=@Id`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Optional document upload (base64 -> saved to disk), also ticks the item received
app.post('/api/preonboarding/:id/upload', async (req, res) => {
  if (!can(req, 'hr')) return deny(res);
  try {
    const b = req.body || {};
    if (!b.key || !b.dataBase64) return res.status(400).json({ success: false, error: 'Missing file.' });
    const p = await getPool();
    const cur = (await p.request().input('Id', sql.Int, req.params.id).query(`SELECT Documents FROM dbo.PreOnboarding WHERE Id=@Id`)).recordset[0];
    if (!cur) return res.status(404).json({ success: false, error: 'Not found.' });
    const dir = pathmod.join(PRE_DIR, String(req.params.id));
    fs.mkdirSync(dir, { recursive: true });
    const safe = String(b.fileName || (b.key + '.bin')).replace(/[^A-Za-z0-9._-]/g, '_');
    const fname = `${b.key}__${safe}`;
    fs.writeFileSync(pathmod.join(dir, fname), Buffer.from(b.dataBase64.split(',').pop(), 'base64'));
    let docs = []; try { docs = JSON.parse(cur.Documents || '[]'); } catch {}
    docs = docs.map(d => d.key === b.key ? { ...d, received: true, fileName: b.fileName || safe } : d);
    await p.request().input('Id', sql.Int, req.params.id).input('Docs', sql.NVarChar, JSON.stringify(docs))
      .query(`UPDATE dbo.PreOnboarding SET Documents=@Docs, UpdatedAt=GETDATE() WHERE Id=@Id`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Download an uploaded document
app.get('/api/preonboarding/:id/file/:key', async (req, res) => {
  if (!can(req, 'hr')) return deny(res);
  try {
    const dir = pathmod.join(PRE_DIR, String(req.params.id));
    if (!fs.existsSync(dir)) return res.status(404).send('Not found');
    const f = fs.readdirSync(dir).find(n => n.startsWith(req.params.key + '__'));
    if (!f) return res.status(404).send('Not found');
    res.download(pathmod.join(dir, f), f.split('__').slice(1).join('__'));
  } catch (err) { res.status(500).send(err.message); }
});

// HR requests deletion of a candidate record -> goes to admin for approval
app.post('/api/preonboarding/:id/request-delete', async (req, res) => {
  if (!can(req, 'hr')) return deny(res);
  try {
    const p = await getPool();
    await p.request().input('Id', sql.Int, req.params.id)
      .input('Reason', sql.NVarChar, (req.body || {}).reason || null)
      .input('By', sql.NVarChar, actor(req))
      .query(`UPDATE dbo.PreOnboarding SET DeleteRequested=1, DeleteReason=@Reason, DeleteRequestedBy=@By, DeleteRequestedAt=GETDATE(), UpdatedAt=GETDATE() WHERE Id=@Id`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Admin approves the deletion -> record (and its files) are removed
app.post('/api/preonboarding/:id/approve-delete', async (req, res) => {
  if (!can(req)) return deny(res); // admin only
  try {
    const p = await getPool();
    await p.request().input('Id', sql.Int, req.params.id).query(`DELETE FROM dbo.PreOnboarding WHERE Id=@Id`);
    try { fs.rmSync(pathmod.join(PRE_DIR, String(req.params.id)), { recursive: true, force: true }); } catch (_) {}
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Admin rejects the deletion -> clears the request
app.post('/api/preonboarding/:id/reject-delete', async (req, res) => {
  if (!can(req)) return deny(res); // admin only
  try {
    const p = await getPool();
    await p.request().input('Id', sql.Int, req.params.id)
      .query(`UPDATE dbo.PreOnboarding SET DeleteRequested=0, DeleteReason=NULL, DeleteRequestedBy=NULL, DeleteRequestedAt=NULL, UpdatedAt=GETDATE() WHERE Id=@Id`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Delete an uploaded document (wrong file) — removes the file and unticks it
app.delete('/api/preonboarding/:id/file/:key', async (req, res) => {
  if (!can(req, 'hr')) return deny(res);
  try {
    const p = await getPool();
    const cur = (await p.request().input('Id', sql.Int, req.params.id).query(`SELECT Documents FROM dbo.PreOnboarding WHERE Id=@Id`)).recordset[0];
    if (!cur) return res.status(404).json({ success: false, error: 'Not found.' });
    const dir = pathmod.join(PRE_DIR, String(req.params.id));
    try {
      if (fs.existsSync(dir)) {
        const f = fs.readdirSync(dir).find(n => n.startsWith(req.params.key + '__'));
        if (f) fs.rmSync(pathmod.join(dir, f), { force: true });
      }
    } catch (_) {}
    let docs = []; try { docs = JSON.parse(cur.Documents || '[]'); } catch {}
    docs = docs.map(d => d.key === req.params.key ? { ...d, received: false, fileName: null } : d);
    await p.request().input('Id', sql.Int, req.params.id).input('Docs', sql.NVarChar, JSON.stringify(docs))
      .query(`UPDATE dbo.PreOnboarding SET Documents=@Docs, UpdatedAt=GETDATE() WHERE Id=@Id`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

/* ═══════════════════════ RECRUITMENT (stages 1–9) ══════════════════════════ */
const REC_STAGES = ['jd', 'review_post', 'cv_shortlist', 'scheduling', 'interview', 'selection', 'offer', 'acceptance'];
// Gate for advancing OUT of the current stage. Returns {ok} or {ok:false,msg}.
function recForwardGate(cur, cands) {
  const OK = { ok: true };
  const ch = (() => { try { return JSON.parse(cur.SourcingChannels || '[]'); } catch { return []; } })();
  switch (cur.Stage) {
    case 'jd':
      return (cur.JdText && String(cur.JdText).trim()) || cur.JdFileName ? OK : { ok: false, msg: 'Add the JD (paste text or upload a file) before handing it to HR.' };
    case 'review_post':
      return ch.length ? OK : { ok: false, msg: 'Tick where the JD was posted before moving on.' };
    case 'cv_shortlist': {
      if (!cands.length) return { ok: false, msg: 'Upload at least one CV first.' };
      const pending = cands.filter(c => (c.HodDecision || 'pending') === 'pending');
      if (pending.length) return { ok: false, msg: `This step belongs to the HOD. ${pending.length} CV(s) are still awaiting the HOD's Accept/Reject — HR can proceed only once the HOD has reviewed every CV.` };
      if (!cands.some(c => c.HodDecision === 'accepted')) return { ok: false, msg: 'The HOD has not accepted any candidate, so there is no one to interview.' };
      return OK;
    }
    case 'scheduling':
      return cands.some(c => c.HodDecision === 'accepted' && c.InterviewStatus === 'arrived') ? OK : { ok: false, msg: 'Mark at least one accepted candidate as "Arrived" before the interview stage.' };
    case 'interview':
      return cands.some(c => c.Outcome) ? OK : { ok: false, msg: 'Record at least one interview outcome (Selected / On Hold / Not Suitable) first.' };
    case 'selection':
      return cur.SelectedCandidateId ? OK : { ok: false, msg: 'Take a Selected candidate forward before the offer stage.' };
    case 'offer':
      return cur.OfferReleasedDate ? OK : { ok: false, msg: 'Enter the offer released date first.' };
    default:
      return OK;
  }
}
const REC_DOC_CHECKLIST = DOC_CHECKLIST; // reuse the same document list as pre-onboarding
const recFreshDocs = () => REC_DOC_CHECKLIST.map(d => ({ key: d.key, label: d.label, received: false, fileName: null }));
const REC_DIR = pathmod.join(__dirname, 'uploads', 'recruitment');

// create requisition (hr OR manager)
app.post('/api/recruitment', async (req, res) => {
  if (!can(req, 'hr', 'manager', 'hod')) return deny(res);
  try {
    const b = req.body || {};
    if (!b.role && !b.department) return res.status(400).json({ success: false, error: 'Role or department is required.' });
    const p = await getPool();
    const r = await p.request()
      .input('Dept', sql.NVarChar, b.department || null).input('Role', sql.NVarChar, b.role || null)
      .input('Grade', sql.NVarChar, b.grade || null).input('Pos', sql.Int, b.positions || 1)
      .input('Just', sql.NVarChar, b.justification || null).input('TD', sql.Date, b.targetDate || null)
      .input('Mrf', sql.NVarChar, b.mrfRef || null).input('Aop', sql.Bit, b.aopApproved ? 1 : 0)
      .input('By', sql.NVarChar, actor(req)).input('ByRole', sql.NVarChar, role(req))
      .input('JdText', sql.NVarChar, b.jdText || null)
      .query(`INSERT INTO dbo.Recruitment (Department,Role,Grade,Positions,Justification,TargetDate,MrfRef,AopApproved,CreatedBy,CreatedByRole,JdText)
              OUTPUT INSERTED.* VALUES (@Dept,@Role,@Grade,@Pos,@Just,@TD,@Mrf,@Aop,@By,@ByRole,@JdText)`);
    res.json({ success: true, record: r.recordset[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Lightweight change-fingerprint for fast polling (avoids re-fetching everything twice a second)
app.get('/api/recruitment/version', async (req, res) => {
  if (!can(req, 'hr', 'manager', 'hod', 'interviewer')) return deny(res);
  try {
    const p = await getPool();
    const q = await p.request().query(`SELECT COUNT(*) AS c, CONVERT(VARCHAR(30), MAX(UpdatedAt), 126) AS u FROM dbo.Recruitment`);
    const row = q.recordset[0] || {};
    res.json({ success: true, version: `${row.c || 0}:${row.u || ''}` });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// list (hr/manager/admin). Managers primarily act on approvals but can see all.
app.get('/api/recruitment', async (req, res) => {
  if (!can(req, 'hr', 'manager', 'hod', 'interviewer')) return deny(res);
  try {
    const p = await getPool();
    const reqs = (await p.request().query(`SELECT * FROM dbo.Recruitment ORDER BY
      CASE Status WHEN 'active' THEN 0 ELSE 1 END, UpdatedAt DESC`)).recordset;
    const cands = (await p.request().query(`SELECT * FROM dbo.RecruitmentCandidates ORDER BY CreatedAt`)).recordset;
    const byReq = {}; cands.forEach(c => { (byReq[c.ReqId] = byReq[c.ReqId] || []).push(c); });
    reqs.forEach(r => r.candidates = byReq[r.Id] || []);
    res.json({ success: true, records: reqs, stages: REC_STAGES, checklist: REC_DOC_CHECKLIST });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// update requisition fields + stage (hr; manager may update the requisition they raised)
app.put('/api/recruitment/:id', async (req, res) => {
  if (!can(req, 'hr', 'manager', 'hod')) return deny(res);
  try {
    const b = req.body || {};
    const p = await getPool();
    const cur = (await p.request().input('Id', sql.Int, req.params.id).query(`SELECT * FROM dbo.Recruitment WHERE Id=@Id`)).recordset[0];
    if (!cur) return res.status(404).json({ success: false, error: 'Not found.' });
    const stage = b.stage || cur.Stage;

    // Enforce the workflow: a stage can only be advanced when its required work
    // is complete. Critically, HR cannot move past CV shortlisting until the HOD
    // has accepted/rejected every CV. Backward moves are always allowed.
    if (stage !== cur.Stage) {
      const ci = REC_STAGES.indexOf(cur.Stage), ni = REC_STAGES.indexOf(stage);
      if (ni > ci) {
        // who may advance: HR drives the pipeline; the HOD only hands off the JD (stage 1). Admin always.
        const advancers = cur.Stage === 'jd' ? ['hr', 'hod'] : ['hr'];
        if (!can(req, ...advancers)) return res.status(403).json({ success: false, error: 'Only ' + advancers.join(' / ').toUpperCase() + ' can advance this stage.' });
        const cands = (await p.request().input('R', sql.Int, req.params.id).query(`SELECT * FROM dbo.RecruitmentCandidates WHERE ReqId=@R`)).recordset;
        const gate = recForwardGate(cur, cands);
        if (!gate.ok) return res.status(400).json({ success: false, error: gate.msg });
      }
    }
    const g = (k, col) => { const v = b[k] !== undefined ? b[k] : cur[col]; return v === undefined ? null : v; };
    await p.request()
      .input('Id', sql.Int, req.params.id)
      .input('Dept', sql.NVarChar, g('department', 'Department')).input('Role', sql.NVarChar, g('role', 'Role'))
      .input('Grade', sql.NVarChar, g('grade', 'Grade')).input('Pos', sql.Int, g('positions', 'Positions'))
      .input('Just', sql.NVarChar, g('justification', 'Justification')).input('TD', sql.Date, g('targetDate', 'TargetDate') || null)
      .input('Mrf', sql.NVarChar, g('mrfRef', 'MrfRef')).input('Aop', sql.Bit, (b.aopApproved !== undefined ? b.aopApproved : cur.AopApproved) ? 1 : 0)
      .input('Stage', sql.NVarChar, stage).input('Status', sql.NVarChar, g('status', 'Status')).input('Drop', sql.NVarChar, g('dropReason', 'DropReason'))
      .input('Jd', sql.Bit, (b.jdConfirmed !== undefined ? b.jdConfirmed : cur.JdConfirmed) ? 1 : 0)
      .input('Kra', sql.Bit, (b.kraConfirmed !== undefined ? b.kraConfirmed : cur.KraConfirmed) ? 1 : 0)
      .input('SC', sql.NVarChar, b.sourcingChannels !== undefined ? JSON.stringify(b.sourcingChannels) : cur.SourcingChannels)
      .input('SN', sql.NVarChar, g('sourcingNotes', 'SourcingNotes'))
      .input('NS', sql.Int, g('numScreened', 'NumScreened')).input('NSh', sql.Int, g('numShortlisted', 'NumShortlisted'))
      .input('ScN', sql.NVarChar, g('screeningNotes', 'ScreeningNotes'))
      .input('FN', sql.NVarChar, g('fitmentNotes', 'FitmentNotes')).input('BOk', sql.Bit, (b.budgetOk !== undefined ? b.budgetOk : cur.BudgetOk) ? 1 : 0)
      .input('Sel', sql.Int, g('selectedCandidateId', 'SelectedCandidateId') || null)
      .input('ORD', sql.Date, g('offerReleasedDate', 'OfferReleasedDate') || null).input('ON', sql.NVarChar, g('offerNotes', 'OfferNotes'))
      .input('JdText', sql.NVarChar, g('jdText', 'JdText'))
      .query(`UPDATE dbo.Recruitment SET Department=@Dept,Role=@Role,Grade=@Grade,Positions=@Pos,Justification=@Just,TargetDate=@TD,MrfRef=@Mrf,AopApproved=@Aop,
        Stage=@Stage,Status=@Status,DropReason=@Drop,JdConfirmed=@Jd,KraConfirmed=@Kra,SourcingChannels=@SC,SourcingNotes=@SN,
        NumScreened=@NS,NumShortlisted=@NSh,ScreeningNotes=@ScN,FitmentNotes=@FN,BudgetOk=@BOk,SelectedCandidateId=@Sel,
        OfferReleasedDate=@ORD,OfferNotes=@ON,JdText=@JdText,UpdatedAt=GETDATE() WHERE Id=@Id`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// approvals — requisition & offer — actioned by manager (Approving Authority) or admin
async function setApproval(req, res, kind) {
  if (!can(req, 'manager')) return deny(res);
  try {
    const b = req.body || {};
    const decision = b.decision === 'approve' ? 'approved' : 'rejected';
    const p = await getPool();
    const cols = kind === 'req'
      ? 'ReqApprovalStatus=@D, ReqApprovalBy=@By, ReqApprovalAt=GETDATE(), ReqApprovalRemark=@R'
      : 'OfferApprovalStatus=@D, OfferApprovalBy=@By, OfferApprovalAt=GETDATE(), OfferApprovalRemark=@R';
    await p.request().input('Id', sql.Int, req.params.id).input('D', sql.NVarChar, decision)
      .input('By', sql.NVarChar, actor(req)).input('R', sql.NVarChar, b.remark || null)
      .query(`UPDATE dbo.Recruitment SET ${cols}, UpdatedAt=GETDATE() WHERE Id=@Id`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
}
app.post('/api/recruitment/:id/req-approval', (req, res) => setApproval(req, res, 'req'));
app.post('/api/recruitment/:id/offer-approval', (req, res) => setApproval(req, res, 'offer'));

// candidates
app.post('/api/recruitment/:id/candidates', async (req, res) => {
  if (!can(req, 'hr', 'manager', 'hod')) return deny(res);
  try {
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ success: false, error: 'Candidate name is required.' });
    const p = await getPool();
    const r = await p.request().input('ReqId', sql.Int, req.params.id)
      .input('Name', sql.NVarChar, b.name).input('Phone', sql.NVarChar, b.phone || null)
      .input('Email', sql.NVarChar, b.email || null).input('Source', sql.NVarChar, b.source || null)
      .input('Docs', sql.NVarChar, JSON.stringify(recFreshDocs()))
      .query(`INSERT INTO dbo.RecruitmentCandidates (ReqId,Name,Phone,Email,Source,Documents) OUTPUT INSERTED.* VALUES (@ReqId,@Name,@Phone,@Email,@Source,@Docs)`);
    await p.request().input('R', sql.Int, req.params.id).query(`UPDATE dbo.Recruitment SET UpdatedAt=GETDATE() WHERE Id=@R`);
    res.json({ success: true, record: r.recordset[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
// JD upload / view (on the requisition)
const JD_DIR = pathmod.join(__dirname, 'uploads', 'recruitment_jd');
app.post('/api/recruitment/:id/jd-upload', async (req, res) => {
  if (!can(req, 'hr', 'manager', 'hod')) return deny(res);
  try {
    const b = req.body || {};
    if (!b.dataBase64) return res.status(400).json({ success: false, error: 'Missing file.' });
    fs.mkdirSync(JD_DIR, { recursive: true });
    const safe = String(b.fileName || 'jd.pdf').replace(/[^A-Za-z0-9._-]/g, '_');
    const fname = `${req.params.id}__${safe}`;
    // remove any previous JD for this req
    try { fs.readdirSync(JD_DIR).filter(n => n.startsWith(req.params.id + '__')).forEach(n => fs.rmSync(pathmod.join(JD_DIR, n), { force: true })); } catch {}
    fs.writeFileSync(pathmod.join(JD_DIR, fname), Buffer.from(b.dataBase64.split(',').pop(), 'base64'));
    const p = await getPool();
    await p.request().input('Id', sql.Int, req.params.id).input('F', sql.NVarChar, b.fileName || safe).query(`UPDATE dbo.Recruitment SET JdFileName=@F, UpdatedAt=GETDATE() WHERE Id=@Id`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
app.get('/api/recruitment/:id/jd-file', async (req, res) => {
  if (!can(req, 'hr', 'manager', 'hod', 'interviewer')) return deny(res);
  try {
    if (!fs.existsSync(JD_DIR)) return res.status(404).send('Not found');
    const f = fs.readdirSync(JD_DIR).find(n => n.startsWith(req.params.id + '__'));
    if (!f) return res.status(404).send('Not found');
    res.download(pathmod.join(JD_DIR, f), f.split('__').slice(1).join('__'));
  } catch (err) { res.status(500).send(err.message); }
});

// CV upload -> creates a candidate with the CV attached (HR)
const CV_DIR = pathmod.join(__dirname, 'uploads', 'recruitment_cv');
app.post('/api/recruitment/:id/cv', async (req, res) => {
  if (!can(req, 'hr', 'manager', 'hod')) return deny(res);
  try {
    const b = req.body || {};
    if (!b.dataBase64) return res.status(400).json({ success: false, error: 'Missing file.' });
    const name = b.name || (b.fileName ? b.fileName.replace(/\.[^.]+$/, '') : 'Candidate');
    const p = await getPool();
    const r = await p.request().input('ReqId', sql.Int, req.params.id)
      .input('Name', sql.NVarChar, name).input('CvF', sql.NVarChar, b.fileName || null)
      .input('Docs', sql.NVarChar, JSON.stringify(recFreshDocs()))
      .query(`INSERT INTO dbo.RecruitmentCandidates (ReqId,Name,CvFileName,Documents) OUTPUT INSERTED.Id VALUES (@ReqId,@Name,@CvF,@Docs)`);
    const cid = r.recordset[0].Id;
    const dir = pathmod.join(CV_DIR, String(cid)); fs.mkdirSync(dir, { recursive: true });
    const safe = String(b.fileName || 'cv.pdf').replace(/[^A-Za-z0-9._-]/g, '_');
    fs.writeFileSync(pathmod.join(dir, safe), Buffer.from(b.dataBase64.split(',').pop(), 'base64'));
    await p.request().input('R', sql.Int, req.params.id).query(`UPDATE dbo.Recruitment SET UpdatedAt=GETDATE() WHERE Id=@R`);
    res.json({ success: true, id: cid });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
app.get('/api/recruitment/candidates/:cid/cv', async (req, res) => {
  if (!can(req, 'hr', 'manager', 'hod', 'interviewer')) return deny(res);
  try {
    const dir = pathmod.join(CV_DIR, String(req.params.cid));
    if (!fs.existsSync(dir)) return res.status(404).send('Not found');
    const f = fs.readdirSync(dir)[0];
    if (!f) return res.status(404).send('Not found');
    res.download(pathmod.join(dir, f), f);
  } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/recruitment/candidates/:cid', async (req, res) => {
  if (!can(req, 'hr', 'manager', 'hod', 'interviewer')) return deny(res);
  try {
    const b = req.body || {};
    const p = await getPool();
    const cur = (await p.request().input('Id', sql.Int, req.params.cid).query(`SELECT * FROM dbo.RecruitmentCandidates WHERE Id=@Id`)).recordset[0];
    if (!cur) return res.status(404).json({ success: false, error: 'Not found.' });
    // Field-level rights: each role may only touch its own part of the workflow.
    const rl = role(req), adminR = rl === 'admin';
    if (b.hodDecision !== undefined && !(adminR || rl === 'hod' || rl === 'manager'))
      return res.status(403).json({ success: false, error: 'Only the HOD can accept or reject CVs.' });
    if ((b.assessment !== undefined || b.outcome !== undefined) && !(adminR || rl === 'interviewer'))
      return res.status(403).json({ success: false, error: 'Only the Interviewer can fill the assessment and set the outcome.' });
    if ((b.interviewDate !== undefined || b.interviewTime !== undefined || b.interviewStatus !== undefined) && !(adminR || rl === 'hr'))
      return res.status(403).json({ success: false, error: 'Only HR can schedule interviews.' });
    const g = (k, col) => { const v = b[k] !== undefined ? b[k] : cur[col]; return v === undefined ? null : v; };
    await p.request().input('Id', sql.Int, req.params.cid)
      .input('Name', sql.NVarChar, g('name', 'Name')).input('Phone', sql.NVarChar, g('phone', 'Phone'))
      .input('Email', sql.NVarChar, g('email', 'Email')).input('Source', sql.NVarChar, g('source', 'Source'))
      .input('CS', sql.NVarChar, g('candStatus', 'CandStatus'))
      .input('Iv', sql.NVarChar, b.interviews !== undefined ? JSON.stringify(b.interviews) : cur.Interviews)
      .input('OAD', sql.Date, g('offerAcceptedDate', 'OfferAcceptedDate') || null)
      .input('RAD', sql.Date, g('resignationAcceptedDate', 'ResignationAcceptedDate') || null)
      .input('JD', sql.Date, g('joiningDate', 'JoiningDate') || null)
      .input('Docs', sql.NVarChar, b.documents !== undefined ? JSON.stringify(b.documents) : cur.Documents)
      .input('EN', sql.NVarChar, g('engagementNotes', 'EngagementNotes'))
      .input('Hod', sql.NVarChar, g('hodDecision', 'HodDecision')).input('HodR', sql.NVarChar, g('hodRemark', 'HodRemark'))
      .input('ID', sql.Date, g('interviewDate', 'InterviewDate') || null).input('IT', sql.NVarChar, g('interviewTime', 'InterviewTime'))
      .input('IS', sql.NVarChar, g('interviewStatus', 'InterviewStatus')).input('IN', sql.NVarChar, g('interviewerName', 'InterviewerName'))
      .input('As', sql.NVarChar, b.assessment !== undefined ? JSON.stringify(b.assessment) : cur.Assessment)
      .input('Out', sql.NVarChar, g('outcome', 'Outcome'))
      .query(`UPDATE dbo.RecruitmentCandidates SET Name=@Name,Phone=@Phone,Email=@Email,Source=@Source,CandStatus=@CS,Interviews=@Iv,
        OfferAcceptedDate=@OAD,ResignationAcceptedDate=@RAD,JoiningDate=@JD,Documents=@Docs,EngagementNotes=@EN,
        HodDecision=@Hod,HodRemark=@HodR,InterviewDate=@ID,InterviewTime=@IT,InterviewStatus=@IS,InterviewerName=@IN,Assessment=@As,Outcome=@Out WHERE Id=@Id;
        UPDATE dbo.Recruitment SET UpdatedAt=GETDATE() WHERE Id=(SELECT ReqId FROM dbo.RecruitmentCandidates WHERE Id=@Id)`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
app.delete('/api/recruitment/candidates/:cid', async (req, res) => {
  if (!can(req, 'hr', 'manager', 'hod')) return deny(res);
  try { const p = await getPool(); await p.request().input('Id', sql.Int, req.params.cid).query(`UPDATE dbo.Recruitment SET UpdatedAt=GETDATE() WHERE Id=(SELECT ReqId FROM dbo.RecruitmentCandidates WHERE Id=@Id); DELETE FROM dbo.RecruitmentCandidates WHERE Id=@Id`); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// stage-9 documents on a candidate (upload / view / delete) — mirrors pre-onboarding
app.post('/api/recruitment/candidates/:cid/upload', async (req, res) => {
  if (!can(req, 'hr', 'manager', 'hod', 'interviewer')) return deny(res);
  try {
    const b = req.body || {};
    if (!b.key || !b.dataBase64) return res.status(400).json({ success: false, error: 'Missing file.' });
    const p = await getPool();
    const cur = (await p.request().input('Id', sql.Int, req.params.cid).query(`SELECT Documents FROM dbo.RecruitmentCandidates WHERE Id=@Id`)).recordset[0];
    if (!cur) return res.status(404).json({ success: false, error: 'Not found.' });
    const dir = pathmod.join(REC_DIR, String(req.params.cid)); fs.mkdirSync(dir, { recursive: true });
    const safe = String(b.fileName || (b.key + '.bin')).replace(/[^A-Za-z0-9._-]/g, '_');
    fs.writeFileSync(pathmod.join(dir, `${b.key}__${safe}`), Buffer.from(b.dataBase64.split(',').pop(), 'base64'));
    let docs = []; try { docs = JSON.parse(cur.Documents || '[]'); } catch {}
    docs = docs.map(d => d.key === b.key ? { ...d, received: true, fileName: b.fileName || safe } : d);
    await p.request().input('Id', sql.Int, req.params.cid).input('Docs', sql.NVarChar, JSON.stringify(docs)).query(`UPDATE dbo.RecruitmentCandidates SET Documents=@Docs WHERE Id=@Id; UPDATE dbo.Recruitment SET UpdatedAt=GETDATE() WHERE Id=(SELECT ReqId FROM dbo.RecruitmentCandidates WHERE Id=@Id)`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
app.get('/api/recruitment/candidates/:cid/file/:key', async (req, res) => {
  if (!can(req, 'hr', 'manager', 'hod', 'interviewer')) return deny(res);
  try {
    const dir = pathmod.join(REC_DIR, String(req.params.cid));
    if (!fs.existsSync(dir)) return res.status(404).send('Not found');
    const f = fs.readdirSync(dir).find(n => n.startsWith(req.params.key + '__'));
    if (!f) return res.status(404).send('Not found');
    res.download(pathmod.join(dir, f), f.split('__').slice(1).join('__'));
  } catch (err) { res.status(500).send(err.message); }
});
app.delete('/api/recruitment/candidates/:cid/file/:key', async (req, res) => {
  if (!can(req, 'hr', 'manager')) return deny(res);
  try {
    const p = await getPool();
    const cur = (await p.request().input('Id', sql.Int, req.params.cid).query(`SELECT Documents FROM dbo.RecruitmentCandidates WHERE Id=@Id`)).recordset[0];
    if (!cur) return res.status(404).json({ success: false, error: 'Not found.' });
    const dir = pathmod.join(REC_DIR, String(req.params.cid));
    try { if (fs.existsSync(dir)) { const f = fs.readdirSync(dir).find(n => n.startsWith(req.params.key + '__')); if (f) fs.rmSync(pathmod.join(dir, f), { force: true }); } } catch {}
    let docs = []; try { docs = JSON.parse(cur.Documents || '[]'); } catch {}
    docs = docs.map(d => d.key === req.params.key ? { ...d, received: false, fileName: null } : d);
    await p.request().input('Id', sql.Int, req.params.cid).input('Docs', sql.NVarChar, JSON.stringify(docs)).query(`UPDATE dbo.RecruitmentCandidates SET Documents=@Docs WHERE Id=@Id`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// admin-approved delete of a whole requisition
app.post('/api/recruitment/:id/request-delete', async (req, res) => {
  if (!can(req, 'hr', 'manager', 'hod')) return deny(res);
  try { const p = await getPool(); await p.request().input('Id', sql.Int, req.params.id).input('R', sql.NVarChar, (req.body || {}).reason || null).input('By', sql.NVarChar, actor(req))
    .query(`UPDATE dbo.Recruitment SET DeleteRequested=1, DeleteReason=@R, DeleteRequestedBy=@By, DeleteRequestedAt=GETDATE(), UpdatedAt=GETDATE() WHERE Id=@Id`); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
app.post('/api/recruitment/:id/approve-delete', async (req, res) => {
  if (!can(req)) return deny(res);
  try { const p = await getPool(); await p.request().input('Id', sql.Int, req.params.id).query(`DELETE FROM dbo.RecruitmentCandidates WHERE ReqId=@Id; DELETE FROM dbo.Recruitment WHERE Id=@Id`); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
app.post('/api/recruitment/:id/reject-delete', async (req, res) => {
  if (!can(req)) return deny(res);
  try { const p = await getPool(); await p.request().input('Id', sql.Int, req.params.id).query(`UPDATE dbo.Recruitment SET DeleteRequested=0, DeleteReason=NULL, DeleteRequestedBy=NULL, DeleteRequestedAt=NULL WHERE Id=@Id`); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
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
