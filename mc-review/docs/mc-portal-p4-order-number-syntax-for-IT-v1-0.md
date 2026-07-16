# Page-4 Order-Number Syntax — Handover to IT

**Version:** 1.0 · 6 July 2026 · **Owner:** Dhruv — Contracts & Procurement, Smart World Developers
**Companion to:** Workflow Definition v2.5 (§1.14, §7, §14 D7/D14→O1) · Readiness/UAT v1.7 (§4 O1, §6 F7) · Prototype v1.4 (`mc-review-dashboard-prototype-v1-4.html`, Page 4)
**Purpose:** Freeze the **interim** Page-4 order-number syntax and its full behavioural contract so IT can build it on-prem now, while on-prem testing runs, without waiting for the Stage-2 final syntax pack. This document is the authority for the *behaviour*; the interim *format string* is a placeholder that Stage 2 replaces (§5).
**Standing constraints:** the retire-forever policy (O1) is **open — do not decide it** (§4); build retire-forever now with a pluggable switch. Server date and DB are IT-lane (I5, I10). Numbering config is admin-owned.

---

## 1. Interim syntax — `ORD/{MEP|CIV}/MMYY-####`

The prototype generates exactly this string (see `App.genOrders`, prototype line 964):

```
ORD / {MEP|CIV} / MMYY - ####
 └1     └─2         └3    └4
```

| # | Segment | Semantics | Rules |
|---|---|---|---|
| 1 | `ORD` | Literal prefix — "order". | Fixed. Uppercase. |
| 2 | Index token | Origin index of the approved NFA. | **`MEP`** for MEP & Procurement; **`CIV`** for Civil & Consultancy. Note the asymmetry — MEP keeps three letters, Civil is abbreviated to `CIV` (prototype: `e.index==='MEP'?'MEP':'CIV'`). Reproduce exactly; do **not** normalise both to three letters or use full index names. |
| 3 | `MMYY` | Month + 2-digit year of issue. | `MM` = 2-digit month (`07`), `YY` = 2-digit year (`26`) → `0726` for July 2026. **Source differs prototype vs production (see below).** No separator inside MMYY. |
| 4 | `####` | Per-index monotonic sequence number. | **Zero-padded to 4 digits** (`padStart(4,'0')` → `0034`). Strictly increasing per index. **Not** reset per month or per NFA — it is a single running counter per index (see §1.2). |

**Separators:** forward slash between segments 1-2 and 2-3; a hyphen `-` between MMYY and the sequence. Example live values: `ORD/MEP/0726-0034`, `ORD/CIV/0726-0008`. Seed reference row: `ORD/MEP/0626-0027` (June 2026 issue — see §1.3).

### 1.1 MMYY source — prototype vs production (**I10, F9**)

- **Prototype (frozen):** MMYY is derived from the frozen `TODAY = 05-Jul-2026` at generation time (`TODAY.slice(0,6)` feeds the timestamp; the format literal is hardcoded `0726`). Because the prototype freezes TODAY, review-month and issue-month coincide, so the distinction is invisible in the demo.
- **Production (build to this):** MMYY MUST come from the **trusted server date at the moment the order number is allocated** (I10 — server date, never client clock; F9 closed only when server-sourced). Do **not** derive it from the NFA's review date or approval date. An NFA approved 29-Jun but issued an order on 03-Jul gets `0703…` per the prototype-equivalent rule (issue month), **not** `0629…`. Confirm this reading with C&P at IT dummy build if any order is expected to inherit the review month instead — the prototype's own seed (`0626` on a 29-Jun-approved NFA vs `0726` on new generations) is consistent with **issue-month**, so build issue-month unless overridden.

### 1.2 Per-index monotonic sequence

- Two independent running counters — one per index (`ordMEP`, `ordCIVIL` in the prototype; `seq = { …, ordMEP:33, ordCIVIL:7 }` at prototype line 256). MEP's next generation is `0034`; Civil's is `0008`.
- The counter is incremented **once per order row** at generation, across all NFAs of that index — it is **global per index**, not per NFA and not per month. Two NFAs in MEP generating one order each get consecutive numbers.
- The counter **only ever increases**. It is never decremented on delete/retire (§2.4) — this is what makes retirement permanent in the sequence dimension. In production this counter is a DB-allocated sequence (§3), not an in-memory integer.

### 1.3 Non-renumbering across periods

Existing numbers are **never rewritten** when the month rolls over or when the Stage-2 syntax activates (§5). The `MMYY` is a *stamp of issue*, not a live field — `ORD/MEP/0626-0027` stays `0626` forever even though the counter has since moved into July. History is immutable; only newly allocated numbers use the current MMYY.

---

## 2. Behavioural contract IT must reproduce

Source of truth: prototype `App.genOrders / overrideNo / delOrderAsk / doDelOrder / setMax` (lines 960–974) and the Page-4 render (lines 640–673). Every behaviour below is asserted in the passing regression suite; treat as acceptance-locked.

### 2.1 Generation (count dropdown; default 1; admin max 10)

