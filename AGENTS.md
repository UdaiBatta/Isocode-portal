# Coaching Fees

Spec: docs/PLAN.md. Progress: docs/progress.md. Decisions: docs/decisions.md.

Current job: docs/PROMPTS.md. In a new session or after a context summary, re-read it and docs/progress.md, then continue from the next unfinished task. Do not stop between tasks or phases.

## Project model routing

- Frontend (screens, components, styling, copy, frontend tests and the fixtures screens use): Claude Opus 5.5 on high effort, through the existing Claude chat for `D:\My projects\isocodelabs`. Keep its work in the `coaching-fees` checkout. Codex does not write frontend code.
- Backend (Django, PostgreSQL, services, jobs and APIs): Codex on GPT-6.1 Sol with high reasoning. Claude does not write backend code. This overrides the earlier default Luna/Jev routing for this project.
- Code review: Codex on GPT-6.1 Sol with high reasoning reviews every commit, including Claude's.
- Both models share the `coaching-fees` checkout. Before editing, read "In progress now" at the top of `docs/progress.md`, list your task and files there, stage only your own files, and clear your entry when you commit.
- This routing authorizes the required model handoffs; do not start unrelated agents or parallel implementation. Preserve existing changes and verify the actual diff and test results after each handoff.

## Active stack decision

Django 5.2 LTS on Python 3.14 and PostgreSQL owns authentication, permissions, validation, ORM, migrations, money transactions, reminders and risk scoring. Next.js 16 and React 19 with BoardUI render the frontend. This matches docs/PLAN.md; the old Node-backend override no longer applies. The human selected installed PostgreSQL 18 for local development only; CI uses PostgreSQL 17 per B13.

