# MC Review Dashboard

Full-stack build of the Smart World Developers **MC (Management Committee)
Review Dashboard** — a four-page NFA (Note for Approval) workflow: **NFA
Entry → Pre-meeting Review → MC Meeting → Order Numbering.**

This is the production build derived from the IT Handover Pack v1.4
(`docs/`), which contains the Workflow Definition v2.5, the Readiness/UAT
pack, the P4 Order-Number Syntax contract, and the original single-file
HTML prototype the behaviour is validated against. Read
`docs/mc-portal-workflow-definition-v2-5.md` first — it is the build
contract this app implements.

## Stack

- **Backend:** Node.js + Express + SQL Server (`mssql`), same conventions as
  `backend-userrights` elsewhere in this repo — header-based trust auth
  (`x-user-role` / `x-user-id`), `.env` config, tables auto-created on boot.
- **Frontend:** React 19 + Vite, plain CSS (no component library), styled to
  match the original prototype's look.
- **PDF output:** generated server-side with `pdfkit` from the locked
  snapshot at publish time, matched field-for-field against the issued
  reference sample (`docs/reference-pdf-samples/…v3.pdf`) — landscape
  table with the full column set (PR Budget, Orig./Last Amend./This
  Variation/Revised Value, Reason, Validation of Rates, Vend.&PQ, PR No.,
  NFA No. + resubmission remark, Creator, MC Comments/Status), the
  Presented/Approved/Hold/Rejected/Undecided counter line, and the
  verbatim footer/confidentiality copy.

## Folder layout

```
mc-review/
  backend/            Express API (port 5094 by default)
    db/migrate.js      Auto-migration — creates all SQL Server tables
    lib/               auth, reference data, QMS adapter (simulated for now)
    routes/            entries (P1), sheets (P2), meeting (P3), orders (P4), pdf, misc
    server.js
  frontend/           React + Vite app (port 94 by default)
    src/
      api/             axios client + typed method map
      context/         role switcher, toasts
      pages/           Page1..Page4
      components/      shared UI (Modal, AppBar, EndOfSheetMarker)
  docs/               the IT handover documentation this build implements
```

## Seeding dummy data (dev/demo)

With the backend running, in a second terminal:
```
cd backend
npm run seed
```

This drives the app through its own API (not raw SQL), so everything it
creates is workflow-valid. It fetches real, currently-live NFA numbers
from the QMS feed — if any of them have aged out of the feed's result
window by the time you run this, open the feed URL in a browser and swap
in whatever `NFA_No` values currently appear (see the comment at the top
of `scripts/seed-dummy-data.js`):
- Two plain drafts sitting on Page 1 (never submitted)
- Three MEP entries submitted, locked, decided (2 approved + 1 held) and
  **published** for today's date
- One Civil entry submitted to Page 2 but left unlocked, so you can try
  locking/deciding it yourself
- Order numbers generated for the two approved MEP NFAs

Switch roles with the top-right dropdown to see each stage: User (Page 1),
Reviewer-MEP (Pages 2/3, already published), Reviewer-Civil (Page 2, still
actionable), Admin (Page 4 order register).

