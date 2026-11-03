# Coaching Fee Tracking and Parent Portal: Build Spec for Codex

**Client:** Company A, Jaipur. 4 centres, 2,600 students.
**Who builds it:** OpenAI Codex, working from this file alone, with a person (the "human") for the steps Codex cannot do.
**UI components:** BoardUI first, https://www.boardui.com/components/button-group. Then React Bits (https://reactbits.dev), 21st.dev (https://21st.dev) and MotionSites (https://motionsites.ai), only in the places set out in B3a.
**Usage:** Codex usage, free tiers and paid calls are limited. A5 sets the rules, and they apply to every task.
**Stack:** a Next.js frontend with BoardUI, and a Django and PostgreSQL backend (B1).
**Prompt:** `docs/PROMPTS.md` holds the one prompt that runs the whole build.
Plan version: 3 (Django, one-prompt run).
**Deployment comes last:** Phases 0 to 7 run and are checked on the human's own computer. Vercel is Phase 8, when the human chooses.
**Hand-in:** one ZIP holding a Technical Design Document (TDD) and `deployment.md`.

> **The first step is a prototype.** No database, API or sign-in work starts until a clickable prototype of all 8 screens has passed Codex's Gate 0 checks and is tagged `v0-prototype`. The human's own test can happen at any time after that, and its results are applied when the human gives them.

The client brief is copied in full in Appendix A. If this spec and the brief disagree, the brief wins: record the conflict in `docs/decisions.md`.

## Contents

- **Part A. Start here:** human setup, Codex prompts, working rules, usage rules
- **Part B. What to build:** stack, design system, screens, copy, data model, rules, endpoints, seed data, security
- **Part C. Build tasks:** Phase 0 (prototype) to Phase 8 (deployment), with acceptance checks
- **Part D. Hand-in:** TDD, `deployment.md`, assumptions, cuts, interview prep
- **Appendix A:** the brief, unchanged

---

# Part A. Start here

## A1. What the human must do

Codex cannot create accounts, enter credentials or run usability tests. These steps are the human's.

| When | Step |
|---|---|
| Before Codex starts | **H1.** Create an empty public GitHub repo named `coaching-fees` and clone it. Copy this file to `docs/PLAN.md` inside it |
| Before Codex starts | **H2.** Install the BoardUI skill and MCP server (commands below), then restart Codex |
| Before Codex starts | **H3.** Allow network access for Codex (below). It needs npm, the BoardUI CLI and later the database |
| During Phase 0 (optional) | **H9.** Set up 21st.dev (command below). Copy up to 3 components for the gaps listed in B3a into `docs/inbox/21st/`. The free plan allows 2 copies a day |
| During Phase 0 (optional) | **H10.** Read MotionSites' terms of use. If they allow this use, choose one hero prompt and save it as `docs/inbox/motionsites-hero.txt` |
| Any time after Gate 0 | **H5.** Run the five-second test with 3 people, check on a real phone, have a Hindi reader check the copy, then sign off. Gate 0 says how to open the app on a phone without deploying |
| Before Phase 1 | **H6.** Install Python 3.14 and PostgreSQL 17, and create a database named `coaching_fees`. Put its connection string in `.env.local` as `DATABASE_URL`, such as `postgres://postgres:<password>@localhost:5432/coaching_fees`. Allow network access for Codex (H3), because Django's tests connect to it |
| Before Phase 5 (optional) | **H7.** Add `ANTHROPIC_API_KEY` to `.env.local`. The app works without it, using template text |
| After Phase 7, when you choose | **H4.** The Vercel part. The steps are in T8.1 |
| Phase 8 | **H8.** Read the TDD and correct anything you cannot defend in the interview. Test the live app in a private window. Upload the ZIP |

**H2 commands.** Run these from the repo root:

```bash
npx boardui@latest skill --client codex
```

```bash
codex mcp add boardui -- npx -y boardui@latest mcp
```

The skill installs to `~/.agents/skills/`. BoardUI's page says Codex takes one command but does not print it, so the MCP line follows Codex's documented form. If it fails, use the Codex tab on https://www.boardui.com/mcp. Run `/skills` in Codex to confirm the skill loaded.

**H3 setting.** The default `workspace-write` sandbox has networking off. Add this to `~/.codex/config.toml`:

```toml
sandbox_mode = "workspace-write"
approval_policy = "on-request"

[sandbox_workspace_write]
network_access = true
```

To allow it for one session only:

```bash
codex --config sandbox_workspace_write.network_access=true
```

**Expect git approvals.** This sandbox keeps `.git` read-only, so Codex may ask before `git commit` and `git push`. Approve these. If it offers to stop asking for that command, accept, because the plan commits at least once per task.

**On Windows,** the file is `%USERPROFILE%\.codex\config.toml`, and Codex runs natively in PowerShell with its Windows sandbox. That sandbox can stop child processes when a command ends, so a server left running in the background may not reach the next command. The test tools in this plan therefore start their own server.

**H9 command.** This prints the 21st.dev MCP settings for Codex. Add `--write` to save them, then paste in an API key created at https://21st.dev/mcp:

```bash
npx @21st-dev/cli@latest init --client codex
```

H9 and H10 never block Codex. If `docs/inbox/` is empty, Codex builds those pieces from BoardUI and CSS.

## A2. Prompts to give Codex

`docs/PROMPTS.md` holds the one prompt for the whole build. It runs through to Gate 7 without stopping between phases. A new session resumes from it and `docs/progress.md`.

## A3. Working rules for Codex

1. Never read this whole file. Read only the sections the current phase of the prompt names, plus the current task and the sections it names (A5).
2. Do tasks in order. Commit at least once per task, with a message starting with the task ID, such as `T2.3: allocate payments oldest first`.
3. Run `npm run check` before every commit. Never commit failing code. Never squash or force-push, because the reviewers read the history.
4. After each task, add one line to `docs/progress.md`: task ID, what was done, anything left open.
5. **When the spec is silent,** choose the simplest thing that meets the brief, record it in `docs/decisions.md`, and continue. If it is a client fact you assumed, also add it to the assumption register in `docs/TDD.md`.
6. **Stop and ask the human only** when `docs/PROMPTS.md` says to: at Gate 7 or Gate 8, when H6 is not done, after a third failed attempt at one problem, when usage is low, or when a test's expected value in B8 looks wrong.
7. **Never change an expected value in B8 to make a test pass.** Those numbers were calculated independently. Fix the code.
8. Never invent client facts without labelling them. Never add real personal data.
9. Keep code small: no abstraction with one implementation, no config for a value that never changes, no scaffolding for later. When you take a shortcut with a known ceiling, mark it with a `LIMIT:` comment naming the ceiling and the upgrade path. These feed the TDD.
10. Never remove validation, access control, error handling or accessibility to save code.
11. Add a dependency only if it is listed in B1. If you need another, explain why in `docs/decisions.md`.
12. Use only free BoardUI items. Check with `npx boardui@latest list` when unsure. **Do not substitute a lookalike for a BoardUI component that exists.**
13. Use React Bits, 21st.dev and MotionSites only as B3a allows. Record everything brought in from them in `docs/third-party.md`.
14. Follow A5 at all times. Do not spend usage on anything this spec did not ask for.
15. Do not deploy or touch Vercel in Phases 0 to 7. Everything runs and is checked on this computer. "Production build" means `npm run build` then `npm run start`, locally, with Django running.
16. The commands in this file are written for a Unix shell. If you are in PowerShell, use the equivalents.
17. If the sandbox blocks git, ask the human for approval. Do not work around it.

## A4. `AGENTS.md` content

Codex reads `AGENTS.md` automatically and has a size limit per file, so it stays short and points here. `npx boardui@latest init` writes its own fenced design-rules section into this file. Keep that section and add this above it:

```markdown
# Coaching Fees

Full spec: docs/PLAN.md. Progress: docs/progress.md. Decisions: docs/decisions.md.

Current job: docs/PROMPTS.md. In a new session or after a context summary, re-read it and docs/progress.md, then continue from the next unfinished task. Do not stop between tasks or phases.

## Rules that always apply
- Money is integer paise. Never use floats for money. Display only through lib/format.ts.
- Balances are always calculated from allocations, never stored.
- Dates are datetime.date in Django and 'YYYY-MM-DD' strings in JSON. "Today" comes only from backend/fees/clock.py.
- In Python, never use round() for money or scores. B8 says what to use instead.
- backend/fees/domain/* is pure: no database, no clock, no network.
- backend/fees/domain/risk.py and backend/fees/services/risk.py must never import messaging, reminder, payment or ledger write code.
- Parent routes never return risk data. The accounts role never sees risk data.
- The browser talks only to Next.js. Pages call lib/data and lib/actions, which call Django through lib/backend.ts.
- Only Django decides access. Every Django view uses @api(role=...), except the webhook and cron views, which have their own secrets.
- All parent-facing text goes through lib/i18n, in Hindi and English.
- Every screen has loading, empty and error states. No dead controls. No hover-only behaviour.
- Free BoardUI components first. Use the boardui skill and MCP. Do not build lookalikes.
- React Bits, 21st.dev and MotionSites only as docs/PLAN.md section B3a allows. Log each in docs/third-party.md.
- Motion must show that something changed or confirm that something happened. Parent routes use CSS only. `motion` is the only animation library. Never run `npx shadcn init`.
- Respect prefers-reduced-motion everywhere. Never animate Hindi letter by letter.
- Usage is limited (docs/PLAN.md section A5). Read only what the current task needs. Limit command output. Run the smallest check that proves the change. Do nothing the spec did not ask for. After 3 failed attempts at the same problem, stop and ask.
- Use BoardUI semantic tokens, never raw colours, outside the accent ramp in styles/theme.css.
- Run `npm run check` before each commit. Commit messages start with the task ID. Never squash or force-push.
- Never commit secrets. .env.example holds names only.
- Development is local. Do not deploy or touch Vercel until the human starts Phase 8.
- Spec commands are for a Unix shell. In PowerShell, use the equivalents. If the sandbox blocks git, ask for approval.
```

## A5. Use usage carefully

Codex usage, free tiers and paid calls are all limited. Running out before Phase 7 would hurt more than any missing feature, because the hand-in needs a working app and a TDD. **Spend on the core build, and never on work this spec did not ask for.**

### Reading

- **Never read this whole file.** It is over 100 KB, and a new session would lose it anyway. Each phase of the prompt names the sections to read. Find a heading with `grep -n "^### T4.1" docs/PLAN.md` and read that range with `sed -n`. In PowerShell, use `Select-String -Path docs/PLAN.md -Pattern '^### T4.1'`, then `Get-Content docs/PLAN.md | Select-Object -Skip <start> -First <count>`.
- Search before opening a file, and read line ranges rather than whole files.
- Never read `node_modules`, `.next`, `.venv`, `package-lock.json`, generated files in `backend/fees/migrations/`, or `docs/screens/` as text.
- Read a BoardUI component's source only when you need its props, and only that component.
- Limit command output, for example `| tail -40`. Never print seed rows or full build logs.

### Writing

- **Copy instead of retyping.** Extract the B6 dictionaries and policy text from this file with `sed` by line number. Let the BoardUI CLI write BoardUI source. Generate repeated rows with loops.
- Edit files in place. Do not rewrite a whole file for a small change, and do not print a file back after writing it.
- **Nothing outside the spec:** no refactors, renames, reformatting, extra documents, extra features, or polish beyond the acceptance checks.

### Checks: run the smallest one that proves the change

| When | Run |
|---|---|
| While working on logic | The one test file: `npm run py -- backend/manage.py test fees.tests.test_refund --keepdb` |
| Before each commit | `npm run check` |
| After changing one screen | `npm run screens -- --only=dues`, and view only the 360 px image |
| End of each phase | `npm run test:e2e` |
| T0.15 and T7.3 only | Full `npm run screens`, viewing every image |
| T1.3, T4.3 and T8.1 only | Full 2,600-student seed. Otherwise use `npm run db:seed -- --small` (200 students) |

### When stuck

- After 2 failed attempts at the same problem, stop guessing and find the root cause from the actual error.
- After a third failed attempt, record it in `docs/decisions.md`, tell the human and stop. Never retry in a loop.

### Sessions

- One prompt runs the whole build. `docs/progress.md` must hold everything needed to resume, so a new session needs no old history.
- If a session ends or its context is summarised, re-read `docs/PROMPTS.md` and `docs/progress.md`, then continue from the next unfinished task.
- The human sets High reasoning in Codex for the run, because B8 rules, the webhook, the reminder service, refunds and access checks need it.
- No parallel agents or cloud tasks unless the human asks.
- Keep only the BoardUI MCP server on. Turn on 21st.dev's only for T0.13, then turn it off.

### Outside allowances

| Resource | Limit | Rule |
|---|---|---|
| Neon free tier | Storage and compute are limited | Used only in Phase 8. Development and tests use local Postgres |
| Vercel free tier | Builds are limited, and cron runs at most daily | Not used until Phase 8 |
| GitHub Actions | One workflow | Runs on push to `main` only. No matrix builds. Push at the end of each phase, not after every commit |
| Anthropic API | Paid per call | At most one call per task, saved after it succeeds. Tests use a fake `call`. One real call by hand in T5.3 |
| 21st.dev | 2 free copies a day. `get_component` and `generate` are paid | Only the 3 gaps in B3a. Free `search` only. **Do not buy a plan** unless the human decides to |
| MotionSites | Paid plan, price not public | One prompt at most. The human decides whether it is worth paying for |
| React Bits | Free | Only the 2 components in B3a |

### If usage runs low

The human checks with Codex's `/status` command. Keep about a quarter of the allowance for Phases 7 and 8, and do not start Phase 6 below that.

When usage is low, finish the current task, commit, update `docs/progress.md` and stop. Then cut in this order:

1. Phase 6, from the last task upwards
2. Outside extras from T0.13: the `/demo` hero first, then 21st.dev pieces
3. Visual polish beyond the acceptance checks

**Never cut:** the core flows, money and access tests, deployment, the TDD or `deployment.md`.

**For the human:** put all feedback in one message rather than many small ones. Do not ask Codex to redo work that passes its checks.

---

# Part B. What to build

## B0. The product in brief

**Must work end to end:** fee ledger, parent portal with dues and pay link, reminders that stop on payment, pro-rata refund calculator, dues dashboard by centre and batch, and a dropout-risk flag that only creates a counsellor call task. Payments, messages and outside systems are mocked. Seed from the sample data.

**Roles:** parent and accounts executive from the brief, plus counsellor, because the brief has counsellors marking false flags.

**The two tests the client will apply first:**

- A parent understands their dues in five seconds: amount, due date, pay button, nothing more.
- A refund comes from the written policy, never from someone's calculator.

**"Today" is 2 Nov 2026.** The sample data only makes sense on that date: 10 Oct + 23 days overdue and 15 Nov − 13 days both land there. In demo mode `today()` returns a stored date that starts at `2026-11-02`, so the brief's numbers stay right whenever a reviewer opens the app.

## B1. Stack and dependencies

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 16 App Router, React 19, TypeScript | BoardUI's documented path. Server rendering suits low-end phones |
| Styling and UI | Tailwind CSS v4, BoardUI | BoardUI requires React 19 and Tailwind v4 |
| Backend | Django 5.2 LTS on Python 3.14, with plain views that return JSON | Owns all rules, access checks, money transactions, reminders and risk scoring |
| Database | PostgreSQL 17: local in development, Neon in production | Money needs transactions, constraints and row locks |
| Database access | Django ORM and migrations, with `psycopg` | `transaction.atomic` and `select_for_update` cover the money paths |
| Validation | Django forms on every Django input | Next.js forwards input and decides nothing |
| Auth | Django sessions, Django's password hashers, and our own phone OTP | No extra library |
| Frontend tests | Vitest, Playwright, `@axe-core/playwright` | Screens, flows, layout and accessibility |
| Backend tests | Django's test runner on local Postgres | Row locks and constraints need a real Postgres |
| Animation | CSS first, then `motion` on staff routes and `/demo` only | The React Bits components chosen in B3a need it. One library keeps the weight down |
| AI text | `anthropic` Python SDK | Counsellor call brief only. Added in Phase 5 |
| Hosting | Two Vercel projects from one repo, set up last in Phase 8 | Vercel runs Django as one function. Its Services feature could hold both apps in one project, but it is in beta |

**Allowed Python packages,** pinned in `backend/requirements.txt`: `Django>=5.2,<5.3`, `psycopg[binary]`, `dj-database-url`, `python-dotenv`, `tzdata`, and from Phase 5 `anthropic`. Dev only, in `backend/requirements-dev.txt`: `ruff`. `tzdata` is required, because Python on Windows ships no time zone data. `backend/.python-version` holds `3.14`, so Vercel matches development.

**Allowed JavaScript packages beyond the scaffold and what BoardUI installs:** `motion`, `zod`. Dev only: `vitest`, `@playwright/test`, `@axe-core/playwright`, `tsx`, `marked`, `bestzip`.

### Scripts in `package.json`

`scripts/py.mjs` runs Python from `.venv` on Windows or Linux, and falls back to `python` where `.venv` does not exist, such as CI. It keeps every script below the same on both.

| Script | Runs |
|---|---|
| `dev`, `build`, `start` | Next.js |
| `dev:api` | Django on port 8000 |
| `py` | `node scripts/py.mjs`, so `npm run py -- backend/manage.py <command>` works everywhere |
| `lint`, `typecheck` | ESLint, `tsc --noEmit` |
| `test` | Vitest |
| `check:py` | `ruff check backend`, `manage.py check` and `manage.py test --keepdb` |
| `check` | lint, typecheck, test and, from T1.1, `check:py` |
| `test:e2e` | Playwright tests |
| `screens` | Screenshot script (see T0.2). `--only=<route>` limits it to one screen |
| `db:generate`, `db:migrate` | `manage.py makemigrations`, `manage.py migrate` |
| `db:seed` | `manage.py seed`: full seed from empty. `--small` seeds 200 fleet students plus all named students |
| `db:reset` | Flush everything, migrate, seed |

