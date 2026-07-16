# MC Review Dashboard — Readiness Check, Completion Requirements & UAT

**Version:** 1.7 — 6 July 2026 (supersedes 1.6) · **Companion to:** Workflow Definition v2.5 + Prototype v1.3
**Changes:** **Build queue B1–B7 built on Dhruv's explicit command** (Claude Code session, 6 Jul). Prototype v1.2 → **v1.3**; Workflow re-issued as **v2.5** (parity restored). Regression suite extended **92 → 146 checks** (supersedes the "+~18" estimate — full §7 extension list plus lifecycle edges), **green twice consecutively, zero console/page errors**, on the final build. **F13 executed as an omission** — the Mode-B link-NFA control is physically removed from v1.3. UAT deltas (v1.6 §7) folded into the main pack below. **PDF output format sample v2** regenerated (carries the Initiated-on sub-lines). **Only O1 remains open.**

---

## 1. Completion dashboard

| Cat | Track | Weight | Movement | % |
|---|---|---|---|---|
| A | Workflow & behaviour definition | 20% | B1–B7 folded; v2.5 issued; only O1 open | **98%** |
| B | Prototype validation | 15% | v1.3 built; 146-check suite green ×2 | **92%** |
| C | C&P inputs (Dhruv) | 25% | P2 evidence current (PDF sample v2); UAT pack consolidated | **38%** |
| D | IT build & infrastructure | 30% | pre-10-Jul | **8%** |
| E | Stage-2 scope | 10% | unchanged | **5%** |

**Overall ≈ 46% · IT-handover readiness ≈ 95%.** Last open ruling: **O1** (retired numbers). Long poles unchanged: P1 field map, P2 PDF freeze (sample v2 in hand), P7 roster, then IT's I-series.

---

## 2. IT dependencies (I-series) — unchanged

I1 API 10-Jul · I2 spec/payloads/error contract · I3 field mapping · I4 AD/SSO + roles · I5 DB (retired ledger · one-open-entry constraint · server-side status checks · **pending-move ticket state** · snapshot decision-state readable at submit for the O7 gate) · I6 on-prem · I7 server-side PDF · I8 audit · I9 dummy build · I10 server date.

---

## 3. C&P dependencies (P-series)

P1 field map · P2 PDF freeze (**format sample v2 issued — gates the freeze decision**) · P3–P6 page freezes · P7 roster · P8 Work Types · P9 defaults D1–D13 · **P10: O1 only** · P11 UAT sign-off. **Parked:** branding (by owner).

---

## 4. Rulings — O1 open; O2–O7 closed **and built**

- **O1. Retired order numbers — OPEN (last one).** Retire-forever vs admin-releasable; ledger checked on generate and override. **v1.3 retains retire-forever untouched; the policy switch stays pending — deliberately not decided in the build.**
- **O2-rework (submit-gated relocation), O3, O4, O5, O6 — built** per B2–B7 specs; see §5 build record.
- **O7 — built exactly as ruled:** decided-gate machine-checked at Submit-time against the snapshot decision state; operator same-button toggle-clear releases a blocked move; departed rows carry the Page-3 relocated marker and their decisions record to NFA history only (F8). Automated checks cover refusal, release, marker text, and the F8 publish result.

---

## 5. Build record — B1–B7 **DONE** (prototype v1.3, 6 Jul 2026)

- **B1. End-of-sheet marker — DONE.** `- - x End of Sheet x - -` centred after the final row, Pages 2–3, only when rows exist; absent on empty states and in the PDF (all four asserted).
- **B2. Submit-gated relocation — DONE (full pending-move model).** Differing fetch → ticket (old Page-2 entry untouched — verified via reviewer role; one Page-1 row with pending values, pre-ticked, chip verbatim per spec). Submit → atomic swap (old presence removed, new sheet receives deselected, audit names both sides). Submit-time revalidation, all four legs asserted: old-published → fresh-entry conversion with mandatory resub comment (blocked-empty-comment also asserted); target-published → refused, ticket editable; presented+decided → refused per O7, operator toggle-clear then Submit passes; presented+undecided → swap + relocated marker, ghost decisions history-only, publish leaves the live entry untouched (F8). Cancel-by-same-values, replace-by-newer-fetch, and dormant unsubmitted tickets all asserted. D5/P2-uniqueness held in every intermediate state.
- **B3. Page-1 calendars — DONE.** "Entry Date View" rename; strip stays "Review Date"; independence asserted in both directions; fetch no-jump asserted; today-view lists the multi-date open set (sorted Review Date then entry order); future view filters; strip date session-persistent (asserted through the whole run); create/relocate toasts name the target date.
- **B4. Zero-decided publish — DONE.** Warning text verbatim (*"0 decided — publishing will expire all N presented entries."*); Publish rendered disabled on an empty snapshot (asserted).
- **B5. Locked-target migrate — DONE.** Arrivals deselected + held; target lock and snapshot version untouched (asserted); toast notes the locked-sheet arrival.
- **B6. "Add N more orders" — DONE.** Label after first generation, live-tracks the count selector, one-line confirm (dialog text asserted), existing rows untouched.
- **B7. Replace-by-name re-pull — DONE.** QMS files replaced by filename, missing ones restored, user uploads untouched; replaced count in toast + audit; runs inside pending-ticket refreshes too.
- **Removed from scope — EXECUTED:** Mode-B link-NFA control and handlers removed from v1.3 (F13 omission); interim reference cited in QMS; Remarks breadcrumb documented as the manual practice (Workflow v2.5 §4.7).

