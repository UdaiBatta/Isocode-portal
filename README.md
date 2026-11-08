# Coaching fees and parent portal

Project: https://github.com/UdaiBatta/Isocode-portal

Parents see dues, pay through a mock gateway and receive GST receipts. Accounts manages ledgers, reminders, refunds, reconciliation, academic uploads and exports. Counsellors see support tasks without fee amounts. Admin maintains audited master records.

Next.js 16, React 19 and BoardUI render the frontend. Django 5.2 LTS on Python 3.14 owns sessions, permissions, validation and transactions; PostgreSQL stores the ledger. Sessions and permissions are real. Money, OTP delivery and outbound messages are mocked.

## Run locally

Use Node 22.12+, Python 3.14 and PostgreSQL 17 (local verification also uses 18). Create a dedicated demo database; browser tests reset its named examples. In PowerShell:

```powershell
npm ci
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r backend/requirements-dev.txt
createdb -U postgres coaching_fees_review
Copy-Item .env.example .env.local
```

Fill the ignored environment file with:

- `DATABASE_URL` for that database.
- Independently generated `DJANGO_SECRET_KEY`, `INTERNAL_API_SECRET`, `PAYMENT_WEBHOOK_SECRET` and `CRON_SECRET`.
- Your own `SEED_DEMO_PASSWORD`.
- `DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1`, `DJANGO_DEBUG=true`, `DEMO_MODE=true`.
- `BACKEND_URL=http://127.0.0.1:8000`, `APP_URL=http://localhost:3000`.

`ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` are optional. Without a key, call briefs use the template. Do not commit environment files.

```powershell
npm run db:migrate
npm run db:seed
npm run dev:api
```

In another terminal run `npm run dev`, then open http://localhost:3000. The first build downloads Google font files; runtime serves them locally. Unix users can use `.venv/bin/python` and `cp` for equivalent steps.

At `/login`, use fictional parent phone `9000000587`; demo mode shows the generated OTP. Grant consent, pay Ishita's INR 15,000, then open/print the receipt. Staff sign in at `/staff/login` with `accounts@demo.test`, `accounts.mlv@demo.test`, `counsellor@demo.test` or `admin@demo.test`, using the password you set.

## Verify and capture

```powershell
npm run check
npx playwright install chromium
$env:NEXT_DIST_DIR=".next-e2e"
$env:APP_URL="http://127.0.0.1:3001"
npm run build
npm run test:e2e
```

The check runs lint, types, Vitest, Ruff, Django system checks and PostgreSQL-backed tests. The database role needs permission to create its test database. Playwright starts Next.js on :3001 and Django on :8000; leave those ports free and use a dedicated demo database. The golden journey covers Hindi OTP/consent/payment/receipt and accounts reconciliation, alongside layout, scope, accessibility, script-budget and reduced-motion checks.

For screenshots, start Django on :8000 and `npm run start -- --hostname 127.0.0.1 --port 3001`, then `npm run screens`. It uses real sessions and saves normal states in both languages/widths. The payment-result screenshot is pending; paid results have separate browser coverage.

After the production build and screenshots, run `npx tsx scripts/build-tdd.ts --no-live`. The PDF embeds Hindi fonts and images. Omit `--no-live` only after resolving the source live-URL and human-result placeholders. `dist/` stays ignored.

Current design/limits: `docs/TDD.md`. Current status: `docs/progress.md`. Specification: `docs/PLAN.md`. Prototype notes and Gate 0 records describe the earlier design stage. No deployment or real-phone, Hindi-reader or five-second human test is claimed.