### Repository layout

```text
app/
  layout.tsx
  page.tsx                          redirect by session role
  (parent)/login, consent, dues, receipts, receipts/[id]
  (public)/pay/[token], pay/[token]/result, mock-gateway/[token], refund-policy, demo
  (staff)/staff/login, staff/dashboard, staff/students/[code],
          staff/students/[code]/refund, staff/automation,
          staff/export/dues.csv/route.ts, staff/export/receipts.csv/route.ts
  (counsellor)/counsellor/tasks
  proto/page.tsx                    Phase 0 index, removed in Phase 7
components/base, components/application    BoardUI source, edit only if necessary
components/app/                     our own: Money, StatusChip, AgeingBar, EmptyState, ErrorState, PageShell
components/vendor/reactbits, vendor/21st    adapted outside components, never imported by parent routes
lib/
  config.ts  types.ts  format.ts  backend.ts  reminder-text.ts
  i18n/en.ts  i18n/hi.ts  i18n/index.ts
  data/      dues, receipts, dashboard, ledger, refund, automation, counsellor (fetch view models from Django)
  actions/   auth, payments, refund, automation, counsellor, demo             (server actions that call Django)
  fixtures/  clock.ts                Phase 0 only, gone by the end of Phase 5
scripts/ screens.ts  build-tdd.ts  py.mjs
tests/   *.test.ts                  frontend only
e2e/     *.spec.ts
backend/
  manage.py  requirements.txt  requirements-dev.txt  .python-version  vercel.json
  config/    settings.py  urls.py  wsgi.py
  fees/
    models.py  urls.py  clock.py  auth.py
    domain/    dates, money, ledger, refund, reminders, matching, risk, phone   (pure)
    services/  payments, reminders, refunds, risk                                (transactions)
    views/     auth, dues, receipts, dashboard, ledger, refund, automation,
               counsellor, demo, exports, webhooks, cron
    management/commands/seed.py
    migrations/
    tests/     test_*.py
docs/    PLAN.md  PROMPTS.md  TDD.md  progress.md  decisions.md  prototype-notes.md  third-party.md  screens/
docs/inbox/                         the human's copied components and prompts, gitignored
```

### How the two apps talk

- **The browser talks only to Next.js.** Pages call `lib/data/*` and `lib/actions/*`, which call Django from the server through `lib/backend.ts`.
- **`lib/backend.ts` is one small file.** It adds `X-Internal-Key: $INTERNAL_API_SECRET`, forwards the browser's `sid` cookie, sets `cache: "no-store"`, and times out after 10 seconds. A 401 redirects to the right sign-in page. A 403 with code `consent_required` redirects to `/consent`. Anything else unexpected throws, so `error.tsx` shows.
- **Django returns each B5 view model exactly:** camelCase keys, paise as integers and dates as `YYYY-MM-DD`. Formatting and language stay in Next.js, so all copy lives in `lib/i18n`.
- **Only Django decides access.** `lib/data` and `lib/actions` hold no rules. They forward and display.
- **Two routes reach Django directly:** the payment webhook, as a gateway would call it, and the cron jobs. Each has its own secret (B9).

**The key seam:** pages call only `lib/data/*` and `lib/actions/*`. In Phase 0 these read fixtures and a cookie. In later phases, the same function signatures call Django. **Pages and components should not change when the data becomes real.**

## B2. BoardUI

**Setup facts:**

- `npx boardui@latest init --yes` writes `styles/theme.css`, `styles/typography.css`, `styles/globals.css` and `utils/cx.ts`, and adds a design-rules section to `AGENTS.md`.
- `npx boardui@latest add <names> --yes` copies source to `components/base/…` and `components/application/…`, imported through `@/`.
- Read each component's source or use the MCP tools `get_component` and `get_usage_examples` before using it. Do not guess props.

**Root layout**, per BoardUI's Next.js guide, plus Hindi:

```tsx
// app/layout.tsx
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import "@/styles/globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], axes: ["opsz"] });
const devanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "500", "600"],
  preload: false,
});

// lang comes from the `lang` cookie: "hi" or "en"
<html lang={lang} className={`${inter.variable} ${devanagari.variable} h-full antialiased`}>
```

**Inter has no Devanagari characters.** In `styles/theme.css`, find where the font stack reads `--font-inter` and add `var(--font-devanagari)` straight after it. With `preload: false`, browsers download the Hindi font only when Hindi text appears. Add `html[lang="hi"] { line-height: 1.6; }` to stop vowel marks clipping.

**Free or Pro**, read from the site on 2 Nov 2026. Pro is off limits because the repo must be public and the Pro terms do not say the source may be published. Free components are MIT.

| Free, use these | Pro, never use |
|---|---|
| All Base components | Bar List and every other chart except the two listed left |
| Auth Card, Data Table, Data Grid, Sidebar, Stat Cards, Notification Center | Task List, Questionnaire, Calendar |
| Orders Chart, Revenue Chart | Finance Dashboard and other templates |

**Button Group or Segmented Control?** Button Group (`ButtonGroup`, `ButtonGroupItem` with `selected`, `leadingIcon`, `iconOnly`, `size="small"`) holds related actions, such as "Record payment / Copy pay link / Start refund". Segmented Control (`SegmentedControl`, `SegmentedControlItem`, `selectedKeys`, `onSelectionChange`) chooses a view, such as "By centre / By batch" or "हिंदी / English". Do not swap them.

**Component use by screen:**

| Screen | Components |
|---|---|
| P1 Sign-in | Auth Card, Input, Input OTP, Segmented Control, Checkbox, Button, Link Button |
| P2 Dues | Button, Chip, Segmented Control, Accordion, Link Button, Skeleton |
| P3 Payment and receipts | Notification, Spinner, Table, Button, Link Button, Skeleton |
| Mock gateway | Button Group, Notification |
| S1 Dashboard | Sidebar, Stat Cards, Data Table, Segmented Control, Select, Search Field, Button Group, Tooltip, Drawer (phone nav) |
| S2 Ledger | Breadcrumb, Table, Chip, Button Group, Modal, Number Field, Select, Date Picker, Textarea, Toast, Divider |
| S3 Refund | Date Picker, Select, Table, Notification, Modal, Button, Divider |
| S4 Automation | Tabs, Segmented Control, Data Table, Drawer, Combobox, Textarea, Date Picker, Chip, Toast |
| S5 Counsellor | Tabs, Segmented Control, Data Table, Chip, Drawer, Radio, Textarea, Stat Cards |

**Known gaps to handle:**

- **Data Table's phone behaviour is not documented.** Below 768 px, render rows as stacked cards, and collapse the Sidebar into a Drawer.
- **React Aria adds JavaScript weight.** The Pay control is a plain `<a>`, so it works before hydration. The budget in B3 decides whether more is needed.

## B3. Design system

**Direction:** calm, quiet, precise. Lots of white space, few lines, one colour that matters. Nothing on screen without a purpose.

**Colour.** Neutrals from BoardUI semantic tokens, plus one accent. Override BoardUI's default blue accent ramp in `styles/theme.css`, so the product does not look default:

| Token | Value | Token | Value |
|---|---|---|---|
| `--color-accent-50` | `#EEF7F8` | `--color-accent-600` | `#1F6A79` |
| `--color-accent-100` | `#D5ECEF` | `--color-accent-700` | `#185663` |
| `--color-accent-200` | `#AEDAE0` | `--color-accent-800` | `#134652` |
| `--color-accent-300` | `#7CC1CB` | `--color-accent-900` | `#0F3A44` |
| `--color-accent-400` | `#479FAD` | `--color-accent-950` | `#08252C` |
| `--color-accent-500` | `#2B8292` | | |

Read the Button source to see which tokens colour the primary variant, then set them so primary actions use `accent-700` with white text.

**Status colour** carries meaning only, always with a text label:

| Status | Token pair |
|---|---|
| Paid | `--color-status-lime-background`, `-text` |
| Part paid, Watch | `--color-status-yellow-background`, `-text` |
| Overdue, High | `--color-status-rose-background`, `-text` |
| Upcoming, not enough data | Neutral |

Build one `StatusChip` in `components/app/` on top of BoardUI's Chip. Skip dark mode: it was not requested and would double the visual checking.

**Type.** Use BoardUI's type scale from `styles/typography.css`.

| Use | Size |
|---|---|
| Parent's amount | 40 px, semibold, tabular figures, the largest thing on any screen |
| Screen title | 20–24 px |
| Body | 16 px |
| Secondary | 14 px, the minimum on parent routes |

All money uses `font-variant-numeric: tabular-nums`.

**Layout.**

- Parent: single column, `max-width: 440px`, centred, 20 px side padding. One primary action per screen. No navigation bar: one quiet row of links at the bottom.
- Staff: Sidebar 240 px plus content up to 1200 px. Tables have horizontal rules only.
- Spacing on a 4-point grid. Touch targets at least 48 px on parent routes, 44 px on staff routes.

**Formatting** (`lib/format.ts`):

```ts
export const inr = (p: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR",
    minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2,
  }).format(p / 100);
// inr(12000000) = "₹1,20,000"   inr(398631) = "₹3,986.31"

// Dates: en-IN { day, month: "short" } = "10 Oct". hi-IN { day, month: "long" } = "10 अक्टूबर".
// Add the year only if it differs from today's year. Always pass timeZone: "UTC" for 'YYYY-MM-DD' strings.
```

**Tone.** Factual, never shaming. "23 days overdue", never "URGENT".

**Performance budget, parent routes:**

- At most 200 KB compressed JavaScript on `/dues`, measured by `e2e/perf.spec.ts`
- Lighthouse mobile 90 or above, LCP under 2.5 s under mobile throttling
- No chart or animation library on parent routes
- Over budget? Convert client components to server components and use plain HTML elements styled with BoardUI's classes, keeping the look

## B3a. Motion and outside component sources

**Order of preference:** BoardUI, then plain CSS, then React Bits, then 21st.dev. MotionSites is for the `/demo` hero only.

**Why the limits:** the client wants "nothing on screen that lacks a purpose", parents have five seconds on low-end phones, and design counts as much as features. These libraries are built for expressive sites, so restraint is what makes them work here.

**The test for any motion: does it show that something changed, or confirm that something happened?** If not, remove it. Decoration is allowed only on `/demo`.

### Motion rules

- Parent routes use CSS only: no `motion`, no vendor components, nothing animated on load.
- `motion` is the only animation library. Reject anything needing `gsap`, `three`, `ogl`, WebGL or canvas backgrounds. For example, React Bits' `AnimatedContent` uses GSAP, so it is out.
- Durations are 150–250 ms with ease-out, and count-ups last at most 600 ms. Nothing loops, except an optional `/demo` background.
- **Money is exact on first paint.** A number animates only when it changes, never on load, and always ends on the exact `inr()` value.
- **Never animate Hindi letter by letter.** Splitting by code point breaks Devanagari vowel marks and conjuncts. Whole words only.
- Respect `prefers-reduced-motion` everywhere. Add this to `styles/globals.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

### Where motion goes

| Place | Motion | Source | What it tells the user |
|---|---|---|---|
| P2 Dues | Pressed state on Pay only | CSS | The tap registered |
| P3 Result | A vector receipt prints and its badge lands, once, about 1.2 s in all. The human asked for this, so it is the one exception to the duration limit above. `failed` and `checking` use the same graphic with their own badge | Inline SVG and CSS (`PaymentGraphic`) | The payment worked |
| S1 tiles | Number counts from old to new, only when it changed since the last visit | React Bits `CountUp`, adapted | The payment really moved the total |
| S3 Refund | Lines fade in 150 ms when the date changes | CSS | The figures were recalculated |
| S4 Reminders | New rows highlighted for 1 s after a run | CSS | Which messages just went |
| S5 Counsellor | None beyond BoardUI's Drawer | BoardUI | This is a sensitive topic |
| `/demo` hero | Heading blurs in by word, plus an optional background | React Bits `BlurText`, MotionSites | First impression for the reviewer and the founder |

### React Bits

Animated components that install as source, in JavaScript or TypeScript, with CSS or Tailwind. Use only these two, in their `TS-TW` versions. Both need only `motion`:

| Component | Use | Adaptation needed |
|---|---|---|
| `CountUp` | S1 tiles | **It groups digits in thousands and has no locale setting, so ₹1,20,000 would read 120,000.** Replace its formatting with `inr()`. Use `trigger: "load"` and a shorter `duration`. Keep the last value in `sessionStorage`, and animate only if it differs. Server-render the exact value |
| `BlurText` | `/demo` heading | `animateBy: "words"` only |

**How to bring one in. Do not run `npx shadcn init`,** because it would overwrite the theme BoardUI set up, and React Bits' CLI route needs a shadcn `components.json`. Instead:

1. Fetch `https://reactbits.dev/r/CountUp-TS-TW.json`.
2. Write the file content from its `files` list to `components/vendor/reactbits/CountUp/CountUp.tsx`.
3. Install the listed dependency.
4. Add a top comment with the source URL and the copyright notice.

**Licence: MIT + Commons Clause.** Using components inside a finished application is expressly allowed, and the copyright notice must stay. Selling or redistributing the components themselves, alone or in a bundle, is not allowed. **The licence says nothing about public repositories,** and the brief requires one. So copy only these two components, and flag the question in the TDD (A23).

### 21st.dev

A community catalog of React and Tailwind components, built to sit alongside shadcn/ui. Use it only for what BoardUI lacks:

| Gap | Where |
|---|---|
| Vertical timeline | S2 reminder timeline |
| Empty-state layout | `EmptyState` in `components/app/` |
| Role cards | `/demo` |

**Getting code.** The free plan gives 2 copies a day, and MCP `search` is free for metadata only. `get_component` and `generate` are paid, so do not call them unless the human has bought a plan. The human copies code into `docs/inbox/21st/`. If nothing is there, build the piece from BoardUI primitives.

**Adapting before use:**

- Replace `cn` with `cx`, and shadcn tokens such as `bg-background` and `text-muted-foreground` with BoardUI semantic tokens.
- Replace shadcn or Radix primitives with BoardUI equivalents. Reject a component that would add any package other than `motion`.
- Check the licence on the component's own page, and put the result in `docs/third-party.md`.

### MotionSites

A library of ready-made prompts for landing pages, hero sections and animated backgrounds, built for AI builders. It is not a component library, and it has nothing for dashboards or forms in its listed categories. **Use it for the `/demo` hero only,** never for parent or staff screens.

Pricing and usage terms were not visible, so the human reads the terms first (H10), and **the prompt text is never committed.** Only code Codex writes from it goes in the repo.

**Adapting the result, whatever the prompt says:**

- Colours come from the accent ramp in B3. No new fonts.
- Copy comes from this spec. **No invented customers, logos, testimonials or statistics.**
- No 3D or WebGL, and no external video or CDN links.
- A background video must be self-hosted, at most 3 MB, with `poster` and `preload="none"`. Replace it with a still image below 768 px and under reduced motion.
- `/demo` stays under 350 KB of compressed JavaScript, excluding video.

If there is no prompt, build the hero from `BlurText`, the accent ramp and CSS.

### `docs/third-party.md`

One row for each item brought in: source, name, URL, licence, where it is used, what was changed. The TDD draws on this.

## B4. Shared states

Every route has a `loading.tsx` (skeleton matching the real layout) and an `error.tsx` (message plus Try again), plus an empty state in the page.

**Preview helper, Phase 0 to 6.** When `NEXT_PUBLIC_PROTO=1`, pages read `?state=loading`, `empty` or `error`: `loading` renders the same skeleton, `empty` passes an empty view model, and `error` throws so `error.tsx` shows. This shows the real UI, not a mock-up of it. It is removed in T7.2.

## B5. Screens

Money values are paise in view models. Control tables are the source for `e2e/controls.spec.ts`, which clicks each control and asserts its result. **Any control not in a table should not exist, unless a decision is recorded.**

### P1. Sign-in and consent (parent)

**Routes:** `/login`, `/consent`. Default language Hindi until a `lang` cookie exists.

**Layout, both sign-in pages:** `AuthLayout`: company mark and name at the top, the form centred, a footer with the refund policy link. From the `lg` width, a brand panel fills the right side: a dot grid, a sample-data preview and one line on what the product does. The panel is server-rendered, so it adds no script, and it holds no invented customers, quotes or statistics.
**Layout, step 1:** language control top right, title, one line on what the portal does, Mobile number input (`inputmode="tel"`), Send code button, quiet "Staff sign-in" link.
**Layout, step 2:** "Enter the 6-digit code", sent-to line, Input OTP (auto-submits on the last digit), Continue, New code, Change number, the no-code help text. In demo mode, a small line reads "Demo code: 123456" with the real generated code.
**Consent:** shown when any linked student has no live consent. One screen listing the four purposes, Checkbox, Agree and continue, Not now.

**Why:** one question per step on a small phone. Language first, because everything after it must be readable. The same response is given for known and unknown numbers, so nobody can use this page to find out which numbers are parents.

| Control | Result |
|---|---|
| Language control | Text switches, `lang` cookie set |
| Send code | Invalid phone: inline error. Valid: step 2 |
| Input OTP, Continue | Wrong code: inline error, count goes up. Right code: `/consent` or `/dues` |
| New code | New code, 30-second cooldown shown. Limit reached: wait message |
| Change number | Back to step 1 |
| Staff sign-in | `/staff/login` |
| Consent checkbox, Agree and continue | Disabled until ticked. Saves consent, goes to `/dues` |
| Not now | Declined message with Log out. No data shown |

**States:** wrong code, expired code, too many tries with a wait time, consent declined, server error.

### P2. Dues (parent). The most important screen.

**Route:** `/dues?student=<id>`.

```text
┌──────────────────────────────┐
│ Ishita Sharma     हिंदी | EN │
│                              │
│ ₹15,000                      │
│ Was due 10 Oct               │
│ 23 days overdue              │
│                              │
│ [      Pay ₹15,000      ]    │
│                              │
│ ₹15,000 of ₹30,000 paid      │
│ See all instalments          │
│                              │
│ Receipts · Log out           │
└──────────────────────────────┘
```

