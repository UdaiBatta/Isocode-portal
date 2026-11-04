You are building a coaching institute's fee tracking system and parent portal for Company A, Jaipur. The frontend is Next.js with BoardUI, and the backend is Django with PostgreSQL. This one prompt replaces all earlier prompts. It runs the job from where the repo stands now through to Gate 7. Keep going through every task and phase without waiting for me, except where STOP RULES says to stop.

Full spec: docs/PLAN.md.
Repository: https://github.com/UdaiBatta/isocode-coaching_tracker. It must stay public.

MY SETTINGS
WHY DJANGO: Django gives me migrations, transactions with row locks, sessions and password hashing out of the box, so the money and access code stands on tested parts instead of code I wrote myself.
OPTIONAL EXTRAS TO BUILD: T6.1, T6.2, T6.3, T6.4
STOP AT GATE 0: no
LIVE URL: comes later, after my Vercel part. Use the placeholder <LIVE_URL> until then.


STEP 0: DO THIS FIRST
1. Check that docs/PLAN.md contains the line "Plan version: 3". If it does not, stop and tell me: "Save the new PLAN.md over docs/PLAN.md, then tell me to continue." Never rebuild the plan yourself.
2. Read AGENTS.md, docs/progress.md and docs/decisions.md. Run git status and git log -5 --oneline.
3. Save this whole prompt, exactly as written, to docs/PROMPTS.md, replacing what is there.
4. In AGENTS.md, replace the "Current execution sequence" paragraph with: "Current job: docs/PROMPTS.md. In a new session or after a context summary, re-read it and docs/progress.md, then continue from the next unfinished task. Do not stop between tasks or phases." In the same file, change the rule "Build Phase 0 first. No database, API or real sign-in implementation until Gate 0 is signed off." to "Build Phase 0 first. No database, API or real sign-in implementation until the Gate 0 checks that Codex runs have passed."
5. Add to docs/decisions.md: docs/PLAN.md now specifies Django in full, so the earlier notes about overriding a Node backend no longer apply. The build now runs from one prompt. The human's Gate 0 test no longer blocks Phase 1, and its results are applied when given.
6. Commit with the message "docs: move to the Django plan and one build prompt", push, then start at the next unfinished task.

Prompt 2's work (T0.4, T0.5, T0.6) is already pushed, at commit 8cbeb9f. So the next task should be T0.7. Do not rebuild finished tasks. If docs/progress.md shows a different next task, trust it and continue from there.


IF THIS SESSION IS NEW OR YOUR CONTEXT WAS SUMMARISED
Re-read AGENTS.md, docs/PROMPTS.md and docs/progress.md. Run git status and git log -5 --oneline. Finish the task in progress, then continue in order. Read only the sections the current phase names.


STOP RULES
Stop and ask me only when:
- Step 0 finds the wrong plan.
- PostgreSQL or DATABASE_URL is not available at Phase 1.
- A test's expected value in B8 looks wrong.
- You have failed 3 times at the same problem. After 2 failures, stop guessing and find the root cause from the actual error. After the third, record it in docs/decisions.md and ask me. Never retry in a loop.
- I say usage is low, or you see a usage warning. Finish the current task, commit, update docs/progress.md, push and stop. Then list what remains and what the cut order below would remove.
- You reach Gate 7.
- STOP AT GATE 0 above says yes, and you reach Gate 0.
If the sandbox blocks git or the network, ask me for approval. Do not work around it, and carry on once approved.
After each phase, tell me in one line what finished, then continue without waiting.


RULES FOR THE WHOLE JOB

The spec
- docs/PLAN.md is 144 KB. Never read all of it. Find a heading and read only that range, for example: Select-String -Path docs/PLAN.md -Pattern '^### T4.1' and then Get-Content docs/PLAN.md | Select-Object -Skip <start> -First <count>. Read only what the current phase names under READ.
- On how this run proceeds, this prompt wins over docs/PLAN.md, AGENTS.md and docs/decisions.md. On what to build, docs/PLAN.md wins over older notes. If the spec and the client brief (Appendix A) disagree, the brief wins: record the conflict in docs/decisions.md.
- When the spec is silent, choose the simplest thing that meets the brief, record it in docs/decisions.md and continue. If it is a client fact you assumed, also add it to the assumption register for the TDD. Never invent client facts without labelling them. Never add real personal data.
- Everything runs on this computer. Do not deploy and do not touch Vercel. "Production build" means npm run build then npm run start, locally, with Django running once it exists.
- This is Windows, so you may be in PowerShell. The spec's commands are written for a Unix shell, so use the equivalents.

