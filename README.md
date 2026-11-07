# Coaching fees and parent portal

Project: https://github.com/UdaiBatta/Isocode-portal

A focused fee-tracking application for Company A, Jaipur. The core build covers parent dues and payment links, student ledgers, reminders that stop on payment, policy-based refunds, an accounts dashboard, and counsellor call tasks.

The selected stack is React and BoardUI in a Next.js frontend, with Django and PostgreSQL for the backend. The Django decision overrides the original Node backend proposal in `docs/PLAN.md`; see `docs/decisions.md`.

Current state: Prompt 2 parent prototype is complete: bilingual phone/OTP and consent, dues, mock payment outcomes, payment results, GST receipts and the assumed refund policy. Staff screens are next. No backend, database, real authentication or money flow has been implemented. Payments and messages are simulated in a bounded per-browser cookie.

## Run the frontend

Use Node 22.12 or later:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Before starting, set `NEXT_PUBLIC_PROTO=1`, `DEMO_MODE=true` and `APP_URL=http://localhost:3000` in `.env.local`. In PowerShell, use `Copy-Item .env.example .env.local` for the copy step. Leave backend secrets empty for Phase 0. Open http://localhost:3000. The first build downloads Inter and Noto Sans Devanagari; runtime font files are served locally.

Start at `/login` with fictional parent phone `9000000587` and prototype OTP `123456`. Grant the sample consent, pay Ishita's remaining ₹15,000 with the mock gateway, then open and print the receipt. The gateway also offers failed and wrong-amount outcomes. `/dues` without a session shows the sample dues directly for prototype review; receipt details still require the linked prototype parent or scoped accounts role. These are demonstration controls, not production authentication.

## Check the frontend

```bash
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit tests cover formatting, translations, simulated state changes, receipt scope and the parent animation boundary. Browser tests check the parent sign-in-to-receipt flow, failure/review outcomes, 360 × 640 and 1280 × 800 layouts, Hindi fonts, security headers, console errors and serious accessibility findings. Browser QA uses port 3001 so it can run alongside the development preview on 3000. To capture existing routes and preview states, run `npm run start` and then `npm run screens` in another terminal; the script supplies sample payment and receipt routes.

The original build specification is in `docs/PLAN.md`. `docs/PROMPTS.md` supplies the current local-only execution sequence; Vercel is deferred until after development. `docs/progress.md` records the restart point. Backend implementation waits for prototype review at Gate 0.