**Rule:** at 360 × 640, in both languages, the amount, date and Pay button are visible without scrolling. Only the oldest unpaid instalment appears. Everything else is secondary.

```ts
export interface InstalmentVM {
  id: string; seq: number; dueDate: string; amount: number; paid: number; balance: number;
  status: "paid" | "overdue" | "due_today" | "upcoming";
  partPaid: boolean; daysOverdue: number; dueInDays: number;
  payUrl: string | null;
}
export interface DuesVM {
  children: { studentId: string; fullName: string }[];
  selectedStudentId: string;
  mode: "pay" | "clear" | "review" | "withdrawn";
  current: InstalmentVM | null;      // oldest unpaid
  next: { amount: number; dueDate: string } | null;
  moreUnpaid: number;
  instalments: InstalmentVM[];
  refund: { amount: number; stillPayable: number; status: "draft" | "approved" | "paid"; deadline: string } | null;
}
```

| Mode or situation | Shows |
|---|---|
| Upcoming | Amount, "Due 15 Nov", Pay |
| Due today | Amount, "Due today", Pay |
| Overdue | Amount, "Was due 10 Oct", days overdue in rose text, Pay |
| Part paid | Remaining balance only, with small "₹15,000 of ₹30,000 paid" |
| Several unpaid | Oldest first, with quiet "1 more instalment" |
| `clear` | "No dues", plus "Next: ₹30,000 on 10 Jan" if any, no button |
| `review` (open unmatched payment suggests this instalment) | "We received a payment and are checking it", no button |
| `withdrawn` | Refund amount, status, deadline, no button. If `stillPayable > 0`, states it, no button |

| Control | Result |
|---|---|
| Language control | Text switches, guardian's language saved |
| Child switch (only with 2+ children) | Dues change to that child |
| Pay | Plain link to `/mock-gateway/[token]` |
| See all instalments | Accordion opens with all instalments and statuses |
| Receipts | `/receipts` |
| Log out | Session ended, `/login` |

### P3. Payment and receipts

**Routes:** `/pay/[token]` (public, from reminders), `/mock-gateway/[token]`, `/pay/[token]/result?e=<event>`, `/receipts`, `/receipts/[id]`, `/refund-policy` (public).

- **`/pay/[token]`:** first name, amount, due date, Pay. No sign-in, shows nothing else. If paid: "already paid". If invalid: "This link is not valid". `<meta name="robots" content="noindex">`.
- **`/mock-gateway/[token]`:** a checkout. A banner "TEST MODE. No real money moves.", a summary (first name, instalment number, company, amount, due date), a choice of UPI, card or net banking, and a Pay button stating the amount. Test values are shown as text, and there are no fields to type card or bank details into, so nobody can enter real ones. Pressing Pay shows three steps for about 2 s ("Please do not press back"), then the result. A Button Group below offers the other test outcomes.
- **Result:** the answer comes first ("Payment received", with the `PaymentGraphic` from B3a), then amount, a details list (paid to, for, paid by, transaction ID, date, receipt number) and View receipt. A note says it was a test payment. For a payer without a session, View receipt goes through `/login?next=…`. Public pages show the first name only.
- **`/receipts`:** newest first: date, amount, number.
- **`/receipts/[id]`:** the GST receipt. Company name, GSTIN, receipt number, date, student name and code, batch, centre, method, taxable value, CGST 9%, SGST 9%, total. Print stylesheet hides controls.

| Control | Result |
|---|---|
| Pay (`/pay/[token]`) | `/mock-gateway/[token]` |
| Payment method | Chooses UPI, card or net banking. It is sent with the payment, and shown on the result page, receipt, ledger and roster |
| Pay ₹X | Sends signed success webhook, then result page: paid |
| Payment fails | Sends signed failed webhook, then result page: failed, with Try again |
| Wrong amount | Sends success webhook with amount less ₹1,000, then result page: "checking it". Nothing marked paid |
| Try again | Back to `/mock-gateway/[token]` |
| View receipt | `/receipts/[id]` |
| Receipt row | `/receipts/[id]` |
| Save or print | `window.print()` |
| Back to dues | `/dues` |

### S1. Dues dashboard (accounts)

**Route:** `/staff/dashboard?group=centre|batch&centre=<id>&batch=<id>`

**Layout:** a header with title, one line of purpose, export actions and Open students. Then one framed area on a soft accent wash holding four Stat Cards, the Needs attention links and the Data Table. S1b uses the same header and frame. A centre row expands into batch rows. A batch opens the roster filtered to that batch, and each student opens S2.

| Tile | Meaning |
|---|---|
| Total outstanding | Sum of all balances not yet due and overdue |
| Overdue | Sum of balances past due |
| **Over 60 days late** | `over60Pct` from B8.6, shown as "12.1%" with caption "Target 6%" |
| Refunds due | Count approved and not paid, with count past 10 days flagged |

**Table columns:** Centre or Batch, Students with dues, Outstanding, Not due, 1–30, 31–60, 61–90, 90+, and an `AgeingBar`, which is a plain CSS stacked bar with no chart library, with a visible line between 31–60 and 61–90.

**Why:** the founder asked for "one view of dues across all centres, by batch". The first thing visible is the number the founder is paying to reduce.

**Motion:** tile numbers use the adapted `CountUp` from B3a. They render exact on load, and animate only when the value changed since the last visit, so after a payment staff see the total move.

```ts
export interface DashboardVM {
  today: string; canPickCentre: boolean;
  totals: { outstanding: number; overdue: number; over60Pct: number; refundsDue: number; refundsLate: number };
  rows: AgeingRow[];
  students?: { code: string; name: string; balance: number; daysOverdue: number }[];
}
export interface AgeingRow {
  id: string; label: string; kind: "centre" | "batch"; studentsWithDues: number; outstanding: number;
  notDue: number; d1_30: number; d31_60: number; d61_90: number; d90p: number; children?: AgeingRow[];
}
```

| Control | Result |
|---|---|
| By centre / By batch | Table regroups, URL updates |
| Centre select (all-centre users only) | Filters to one centre |
| Search student | Enter: goes to the ledger if one match, otherwise opens the roster with matches. No match: empty state |
| Centre row | Expands to batches |
| Batch row | Opens the roster filtered to that batch |
| Student row | `/staff/students/[code]` |
| Export dues CSV | Downloads `dues-<date>.csv` |
| Export receipts CSV | Downloads the current month's `receipts-<month>.csv` |
| Needs attention links | Payments to check, Parents to call and Students over 60 days late, each opening that list |
| Sidebar: Dashboard, Students, Automation, Log out | Navigates, or ends the session |

### S1b. Students roster (accounts)

**Route:** `/staff/students?status=&centre=&batch=&q=&page=`

**Layout:** title and export actions, then a card holding search, centre and batch filters, status Tabs with counts (All, Overdue, Over 60 days, Upcoming, Paid up, Being checked, Withdrawn), the table and Pagination (25 per page). Worst first: most days overdue, then largest balance. Columns: Student (initials, name, code), Batch and centre, Status, Outstanding, Overdue by, Next step, Last payment and method. Each name opens S2. Centre scope applies as on S1.

```ts
export type StudentStatus = "overdue" | "upcoming" | "clear" | "checking" | "withdrawn";
export interface StudentFilters { status?: StudentStatus | "over60"; centre?: string; batch?: string; q?: string; page?: number }
export interface StudentRowVM {
  id: string; code: string; name: string; batch: string; centre: string; status: StudentStatus; balance: number; daysOverdue: number;
  next: string | null; stopped: string | null; lastPayment: { on: string; method: string } | null;
}
export interface StudentsVM {
  today: string; canPickCentre: boolean; rows: StudentRowVM[]; page: number; pages: number;
  counts: Record<StudentStatus | "all" | "over60", number>;
}
```

### S2. Student ledger (accounts)

**Route:** `/staff/students/[code]`

**Layout:** name, code, batch, centre, status. Summary line: net fee, paid, balance, days overdue. Plan: gross, discount and reason, net. Instalments table: number, due, amount, paid, balance, status, days overdue. Payments table: date, method, amount, receipt link. Reminder timeline per unpaid instalment: sent steps, next step and date, or "Stopped: paid 2 Nov".

**Why:** it replaces the desktop software and the Excel sheet in one view, so staff can answer a parent's call in seconds.

```ts
export interface LedgerVM {
  student: { id: string; code: string; name: string; batch: string; centre: string; status: "active" | "withdrawn" };
  plan: { gross: number; discount: number; discountReason: string | null; net: number; paid: number; balance: number };
  instalments: InstalmentVM[];
  payments: { id: string; on: string; method: string; amount: number; receiptId: string | null }[];
  timeline: { instalmentId: string; sent: { step: number; on: string; language: "hi" | "en" }[];
              next: { step: number; on: string } | null; stopped: string | null }[];
  refund: { id: string; status: string } | null;
  guardianPhone: string;
}
```

| Control | Result |
|---|---|
| Record payment | Modal: amount in ₹, method (cash, cheque, bank), date (not after today), note. Save: allocated oldest first, receipt created, toast with receipt number. Excess goes to the unmatched queue, and the toast says so |
| Copy pay link | Copies `/pay/[token]` for the oldest unpaid instalment. Disabled with a tooltip if nothing is due |
| Start refund or View refund | S3 |
| Receipt link | Receipt view for staff |
| Breadcrumb | `/staff/dashboard` |

### S3. Refund calculator (accounts)

**Route:** `/staff/students/[code]/refund`

**Layout:** inputs on the left: withdrawal date, reason. The worked calculation on the right, one line per step, with the policy version named:

```text
Refund Policy v1
Net fee                         ₹1,20,000
Session days                          365
Days used (1 Apr to 2 Nov)            216
Fee for days used               ₹71,013.69
Paid so far                     ₹75,000
─────────────────────────────────────────
Refund                          ₹3,986.31
  Taxable value                 ₹3,378.23
  CGST 9%                         ₹304.04
  SGST 9%                         ₹304.04
Pay by                          12 Nov
```

**There is no editable amount field anywhere on this screen.** Showing every line lets staff explain the figure to a parent and removes the calculator from the process.

```ts
export interface RefundVM {
  student: { code: string; name: string }; policy: { version: string };
  input: { withdrawalDate: string | null; reason: string | null };
  calc: RefundResult | null;   // see B8.5
  status: "new" | "draft" | "approved" | "paid";
  blockedBy: { unmatchedId: string; amount: number } | null;
  overdueDeadline: boolean;
}
```

| Control | Result |
|---|---|
| Withdrawal date | Must be on or before today and on or after enrolment. Calculation updates |
| Reason | Personal, Moved city, Changed course, Health, Other |
| Save draft | Saved, status draft |
| Approve | Confirm Modal. Snapshot frozen, student withdrawn, reminders stop. Blocked if `blockedBy` is set, with a link to the queue item |
| Mark as paid (mock) | Confirm Modal. Status paid, date saved |
| Refund policy | Opens `/refund-policy` |

**States:** no plan; blocked by an unmatched payment; past deadline in rose; nothing to refund with "Still payable" shown instead; approved or paid is read-only.

### S4. Automation (accounts)

**Route:** `/staff/automation?tab=reminders|unmatched`

**Why:** automation people cannot see is automation they will not trust.

**Reminders tab.** A Segmented Control chooses among:

- **Sent:** student, instalment, step, date, language
- **Upcoming:** next step in the coming 7 days, derived
- **Stopped:** unpaid steps that will never send, with the reason: Paid, Withdrawn, or Payment being checked
- **Needs a call:** unpaid over 30 days past due

**Unmatched tab.** Received date, amount, reference, reason, suggested student.

**Demo bar**, when `DEMO_MODE=true`: Date Picker for the demo date, Run today's reminders, Reset demo.

```ts
export interface AutomationVM {
  today: string; demo: boolean; unmatchedOpen: number;
  sent: ReminderRow[]; upcoming: ReminderRow[]; stopped: ReminderRow[]; needsCall: ReminderRow[];
  unmatched: { id: string; receivedOn: string; amount: number; reference: string | null;
    reason: "unknown_reference" | "amount_mismatch" | "already_paid" | "student_withdrawn" | "excess_counter_payment";
    suggested: { instalmentId: string; studentCode: string; studentName: string } | null;
    status: "open" | "matched" | "rejected" }[];
}
export interface ReminderRow {
  instalmentId: string; studentCode: string; studentName: string; step: number | null; on: string | null;
  language: "hi" | "en"; amount: number; body: string | null; stoppedReason: string | null;
}
```

| Control | Result |
|---|---|
| Tabs | Switches tab, URL updates |
| Segmented filter | Switches list |
| Reminder row | Drawer with the exact message text, and a link to the ledger |
| Unmatched row | Drawer: Combobox to find a student and instalment, Match, or Reject with a required reason |
| Match | Allocates, creates a receipt, closes the item. Amount above the balance: error. Already resolved by someone else: error |
| Reject | Requires a reason, closes the item |
| Demo date | Saves the date. All screens now use it |
| Run today's reminders | Toast: "Sent 12. Nothing else due." |
| Reset demo | Confirm Modal, then named demo data and the date are restored |

### S5. Counsellor tasks (counsellor)

**Route:** `/counsellor/tasks?tab=calls|watch|unknown`

**Layout:** Stat Card "Flag accuracy so far: 8 of 11 genuine (73%)", or "No outcomes yet". Tabs: Call tasks, Watch, Not enough data. Call tasks has an Open or Closed Segmented Control.

**This screen shows no rupee amounts and no fee actions.** Reasons give counts and days only.

```ts
export interface CounsellorVM {
  accuracy: { genuine: number; total: number };
  open: TaskRow[]; closed: TaskRow[];
  watch: { studentCode: string; studentName: string; batch: string; score: number; reasons: string[] }[];
  unknown: { studentCode: string; studentName: string; batch: string; missing: string }[];
}
export interface TaskRow {
  id: string; studentCode: string; studentName: string; batch: string; guardianPhone: string;
  score: number; band: "high"; reasons: string[];
  brief: string; briefSource: "llm" | "template"; createdOn: string;
  status: "open" | "called" | "false_flag"; note: string | null;
}
```

| Control | Result |
|---|---|
| Tabs, Segmented Control | Switch list |
| Task row | Drawer: reasons, call brief labelled "AI-written summary" or "Standard summary", parent phone as a `tel:` link, outcome Radio, note |
| Outcome: Called, genuine concern | Saved, task closed, counts as genuine |
| Outcome: False flag | Note required. Saved, task closed, counts as false, suppression starts |
| Log out | Ends session |

Opening the Drawer calls `ensureCallBrief`. Template text shows at once, and is replaced if the AI text arrives. A failure leaves the template in place.

### Supporting pages

- **`/staff/login`:** email and password in `AuthLayout`, with a show-password button, a Caps Lock hint and a loading state. A wrong password gets the same message as an unknown email, in an alert above the form.
- **`/demo`** (only when `DEMO_MODE=true`): a hero per B3a saying what the product does, one Start button, role cards, then the reviewer's path in 6 steps with links, demo phone numbers and staff emails. Passwords stay in `deployment.md`. This is the only page where decorative motion is allowed. It must also work at 360 px.
- **`/proto`** (only when `NEXT_PUBLIC_PROTO=1`): links to every screen and each state.

## B6. Copy

`lib/i18n/hi.ts` is typed as `Record<keyof typeof en, string>`, so a missing Hindi string fails the type check. **All of this needs a human Hindi check at Gate 0** (H5).

```ts
// lib/i18n/en.ts
export const en = {
  "login.title": "Sign in with your mobile number",
  "login.phone": "Mobile number",
  "login.sendCode": "Send code",
  "login.codeTitle": "Enter the 6-digit code",
  "login.codeSentTo": "Sent to {phone}",
  "login.continue": "Continue",
  "login.resend": "Send a new code",
  "login.changeNumber": "Change number",
  "login.noCodeHelp": "No code? Your number may not be on our records. Please contact your centre.",
  "login.staff": "Staff sign-in",
  "err.phoneInvalid": "Enter a 10-digit mobile number",
  "err.codeWrong": "That code is wrong. Try again.",
  "err.codeExpired": "This code has expired. Ask for a new one.",
  "err.tooMany": "Too many tries. Try again in {minutes} minutes.",
  "consent.title": "Your permission",
  "consent.body": "As the parent or guardian of {student}, you allow Company A to use {student}'s details for:",
  "consent.p1": "Showing fee dues and receipts",
  "consent.p2": "Sending fee reminders",
  "consent.p3": "Showing attendance and test scores",
  "consent.p4": "Helping counsellors see when a student may need support. This never affects fees.",
  "consent.check": "I am the parent or guardian of {student} and I agree",
  "consent.agree": "Agree and continue",
  "consent.decline": "Not now",
  "consent.declined": "We can't show details without your permission. You can still pay using the link in your reminder, or contact your centre.",
  "dues.pay": "Pay {amount}",
  "dues.due": "Due {date}",
  "dues.wasDue": "Was due {date}",
  "dues.dueToday": "Due today",
  "dues.overdueOne": "1 day overdue",
  "dues.overdue": "{n} days overdue",
  "dues.partPaid": "{paid} of {total} paid",
  "dues.clear": "No dues",
  "dues.next": "Next: {amount} on {date}",
  "dues.moreOne": "1 more instalment",
  "dues.more": "{n} more instalments",
  "dues.seeAll": "See all instalments",
  "dues.receipts": "Receipts",
  "dues.review": "We received a payment and are checking it.",
  "status.paid": "Paid",
  "status.partPaid": "Part paid",
  "status.overdue": "Overdue",
  "status.upcoming": "Upcoming",
  "status.dueToday": "Due today",
  "refund.title": "Refund",
  "refund.payBy": "To be paid by {date}",
  "refund.paidOn": "Paid on {date}",
  "refund.processing": "Being processed",
  "refund.stillPayable": "Still payable: {amount}",
  "pay.title": "Fee payment for {name}",
  "pay.button": "Pay {amount}",
  "pay.confirming": "Confirming your payment…",
  "pay.success": "Payment received",
  "pay.failed": "Payment failed. Please try again.",
  "pay.pending": "Your payment is being processed. Please check again shortly.",
  "pay.alreadyPaid": "This instalment is already paid.",
  "pay.invalid": "This link is not valid.",
  "pay.viewReceipt": "View receipt",
  "pay.backToDues": "Back to dues",
  "receipts.title": "Receipts",
  "receipts.empty": "No receipts yet",
  "receipt.title": "Fee receipt",
  "receipt.number": "Receipt no.",
  "receipt.date": "Date",
  "receipt.student": "Student",
  "receipt.batch": "Batch",
  "receipt.centre": "Centre",
  "receipt.method": "Paid by",
  "receipt.taxable": "Taxable value",
  "receipt.total": "Total",
  "receipt.print": "Save or print",
  "common.retry": "Try again",
  "common.loadFailed": "We couldn't load this. Check your connection.",
  "common.logout": "Log out",
  "policy.title": "Refund policy",
  "reminder.before": "{student}'s fee instalment of {amount} is due on {date}. Pay here: {link}",
  "reminder.today": "{student}'s fee instalment of {amount} is due today. Pay here: {link}",
  "reminder.after": "{student}'s fee instalment of {amount} was due on {date}. Pay here: {link}. If you have already paid, please ignore this.",
} as const;
```

