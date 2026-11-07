Repository: [Isocode-portal](https://github.com/UdaiBatta/Isocode-portal)

Live application: `<LIVE_URL>`

# Coaching Fees — technical design document

This is a backend and T5.5 evaluation checkpoint. Frontend integration, final browser acceptance, screenshots, the complete assumption register and handover artifacts remain open. It is not a completed Gate 7 submission. No deployment is claimed.


## Backend architecture

Next.js and BoardUI render the screens. Server-side data getters and actions call Django through lib/backend.ts, forwarding the sid session and the server-only internal API key. The browser talks to Next.js. Django owns authentication, access checks, validation, transactions, reminders, refund calculations and risk scoring; PostgreSQL stores the records.

The reason for Django is the human's stated choice: it gives migrations, transactions with row locks, sessions and password hashing out of the box, so money and access code stand on tested parts. The cost is two apps to run and deploy, plus an extra network call from Next.js to Django. Business dates come from fees/clock.py; the current demo date is 2 November 2026.

Master records cover centres, batches, students, guardians and staff. Financial records cover fee plans, instalments, payments, allocations, receipts, counters and refund snapshots. Balances are calculated from allocations through the instalment_balances view; they are never saved as mutable student balances. Money is integer paise. Academic, consent, reminder, review, counsellor and audit histories are separate records.

Payments allocate against locked records and issue a numbered GST receipt in the same transaction. Gateway event IDs are idempotent; ambiguous or wrong-amount payments enter review. Counter payments allocate oldest first. Refund previews are read-only; saving and approving recheck the current records. Approval freezes the calculation/policy snapshot, withdraws the student and stops further reminders. Reminder runs recheck current balances and status after locking; the instalment/step uniqueness constraint prevents duplicate log entries. Messaging and the gateway are local demo implementations.

The risk job reads financial and academic facts, writes flags/tasks and task audit snapshots, and cannot import financial or reminder writers. A task's trigger facts stay distinct from later live assessments. A false-flag outcome starts the specified suppression period. Optional brief wording is cached once per task and does not choose scores, payments or reminder actions.

## Backend security and verification

Django loads the current role and centre from the database on each request. Parent reads require saved consent and a linked, non-archived child; academic history is bounded by enrolment, today and withdrawal. Accounts cannot read risk, counsellors receive no fee amounts, and Admin cannot use parent, accounts or counsellor endpoints. Admin's posted login destination is /staff/manage/students; the main frontend does not yet have the merged Manage pages or real Admin adapters.

Django deliberately uses only SecurityMiddleware, SessionMiddleware and CommonMiddleware. CSRF middleware is off: Next.js server actions check Origin against Host, the browser session cookie is HttpOnly and SameSite=Lax, and Django JSON APIs require X-Internal-Key. The internal secret must stay server-side. Payment webhooks instead require a constant-time HMAC check, and cron endpoints require their own bearer secret. The URL-walking access test checks every registered view's guard.

The approved Anthropic SDK is pinned at 2.6.0. Its actual structured parser passed an offline HTTP-mock check with only the six numeric features. No API key is configured and no provider request was made; Standard summary remains the tested working path. No live-provider quality result is claimed.

The backend review searched tracked files and all-ref Git history for configured secret values and provider-key patterns, with no matches. The broader password=/secret= candidates were test literals, empty example variable names and specification placeholders. Neither .env.local nor docs/inbox/ appears in committed history. This is a bounded source review, not a penetration test.

The current local backend tests cover money boundaries, scope/consent, webhook idempotency, refund snapshots, audit rollback, reminder locking, risk isolation, brief fallback/cache and synthetic scoring. The final code check passed 68 frontend and 170 Django tests, types, Ruff and Django checks; eight existing lint warnings remain. The focused dashboard/access checks passed 15 tests. Current read-only dashboard API smoke timings on 2,600 students were 0.058–0.332 seconds; these are local measurements, not an end-to-end page SLA. Final combined production browser acceptance remains open. The earlier production suite returned 235 passed, 3 skipped and 2 failed; the auth assertion has a fix on the unmerged frontend branch, and the isolated policy-timeout recheck passed. That is not a clean final suite result.

## Manage assumptions beyond the brief

The human requested a global Admin/Manage workspace beyond the client brief. Audited save, fee-change, archive, restore and delete APIs are implemented. UUIDs identify real records. Centre codes are immutable because receipts use them. All linked students block batch archive or centre moves; restore requires active parents. Financial and protected history prevents deletion, so records with that history are archived. Payments and receipts are preserved.

For new students, an existing batch fee schedule supplies due dates. An empty batch uses four JEE or three NEET dates evenly spaced over its inclusive session, with the paise remainder in the last instalment. This scheduling policy is an assumption, not a client fact. Primary guardian replacement changes only that child's primary login link; other guardians and existing consent history remain. Reused guardian name/language changes apply to their linked children.

The human separately approved zero-value instalments for audited fee reductions. A reduction cannot take net fees below payments already allocated. A zero instalment is settled, has no payment link and creates no fictional payment or receipt. The audit retains the full before/after schedule and reason.

## Remaining acceptance limits

Claude's ADMIN.6 create-delete-create ID collision finding blocks the frontend merge. The real-session Admin adapters must be connected after that merge, using UUIDs before prototype ID validation. Refund date-preview/no-plan/dirty-draft wiring, CSV GET forwarding routes and the shared-demo reset confirmation/browser proof remain frontend work. Current backend read shapes are unchanged. Historical dashboard aggregates materialize scoped instalment IDs to avoid nested PostgreSQL semi-joins; memory use is acceptable for the 2,600-student brief and should be reviewed before materially larger deployments.

T5.6 fixture removal and T7.2 prototype removal require the reviewed frontend merge and explicit pause confirmation, which have not arrived. The final golden/browser suite, screenshots, human phone/Hindi/five-second results, full TDD/PDF and fresh-clone handover are not complete. T6.2–T6.4 extras have not been implemented. T8.2 packaging awaits its later human inputs. Nothing has been pushed or deployed in this continuation.

## Synthetic risk evaluation

The risk score follows the fixed B8.9 rules. High begins at 60, Watch at 35, and fewer than four valid attendance weeks or three valid tests produces “Not enough data.” Fee, attendance and test signals have caps of 40, 35 and 25; a single signal cannot reach High. A High result creates a counsellor call task. It cannot change payments, refunds or reminders. Optional AI wording does not choose the score or band; without a provider key, the standard summary remains available.

`backend/fees/tests/test_risk_eval.py` contains 30 fixed, developer-labelled synthetic cases: ten expected High and twenty expected not High. They cover combined signals, the 59/60 boundary, single-signal caps, settled balances, overdue-day boundaries and limited academic history.

| Synthetic result | Count |
|---|---:|
| True positives | 10 |
| False positives | 0 |
| False negatives | 0 |
| True negatives | 20 |
| High-band precision | 1.00 |
| High-band recall | 1.00 |

Precision is TP / (TP + FP); recall is TP / (TP + FN). All 30 cases agree with their authored expectations. This measures policy regression on constructed examples. It is not evidence of real dropout prediction: there are no observed dropout outcomes, independent test cohort or prospective pilot in this evaluation.

S5’s accuracy tile is a separate count of counsellor-marked calls. Its initial eight genuine outcomes out of eleven are fictional seed history, not empirical validation. Real performance needs a labelled pilot, review of missed concerns and false flags, and client approval before changing the stated weights or thresholds.
