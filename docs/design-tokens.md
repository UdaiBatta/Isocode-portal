# Design tokens

One product, two expressions. Both change only BoardUI's semantic tokens, in `styles/globals.css`, so components never need their own colours. The tokens sit on `<html>` through `:has()`, so modals, drawers and dropdowns rendered outside the page inherit them.

## Sources

- **Vintage Paper:** values read from the public registry entry `https://tweakcn.com/r/themes/vintage-paper.json` on 2026-11-04. The 21st.dev editor page itself returned no readable theme values to a plain request.
- **Dark dashboard screenshot:** the graphite, lime and orange values are the provisional ones from the human's brief. The Pinterest link only returned an application shell, so no values were measured from it.

## Parent: Vintage Paper (`.parent-surface`, `.paper-surface`)

| Token | Value | Source |
|---|---|---|
| Page ground | `oklch(0.9582 0.0152 90.2357)` | Vintage Paper background |
| Surface | `oklch(0.9914 0.0098 87.4695)` | Vintage Paper card |
| Quiet surface | `oklch(0.9239 0.019 83.0636)` | Vintage Paper muted |
| Hairlines | `oklch(0.8606 0.0321 84.5881)` | Vintage Paper border |
| Text | `oklch(0.3 0.0225 64.3)` | Vintage Paper foreground, darkened from L 0.376 |
| Secondary text | `oklch(0.44 0.0387 71.2)` | Vintage Paper muted foreground, darkened from L 0.539 for contrast |
| Action | Forest ramp, `#25502E` at 700 | The brief's "deep forest" |

Not taken from Vintage Paper, on purpose:

- **Its brown primary:** white text on it fails WCAG AA, so actions use forest.
- **Libre Baskerville and Lora:** the serif faces have no Devanagari, and they would add weight on low-end phones. Inter and Noto Sans Devanagari stay.
- **Its 4px radius:** BoardUI's own radius scale stays, so controls match across the product.

## Staff: dark operations (`.staff-surface`)

Builds on BoardUI's existing dark tokens, then sets these provisional values:

| Token | Value |
|---|---|
| Canvas | `#0C0D0D` |
| Panels | `#1C1E1D` |
| Quiet surface | `#282B29` |
| Text | `#F5F5F0` |
| Secondary text | `#A5ADA6` |
| Hairlines | `#343936` |
| Action and selection | Lime `#B8F84B`, with near-black text on it |
| Attention in charts | Orange `#FF9E25` |

Lime means selection, progress or success. Orange means pending attention. Neither is decoration.

## Shared rules

- Same type scale, spacing scale, buttons, inputs, chips and status words in both.
- Headers come from `StaffPageHeader`, staff panels from `StaffFrame`, and parent pages from `ParentShell`.
- Parents get hairline-separated sections like a statement. Staff get panels, because they scan many blocks at once. Neither nests cards inside cards.

## The ledger identity (2026-11-04)

The human called the earlier look bland, so the product now takes its look from the bahi-khata, the account book Indian institutes keep. Parents see a cloth-bound book by day; staff see the same book at night. These tokens and classes are at the end of `styles/globals.css`.

| Element | Parent | Staff |
|---|---|---|
| Cloth (`--ledger-cloth`) | `#1B3A26` | `#131514` |
| Foil (`--ledger-foil`) | `#E3CF9A` | `#B8F84B` |
| Ledger margin (`--ledger-margin`) | `#C9483B` | `#5C7D2E` |
| Stamp ink (`--ledger-ink`) | `#A32A1F` | `#FF7A95` |
| Paid ink (`--ledger-ink-paid`) | `#25502E` | `#B8F84B` |

- **Type:** Tiro Devanagari Hindi for headings and figures, because one face drawn for both scripts keeps Hindi and English matched. Inter and Noto Sans Devanagari stay for reading text. IBM Plex Mono sets staff figures.
- **Spine (`.ledger-spine`, `.staff-spine`):** the sidebar as a stitched cloth binding with a block-print flower (`.ledger-butti`). The flower is an original drawing, not copied from a named print.
- **Folio (`.ledger-folio`):** a ruled page with a red margin, used for what matters most on a screen.
- **Stamp (`.ledger-stamp`):** status as a rubber stamp. The stamp only ever shows a status the data already holds.
- **Seals (`.ledger-seals`):** instalments on a thread: filled when paid, half when part paid, a red ring when due, dashed when upcoming.
- **Slip (`.ledger-slip`):** a receipt with a perforated top edge.
- **Night tape (`.stat-tape`) and heat (`.ledger-heat`):** staff figures in one strip, and ageing cells that darken with their share of the column's largest value.
- **Marks line (`MarksChart`):** one series on a fixed 0 to 100% scale, server-rendered with no chart library.