Commits
- Do tasks in order. Commit at least once per task. Each message starts with the task ID, such as "T2.3: allocate payments oldest first".
- Run npm run check before every commit. Never commit failing code.
- Never squash or force-push, because the reviewers read the history.
- Add one line to docs/progress.md after each task: task ID, what was done, anything left open. It must hold everything needed to resume.
- Push at the end of each phase, not after every commit, because CI runs on each push to main.

Code
- Keep code small: no abstraction with one implementation, no config for a value that never changes, no scaffolding for later. When you take a shortcut with a known ceiling, mark it with a LIMIT: comment naming the ceiling and the upgrade path. These feed the TDD.
- Never remove validation, access control, error handling or accessibility to save code.
- Add a dependency only if B1 lists it. If you need another, explain why in docs/decisions.md.
- Fix failing checks. Do not weaken them.

Money, dates and scores
- Money is integer paise, with no floats. Balances are calculated from allocations, never stored. Display money only through lib/format.ts.
- Today is frozen at 2 Nov 2026 in demo mode. Dates are datetime.date in Django and YYYY-MM-DD strings in JSON. Today comes only from backend/fees/clock.py once it exists.
- Never change an expected value in B8 to make a test pass. Those numbers were calculated independently, so fix the code. If a value looks wrong, stop and ask me.
- In Python, never use round() for money or scores, because it rounds halves to even. Math.round(x) in the spec becomes math.floor(x + 0.5). Follow the rules in the B8 introduction, and keep the float expressions in B8.9 in the order written.

How the apps talk
- The browser talks only to Next.js. Pages call only lib/data and lib/actions, which call Django through lib/backend.ts. Never import fixtures into a page.
- Only Django decides access. Every Django view uses @api(role=...), except the webhook and cron views, which have their own secrets. Rules, storage and access checks go in Django. Screens go in Next.js.
- Django returns each B5 view model exactly: camelCase keys, paise as integers, dates as YYYY-MM-DD.
- Pages and components should not change when data becomes real. Change lib/data and lib/actions.

Interface
- Real routes and real free BoardUI components. Do not build lookalikes. Use BoardUI semantic tokens, never raw colours, outside the accent ramp.
- Every screen has loading, empty and error states, which show through ?state= until T7.2. No dead controls and no hover-only behaviour. Each screen works at 360 px and 1280 px. All parent-facing text goes through lib/i18n, in Hindi and English.
- Parent routes use CSS motion only. motion is the only animation library. Respect prefers-reduced-motion everywhere. Never animate Hindi letter by letter. Never run npx shadcn init.

Secrets
- Never print or commit a secret. .env.example holds names only. .env.local, dist/ and docs/inbox/ are never committed, including prompt text from docs/inbox/.

Usage, because it is limited and running out before Phase 7 would hurt most
- Do nothing the spec did not ask for: no refactors, renames, reformatting, extra documents, extra features, or polish beyond the acceptance checks. Do not redo work that passes its checks.
- Search before opening a file, and read line ranges rather than whole files. Never read node_modules, .next, .venv, package-lock.json, generated migrations or docs/screens as text. Limit command output, for example with Select-Object -Last 40. Never print seed rows or full build logs.
- Copy instead of retyping: take copy and policy text from the spec with a command, let the BoardUI CLI write BoardUI source, and generate repeated rows with loops. Edit files in place, and do not print a file back after writing it.
- Run the smallest check that proves the change. While working on logic, run the one test file, such as npm run py -- backend/manage.py test fees.tests.test_refund --keepdb. Before each commit, run npm run check. After changing one screen, run npm run screens -- --only=<route>. At the end of each phase, run npm run test:e2e.
- Run full npm run screens only in T0.15 and T7.3. Run the full 2,600-student seed only in T1.3 and T4.3, and use npm run db:seed -- --small otherwise.
- No parallel agents or cloud tasks. Keep only the BoardUI MCP server on.
- Keep about a quarter of the allowance for Phases 7 and 8, and do not start Phase 6 below that. If usage runs low, cut in this order: Phase 6 from the last task upwards, then outside extras from T0.13 (the /demo hero first, then 21st.dev pieces), then visual polish beyond the acceptance checks. Never cut the core flows, the money and access tests, deployment, the TDD or deployment.md.


PHASE 0: FINISH THE PROTOTYPE, WITH FAKE DATA

