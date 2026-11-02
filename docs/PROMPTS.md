# Codex Prompts: Coaching Fee Tracking and Parent Portal

Paste these into Codex in order. `PLAN.md` is the full spec, and each prompt tells Codex which parts of it to read, so it doesn't spend usage reading all 130 KB every time.

**Vercel is not part of development.** Prompts 1 to 12 run and test everything on your computer. Prompt 13 is for later, after you do the Vercel part.

## How to use this file

- Start a **new Codex session** for each prompt.
- Wait for Codex's report before pasting the next prompt.
- Put all your feedback in one message, not many small ones.

| # | What it builds | You do this first | Reasoning level |
|---|---|---|---|
| 1 | Project setup, shared code, fake data | Setup below | Medium |
| 2 | Parent screens | | Medium |
| 3 | Staff screens | | Medium |
| 4 | Motion, automated checks, self-review | Optional: 21st.dev and MotionSites | Medium |
| 5 | Changes from your prototype test | **Gate 0 test and sign-off** | Medium |
| 6 | Database, seed data, sign-in, consent | **Database connection string** | High |
| 7 | Payments and receipts | | High |
| 8 | Reminders and demo controls | | High |
| 9 | Refunds, dashboard, exports | | High |
| 10 | Dropout-risk score and call brief | Optional: Anthropic API key | High |
| 11 | Optional extra features | Decide which you want | Medium |
| 12 | Final tests and documents | | Medium |
| 13 | Live link and ZIP | **Your Vercel part** | Low |

## Setup, before Prompt 1

Check that you have Node 22 and Git, then:

1. Create an empty **public** GitHub repo named `coaching-fees` and clone it.
2. Inside it, create a `docs` folder and copy `PLAN.md` to `docs/PLAN.md`.
3. Install BoardUI from the repo root, using these two commands:

```bash
npx boardui@latest skill --client codex
```

```bash
codex mcp add boardui -- npx -y boardui@latest mcp
```

4. Add this to `%USERPROFILE%\.codex\config.toml`:

```toml
sandbox_mode = "workspace-write"
approval_policy = "on-request"

[sandbox_workspace_write]
network_access = true
```

5. Restart Codex in the repo folder, and run `/skills` to confirm BoardUI loaded.

**Expect git approvals.** Codex's sandbox keeps `.git` read-only, so it may ask before `git commit` and `git push`. Approve these. If it offers to stop asking for that command, accept, because the plan commits at least once per task.

---

## Stage 1: Prototype with fake data

### Prompt 1: Setup and shared code

```text
You are building a coaching institute's fee tracking system and parent portal from the spec in docs/PLAN.md. The first step is a clickable prototype with fake data. Do not build a database, real sign-in, API routes or cron yet.

GOAL
Set up the project and everything the screens will share: tasks T0.1, T0.2 and T0.3.

READ
docs/PLAN.md is over 100 KB, so do not read all of it. Find each heading and read only that range:
- A3, A4, A5
- B0, B1, B2, B3, B4
- B5: only the view-model types, for lib/types.ts
- B8 and B10: only the values the fixtures need
- B12, and the CI paragraph at the end of B13
- Part C: the Phase 0 introduction, then T0.1, T0.2, T0.3
Copy the B6 dictionaries out of the file with a command. Do not retype them.

RULES
- Everything runs on this computer. Do not deploy and do not touch Vercel.
- This is Windows, so you may be in PowerShell. The spec's commands are written for a Unix shell, so use the equivalents.
- If the sandbox blocks git, ask me for approval. Do not work around it.
- Run npm run check before every commit. Each commit message starts with the task ID. Never squash or force-push, because the reviewers read the history.
- Add a line to docs/progress.md after each task.
- After 3 failed attempts at the same problem, stop and ask me.

DONE WHEN
- npm run check and npm run build pass.
- A page with a BoardUI Button shows the teal accent, and a line of Hindi renders in Noto Sans Devanagari.
- A missing Hindi key fails the type check.
- .env.example is not ignored by git, and .env.local is.
- npm run screens saves images for the routes that exist so far.
- Each action in the T0.3 table changes what the data functions return.

FINISH
Push to GitHub. Report in under 10 lines: what is done, what is open, and anything you need from me. Then stop.
```