```ts
// lib/i18n/hi.ts
export const hi: Record<keyof typeof en, string> = {
  "login.title": "अपने मोबाइल नंबर से लॉगिन करें",
  "login.phone": "मोबाइल नंबर",
  "login.sendCode": "कोड भेजें",
  "login.codeTitle": "6 अंकों का कोड डालें",
  "login.codeSentTo": "{phone} पर भेजा गया",
  "login.continue": "आगे बढ़ें",
  "login.resend": "नया कोड भेजें",
  "login.changeNumber": "नंबर बदलें",
  "login.noCodeHelp": "कोड नहीं मिला? हो सकता है आपका नंबर हमारे रिकॉर्ड में न हो। कृपया अपने सेंटर से संपर्क करें।",
  "login.staff": "स्टाफ लॉगिन",
  "err.phoneInvalid": "10 अंकों का मोबाइल नंबर डालें",
  "err.codeWrong": "कोड गलत है। फिर से कोशिश करें।",
  "err.codeExpired": "इस कोड की समय-सीमा खत्म हो गई है। नया कोड मँगाएँ।",
  "err.tooMany": "बहुत ज़्यादा कोशिशें हो गईं। {minutes} मिनट बाद फिर कोशिश करें।",
  "consent.title": "आपकी अनुमति",
  "consent.body": "{student} के माता-पिता या अभिभावक के रूप में, आप Company A को {student} की जानकारी इन कामों के लिए इस्तेमाल करने की अनुमति देते हैं:",
  "consent.p1": "फीस का बकाया और रसीदें दिखाना",
  "consent.p2": "फीस के रिमाइंडर भेजना",
  "consent.p3": "उपस्थिति और टेस्ट के अंक दिखाना",
  "consent.p4": "यह समझने में काउंसलर की मदद करना कि कब छात्र को सहायता की ज़रूरत हो सकती है। इसका फीस पर कोई असर नहीं पड़ता।",
  "consent.check": "मैं {student} के माता-पिता या अभिभावक के रूप में सहमत हूँ",
  "consent.agree": "सहमत हूँ, आगे बढ़ें",
  "consent.decline": "अभी नहीं",
  "consent.declined": "आपकी अनुमति के बिना हम जानकारी नहीं दिखा सकते। आप रिमाइंडर के लिंक से भुगतान कर सकते हैं, या अपने सेंटर से संपर्क करें।",
  "dues.pay": "{amount} का भुगतान करें",
  "dues.due": "अंतिम तिथि {date}",
  "dues.wasDue": "अंतिम तिथि {date} थी",
  "dues.dueToday": "आज अंतिम तिथि है",
  "dues.overdueOne": "1 दिन की देरी",
  "dues.overdue": "{n} दिन की देरी",
  "dues.partPaid": "{total} में से {paid} का भुगतान हो चुका है",
  "dues.clear": "कोई बकाया नहीं",
  "dues.next": "अगली किस्त: {date} को {amount}",
  "dues.moreOne": "1 और किस्त",
  "dues.more": "{n} और किस्तें",
  "dues.seeAll": "सभी किस्तें देखें",
  "dues.receipts": "रसीदें",
  "dues.review": "हमें भुगतान मिला है और हम उसकी जाँच कर रहे हैं।",
  "status.paid": "भुगतान हो गया",
  "status.partPaid": "आंशिक भुगतान",
  "status.overdue": "देरी",
  "status.upcoming": "आने वाली",
  "status.dueToday": "आज देय",
  "refund.title": "रिफंड",
  "refund.payBy": "{date} तक दिया जाएगा",
  "refund.paidOn": "{date} को दिया गया",
  "refund.processing": "प्रक्रिया में है",
  "refund.stillPayable": "अभी देय: {amount}",
  "pay.title": "{name} की फीस का भुगतान",
  "pay.button": "{amount} का भुगतान करें",
  "pay.confirming": "आपके भुगतान की पुष्टि हो रही है…",
  "pay.success": "भुगतान मिल गया",
  "pay.failed": "भुगतान नहीं हो सका। कृपया फिर से कोशिश करें।",
  "pay.pending": "आपका भुगतान प्रक्रिया में है। कृपया थोड़ी देर बाद फिर देखें।",
  "pay.alreadyPaid": "इस किस्त का भुगतान पहले ही हो चुका है।",
  "pay.invalid": "यह लिंक मान्य नहीं है।",
  "pay.viewReceipt": "रसीद देखें",
  "pay.backToDues": "बकाया पर वापस जाएँ",
  "receipts.title": "रसीदें",
  "receipts.empty": "अभी कोई रसीद नहीं",
  "receipt.title": "फीस की रसीद",
  "receipt.number": "रसीद संख्या",
  "receipt.date": "तारीख",
  "receipt.student": "छात्र",
  "receipt.batch": "बैच",
  "receipt.centre": "सेंटर",
  "receipt.method": "भुगतान का तरीका",
  "receipt.taxable": "कर योग्य राशि",
  "receipt.total": "कुल",
  "receipt.print": "सहेजें या प्रिंट करें",
  "common.retry": "फिर से कोशिश करें",
  "common.loadFailed": "जानकारी लोड नहीं हो सकी। अपना इंटरनेट कनेक्शन जाँचें।",
  "common.logout": "लॉग आउट",
  "policy.title": "रिफंड नीति",
  "reminder.before": "{student} की फीस की किस्त {amount}, {date} तक जमा करनी है। यहाँ भुगतान करें: {link}",
  "reminder.today": "{student} की फीस की किस्त {amount} आज जमा करनी है। यहाँ भुगतान करें: {link}",
  "reminder.after": "{student} की फीस की किस्त {amount} की अंतिम तिथि {date} थी। यहाँ भुगतान करें: {link}। अगर आप भुगतान कर चुके हैं, तो कृपया इसे अनदेखा करें।",
};
```

**Refund Policy v1 text**, seeded into `refund_policies` and shown on `/refund-policy`. The label is deliberate, because the client's written policy was not provided.

English:

> Refund Policy v1. Assumed for this demo; the client's written policy replaces it.
> 1. If a student leaves, the fee is charged only for the days up to and including the date we receive written notice.
> 2. Fee for days used = fee after discounts × days used ÷ total days in the session.
> 3. Refund = amount paid − fee for days used. If the fee for days used is more than the amount paid, the difference remains payable.
> 4. We pay the refund within 10 days of the notice date.
> 5. A credit note with the refund shows GST.

Hindi:

> रिफंड नीति v1। इस डेमो के लिए मानी गई है; क्लाइंट की लिखित नीति इसकी जगह लेगी।
> 1. छात्र के छोड़ने पर फीस केवल उन दिनों की ली जाएगी जो लिखित सूचना मिलने की तारीख तक (उस दिन सहित) पूरे हुए हैं।
> 2. उपयोग किए गए दिनों की फीस = छूट के बाद की फीस × उपयोग किए गए दिन ÷ सत्र के कुल दिन।
> 3. रिफंड = भुगतान की गई राशि − उपयोग किए गए दिनों की फीस। अगर यह फीस भुगतान की गई राशि से ज़्यादा है, तो अंतर देय रहेगा।
> 4. हम सूचना की तारीख से 10 दिनों के भीतर रिफंड देंगे।
> 5. रिफंड के साथ क्रेडिट नोट पर GST दिखाया जाएगा।

**`lib/config.ts`:** `ORG = { name: "Company A", city: "Jaipur", gstin: "08AAAAA0000A1Z5 (sample)" }`.

## B7. Data model

These are Django models in `backend/fees/models.py`. All IDs are `UUIDField(primary_key=True, default=uuid4)`. Money is `BigIntegerField`, in paise. Dates are `DateField`. All tables have `created_at` with `auto_now_add`. CHECKs and partial uniques are `CheckConstraint` and `UniqueConstraint(condition=...)` in `Meta.constraints`, so the database enforces them. Where a table says "PK on" several columns, use a unique constraint on them, and keep the normal `id`.

| Table | Columns and constraints |
|---|---|
| `centres` | `code` unique, `name` |
| `batches` | `centre_id` FK, `name`, `stream` enum JEE or NEET, `session_start`, `session_end`. Unique on centre and name |
| `students` | `code` unique, `full_name`, `batch_id` FK, `status` enum active or withdrawn, `enrolled_on`, `withdrawn_on` null |
| `guardians` | `phone` unique in E.164, `full_name`, `language` enum hi or en |
| `guardian_students` | `guardian_id`, `student_id`, `is_primary`. PK on both |
| `staff_users` | `email` unique, `full_name`, `password_hash` from `make_password`, `role` enum accounts or counsellor, `centre_id` null (null means all centres) |
| `otp_challenges` | `phone`, `code_hash`, `expires_at`, `attempts` default 0, `consumed_at` null. Index on phone and created_at |
| `login_attempts` | `email`, `at`. Index on email and at |
| `consents` | `guardian_id`, `student_id`, `wording_version`, `language`, `otp_challenge_id` FK, `granted_at`, `withdrawn_at` null. Partial unique on guardian and student where `withdrawn_at` is null |
| `refund_policies` | `version` unique, `effective_from`, `deadline_days` default 10, `text_en`, `text_hi` |
| `fee_plans` | `student_id` unique FK, `gross_paise`, `discount_paise` default 0, `discount_reason` null, `net_paise`, `gst_rate_bps` default 1800, `refund_policy_id` FK. CHECK `net_paise = gross_paise - discount_paise`, CHECK `discount_paise >= 0` |
| `instalments` | `plan_id` FK, `seq`, `due_date`, `amount_paise` CHECK above 0. Unique on plan and seq |
| `payments` | `student_id` FK, `amount_paise` CHECK above 0, `method` enum gateway, cash, cheque or bank, `event_id` null, `received_on`, `note` null, `recorded_by` null FK |
| `allocations` | `payment_id` FK, `instalment_id` FK, `amount_paise` CHECK above 0. Index on instalment |
| `receipts` | `payment_id` unique FK, `number` unique, `issued_on`, `taxable_paise`, `cgst_paise`, `sgst_paise`, `total_paise`. CHECK the parts sum to the total |
| `receipt_counters` | `centre_id`, `fy`, `next_seq`. PK on centre and fy |
| `payment_events` | `event_id` PK, `payload` jsonb, `result` enum allocated, queued, failed or pending, `unmatched_id` null, `payment_id` null, `received_at` |
| `unmatched_payments` | `event_id` null, `reference` null, `amount_paise`, `reason` enum (see S4), `suggested_instalment_id` null FK, `status` enum open, matched or rejected, `received_on`, `resolved_by` null, `resolved_at` null, `resolution_note` null, `payment_id` null |
| `reminder_log` | `instalment_id` FK, `step` int, `language`, `channel` default `whatsapp_mock`, `amount_paise`, `sent_on`. **Unique on instalment and step** |
| `refunds` | `student_id` unique FK, `policy_id` FK, `withdrawal_date`, `reason`, `net_paise`, `paid_paise`, `total_days`, `elapsed_days`, `earned_paise`, `refund_paise`, `still_payable_paise`, `taxable_paise`, `cgst_paise`, `sgst_paise`, `deadline`, `status` enum draft, approved or paid, `created_by`, `approved_by` null, `approved_at` null, `paid_on` null |
| `attendance_weekly` | `student_id`, `week_start`, `attended`, `held`. PK on student and week. CHECK `attended <= held` |
| `test_scores` | `student_id`, `test_date`, `test_name`, `score`, `max_score`. PK on student, date and name |
| `risk_flags` | `student_id`, `computed_on`, `score` null, `band` enum high, watch or insufficient, `reasons` jsonb, `features` jsonb. Unique on student and computed_on |
| `counsellor_tasks` | `flag_id` FK, `student_id` FK, `score`, `status` enum open, called or false_flag, `brief` null, `brief_source` enum llm or template, `created_on`, `note` null, `closed_by` null, `closed_at` null. **Partial unique on student where status is open** |
| `audit_log` | `actor_type`, `actor_id`, `action`, `entity`, `entity_id`, `before` jsonb, `after` jsonb. Written on every money change |
| `app_settings` | `key` PK, `value`. Holds `demo_today` |

**View `instalment_balances`:** instalment fields plus student, batch and centre IDs, `paid_paise = coalesce(sum(allocations.amount_paise), 0)`, and `balance_paise = amount_paise - paid_paise`. Create it with `migrations.RunSQL`, and read it through a model with `managed = False`. All dues queries use this view. **Balance is never a column.**

Sessions use Django's own `django_session` table. `reminder_log` stores facts, not text: Next.js renders the message from B6 when it is displayed, so all copy stays in `lib/i18n`.

## B8. Rules and test values

Each rule is a pure function in `backend/fees/domain`, with a table-driven test using exactly these values. All values below were calculated by running a reference implementation, then run again in Python with the rules below. Every value held. Amounts are paise.

**Translating to Python.** Some logic below is in JavaScript notation. Keep the logic and the values, and apply these rules:

- Names become snake_case: `diffDays` becomes `diff_days`.
- Dates are `datetime.date`, so `diff_days(a, b)` is `(a - b).days`.
- `Math.floor(a / b)` on integers is `a // b`. Never use `/` on money.
- **`Math.round(x)` is `math.floor(x + 0.5)`. Never use Python's `round()`.** It rounds halves to the even number, so `round(2.5)` is 2, and scores would change.
- Keep the float expressions in B8.9 in the order written, because the expected values depend on them.

### B8.1 Dates (`dates.py`)

`diff_days(a, b)` is a minus b in whole days. `add_days(date, n)`. `financialYear(date)` runs April to March.

| Input | Expected |
|---|---|
| `financialYear("2026-11-02")` | `2026-27` |
| `financialYear("2027-03-31")` | `2026-27` |
| `financialYear("2027-04-01")` | `2027-28` |
| IST date at `2026-11-01T20:00:00Z` | `2026-11-02` |

`backend/fees/clock.py`: `today()` returns `app_settings.demo_today` when `DEMO_MODE=true`. Otherwise it returns the current date in `ZoneInfo("Asia/Kolkata")`.

### B8.2 Phone (`phone.py`)

Strip spaces and hyphens, remove a leading `+91`, `91` or `0` when 10 digits follow, then require `^[6-9]\d{9}$`, and return `+91…`.

| Input | Expected |
|---|---|
| `98765 43210`, `+919876543210`, `09876543210`, `919876543210`, `98765-43210` | `+919876543210` |
| `12345`, `5876543210` | null |

### B8.3 GST (`money.py`, assumed 18% included in the fee)

```python
d = 10000 + rate_bps
taxable = (2 * amount * 10000 + d) // (2 * d)   # rounds half up, with no floats
gst = amount - taxable
cgst = gst // 2
sgst = gst - cgst
```

| Amount | Taxable | CGST | SGST |
|---|---|---|---|
| 3000000 | 2542373 | 228813 | 228814 |
| 1500000 | 1271186 | 114407 | 114407 |
| 4000000 | 3389831 | 305084 | 305085 |
| 398631 | 337823 | 30404 | 30404 |

The parts must always add to the amount.

### B8.4 Ledger (`ledger.py`)

`splitNet(net, n)`: each instalment is `floor(net / n)`, and the last takes the remainder. Discounts are set at enrolment only (assumption).

| Input | Expected |
|---|---|
| `splitNet(10800000, 4)` | `[2700000, 2700000, 2700000, 2700000]` |
| `splitNet(11000000, 3)` | `[3666666, 3666666, 3666668]` |

`instalmentView({amount, paid, dueDate}, today)`, for today `2026-11-02`. These are the brief's 3 sample rows, plus a due-today case.

| Amount | Paid | Due | status | partPaid | balance | daysOverdue | dueInDays |
|---|---|---|---|---|---|---|---|
| 3000000 | 3000000 | 2026-10-10 | paid | false | 0 | 0 | 0 |
| 3000000 | 1500000 | 2026-10-10 | overdue | true | 1500000 | 23 | 0 |
| 4000000 | 0 | 2026-11-15 | upcoming | false | 4000000 | 0 | 13 |
| 3000000 | 0 | 2026-11-02 | due_today | false | 3000000 | 0 | 0 |

`allocateOldestFirst(amount, balances)`, with balances sorted by due date:

| Amount | Balances | Allocations | Excess |
|---|---|---|---|
| 5000000 | 1500000, 3000000, 3000000 | 1500000, 3000000, 500000 | 0 |
| 5000000 | 1500000, 3000000 | 1500000, 3000000 | 500000 |
| 1000000 | none | none | 1000000 |

`ageingBucket(daysFromDue)`:

