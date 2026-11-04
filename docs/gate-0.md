# Gate 0 review

Reviewed on 2026-11-04 against merged commit `fa46397` (changes since `97aa6c6`), the staff-state repair and three fixes from the final screenshot pass. Every automated and review check passes; the four human checks have not been run and do not block Phase 1. Codex began this review and its usage limit ran out, so Claude finished the final screenshot pass and the rerun at the human's request. **Codex has not reviewed the resulting commit.** The human-authorized parent Home and paper/forest and dark/lime themes supersede the older no-sidebar/teal layout.

| Check | Result and evidence |
|---|---|
| Lint, types and unit tests | PASS: `npm run check`, exit 0; 32 tests passed, zero lint errors and eight existing warnings. |
| Production build | PASS on the final repair, exit 0. The earlier baseline build needed its generated production worker/cache directories cleared after two Turbopack handshake failures; no source change was needed. `.next/dev` and the live port 3000 preview were preserved. |
| No dead controls | PASS: baseline full suite, exit 0, 202 passed in 19.7 minutes; final repair, exit 0, 58 affected/new cases passed in 4.7 minutes. Unaffected coverage is carried forward explicitly. |
| Fit at 360 × 640; amount, date and Pay above the fold in both languages | PASS in the baseline suite; affected layouts passed again after repair. Parent normal originals visually confirm the fold, and all refreshed parent images are byte-identical to those already reviewed. |
| No console errors or serious/critical axe violations | PASS in baseline and affected layout/state checks. Deliberately requested error-preview responses are expected server errors, not normal-route failures. |
| Compressed JavaScript budgets | Final repair PASS at both widths: Home/dues 193,524 B, receipts 193,523 B, login 195,084 B, public pay 192,621 B (each ≤200,000 B); demo 211,727 B (≤350,000 B). |
| Loading, empty and error states | Automated PASS: baseline all-route sweep plus affected staff layouts and 28 new staff-state cases after repair. Full fresh capture PASS: 384 PNGs for 24 routes, exit 0. |
| Purpose and consistency review | Parent pass recorded below. Staff/counsellor errors and staff sign-in states now retain their proper theme/frame; shared loading blocks remove duplicate main landmarks. These fixes passed the final-source state checks. PASS: fresh screenshots inspected, with three flaws found and fixed (see Final screenshot pass). |
| Motion limits and reduced motion | PASS: current unit import-boundary test and baseline reduced-motion cases; motion code is unchanged by the staff-state repair. The human-authorized processing pulse is recorded separately from the older B3a motion table. |
| Lighthouse mobile on `/dues` | PASS: Lighthouse 13.6.0, simulated mobile throttling (4× CPU, 150 ms RTT), performance 94/100, LCP/FCP 1.206 s, TBT 292.5 ms, CLS 0. Exit 0; score ≥90 and LCP <2.5 s asserted. |
| Five-second test with three people, including a Hindi reader | NOT RUN — human check. |
| Real phone | NOT RUN — human check. |
| Hindi read | NOT RUN — human check. |
| Human design/flow sign-off | NOT RUN. |

Browser plugin not available; the repository's Playwright workflow is the fallback. QA used isolated production port 3001 and one worker to avoid the observed Windows high-worker crash. The QA server was stopped after screenshots and Lighthouse; port 3001 is free and the user's development preview remains running on port 3000. No backend, real authentication, persistence, deployment or paid provider calls are part of this review.

Final repair checks selected `staff-states`, the seven affected staff/counsellor layout scenarios, the staff sign-in/dashboard flow, parent dues retry, and all six script-budget routes, at both widths. They did not rerun the entire unchanged 202-case baseline. Route fallback exports and preview branches were reviewed to confirm they use the same loading helper, with the counsellor variant preserved. No normal-route access checks or financial logic changed.

## Screenshot review coverage

The refreshed production inventory has 384 PNGs: 24 routes × two languages × four states × two widths. A SHA-256 manifest, exact changed-image list, 24 contact sheets and the Lighthouse JSON are held outside the repository in the session's `gate0-review` visualization folder. Contact sheets show every full image at reduced scale; they do not establish small-text readability by themselves. Fresh capture changed 80 images and left 304 byte-identical. All 176 parent images are unchanged. Changed staff/public images are being reviewed again.

Parent review has covered all 176 images for consent, course, dashboard, dues, root scaffold, login, progress, receipt detail, receipts, settings and student information in contact sheets; all 44 normal images were also opened at original resolution. Eight loading/empty/error images were opened at original resolution where layout or small text needed confirmation. Parent Home and dues show ₹15,000, the due date and one Pay control above the fixed phone navigation in both languages. No parent clipping or broken Devanagari was seen; a human Hindi copy review remains outstanding.

The coordinating reviewer covered the remaining 208 staff/public images in 13 contact sheets, all 52 normal originals, and original-size staff dashboard error and ledger loading images. The very tall roster images were also inspected with full-pixel top/bottom crops because automatic resizing made their text too small. Across both reviews, all 384 pre-refresh images have been viewed in sheets and all 96 normal originals have been opened. The staff/auth consistency finding was repaired and passed the affected automated checks. Fresh capture and hash comparison are complete; visual confirmation of the 80 changed images is recorded under Final screenshot pass.

Purpose review: sign-in identifies the family; consent explains data use; Home answers amount/date/action before linking facts; fee details explain totals; receipts explain payment evidence; academic/course/student pages answer factual detail questions; settings show language and granted permissions. Money styles, status labels, separators and the shared empty/error components are consistent across those parent views. The unchanged root scaffold still says the screens are the next build step; remove that obsolete setup content when prototype scaffolding is removed in T7.2.

## Final screenshot pass

Claude opened all 27 distinct images among the 80 changed screenshots, grouped by SHA-256, including the very tall roster images. The staff error, loading and sign-in states hold their dark frame and navigation. Three flaws were fixed:

- Staff sign-in: the show-password button was taller than its field and stuck out of it. Both sign-in fields are now 44 px and the button sits inside the field.
- Dashboard stat cards: labels sat at different heights when a chip wrapped. Card content now starts from the top.
- Students empty preview: the header and tabs still counted 60 students above "No matching students". The preview now shows zero counts.

After those fixes the production build passed and the full browser suite, run with one worker, exited 0. The run before the fixes had one failure out of 230, the `/dashboard` first-view check in English at desktop width, which did not repeat. Treat it as intermittent; its cause was not found. The affected screenshots were then recaptured and inspected. The small test-card bar colours on the staff sign-in panel are decorative and were left alone.

Human checks can be supplied later and do not block Phase 1 once all Codex checks pass. The prototype remains fixture-backed, with unsigned, bounded cookie state and public mock credentials; it is not production access control or real payment processing.
