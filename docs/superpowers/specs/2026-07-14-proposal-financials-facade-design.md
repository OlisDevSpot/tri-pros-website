# Proposal Financials Façade — Design

**Date**: 2026-07-14 (schema-era alignment pass 2026-07-15)
**Status**: Approved by Oliver (brainstorming session 2026-07-13/14); realigned against the JSONB decomposition program (`docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md`, ADR-0005 + Addenda) on 2026-07-15
**Supersedes**: the multiplier/margin formulas documented in `src/shared/entities/proposals/DOCS.md#margin-multiplier-tiers` (doc updated as part of this work)
**Coordinates with**: Epic #256 waves — Wave 0/1 merged; Wave 2 (`proposal_incentives`, `final_tcp_cents`) in flight; Wave 3 (SOW decomposition) pre-registered

## Problem

1. **The multiplier is computed wrong** at both levels:
   - Proposal level (`compute-proposal-cost-totals.ts`): `subtotal ÷ (jobCosts + incentives)` — treats incentives as a cost we absorb.
   - Section level (`compute-sow-financials.ts`): `sectionPrice ÷ sectionCost` — ignores section incentives entirely.

   Worked example (canonical): subtotal $27,000, incentives+discounts $10,000, job costs $6,000. Customer pays $17,000. Multiplier must be 17,000 ÷ 6,000 = **2.83x**. Current code yields 27,000 ÷ 16,000 = 1.69x.

2. **The math is scattered**: three separate lib files that partially re-inline each other's logic, plus the customer pricing breakdown re-implemented inline in three renderers (React component, PDF builder, plaintext summary route), plus ~5 smaller inline-math spots.

3. **The Internal Calculation UX is toggle-driven**: a persisted `funding.meta.showPricingBreakdown` flag gates an inline preview in the edit form; on the main proposal page the agent's internal block renders inline appended to the customer breakdown.

## Semantic model (the ruling)

**Incentives and discounts reduce what the customer pays; they are never something we pay.** Every derived financial metric follows from two sides:

```
PRICE SIDE (customer)                      COST SIDE (us)
subtotal (startingTcp)                     totalJobCosts (Σ cost-line amounts)
  − Σ section incentives
  − Σ global 'discount' incentives
  = finalTcp   (what the customer pays; clamped ≥ 0 — unchanged)

OUTPUTS
margin     = finalTcp − totalJobCosts      (numerically identical to before)
multiplier = finalTcp ÷ totalJobCosts      (CHANGED)
```

**Section level, same rule.** Section net price = `sectionPrice − Σ section incentives`:

- section margin = netPrice − sectionCost (numerically identical to before)
- section multiplier = **netPrice ÷ sectionCost** (changed)

**Global discounts are NOT allocated to sections** — they exist only at the proposal level. Consequence: Σ section margins ≥ total margin whenever global discounts exist. This asymmetry is intentional and documented.

**Killed concept**: `totalCosts` (`jobCosts + incentives`, "all costs the business absorbs") is deleted from the API. It encodes the wrong mental model and no consumer needs it once the multiplier is fixed.

**Unchanged**:
- Multiplier tier thresholds: `danger < 2x`, `healthy 2–3x`, `excellent ≥ 3x`, `unknown` when null. Confirmed ruling: thresholds were always intended for the correct formula; the old numbers were simply wrong.
- Null-safety: multiplier is `null` (not 0/Infinity) when cost is 0 or no cost lines exist; margin `null` when `sectionPrice` is null or no cost lines. `hasMissingCostData` asymmetric-incompleteness rule unchanged.
- `finalTcp` formula and name — unchanged (Zoho context, `final_tcp_cents` rollup, `recomputeProposalFinancials` all unaffected; no `calc_version` bump).
- Nothing persisted changes (except deleting the `showPricingBreakdown` key — see UI section). No DB migration.

## Schema-era alignment (JSONB decomposition program)

This façade must be written as a citizen of the decomposition program, not against the pre-waves world. The binding rules (ADR-0005 + Addenda, `docs/codebase-conventions/jsonb-columns.md`, ledger `docs/plans/jsonb-decomposition-deprecation-ledger.md`):