- Every published-**APPROVED** NFA auto-lists on Page 4 (prototype `approvedEntries()`), with its MC comment shown for release guidance.
- Per NFA a **No. of orders** dropdown offers `1 … maxOrders`. **Default selection = 1.** `maxOrders` defaults to **10** and is **admin-configurable** (`state.maxOrders`; admin edits it inline, audited as *"Max orders/NFA set"*). Non-admins see it read-only.
- **Generate order number** creates N rows in one action; each row gets the next per-index sequence number, `vendor=''`, `type='PO'` (default), `by = current login`, `at = issue timestamp`, `ov=false` (not overridden).
- **Collision-safe allocation:** generation skips over any candidate number that is already **live or retired** (e.g. a slot a user manually overrode ahead of the sequence), advancing the counter until a free number is found. No allocation path may ever mint a duplicate.
- Audit line: **`Orders generated — {NFA} × {N}`**.
- Toast names the NFA and prompts vendor entry per row.

### 2.2 Add-more (B6)

- After the first generation for an NFA, the button relabels to **"Add N more orders"** where N live-tracks the count dropdown (`genLabel`), pluralised correctly.
- Clicking requires a **one-line confirm**: *"Add N more order number(s) against {NFA}? Existing order rows stay untouched."* Cancel aborts with no change.
- On confirm, N further rows append; **existing rows are untouched** (numbers, vendors, types, override flags all preserved). New rows draw the next sequence numbers.
- Same audit line as generation.

### 2.3 Manual override (uniqueness + revert + audit)

- Each order-number cell is editable in place (`overrideNo`). On change:
  1. **Empty input → revert** to the current value (re-render, no change, no audit). A blank is never accepted.
  2. **Uniqueness check** against all live order numbers except the cell itself, **and against the retired ledger** (the prototype implements both — the ledger check was added in the v1.4 audit round). Production checks the same union in the DB (§3).
  3. **Clash → revert + error toast** — live clash: *"Order number must be unique — {value} already exists"*; retired clash: *"Order number {value} was deleted earlier — retired, permanently unavailable (never re-issued)"*. No audit, original value restored.
  4. **Accepted change** → value replaced, row flagged `ov=true` (renders "manual override · audited" sub-label), audit line **`Order no. override — {NFA} → {new value}`**.
- Override does not touch the sequence counter (the auto-generated number it displaced is simply overwritten in that row; the counter already advanced when the row was generated). See the concurrency/ledger obligation in §3.

### 2.4 Delete ✕ = permanent retirement (the permanent ledger)

- Delete ✕ opens a confirm modal: heading *"Delete order number?"*, body names the number, the NFA, and vendor if set, states **"The number is retired, not reused, and the deletion is audit-logged. Any PO/SO already issued in QMS against it must be voided there separately."** Buttons: *Keep order number* / *Delete order number* (red).
- On confirm (`doDelOrder`): the row is removed, audit line **`Order number deleted — {number} ({NFA})`**, warn toast *"Order number {number} deleted — retired & audited"*.
- **Retire-forever semantics (I5 + O1):** a deleted number is **never re-issued** — not by a later Generate on the same NFA, not on any other NFA, not across dates, and not via a manual override typing it back in. The retirement is permanent along **every** allocation path.
  - *Prototype reference:* the prototype maintains this ledger in memory (`state.retired`, appended by `doDelOrder` and checked by both `genOrders` and `overrideNo` — added in the v1.4 audit round), so the behaviour is demonstrable in the browser. Being in-memory it resets on reload — **production persists the same ledger in the DB (§3) so retirement survives forever.**

### 2.5 Order register fields (per row)

number · order type (PO/SO/WO/LOA) · NFA ref · vendor/supplier/contractor (typed in place) · generated-by (login) · timestamp · override flag/trail · delete/retire trail. Users see their own orders; reviewer/admin see all (§14 D4).

---

## 3. DB obligations (I5)

The prototype's in-memory `seq` counters and row arrays are placeholders. Production owns persistence, uniqueness, and concurrency. Suggested schema:

**`order_register`** (the live ledger)
| Column | Notes |
|---|---|
| `order_no` | PK / unique. Full syntax string. |
| `index` | `MEP` \| `CIV`. |
| `seq_index` | integer allocated from the per-index sequence. |
| `mmyy` | issue month stamp (from server date at allocation). |
| `nfa_ref` | FK to the approved NFA. |
| `order_type` | PO \| SO \| WO \| LOA. |
| `vendor` | free text, editable. |
| `is_override` | bool — true if manually overridden. |
| `generated_by` | login. |
| `generated_at` | server timestamp. |
| `status` | `active`. |

**`order_retired_ledger`** (the permanent ledger — never purged)
| Column | Notes |
|---|---|
| `order_no` | the retired string. |
| `original_nfa_ref` · `retired_by` · `retired_at` | audit context. |
| `reason` | optional. |

**Uniqueness rule (I5, closes F7):** on **both** Generate and manual override, the candidate number MUST be checked unique against **live `order_register` AND `order_retired_ledger`** (union). A collision on either → reject (override reverts with the error toast; a generation collision should never occur if the sequence is DB-allocated, but the union check is the backstop). The prototype demonstrates exactly this union check in memory; production persists it.