### Prompt 2: Parent screens

```text
Read AGENTS.md and docs/progress.md.

GOAL
Build the parent screens of the prototype: T0.4 (P1 Sign-in and consent), T0.5 (P2 Dues) and T0.6 (P3 Payment and receipts). P2 matters most in this project: a parent on a low-end phone must see the amount, the date and what to press within five seconds.

READ
From docs/PLAN.md, by heading only: B2, B3, B4, then in B5 the sections P1, P2, P3 and Supporting pages, then T0.4 to T0.6. The Hindi and English copy is already in lib/i18n.

RULES
- Real routes and real free BoardUI components. Do not build lookalikes.
- Pages call only lib/data and lib/actions. Never import fixtures into a page.
- Parent routes use CSS motion only.
- One task and one commit per screen.
- After each screen run npm run screens -- --only=<route> and view only the 360 px image.

DONE WHEN
- Each screen matches B5, and every control responds.
- Loading, empty and error each show through ?state=.
- Each screen works at 360 px and 1280 px, in Hindi and English.
- On P2, the Pay button is visible without scrolling at 360 x 640 in both languages.
- npm run check passes.

FINISH
Push to GitHub. Report in under 10 lines: what is done, what is open, and anything you need from me. Then stop.
```

### Prompt 3: Staff screens

```text
Read AGENTS.md and docs/progress.md.

GOAL
Build the staff screens and the index: T0.7 (S1 Dashboard and /staff/login), T0.8 (S2 Ledger), T0.9 (S3 Refund), T0.10 (S4 Automation), T0.11 (S5 Counsellor tasks) and T0.12 (/proto and /demo).

READ
From docs/PLAN.md, by heading only: B2, B3, B4, then in B5 the sections S1 to S5 and Supporting pages, then T0.3's table of simulated changes, then T0.7 to T0.12.

RULES
- Real routes and real free BoardUI components. Do not build lookalikes.
- Pages call only lib/data and lib/actions. Never import fixtures into a page.
- The refund screen has no editable amount.
- One task and one commit per screen.
- After each screen run npm run screens -- --only=<route> and view only the 1280 px image, plus the 360 px image if the layout changes at that width.

DONE WHEN
- Each screen matches B5, and every control responds.
- Loading, empty and error each show through ?state=.
- Each screen works at 360 px and 1280 px.
- Every link on /proto opens the right thing.
- Every row of the T0.3 table works through the UI.
- npm run check passes.

FINISH
Push to GitHub. Report in under 10 lines: what is done, what is open, and anything you need from me. Then stop.
```

### Prompt 4: Motion, checks and self-review

**Optional first:** copy up to 3 21st.dev components for the gaps in B3a into `docs/inbox/21st/`, or save one MotionSites prompt as `docs/inbox/motionsites-hero.txt`. If the folder is empty, Codex uses BoardUI and CSS instead.

```text
Read AGENTS.md and docs/progress.md.

GOAL
Finish the prototype: T0.13 (motion and outside components), T0.14 (automated UI checks) and T0.15 (self-review). Then write docs/gate-0.md and stop at Gate 0.

READ
From docs/PLAN.md, by heading only: B3a, the e2e and motion rows of B13, then T0.13, T0.14, T0.15 and Gate 0.

RULES
- Use React Bits, 21st.dev and MotionSites only where B3a allows. Log each one in docs/third-party.md.
- Never commit anything from docs/inbox/, including prompt text.
- Do not wait for me if docs/inbox/ is empty. Build those pieces from BoardUI and CSS.
- Fix failing checks. Do not weaken them.
- Delete any motion that adds nothing.

DONE WHEN
- All e2e specs in T0.14 pass after npm run build, and tests/motion-boundary.test.ts passes.
- You have viewed every screenshot. If you cannot view images, say so in docs/gate-0.md.
- The commit is tagged v0-prototype, and docs/prototype-notes.md says what changed and why.
- docs/gate-0.md lists every check with its result.

FINISH
Push to GitHub, including the tag. Tell me exactly what I need to test. Then stop. Do not start Phase 1.
```

### Gate 0: your test

