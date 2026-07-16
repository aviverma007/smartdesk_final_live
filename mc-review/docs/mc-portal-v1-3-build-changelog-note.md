# Build changelog note — Prototype v1.3 (B1–B7) · to Dhruv

**From:** Claude Code build session · 6 July 2026 · **Trigger:** your explicit build command ("execute latest build")
**Result:** all seven build-queue items implemented on prototype v1.2 → **v1.3**, companion set issued (Workflow **v2.5**, Readiness/UAT **v1.7**, PDF sample **v2**, five v1-3 screenshots, manifest **v2-0**), regression suite extended **92 → 146 checks** and **green twice consecutively with zero console/page errors** on the final build. O1 untouched (retire-forever retained; policy switch still open). No external dependencies introduced — still one self-contained vanilla HTML file.

## How the change was made (for IT traceability)

Two atomic patch scripts (per the handoff §8 convention — every replacement asserts exactly one match, all-or-nothing):
- `mc-proto-v1-2-to-v1-3-patch.js` — 37 replacements implementing B1–B7.
- `mc-proto-v1-3-patch-f13-omission.js` — 4 replacements removing the Mode-B link-NFA control.

Verification: baseline v1.2 first re-confirmed **92/92 green** on this machine, then the extended suite ran **146/146 twice consecutively** (exit 0, zero console/page errors) on final v1.3. The suite also sets a non-zero exit code if any console/page error appears (new).

## Interpretations taken (everything not literally spelled out in the specs)

1. **Drafts relocate directly, no ticket (B2).** The pending-move model protects Page-2 presence, and the chip text says "previous entry still on Page 2" — a draft has no P2 presence, so a differing fetch on a *draft* applies the new Index/WT/date immediately (audited as "Draft re-pull with new strip values"). Tickets are staged only for submitted/presented entries.
2. **Ticket to an already-published target is refused at fetch** (same *"published; the date is closed"* rule as new entries). The spec's submit-time "target published → refused, ticket editable" leg still exists and is asserted — it covers targets published *after* the ticket was staged.
3. **Published-mid-pending conversion preserves D5.** If the stranded entry was never presented (left open 'submitted' on the closed date), the *same* entry object converts to a draft at the ticket values with the resub flag — creating a second object would have violated one-open-entry. If publish closed the entry (it was presented), a genuinely fresh entry object is created. Both paths demand the resubmission comment before Submit completes (the empty-comment block is asserted).
4. **Today-view also lists today's closed outcomes.** B3 defines the open-entry aggregation across today+future; I kept entries *dated today* visible regardless of status (e.g. "APPROVED · 05-Jul-2026 · View PDF") — otherwise Page 1 would lose sight of the day's results the moment a PDF publishes. Future dates can hold only open entries, so the future-date filter is unaffected.
5. **Ghost rows stay in the published PDF.** A relocated (departed) snapshot row that the MC decided remains in the PDF with its recorded outcome — PDF content comes strictly from the snapshot (§0-5). F8 protects only the *live entry's status*; the outcome records to NFA history (registry + timeline). The Page-3 marker text tells the operator decisions there are history-only.
6. **Resubmit-history chip after a legitimate escape.** Once a ghost outcome publishes, the NFA has a PDF appearance, so the D6 flag trigger fires: the relocated live entry shows a "Resubmit — <outcome> <date>" history chip. Its status and its open journey are untouched; the chip is informational. (Surfaced by the F8 regression check; documented in Workflow v2.5 §12.)
7. **F13 executed as a removal.** "Removed from scope … (F13 omission)" + §12's "no link-NFA re-introduction" read together as: take the control out of the build, don't merely stop improving it. v1.3 drops the row link, the modal and both handlers; the Mode-B note now names the Remarks breadcrumb as the manual practice. Flag if you intended the control to stay.
8. **Mode B follows the no-jump rule too.** B3 names "fetch" only, but leaving Mode-B creation jumping the view would reintroduce the inconsistency B3 removes; the create-toast names the target date instead.
9. **B6 label grammar:** "Add 1 more order" (singular) / "Add N more orders" — the label live-tracks the count selector; the one-line confirm is a native dialog.
10. **B4 empty-snapshot wording:** the Publish button now renders disabled with "Empty snapshot — nothing to publish" (v1.2 hid the button entirely; a visibly disabled control is what "disabled entirely" tests against).
11. **Zero-decided warning count** reads "…expire all 1 presented entries." for N=1 — kept verbatim to the ruled string rather than special-casing grammar.
12. **Suite adaptations to ruled behaviour changes:** the strip date now persists (B3), so the calendar section re-picks 05-Jul before the fetch tests; old check "fresh entry on 07-Jul jumps the view" became "fetch does **not** jump the Entry Date View" + "fresh entry listed in today view". Everything else from the original 92 runs unchanged. Extension is 54 asserts (not ~18) — the full handoff §7 list plus the lifecycle edges above.
13. **PDF sample v2 rendering:** produced via Playwright `popup.pdf()` as specified, A3 landscape with backgrounds, from the seeded MEP·05-Jul publish (6 approved incl. the 13594 resubmission and Mode-B EM/07-26/001 · 1 hold · 1 reject · 14319 undecided → numbers-only footnote). Actual print output in production remains whatever the browser/print pipeline produces (I7 is IT-lane).
14. **Screenshots:** five instead of four — the pending-move mechanic spans two pages, so P1 gets both a calendar/today-view shot and a pending-chip shot, plus the P2 source-sheet shot showing "previous entry still on Page 2" with the B1 marker.

## Environment note (one-time, this machine)

No Node.js existed on the laptop; a portable Node v22 LTS now sits at `.tools\node-v22.12.0-win-x64` inside the project folder. The corporate FortiGate intercepts `registry.npmjs.org` TLS (its CA is not in the Windows store), so Playwright was installed from the **registry.yarnpkg.com** mirror and Chromium from **cdn.playwright.dev** — both fully certificate-verified; **no TLS verification was disabled**. A `build/.npmrc` records the mirror so IT can reproduce the run (`node mc-proto-v1-3-regression-suite-qa.js mc-review-dashboard-prototype-v1-3.html`).

## What did not change

O1 (retired numbers) — retire-forever behaviour retained, policy switch left open · frozen `TODAY='05-Jul-2026'`, in-memory QMS, role switcher — all kept per handoff §3 · no framework/bundler — single-file vanilla stands · branding untouched beyond the existing logo.