Parent screens (T0.4 to T0.6), already built
P2 Dues matters most in this project: a parent on a low-end phone must see the amount, the date and what to press within five seconds. Do not rebuild these screens. They must still meet these checks, and T0.14 will test them. Fix any failure:
- Each screen matches P1, P2, P3 and Supporting pages in B5, and every control responds.
- Loading, empty and error each show through ?state=.
- Each works at 360 px and 1280 px, in Hindi and English.
- On P2, the Pay button is visible without scrolling at 360 x 640 in both languages.
- Parent routes use CSS motion only.

Staff screens and index (T0.7 to T0.12)
READ, by heading only: B2, B3, B4, then in B5 the sections S1 to S5 and Supporting pages, then T0.3's table of simulated changes, then "T0.4 to T0.11 Screens" and "T0.12 Index".
BUILD:
- T0.7: S1 Dashboard and /staff/login
- T0.8: S2 Ledger
- T0.9: S3 Refund, using the Ishita figures from B5
- T0.10: S4 Automation
- T0.11: S5 Counsellor tasks
- T0.12: /proto, listing all routes with loading, empty and error links for each, and /demo as written in B5
RULES:
- The refund screen has no editable amount.
- One task and one commit per screen.
- After each screen run npm run screens -- --only=<route> and view only the 1280 px image, plus the 360 px image if the layout changes at that width.
DONE WHEN:
- Each screen matches B5, every control responds, and each state shows through ?state=.
- Each screen works at 360 px and 1280 px.
- Every link on /proto opens the right thing.
- Every row of the T0.3 table works through the UI:
  - Pay ₹15,000: Ishita's balance becomes clear, the reminder shows "Stopped: paid", and dashboard outstanding and that batch row drop by exactly ₹15,000.
  - Wrong amount: P2 shows "checking it", and a new queue item appears.
  - Approve refund: the student shows Withdrawn, reminders stop, and P2 shows the refund.
  - Resolve queue item: the item closes, and the ledger updates.
  - Mark False flag: the task closes, and the accuracy tile changes.
  - Demo date to 9 Nov and run: Mohit's -7 appears, and Ishita's 30 appears only if unpaid.
  - Reset demo: clears the proto cookie.
- npm run check passes.