**Sequence allocation:** the per-index `####` counter is a **DB sequence / atomic counter per index**, not a client integer. Allocate inside the same transaction that inserts the row.

**Concurrency (F2 / F3-style race on sequence allocation):** two users generating orders for the same index at the same instant must not receive the same `####`. Enforce with a DB sequence or `SELECT … FOR UPDATE` on a per-index counter row, or a unique constraint on `(index, seq_index)` with retry. Never allocate the number in application memory before commit. The same transaction must re-check the retired ledger so a number retired micro-seconds earlier is not re-minted. Audit every generate / add-more / override / retire with actual login (I8).

---

## 4. Open ruling O1 — **verbatim, do not decide**

> **O1. Retired order numbers — OPEN (last one).** Retire-forever vs admin-releasable; ledger checked on generate and override. **v1.3 retains retire-forever untouched; the policy switch stays pending — deliberately not decided in the build.**

(Workflow v2.5 §14 records the same: *"D14 removed → tracked as open ruling O1: retired order numbers — current build retires forever, never re-issues, including across dates and after overrides; the release-policy switch stays pending and undecided."*)

**Instruction to IT:** build **retire-forever now** (the ledger of §3 is never consulted for release). Keep the release policy **pluggable** — a single config point (e.g. `retirement_policy = 'permanent' | 'admin_releasable'`) so that if C&P later rules admin-releasable, an admin action can move a row from the retired ledger back to available without a schema change. **Do not implement the release path, and do not decide the ruling.**

---

## 5. Stage-2 syntax pack — activation path

- The `ORD/{MEP|CIV}/MMYY-####` string is **interim** (Workflow v2.5 §1.14, §7.2, §13; D7). The **final syntax pack is a Stage-2 gate** — it is out of scope for the current version and will be issued separately.
- **Activation without renumbering history:** when the final syntax activates, it applies **only to newly allocated numbers**. All existing numbers (live and retired) keep their interim strings unchanged (§1.3). No back-fill, no rewrite, no renumber. The retired ledger continues to guard the old strings for uniqueness forever.
- **Config-driven, admin-owned:** the number format itself must be a **configuration artifact**, not hardcoded (unlike the prototype, which hardcodes the literal). Expose format template, per-index tokens, padding width, and MMYY source as **admin-owned numbering config**. Stage-2 activation is then a config change plus a cut-over date, not a code release.
- Keep segment structure extensible: the Stage-2 format may add or reorder tokens (e.g. project code, work-type). Model the number as (template + resolved fields), so the persisted `order_no` remains the single canonical string while the generator can evolve.

---

## 6. Acceptance checks (IT-runnable)

Mirror the prototype's asserted behaviour. Build passes when all hold:

1. **Format** — a freshly generated MEP number matches `^ORD/MEP/\d{4}-\d{4}$`; a Civil number matches `^ORD/CIV/\d{4}-\d{4}$`. Sequence is 4-digit zero-padded.
2. **MMYY = server date** — set the server clock to a different month than an NFA's approval date; a newly generated number carries the **issue** month, not the approval month.
3. **Per-index monotonic** — generate on two different MEP NFAs; the second number's `####` is exactly the first + 1. Civil counter is independent of MEP.
4. **Default count = 1**; dropdown ceiling equals admin `maxOrders` (default 10); admin change to `maxOrders` re-caps the dropdown and is audited.
5. **Add-more (B6)** — after first generation the button reads *"Add N more orders"* tracking the selector; confirm dialog fires; on confirm existing rows are byte-for-byte unchanged and only new rows appear.
6. **Override uniqueness** — override to an existing **live** number → revert + error toast, no audit. Override to a blank → revert. Valid override → value changes, `is_override` set, audit line written.
7. **Override vs retired** — retire number X, then override another row to X → **rejected** (revert + "retired, permanently unavailable" error). Passes on the prototype (within a session) and MUST pass in production against the persisted ledger, including across sessions and dates.
8. **Delete = permanent retirement** — delete a number; confirm it (a) leaves the live register, (b) lands in the retired ledger, (c) is never re-minted by a subsequent Generate on the same or another NFA, and (d) cannot be re-created via override (check 7). Across a date/month boundary too.
9. **Concurrency** — two simultaneous generations on the same index yield two distinct consecutive numbers, never a duplicate (run under load / forced contention).
10. **Audit** — generate, add-more, override, retire each write one audit line attributed to the actual login (I8), with the NFA and number named.
11. **Non-renumbering** — pre-existing interim-format numbers are unchanged after Stage-2 activation; only new numbers use the new format.
12. **O1 retire-forever** — no UI or API path releases a retired number in the current build; the policy switch exists but the release action is not wired.

---

*Interim syntax and behaviour frozen for IT adaptation. Final syntax pack (Stage 2) supersedes segment 3/4 formatting only, never history. Questions / MMYY-source confirmation → Dhruv, C&P.*