| Days | −5, 0 | 1, 30 | 31, 60 | 61, 90 | 91 |
|---|---|---|---|---|---|
| Bucket | not_due | 1–30 | 31–60 | 61–90 | 90+ |

### B8.5 Refund (`refund.py`)

```python
@dataclass(frozen=True)
class RefundResult:
    total_days: int
    elapsed_days: int
    earned: int
    refund: int
    still_payable: int
    deadline: date
    taxable: int      # GST split of refund
    cgst: int
    sgst: int

total_days    = diff_days(session_end, session_start) + 1
elapsed_days  = max(0, min(total_days, diff_days(withdrawal_date, session_start) + 1))
earned        = net * elapsed_days // total_days          # rounded in the parent's favour
refund        = max(0, paid - earned)
still_payable = max(0, earned - paid)
deadline      = add_days(withdrawal_date, deadline_days)  # 10
```

Session `2026-04-01` to `2027-03-31`:

| Case | Net | Paid | Withdrawal | Days used | Earned | Refund | Still payable | Deadline |
|---|---|---|---|---|---|---|---|---|
| Aarav Meena | 12000000 | 9000000 | 2026-11-02 | 216 | 7101369 | 1898631 | 0 | 2026-11-12 |
| Ishita Sharma | 12000000 | 7500000 | 2026-11-02 | 216 | 7101369 | 398631 | 0 | 2026-11-12 |
| Mohit Gurjar | 12000000 | 8000000 | 2026-11-02 | 216 | 7101369 | 898631 | 0 | 2026-11-12 |
| Paid less than earned | 12000000 | 6000000 | 2026-11-02 | 216 | 7101369 | 0 | 1101369 | 2026-11-12 |
| Before session | 12000000 | 3000000 | 2026-03-20 | 0 | 0 | 3000000 | 0 | 2026-03-30 |
| First day | 12000000 | 3000000 | 2026-04-01 | 1 | 32876 | 2967124 | 0 | 2026-04-11 |
| Last day | 12000000 | 12000000 | 2027-03-31 | 365 | 12000000 | 0 | 0 | 2027-04-10 |
| After session | 12000000 | 12000000 | 2027-05-01 | 365 | 12000000 | 0 | 0 | 2027-05-11 |
| Overpaid, after session | 12000000 | 12500000 | 2027-05-01 | 365 | 12000000 | 500000 | 0 | 2027-05-11 |
| With discount | 10800000 | 5400000 | 2026-11-02 | 216 | 6391232 | 0 | 991232 | 2026-11-12 |
| Paid nothing | 12000000 | 0 | 2026-11-02 | 216 | 7101369 | 0 | 7101369 | 2026-11-12 |

**Service rules (`services/refunds.py`):**

- Use the policy linked to the student's plan, not the latest one.
- Draft: recalculate from current data on every load. A payment during draft changes the figures.
- Approve, in one transaction: fail if an open unmatched payment suggests any of this student's instalments, freeze the snapshot, set the student withdrawn with `withdrawn_on`, and write `audit_log`.
- Approved and paid are read-only. One refund per student. **There is no override in this version.**
- Still payable above 0 is shown to staff, and never collected automatically.

### B8.6 Over 60 days late (`ledger.py`)

The client's headline metric. Consider only instalments past due (`daysFromDue > 0`). The denominator is the sum of their amounts. The numerator adds:

- every allocation received more than 60 days after the due date, and
- the unpaid balance, when `daysFromDue > 60`.

Today `2026-11-02`:

| Amount | Due | Days past due | Allocations | Adds |
|---|---|---|---|---|
| 10000 | 2026-07-25 | 100 | none | 10000 |
| 10000 | 2026-07-25 | 100 | 10000 on 2026-08-04 | 0 |
| 10000 | 2026-07-25 | 100 | 10000 on 2026-10-03 | 10000 |
| 10000 | 2026-10-03 | 30 | none | 0 |
| 10000 | 2026-08-04 | 90 | 4000 on 2026-08-09 | 6000 |
| 10000 | 2026-12-01 | not due | none | excluded |

**Expected:** numerator 26000, denominator 50000, result 52%.

### B8.7 Reminder steps (`reminders.py`)

Steps are `[-7, -3, 0, 3, 7, 15, 30]` days from the due date (assumed).

```ts
nextStep(dueDate, today, sentSteps):
  d = diffDays(today, dueDate)
  eligible = STEPS.filter(s => s <= d)
  if none: return null
  latest = max(eligible)
  if sentSteps is not empty and latest <= max(sentSteps): return null
  return latest
```

**Only the latest step sends,** so an outage produces one message, not a burst.

| Due | Today | Sent | Expected |
|---|---|---|---|
| 2026-11-15 | 2026-11-02 | none | null |
| 2026-11-15 | 2026-11-08 | none | −7 |
| 2026-11-15 | 2026-11-09 | none | −7 |
| 2026-11-15 | 2026-11-09 | −7 | null |
| 2026-11-15 | 2026-11-12 | −7 | −3 |
| 2026-11-15 | 2026-11-15 | −7, −3 | 0 |
| 2026-10-10 | 2026-11-02 | −7, −3, 0, 3, 7, 15 | null |
| 2026-10-10 | 2026-11-09 | −7, −3, 0, 3, 7, 15 | 30 |
| 2026-10-10 | 2026-11-20 | all | null |
| 2026-10-10 | 2026-10-20 | −7, −3 | 7 |
| 2026-10-10 | 2026-10-25 | −7, −3, 7 | 15 |

`renderReminder(language, step, vars)` is in Next.js, in `lib/reminder-text.ts`: step below 0 uses `reminder.before`, 0 uses `reminder.today`, above 0 uses `reminder.after`.

**`send_due_reminders(today)` (`services/reminders.py`). Reminders are never queued.** Each run works out what is due from current balances, so there is nothing to cancel, and so nothing can fail to cancel.

1. Select instalments where balance is above 0, the student is active, and no open unmatched payment has this `suggested_instalment_id`. Include the sent steps and the primary guardian.
2. Apply `nextStep`, and drop nulls.
3. For each chunk of 200, in `transaction.atomic()`: lock the rows with `Instalment.objects.select_for_update().filter(id__in=chunk)`, recalculate balances, drop any now at zero, and insert into `reminder_log` with the **current** balance and the guardian's language, using `bulk_create(rows, ignore_conflicts=True)`.
4. Return `{ sent, skipped }`.

The payment transaction locks the same instalment row, so a reminder cannot slip out while a payment is being processed.

**A part payment does not stop reminders.** They continue with the smaller amount, and stop when the balance reaches 0 (assumption).

**Derived, never stored:** the "next" step and "stopped" reasons shown in S2 and S4.

### B8.8 Payment matching (`matching.py`)

`decide_payment(status, found, student_active, balance, amount)`, checked in this order:

| Condition | Result |
|---|---|
| status `failed` | `{ action: "none", result: "failed" }` |
| status `pending` | `{ action: "none", result: "pending" }` |
| instalment not found | queue `unknown_reference` |
| student not active | queue `student_withdrawn` |
| balance is 0 | queue `already_paid` |
| amount differs from balance | queue `amount_mismatch` |
| otherwise | `{ action: "allocate" }` |

**`POST /api/webhooks/payment`,** on Django. Read the raw `request.body`. Verify `x-signature`, which is hex HMAC-SHA256 of the raw body with `PAYMENT_WEBHOOK_SECRET`, using `hmac.compare_digest`. Reject with 401 on failure. Validate with a Django form:

```text
{ event_id: string, reference: string | null, amount_paise: positive int,
  status: "success" | "failed" | "pending", paid_on: "YYYY-MM-DD" }
```

Then, in **one `transaction.atomic()`** (`process_payment_event` in `services/payments.py`):

1. `PaymentEvent.objects.get_or_create(event_id=...)`. If it already existed, return 200 and stop.
2. Find and lock the instalment with `select_for_update()`, using `reference`.
3. Apply `decide_payment`.
4. **Allocate:** insert the payment and allocation, take the next receipt number by locking the `receipt_counters` row with `select_for_update()` and incrementing it, insert the receipt with its GST split, and write `audit_log`.
5. **Queue:** insert `unmatched_payments`, with `suggested_instalment_id` set when the instalment is known. **Nothing is marked paid.**
6. Save the result on the event, and return 200.

**Receipt number format:** `{centre_code}/{fy}/{seq padded to 6}`, such as `MLV/2026-27/000123`.

**Pay token:** `Signer(salt="pay-token", sep=".")` from `django.core.signing`, signing the instalment ID, which gives `{instalmentId}.{signature}`. `unsign` verifies it, so **no table is needed**. Reminder links work without sign-in because a parent on a low-end phone tapping from WhatsApp should not face an OTP first. The page shows only first name, amount and due date.

**Counter payments and queue resolution** use one shared function that allocates and creates the receipt. Excess from a counter payment goes to the queue as `excess_counter_payment`. Matching a queue item with an amount above the chosen instalment's balance allocates oldest first from that instalment on, and returns an error if any excess remains.

### B8.9 Dropout-risk score (`risk.py`)

**A transparent score decides, and Claude only writes words.** With no real outcome data, a trained model would be false precision. So the weights are stated openly, and real outcomes collect from the first day to allow proper training later.

**Input:** `instalments` (balance, days overdue), `attendance` (weeks, oldest first), `tests` (oldest first).

```ts
// Abstain: too little data means no flag, never a guess
if (attendance.length < 4 || tests.length < 3) return { band: "insufficient", score: null, ... };

// Fees: up to 40. Only instalments over 15 days overdue count.
od = instalments.filter(i => i.balance > 0 && i.daysOverdue > 15);
fee = od.length === 0 ? 0
    : Math.min(40, 10 + 10 * (od.length - 1) + Math.min(20, Math.floor(maxDaysOverdue / 3)));

// Attendance: up to 35. Last 4 weeks against the 4 before, plus absolute level.
recent = pct(last 4 weeks);  prior = pct(previous 4 weeks) if at least 8 weeks exist
drop = prior known ? (prior - recent) * 100 : 0;
dropPts = Math.min(25, Math.max(0, Math.round(drop - 5)));
levelPts = recent < 0.75 ? Math.min(10, Math.round((0.75 - recent) * 100 / 2)) : 0;
att = Math.min(35, dropPts + levelPts);

// Tests: up to 25. Mean of last 2 against mean of the earlier ones, from the last 5 tests.
fall = earlierMean - recentMean;      // percentage points
test = Math.min(25, Math.max(0, Math.round(fall - 3)));

score = fee + att + test;
band = score >= 60 ? "high" : score >= 35 ? "watch" : "none";
```

**No single signal can reach High, because the largest cap is 40.** A late fee alone often means a cash-flow problem rather than leaving, so this prevents many false alarms. Assert it in a test.

Attendance rows below are percent present per week. Every expected value below comes from running this exact logic.

| Case | Overdue (days) | Attendance | Tests | fee | att | test | Score | Band |
|---|---|---|---|---|---|---|---|---|
| All three signals | 70, 40 | 90×4 then 60×4 | 72, 70, 65, 50, 48 | 40 | 33 | 17 | 90 | high |
| Fees only | 70, 40 | 95×8 | 70, 71, 70, 71, 70 | 40 | 0 | 0 | 40 | watch |
| New student | 70 | 50×2 | 40 | | | | null | insufficient |
| Too few tests | none | 50×8 | 40, 30 | | | | null | insufficient |
| Mild fall | none | 90×4 then 70×4 | 70, 70, 70, 58, 56 | 0 | 18 | 10 | 28 | none |
| Exactly 60 | 23 | 90×4 then 60×4 | 70, 70, 70, 58, 56 | 17 | 33 | 10 | 60 | high |
| Exactly 59 | 23 | 90×4 then 60×4 | 70, 70, 70, 59, 57 | 17 | 33 | 9 | 59 | watch |
| Ishita-like | 23 | 92×8 | 68, 70, 69, 71, 70 | 17 | 0 | 0 | 17 | none |
| 15 days does not count | 15 | 92×8 | 68, 70, 69, 71, 70 | 0 | 0 | 0 | 0 | none |
| Six weeks only | none | 60×6 | 70, 60, 50 | 0 | 8 | 12 | 20 | none |

**Reasons,** plain text with no rupee amounts:

- `fee > 0`: "2 instalments overdue, oldest 70 days"
- `att >= 5`: "Attendance 60% in the last 4 weeks, was 90%" (or "Attendance 60% in the last 4 weeks" with no prior)
- `test >= 5`: "Test scores down from 69% to 49%"

**`should_create_task(band, score, open_task_exists, last_false_flag, today)`:** true only when the band is high, no task is open, and either there is no false flag in the last 30 days (30 included) or the score is at least 15 above that flag's score.

| Band | Open task | Last false flag | Score | Expected |
|---|---|---|---|---|
| high | no | none | 70 | true |
| high | yes | none | 70 | false |
| watch | no | none | 50 | false |
| high | no | 10 days ago at 70 | 75 | false |
| high | no | 10 days ago at 70 | 85 | true |
| high | no | 30 days ago at 70 | 70 | false |
| high | no | 31 days ago at 70 | 70 | true |

**What happens when it is unsure or wrong:**

| Situation | Behaviour |
|---|---|
| Too little data | Listed under "Not enough data". No flag |
| High | One call task. Nothing else changes |
| Watch | Listed only. No task |
| Counsellor marks False flag | Note saved, suppressed 30 days unless the score rises by 15 or more, counted against accuracy |
| AI text fails | Template text. Scoring is unaffected |

**Enforced guard rails:**

- `test_risk_isolation.py` reads the imports of `domain/risk.py` and `services/risk.py` with `ast`, and fails if they import `reminders`, `payments`, `refunds` or `views`.
- A database test runs the risk job and asserts row counts in `reminder_log`, `payments`, `allocations`, `instalments` and `refunds` are unchanged.
- Tests assert a parent session and an accounts session cannot read tasks or flags.

**Call brief (`ensure_call_brief` in `services/risk.py`).** Claude receives only numbers, **never name, phone or student code**:

```python
import json
import os

import anthropic
from pydantic import BaseModel


class Brief(BaseModel):
    brief: str


SYSTEM = """You write a two-sentence note for a school counsellor about to phone a parent.
Use only the facts provided. Do not say the student will drop out. Do not guess causes.
Do not mention money or suggest any fee action. Suggest an open, supportive question to ask."""


# features example: {"overdueInstalments": 2, "oldestOverdueDays": 70, "attendanceRecentPct": 60,
#                    "attendancePriorPct": 90, "testRecentPct": 49, "testEarlierPct": 69}
def call_model(features: dict) -> str | None:
    client = anthropic.Anthropic()
    response = client.with_options(timeout=15.0, max_retries=1).messages.parse(
        model=os.environ.get("ANTHROPIC_MODEL", "claude-opus-5-5"),
        max_tokens=2000,
        system=SYSTEM,
        messages=[{"role": "user", "content": json.dumps(features)}],
        output_format=Brief,
        output_config={"effort": "low"},
    )
    if response.stop_reason != "end_turn":  # includes "refusal"
        return None
    return response.parsed_output.brief if response.parsed_output else None
```

`pydantic` comes with `anthropic`, so it needs no separate line in `requirements.txt`.

`generate_brief(features, call=call_model)` is the tested function:

- No `ANTHROPIC_API_KEY`: return template.
- Wrap `call` in `try/except Exception`. Any error, timeout, refusal or None: template.
- Reject text over 400 characters or containing `₹`: template.
- Log the failure category only, with no student data.

Template: `Flagged because: {reasons joined with "; "}. Ask how things are going; this call is about support, not fees.`

Save the text and source on the task, so each task calls the model at most once.

**Evaluation.** `test_risk_eval.py` holds about 30 labelled synthetic cases, and prints precision and recall for the High band. Put the numbers in the TDD, clearly marked as synthetic. They show the logic behaves as designed, not that it predicts real dropout. S5's accuracy figure comes from real counsellor marks.

## B9. Server actions and endpoints

Each action below is a Next.js server action in `lib/actions/*` that forwards to one Django view of the same name in snake_case, at `/api/<name>`. **Every Django view is wrapped in `@api(role=..., form=...)` from `fees/auth.py`.** The decorator checks `X-Internal-Key`, loads the session, checks the role, parses JSON and validates it with the Django form. Views return `{ "ok": true, … }` or `{ "ok": false, "code", "message" }`. Every view that takes a student or instalment ID checks scope: parents through `guardian_students`, staff through `centre_id`. Read endpoints for `lib/data/*` use the same decorator.

| Action | Role | Input |
|---|---|---|
| `requestOtp` | Public | phone |
| `verifyOtp` | Public | phone, code |
| `grantConsent` | Parent | studentIds, wordingVersion |
| `setLanguage` | Public | language |
| `logout` | Any | none |
| `staffLogin` | Public | email, password |
| `recordCounterPayment` | Accounts | studentId, amountPaise, method, receivedOn, note |
| `resolveUnmatched` | Accounts | id, action (match or reject), instalmentId, note |
| `saveRefundDraft` | Accounts | studentId, withdrawalDate, reason |
| `approveRefund` | Accounts | refundId |
| `markRefundPaid` | Accounts | refundId |
| `closeTask` | Counsellor | taskId, outcome (called or false_flag), note |
| `ensureCallBrief` | Counsellor | taskId |
| `submitMockPayment` | Public, token checked | token, outcome, method (upi, card or netbanking) |
| `setDemoDate`, `runRemindersNow`, `resetDemo` | Accounts, and only when `DEMO_MODE=true` | date, none, none |

**`submitMockPayment` is the exception.** It stands in for an outside gateway, so the Next.js action itself signs a real payload with `PAYMENT_WEBHOOK_SECRET` and POSTs it to `$BACKEND_URL/api/webhooks/payment`.

**OTP:** 6 digits from `secrets.randbelow`, stored as `salted_hmac` of phone and code, and compared with `constant_time_compare`. 5-minute expiry, 5 tries, 3 sends per 10 minutes per phone. Single use. Known and unknown numbers get the same response. Mock send: when `DEMO_MODE=true` the response includes the code, and the sign-in screen shows it.