Motion, checks and self-review (T0.13 to T0.15, then Gate 0)
READ, by heading only: B3a, the e2e and motion rows of B13, then T0.13, T0.14, T0.15 and Gate 0.
BUILD:
- T0.13: npm install motion and add the reduced-motion CSS from B3a. Add the CSS motion from the B3a table: Pay pressed state, P3 tick, S3 line fade, S4 row highlight. Bring in and adapt CountUp and BlurText. Check docs/inbox/. Build the /demo hero, and fill in docs/third-party.md.
- T0.14: e2e/layout.spec.ts, e2e/controls.spec.ts, e2e/perf.spec.ts and e2e/reduced-motion.spec.ts from B13. playwright.config.ts uses webServer to run npm run start, so the test command starts and stops its own server.
- T0.15: Open every screenshot and check it against B3 and B5. Purpose pass: for each element on each screen, ask "what question does this answer?", and delete it if there is no answer. Consistency pass: one primary action per screen, one chip style, one money style, the same empty and error layouts, no raw colours, aligned figures in tables, and outside components that look like they belong with BoardUI.
RULES:
- Motion must show that something changed or confirm that something happened. Durations are 150 to 250 ms with ease-out, count-ups last at most 600 ms, and nothing loops except an optional /demo background. Money is exact on first paint, and a number animates only when it changes. Reject anything needing gsap, three, ogl, WebGL or canvas backgrounds.
- Use React Bits, 21st.dev and MotionSites only where B3a allows. Log each one in docs/third-party.md.
- React Bits (https://reactbits.dev): only CountUp for the S1 tiles, with its number formatting replaced by inr(), and BlurText for the /demo heading, by words only.
- 21st.dev (https://21st.dev): only the three gaps in B3a, which are the S2 vertical timeline, the EmptyState layout and the /demo role cards, from docs/inbox/21st/. Do not call its paid tools.
- MotionSites (https://motionsites.ai): the /demo hero only, from docs/inbox/motionsites-hero.txt.
- Do not wait for me if docs/inbox/ is empty. Build those pieces from BoardUI and CSS.
- Never commit anything from docs/inbox/, including prompt text.
- Delete any motion that adds nothing.
DONE WHEN:
- All e2e specs in T0.14 pass after npm run build, and tests/motion-boundary.test.ts passes. Compressed script bytes are at most 200 KB on /dues, /login and /pay/[token], and at most 350 KB on /demo. /dues is unchanged in size by T0.13.
- You have viewed every screenshot and done the purpose and consistency passes in T0.15. If you cannot view images, say so in docs/gate-0.md. Run npx lighthouse on /dues with mobile settings if a browser is available. Otherwise mark it for me.
- The commit is tagged v0-prototype, and docs/prototype-notes.md says what changed and why.
- docs/gate-0.md lists every check with its result, and marks the human checks (five-second test, real phone, Hindi read, sign-off) as not yet run.
- Everything is pushed to GitHub, including the tag.
Then, if STOP AT GATE 0 is no, continue straight to Phase 1. If it is yes, give me the phone test steps from FINAL REPORT and stop.


PHASE 1: DJANGO, DATABASE, SIGN-IN AND CONSENT (T1.1 to T1.5)
BEFORE YOU START: confirm DATABASE_URL is set in .env.local, without printing it, and that a connection works. If not, stop and give me these steps:
  1. Install PostgreSQL 17 from https://www.postgresql.org/download/windows/ and remember the postgres password.
  2. Run: & "C:\Program Files\PostgreSQL\17\bin\createdb.exe" -U postgres coaching_fees
  3. Add this line to .env.local, with the password: DATABASE_URL=postgres://postgres:<your password>@localhost:5432/coaching_fees
  4. Add network_access = true under [sandbox_workspace_write] in %USERPROFILE%\.codex\config.toml, because Django's tests connect to this database.
Python 3.14 is already on this computer.
READ, by heading only: B1, B7, the B8 introduction, B8.1, B8.2, B8.3, B8.4, B8.6, B9, B10, B11, B12, B13, P1 in B5, then T1.1 to T1.5.
BUILD:
- T1.1: .venv, then backend/ with requirements.txt, requirements-dev.txt, .python-version and the config project as B1 lays out. Add .venv/ and __pycache__/ to .gitignore. Settings per B9, fees/models.py per B7 including the view, all CHECKs and partial unique indexes, migrations, scripts/py.mjs, the new package.json scripts, CI per B13, and Django in Playwright's webServer list using npm run py -- backend/manage.py runserver 8000 --noreload. Replace the "Active stack decision" section of AGENTS.md and the rules it changes with the A4 text, keeping the Next.js and BoardUI sections.
- T1.2: fees/domain/dates.py, phone.py and fees/clock.py.
- T1.3: money.py and ledger.py, then fees/management/commands/seed.py per B10.
- T1.4: fees/auth.py with @api, the views request_otp, verify_otp, staff_login, logout and me, then lib/backend.ts and lib/actions/auth.ts. Wire P1 and /staff/login to real data. Access is enforced in Django, not in Next.js middleware.
- T1.5: grant_consent, a consent check inside @api(role="parent") that returns 403 consent_required, and the declined state.
VALUES:
- Python packages: Django>=5.2,<5.3 (5.2 LTS, not the newest), psycopg[binary], dj-database-url, python-dotenv, tzdata, and from Phase 5 anthropic. Dev only: ruff. backend/.python-version holds 3.14. Use plain views and Django forms, with no Django REST Framework.
- INSTALLED_APPS holds only django.contrib.sessions and fees. Middleware holds only SecurityMiddleware, SessionMiddleware and CommonMiddleware. Django's CSRF middleware stays off on purpose, for the reasons in B11. This replaces the CSRF line in AGENTS.md, and the TDD must state it.
- .env.local, keeping DATABASE_URL as it is: BACKEND_URL=http://localhost:8000, APP_URL=http://localhost:3000, DEMO_MODE=true, DJANGO_DEBUG=true, DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1, and NEXT_PUBLIC_PROTO=1 until T7.2. Generate DJANGO_SECRET_KEY, INTERNAL_API_SECRET, PAYMENT_WEBHOOK_SECRET, CRON_SECRET and SEED_DEMO_PASSWORD with Python's secrets.token_urlsafe, write them only to this file, and never print or commit them.
- .env.example lists names only: DEMO_MODE, INTERNAL_API_SECRET, PAYMENT_WEBHOOK_SECRET, DATABASE_URL, DJANGO_SECRET_KEY, DJANGO_ALLOWED_HOSTS, DJANGO_DEBUG, CRON_SECRET, SEED_DEMO_PASSWORD, ANTHROPIC_API_KEY, ANTHROPIC_MODEL, BACKEND_URL, APP_URL, NEXT_PUBLIC_PROTO.
- Demo logins, in the seed and in deployment.md: parent of Ishita +91 90000 00587, parent of Aarav +91 90000 00412, parent of Mohit +91 90000 00219, parent of 2 children +91 90000 00777, accounts@demo.test, accounts.mlv@demo.test, counsellor@demo.test. Staff use the demo password. The OTP shows on screen in demo mode.
RULES:
- Tests run with Django's test runner on local Postgres, never on Neon.
- Run the full 2,600-student seed once, in T1.3. Use --small after that.
- Fixtures still power every other screen.
DONE WHEN:
- Every acceptance check in T1.1 to T1.5 passes, including:
  - A test proves that a bad fee_plans row, a duplicate reminder_log key and a second open counsellor_tasks row for a student are each rejected.
  - B8.1 and B8.2 pass.
  - test_seed.py finds 2,600 students, the three sample rows exactly as in the brief, and over60Pct between 11% and 13%. The seed runs twice with identical results, and the full seed finishes in under 3 minutes.
  - test_otp.py passes.
  - The consent row holds wording version, language, time and OTP reference.
- npm run check now includes the Python checks, and passes.
- On a local production build, each role signs in and lands on its home page: /dues, /staff/dashboard, /counsellor/tasks.
- A new guardian cannot reach /dues until consent is saved.
- A request to Django without X-Internal-Key is refused, and test_access.py fails on any view without @api.
- AGENTS.md follows the A4 text, and no longer says anything overrides the plan.
- You have reviewed the auth diff for missing role checks.
- npm run test:e2e passes with both apps running.
- Everything is pushed to GitHub.


PHASE 2: PAYMENTS AND RECEIPTS (T2.1 to T2.6)
A parent signs in, pays on the mock gateway and gets a GST receipt, all on real data.
READ, by heading only: the B8 introduction, B8.3, B8.4, B8.8, B9, B11, then P2, P3 and S2 in B5, then the Phase 2 tasks.
BUILD:
- T2.1: A Django view returning the DuesVM contract with all modes, and lib/data/dues.ts calling it.
- T2.2: A Django view for the S2 view model, and lib/data/ledger.ts. The timeline can come in Phase 3.
- T2.3: domain/matching.py (B8.8), and services/payments.py with process_payment_event plus the shared allocate-and-receipt function.
- T2.4: POST /api/webhooks/payment on Django, the pay token, /pay/[token], /mock-gateway/[token], submitMockPayment and the result page. Keep the checkout and PaymentGraphic from Phase 0. The webhook carries the payment method.
- T2.5: Django views for the receipt list and receipt, lib/data/receipts.ts, /receipts and /receipts/[id].
- T2.6: record_counter_payment, recordCounterPayment and its Modal.
RULES:
- The mock gateway acts as an outside gateway: the Next.js action signs a real payload and POSTs it to Django at BACKEND_URL.
- Every money path runs in transaction.atomic with select_for_update, and uses no floats.
- The webhook checks its HMAC against the raw request body, and is idempotent. A replayed event changes nothing.
- A wrong amount marks nothing paid. It creates a queue item.
- Django returns each B5 view model exactly. The dues page itself should not change, only its data function.
DONE WHEN:
- Every acceptance check in T2.1 to T2.6 passes, including each row of B8.8 and test_payments.py.
- Ishita's parent sees ₹15,000, "Was due 10 Oct" and "23 days overdue". Mohit's sees ₹40,000 and "Due 15 Nov". Aarav's sees the next instalment.
- All values on S2 match B10 for each named student, and centre scope is enforced.
- Paying as Ishita's parent marks the instalment paid. A bad signature gets 401. Replaying the event changes nothing. A tampered token gets "not valid". A wrong amount marks nothing paid and creates a queue item, and P2 shows "checking it".
- A ₹15,000 receipt shows taxable ₹12,711.86, CGST ₹1,144.07, SGST ₹1,144.07, total ₹15,000, a GSTIN and a number like MLV/2026-27/…. Printing hides controls. Parents see only their own receipts.
- A counter payment of ₹50,000 across balances of ₹15,000, ₹30,000 and ₹30,000 allocates per B8.4, and any excess goes to the queue.
- You have reviewed all money code for floats and missing transactions.
- npm run test:e2e passes on a local production build with Django running.
- Everything is pushed to GitHub.


PHASE 3: REMINDERS AND DEMO CONTROLS (T3.1 to T3.4)
Reminders run by date and stop as soon as a parent pays. Staff can see all of it, and a reviewer can replay it.
READ, by heading only: the B8 introduction, B8.7, B9, the demo parts of B10, S4 in B5, then the Phase 3 tasks.
BUILD:
- T3.1: domain/reminders.py (B8.7), and renderReminder in both languages in lib/reminder-text.ts.
- T3.2: services/reminders.py, GET /api/cron/reminders, backend/vercel.json, and a timeline in S2.
- T3.3: Django views for S4, and lib/data/automation.ts, which fills body with renderReminder. The Sent, Upcoming, Stopped and Needs a call lists, the message Drawer, resolve_unmatched and the queue Drawer.
- T3.4: set_demo_date, run_reminders_now, reset_demo and GET /api/cron/demo-reset.
RULES:
- Write backend/vercel.json as B9 says, but do not deploy. It sets maxDuration 60 for config/wsgi.py and three crons: /api/cron/reminders at "0 5 * * *", /api/cron/risk at "30 5 * * *" and /api/cron/demo-reset at "30 20 * * *". Test the cron routes on Django locally by sending the Authorization header yourself.
- Reminders are worked out at send time, never queued. An outage sends one message, not a backlog.
- reminder_log stores facts. Next.js renders the message text from lib/i18n through renderReminder in lib/reminder-text.ts, so do not copy the wording into Python.
- Demo views refuse unless DEMO_MODE=true.
DONE WHEN:
- Every row of the B8.7 table passes, and test_reminders.py passes.
- Calling a cron route without the secret gets 401.
- Every S4 control works, and a resolved item shows who resolved it.
- Concurrent resolution of a queue item returns an error rather than paying twice.
- The stop-on-payment proof in T3.4 passes as an e2e test:
  1. Ishita's next reminder shows 9 Nov, and Mohit's shows 8 Nov.
  2. Ishita's balance is paid, and that row now reads "Stopped: paid".
  3. The date moves to 9 Nov, and reminders run.
  4. Mohit's parent gets the -7 message in Hindi, and nothing goes to Ishita's parent.
  5. Reset restores everything.
- You have done the Phase 3 security self-review of the webhook, cron auth, OTP, internal key and access scope, recorded findings in docs/decisions.md and fixed them.
- Everything is pushed to GitHub.


PHASE 4: REFUNDS, DASHBOARD AND EXPORTS (T4.1 to T4.4)
READ, by heading only: the B8 introduction, B8.5, B8.6, B9, the refund policy in B6, then S1 and S3 in B5, then the Phase 4 tasks.
BUILD:
- T4.1: domain/refund.py (B8.5).
- T4.2: services/refunds.py, Django views for save_refund_draft, approve_refund and mark_refund_paid, lib/data/refund.ts, and /refund-policy from refund_policies.
- T4.3: A Django view using ORM aggregates over instalment_balances, and lib/data/dashboard.ts. A second view returns StudentsVM (S1b in B5) for lib/data/students.ts, filtered, sorted and paged in the database.
- T4.4: dues.csv and receipts.csv (B9), respecting centre scope.
RULES:
- The refund amount is never editable. e2e/controls.spec.ts must assert this.
- Approval freezes the figures and stops reminders. An open queue item blocks approval, with a link to it.
- The dashboard stays at four tiles, a table and one bar per row. No other charts. Totals must reconcile.
- Run the full 2,600-student seed for the dashboard speed check, then go back to --small.
DONE WHEN:
- All 11 rows of the B8.5 table pass, and test_refund.py passes.
- Aarav with a withdrawal date of 2 Nov shows ₹18,986.31. After approval, P2 shows the refund.
- A test on a small hand-counted data set matches every dashboard bucket. Named-student totals match S2, and all-centres totals equal the sum of the centres.
- Paying ₹15,000 lowers the dashboard by exactly ₹15,000.
- The dashboard responds in under 2 s with 2,600 students.
- The MLV-only user sees only MLV.
- dues.csv and receipts.csv are valid, respect centre scope, match the dashboard, and neutralise formula characters: fields that could start with =, +, - or @ are prefixed with a single quote.
- npm run test:e2e passes.
- Everything is pushed to GitHub.


PHASE 5: DROPOUT-RISK SCORE AND CALL BRIEF (T5.1 to T5.6)
Build the transparent risk score, the counsellor call brief and the counsellor screen on real data. Then delete the fixtures.
READ, by heading only: the B8 introduction, B8.9, B9, B11, S5 in B5, the risk rows of B13, then the Phase 5 tasks.
BUILD:
- T5.1: domain/risk.py (B8.9) and should_create_task.
- T5.2: services/risk.py and GET /api/cron/risk. Skip withdrawn students. Save flags and create tasks.
- T5.3: Add anthropic to backend/requirements.txt, then call_model, generate_brief and ensure_call_brief exactly as in B8.9.
- T5.4: Django views for S5, close_task, and lib/data/counsellor.ts.
- T5.5: test_risk_eval.py, with results in docs/TDD.md marked as synthetic.
- T5.6: Delete lib/fixtures/, lib/clock.ts and the proto cookie code.
RULES:
- The score decides. Claude only writes the call brief, using numbers only. Its request must contain no name, phone number or student code.
- Use the call_model code in B8.9 as written. The default model is claude-opus-5-5, and ANTHROPIC_MODEL can change it.
- Any model failure or refusal falls back to the template.
- ANTHROPIC_API_KEY is optional, so do not wait for it. Without it, the template shows and the app still works.
- Tests use a fake call. Make one real call by hand in T5.3, and only if a key is set. Read that brief for sense.
- domain/risk.py and services/risk.py must never import messaging, reminder, payment or ledger write code.
- Parents and the accounts role never see risk data. Counsellors never see fee amounts.
DONE WHEN:
- Every row of both B8.9 tables passes, and test_risk_isolation.py and test_risk_brief.py pass.
- Riya has a High task, Arjun is Watch with no task, Neha is under "Not enough data", and Ishita has no flag.
- Every S5 control works. An accounts session is refused.
- A false flag needs a note, closes the task, changes the accuracy figure, and is not re-created by the next run.
- lib/fixtures/, lib/clock.ts and the proto cookie code are gone, and a search finds no references.
- test_risk_eval.py passes, and evaluation results are in docs/TDD.md, marked as synthetic.
- npm run test:e2e passes.
- Everything is pushed to GitHub.


PHASE 6: EXTRAS (only those in OPTIONAL EXTRAS TO BUILD, in this order)
READ: only the Phase 6 table, then whichever sections each task names.
BUILD:
- T6.1 (screen already built by Claude on sample data; build only the Django view behind lib/data/progress.ts): Attendance and scores in the parent portal, /progress, the Academic info tab of the parent dashboard: attendance per recent week and recent test scores, with no comparison with other students and no risk data. Accept: a parent sees only their child, in both languages and all states.
- T6.2: Bulk CSV upload per batch at /staff/uploads, with columns student_code,week_start,attended,held and student_code,test_date,test_name,score,max_score. Uses File Upload (npx boardui@latest add file-upload --yes). Preview with row-level errors before anything saves. All or nothing. Rejects codes outside the chosen batch. Sample files go in public/samples/. Accept: bad rows are listed with line numbers, a good file saves, and a re-upload updates rather than duplicates.
- T6.3: Tally XML export of receipts, added to the export Button Group: an ENVELOPE import with one Receipt voucher per receipt. Label it "not tested on a real Tally install" in the TDD. Accept: the XML is well-formed, and totals match the CSV.
- T6.4: A Withdraw consent link for parents. It sets withdrawn_at, hides data, stops reminders and adds the student to Needs a call. Accept: a test covers each effect.
RULES:
- If a task can't be finished, remove it from the interface, including its link or button, so nothing is left dead.
- Stop adding as soon as usage runs low.
DONE WHEN:
- Each chosen task meets its Accept line, in every state and language it uses.
- npm run test:e2e passes.
- Everything is pushed to GitHub.


PHASE 7: FINAL TESTS AND DOCUMENTS (T7.1 to T7.4)
Stop adding features and fix only what is broken.
READ, by heading only: B13, D1, D2, D3, D4, D5, then the Phase 7 tasks.
BUILD:
- T7.1: e2e/golden.spec.ts, then run everything in B13 on a production build with the seeded dev database, and fix all failures.
- T7.2: Delete /proto, the ?state= helper, NEXT_PUBLIC_PROTO and any related code. Keep real loading, empty and error UI. layout.spec now reaches states by real means where possible.
- T7.3: Search history and files for secrets (the spec's command is git log -p | grep -iE "sk-|password=|secret=", so use the PowerShell equivalent), and check .env.local was never committed. Remove notes from docs/progress.md and docs/decisions.md that are about tools and not the product, such as notification sounds and model routing calls. Collect LIMIT: comments for the TDD's limits section. Re-run npm run screens and the T0.15 passes. Check docs/third-party.md is complete.
- T7.4: docs/TDD.md per D1, with screenshots. scripts/build-tdd.ts renders it with marked to HTML, then to dist/TDD.pdf with Playwright's page.pdf(), including the Hindi font. dist/deployment.md per D2.
RULES:
- Do not deploy.
- Use my WHY DJANGO reason above in the TDD's architecture section. Do not invent another. State the cost honestly: two apps to run and deploy, and an extra network call per page.
- Label every assumption in the TDD, using the D3 register plus anything added to docs/decisions.md.
- The TDD's first lines hold the GitHub URL and the live link placeholder <LIVE_URL>. In deployment.md, the environment variables section gives names only, never the values.
- Use the business case numbers in D1 as written: annual loss ₹79.2 lakh, ₹3.74 crore over 60 days late, ₹1.87 crore at the 6% target. State that the parent-calls goal cannot be measured in the app.
- dist/ holds demo passwords and is never committed.
- Do not build the ZIP yet.
- Do not invent test results. Mark anything you could not run. Anything that depends on my phone test, including what the five-second test changed and the Hindi reader limit in D5, uses the placeholder <GATE_0_RESULTS> until I send the results.
DONE WHEN:
- Everything in B13 passes on a production build with Django and the seeded dev database, including e2e/golden.spec.ts.
- /proto returns 404, and the preview helper and NEXT_PUBLIC_PROTO are gone.
- The secret search finds nothing, .env.local was never committed, and nothing from docs/inbox/ was committed.
- test_access.py still walks every URL pattern and passes.
- The "Run locally" steps in D2 work on a fresh clone.
- docs/TDD.md, dist/TDD.pdf and dist/deployment.md exist.
- Everything is pushed to GitHub.


GATE 7: FINAL REPORT, THEN STOP
Report in under 25 lines:
1. What is done, what is open, and anything you could not run.
2. Tell me to read docs/TDD.md and correct anything I cannot defend in the interview.
3. If my phone test has not been done, give me these steps:
   - In one terminal run npm run dev:api. In a second run npm run build, then npm run start -- -H 0.0.0.0.
   - Run ipconfig to find this computer's IPv4 address. On a phone on the same Wi-Fi, open http://<that address>:3000/dues. If Windows Firewall asks, allow private networks.
   - Sign in with +91 90000 00587. The OTP shows on screen.
   - Five-second test: show the dues screen to 3 people for five seconds. Each must say the amount, the date and what to press. At least one reads the Hindi version.
   - Real phone: it opens quickly, looks right, and the button is easy to press.
   - Hindi: a Hindi reader checks all the copy.
   - Sign-off: I am happy with the look and the flows.
   Then give me the GATE 0 RESULTS reply format below.
4. Print the T8.1 steps from docs/PLAN.md, which are my Vercel part, and give me the LIVE URL reply format below. The brief asks for a live link only "if you deployed it", so I can reply with none.


REPLIES I MAY SEND LATER

GATE 0 RESULTS
- Five-second test: <what each of the 3 people said>
- Real phone: <what I noticed>
- Hindi corrections: <list them, or "none">
- Other changes: <list them, or "none">
- Sign-off: <yes>
When I send this: apply these changes and nothing else.
DONE WHEN:
- Each change is made, and npm run check passes.
- The affected e2e specs pass.
- docs/prototype-notes.md records what the test changed and why. These notes become the TDD's UI section, so keep the testers' real findings.
- docs/gate-0.md shows the human checks as passed.
- Each <GATE_0_RESULTS> placeholder is replaced with the real findings, and dist/TDD.pdf is rebuilt if it exists.
Push to GitHub and report in under 10 lines.

LIVE URL: <the Next.js project's Vercel URL, or "none">
DEMO PASSWORD: <the production demo password>
When I send this: do T8.2.
READ: only T8.2, Gate 8 and D2 in docs/PLAN.md.
RULES:
- If any <GATE_0_RESULTS> placeholder is left, stop and ask me for the results first.
- Put the demo password only in dist/deployment.md, which is never committed. If there is no live app and no password, say reviewers use the value they set for SEED_DEMO_PASSWORD.
- If the live URL is "none", remove the <LIVE_URL> line from the TDD, and describe the deployment in deployment.md as planned, not as done.
- Rebuild dist/TDD.pdf. Package from the dist folder with: npx bestzip submission.zip TDD.pdf deployment.md
DONE WHEN:
- No <LIVE_URL> placeholder is left in any document.
- The first lines of the TDD hold the GitHub URL and, if there is one, the live link.
- dist/submission.zip holds exactly TDD.pdf and deployment.md, and is at most 25 MB.
Push to GitHub. Give me the Gate 8 checklist: read the final TDD, test the live app in a private window if there is one, confirm the repo is public and the history is intact, then upload. Then stop.

A BUG: <what I did, what I expected, what happened>
When I send this: find the root cause and make the smallest fix. Add a test if it is logic. Run only the check that proves the fix, commit, add a line to docs/progress.md, then stop. Change nothing else.

USAGE IS LOW
When I send this: finish the current task, commit, update docs/progress.md, push and stop. Then list what remains, and what the cut order above would remove.
