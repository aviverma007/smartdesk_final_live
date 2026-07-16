/**
 * MC Review Dashboard — SQL Server schema (auto-migration on boot).
 *
 * Maps directly onto the prototype's in-memory model + the Workflow
 * Definition v2.5 / P4 Order-Number Syntax v1.0 contracts:
 *
 *   - Entries         : one row per "Entry" (NFA + Index + Work Type + date).
 *                       One open (non-terminal) entry per NFA at a time (D5).
 *   - PendingMoves     : the B2 submit-gated relocation ticket, one-to-one
 *                       with an open Entry (nullable columns on Entries
 *                       would also work, but a side table keeps history and
 *                       the audit story straightforward).
 *   - Sheets          : one row per (Index, ReviewDate) — lock state + vN.
 *   - SnapshotRows    : the frozen Page-3 rows for a locked vN. Decisions
 *                       and MC comments live here (per-snapshot, not on the
 *                       live Entry) so "last locked vN" semantics hold even
 *                       as the live Entry moves on.
 *   - PublishedPdfs   : one row per (Index, ReviewDate) publish event; the
 *                       PDF bytes are generated on demand from SnapshotRows
 *                       and cached here as a blob for instant re-download.
 *   - OrderRegister   : the live order-number ledger (§3 of the P4 doc).
 *   - OrderRetired    : the permanent retired ledger — never purged (O1).
 *   - OrderSeq        : one row per Index holding the monotonic counter,
 *                       incremented inside the same transaction as an insert
 *                       into OrderRegister (never allocated in app memory
 *                       before commit) — this is what makes concurrent
 *                       generation race-free (F2/F3, checklist item 9).
 *   - AuditLog        : append-only audit trail, actual login attributed (I8).
 *   - Users           : minimal user/role table (I4 — real AD/SSO is IT-lane;
 *                       this is the interim store so the app is usable now).
 */
const sql = require('mssql');