**Verification:** 146-check Playwright suite (`mc-proto-v1-3-regression-suite-qa.js`) — the full v1.2 92-check walk adapted to the ruled B3 behaviour changes, plus 54 new B1–B7 asserts — **146/146 green twice consecutively on the final build, zero console/page errors** (exit 0). Interpretations taken during the build are logged in the changelog note (`mc-portal-v1-3-build-changelog-note.md`).

---

## 6. Failure nodes — status

**Closed by build (v1.3):** F1 (B2) · F4 (B5) · F5 (B4) · F6 (B6) · F8 (publish guard embedded in B2 + O7 marker, asserted) · F11 (B7) · F13 (omitted — control removed) · F14 (today-view) · F15 (B4) · **L7/ghost-decision (O7 marker + history-only recording)**.
**Standing (IT lane):** F2 concurrent creation (I5) · F3 submit-vs-lock race (I5) · F7 retired-override vs ledger (O1+I5) · F9 server date (I10) · F10 API error contract (I2) · F12 server-side PDF (I7).

---

## 7. UAT acceptance pack (deltas folded; v1.2 pack base otherwise stands)

- **U13 — pending-move lifecycle: COVERED (automated).** Ticket staging, chip, old-P2 presence, cancel/replace/dormant, atomic swap, locked-destination deselected arrival, decided-gate refusal, operator toggle-clear then successful Submit, published-mid-pending conversion (incl. mandatory-comment block), F8 verification. Manual UAT re-run at IT dummy build.
- **U14 — Entry Date View / Review Date: COVERED (automated).** Independence both directions; today-view = all open entries across dates; future view filters; session-persistent strip date; off-view toast names target date.
- **U15 — P2-uniqueness: COVERED (automated)** across indices/dates and every pending intermediate state (at most one P2 presence; one P1 row).
- **U17 — presented-entry relocation: COVERED (automated).** Undecided proceeds (with Page-3 marker); decided refused; audit on both sheets.
- **M13 — relocated marker: COVERED (automated).** Marker text on departed snapshot rows; decisions there record to history only (operator told in-row); publish leaves the relocated live entry untouched.
- **U16 · U3-delta · R9 · R10/M9 · M12 · O7-uat · L5-uat** — unchanged from v1.5/v1.6; manual verification at IT dummy build alongside the automated walk.

---

## 8. Handover pack v2 (versioned filenames)

Folder **`mc-portal-handover-pack-v2/`** — the complete current-version resource set: manifest **v2-0** · Workflow Definition **v2-5** · this Readiness/UAT **v1-7** · prototype **v1-3** (single-file HTML) · regression suite **v1-3 (146 checks)** · atomic patch scripts v1.2→v1.3 (exact change record for IT diff review) · five prototype screenshots (v1-3) · six concept wireframes (retained for design intent) · PDF output format sample **v2** (with Initiated-on sub-lines) · Smart World logo asset · Claude Code handoff v1-0 · build changelog note. Superseded versions (workflow v1–v2-4, readiness v1–v1-6, prototype v1-2, PDF sample v1, screenshots v1-2) remain in the working archive and are shareable on request.

---

*Open for Dhruv: **O1** + P-series long poles (P1 field map, P2 freeze decision on sample v2, P7 roster). IT: I1/I2 on 10-Jul. Next build trigger: IT dummy build feedback or an O1 ruling — Workflow v2.6 re-issues only if either lands.*
