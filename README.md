# Coaching fees and parent portal

Project: https://github.com/UdaiBatta/isocode-coaching_tracker

A focused fee-tracking application for Company A, Jaipur. The core build covers parent dues and payment links, student ledgers, reminders that stop on payment, policy-based refunds, an accounts dashboard, and counsellor call tasks.

The selected stack is React and BoardUI in a Next.js frontend, with Django and PostgreSQL for the backend. The Django decision overrides the original Node backend proposal in `docs/PLAN.md`; see `docs/decisions.md`.

Current state: Prompt 1 shared code and fixture-backed data/actions. The eight-screen prototype is next. No backend, database, real authentication or money flow has been implemented. Payments and messages are simulated in a per-browser cookie.

## Run the frontend

Use Node 22.12 or later:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Before starting, set `NEXT_PUBLIC_PROTO=1`, `DEMO_MODE=true` and `APP_URL=http://localhost:3000` in `.env.local`. In PowerShell, use `Copy-Item .env.example .env.local` for the copy step. Leave backend secrets empty for Phase 0. Open http://localhost:3000. The first build downloads Inter and Noto Sans Devanagari; runtime font files are served locally.

## Check the frontend

```bash
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit tests cover formatting, translations and the simulated T0.3 state changes. Browser tests check 360 × 640 and 1280 × 800 layouts, Hindi font loading, the teal BoardUI action, security headers, console errors, serious accessibility findings and the source link. To capture existing routes and preview states, run `npm run start` and then `npm run screens` in another terminal. The later screen sweep will add dynamic-route examples.

The original build specification is in `docs/PLAN.md`. `docs/PROMPTS.md` supplies the current local-only execution sequence; Vercel is deferred until after development. `docs/progress.md` records the restart point. Backend implementation waits for prototype review at Gate 0.