async function migrate(pool) {
  await pool.request().batch(`
IF OBJECT_ID('dbo.MC_Users','U') IS NULL
CREATE TABLE dbo.MC_Users (
  Id            INT IDENTITY(1,1) PRIMARY KEY,
  LoginId       NVARCHAR(80)  NOT NULL UNIQUE,
  DisplayName   NVARCHAR(120) NOT NULL,
  Role          NVARCHAR(20)  NOT NULL, -- user | revMEP | revCIV | admin
  IsActive      BIT NOT NULL DEFAULT(1),
  CreatedAt     DATETIME NOT NULL DEFAULT(GETDATE())
);

IF OBJECT_ID('dbo.MC_Entries','U') IS NULL
CREATE TABLE dbo.MC_Entries (
  Id              INT IDENTITY(1,1) PRIMARY KEY,
  NfaNo           NVARCHAR(60)  NOT NULL,
  Mode            NVARCHAR(1)   NOT NULL DEFAULT('A'), -- A | B
  IndexName       NVARCHAR(10)  NOT NULL,              -- MEP | CIVIL
  WorkType        NVARCHAR(2)   NOT NULL,              -- A..J
  ReviewDate      DATE          NOT NULL,
  -- Field snapshot (QMS-sourced + hybrid Pick-from-NFA fields). Stored as
  -- JSON so the fixed field-map (v1.4 Excel) can evolve without a schema
  -- migration every time C&P adds/drops a column (P1 field map, still open).
  FieldsJson      NVARCHAR(MAX) NOT NULL DEFAULT('{}'),
  HybridJson      NVARCHAR(MAX) NOT NULL DEFAULT('{}'), -- {field:{pfn,qms,user}}
  TouchJson       NVARCHAR(MAX) NOT NULL DEFAULT('{}'), -- which cells a reviewer touched
  FilesJson       NVARCHAR(MAX) NOT NULL DEFAULT('[]'), -- [{n,t,src}]
  InitiatedBy     NVARCHAR(120) NULL,     -- QMS initiator (Mode A) / free text (Mode B)
  IsProxy         BIT NOT NULL DEFAULT(0),
  InitiatedOn     DATE NULL,
  EnteredBy       NVARCHAR(80)  NOT NULL, -- actual login (audit identity)
  InterimRef      NVARCHAR(40)  NULL,     -- Mode B auto ID e.g. EM/07-26/001
  Status          NVARCHAR(20)  NOT NULL DEFAULT('draft'),
    -- draft | submitted | presented | approved | hold | rejected | expired
    -- | migrated | withdrawn
  Selected        BIT NOT NULL DEFAULT(0),  -- checkbox state pre-submit / on sheet
  PresentToMC     BIT NOT NULL DEFAULT(0),
  ResubRequired   BIT NOT NULL DEFAULT(0),
  ResubComment    NVARCHAR(1000) NULL,
  ResubPriorPdfId INT NULL,
  IsOpen          BIT NOT NULL DEFAULT(1),  -- 0 once terminal (approved/rejected/expired/migrated-away/withdrawn... see note)
  CreatedAt       DATETIME NOT NULL DEFAULT(GETDATE()),
  UpdatedAt       DATETIME NOT NULL DEFAULT(GETDATE())
);

IF OBJECT_ID('dbo.MC_PendingMoves','U') IS NULL
CREATE TABLE dbo.MC_PendingMoves (
  Id              INT IDENTITY(1,1) PRIMARY KEY,
  EntryId         INT NOT NULL REFERENCES dbo.MC_Entries(Id),
  FromIndexName   NVARCHAR(10) NOT NULL,
  FromReviewDate  DATE NOT NULL,
  ToIndexName     NVARCHAR(10) NOT NULL,
  ToWorkType      NVARCHAR(2)  NOT NULL,
  ToReviewDate    DATE NOT NULL,
  FieldsJson      NVARCHAR(MAX) NOT NULL DEFAULT('{}'), -- refreshed QMS fields staged
  FilesJson       NVARCHAR(MAX) NOT NULL DEFAULT('[]'), -- refreshed + staged uploads
  Status          NVARCHAR(20) NOT NULL DEFAULT('pending'), -- pending | applied | cancelled
  CreatedAt       DATETIME NOT NULL DEFAULT(GETDATE())
);

IF OBJECT_ID('dbo.MC_Sheets','U') IS NULL
CREATE TABLE dbo.MC_Sheets (
  Id            INT IDENTITY(1,1) PRIMARY KEY,
  IndexName     NVARCHAR(10) NOT NULL,
  ReviewDate    DATE NOT NULL,
  Locked        BIT NOT NULL DEFAULT(0),
  Version       INT NOT NULL DEFAULT(0),
  LockedAt      DATETIME NULL,
  PublishedRev  INT NOT NULL DEFAULT(0), -- 0 = not published; 1 = published; 2 = corrigendum Rev-2
  PublishedAt   DATETIME NULL,
  CONSTRAINT UQ_MC_Sheets UNIQUE(IndexName, ReviewDate)
);

IF OBJECT_ID('dbo.MC_SnapshotRows','U') IS NULL
CREATE TABLE dbo.MC_SnapshotRows (
  Id            INT IDENTITY(1,1) PRIMARY KEY,
  SheetId       INT NOT NULL REFERENCES dbo.MC_Sheets(Id),
  Version       INT NOT NULL,
  EntryId       INT NOT NULL, -- source entry at lock time (no FK cascade; ghost rows outlive entry moves)
  NfaNo         NVARCHAR(60) NOT NULL,
  WorkType      NVARCHAR(2)  NOT NULL,
  FieldsJson    NVARCHAR(MAX) NOT NULL DEFAULT('{}'),
  Decision      NVARCHAR(10) NULL,      -- approved | hold | rejected | NULL(undecided)
  McComment     NVARCHAR(1000) NULL,
  RelocatedTo   NVARCHAR(120) NULL,     -- e.g. "MEP·09-Jul-2026" when B2/O7 ghost marker applies
  RelocatedAt   DATETIME NULL,
  DecidedAt     DATETIME NULL,
  RowOrder      INT NOT NULL DEFAULT(0)
);

IF OBJECT_ID('dbo.MC_PublishedPdfs','U') IS NULL
CREATE TABLE dbo.MC_PublishedPdfs (
  Id            INT IDENTITY(1,1) PRIMARY KEY,
  IndexName     NVARCHAR(10) NOT NULL,
  ReviewDate    DATE NOT NULL,
  SheetId       INT NOT NULL REFERENCES dbo.MC_Sheets(Id),
  Revision      INT NOT NULL DEFAULT(1), -- 1 = original, 2 = admin corrigendum
  PublishedBy   NVARCHAR(80) NOT NULL,
  PublishedAt   DATETIME NOT NULL DEFAULT(GETDATE()),
  DecidedCount  INT NOT NULL DEFAULT(0),
  UndecidedNos  NVARCHAR(MAX) NULL -- JSON array of numbers-only undecided NFAs
);

IF OBJECT_ID('dbo.MC_OrderSeq','U') IS NULL
CREATE TABLE dbo.MC_OrderSeq (
  IndexName   NVARCHAR(10) PRIMARY KEY, -- MEP | CIVIL
  NextSeq     INT NOT NULL DEFAULT(1)
);
IF NOT EXISTS (SELECT 1 FROM dbo.MC_OrderSeq WHERE IndexName='MEP')
  INSERT INTO dbo.MC_OrderSeq(IndexName, NextSeq) VALUES ('MEP', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.MC_OrderSeq WHERE IndexName='CIVIL')
  INSERT INTO dbo.MC_OrderSeq(IndexName, NextSeq) VALUES ('CIVIL', 1);

IF OBJECT_ID('dbo.MC_OrderRegister','U') IS NULL
CREATE TABLE dbo.MC_OrderRegister (
  Id            INT IDENTITY(1,1) PRIMARY KEY,
  OrderNo       NVARCHAR(60) NOT NULL UNIQUE,
  IndexName     NVARCHAR(10) NOT NULL,
  SeqIndex      INT NULL,
  Mmyy          NVARCHAR(4) NULL,
  NfaNo         NVARCHAR(60) NOT NULL,
  OrderType     NVARCHAR(6)  NOT NULL DEFAULT('PO'), -- PO | SO | WO | LOA
  Vendor        NVARCHAR(300) NULL,
  IsOverride    BIT NOT NULL DEFAULT(0),
  GeneratedBy   NVARCHAR(80) NOT NULL,
  GeneratedAt   DATETIME NOT NULL DEFAULT(GETDATE()),
  Status        NVARCHAR(20) NOT NULL DEFAULT('active')
);

IF OBJECT_ID('dbo.MC_OrderRetired','U') IS NULL
CREATE TABLE dbo.MC_OrderRetired (
  Id              INT IDENTITY(1,1) PRIMARY KEY,
  OrderNo         NVARCHAR(60) NOT NULL UNIQUE,
  OriginalNfaNo   NVARCHAR(60) NULL,
  RetiredBy       NVARCHAR(80) NOT NULL,
  RetiredAt       DATETIME NOT NULL DEFAULT(GETDATE()),
  Reason          NVARCHAR(400) NULL
);

IF OBJECT_ID('dbo.MC_Config','U') IS NULL
CREATE TABLE dbo.MC_Config (
  [Key]   NVARCHAR(60) PRIMARY KEY,
  [Value] NVARCHAR(400) NOT NULL
);
IF NOT EXISTS (SELECT 1 FROM dbo.MC_Config WHERE [Key]='maxOrdersPerNfa')
  INSERT INTO dbo.MC_Config([Key],[Value]) VALUES ('maxOrdersPerNfa','10');
IF NOT EXISTS (SELECT 1 FROM dbo.MC_Config WHERE [Key]='retirementPolicy')
  -- O1 is OPEN — do not decide it. Build retire-forever now; keep this
  -- pluggable so an admin-releasable mode can be switched on later
  -- WITHOUT a schema change, per the P4 syntax doc §4.
  INSERT INTO dbo.MC_Config([Key],[Value]) VALUES ('retirementPolicy','permanent');
IF NOT EXISTS (SELECT 1 FROM dbo.MC_Config WHERE [Key]='migrateWindowDays')
  INSERT INTO dbo.MC_Config([Key],[Value]) VALUES ('migrateWindowDays','10');

IF OBJECT_ID('dbo.MC_AuditLog','U') IS NULL
CREATE TABLE dbo.MC_AuditLog (
  Id        INT IDENTITY(1,1) PRIMARY KEY,
  AtTime    DATETIME NOT NULL DEFAULT(GETDATE()),
  LoginId   NVARCHAR(80) NOT NULL,
  Action    NVARCHAR(120) NOT NULL,
  Detail    NVARCHAR(1000) NULL
);
  `);

  // Seed a minimal user roster if empty (I4 — real AD/SSO is IT-lane).
  const r = await pool.request().query('SELECT COUNT(*) AS c FROM dbo.MC_Users');
  if (r.recordset[0].c === 0) {
    await pool.request().batch(`
INSERT INTO dbo.MC_Users(LoginId, DisplayName, Role) VALUES
  ('dhruv',   'Dhruv',      'user'),
  ('rverma',  'R. Verma',   'revMEP'),
  ('sanand',  'S. Anand',   'revCIV'),
  ('akhilesh','Akhilesh',   'admin');
    `);
  }
}

module.exports = { migrate };
