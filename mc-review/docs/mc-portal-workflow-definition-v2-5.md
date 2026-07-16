# MC Review Dashboard — Workflow & Feature Definition

**Phase:** Prototype validation (working build v1.3 in hand) → Requirements + prototype handover to IT (IT develops the production system on-prem)
**Version:** Draft 2.5 — **IN PARITY WITH PROTOTYPE v1.3** — 6 July 2026 (supersedes 2.4; folds build queue B1–B7, rulings O2-rework/O3–O7, the F13 omission, F14 today-view and the calendar rename)
**Owner:** Dhruv — Contracts & Procurement, Smart World Developers (Mihir's Round 1–2 decisions inherited)
**Parity rule:** from v2.4 onward the definition and the prototype move together — every behaviour below exists in build v1.3 and passed a **146-check automated UI regression, green twice consecutively, zero console errors**. IT builds to this document; the prototype is the visual/behavioural reference.
**Freeze rule:** residual defaults in §14 auto-lock at IT build kickoff unless overridden.

---

## 0. Changelog v2.4 → v2.5 (build queue B1–B7 + rulings folded)

1. **B2 — Submit-gated relocation (pending-move model; O2-rework + O7).** Re-fetching an open NFA whose strip **Index / Work Type / Review Date differ** from the open entry no longer edits anything immediately: the single entry object gains a **pending-move ticket** (new index/WT/date + refreshed QMS fields + attachment refresh, all staged). Page 2 is untouched at fetch. Page 1 renders **one row** showing the pending values, checkbox pre-ticked, with the chip *"Pending move from CIVIL·08-Jul — submit to apply · previous entry still on Page 2."* **Submit applies the move as an atomic swap:** the old Page-2 presence is removed, the entry commits to the new index/WT/date, a locked destination receives it **deselected**, and the action is audited with both sides named (*"Entry relocated CIVIL·08-Jul → MEP·07-Jul (submit-gated)"*). **Submit-time revalidation:** old date published mid-pending → the ticket converts to the **fresh-entry path** (resubmit flag + mandatory comment before Submit completes); target date published → refused, ticket stays editable; **presented + decided in MC → refused per O7** (*"already reviewed in MC — outcome will publish; re-present via a fresh entry after the PDF"*) — the MC operator can clear the decision (same-button toggle) to release the move; presented + undecided → swap proceeds and the old **snapshot row on Page 3 gains a "live entry relocated to …" marker**; decisions recorded on that ghost row write to **NFA history only** (the F8 publish guard). **Cancel/replace:** a same-values fetch clears the ticket (normal re-pull); a newer differing fetch replaces it; unsubmitted tickets stay dormant. Invariants hold throughout: D5 single entry object, P2-uniqueness in every intermediate state, atomic swap.
2. **F8 publish guard formalised.** Publish writes a live entry's status **only if the entry still resides on the publishing index + date**; otherwise the snapshot row's outcome records to NFA history (registry + PDF) only. Post-lock in-place re-pulls still close with the sitting outcome (§0-5 of v2.4 unchanged) — the guard bites only when the live entry has legitimately departed via a permitted relocation.
3. **B3 / F14 — Page-1 calendars reworked.** The sub-tabs-row control is renamed **"Entry Date View"**; the quick-entry strip control stays **"Review Date"**; the two are **fully independent** — neither changes the other, and a fetch no longer jumps the view. **Today-view rule:** Entry Date View = today lists **all** the user's open entries (draft / submitted / presented / pending-move) for today **and every future date**, sorted by Review Date then entry order; today's closed outcomes (published that day) remain listed for the day. A future date filters to that date only. The strip date defaults to today and **persists through the session** (reset on reload). Toasts on create/relocate name the target review date. Mode-B creation follows the same no-jump rule.
4. **B1 — End-of-sheet marker.** `- - x End of Sheet x - -` renders centred after the final row on **Pages 2 and 3**, only when the sheet has rows; never on empty states; never in the published PDF.
5. **B4 — Publish rules tightened.** A zero-decided publish is allowed with the explicit warning *"0 decided — publishing will expire all N presented entries."* Publish is **disabled entirely on an empty snapshot** (zero presented — the button renders disabled).
6. **B5 — Migrate into a locked target.** Allowed; arrivals land **deselected**; the target's lock and snapshot are untouched; the migrate toast notes *"N arrived deselected on a locked sheet."* (Migrate window and merge semantics unchanged from v2.4 §0-7.)
7. **B6 — Add-more Generate.** After the first generation for an NFA, the Page-4 button reads **"Add N more orders"** (tracking the count selector) with a one-line confirm; existing order rows are untouched; the Delete ✕ retire flow is unchanged.
8. **B7 — Replace-by-name re-pull.** A re-pull (including the staged refresh inside a pending-move ticket) **replaces QMS-sourced files by filename** and restores missing ones; **user uploads are never touched**; the audit line notes the replaced count.
9. **F13 — Mode-B "link NFA no." omitted.** The link control and its handlers are removed from the build; the interim reference is cited in QMS at NFA initiation and the **Remarks breadcrumb is the manual linking practice**. (Do not re-introduce — standing decision.)

*(The v2.3 → v2.4 changelog is preserved in the archived v2.4 document.)*

---

## 1. Locked decision register (cumulative)

1. Excel tracker fully replaced by Page 1; dashboard DB is the system of record. QMS read-only, one-way QMS → Dashboard; users cite the interim reference inside QMS at NFA initiation.
2. Four pages: **P1 NFA Entry → P2 Pre-meeting Review → P3 MC Meeting → P4 Order Numbering.**
3. Roles: User (30+), Reviewer (per index), Admin; MC members need no login (Model A — one operator records consolidated decisions). **Users: P1/P4 interactive, P2 view-only, P3 no access.**
4. Entry = Index (Civil & Consultancy / MEP & Procurement) + Work Type (A–J) + review date (**today or future only**; full calendar to 31-Dec-2035) + NFA number (Mode A) or full form (Mode B).
5. **Submission = checkbox + Submit** (row checkboxes; select-all top-left; the checked set flows to Page 2; deselect + re-Submit withdraws — pre-lock, and withdrawal also clears any Present-to-MC mark).
6. Proxy entry allowed; **NFA Initiator** column = QMS initiator (Mode A) / free text (Mode B); actual login in the audit trail; proxy marked with an asterisk on the Initiator only. "Entered By" column is admin-view only.
7. QMS pulls at entry creation and on **re-pull** of any open entry (refreshes fields, **replaces QMS files by filename, restores missing ones — user uploads never touched (B7)**, merges staged uploads); 'Pick from NFA' defaults ticked; unticked shows QMS text prefilled and editable; user text supersedes silently.
8. Duplicate rule: an NFA has **one open entry at a time** — re-fetch of that entry with the **same** Index/WT/date is a re-pull, never a duplicate; re-fetch with **differing** Index/WT/date stages a **submit-gated pending-move ticket (B2)** on that same entry object — one entry, one row, P2-uniqueness preserved in every intermediate state. Re-entry of previously presented NFAs (held/rejected/expired) = fresh entry with **mandatory resubmission comment**; resubmit flags on Page 1 (warning + prior outcome/date) and Page 2 (badge + PDF link).
9. No auto carry-forward by users; closed outcomes → fresh Page 1 entry, fresh QMS pull. **Reviewer migrate** moves an unpublished sheet wholesale within the today → today+10 window, in either direction (postpone or bring back); **a locked target is a valid destination — arrivals land deselected and the target's lock and snapshot stay untouched (B5)**.
10. Sheet Lock (per index + date) = snapshot vN to Page 3; any curation unlocks; Page 3 always shows the **last locked vN**; **zero-selection lock is valid** (Page 3: "No NFAs for review"). Unselected entries are **held, not expired**; only presented-undecided entries expire, at publish.
11. Re-entry against a **locked** sheet lands submitted + auto-deselected; against a **published** date it is refused (*"published; the date is closed"*); at publish, snapshot rows close by their sitting outcome regardless of post-lock updates — **except that a live entry which departed via a permitted submit-gated relocation is untouched (F8): its ghost row's outcome records to NFA history only, and Page 3 marks the ghost "live entry relocated to …"**. Pending-move tickets revalidate at Submit (old published → fresh-entry path; target published → refused; decided in MC → refused per O7).
12. One MC sitting covers both indices; index tabs on Pages 2–3; **two PDFs per sitting**; PDF = decided entries only, from the snapshot; undecided listed by number only at the PDF foot, excluded and expired; publish gated by confirmation (**with the zero-decided warning, B4; disabled on an empty snapshot**); one publish per index per date; corrigendum = admin-only Revision-2.
13. Hold/Reject comments optional on Page 3; decisions save versioned through the session; decision UI = thumbs-up/pause/thumbs-down buttons, same-click clears.
14. Page 4: approved NFAs auto-list; order-count dropdown (default 1, ≤10 admin-config); Generate → N rows; after first generation the button reads **"Add N more orders"** with one-line confirm (B6); unique number per vendor row; vendor typed in place; order type per row; manual override audited; **Delete ✕ retires a number permanently (never reused), with warning + audit**; syntax pack = Stage 2 gate (interim `ORD/IDX/MMYY-####`).
15. Hosting on-premises, IT-managed; IT builds from this doc + prototype v1.3 (dummy → C&P validation → live); QMS API dated **10 July** (Chintoo Kumar / vendor Globe); Claude access via IT (Akhilesh Sharma).
16. Attendee capture parked; in-app analytics good-to-have.

---

## 2. Terminology

**Index** (Civil & Consultancy | MEP & Procurement) · **Work Type (A–J)** · **Entry** (one submission of an NFA/manual case for one date; Entry ≠ NFA) · **Entered by** (login; audit identity; admin-visible column) vs **NFA Initiator** (QMS initiator or Mode B free text; displayed name; asterisk = proxy) · **Initiated on** (QMS initiation date; sub-line under the NFA number everywhere incl. PDF) · **Sheet** (Page 2 grid for one date + index) · **Lock / vN** (snapshot of the sheet pushed to Page 3) · **Held** (unselected at lock; bottom of category; still selectable) · **Pending-move ticket** (staged relocation on an open entry — new index/WT/date + refreshed fields/files; applies atomically at Submit; B2) · **Relocated marker** (Page-3 note on a ghost snapshot row whose live entry departed; decisions there are history-only) · **Entry Date View** (Page-1 list date control; today aggregates all open entries across dates) · **End-of-sheet marker** (`- - x End of Sheet x - -`, Pages 2–3) · **Published PDF** (per-index output; closes the date; resubmit-flag trigger) · **Retired number** (deleted order number; permanently unavailable) · **Interim reference** (Mode B auto ID; `EM/07-26/001`; Remarks breadcrumb is the manual linking practice — F13 omitted).

---

## 3. Entry lifecycle

```
DRAFT ◄── deselect + Submit (withdraw; clears MC mark) ──┐
  │                                                      │
  └── checkbox + Submit ──► SUBMITTED (on P2) ───────────┘   pre-lock, unlimited
          │                        ▲
          │   reviewer curates     │ re-fetch, SAME index/WT/date, sheet LOCKED:
          │   (select/deselect/    │ fields update, back to SUBMITTED,
          │    touch-up in cell)   │ AUTO-DESELECTED; sheet stays locked,
          │                        │ P3 keeps its snapshot
          │                        │
          │      re-fetch, DIFFERING index/WT/date (submitted/presented):
          │      ── PENDING-MOVE TICKET staged on the same entry ──
          │      P1 shows pending values, pre-ticked; P2 untouched;
          │      Submit = atomic swap (revalidated: old published → fresh-entry
          │      path; target published → refused; MC-decided → refused per O7;
          │      undecided → swap + "relocated" ghost marker on P3, F8 applies)
          ▼
   ██ LOCK = snapshot vN ██ ──► P3 shows last locked vN (only path to P3)
          │
          ├─ not selected at lock ──► HELD (bottom of category; selectable;
          │                            re-lock or migrate later — no expiry)
          ▼
     PRESENTED (P3, vN) — decisions save versioned through the session
          │
   ┌──────┴───────┬──────────────┬───────────────────┐
   ▼              ▼              ▼                   ▼
APPROVED        HOLD          REJECTED           UNDECIDED
   │              └── in PDF (comments optional) ──┘  │
   ▼                                                  ▼ at PUBLISH:
P4: N order rows                              numbers-only note in PDF,
(add-more per B6; delete ✕ = retire)          then EXPIRED

PUBLISH closes the date: snapshot rows close by sitting outcome even if
re-entered post-lock (the update is not published and dies with the date);
a live entry that DEPARTED via permitted relocation is untouched — its ghost
row's outcome is history-only (F8). Further entry/migrate against the date →
"published; the date is closed".
Sheet never reviewed in time? MIGRATE (today ↔ today+10, either direction,
unpublished targets only — locked targets allowed, arrivals deselected;
selections kept, draft decisions dropped, audited).
Onward journey after any closure = new Page 1 entry: fresh QMS pull,
resubmit flag on P1 + P2, mandatory resubmission comment.
```

---

## 4. Page 1 — NFA Entry (30+ users)

**Anchors:** sub-tabs **My Entries | Published PDFs | NFA Search & History** with the **Entry Date View** control at the right end of that row (app bar stays constant-height); quick-entry strip (NFA number, Index, Work Type, **Review Date**, Upload files, Fetch from QMS, Mode B link); select-all + per-row checkboxes; **Submit** pushes the checked set and applies pending moves.

1. **Date rules (B3/F14):** entry and list dates are **today or future** — past days are disabled in every calendar; the calendar footer prints the selectable window. **Entry Date View and the strip Review Date are fully independent**: neither changes the other, and a fetch never jumps the view. **Entry Date View = today** lists all the user's open entries (draft/submitted/presented/pending-move) for today **and every future date**, sorted by Review Date then entry order — today's published outcomes stay listed for the day; **a future date** filters to exactly that date (yellow status marks a future sheet); an un-entered date shows a clean blank state. The strip Review Date defaults to today and persists through the session (reset on reload). History browsing happens in Published PDFs and NFA Search, which reach any past date.
2. **Mode A:** validations — (1) NFA not in QMS → error + offer Mode B; (2) NFA already open → **re-pull or pending move** (below); (3) NFA in a published PDF → resubmit flag + mandatory resubmission comment; (4) target date published → refused (*"published; the date is closed"*). QMS auto-fill; hybrid 'Pick from NFA' fields; rows accumulate as DRAFT; check + Submit sends to Page 2; **submitting onto a locked sheet lands the entry deselected** with a note; deselect + Submit withdraws (and clears the MC mark). Create-toasts name the target review date.
3. **Re-pull (same Index/WT/date):** fetching an NFA that already has an open entry refreshes QMS fields, **replaces QMS-sourced files by filename and restores missing ones (B7 — user uploads never touched, replaced count audited)**, merges staged uploads, and flags the row. On a locked sheet it applies the auto-deselect rule (submitted + deselected; sheet stays locked). The row editor for a presented entry says: *"Fetch from QMS to update (lands deselected)."* A same-values re-pull also **cancels any pending-move ticket**. A re-pull on a draft may take new strip values directly — a draft has no Page-2 presence to protect.
4. **Pending move (differing Index/WT/date on a submitted/presented entry — B2):** the fetch stages a **ticket** on the same entry object; nothing changes on Page 2; Page 1 shows one row with the pending values, pre-ticked, chip *"Pending move from CIVIL·08-Jul — submit to apply · previous entry still on Page 2."* Submit applies the atomic swap after revalidation (§0-1). A newer differing fetch replaces the ticket; unsubmitted tickets stay dormant; a fetch targeting an already-published date is refused up front.
5. **Files:** typed chips (PDF/XLS/MAIL/IMG/FLD); click to open/download by type; **×** deselects with confirm; re-pull restores/replaces QMS files per B7; uploads stage in the strip and attach on the next fetch/re-pull (staged uploads ride a pending-move ticket and attach at Submit).
6. **Proxy:** any user enters any NFA; Initiator auto-fills from QMS with an asterisk when entered by someone else; login audited (§14 D1). **"(Initiated on DD-MMM-YYYY)"** renders under every NFA number.
7. **Mode B:** full form; free-text Initiator; interim reference auto-issued and cited in QMS at NFA initiation; **the "link NFA no." control is omitted (F13)** — the Remarks breadcrumb is the manual linking practice.
8. **Search & PDFs:** per-NFA timeline (every sitting outcome + PDFs — including history-only outcomes recorded on relocated ghost rows) and the date-wise PDF library; visibility per §14 D2.

---

## 5. Page 2 — Pre-meeting Review & Check (Reviewer; users view-only)

1. Index tabs + **sheet date** (calendar, today+future) → submitted/presented entries, Work-Type-grouped A–J, full tabular format; **"(Initiated on …)"** under each NFA (no separate column); column order ends **… Selected Files | Flags | Present to MC**. Resubmit badge with prior outcome + PDF link. **`- - x End of Sheet x - -` renders centred after the final row whenever the sheet has rows (B1)** — never on the empty state.
2. **User mode = view-only:** scroll and read everything; checkboxes disabled, no editable cells, Lock/Migrate hidden; badge announces the mode. Index tabs and date navigation remain browsable (read-only) — §14 D12 (closed).
3. Reviewer actions: select/deselect for MC (any change **unlocks**, with a toast that Page 3 continues to show the last vN); **in-cell touch-ups** on Rate / Reason / Resubmission (red leading asterisk, audit-attributed); **Lock sheet → Page 3** snapshots vN — the only conduit to Page 3. Zero-selection lock is valid. Re-lock keeps decisions for surviving entries; dropped entries lose draft decisions with a warning (§14 D3).
4. **Held rows:** unselected-at-lock entries sit at the bottom of their category, black text, flagged "not selected — held at bottom, still selectable"; selecting one unlocks for re-curation. They do not expire.
5. **Locked-sheet arrivals:** entries submitted, re-pulled, **relocated in (B2)** or **migrated in (B5)** while the sheet is locked appear **deselected** until the reviewer marks them; the counter reflects the drop while Page 3 holds the snapshot.
6. **A pending move elsewhere changes nothing here:** the entry stays on this sheet, selectable and lockable, until its ticket is submitted — Page 2 and Page 3 may intentionally hold different versions (O7); the onus is on the reviewer to bring revisions forward through the next lock.
7. **Migrate sheet (today ↔ +10 days):** enabled on any unpublished sheet with entries; calendar window today → today+10; default target = today when the sheet is future-dated (bring-back), else today+2; published/same-date targets blocked; **locked targets allowed — arrivals land deselected, target lock + snapshot untouched, toast notes it (B5)**; merges into the target's pool preserving selections, dropping draft decisions (warned); source closes as MIGRATED; audited.

---

## 6. Page 3 — MC Meeting Review (Reviewer as operator; no user access)

1. Shows the **last locked snapshot** per index; meeting-date calendar today+future; header: Locked snapshot vN · decided-of-presented counter · versioned "Decisions saved" ticker. **"(Initiated on …)"** under each NFA; no separate initiated column. **`- - x End of Sheet x - -` after the final row when the snapshot has rows (B1)**; never on the empty state; never in the PDF.
2. **Decisions = icon buttons:** 👍 thumbs-up (green, Approve) · ⏸ pause (yellow, Hold) · 👎 thumbs-down (red, Reject); chosen button highlights, others dim; clicking the same button clears; comments optional on all three, typed **in the MC Comments cell** (Excel-style).
3. Decisions/comments save versioned continuously; the sheet survives pauses. Undecided rows carry a "pending — excluded from PDF if undecided" note.
4. **Relocated ghost rows (B2/O7):** when a presented-undecided entry departs via a permitted submit-gated relocation, its snapshot row remains visible mid-meeting carrying the marker *"live entry relocated to MEP·09-Jul — decisions record to NFA history only."* Decisions on it stay recordable but publish leaves the live entry untouched (F8). Clearing a decision (same-button toggle) is also how the operator releases a pending move blocked by the O7 gate.
5. **Publish per index** → confirmation modal (lists undecided numbers; **warns "0 decided — publishing will expire all N presented entries" when nothing is decided; disabled outright on an empty snapshot — B4**) → PDF of decided snapshot rows, Work-Type-grouped; header **"MC REVIEW — {INDEX} — DD-MMM-YYYY"**; Smart World logo top-right; footer carries the numbers-only undecided line, the fixed re-presentation line, and the verbatim confidentiality note; lands in the Page-1 archive instantly. Publish closes the date: decided → status set (residency-guarded per F8); undecided → expired; post-lock in-place re-entries close with the snapshot outcome. One publish per index per date; corrigendum = admin Rev-2.

---

## 7. Page 4 — Order Numbering (Stage 2 mechanics; syntax pending)

1. All published-APPROVED NFAs auto-list (MC comments shown for release guidance, e.g. "release separate POs per vendor").
2. Per NFA: **No. of orders** dropdown (default **1**; max 10, admin-config) → **Generate order number** → N rows, interim format `ORD/MEP|CIV/MMYY-####`. **After the first generation the button reads "Add N more orders"** (label tracks the selector) **with a one-line confirm; existing rows are untouched (B6).**
3. Each row: unique number (override permitted, uniqueness enforced with revert + error toast, audited) · vendor/supplier/contractor typed in place · order type (PO/SO/WO/LOA) · **✕ Delete** → warning ("deleting an order number… retired, not reused; void in QMS separately if already cited") → row removed, number retired forever, audited.
4. Order register: number, type, NFA ref, vendor, generated-by, timestamp, override/delete trail; users see own, reviewer/admin all (§14 D4).

---

## 8. Roles & permissions

| Capability | User (30+) | Reviewer (per index) | Admin |
|---|---|---|---|
| P1 create/edit/checkbox/Submit own + proxy entries (today/future dates) | ✓ | ✓ | ✓ |
| P1 re-pull open NFAs (incl. on locked sheets → auto-deselect) · stage/submit pending moves (B2) | ✓ | ✓ | ✓ |
| P1 search history + download published PDFs (any past date) | ✓ | ✓ | ✓ |
| **P2 open & scroll (view-only)** | ✓ | ✓ | ✓ |
| P2 curate, in-cell touch-up, **Lock/Unlock**, **Migrate (today↔+10, locked targets incl.)** (own index) | — | ✓ | ✓ |
| P3 access; thumbs decisions + in-cell comments (incl. clearing to release an O7-blocked move); **Publish** (own index) | — | ✓ | ✓ |
| P4 generate orders (per D4), add-more, type vendors, override numbers, **delete/retire** | ✓ | ✓ | ✓ |
| P4 view all orders; corrigendum; "Entered By" column; audit trail; users; reference data; QMS connection; config | — | partial | ✓ |

---

## 9. End outputs

1. **Two published PDFs per sitting** — snapshot-decided entries with comments, Initiated-on sub-lines, undecided numbers-only note, re-presentation line, confidentiality note, Smart World branding; self-served from Page 1; Rev-2 corrigenda marked. No end-of-sheet marker in the PDF.
2. **Order register** with generate/add-more/override/delete-retire trail.
3. **Per-NFA review history** (timeline across sittings + all PDFs, including history-only outcomes from relocated ghost rows).
4. **Audit trail** — submit/withdraw, re-pull (incl. auto-deselect and replaced-by-name counts, B7), pending-move staged/replaced/cancelled/converted, **entry relocated (both sides named)**, curation, lock/unlock vN, migrate (incl. locked-target arrivals), decision versions, publish (incl. history-only ghost note), order generate/add-more/override/**delete**, corrigendum — actual-login attributed; admin-viewable.

---

## 10. Delivery model & pathway

API 10 July (Chintoo Kumar / vendor Globe) · Claude access (Akhilesh Sharma) · on-prem hosting + IT build. **Pathway:** v2.5 parity freeze (defaults §14) → IT handover (this doc + prototype v1.3 + readiness/UAT v1.7 + regression suite + wireframes; workflows + UAT parameters = acceptance KPIs) → IT dummy build → C&P validation → live build → Stage-0/1 UAT shadow run (2 sittings) → go-live → Stage 2 syntax activation.

---

## 11. Working reference data (tentative — hard-map at testing)

**Work Types (A–J):** A New Work · B Deviation in Payment Terms *(keep/drop — default keep)* · C Qty Variation with Extra Items · D Qty Variation Only (At Existing Rates) · E Qty Variation with Change in Rates · F Addendum · G Amendment in Rates & Specs · H Emergent Approval · I Extra Items · J Base Rate Approval.
**Column set:** 22-column map per v2.2 §11 with **Creator → NFA Initiator**, minus the standalone NFA-Initiated column (now a sub-line under NFA No.), plus Selected Files placement per §5.1.
**Values:** stored as entered text + optional parsed numeric. **Dates:** DD-MMM-YYYY.

---

## 12. Known operational friction (accepted)

Silent user overrides of QMS values (markers parked). Reschedule friction solved by migrate (both directions, locked targets included). Post-lock updates that miss re-lock close with the sitting outcome by design — the fresh-entry path is the pressure valve. A relocated entry's ghost row stays in the sitting PDF with its recorded decision (snapshot fidelity); the live entry carries only the history flag, never the status — MC operators are told so on the row itself. An NFA that legitimately escaped an outcome via relocation may show a resubmit-history chip citing that PDF appearance (D6); this is informational and does not gate its open entry.

---

## 13. Excluded from this version by instruction

The five essential inputs (final field list, PDF format sample *(v2 sample now issued as the working reference)*, user roster, branding pack beyond the logo, auth/DB — IT-owned) and the Stage-2 order-number syntax pack. Mode-B link-NFA (F13 — omitted, do not re-introduce).

---

## 14. Residual defaults — auto-lock at IT build kickoff unless overridden

- **D1. Proxy control:** enterer + NFA Initiator (if registered) can edit/checkbox a proxy entry; audit-attributed.
- **D2. Visibility:** users see entries where they are enterer or initiator, plus the shared PDF archive.
- **D3. Re-lock decisions:** surviving entries keep saved decisions; entries dropped on re-lock lose draft decisions with an on-screen warning.
- **D4. Page 4 generation rights:** entry's NFA Initiator/enterer + admin.
- **D5. Parallel future dates:** blocked — one open entry per NFA at a time (re-fetch = re-pull of that entry; differing re-fetch = pending-move ticket on that entry).
- **D6. Flag trigger** = appearance in a published PDF (P1 warning + P2 badge with PDF link) — includes history-only appearances via relocated ghost rows.
- **D7. Interim reference format** `EM/07-26/001`; interim order format `ORD/IDX/MMYY-####`.
- **D8. Work Type B** retained (delete at hard-mapping if unused).
- **D9. Refresh/re-pull** overwrites QMS-sourced fields, replaces QMS files by filename and restores missing ones (B7); never touches user-typed overrides or uploaded files.
- **D10. Sheet ordering:** submission sequence within Work Type; held rows sink to category bottom; reviewer drag-reorder pre-lock remains good-to-have.
- **D11. Migrated sheets:** carried entries keep values (no forced re-pull; users may re-pull while unlocked).
- **D12. User view-only scope — CLOSED:** users hold Page-2 view access with index tabs + sheet-date navigation browsable, and enter NFAs in both indices.
- **D13. Migrate window:** fixed at today → today+10 in v1; admin-configurable ceiling is a Stage-2 candidate.
- *(D14 removed → tracked as open ruling O1: retired order numbers — current build retires forever, never re-issues, including across dates and after overrides; the release-policy switch stays pending and undecided.)*