## Rules that always apply
- Money is integer paise. Never use floats for money. Display only through lib/format.ts.
- Balances are always calculated from allocations, never stored.
- Dates are datetime.date in Django and 'YYYY-MM-DD' strings in JSON. "Today" comes only from backend/fees/clock.py.
- In Python, never use round() for money or scores. B8 says what to use instead.
- backend/fees/domain/* is pure: no database, no clock, no network.
- backend/fees/domain/risk.py and backend/fees/services/risk.py must never import messaging, reminder, payment or ledger write code.
- Parent routes never return risk data. The accounts role never sees risk data.
- Counsellors never receive fee amounts.
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
- Label client assumptions and never add real personal data. Submission files and private design inputs stay ignored.
- Add task progress and unresolved limitations to docs/progress.md after each task.
- Development is local. Do not deploy or touch Vercel until the human starts Phase 8.
- Spec commands are for a Unix shell. In PowerShell, use the equivalents. If the sandbox blocks git, ask for approval.
- Django uses only SecurityMiddleware, SessionMiddleware and CommonMiddleware. CSRF middleware is intentionally off: Next.js server actions check Origin/Host, the browser cookie is sameSite=lax, and Django APIs require X-Internal-Key. Explain this boundary in the TDD.
- Domain rules are pure. Every production query and action checks role and student/centre scope in Django; never trust client role values.
- Both models list their files under In progress now before editing, preserve the other model's changes, and stage only their own work. No unrelated agents or cloud tasks.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- boardui:rules:start -->
# BoardUI design rules

This project uses BoardUI (React + Tailwind CSS v4, source-owned components under `components/`). These rules always apply when writing UI code. MCP tools are on demand; these rules are not optional context.

## Components first

- Before hand-building any UI element, check for an installed BoardUI component under `components/base/` and `components/application/`, and prefer it.
- Missing a component? Install it (BoardUI MCP `install_components`, or `npx boardui@latest add <name>`) instead of writing a lookalike.
- Import through the `@/` alias, e.g. `import { Button } from "@/components/base/buttons/button"`.

## Color: semantic tokens only

- Never use raw palette classes (`text-gray-500`, `bg-white`, `border-neutral-200`) or hex/oklch literals. Every color rides a BoardUI semantic token, which also makes dark mode automatic.
- Text: `text-text-primary`, `text-text-secondary`, `text-text-tertiary`, `text-text-placeholder`, errors `text-text-error-primary`.
- Surfaces: `bg-background-primary-default`, `bg-background-secondary-default` / `-hover`, `bg-background-tertiary-default`, page ground `bg-background-full`.
- Borders: `border-border-button-default` / `-hover`, hairlines `border-separator-border`, tables `border-border-table`, errors `border-border-error-default`.
- Icons: `text-foreground-icon-primary` through `text-foreground-icon-quaternary`.
- Charts: the `chart-1` … `chart-5` tokens (plus `-active` variants). CTAs and selection states: the `accent-50` … `accent-950` ramp.
- Dark mode flips tokens via the `.dark` class on `<html>`. Do not write `dark:` overrides with raw colors; if a token pair looks wrong in dark mode, pick a different token, not a literal.

## Typography: composite utilities only

- Use BoardUI's composite type utilities: `text-title-1-medium`, `text-title-2-medium`, `text-title-3-semibold`, `text-headline-medium`, `text-body-medium`, `text-body-regular`, `text-body-2-*`, `text-caption-1-semibold`, and friends. Each sets size, weight, line-height, and letter-spacing together.
- Never rebuild type by stacking `text-sm font-medium leading-5`; if a style seems missing, look in `styles/typography.css` before inventing one.

## Spacing and shape

- Stay on Tailwind's spacing scale (`gap-2`, `p-4`, `mt-6`); prefer flex/grid `gap` over per-child margins. Arbitrary values (`p-[13px]`) only when matching an existing BoardUI component exactly.
- Cards and panels: `rounded-3xl` with `border-border-button-default`. Inputs and menu rows: `rounded-md` to `rounded-xl`. Pills: `rounded-full`.

## Mechanics

- Direction: wrap the app (or a mixed-language region) in `DirectionProvider` from `@/components/foundations/direction/direction`, with an explicit BCP 47 `locale` (`ar`, `he`, `en-US`, `zh-CN`). Set matching `lang` and `dir` on `<html>` for full-app RTL. CSS `dir` alone does not configure React Aria keyboard navigation or portal placement. Use `useDirection()` for custom interactions and put its value on custom portal roots.
- Use logical styles: `ms`/`me`, `ps`/`pe`, `start`/`end`, `text-start`/`text-end`, `border-s`/`border-e`, `rounded-s`/`rounded-e`, and inline logical CSS properties. Mirror navigation/disclosure glyphs and horizontal drawer motion in RTL. Preserve physical coordinates for measured geometry, charts, canvas, and decorative art. Keep code, OTP digits, email addresses and URLs in explicit LTR regions; isolate mixed text with `<bdi>` or `dir="auto"`. Translating labels and formatting application data is separate from layout direction. See https://www.boardui.com/rtl.

- Internal vertical scroll regions must soften the top edge with a progressive blur and surface fade once scrolled, rather than sharply clipping content. Keep headers outside the scroll region. Use a stationary, `pointer-events-none`, `aria-hidden` overlay in a relative wrapper: a 24px masked 1px backdrop blur, a 16px masked 4px backdrop blur, and a gradient from the enclosing semantic surface token to transparent. Ramp each layer's opacity from 0 to 1 over the first 24px of scrolling; keep it invisible at scrollTop 0. Apply opacity to the individual layers, never the overlay parent (a translucent parent creates a backdrop root and can break blur at normal browser zoom). Verify top/reset, overflow, light/dark mode, and 100% zoom; preserve keyboard scrolling and do not blur the whole content area. The `scroll-fade` registry item ships this recipe as `ScrollFade` + `useScrollFade` (`@/components/foundations/scroll-fade/scroll-fade`); reuse it rather than rebuilding the layers.

- Merge classes with `cx()` from `@/utils/cx` (tailwind-merge aware of BoardUI's composite text styles). No string concatenation, no plain `clsx`.
- Icons come from `@remixicon/react`, passed as component references (`leadingIcon={RiAddLine}`), not rendered elements.
- Form components build on `react-aria-components`; extend the installed BoardUI form components rather than raw `<input>`/`<select>`.
- Focus states: `outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring`.

When unsure about a token, a component's API, or working example code, ask the BoardUI MCP server: `get_theme`, `get_component`, `get_usage_examples`.
<!-- boardui:rules:end -->
