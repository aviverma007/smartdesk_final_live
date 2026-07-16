# Build changelog note — Prototype v1.4 (fixed Page 1/2/3 format) · to Dhruv

**From:** Claude Code build session · 6 July 2026 · **Trigger:** your build command with `Page 1,2,3 format.xlsx` (Desktop)
**Result:** prototype v1.3 → **v1.4** applying the fixed format; regression suite extended **146 → 158 checks**, **green twice consecutively, zero console/page errors**; PDF format sample **v3** and four **v1-4 screenshots** regenerated. Still one self-contained vanilla file, no dependencies. Browser-verified live at http://localhost:8319 (config `mc-portal-v1-4` in `.claude/launch.json`).

## What the Excel fixed, and what was built

- **Editable (Pick-from-NFA) fields**, per the "Editable" markers: **PR Budget Value** (new field; QMS-prefilled, PfN card on P1 editor, touch-up cell on P2), **Reason for this New work/variation**, **No's of Considered Vendors & PQ** (was read-only; now hybrid PfN + P2 touch-up), **Remarks / Status** (the P1 editor Remarks card, renamed). Reviewer touch-ups keep the red-asterisk + audit convention.
- **Dropdowns**, per the "Dropdown" markers: **NFA Initiated By** = C&P Team / Site; **Validation of Rates** = Competitive bidding / Existing rate reference / Rate analysis / Existing Rate & Rate analysis. Both appear in the P1 entry editor and as in-cell selects on P2 (reviewer, pre-lock; view-only users see text). Snapshot/PDF carry the chosen values.
- **Computed "Revised order value"** — from the demo formula in the sheet (`=Last Amendment + This variation`, e.g. 110+20=130): implemented as *(Last Amendment if numeric, else Original) + This variation; NA when no numeric variation*. This reproduces the old Amend.-Value column's numbers exactly (13594: 39.82−7.83=**31.99**; 14319: 23.99+0.77=**24.76** — both asserted).
- **Columns dropped** (not in the fixed format): Rate Per Unit (and its editable card), Appr. Note w/ PR, free-text Reasonability of Rates (superseded by the Validation dropdown).
- **Columns added/renamed:** PR No. moved to the front and Location added on P2; NFA Initiator → **Creator** (proxy asterisk and visibility rules unchanged); "Selected/Attached Files" → **Downloadable files**; value headers renamed to Original Order Value / Last Amend. / This Variation / Revised.
- **Kept as-is per your instruction:** P1 checkbox + Status (+ Index/Work Type/Review Date entry controls), P2 Flags + Present to MC, P3 MC Comments + MC Approval/Status, and all v1.3 mechanics (B1–B7, locks, publish, orders).

## Interpretations taken

1. **"Column 4" note under Creator** in the sheet was undecipherable — Creator remains the QMS initiator (Mode A) / free text (Mode B). Flag if it meant something else.
2. **"Remarks / Status" (Editable)** maps to the existing Remarks hybrid card on the P1 editor (renamed) — each page keeps its own status column per your "keep as is" instruction, so no new Remarks column was added to P2/P3.
3. **"NFA initiated by" defaults** are QMS-suggested in the simulation (so the demo looks alive) and user-changeable; not mandatory (the sheet doesn't mark it so). Re-pulls never overwrite a user's dropdown choice (D9).
4. **Revised when Last Amendment is NA** falls back to Original + This variation (only combination consistent with both the sheet's example and the existing seed data).
5. **PDF format updated to match** (19 columns: PR Budget, value chain with Revised, Validation of Rates, Creator; Rate Per Unit/Reasonability gone) — regenerate gates the P2 freeze on sample **v3**.
6. **Mode B form** re-cut to the fixed field list (+ both dropdowns); dropped inputs (Appr. Note, Amend. Value, Rate, Reasonability) default to "—" internally.
7. One legacy suite assert ("no separate NFA-Initiated column") was tightened to exact-match — it guards the removed initiated-*date* column, which the new "NFA Initiated By" dropdown column is not.

## Files (in `build/`)

`mc-review-dashboard-prototype-v1-4.html` · `mc-proto-v1-4-regression-suite-qa.js` (158 checks) · `patch-v1-4.js` (40 replacements) + `patch-suite-v1-4.js` (9) · `mc-pdf-output-format-sample-mep-05jul2026-v3.pdf` · 4 × `mc-proto-v1-4-screen-*.png`.

## Recommended next step

Workflow Definition **v2.6** + Readiness **v1.8** re-issue to fold this format freeze (P1 field map + P2 sample v3 are two of your long poles — this build closes most of both), and pack **v3** assembly for IT. Say the word and I'll produce them.