**Passwords:** `make_password` and `check_password` from `django.contrib.auth.hashers`. Limit 10 failures per 15 minutes per email.

**Sessions:** Django's database sessions, with `SESSION_COOKIE_NAME = "sid"`. On sign-in, call `request.session.cycle_key()`, store the subject type and ID, and call `set_expiry`: parents 30 days, staff 12 hours. `lib/actions/auth.ts` reads `sid` from Django's `Set-Cookie` with `getSetCookie()`, then sets it on the browser response: `httpOnly`, `sameSite=lax`, the same max age, and `secure` whenever `APP_URL` starts with `https://`, so a local production build over http can still sign in. Only server actions change this cookie. Keep `SESSION_SAVE_EVERY_REQUEST` off, so read requests never need to.

| Endpoint, on Django | Protection | Behaviour |
|---|---|---|
| `POST /api/webhooks/payment` | HMAC, no internal key | B8.8 |
| `GET /api/cron/reminders` | `Authorization: Bearer $CRON_SECRET`, compared with `constant_time_compare` | `send_due_reminders(today())` |
| `GET /api/cron/risk` | Same | Score all active students, save flags, create tasks |
| `GET /api/cron/demo-reset` | Same, and only when `DEMO_MODE=true` | Restore named demo data |

`GET /staff/export/*.csv` are Next.js route handlers that forward to Django views with `@api(role="accounts")`, which apply centre scope and write the CSV with Python's `csv` module.

**`backend/vercel.json`.** The crons belong to the Django project, so Vercel calls Django directly. Vercel's free cron runs at most daily and fires within the stated hour:

```json
{
  "functions": { "config/wsgi.py": { "maxDuration": 60 } },
  "crons": [
    { "path": "/api/cron/reminders",  "schedule": "0 5 * * *" },
    { "path": "/api/cron/risk",       "schedule": "30 5 * * *" },
    { "path": "/api/cron/demo-reset", "schedule": "30 20 * * *" }
  ]
}
```

The reminder time is therefore about 10:30 to 11:30 IST. The date used is always `today()`, and in demo mode the frozen date.

**Database settings in `config/settings.py`:** `DATABASES["default"]` comes from `dj_database_url.parse(os.environ["DATABASE_URL"], conn_max_age=0)`, and also sets `"DISABLE_SERVER_SIDE_CURSORS": True`, because Neon's pooled connection runs in transaction mode. `USE_TZ = True`. `load_dotenv` reads `.env.local` from the repo root, so both apps share one file in development, and it does nothing in production, where the file does not exist.

## B10. Seed data

`fees/management/commands/seed.py` uses `random.Random(20261102)`, so every run gives identical data. **All names and phone numbers are invented.** Split it in two: `seed_fleet()` runs once, and `seed_named()` is safe to re-run and powers Reset demo. Insert with `bulk_create(batch_size=1000)`.

**Organisation (assumed):**

| Code | Centre | JEE due dates | NEET due dates |
|---|---|---|---|
| `MLV` | Malviya Nagar | 10 Apr, 10 Jul, 10 Oct, 10 Jan | 15 Mar, 15 Jul, 15 Nov |
| `VSH` | Vaishali Nagar | 5 Apr, 5 Jul, 5 Oct, 5 Jan | 9 Mar, 9 Jul, 9 Nov |
| `MSR` | Mansarovar | 30 Apr, 30 Jul, 30 Oct, 30 Jan | 5 Mar, 5 Jul, 5 Nov |
| `RJP` | Raja Park | 2 May, 2 Aug, 2 Nov, 2 Feb | 20 Mar, 20 Jul, 20 Nov |

The due dates differ because the brief says each centre keeps its own sheet. These dates also mean some reminders really do fire on 2 Nov during a demo.

- Each centre has 4 batches: JEE 2027 Morning, JEE 2027 Evening, NEET 2027 Morning, NEET 2027 Evening. That makes 16 batches, all with session `2026-04-01` to `2027-03-31`.
- JEE plans: 4 × ₹30,000. NEET plans: 3 × ₹40,000. Gross ₹1,20,000.
- Seed the staff users below, and Refund Policy v1, copying its text from B6 into `fees/policy_text.py`. No message is ever really sent, so the invented phone numbers receive nothing.

**Staff users.** Passwords come from `SEED_DEMO_PASSWORD`:

| Email | Role | Scope |
|---|---|---|
| `accounts@demo.test` | accounts | All centres |
| `accounts.mlv@demo.test` | accounts | MLV only |
| `counsellor@demo.test` | counsellor | All centres |

**Named students (`seed_named`), all in centre MLV unless stated.** These are the only students the demo path changes.

| Code | Name | Batch | State on 2 Nov | Guardian phone | Language |
|---|---|---|---|---|---|
| `STU-0412` | Aarav Meena | JEE 2027 Morning | Paid 3 × ₹30,000 on due dates | +919000000412 | hi |
| `STU-0587` | Ishita Sharma | JEE 2027 Evening | Paid 2 × ₹30,000. Oct instalment ₹15,000 of ₹30,000 paid. 23 days overdue. Good attendance and scores | +919000000587 | en |
| `STU-0219` | Mohit Gurjar | NEET 2027 Morning | Paid 2 × ₹40,000. Due 15 Nov ₹40,000 | +919000000219 | hi |
| `STU-0771`, `STU-0772` | Kavya Joshi, Dev Joshi | JEE 2027 Morning, NEET 2027 Morning | Same guardian. Kavya has an open amount-mismatch queue item | +919000000777 | hi |
| `STU-0733` | Riya Verma | JEE 2027 Evening | High: two overdue, falling attendance and scores | +919000000733 | hi |
| `STU-0734` | Arjun Yadav | NEET 2027 Evening | Watch: fees only | +919000000734 | en |
| `STU-0735` | Neha Kumawat | JEE 2027 Morning | Enrolled 2026-10-20. Not enough data | +919000000735 | hi |
| `STU-0801` | Sample Draft | NEET 2027 Morning | Refund draft | +919000000801 | en |
| `STU-0802` | Sample Approved | JEE 2027 Morning | Refund approved. Withdrawn 2026-10-28, deadline 7 Nov | +919000000802 | en |
| `STU-0803` | Sample Late | JEE 2027 Evening | Refund approved. Withdrawn 2026-10-15, deadline 25 Oct, **past deadline** | +919000000803 | hi |
| `STU-0804` | Sample Paid | NEET 2027 Evening | Refund paid | +919000000804 | en |

Replace the "Sample …" names with invented realistic ones in the seed.

- **Ishita's reminder log:** steps −7, −3, 0, 3, 7 and 15, sent on 3, 7, 10, 13, 17 and 25 Oct. The next is step 30 on 9 Nov.
- **Mohit:** no reminders yet. The next is step −7 on 8 Nov.
- **Consent:** none for the named guardians, so the consent screen appears at first sign-in. Fleet guardians already have consent.
- **Risk:** `STU-0733` also has one open task. Seed 11 closed tasks across the fleet, 8 called and 3 false flags, so the accuracy tile has data.
- **Unmatched queue, 6 items:** one per reason from S4, plus one more unknown reference. Kavya's has a suggested instalment.

**Fleet (`seed_fleet`):** the rest, up to **2,600 students** in total, split evenly across batches, codes `STU-0001` to `STU-2600`.

- About 2% share a guardian with a sibling. About 70% of guardians prefer Hindi. Phones are `+9190001xxxxx`.
- About 15% have a discount of ₹6,000, ₹12,000 or ₹24,000, with reason Merit or Sibling.
- Past instalments mix on-time, late and part-paid payments. **Tune the weights so `over60Pct` on `2026-11-02` falls between 11% and 13%,** the client's baseline. A test asserts this.
- Keep generation in a pure `build_fleet()` and insertion separate, so `test_seed.py` checks the rows without a database.
- Weekly attendance from 6 Apr to 26 Oct and 7 monthly tests per student. Design the mix so about 60 students score High, about 100 score Watch, and about 30 new students have too little data.
- Insert `reminder_log` rows for past steps, so the first run on 2 Nov only sends what is truly due that day.

**`reset_demo()`:** for named students, delete payments, allocations, receipts, reminders, consents, refunds, tasks, flags and queue items, then re-run `seed_named()`, and set `demo_today` to `2026-11-02`. Receipt counters are not rewound, because gaps in demo numbering do not matter.

## B11. Security

| Requirement | How |
|---|---|
| Access control | Django checks every query and action through `@api`. Tests attempt to cross each boundary |
| Validation | Django forms on all inputs, with database constraints behind them |
| Between the apps | Django's `/api/*` requires `X-Internal-Key`. The `sid` cookie lives on the Next.js domain, so no browser holds a cookie for Django's domain |
| CSRF | Next.js server actions compare Origin with Host, and the cookie is `sameSite=lax`. Django's CSRF middleware is off on purpose, because nothing reaches its views with a browser's cookie. The TDD says so openly |
| Secrets | Environment only. `.env.example` has names only. `.env*` in `.gitignore` except the example |
| Webhook | HMAC, constant-time compare, idempotent |
| Pay links | Signed token. Minimal data. `noindex`. `Referrer-Policy: same-origin` |
| Headers (`next.config`) | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin` |
| Parental consent (DPDP) | All students treated as minors. OTP verifies the phone on file. Consent is stored with wording version, language and time. Data stays hidden until it is given |
| Minimal sharing | Claude never receives identifying data. Counsellors never see rupee amounts |
| Money audit | `audit_log` on every money change. Refund snapshots are frozen |
| Refund guideline | Policy public in both languages. Pro-rata calculated from it. 10-day deadline tracked and visible |
| GST on receipts | Rate, split and GSTIN on each receipt. GSTIN is a marked sample |

**DPDP section 9(3), an open question.** The Act restricts tracking or behavioural monitoring of children. A dropout flag on minors could fall under it. Commentary says the Fourth Schedule exempts educational institutions for educational and safety purposes, but the scope is debated and this comes from secondary sources. The TDD raises it as a question for the client's lawyer. **Mitigations already in this spec:** the consent screen names the purpose, a person always decides, reasons are visible, only counsellors have access, and parents and students never see it.

## B12. Environment variables

`.env.example`, names only:

```text
# Both apps
DEMO_MODE=
INTERNAL_API_SECRET=
PAYMENT_WEBHOOK_SECRET=

# Django only
DATABASE_URL=
DJANGO_SECRET_KEY=
DJANGO_ALLOWED_HOSTS=
DJANGO_DEBUG=
CRON_SECRET=
SEED_DEMO_PASSWORD=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=

# Next.js only
BACKEND_URL=
APP_URL=
NEXT_PUBLIC_PROTO=
```

**Local values in `.env.local`:** `BACKEND_URL=http://localhost:8000`, `APP_URL=http://localhost:3000`, `DEMO_MODE=true`, `DJANGO_DEBUG=true`, `DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1`, and `NEXT_PUBLIC_PROTO=1` until T7.2. Codex generates `DJANGO_SECRET_KEY`, `INTERNAL_API_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `CRON_SECRET` and `SEED_DEMO_PASSWORD` with Python's `secrets.token_urlsafe`, writes them only to this file, and never prints them. The human supplies `DATABASE_URL`.

`DATABASE_URL` is required from Phase 1. `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` are optional. The default model is `claude-opus-5-5`, and a short brief costs well under one US cent per call. Change the variable to use a cheaper model.

## B13. Tests

Test what loses money or trust if wrong. No snapshot tests, and no tests of getters. Backend tests are in `backend/fees/tests/` and run on local Postgres, never on Neon.

| File | Covers |
|---|---|
| `test_domain_*.py` | All of B8, using those exact values. Uses `SimpleTestCase` and `subTest`, with no database |
| `test_payments.py` | Each decision row, idempotency, bad signature, receipt numbers unique over 20 payments, GST parts sum |
| `test_reminders.py` | Pay then run: no message. Part pay then run: new amount. Outage: one message. Double run: no duplicate. Held item: no message. Withdrawn: no message |
| `test_refund.py` | Approve freezes figures and stops reminders. Blocked by open queue item. Second refund refused |
| `test_access.py` | Parent A cannot read parent B's dues or receipts. Counsellor cannot reach fee data. Single-centre accounts sees only that centre. Accounts and parents cannot read risk data. A request without `X-Internal-Key` is refused. **Walks every URL pattern and fails on any view without `@api`,** except the webhook and cron views |
| `test_otp.py` | Expiry, attempts, reuse, send limit, same response for unknown numbers |
| `test_risk_isolation.py` | Import guard, and no side effects |
| `test_risk_brief.py` | Fake `call` that raises, returns None, returns over-long text, returns text with `₹`. Each gives the template |
| `test_risk_eval.py` | Synthetic precision and recall |
| `test_seed.py` | Row counts, sample rows match the brief exactly, `over60Pct` within 11–13% |
| `e2e/golden.spec.ts` | At 360 px: parent OTP, consent, dues, pay, receipt. Then accounts: reminder stopped, dashboard changed. One run in Hindi |
| `e2e/controls.spec.ts` | Every control in B5's tables does what the table says |
| `e2e/layout.spec.ts` | Each screen at 360 × 640 and 1280 × 800: no sideways scroll (`scrollWidth <= innerWidth`), no console errors, axe has no serious or critical violations. On `/dues`: Pay button's bottom edge within 640 px in both languages |
| `e2e/perf.spec.ts` | Sum of compressed script bytes is at most 200 KB on `/dues`, `/login` and `/pay/[token]`, and at most 350 KB on `/demo` |
| `tests/motion-boundary.test.ts` | Reads imports under `app/(parent)`, `app/(public)/pay` and `app/(public)/mock-gateway`, and fails on `motion`, `gsap`, `three`, `ogl` or `components/vendor` |
| `e2e/reduced-motion.spec.ts` | With `reducedMotion: "reduce"`: S1 tiles and `/demo` show final content at once. Without it: after a payment, the tile ends on the exact `inr()` value |

**CI, `.github/workflows/ci.yml`:** on push, Node 22 and Python 3.14, a `postgres:17` service, `npm ci`, `pip install` of both requirements files, `npm run check`, and `npm run build` with dummy env values.

---

# Part C. Build tasks

Each task lists what to do and how it is accepted. **Every task also requires:** `npm run check` passes, a commit, and a line in `docs/progress.md`.

## Phase 0. Prototype (first step)

**Goal:** all 8 screens, clickable, on real routes with real BoardUI components, real Hindi and English copy, and every state, with fake data.

**Not in this phase:** database, real sign-in, API routes, cron, business logic beyond simple display.

**How the fake data works:** `lib/data/*` returns view models (B5) from `lib/fixtures/`. `lib/actions/*` write a small JSON cookie named `proto` (for example `{ "role": "parent", "ishitaPaid": true }`). This keeps the same server components and server actions as the final app, and it will also work on Vercel, where memory does not persist. The cookie has no `secure` flag, so it works on a phone over the local network at Gate 0. With no cookie, `/dues` shows Ishita's parent and staff routes show the accounts user, so automated checks can reach every page.

### T0.1 Scaffold

From the repo root:

```bash
npx create-next-app@latest . --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes
```

If it objects to the `docs/` folder, scaffold in a temporary folder and move the files in.

```bash
npx boardui@latest init --yes
```

```bash
npx boardui@latest add button button-group link-button icon-button input input-otp number-field search-field select combobox checkbox radio segmented-control tabs chip badge table pagination data-table stat-cards sidebar auth-card drawer modal tooltip toast notification skeleton spinner progress meter date-picker textarea divider breadcrumb accordion --yes
```

Then:

- Root layout with both fonts (B2). Accent ramp and primary button tokens (B3).
- Add the A4 text to `AGENTS.md`, keeping BoardUI's section.
- Create `lib/config.ts`, `.env.example`, `docs/progress.md`, `docs/decisions.md`, `docs/third-party.md`. Add `docs/inbox/` and `dist/` to `.gitignore`. Create `.env.local` with `NEXT_PUBLIC_PROTO=1`. Confirm with `git check-ignore` that `.env.local` is ignored and `.env.example` is not: the scaffold's `.gitignore` may ignore both, so add `!.env.example` if needed.
- Add `package.json` scripts from B1, Vitest and Playwright (`npx playwright install chromium`), and CI.

**Accept:** `npm run build` succeeds. A page with a BoardUI Button shows the teal accent. A line of Hindi renders in Noto Sans Devanagari.

### T0.2 Shared code

`lib/types.ts` (all view models from B5), `lib/format.ts`, `lib/i18n/*` with all of B6, `lib/clock.ts` returning `2026-11-02`, the preview helper (B4), and in `components/app/`: `Money`, `StatusChip`, `AgeingBar`, `EmptyState`, `ErrorState`, `PageShell`.

Also `scripts/screens.ts` (`npm run screens`), so every screen can be checked as it is built. It uses a server already answering on port 3000, or else starts `next dev` itself and stops it at the end. It saves PNGs to `docs/screens/` for each route that exists, each state and each language where relevant, at 360 × 640 and 1280 × 800. `--only=<route>` limits it to one screen.

**Accept:** a unit test for `inr` and `t()` passes. A missing Hindi key fails the type check.

### T0.3 Fixtures

`lib/fixtures/`, using exact values from B8 and B10:

- All named students from B10, with Ishita, Aarav and Mohit matching the brief's sample rows
- 4 centres and 16 batches with believable ageing numbers
- Sample reminders in both languages, the 6 queue items, refunds in each state
- Risk tasks with reasons, and both brief sources

Then `lib/data/*` and `lib/actions/*` as fixture-and-cookie versions with their final function names.

**Simulated state changes, all of them visible:**