This is the one check Codex can't do for you. Open the app on your phone without deploying it:

```bash
npm run build
```

```bash
npm run start -- -H 0.0.0.0
```

Run `ipconfig` to find your computer's IPv4 address. With the phone on the same Wi-Fi, open `http://<that address>:3000/dues`. If Windows Firewall asks, allow private networks.

Then check:
- **Five-second test:** show the dues screen to 3 people for five seconds. Each must say the amount, the date and what to press. At least one reads the Hindi version.
- **Real phone:** it opens quickly, looks right, and the button is easy to press.
- **Hindi:** a Hindi reader checks all the copy.
- **Sign-off:** you are happy with the look and the flows.

### Prompt 5: Apply your test results

```text
Read AGENTS.md, docs/progress.md and docs/gate-0.md.

GATE 0 RESULTS
- Five-second test: <what each of the 3 people said>
- Real phone: <what you noticed>
- Hindi corrections: <list them, or "none">
- Other changes: <list them, or "none">
- Sign-off: <yes>

GOAL
Apply these changes and nothing else.

DONE WHEN
- Each change is made, and npm run check passes.
- The affected e2e specs pass.
- docs/prototype-notes.md records what the test changed and why. These notes become the TDD's UI section, so keep the testers' real findings.
- docs/gate-0.md shows the human checks as passed.

FINISH
Push to GitHub. Report in under 10 lines. Then stop. Do not start Phase 1.
```

---

## Stage 2: The real system

### Prompt 6: Database, sign-in and consent

**You first:** create a Neon project with a development branch, or run Postgres locally. Put the connection string in `.env.local` as `DATABASE_URL`. For Neon, use the pooled string.

```text
Read AGENTS.md and docs/progress.md.

GOAL
Phase 1: T1.1 to T1.5. Build the database, seed data, real sign-in and consent. Fixtures still power every other screen.

READ
From docs/PLAN.md, by heading only: B7, B8.1, B8.2, B8.3, B8.4, B8.6, B9, B10, B11, B12, P1 in B5, then T1.1 to T1.5.

RULES
- DATABASE_URL is already in .env.local. Generate the other local values as B12 says, and write them only to .env.local. Never print or commit them.
- Tests use PGlite, never the dev database.
- Never change an expected value in B8 to make a test pass. Fix the code. If a value looks wrong, stop and ask me.
- Money is integer paise. Balances are calculated, never stored.
- Call a guard at the top of each page and action. Do not rely on middleware.
- Pages and components should not change when data becomes real. Change lib/data and lib/actions.
- Run the full 2,600-student seed once, in T1.3. Use --small after that.

DONE WHEN
- Every acceptance check in T1.1 to T1.5 passes.
- On a local production build, each role signs in and lands on its home page: /dues, /staff/dashboard, /counsellor/tasks.
- A new guardian cannot reach /dues until consent is saved.
- You have reviewed the auth diff for missing role checks.
- npm run test:e2e passes.

FINISH
Push to GitHub. Report in under 10 lines: what is done, what is open, and anything you need from me. Then stop.
```

### Prompt 7: Payments and receipts

```text
Read AGENTS.md and docs/progress.md.

GOAL
Phase 2: T2.1 to T2.6. A parent signs in, pays on the mock gateway and gets a GST receipt, all on real data.

READ
From docs/PLAN.md, by heading only: B8.3, B8.4, B8.8, B9, B11, then P2, P3 and S2 in B5, then the Phase 2 tasks.

RULES
- Use APP_URL=http://localhost:3000 for the mock gateway's webhook call.
- Every money path runs in a database transaction, with no floats.
- The webhook checks its HMAC and is idempotent. A replayed event changes nothing.
- A wrong amount marks nothing paid. It creates a queue item.
- Never change an expected value in B8 to make a test pass.
- The dues page itself should not change, only its data function.

DONE WHEN
- Every acceptance check in T2.1 to T2.6 passes, including each row of B8.8.
- Ishita's parent sees ₹15,000, "Was due 10 Oct" and "23 days overdue".
- A ₹15,000 receipt shows taxable ₹12,711.86, CGST ₹1,144.07, SGST ₹1,144.07 and total ₹15,000.
- You have reviewed all money code for floats and missing transactions.
- npm run test:e2e passes on a local production build.

FINISH
Push to GitHub. Report in under 10 lines: what is done, what is open, and anything you need from me. Then stop.
```

