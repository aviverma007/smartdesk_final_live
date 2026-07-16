# MC Review Dashboard — Handover Pack v2 · Manifest (v2.0)

**Assembled:** 6 July 2026 · **Owner:** Dhruv (C&P, Smart World Developers) · **Prepared for:** IT handover & stakeholder sharing
**This pack supersedes pack v1 (manifest v1.1).** Contents: the complete *current-version* resource set after the B1–B7 build. Superseded versions (Workflow v1–v2-4; Readiness v1–v1-6; prototype v1-2; PDF sample v1; screenshots v1-2) remain in the working archive and are shareable on request.

| # | File | Version | Role | Currency notes |
|---|------|---------|------|----------------|
| 1 | `00-mc-portal-handover-manifest-v2-0.md` | 2.0 | This index | Supersedes v1.1 |
| 2 | `mc-portal-workflow-definition-v2-5.md` | 2.5 | **The build contract** — full workflow & feature definition, in parity with prototype v1.3 | Folds B1–B7, O2-rework/O3–O7, F13 omission, F14 today-view, calendar rename; D12 closed; D14 → O1 |
| 3 | `mc-portal-readiness-check-uat-v1-7.md` | 1.7 | Completion dashboard, requirement registers, rulings log, build record, failure-node register, UAT acceptance pack | Live tracker — B1–B7 **done**; open: O1 only |
| 4 | `mc-review-dashboard-prototype-v1-3.html` | 1.3 | **Working prototype** — single self-contained file, opens in any browser, no install; role switcher simulates login; in-memory QMS; frozen TODAY 05-Jul-2026 | B1–B7 applied; link-NFA removed (F13); 146-check regression green ×2, zero console errors |
| 5 | `mc-proto-v1-3-regression-suite-qa.js` | 1 (146 checks) | Playwright regression suite, portable (run notes in header) | Full v1.2 walk adapted to ruled B3 changes + 54 new B1–B7 asserts; exit 0 = green |
| 6 | `mc-proto-v1-2-to-v1-3-patch.js` | 1 | Atomic patch script v1.2 → v1.3 (37 replacements, match-count asserted) | Exact change record for IT diff review |
| 7 | `mc-proto-v1-3-patch-f13-omission.js` | 1 | Supplementary atomic patch (4 replacements) removing the Mode-B link-NFA control | Same purpose |
| 8 | `mc-proto-v1-3-screen-p1-entry-calendar-todayview.png` | 1.3 | Page 1 — Entry Date View calendar (today→2035) over the today-view aggregated list | Current |
| 9 | `mc-proto-v1-3-screen-p1-pending-move-chip.png` | 1.3 | Page 1 — pending-move ticket staged (pending values, pre-ticked, chip/toast) | Current |
| 10 | `mc-proto-v1-3-screen-p2-pending-source-endmark.png` | 1.3 | Page 2 — source sheet untouched during a pending move + end-of-sheet marker | Current |
| 11 | `mc-proto-v1-3-screen-p3-relocated-marker-decisions.png` | 1.3 | Page 3 — locked snapshot, thumbs decisions, relocated-ghost marker, end-of-sheet marker | Current |
| 12 | `mc-proto-v1-3-screen-p4-add-more-orders.png` | 1.3 | Page 4 — "Generate order number" vs "Add N more orders" states | Current |
| 13 | `mc-wireframe-dashboard-page1-concept-v1.png` | 1 | Original Page-1 concept wireframe | Design intent; superseded in detail by the prototype |
| 14 | `mc-wireframe-p1-nfa-entry-v2.png` | 2 | Page-1 wireframe | Same note |
| 15 | `mc-wireframe-p2-premeeting-review-v1.png` | 1 | Page-2 wireframe | Same note (predates view-only mode) |
| 16 | `mc-wireframe-p3-mc-meeting-full-columns-v1.png` | 1 | Page-3 wireframe, full column set | Same note |
| 17 | `mc-wireframe-p4a-approved-list-v1.png` | 1 | Page-4 wireframe — approved list | Same note |
| 18 | `mc-wireframe-p4b-1nfa-3vendor-orders-v1.png` | 1 | Page-4 wireframe — 1 NFA → 3 vendor orders | Same note |
| 19 | `mc-pdf-output-format-sample-mep-05jul2026-v2.pdf` | 2 | PDF output format sample (gates the P2 format freeze) | Regenerated from the v1.3 seeded MEP·05-Jul publish; carries the "(Initiated on …)" sub-lines |
| 20 | `branding-logo-smartworld-v1.png` | 1 | Logo asset (in app bar + PDF header) | Branding pack parked by owner |
| 21 | `mc-portal-claude-code-handoff-v1-0.md` | 1.0 | Claude Code handoff that authorised and specified this build | Executed 6 Jul; retained for traceability |
| 22 | `mc-portal-v1-3-build-changelog-note.md` | 1.0 | **Build changelog note to Dhruv** — what shipped, verification evidence, and every interpretation taken | Read together with Workflow v2.5 §0 |

**Status at pack time:** overall completion ≈ 46% · IT-handover readiness ≈ 95% · open ruling: **O1** (retired order numbers — retire-forever retained, policy switch pending) · build queue **B1–B7 shipped** with Workflow v2.5 + Readiness/UAT v1.7 + 146-check regression **green twice, zero console errors** · QMS API due **10 July** (I1).