Safe to re-run for a **different date** — the app refuses new fetches/
submits onto an already-published index+date by design (that's the "one
publish per index per date" rule, not a bug). To re-run against a fresh
date:
```
# macOS/Linux
SEED_DATE=2026-07-22 npm run seed

# Windows PowerShell
$env:SEED_DATE="2026-07-22"; npm run seed
```

## Getting started (dev)

Backend:
```
cd backend
cp .env.example .env     # fill in your SQL Server credentials
npm install
npm start                # listens on :5094, auto-creates tables on first boot
```

Frontend:
```
cd frontend
npm install
npm run dev               # listens on :94
```

The frontend's dev server proxies nothing — it calls the API directly at
`VITE_API_BASE` (see `frontend/.env`), falling back at runtime to
`http://<current-host>:5094/api` when opened from anywhere other than
localhost (so the same build works via `swdsales.com` in production).

## Role switching (dev / demo)

There is no real login yet (I4 — AD/SSO is IT-owned and out of scope here).
Use the role switcher in the top-right of the app bar: **User**, **Reviewer
— MEP**, **Reviewer — Civil**, **Admin**. This flips the `x-user-role` /
`x-user-id` headers sent on every request; the backend gates on those.

## What's implemented

Everything in Workflow Definition v2.5, including the build queue B1–B7:

- **B1** end-of-sheet marker (Pages 2/3, screen-only, never in the PDF).
- **B2** submit-gated relocation — the full pending-move ticket model:
  same-slot re-fetch = re-pull (B7 file replace/restore); differing re-fetch
  on a submitted/presented entry stages a ticket; Submit performs the atomic
  swap with revalidation (old-published → fresh-entry + mandatory comment;
  target-published → refused; MC-decided → refused per **O7** unless the
  operator clears the decision; undecided → swap + Page-3 relocated marker,
  **F8** publish guard).
- **B3/F14** Entry Date View vs Review Date — independent controls, today
  aggregates all open entries across dates.
- **B4** zero-decided publish warning + publish disabled on an empty
  snapshot.
- **B5** locked-target migrate (arrivals land deselected).
- **B6** "Add N more orders" after first generation.
- **B7** replace-by-filename re-pull, user uploads never touched.
- **F13** Mode-B has no link-NFA control (by design — do not re-introduce).
- Page 4 order numbering per the **P4 Order-Number Syntax v1.0** doc exactly:
  `ORD/{MEP|CIV}/MMYY-####`, per-index DB-allocated monotonic sequence,
  collision-safe against both the live register and the **permanent retired
  ledger**, manual override with uniqueness checks, delete = retire-forever
  (**O1 is left open** — retire-forever is built now; the release-policy
  switch is a config value with no release path wired, per instruction).

## What's simulated / stubbed for now

- **Auth** — header-based trust, matching the existing SmartDesk pattern.
  Real AD/SSO (I4) is a separate IT lane.
- **QMS attached files** — the live PR/NFA feed (see below) does not expose
  document/attachment data, so `files` stays empty until the QMS
  file-store integration is separately wired.
- **Server date** — the backend derives `today` from its own clock
  (`lib/reference.js: todayISO()`), never from the client, per I10/F9. There
  is no "frozen demo date" like the prototype's `05-Jul-2026` — this build
  always uses the real server date.

## QMS integration (live)

`backend/lib/qmsAdapter.js` fetches from the real PR/NFA feed:
```
https://smartworlddevelopersonline.com/SapPrNFATatReport.php?startdate=2025-01-01&enddate=<today>
```
`startdate` is fixed at `2025-01-01`; `enddate` is always today's date on
the server's own clock (never client-supplied, per I10/F9). Results are
cached in-memory for 60s to avoid re-fetching the full feed on every
keystroke. NFA numbers are matched with/without the feed's zero-padding
(e.g. `14315` and `0000014315` both resolve to the same record).

Field mapping from the feed's SAP-style names to the dashboard's internal
shape lives in `mapRecord()` in that file — e.g. `NFA_Title` → `desc`,
`NFA_Budget` ("23.00 Lacs") → `val`/`prBudget` (numeric string), multiple
`Vendor_One..Vendor_Five` → a single combined `vendor` string, `NFA_Title`
+ `Subject_Of_NFA` → `desc`/`reason`. If the feed's shape changes, this is
the only place to update.

## Known open items (carried from the handover pack, not decided here)

- **O1** — retired order numbers: retire-forever vs admin-releasable. Built
  retire-forever; the policy switch (`MC_Config.retirementPolicy`) exists
  but no release path is wired. Do not decide this without a ruling from
  C&P.
- Final Page-4 order-number syntax (Stage 2) — the interim format is what's
  implemented; Stage-2 activation is meant to be config-driven per the P4
  doc §5 and does not renumber history.
- Real QMS API wiring, AD/SSO, and server-side PDF caching at scale are
  IT-lane items per the readiness doc's I-series.