### Prompt 8: Reminders and demo controls

```text
Read AGENTS.md and docs/progress.md.

GOAL
Phase 3: T3.1 to T3.4. Reminders run by date and stop as soon as a parent pays. Staff can see all of it, and a reviewer can replay it.

READ
From docs/PLAN.md, by heading only: B8.7, B9, the demo parts of B10, S4 in B5, then the Phase 3 tasks.

RULES
- Write vercel.json as T3.2 says, but do not deploy. Test the cron routes locally by sending the Authorization header yourself.
- Reminders are worked out at send time, never queued. An outage sends one message, not a backlog.
- Demo actions refuse unless DEMO_MODE=true.
- Never change an expected value in B8 to make a test pass.

DONE WHEN
- Every row of the B8.7 table passes, and tests/reminders.test.ts passes.
- Calling a cron route without the secret gets 401.
- The stop-on-payment proof in T3.4 passes as an e2e test.
- Concurrent resolution of a queue item returns an error rather than paying twice.
- You have done the Phase 3 security self-review, recorded findings in docs/decisions.md and fixed them.

FINISH
Push to GitHub. Report in under 10 lines: what is done, what is open, and anything you need from me. Then stop.
```

### Prompt 9: Refunds, dashboard and exports

```text
Read AGENTS.md and docs/progress.md.

GOAL
Phase 4: T4.1 to T4.4. Build the refund calculator, the dues dashboard and the CSV exports on real data.

READ
From docs/PLAN.md, by heading only: B8.5, B8.6, B9, the refund policy in B6, then S1 and S3 in B5, then the Phase 4 tasks.

RULES
- The refund amount is never editable. e2e/controls.spec.ts must assert this.
- Approval freezes the figures and stops reminders. An open queue item blocks approval.
- The dashboard stays at four tiles, a table and one bar per row. No other charts. Totals must reconcile.
- Run the full 2,600-student seed for the dashboard speed check, then go back to --small.
- Never change an expected value in B8 to make a test pass.

DONE WHEN
- All 11 rows of the B8.5 table pass.
- Aarav with a withdrawal date of 2 Nov shows ₹18,986.31.
- Paying ₹15,000 lowers the dashboard by exactly ₹15,000.
- The dashboard responds in under 2 s with 2,600 students.
- The MLV-only user sees only MLV.
- Both CSVs are valid, match the dashboard, and neutralise formula characters.
- npm run test:e2e passes.

FINISH
Push to GitHub. Report in under 10 lines: what is done, what is open, and anything you need from me. Then stop.
```

### Prompt 10: Dropout-risk score and call brief

**Optional first:** add `ANTHROPIC_API_KEY` to `.env.local`. Without it, the app uses template text and still works.

```text
Read AGENTS.md and docs/progress.md.

GOAL
Phase 5: T5.1 to T5.6. Build the transparent risk score, the counsellor call brief and the counsellor screen on real data. Then delete the fixtures.

READ
From docs/PLAN.md, by heading only: B8.9, B9, B11, S5 in B5, the risk rows of B13, then the Phase 5 tasks.

RULES
- The score decides. Claude only writes the call brief, using numbers only. Its request must contain no name, phone number or student code.
- Any model failure or refusal falls back to the template.
- Tests use a fake call. Make one real call by hand in T5.3, and only if a key is set.
- lib/domain/risk.ts and lib/services/risk.ts must never import messaging, reminder, payment or ledger write code.
- Parents and the accounts role never see risk data.
- Never change an expected value in B8 to make a test pass.

DONE WHEN
- Every row of both B8.9 tables passes, and tests/risk-isolation.test.ts and tests/risk-brief.test.ts pass.
- Riya has a High task, Arjun is Watch with no task, Neha is under "Not enough data", and Ishita has no flag.
- A false flag needs a note, closes the task, changes the accuracy figure, and is not re-created by the next run.
- lib/fixtures/ and the proto cookie code are gone, and a search finds no references.
- Evaluation results are in docs/TDD.md, marked as synthetic.
- npm run test:e2e passes.

FINISH
Push to GitHub. Report in under 10 lines: what is done, what is open, and anything you need from me. Then stop.
```