| Action | Visible change |
|---|---|
| Pay ₹15,000 | Ishita's balance becomes clear. Reminder shows "Stopped: paid". Dashboard outstanding and that batch row drop by exactly ₹15,000 |
| Wrong amount | P2 shows "checking it". A new queue item appears |
| Approve refund | Student shows Withdrawn. Reminders stopped. P2 shows the refund |
| Resolve queue item | Item closes. Ledger updates |
| Mark False flag | Task closes. Accuracy tile changes |
| Demo date to 9 Nov and run | Mohit's −7 appears. Ishita's 30 appears only if unpaid |
| Reset demo | Clears the `proto` cookie |

**Accept:** calling each action changes what the data functions return, as this table says. T0.12 checks the same table through the UI.

### T0.4 to T0.11 Screens

Build one task and one commit per screen, following B5 fully, including all its states and both languages.

| Task | Screen |
|---|---|
| T0.4 | P1 Sign-in and consent. Prototype code is always `123456` |
| T0.5 | P2 Dues, every situation in its table |
| T0.6 | P3: pay, mock gateway, result, receipts, receipt, refund policy |
| T0.7 | S1 Dashboard, plus `/staff/login` |
| T0.8 | S2 Ledger |
| T0.9 | S3 Refund, using the Ishita figures from B5 |
| T0.10 | S4 Automation |
| T0.11 | S5 Counsellor tasks |

**Accept, each screen:** matches B5, every control responds, every state shows via `?state=`, and it works at 360 px and 1280 px.

### T0.12 Index

`/proto`: a list of all routes, with loading, empty and error links for each. Also `/demo` as written in B5.

**Accept:** every link opens the right thing, and every row of the T0.3 table works through the UI.

### T0.13 Motion and outside components

Read B3a first, then:

1. `npm install motion`. Add the reduced-motion CSS.
2. CSS motion from the B3a table: Pay pressed state, P3 tick, S3 line fade, S4 row highlight.
3. Bring in and adapt React Bits `CountUp` for S1 and `BlurText` for `/demo`.
4. Check `docs/inbox/`. Adapt any 21st.dev pieces and any MotionSites prompt, or build them from BoardUI and CSS if the folder is empty. Do not wait for the human.
5. Build the `/demo` hero, and fill in `docs/third-party.md`.

**Accept:** `tests/motion-boundary.test.ts` passes. Every animation passes the B3a test. `/dues` is unchanged in size. Delete any motion that adds nothing.

### T0.14 Automated UI checks

- `e2e/layout.spec.ts`, `e2e/controls.spec.ts`, `e2e/perf.spec.ts`, `e2e/reduced-motion.spec.ts` from B13.
- `playwright.config.ts` uses `webServer` to run `npm run start`, so the test command starts and stops its own server.

**Accept:** all pass after `npm run build`. Fix failures. Don't weaken the checks.

### T0.15 Self-review

Open every screenshot, if your environment can view images, and check it against B3 and B5. If it cannot, say so in the gate file.

**Purpose pass:** for each element on each screen, ask "what question does this answer?" Delete it if there is no answer.

**Consistency pass:** one primary action per screen, one chip style, one money style, the same empty and error layouts, no raw colours, aligned figures in tables, and outside components that look like they belong with BoardUI.

Run `npx lighthouse` on `/dues` with mobile settings if a browser is available. Otherwise mark it for the human.

Tag the commit `v0-prototype`. Write `docs/prototype-notes.md` with what was changed and why.

### Gate 0: Codex checks, then continues

Write `docs/gate-0.md` listing each check below with its result, and mark the human checks as not yet run. **Then continue to Phase 1,** unless `docs/PROMPTS.md` says to stop at Gate 0.

Nothing is deployed yet, so the human tests on a phone over the local network: run `npm run build`, then `npm run start -- -H 0.0.0.0`, find the computer's IPv4 address with `ipconfig`, and open `http://<that address>:3000/dues` on a phone on the same Wi-Fi. Once Django exists, also run `npm run dev:api` in a second terminal, and sign in with +91 90000 00587.

| Check | Who |
|---|---|
| No dead controls (`controls.spec`) | Codex |
| Fit at 360 × 640, Pay visible in both languages (`layout.spec`) | Codex |
| No console errors, no serious axe violations | Codex |
| JavaScript budget (`perf.spec`) | Codex |
| Loading, empty and error on all 8 screens | Codex |
| Purpose and consistency passes | Codex |
| Motion limits from B3a (`motion-boundary.test`, `reduced-motion.spec`) | Codex |
| **Five-second test:** show the dues screen on a phone to 3 people for five seconds. Each must say the amount, the date and what to press. At least one reads the Hindi version | Human |
| **Real phone:** opens quickly, looks right, button easy to press | Human |
| **Hindi read:** a Hindi reader checks all copy | Human |
| **Sign-off** on the look and flows | Human |

The human gives the results when the test is done, at any later point. Codex applies the changes, and adds what the test changed to `docs/prototype-notes.md`. Those notes become the TDD's UI section, and they are real evidence of design judgement.

## Phase 1. Foundation

Needs H6.

### T1.1 Django project and schema

- Create `.venv`, then `backend/` with `requirements.txt`, `requirements-dev.txt`, `.python-version` and the `config` project, as B1 lays out. Add `.venv/` and `__pycache__/` to `.gitignore`.
- Settings per B9. `INSTALLED_APPS` holds only `django.contrib.sessions` and `fees`. Middleware holds only `SecurityMiddleware`, `SessionMiddleware` and `CommonMiddleware` (B11).
- `fees/models.py` per B7, including the view, all CHECKs and partial unique indexes. Generate and apply migrations.
- Fill `.env.local` per B12, and update `.env.example`.
- Add `scripts/py.mjs` and the new scripts from B1. Update CI per B13. Add Django to Playwright's `webServer` list, using `npm run py -- backend/manage.py runserver 8000 --noreload`.
- In `AGENTS.md`, replace the "Active stack decision" section and the rules it changes with the A4 text, keeping the Next.js and BoardUI sections. This plan now specifies Django, so nothing overrides it. Add a line to `docs/decisions.md` saying so.

**Accept:** migrations apply to the dev database. A test proves that a bad `fee_plans` row is rejected, a duplicate `reminder_log` key is rejected, and a second open `counsellor_tasks` row for a student is rejected.

### T1.2 Pure rules for dates and phones

`fees/domain/dates.py`, `phone.py`, plus `fees/clock.py`.

**Accept:** B8.1 and B8.2 pass.

### T1.3 Seed

`money.py` and `ledger.py` (B8.3, B8.4, B8.6), since the seed needs them. Then `fees/management/commands/seed.py` per B10.

**Accept:** `test_seed.py` passes. It finds 2,600 students, the three sample rows exactly as in the brief, and `over60Pct` between 11% and 13%. It runs twice with identical results. The full seed finishes in under 3 minutes against the dev database.

### T1.4 Sign-in

Django: `fees/auth.py` with `@api` (B9), and the views `request_otp`, `verify_otp`, `staff_login`, `logout` and `me`. Next.js: `lib/backend.ts` (B1) and `lib/actions/auth.ts`. Wire P1 and `/staff/login` to real data. Access is enforced in Django, not in Next.js middleware.

**Accept:** `test_otp.py` passes, and `test_access.py` covers the routes so far. All roles sign in on a local production build, and each is sent to the right home page: `/dues`, `/staff/dashboard`, `/counsellor/tasks`.

### T1.5 Consent

`grant_consent`, a consent check inside `@api(role="parent")` that returns 403 `consent_required`, and the declined state.

**Accept:** a new guardian cannot reach `/dues` until consent is saved. The row holds wording version, language, time and OTP reference.

**Phase 1 exit:** review the auth diff for missing role checks. The app signs in on a local production build. Fixtures still power everything else.

## Phase 2. Money loop

### T2.1 Dues on real data

A Django view that returns the `DuesVM` contract with all modes, and `lib/data/dues.ts` calling it.

**Accept:** Ishita's parent sees ₹15,000, "Was due 10 Oct", "23 days overdue". Mohit's sees ₹40,000, "Due 15 Nov". Aarav's sees the next instalment. The page was not changed, only the data function.

### T2.2 Ledger on real data

A Django view for the S2 view model, and `lib/data/ledger.ts`. Timeline can come in Phase 3.

**Accept:** all values on S2 match B10 for each named student. Centre scope is enforced.

### T2.3 Payment service

`domain/matching.py` (B8.8), and `services/payments.py`: `process_payment_event`, plus the shared allocate-and-receipt function.

**Accept:** `test_payments.py` passes, and each row of B8.8.

### T2.4 Webhook, pay token and mock gateway

`POST /api/webhooks/payment` on Django, the pay token, `/pay/[token]`, `/mock-gateway/[token]`, `submitMockPayment` (B9), and the result page. Keep the checkout, the three steps and `PaymentGraphic` from Phase 0. The webhook payload carries the method, which is saved on the payment. The result view returns the method, a transaction ID, the date and the first name.

**Accept:** paying as Ishita's parent marks the instalment paid. A bad signature gets 401. Replaying the event changes nothing. A tampered token gets "not valid". Wrong amount marks nothing paid and creates a queue item, and P2 shows "checking it".

### T2.5 Receipts

Django views for the receipt list and receipt, `lib/data/receipts.ts`, `/receipts`, `/receipts/[id]`. Parents see only their own.

**Accept:** a ₹15,000 receipt shows taxable ₹12,711.86, CGST ₹1,144.07, SGST ₹1,144.07, total ₹15,000, a GSTIN and a number like `MLV/2026-27/…`. Printing hides controls.

### T2.6 Counter payments

`record_counter_payment`, `recordCounterPayment` and its Modal.

**Accept:** paying ₹50,000 across ₹15,000, ₹30,000 and ₹30,000 balances allocates per B8.4. Excess goes to the queue.

**Phase 2 exit:** review all money code for floats and missing transactions. Parent can sign in, pay and get a GST receipt on a local production build.

## Phase 3. Automation

### T3.1 Reminder rule and templates

`domain/reminders.py` (B8.7), and `renderReminder` in both languages in `lib/reminder-text.ts`.

**Accept:** every row of the B8.7 table passes.

### T3.2 Reminder service and cron

`services/reminders.py`, `GET /api/cron/reminders`, `backend/vercel.json`, and a timeline in S2. `backend/vercel.json` has no effect until Phase 8, so test the route locally by sending the `Authorization` header.

**Accept:** `test_reminders.py` passes. Cron without the secret gets 401.

### T3.3 S4 on real data

Django views for S4, and `lib/data/automation.ts`, which fills `body` with `renderReminder`. Sent, Upcoming, Stopped and Needs a call lists, message Drawer, `resolve_unmatched`, and queue Drawer.

**Accept:** every S4 control works. A resolved item shows who resolved it. Concurrent resolution returns an error rather than paying twice.

### T3.4 Demo controls

`set_demo_date`, `run_reminders_now`, `reset_demo`, `GET /api/cron/demo-reset`. Views refuse unless `DEMO_MODE=true`.

**Accept, the stop-on-payment proof, as an e2e test:**

1. Ishita's next reminder shows 9 Nov. Mohit's shows 8 Nov.
2. Ishita's balance is paid. That row now reads "Stopped: paid".
3. Date moves to 9 Nov, run reminders.
4. Mohit's parent gets the −7 message in Hindi. Nothing goes to Ishita's parent.
5. Reset restores everything.

**Phase 3 exit:** full security self-review: webhook, cron auth, OTP, internal key, access scope. Record findings in `docs/decisions.md` and fix them.

## Phase 4. Staff tools

### T4.1 Refund rule

`domain/refund.py` (B8.5).

**Accept:** all 11 rows pass.

### T4.2 Refund screen and states

`services/refunds.py`, Django views for `save_refund_draft`, `approve_refund` and `mark_refund_paid`, `lib/data/refund.ts`, and `/refund-policy` from `refund_policies`.

**Accept:** `test_refund.py` passes. Aarav with withdrawal date 2 Nov shows ₹18,986.31. An open queue item blocks approval, with a link. Approval stops reminders, and P2 shows the refund. **No editable amount exists: `e2e/controls.spec.ts` asserts this.**

### T4.3 Dashboard

A Django view using ORM aggregates over `instalment_balances`, and `lib/data/dashboard.ts`. A second view returns `StudentsVM` (S1b) for `lib/data/students.ts`, filtered, sorted and paged in the database, because there are 2,600 students.

**Before writing:** keep it to four tiles, a table and one bar per row. No other charts. Totals must reconcile.

**Accept:** the roster's counts and rows match S2 for named students, and respect centre scope. A test on a small hand-counted data set matches every bucket. Named-student totals match S2. All-centres totals equal the sum of centres. Paying ₹15,000 lowers the numbers by exactly ₹15,000. The page responds in under 2 s with 2,600 students, using the full seed for this check. The MLV-only user sees only MLV.

### T4.4 Exports

`dues.csv` and `receipts.csv` (B9), respecting centre scope.

**Accept:** both open as valid CSV. Totals match the dashboard. Fields that could start a spreadsheet formula (`=`, `+`, `-`, `@`) are prefixed with a single quote.

## Phase 5. AI

Fixtures are deleted by the end of this phase.

### T5.1 Score

`domain/risk.py` (B8.9) and `should_create_task`.

**Accept:** every row of both tables passes.

### T5.2 Risk job

`services/risk.py`, `GET /api/cron/risk`. Skip withdrawn students. Save flags, create tasks.

**Accept:** `test_risk_isolation.py` passes. Riya has a High task, Arjun is Watch with no task, Neha is under "Not enough data", and Ishita has no flag.

### T5.3 Call brief

Add `anthropic` to `requirements.txt`. Then `call_model`, `generate_brief` and `ensure_call_brief` exactly as in B8.9.

**Accept:** `test_risk_brief.py` passes. With a key set, one real brief is generated and read for sense, and its request contains no name, phone or code. Without a key, the template shows and the app works.

### T5.4 S5 on real data

Django views for S5, `close_task`, and `lib/data/counsellor.ts`.

**Accept:** every S5 control works. A false flag needs a note, closes the task, and changes the accuracy figure. Re-running the job does not re-create that task. An accounts session is refused.

### T5.5 Evaluation

`test_risk_eval.py`, and put results in `docs/TDD.md` marked as synthetic.

### T5.6 Remove fixtures

Delete `lib/fixtures/`, `lib/clock.ts` and the `proto` cookie code.

**Accept:** grep finds no references. All tests pass.

## Phase 6. Depth (optional)

Do these in order, and stop when you need to move on to Phase 7. **Anything not finished is removed from the interface, including its link or button, so nothing is left dead.**

| Task | What | Accept |
|---|---|---|
| T6.1 | **Attendance and scores in the parent portal.** Screen already built by Claude on sample data; only the Django view behind `lib/data/progress.ts` remains. The brief's portal asks for them, and the data exists. `/progress`, now the Academic info tab of the parent dashboard: attendance per recent week, recent test scores, no comparison with other students and no risk data | Parent sees only their child. Both languages. All states |
| T6.2 | **Bulk CSV upload per batch**, at `/staff/uploads`. Columns: `student_code,week_start,attended,held` and `student_code,test_date,test_name,score,max_score`. Uses File Upload (`npx boardui@latest add file-upload --yes`). Preview with row-level errors before anything saves. All or nothing. Rejects codes outside the chosen batch. Sample files in `public/samples/` | Bad rows are listed with line numbers. Good file saves. Re-upload updates rather than duplicates |
| T6.3 | **Tally XML export** of receipts, added to the export Button Group. An `ENVELOPE` import with one Receipt voucher per receipt. **Label it "not tested on a real Tally install"** in the TDD | XML is well-formed. Totals match the CSV |
| T6.4 | **Withdraw consent** link for parents. Sets `withdrawn_at`, hides data, stops reminders, adds the student to Needs a call | Test covers each effect |

## Phase 7. Finish

**Stop adding features.** Fix only what is broken.

### T7.1 Golden path and full sweep

`e2e/golden.spec.ts`. Run everything in B13 on a production build with the seeded dev database. Fix all failures.

### T7.2 Remove prototype tools

Delete `/proto`, the `?state=` helper, `NEXT_PUBLIC_PROTO` and any related code. Keep real loading, empty and error UI.

**Accept:** `/proto` is 404. All tests pass, with `layout.spec` now reaching states by real means where possible.

### T7.3 Final reviews

- Search history and files for secrets: `git log -p | grep -iE "sk-|password=|secret="`, plus a check that `.env.local` was never committed.
- Confirm `test_access.py` still walks every URL pattern and passes.
- Remove notes from `docs/progress.md` and `docs/decisions.md` that are about tools and not the product, such as notification sounds and model routing calls.
- Collect `LIMIT:` comments for the TDD's limits section.
- Re-run `npm run screens` and the T0.15 passes.
- Check `docs/third-party.md` is complete, and that no prompt text from `docs/inbox/` was committed.

### T7.4 Documents, ready except for the live link

- `docs/TDD.md` per D1, with screenshots. Use the placeholder `<LIVE_URL>` where the live link goes. If the human's Gate 0 results have not come yet, use `<GATE_0_RESULTS>` wherever the TDD depends on them, and never invent findings.
- `scripts/build-tdd.ts`: render it with `marked` to HTML, then to `dist/TDD.pdf` with Playwright's `page.pdf()`. Include the Hindi font.
- `dist/deployment.md` per D2, using the same placeholder. **It holds demo passwords, so it is not committed:** `dist/` is in `.gitignore`.

**Accept:** both documents exist, and the "Run locally" steps in D2 work on a fresh clone.

### Gate 7: Codex stops here

Development is finished. Tell the human: read the TDD and correct what you cannot defend, then start Phase 8 when ready.

## Phase 8. Deploy and hand in (later)

Starts only when the human says so. Nothing in Phases 0 to 7 depends on it.

### T8.1 The Vercel part (human)

The repo becomes two Vercel projects, because Next.js and Django build separately. Both redeploy on each push.

