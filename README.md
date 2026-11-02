# Coaching fees and parent portal

Project: https://github.com/UdaiBatta/isocode-coaching_tracker

A focused fee-tracking application for Company A, Jaipur. The core build covers parent dues and payment links, student ledgers, reminders that stop on payment, policy-based refunds, an accounts dashboard, and counsellor call tasks.

The selected stack is React and BoardUI in a Next.js frontend, with Django and PostgreSQL for the backend. The Django decision overrides the original Node backend proposal in `docs/PLAN.md`; see `docs/decisions.md`.

Current state: T0.1 scaffold only. The eight-screen prototype is next. No backend, database, real authentication or money flow has been implemented. Payments and messages will be mocked.

## Run the frontend

Use Node 22.12 or later:

```bash
npm ci
npm run dev
```

Open http://localhost:3000. No environment values are required for this scaffold. The first build downloads Inter and Noto Sans Devanagari; runtime font files are served locally.

## Check the frontend

```bash
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
```

The scaffold browser test checks 360 × 640 and 1280 × 800 layouts, Hindi font loading, the teal BoardUI action, security headers, console errors, serious accessibility findings and the source link. Unit tests start at T0.2; the temporary bootstrap test script allows an empty suite until then.

The original build specification is in `docs/PLAN.md`. `docs/progress.md` records the exact restart point. Backend implementation waits for prototype review at Gate 0.