### Prompt 11: Optional extras

**Skip this if usage is running low.** Keep about a quarter of your allowance for Prompts 12 and 13.

```text
Read AGENTS.md and docs/progress.md.

GOAL
From Phase 6 in docs/PLAN.md, build only these, in this order: <T6.1, T6.2, T6.3, T6.4, or fewer>.

READ
Only the Phase 6 table, then whichever sections each task names.

RULES
- If a task can't be finished, remove it from the interface, including its link or button, so nothing is left dead.
- Stop adding as soon as usage runs low.

DONE WHEN
- Each chosen task meets its Accept column, in every state and language it uses.
- npm run test:e2e passes.

FINISH
Push to GitHub. Report in under 10 lines. Then stop.
```

### Prompt 12: Final tests and documents

```text
Read AGENTS.md and docs/progress.md.

GOAL
Phase 7: T7.1 to T7.4. Stop adding features and fix only what is broken. Finish the tests, clean up and write the documents. Vercel comes later, so use the placeholder <LIVE_URL> wherever the live link goes.

READ
From docs/PLAN.md, by heading only: B13, D1, D2, D3, D4, D5, then the Phase 7 tasks.

RULES
- Do not deploy.
- Label every assumption in the TDD, using the D3 register plus anything added to docs/decisions.md.
- dist/ holds demo passwords and is never committed.
- Do not build the ZIP yet.
- Do not invent test results. Mark anything you could not run.

DONE WHEN
- Everything in B13 passes on a production build with the seeded dev database, including e2e/golden.spec.ts.
- /proto returns 404, and the preview helper and NEXT_PUBLIC_PROTO are gone.
- The secret search finds nothing, .env.local was never committed, and nothing from docs/inbox/ was committed.
- Every action starts with a role check.
- The "Run locally" steps in D2 work on a fresh clone.
- docs/TDD.md, dist/TDD.pdf and dist/deployment.md exist.

FINISH
Push to GitHub. Tell me to read the TDD and correct anything I cannot defend. Then stop at Gate 7.
```

---

## Stage 3: Later, after your Vercel part

**You first:** follow T8.1 in `PLAN.md`. It covers importing the repo, setting environment variables, seeding the production database and testing the live link.

The brief only asks for a live link "if you deployed it", so you can still hand in without one. Use `none` in the prompt below.

### Prompt 13: Live link and ZIP

```text
Read AGENTS.md and docs/progress.md.

LIVE URL: <the Vercel URL, or "none">
DEMO PASSWORD: <the production demo password>

GOAL
T8.2 in docs/PLAN.md: finish the documents and build the ZIP.

READ
Only T8.2, Gate 8 and D2 in docs/PLAN.md.

RULES
- Put the demo password only in dist/deployment.md, which is never committed.
- If the live URL is "none", remove the <LIVE_URL> line from the TDD, and describe the deployment in deployment.md as planned, not as done.

DONE WHEN
- No <LIVE_URL> placeholder is left in any document.
- The first lines of the TDD hold the GitHub URL and, if there is one, the live link.
- dist/submission.zip holds exactly TDD.pdf and deployment.md, and is at most 25 MB.

FINISH
Push to GitHub. Give me the Gate 8 checklist. Then stop.
```

---

## Prompts for when something goes off track

### A session ended midway

```text
Read AGENTS.md and docs/progress.md. Run git status and git log -5 --oneline. Finish the task in progress, then continue with the remaining tasks from this goal: <paste the GOAL line of the current prompt>. Read only the sections those tasks name. Report in under 10 lines, then stop.
```

### You found a bug

```text
Read AGENTS.md. Bug: <what you did, what you expected, what happened>. Find the root cause and make the smallest fix. Add a test if it is logic. Run only the check that proves the fix, commit, add a line to docs/progress.md, then stop. Change nothing else.
```

### Usage is running low

```text
Usage is low. Finish the current task, commit, update docs/progress.md, push and stop. Then list what remains, and what the cut order in section A5 of docs/PLAN.md would remove.
```
