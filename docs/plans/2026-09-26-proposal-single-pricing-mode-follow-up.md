# Proposal pricing: one pricing mode — follow-up (deferred)

> **Status:** deferred to its own session on 2026-09-26. Two owner rulings are recorded below; one decision (Q1) is still open. **This amends the Wave 4 SOW normalization spec** (`docs/superpowers/specs/2026-09-24-wave-4-sow-normalization-design.md`), and its implementation plan must not be written until Q1 is closed and the amendment is folded into the spec.
> **Why this exists:** the owner says this was decided before, but the decision was never recorded and never built. The code still has two pricing modes, and the Wave 4 spec designs around both.
> **Origin:** the sales-calculators brainstorm (`docs/plans/2026-09-26-sales-calculators-epic.md`). Its per-scope pricing formulas are meant to become the way a SOW section gets its price (that epic's phase C4), which only works if section prices are the one path to the proposal price.

## 1. Owner rulings

| ID | Ruling | Date |
|---|---|---|
| **R1** | **A proposal's price has exactly one source: its SOW section prices.** `startingTcp = Σ sectionPrice + miscPrice`, and `finalTcp = startingTcp − discounts`, as today. There is no longer a "total" mode in which the rep types the starting TCP by hand. | 2026-09-25 |
| **R2** | **How the price is displayed stays the rep's choice, and that choice is display only.** The rep decides whether the homeowner sees each section's price or only the total. It is a yes/no flag (proposed name `show_section_prices`) and never affects the math. | 2026-09-26 |

## 2. What the code does today (checked 2026-09-26)

- `priceDisplayModes = ['total', 'breakdown']` (`src/shared/constants/enums/proposals.ts:31`), stored as `proposals.price_display_mode`. There are 72 references across 26 files: the proposal-flow form, funding, pricing-breakdown, the internal financials modal, the PDF (`src/shared/lib/pdf/proposal-doc-definition.ts`), the summary route, the financials façade (`src/shared/modules/proposals/core/lib/financials/compute-{totals,breakdown}.ts`), the SOW Zod refinement (`src/shared/modules/proposals/core/schemas/index.ts:182`), and the lock list (`src/shared/modules/proposals/core/lib/proposal-lock.ts`, `frozenProposalLockedFields`).
- "total" does two things, and R1/R2 separate them:
  - **Price source:** the starting TCP is typed by hand. R1 removes this.
  - **Display:** section prices are hidden from the homeowner. R2 keeps this as `show_section_prices = false`.
- `sectionPrice` is `z.number().nullable()`. Wave 4's `section_price_cents` is nullable as well. Under R1 a section with no price is still valid in a draft, but it blocks sending.

## 3. Production data (read-only count, 2026-09-26)

114 proposals in total. Every breakdown-mode proposal (47) has a price on every section. Total mode, split by the current lock ladder (`isProposalFrozen`):

| Status | Frozen | Count | Has unpriced sections | Typed starting TCP ≠ Σ sections + misc |
|---|---|---|---|---|
| approved | yes | 33 | 24 | 33 |
| declined | yes | 2 | 1 | 2 |
| draft | yes | 2 | 2 | 2 |
| sent | yes | 6 | 2 | 4 |
| declined | no | 9 | 4 | 8 |
| draft | no | 4 | 3 | 2 |
| sent | no | 11 | 9 | 11 |

So **24 unfrozen total-mode proposals** would silently change price the next time something triggers the rollup on them, and 43 frozen ones must never change.

## 4. Open decision

| ID | Question | Recommendation |
|---|---|---|
| **Q1** | What happens to legacy total-mode proposals? **A.** A frozen proposal's stored price is final and the rollup never runs on a frozen row. The migration sets `show_section_prices = false` on every total-mode row and recomputes nothing. Unfrozen rows keep their stored price until the next edit that affects price; after that the price follows the sections, `section-missing-price` blocks sending, and the editor shows a notice. **B.** The migration puts the gap (typed TCP − Σ priced sections) into `misc_price_cents`. This leaves an unexplained misc amount, and it fails wherever the gap is negative (`misc_price_cents` is `min(0)`). **C.** A person prices the 24 unfrozen proposals by hand before cutover, which blocks the cutover. | **A.** Nothing a homeowner has seen changes without anyone noticing, and "never recompute a frozen proposal" is correct regardless of this migration. |

## 5. Wave 4 spec sections this amends (fold in once Q1 closes)

| W4 § | Change |
|---|---|
| §3.5 | `price_display_mode` → `show_section_prices boolean NOT NULL` (backfill `total` → `false`, `breakdown` → `true`). The name needs R.5 sign-off. Drop `price_display_mode` under the column-drop protocol. |
| §7.3 | The create view's "display mode" column becomes the display flag. |
| §7.5 | `section-missing-price` becomes unconditional; remove "in breakdown mode". |
| §8 | `starting := COALESCE(SUM(section_price_cents), 0) + COALESCE(misc_price_cents, 0)` with no `CASE`. Add the frozen-row rule from Q1-A. The proposal `update.after` trigger list drops `priceDisplayMode`. `scripts/recompute-final-tcp.ts` follows. |
| §9 step 3 | Parity: the "breakdown / total mode" split is removed. Legacy total-mode rows are checked as "stored columns unchanged", not recomputed. |
| §10 | The smoke test's "recompute statement in breakdown and total mode" becomes "recompute statement; frozen row untouched". |
| §11 / §12 | Add `show_section_prices` to the names list, and add a ledger row for the `price_display_mode` drop. |
| Code (build) | Remove the typed-TCP input in total mode, the breakdown-only Zod refinement, and the financials façade's `pricingMode` branch in math. Renderers read `showSectionPrices` for display only. |

## 6. Next session

1. Close Q1.
2. Apply §5 to the Wave 4 spec, and remove its header pointer to this file.
3. Record R1 and R2 in `docs/ubiquitous-language.md` (TCP and Price rows).
4. Delete this file. Git keeps the history.
