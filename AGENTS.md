# Coaching Fees

Spec: docs/PLAN.md. Progress: docs/progress.md. Decisions: docs/decisions.md.

Current job: docs/PROMPTS.md. In a new session or after a context summary, re-read it and docs/progress.md, then continue from the next unfinished task. Do not stop between tasks or phases.

## Project model routing

- User override: send frontend fixes, changes and improvements to the existing Claude chat for `D:\My projects\isocodelabs`. Keep its work inside this folder and use the `coaching-fees` checkout; do not route it to another project or worktree.
- Use GPT-6.1 Sol with high reasoning for backend and other implementation work. This overrides the earlier default Luna/Jev routing for this project.
- This routing authorizes the required model handoffs; do not start unrelated agents or parallel implementation. Preserve existing changes and verify the actual diff and test results after each handoff.

## Active stack decision

The human selected React + BoardUI with a Django + PostgreSQL backend. Next.js is the frontend scaffold only. Django owns production authentication, permissions, validation, ORM, migrations, money transactions, reminders and risk scoring. This overrides the Node backend, Drizzle, pg and PGlite instructions in PLAN.md. Preserve all B8 expected values when translating to Python. Read docs/decisions.md before implementing a phase.

## Rules that always apply

- Build Phase 0 first. No database, API or real sign-in implementation until the Gate 0 checks that Codex runs have passed.
- Money is integer paise. Display through lib/format.ts. Balances are calculated from allocations, never stored.
- Dates are YYYY-MM-DD strings. Today comes from one clock module. Domain rules are pure, without database, clock or network access.
- Risk code cannot import messaging, payment, reminder or ledger write code. Parents and accounts never receive risk data; counsellors never receive fee amounts.
- Every production query and action checks session role and student/centre scope on the Django server. Use Django sessions and CSRF protection; never trust client role values.
- All parent-facing copy goes through lib/i18n in Hindi and English. Every screen has loading, empty and error states, accessible controls and touch targets; no hover-only behaviour.
- Use real, free BoardUI components and semantic tokens. Never build lookalikes or run shadcn init. Keep the generated BoardUI rules below.
- React Bits, 21st.dev and MotionSites are limited to PLAN.md B3a. Log imported material in docs/third-party.md. Parent routes use CSS only; respect reduced motion and never split Hindi letters.
- Do tasks in order. Read only the current task's sections. No parallel agents or cloud tasks unless the human asks. After three failed attempts at the same problem, record it and ask.
- Run npm run check before each task commit. Commit messages start with the task ID. Never squash or force-push. Add task progress and unresolved limitations to docs/progress.md.
- Label client assumptions. Never put real personal data or secrets in the repo. .env.example holds names only. Submission files and private design inputs stay ignored.

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