1. **Database.** Create a Neon Postgres project in the region nearest Mumbai. Copy its pooled connection string.
2. **Django project.** Import the GitHub repo into Vercel, and set Root Directory to `backend`. Add Production environment variables with new values: `DATABASE_URL` from step 1, `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS=.vercel.app`, `INTERNAL_API_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `CRON_SECRET`, `SEED_DEMO_PASSWORD` and `DEMO_MODE=true`. `ANTHROPIC_API_KEY` is optional. Deploy, then note its URL.
3. **Next.js project.** Import the same repo again, leaving Root Directory at the top. Add `BACKEND_URL` with the URL from step 2, the same `INTERNAL_API_SECRET` and `PAYMENT_WEBHOOK_SECRET`, and `DEMO_MODE=true`. Deploy, then set `APP_URL` to this project's URL and redeploy.
4. **Region.** In each project's Functions settings, choose Mumbai (`bom1`) if your plan offers it. Each page makes a call from Next.js to Django and from Django to the database, so distance adds up.
5. **Migrate and seed** the production database from your own terminal, not through Codex, so the connection string stays out of the session. Close the terminal afterwards:

```powershell
$env:DATABASE_URL="<production connection string>"; $env:SEED_DEMO_PASSWORD="<production demo password>"; npm run db:migrate; npm run db:seed
```

6. **Cron.** In the Django project's Cron Jobs settings, confirm the three jobs appear, and run `reminders` once by hand.

**Accept:** the reviewer's path (D2) works on the live URL in a private window, and the manual cron run returns 200. This setup comes from Vercel's documentation and has not been tried on this repo, so allow time to fix what comes up.

### T8.2 Final documents (Codex)

The human gives the live URL, or says there is none, and the demo password.

- Replace `<LIVE_URL>` in `docs/TDD.md` and `dist/deployment.md`. With no live app, remove that line from the TDD, because the brief asks for the link only "if you deployed it", and describe the deployment in `deployment.md` as planned, not as done.
- If any `<GATE_0_RESULTS>` placeholder is left, ask the human for the results first.
- Rebuild `dist/TDD.pdf`, and put the demo password in `dist/deployment.md` only. With no live app and no password, say reviewers use the value they set for `SEED_DEMO_PASSWORD`.
- Package from the `dist` folder:

```bash
npx bestzip submission.zip TDD.pdf deployment.md
```

**Accept:** the ZIP holds exactly two files and is at most 25 MB. The first lines of the TDD hold the GitHub URL and, if there is one, the live link.

### Gate 8: Codex stops here

Tell the human: read the final TDD, test the live app in a private window if there is one, confirm the repo is public and the history is intact, then upload. Do H8.

---

# Part D. Hand-in

## D1. TDD outline

1. **GitHub URL and live link, at the very top**
2. **Problem and business case.** The working below
3. **Architecture and why.** A Next.js frontend, a Django backend and Postgres. Give the human's own reason for choosing Django, and state the cost honestly: two apps to run and deploy, and an extra network call per page. Explain why the browser talks only to Next.js. What was rejected and why: a queue, a chart library, an auth library, Vercel Services (in beta)
4. **Data model.** From B7, grouped, with the rule that balance is never stored
5. **Main flows.** Pay, reminder, refund, flag. A short diagram for each
6. **How the AI works.** Signals, bands, unsure and wrong behaviour, guard rails, evaluation with its limits
7. **UI and design decisions.** Key screens with screenshots, and why each looks as it does, from `docs/prototype-notes.md`. Include what the five-second test changed
8. **Testing and security**
9. **Assumption register** (D3)
10. **What was cut and what comes next** (D4)
11. **Honest limits.** From `LIMIT:` comments and D5
12. **Outside UI sources and licences.** From `docs/third-party.md`, with why motion is limited

**Business case numbers, all recalculated:**

| Item | Working | Result |
|---|---|---|
| Billed per year | 2,600 × ₹1.2 lakh | ₹31.2 crore |
| Never collected | 2% | ₹62.4 lakh |
| Chasing cost | 8 staff at half time = 4 FTE × ₹4.2 lakh | ₹16.8 lakh |
| **Annual loss** | | **₹79.2 lakh** |
| Value over 60 days late | 12% of ₹31.2 crore | ₹3.74 crore |
| At the 6% target | | ₹1.87 crore |

The ₹79.2 lakh leaves out late money, so bringing ₹1.87 crore a year in on time is an extra cash-flow benefit on top. Payback on ₹6 lakh is about 1 month if all the loss is recovered and about 2 months if half is. Both exclude running costs such as gateway and message fees, which the brief does not give.

**How each success metric appears:**

| Client goal | Where it appears |
|---|---|
| Over-60-days value from 12% to 6% | Dashboard tile, against the target |
| Parent calls down 70% | **Cannot be measured in the app** without a call baseline. Portal use and pay-link payments are proxies. State this openly |
| Month-end reconciliation from 4 days to 1 | Unmatched queue size and export. Real proof needs a pilot |

**Rollout for the real 6 weeks:** pilot one centre, import from the fee software and Excel sheets, run alongside Tally for a month, then roll out to the other three.

## D2. `deployment.md` outline

1. **Run locally:** Node 22, Python 3.14, PostgreSQL 17. Clone, `npm ci`, create `.venv`, `pip install` from `backend/requirements.txt`, create the database, copy `.env.example` to `.env.local`, fill values, `npm run db:migrate`, `npm run db:seed`, then `npm run dev:api` in one terminal and `npm run dev` in another. **Test on a fresh clone.**
2. **Deployment:** two Vercel projects plus Neon, cron from `backend/vercel.json`, how migrations and seed are run.
3. **Environment variables:** names only, from B12.
4. **Demo logins:**

| Role | Sign in with |
|---|---|
| Parent of Ishita | +91 90000 00587 (first run shows consent) |
| Parent of Aarav | +91 90000 00412 |
| Parent of Mohit | +91 90000 00219 |
| Parent of 2 children | +91 90000 00777 |
| Accounts, all centres | `accounts@demo.test` and demo password |
| Accounts, MLV only | `accounts.mlv@demo.test` and demo password |
| Counsellor | `counsellor@demo.test` and demo password |

The OTP shows on screen in demo mode.

5. **Reviewer's 3-minute path:**
   1. Parent of Ishita: agree to consent, see ₹15,000 and 23 days overdue, pay on the mock gateway, get a GST receipt.
   2. Accounts, Automation: Ishita's 9 Nov reminder shows as stopped. Move the date to 9 Nov and run: nothing goes to Ishita's parent, while Mohit's 7-day reminder does go out, in Hindi.
   3. Dashboard: the numbers changed. Open a batch, then a student.
   4. Refund: withdraw Aarav with a withdrawal date of 2 Nov and see each line, ending at ₹18,986.31.
   5. Automation, Unmatched: resolve Kavya's wrong-amount payment.
   6. Counsellor: open Riya's task, read the reasons, mark an outcome.
   7. Reset demo to replay.

## D3. Assumption register

Copy into the TDD. Add anything from `docs/decisions.md` that assumes a client fact.

| # | Assumption | Why |
|---|---|---|
| A1 | JEE is 4 × ₹30,000, NEET is 3 × ₹40,000 | Sample amounts × instalment count = ₹1.2 lakh, the stated average, in the stated 3 or 4 instalments |
| A2 | Other due dates per B10, varying by centre | Extended from the sample rows. The brief says each centre keeps its own sheet |
| A3 | Earlier instalments of the 3 sample students were paid in full | The sample shows one row each |
| A4 | Session is 1 Apr 2026 to 31 Mar 2027 | Pro-rata needs dates |
| A5 | Refund Policy v1: daily pro-rata on net fee, no deductions, 10 calendar days | The written policy was not provided. The guideline says pro-rata within 10 days |
| A6 | Withdrawal date is the date written notice is received | It is objective, while attendance may stop earlier |
| A7 | GST is 18%, included in the fee, CGST and SGST split, sample GSTIN | The brief says only that receipts must show GST |
| A8 | Reminder steps −7, −3, 0, +3, +7, +15, +30, about 10:30 IST | "Before, on and after" with no specifics |
| A9 | Part payment continues reminders on the remaining balance | Stopping would leave money uncollected |
| A10 | "Today" is frozen at 2 Nov 2026 in demo mode | The sample data implies this date |
| A11 | A counsellor role is added | The brief has counsellors marking false flags |
| A12 | Students get no separate login | The core build names parent and accounts only |
| A13 | All students are treated as minors | Most are, and it is the safe default |
| A14 | Risk weights and thresholds are hand-set | No outcome data exists |
| A15 | Centre names, other batches, and all people are invented | Only 3 batches are given |
| A16 | Staff screens are English only | Hindi is raised for parents |
| A17 | Pay links work without sign-in | Fewer steps on low-end phones, minimal data shown |
| A18 | DPDP s.9(3) is an open question for the client's lawyer | Not covered by the brief, secondary sources only |
| A19 | "Over 60 days late" counts both unpaid and late-paid value, over all value past its due date | The brief gives the metric without a formula |
| A20 | Fee reminders before a parent's first sign-in rely on enrolment paperwork. Portal data waits for consent | A parent must first receive a message to reach the portal |
| A21 | Discounts are set at enrolment and split evenly across instalments | The brief lists discounts without rules |
| A22 | All 3 sample students are in the Malviya Nagar centre | The sample does not give a centre |
| A23 | Keeping 2 React Bits components inside this public application repo counts as use in an application, not redistribution | Its licence allows use in an application and bars redistributing components, but does not mention public repos. Not legal advice. To be confirmed before real client use |

## D4. Cut, and what comes next

| Cut | Why | Next |
|---|---|---|
| Real gateway, WhatsApp, SMS | The brief says mock | Razorpay test mode, WhatsApp templates, a real OTP provider |
| Real Tally link | The brief says mock | Test the XML on a real install with the client |
| Student login | Not in core | Share the parent portal views |
| Refund second approver and exceptions | One role in the core build | Add before going live, since it is a control on money |
| Cheque bounce and payment reversal | Not in the core build | Reversal entry, after which reminders resume by themselves |
| Dark mode | Not requested | BoardUI's tokens support it if ever needed |
| Trained risk model | No outcome data | Fit logistic regression after two terms of real outcomes |
| Offline support, push notifications | Not needed for the core | Only if real usage shows the need |

## D5. Limits to state openly

- Payments and messages are mocked, and nothing has been tested with a real provider.
- Risk scores are hand-set and untested on real students. Evaluation figures are synthetic.
- The Refund Policy is assumed, and the client's real text may change the rules.
- Tally XML is untested on a real install.
- Hindi was checked by one reader, not professionally reviewed.
- The app was tested on the devices available, not on a range of low-end phones.
- Reminder job capacity was tested only on seed volume, and must finish inside the function's 60-second limit.
- Each page adds a network call from Next.js to Django, and both can start cold on Vercel, so a first load after idle is slower than a single app would be.
- Django stores session keys as they are in `django_session`. A custom session backend could hash them.
- Outside components were adapted by hand, and the licence question in A23 is still open.

## D6. Interview preparation (for the human)

Be able to explain these without notes. The brief says the judgement must be yours, so read the code behind each one.

1. Why reminders are worked out at send time rather than queued
2. Why part payment continues reminders
3. The refund formula, the rounding direction and why, and Ishita's ₹3,986.31 by hand
4. Why there is no editable refund amount
5. Why a score decides and Claude only writes, and why no single signal can reach High
6. What happens when the flag is wrong and when it is unsure
7. The DPDP section 9(3) question
8. Why pay links skip sign-in, and how that stays safe
9. Why the prototype came first, and what the five-second test changed
10. The ₹79.2 lakh, and which success metric the app cannot prove
11. Where AI tools helped, and where you overruled them
12. Why parent screens have no animation library, and where motion earns its place

**Scoring map:**

| Area | Weight | Earned by |
|---|---|---|
| Quality of work | 50% | Phase 0 design, working money loop, all states, tests, clean commits |
| Problem solving | 30% | B8 rules, edge cases, frozen date, the risk split |
| Communication | 20% | TDD, labelled assumptions, honest limits, the 3-minute path |

---

# Appendix A. The brief, unchanged

## Assignment

**Your task.** A client has sent us the brief you pick below. Build the product, end to end, with a great UI and UX.

| You submit | One ZIP file with two files: your Technical Design Document (TDD) and a deployment.md |
|---|---|
| Time | 7 days from when this step opens |
| Work | Alone |

Build a small part really well instead of the whole scope badly. The "CORE BUILD" paragraph in your problem statement says which slice must work end to end.

**Use AI, and use it well.** AI tools are highly recommended. Use them to draft faster, test ideas, find gaps and polish your work, so that what you hand in is a more finished, specific outcome for this client and not a generic one. The judgement, the numbers and the final choices must still be yours. You will explain them in the interview.

**What to do.** Pick one problem statement from the ones shown to you. Then build it.

**Must have**

- The main flows in the brief work, on realistic sample data you create. No dead buttons
- Frontend, backend, a database and sign-in. Use roles if the brief has more than one kind of user
- The AI or automation part actually works, including what happens when it is wrong or unsure
- A polished UI: a consistent design, a layout that works on a phone, and loading, empty and error states
- Tests for the most important logic, and basic security: no secrets in the repository, validated inputs, access control

**How to submit.** Put these two files in one .zip (up to 25 MB) and upload it.

1. Technical Design Document (PDF or Word)
   - The GitHub URL of your project, at the top. Also add the link to the live app if you deployed it
   - The architecture and why you chose it
   - The data model, the main flows and how the AI part works
   - UI and design decisions: the key screens and why they look the way they do
   - What you cut, and what you would do next
2. deployment.md
   - How to run it locally, step by step
   - How it is deployed, and the environment variables it needs (names only, never the values)
   - Demo login details for the reviewer

**Rules**

- Use only the information in the problem statement. Label every assumption in your TDD
- Keep the commit history. We read it
- Do not put secrets or real personal data in the repository
- Keep the repository public until we have finished reviewing
- You can resubmit until the deadline; we review your latest version

**What great looks like**

- A product a client could try today
- Clean, readable code with a clear structure
- A UI that feels designed, not default
- Honest notes about the limits
- Extra depth, well-judged features beyond the core and careful edge cases count in your favour

**Common mistakes**

- A beautiful front end with nothing behind it
- Everything built, nothing working
- No sample data, so the app looks empty
- The AI part faked, or not handling mistakes
- A TDD with no GitHub URL

**How you'll be scored**

| Area | Weight |
|---|---|
| Quality of work | 50% |
| Problem solving | 30% |
| Communication | 20% |

## Problem statement: Coaching institute's fee tracking system and parent portal

Company A, Jaipur. Engineering and medical entrance coaching, 4 centres, 2,600 students, 140 staff, revenue ₹30–34 crore a year. Average fee ₹1.2 lakh a year, paid in 3 or 4 instalments.

**Today.** Centres record receipts in a desktop fee software and post totals to Tally. Due dates sit in an Excel sheet per centre. Staff phone parents to remind them, and parents call to ask balances. Test scores go out as PDFs in WhatsApp groups. Refunds are worked out by hand.

**The problem.** Assumptions: 2,600 × ₹1.2 lakh = ₹31.2 crore billed a year. 2% is never collected because follow-up is late and uneven: ₹62.4 lakh. 12% of instalment value arrives over 60 days late. 8 accounts staff spend half their time chasing dues: 4 full-time equivalents × ₹4.2 lakh = ₹16.8 lakh. Total ₹79.2 lakh a year.

**Users.** Parents (mobile), students, and centre accounts staff. The founder-director signs the deal.

**The ask.** Parents should know what they owe and when, without calling us. Reminders should go out on their own and stop the moment someone pays. I want one view of dues across all centres, by batch. Refunds must follow our written policy, not someone's calculator.

**Must have**

- Fee ledger per student: plan, instalments, discounts, payments, balance and days overdue
- Parent portal with OTP login: dues, receipts, attendance and test scores
- Automatic Hindi or English reminders before, on and after each due date, stopping on payment
- Payment link per instalment (gateway test mode) that marks it paid
- Pro-rata refund calculator, and an accounts dashboard by centre and batch with ageing and Tally export
- Bulk upload of attendance and test scores per batch

**Core build.** Software Engineering candidates must ship this slice end to end, in about 6 to 8 screens: fee ledger, parent portal with dues and pay link, reminders that stop on payment, refund calculator, and dues dashboard. Roles: parent and accounts executive. AI: dropout-risk flag. Hard part: instalment and pro-rata refund rules. Mock payments, messages and outside systems, and seed from the sample data. The rest of MUST HAVE is optional depth.

**Out of scope**

- Video lectures or a learning platform
- Timetables
- Admissions CRM

**AI or automation.** Reminders and payment matching are automated. An AI flag marks students at risk of dropping out from missed instalments, falling attendance and test trends. When it is wrong: the flag only creates a counsellor call task, never a fee action or parent message, and counsellors mark false flags. Unmatched payments go to an accounts queue instead of marking anything paid.

**Constraints.** The Ministry of Education's 2024 coaching guidelines require a published refund policy and a pro-rata refund within 10 days when a student leaves. Most students are minors, so the DPDP Act 2023 needs verifiable parental consent. Receipts must show GST. Parents use low-end phones; Hindi is required.

**Design.** The client values good, minimal design: clean layouts, white space, a restrained palette and clear type, with nothing on screen that lacks a purpose. Design counts as much as features. Parents should understand their dues in five seconds: amount, due date and a pay button, nothing more.

**Budget and time.** ₹6 lakh, 6 weeks. Success: value over 60 days late from 12% to 6% in two terms; parent calls about dues down 70%; month-end reconciliation from 4 days to 1.

**Sample data**

| Student ID | Name | Batch | Due Date | Amount ₹ | Paid ₹ | Status |
|---|---|---|---|---|---|---|
| STU-0412 | Aarav Meena | JEE 2027 Morning | 2026-10-10 | 30000 | 30000 | Paid |
| STU-0587 | Ishita Sharma | JEE 2027 Evening | 2026-10-10 | 30000 | 15000 | Part paid, 23 days overdue |
| STU-0219 | Mohit Gurjar | NEET 2027 Morning | 2026-11-15 | 40000 | 0 | Due in 13 days |