1. **The façade is the Stage-1 (draft) computation layer** of the three-stage derived-value lifecycle (ADR-0005 Addendum A): pure TS, compute-on-read, never persisted as truth. Its input is the **hydrated domain shape** — today that's the blob-shaped Zod types (`FundingSection['data']`, sow sections), sourced from RHF form state or from `getFullView` (which already re-hydrates `fundingJSON.data.incentives` from `proposal_incentives` rows). The façade **never reads raw DB rows and never contains SQL**.
2. **Persisted-read paths use the rollup, not TS recompute.** Consumers that read proposal rows for lists/reports/aggregation (proposals table `price` column, accounting invoice amounts, lead-source ROI, pipeline values) belong on `proposals.final_tcp_cents` — the Stage-2 rollup maintained by the single choke point `recomputeProposalFinancials`. `computeFinalTcp` stays exported **only** for draft-stage / hydrated-full-view contexts. Do not build anything against `finalTcpExpr` (dies in Wave 2 Task 7).
3. **Storage-agnostic interface.** `ProposalFinancials`, `SectionFinancials`, and `PricingBreakdown` expose no storage detail. When Wave 3 lands (`proposal_sow_items`, `proposal_cost_lines`, section incentives → `proposal_incentives.sow_item_id`, `starting_tcp_cents`), only the façade's input-mapping layer changes — consumers and interfaces hold. The façade is the single adaptation seam for Wave 3; that is a design goal, not a side effect.
4. **Money units**: the façade operates in whole dollars on the domain shape (unchanged UI/form convention). Integer-cents ↔ dollars conversion lives only at DAL mappers (`lib/incentive-rows.ts` precedent). No floats persisted; no cents in the façade API.
5. **No new persisted derived values.** Margin/multiplier/tier remain Stage-1 (agent-view volatile). `final_tcp_cents`'s formula is unchanged by this work → **no `calc_version` bump**. If margin/multiplier ever need list-column sort/filter, that is a future rollup added inside `recomputeProposalFinancials`, never new financial SQL elsewhere.
6. **Sequencing**: implement **after Wave 2 merges** (Wave 2's uncommitted work touches the same files: `dal/server/queries.ts`, `mutations.ts`, `server-spec.ts`, `proposals.router/index.ts`) and **before Wave 3** (so Wave 3 adapts one seam instead of ~14 call sites).
7. **Freeze gate**: the façade computes and displays; it never writes — so the `signingRequestId` financial-freeze check doesn't apply to it. The modal is display-only.

⚠️ **Hazard surfaced during this alignment (Wave 2 scope, not façade scope, recorded so it isn't lost)**: `accounting.service.ts` (QuickBooks invoice amount), `lead-sources.router.ts` (ROI stats), and both customer-pipelines DALs call `computeFinalTcp` over **raw proposal rows**, bypassing the `getFullView` hydration bridge; `listProposals`/`columns-registry` likewise. Once the in-flight incentives cutover ships (blob writers store `incentives: []`), these paths compute **overstated finalTcp** — discounts silently dropped from invoices and stats. They must move to `final_tcp_cents` (or the hydration bridge) as part of Wave 2 Task 7; verify before the façade work starts.

## Architecture: one façade module

All proposal money math consolidates under a single import surface, tied to the proposals entity:

```
src/shared/entities/proposals/lib/financials/
├─ index.ts              ← the ONLY import path consumers use
├─ compute-price-side.ts    finalTcp, discount/incentive sums (absorbs compute-final-tcp.ts)
├─ compute-section.ts       per-section cost/netPrice/margin/multiplier (absorbs compute-sow-financials.ts)
├─ compute-totals.ts        proposal-level aggregates (absorbs compute-proposal-cost-totals.ts)
├─ compute-breakdown.ts     NEW — customer-facing pricing-breakdown view-model
└─ tiers.ts                 MultiplierTier, getMultiplierTier, formatMultiplier
```

Internal files stay small and focused; `index.ts` is the façade. The three old flat files (`compute-final-tcp.ts`, `compute-sow-financials.ts`, `compute-proposal-cost-totals.ts`) are **deleted** and every consumer migrates to `@/shared/entities/proposals/lib/financials`.

### Public API

```ts
// The one big call — computes everything at once (pure, cheap, never persisted)
function computeProposalFinancials(input: {
  funding: FundingSection['data']
  sow: ProjectSection['data']['sow']
  pricingMode: 'total' | 'breakdown'
}): ProposalFinancials

interface ProposalFinancials {
  // price side
  subtotal: number                  // startingTcp
  totalSectionIncentives: number
  totalGlobalDiscounts: number
  totalIncentives: number           // section + global
  finalTcp: number                  // max(0, subtotal − totalIncentives)
  // cost side
  totalJobCosts: number
  // outputs
  margin: number                    // finalTcp − totalJobCosts
  multiplier: number | null         // finalTcp ÷ totalJobCosts; null when jobCosts === 0
  tier: MultiplierTier
  hasMissingCostData: boolean
  sections: SectionFinancials[]
  breakdown: PricingBreakdown       // customer-safe view-model (below)
}

interface SectionFinancials {
  title: string
  price: number | null              // raw sectionPrice
  incentives: number                // Σ section incentive amounts
  netPrice: number | null           // price − incentives
  jobCost: number
  margin: number | null
  multiplier: number | null         // netPrice ÷ jobCost
  tier: MultiplierTier
  hasCostLines: boolean
  hasIncentives: boolean
}

// Targeted exports for callers that don't have / don't need the whole proposal:
function computeFinalTcp(input: { funding; sow }): number   // kept — for draft-stage / hydrated-full-view contexts ONLY; raw-row list/report consumers read final_tcp_cents instead (see Schema-era alignment §2)
function computeSectionFinancials(section: { title: string, financials: SowFinancials }): SectionFinancials  // SOW editor live summary; same shape computeProposalFinancials uses to build `sections`
function getMultiplierTier(value: number | null): MultiplierTier
function formatMultiplier(value: number | null): string
```

Naming: `finalTcp` keeps its established name (DB expressions, Zoho context, DAL all use it).

### Customer pricing breakdown — computed once, rendered three times

`compute-breakdown.ts` produces a renderer-agnostic line-item model. It contains **only price-side data** — the type cannot express a cost/margin/multiplier leak, making the homeowner-safety invariant structural instead of per-renderer discipline:

```ts
interface PricingBreakdown {
  pricingMode: 'total' | 'breakdown'  // renderers hide per-section prices in total mode
  sections: {
    title: string
    price: number | null            // shown in breakdown pricing mode only
    incentives: { label: string, amount: number }[]
  }[]
  miscPrice: number | null
  subtotal: number
  globalLines: {
    label: string
    amount: number | null           // null for exclusive-offer (no amount)
    kind: 'discount' | 'exclusive-offer'
    expiresAt?: string
  }[]
  finalTcp: number
  deposit: number
}
```

The exact field list is refined during implementation against what the three renderers actually display today (strike-through discounts, offer lines, deposit rows) — the constraint that holds is: *price-side only, computed in one place*.

**Migrated renderers** (each becomes a pure renderer of `PricingBreakdown`):
1. `src/features/proposal-flow/ui/components/pricing-breakdown.tsx` — inline subtotal math (`startingTcp − totalSectionIncentives` at line ~108) dies.
2. `src/shared/lib/pdf/proposal-doc-definition.ts` `buildInvestment` — inline copy of section rows / subtotal / incentive branching dies.
3. `src/app/api/proposals/[proposalId]/summary/route.ts` — inline plaintext re-implementation dies.

## Consumer migration map

| Consumer | Change |
|---|---|
| `internal-calculation-block.tsx` | new façade call; new row layout (below); moves into modal |
| `section-financials-summary.tsx` | `computeSectionFinancials`; compact-mode reframe (below) |
| `sow-financials-fields.tsx` | import path only |
| `funding-fields.tsx` | import path; toggle removal (below) |
| `pricing-breakdown.tsx` | renders `PricingBreakdown` view-model |
| `proposal-doc-definition.ts` (PDF) | renders `PricingBreakdown` view-model |
| `summary/route.ts` | renders `PricingBreakdown` view-model |
| `columns-registry.tsx` | move to `final_tcp_cents` if Wave 2 Task 7 hasn't already; otherwise import path only |
| `funding.tsx` (homeowner Funding Summary) | import path only |
| `get-proposal-aggregates.ts` | Σ sectionPrice moves into the façade (used by the `startingTcp` sync effect) |
| zoho-sign `proposal-context.ts` | import path only |
| `accounting.service.ts`, `lead-sources.router.ts`, customer-pipelines DALs | move to `final_tcp_cents` (or hydrated reads) — coordinate with Wave 2 Task 7, do not double-implement; import path only if already migrated |
| `deal-structure-fields.tsx:261` | inline deposit-% → `computeDealDepositPercent` (meetings lib, already exists) |

## UI changes

### 1. Internal Calculation — reordered rows + the missing number

Rows tell the price-then-cost story and gain the Final Contract Price row (previously absent from the agent's own panel):

```
Subtotal                       $27,000
− Section Incentives           −$4,000
− Global Discounts             −$6,000
= Final Contract Price         $17,000   ← NEW
− Total Job Costs              −$6,000
= Total Margin                 $11,000
Multiplier                      2.83x    (tier-colored)
```

### 2. Internal Calculation moves into an agent-only modal

- **Delete** the persisted `funding.meta.showPricingBreakdown` schema field and its edit-form toggle. (JSONB key: removing it from the Zod schema means existing persisted values are stripped/ignored on next parse+write — no migration.) Bonus: shrinks the `fundingJSON` remainder that Wave 3's detail design must disposition.
- **Remove all inline rendering** of the internal calculation: the edit-form preview (`funding-fields.tsx:361`) and the agent-mode inline append on the main proposal page (`pricing-breakdown.tsx` `viewMode='agent'` branch).
- **Add one agent-only button** (consistent placement + affordance in both surfaces) that opens a modal containing the agent financial view — the pricing breakdown plus the Internal Calculation block. Available:
  - in the edit-proposal form, and
  - on the main proposal page.
- Gating: same mechanism that gates agent view today (CASL `update Proposal` via `use-view-mode` on the proposal page; the edit form is inherently agent-only). The homeowner can never see the button or the modal.
- The homeowner's inline customer `PricingBreakdown` in the Funding Summary is **unchanged**.

### 3. Section summary compact mode — honest rows

The compact "Total Costs" row (`cost + incentives`) encodes the killed concept. It becomes two rows: **Net Price** (`price − incentives`, when price present) and **Job Costs**. Full mode keeps inputs → separator → outputs, with outputs on the fixed formulas.

### 4. Styles dedup

`MULTIPLIER_STYLES` (tier → className map, duplicated verbatim in `internal-calculation-block.tsx` and `section-financials-summary.tsx`) moves to one shared location alongside the tier logic consumers.

## Docs updates

- `src/shared/entities/proposals/DOCS.md#margin-multiplier-tiers`: formula corrected to `finalTcp ÷ jobCosts` (proposal) / `netPrice ÷ jobCost` (section); tier table unchanged.
  - ⚠️ Stale ref fixed while here: doc names `classifyMultiplierTier`; code exports `getMultiplierTier`. Ruling: favor the code — the doc is updated.
- New DOCS.md anchor `#price-side-vs-cost-side`: the semantic model, the killed `totalCosts` concept, and the Σ-section-margins ≥ total-margin asymmetry (global discounts are proposal-level).
- `#final-tcp-derived` reference-impl pointer updated to the façade path.
- DOCS.md note for the modal: internal financials are agent-only, reachable via the modal button; no persisted display flag.
- ⚠️ Noted stale (owned by Wave 2 Task 9's docs truth-pass, not this work — recorded so it isn't lost): `DOCS.md:128` still says "no `final_tcp` column exists"; `final_tcp_cents` was added in Wave 2. Verify fixed before or during this work.

## Out of scope (explicit)

- **Meeting-domain** `compute-deal-derived.ts` — parallel implementation by design (different data shape, meeting incentives are all discounts). Untouched, except `deal-structure-fields.tsx` adopting its existing deposit-% helper.
- **`finalTcpExpr` SQL mirror** (`queries.ts`) — dying in Wave 2 Task 7 (replaced by `final_tcp_cents`). The façade neither touches nor depends on it.
- **`recomputeProposalFinancials` / `final_tcp_cents` rollup** — Wave 2's Stage-2 choke point; formula unchanged by this work, untouched.
- **Wave 3 SOW decomposition** (`proposal_sow_items`, `proposal_cost_lines`, section incentives → rows, `starting_tcp_cents`) — not this work; the façade is deliberately shaped so Wave 3 only swaps its input mapping.
- **`src/shared/lib/loan-calculations.ts`** — already canonical, untouched.
- **Tier threshold recalibration** — thresholds confirmed as-is.
- **New metrics** — none this round. Research backlog recorded below.

## Verification

No test runner exists in this repo yet (testing bootstrap is a separate pending effort — `docs/plans/2026-07-07-testing-bootstrap-handoff.md`). Verification for this work:

1. `pnpm tsc` + `pnpm lint` clean.
2. Worked example through `computeProposalFinancials`: subtotal 27,000 / incentives 10,000 / job costs 6,000 → finalTcp 17,000, margin 11,000, multiplier 2.83x, tier `healthy`.
3. Manual sweep of all three breakdown renderers (React, PDF, plaintext summary) against one real proposal — identical numbers, identical line items.
4. Manual check: homeowner view shows no button/modal; agent sees the button in both surfaces.
5. Rollup parity: for a hydrated proposal, `computeProposalFinancials(...).finalTcp === final_tcp_cents / 100` (extend/reuse `scripts/verify-final-tcp-parity.ts`).
6. Incentive-source check: façade numbers computed from a `getFullView` read reflect `proposal_incentives` rows (the hydration bridge), not the dead blob array.

The façade's pure functions are the **prime candidate for the app's early unit tests** once the testing practice bootstraps — flagged here for that effort.

## Deferred backlog — metric candidates (researched 2026-07-13, not in scope)

Full research grounded in the current data model; priorities from that session. None approved for this round.

| Metric | Formula | Audience | Needs new input? |
|---|---|---|---|
| Gross margin % | `margin ÷ finalTcp` | agent | no |
| Discount depth % | `totalIncentives ÷ subtotal` | agent | no |
| Discount headroom to danger tier | `finalTcp − 2 × totalJobCosts` | agent | no |
| Monthly payment surfaced on proposal/PDF | `amortizedMonthlyPayment(finalTcp − cashInDeal, …)` | homeowner | no |
| **CSLB deposit-cap compliance flag** | flag `deposit > min($1,000, 10% × finalTcp)` (CA B&P §7159) | agent | no — *note: schema's $1,000 default silently violates the cap on contracts < $10k; revisit soon* |
| "You Save" total + % | `totalIncentives`, `÷ subtotal` | homeowner | no |
| Markup % | `(multiplier − 1) × 100` | agent | no |
| Total of payments / interest cost | `monthly × term` | agent (+opt homeowner) | no |
| Section margin contribution / weakest section | `sectionMargin ÷ totalMargin` | agent | no |
| Margin erosion from incentives | `totalIncentives ÷ (subtotal − jobCosts)` | agent | no |
| Job cost ratio (COGS %) | `jobCosts ÷ finalTcp` | agent | no |
| Amount financed (named helper) | `max(0, finalTcp − cashInDeal)` | both | no |
| Cost-per-day framing | `monthly ÷ 30.4` | homeowner | no |
| Section share of price | `sectionPrice ÷ Σ sectionPrice` | both | no |
| Margin net of dealer fee | `margin − dealerFee% × amountFinanced` | agent | **yes**: `dealerFeePercent` on finance_options (biggest current blind spot — promo financing dealer fees run 8–25%) |
| Estimated commission | plan-dependent | agent | **yes**: commission plan per user |
| Net margin after overhead | `margin − overhead% × finalTcp` | agent | **yes**: overhead rate |
| Labor/material split | Σ by category | agent | **yes**: `category` on cost lines |
| Price per sqft | `finalTcp ÷ sqft` | both | **yes**: sqft |
| Estimated vs actual cost variance | `(actual − estimated) ÷ estimated` | agent | **yes**: actuals on Project |
