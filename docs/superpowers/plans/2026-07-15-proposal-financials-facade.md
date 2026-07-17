# Proposal Financials Façade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the multiplier formula (finalTcp ÷ jobCosts, not subtotal ÷ (jobCosts+incentives)), consolidate ALL proposal money math into one façade module at `src/shared/entities/proposals/lib/financials/`, render the customer pricing breakdown from one shared view-model (React + PDF + summary route), and move the agent-only Internal Calculation into a modal behind a button (killing the persisted `showPricingBreakdown` toggle).

**Architecture:** A façade module (`lib/financials/`, one import surface, small internal files) is the Stage-1 (draft) computation layer per ADR-0005 Addendum A: pure TS over the hydrated domain shape, never reads DB rows, never contains SQL. Persisted-read paths already use the `final_tcp_cents` rollup (Wave 2) and are untouched. The façade interfaces are storage-agnostic so Wave 3 (SOW decomposition) swaps only the input mapping.

**Tech Stack:** Next.js 15, TypeScript, Zod (existing schemas), React Hook Form, shadcn/ui, pdfmake (existing PDF builder), zustand modal store.

**Spec:** `docs/superpowers/specs/2026-07-14-proposal-financials-facade-design.md` — read it first.

## Global Constraints

- **Precondition**: Wave 2 (epic #256, branch `feat/262-wave-2-child-tables`) must be **merged to main** before starting. Verify: `git log --oneline main | head -20` shows the incentives-to-rows flip (commit message contains "flip incentives to rows"), and `grep -rn "finalTcpExpr" src` returns nothing. Execute this plan on `main` (this repo works on main; stage explicitly by path, never `git add -A`).
- **Verification commands**: `pnpm tsc` and `pnpm lint` only. **NEVER run `pnpm build`.** No test runner exists in this repo — worked-example verification uses `pnpm tsx scripts/verify-financials-facade.ts` (created in Task 4).
- **Money units**: whole dollars everywhere in the façade and UI. Integer cents exist only at the DAL/DB boundary (not touched by this plan).
- **Formulas (the ruling)**: `finalTcp = max(0, startingTcp − Σ global 'discount' incentives − Σ ALL section incentives)` (unchanged). `margin = finalTcp − totalJobCosts`. `multiplier = finalTcp ÷ totalJobCosts` (null when jobCosts is 0). Section: `netPrice = sectionPrice − Σ section incentives`; `sectionMultiplier = netPrice ÷ sectionCost` (null when no price, no cost lines, or cost is 0). Tier thresholds unchanged: danger < 2x, healthy 2–3x, excellent ≥ 3x, unknown when null.
- **Never persist derived values** introduced here (margin/multiplier/tier are compute-on-read). `final_tcp_cents` and `recomputeProposalFinancials` are NOT touched; no `calc_version` bump.
- **Homeowner safety**: the `PricingBreakdownModel` view-model contains price-side data only — never cost lines, margin, or multiplier.
- **Coding conventions** (enforced — see `memory/coding-conventions.md`): named exports only; one React component per file; no file-level constants in component files (they go in `constants/`); prefer shadcn components; entity code lives in `shared/entities/proposals/`; `shared/` never imports from `features/`.
- **Path alias**: `@/` → `src/`. Package manager: pnpm.
- **Commits**: one per task, message style `feat(proposals): …` / `refactor(proposals): …` / `docs(proposals): …`, ending with the Claude co-author trailer if committed by an agent.

## File Structure (end state)

```
src/shared/entities/proposals/lib/financials/
├─ index.ts                  ← façade: the ONLY import path consumers use
├─ tiers.ts                  ← MultiplierTier, getMultiplierTier, formatMultiplier
├─ compute-price-side.ts     ← computeFinalTcp, computeTotalDiscounts, computeTotalSectionIncentives, computeTotalSectionPrices
├─ compute-section.ts        ← SectionFinancials, computeSectionFinancials
├─ compute-breakdown.ts      ← PricingBreakdownModel, buildPricingBreakdown
└─ compute-totals.ts         ← ProposalFinancials, computeProposalFinancials

src/shared/entities/proposals/constants/multiplier-styles.ts   ← shared tier→className map
src/features/proposal-flow/ui/components/internal-financials-modal.tsx  ← NEW agent-only modal
scripts/verify-financials-facade.ts                            ← worked-example self-check

DELETED at Task 11:
src/shared/entities/proposals/lib/compute-final-tcp.ts
src/shared/entities/proposals/lib/compute-sow-financials.ts
src/shared/entities/proposals/lib/compute-proposal-cost-totals.ts
```

---

### Task 1: Façade skeleton — tiers + price side

**Files:**
- Create: `src/shared/entities/proposals/lib/financials/tiers.ts`
- Create: `src/shared/entities/proposals/lib/financials/compute-price-side.ts`
- Create: `src/shared/entities/proposals/lib/financials/index.ts` (partial — grows in later tasks)

**Interfaces:**
- Consumes: `FundingSection`, `ProjectSection` from `@/shared/entities/proposals/types`
- Produces: `MultiplierTier`, `getMultiplierTier(value: number | null): MultiplierTier`, `formatMultiplier(value: number | null): string`, `computeTotalDiscounts(funding: FundingSection['data']): number`, `computeTotalSectionIncentives(sow: ProjectSection['data']['sow']): number`, `computeTotalSectionPrices(sow: ProjectSection['data']['sow']): number`, `computeFinalTcp(input: { funding: FundingSection['data'], sow: ProjectSection['data']['sow'] }): number`

- [ ] **Step 1: Create `tiers.ts`** (logic moved verbatim from `compute-sow-financials.ts:62-85` — do NOT delete the old file yet)

```ts
// src/shared/entities/proposals/lib/financials/tiers.ts

// see ../../DOCS.md#margin-multiplier-tiers
export type MultiplierTier = 'danger' | 'healthy' | 'excellent' | 'unknown'

export function getMultiplierTier(value: number | null): MultiplierTier {
  if (value == null) {
    return 'unknown'
  }
  if (value < 2) {
    return 'danger'
  }
  if (value >= 3) {
    return 'excellent'
  }
  return 'healthy'
}

export function formatMultiplier(value: number | null): string {
  if (value == null) {
    return '—'
  }
  return `${value.toFixed(2)}x`
}
```

- [ ] **Step 2: Create `compute-price-side.ts`** (absorbs `compute-final-tcp.ts`; adds `computeTotalSectionPrices`, previously inlined in `get-proposal-aggregates.ts:11-13`)

```ts
// src/shared/entities/proposals/lib/financials/compute-price-side.ts
import type { FundingSection, ProjectSection } from '@/shared/entities/proposals/types'

/**
 * Price side of the proposal financial model — what the customer pays.
 *   finalTcp = max(0, startingTcp − Σ global 'discount' incentives − Σ ALL section incentives)
 * Incentives and discounts reduce the PRICE; they are never a cost we absorb.
 * Never persisted (Stage-1 draft math per ADR-0005 Addendum A); the Stage-2
 * rollup lives in `proposals.final_tcp_cents`. see ../../DOCS.md#final-tcp-derived
 */
export function computeTotalDiscounts(data: FundingSection['data']): number {
  return data.incentives.reduce((sum, inc) => {
    return inc.type === 'discount' ? sum + inc.amount : sum
  }, 0)
}

export function computeTotalSectionIncentives(sow: ProjectSection['data']['sow']): number {
  return sow.reduce(
    (sum, section) => sum + (section.financials.incentives ?? []).reduce((s, inc) => s + inc.amount, 0),
    0,
  )
}

/** Σ sectionPrice across sections (breakdown pricing mode's subtotal input). */
export function computeTotalSectionPrices(sow: ProjectSection['data']['sow']): number {
  return sow.reduce((sum, section) => sum + (section.financials.sectionPrice ?? 0), 0)
}

export interface FinalTcpInputs {
  funding: FundingSection['data']
  sow: ProjectSection['data']['sow']
}

export function computeFinalTcp({ funding, sow }: FinalTcpInputs): number {
  return Math.max(
    0,
    funding.startingTcp - computeTotalDiscounts(funding) - computeTotalSectionIncentives(sow),
  )
}
```

- [ ] **Step 3: Create `index.ts`**

```ts
// src/shared/entities/proposals/lib/financials/index.ts
// Façade for ALL proposal money math. This is the ONLY module consumers
// import from. see ../../DOCS.md#price-side-vs-cost-side
export * from './compute-price-side'
export * from './tiers'
```

- [ ] **Step 4: Verify**

Run: `pnpm tsc`
Expected: exit 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/entities/proposals/lib/financials/
git commit -m "feat(proposals): financials façade skeleton — tiers + price-side helpers"
```

---

### Task 2: Section financials — the fixed section multiplier

**Files:**
- Create: `src/shared/entities/proposals/lib/financials/compute-section.ts`
- Modify: `src/shared/entities/proposals/lib/financials/index.ts`

**Interfaces:**
- Consumes: `SowFinancials` from `@/shared/entities/proposals/schemas`; `getMultiplierTier` from `./tiers`
- Produces: `SectionFinancialsInput { title: string, financials: SowFinancials }`, `SectionFinancials { title, price, incentives, netPrice, jobCost, margin, multiplier, tier, hasCostLines, hasIncentives }`, `computeSectionFinancials(section: SectionFinancialsInput): SectionFinancials`

- [ ] **Step 1: Create `compute-section.ts`**

```ts
// src/shared/entities/proposals/lib/financials/compute-section.ts
import type { MultiplierTier } from './tiers'
import type { SowFinancials } from '@/shared/entities/proposals/schemas'
import { getMultiplierTier } from './tiers'

export interface SectionFinancialsInput {
  title: string
  financials: SowFinancials
}

export interface SectionFinancials {
  title: string
  /** Raw sectionPrice (null in total pricing mode) */
  price: number | null
  /** Σ section incentive amounts */
  incentives: number
  /** price − incentives — what the customer pays for this section */
  netPrice: number | null
  /** Σ cost-line amounts — what we pay */
  jobCost: number
  /** netPrice − jobCost. Null when price is null or no cost lines. */
  margin: number | null
  /** netPrice ÷ jobCost. Null when price is null, no cost lines, or jobCost is 0. */
  multiplier: number | null
  tier: MultiplierTier
  hasCostLines: boolean
  hasIncentives: boolean
}

/**
 * Section-level financials. Same ruling as the proposal level: incentives
 * reduce the section's price, never its cost. Null (not 0) means "no
 * signal" — see ../../DOCS.md#margin-multiplier-tiers
 */
export function computeSectionFinancials({ title, financials }: SectionFinancialsInput): SectionFinancials {
  const costLines = financials.costLines ?? []
  const sectionIncentives = financials.incentives ?? []

  const price = financials.sectionPrice
  const incentives = sectionIncentives.reduce((sum, inc) => sum + inc.amount, 0)
  const jobCost = costLines.reduce((sum, line) => sum + line.amount, 0)
  const hasCostLines = costLines.length > 0

  const netPrice = price == null ? null : price - incentives
  const margin = netPrice == null || !hasCostLines ? null : netPrice - jobCost
  const multiplier = netPrice == null || !hasCostLines || jobCost === 0 ? null : netPrice / jobCost

  return {
    title,
    price,
    incentives,
    netPrice,
    jobCost,
    margin,
    multiplier,
    tier: getMultiplierTier(multiplier),
    hasCostLines,
    hasIncentives: sectionIncentives.length > 0,
  }
}
```

- [ ] **Step 2: Add to `index.ts`**

```ts
export * from './compute-section'
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/proposals/lib/financials/
git commit -m "feat(proposals): computeSectionFinancials — section multiplier nets section incentives"
```

---

### Task 3: Customer pricing-breakdown view-model

**Files:**
- Create: `src/shared/entities/proposals/lib/financials/compute-breakdown.ts`
- Modify: `src/shared/entities/proposals/lib/financials/index.ts`

**Interfaces:**
- Consumes: `computeFinalTcp`, `computeTotalSectionIncentives` from `./compute-price-side`
- Produces: `BreakdownSectionLine`, `BreakdownGlobalLine`, `PricingBreakdownModel`, `PricingBreakdownInput`, `buildPricingBreakdown(input: PricingBreakdownInput): PricingBreakdownModel`

Design note: the model carries **price-side data only** (structural homeowner safety) and enough resolved lines that the three renderers (React component, PDF, plaintext summary) do zero math — they only choose layout. It intentionally carries BOTH `subtotal` (= startingTcp, used by PDF/summary which list section incentives as separate discount rows) and `netSubtotal` (= startingTcp − section incentives, used by the React breakdown Subtotal row where section incentives render inline per-section).

- [ ] **Step 1: Create `compute-breakdown.ts`**

```ts
// src/shared/entities/proposals/lib/financials/compute-breakdown.ts
import type { FundingSection, ProjectSection } from '@/shared/entities/proposals/types'
import { computeFinalTcp, computeTotalSectionIncentives } from './compute-price-side'

export interface BreakdownSectionLine {
  title: string
  /** Original (pre-incentive) section price. Only sections with price > 0 appear. */
  price: number
  incentives: { id: string, label: string, amount: number }[]
  /** price − Σ incentives */
  netPrice: number
}

export interface BreakdownGlobalLine {
  key: string
  kind: 'discount' | 'exclusive-offer' | 'section-discount'
  /** Resolved display label (fallbacks applied). */
  label: string
  /** Dollar amount; null for exclusive-offer lines (rendered as "Included"). */
  amount: number | null
  /** Raw notes — discounts: same text the label resolved from; offers: supplemental text. */
  notes?: string
  expiresAt?: string
}

export interface PricingBreakdownModel {
  pricingMode: 'total' | 'breakdown'
  /** Breakdown mode: priced sections with incentives resolved. Empty in total mode. */
  sections: BreakdownSectionLine[]
  /** Breakdown-mode misc price; null when absent or 0. */
  miscPrice: number | null
  /** startingTcp — the pre-discount contract price. */
  subtotal: number
  /** subtotal − Σ section incentives. */
  netSubtotal: number
  /** Global funding incentives (discounts + exclusive offers), in stored order. */
  globalLines: BreakdownGlobalLine[]
  /** Section incentives flattened into standalone discount lines. */
  sectionIncentiveLines: BreakdownGlobalLine[]
  finalTcp: number
  deposit: number
  cashInDeal: number
}

export interface PricingBreakdownInput {
  funding: FundingSection['data']
  sow: ProjectSection['data']['sow']
  pricingMode: 'total' | 'breakdown'
}

/** Computed ONCE; rendered by the React component, the PDF builder, and the summary route. */
export function buildPricingBreakdown({ funding, sow, pricingMode }: PricingBreakdownInput): PricingBreakdownModel {
  const sections: BreakdownSectionLine[] = pricingMode === 'breakdown'
    ? sow
        .map((section, i) => ({ section, title: section.title || `Section ${i + 1}` }))
        .filter(({ section }) => (section.financials.sectionPrice ?? 0) > 0)
        .map(({ section, title }) => {
          const incentives = (section.financials.incentives ?? []).map(inc => ({
            id: inc.id,
            label: inc.label || 'Discount',
            amount: inc.amount,
          }))
          const price = section.financials.sectionPrice!
          const incentiveTotal = incentives.reduce((sum, inc) => sum + inc.amount, 0)
          return { title, price, incentives, netPrice: price - incentiveTotal }
        })
    : []

  const globalLines: BreakdownGlobalLine[] = funding.incentives.map((inc, i) =>
    inc.type === 'discount'
      ? {
          key: `discount-${i}`,
          kind: 'discount' as const,
          label: inc.notes || 'Discount',
          amount: inc.amount,
          notes: inc.notes,
          expiresAt: inc.expiresAt,
        }
      : {
          key: `offer-${i}`,
          kind: 'exclusive-offer' as const,
          label: inc.offer || 'Exclusive Offer',
          amount: null,
          notes: inc.notes,
          expiresAt: inc.expiresAt,
        },
  )

  const sectionIncentiveLines: BreakdownGlobalLine[] = sow.flatMap((section, i) =>
    (section.financials.incentives ?? []).map(inc => ({
      key: inc.id,
      kind: 'section-discount' as const,
      label: inc.label || `${section.title || `Section ${i + 1}`} discount`,
      amount: inc.amount,
    })),
  )

  const subtotal = funding.startingTcp
  return {
    pricingMode,
    sections,
    miscPrice: (funding.miscPrice ?? 0) > 0 ? funding.miscPrice! : null,
    subtotal,
    netSubtotal: subtotal - computeTotalSectionIncentives(sow),
    globalLines,
    sectionIncentiveLines,
    finalTcp: computeFinalTcp({ funding, sow }),
    deposit: funding.depositAmount,
    cashInDeal: funding.cashInDeal,
  }
}
```

- [ ] **Step 2: Add to `index.ts`**

```ts
export * from './compute-breakdown'
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/proposals/lib/financials/
git commit -m "feat(proposals): buildPricingBreakdown — shared customer pricing view-model"
```

---

### Task 4: Proposal totals + worked-example verification script

**Files:**
- Create: `src/shared/entities/proposals/lib/financials/compute-totals.ts`
- Modify: `src/shared/entities/proposals/lib/financials/index.ts`
- Create: `scripts/verify-financials-facade.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–3
- Produces: `ProposalFinancialsInput { funding, sow, pricingMode }`, `ProposalFinancials { subtotal, totalSectionIncentives, totalGlobalDiscounts, totalIncentives, finalTcp, totalJobCosts, margin, multiplier, tier, hasMissingCostData, sections, breakdown }`, `computeProposalFinancials(input: ProposalFinancialsInput): ProposalFinancials`

- [ ] **Step 1: Create `compute-totals.ts`**

```ts
// src/shared/entities/proposals/lib/financials/compute-totals.ts
import type { PricingBreakdownModel } from './compute-breakdown'
import type { SectionFinancials } from './compute-section'
import type { MultiplierTier } from './tiers'
import type { FundingSection, ProjectSection } from '@/shared/entities/proposals/types'
import { buildPricingBreakdown } from './compute-breakdown'
import { computeSectionFinancials } from './compute-section'
import { computeFinalTcp, computeTotalDiscounts, computeTotalSectionIncentives } from './compute-price-side'
import { getMultiplierTier } from './tiers'

export interface ProposalFinancialsInput {
  funding: FundingSection['data']
  sow: ProjectSection['data']['sow']
  pricingMode: 'total' | 'breakdown'
}

export interface ProposalFinancials {
  // price side — what the customer pays
  /** startingTcp */
  subtotal: number
  totalSectionIncentives: number
  totalGlobalDiscounts: number
  /** section + global */
  totalIncentives: number
  /** max(0, subtotal − totalIncentives) */
  finalTcp: number
  // cost side — what we pay
  totalJobCosts: number
  // outputs
  /** finalTcp − totalJobCosts */
  margin: number
  /** finalTcp ÷ totalJobCosts; null when totalJobCosts is 0 */
  multiplier: number | null
  tier: MultiplierTier
  /** True only when SOME sections have cost lines and some don't. see ../../DOCS.md#cost-data-asymmetric-incomplete */
  hasMissingCostData: boolean
  /** Per-section financials, titles fallback-resolved ("Section N"). */
  sections: SectionFinancials[]
  /** Customer-safe pricing breakdown view-model. */
  breakdown: PricingBreakdownModel
}

/**
 * The one big call — every derived proposal financial value, computed at
 * once from the hydrated domain shape. Pure, cheap, never persisted.
 * see ../../DOCS.md#price-side-vs-cost-side
 */
export function computeProposalFinancials(input: ProposalFinancialsInput): ProposalFinancials {
  const { funding, sow } = input

  const sections = sow.map((section, i) =>
    computeSectionFinancials({ title: section.title || `Section ${i + 1}`, financials: section.financials }),
  )

  const subtotal = funding.startingTcp
  const totalSectionIncentives = computeTotalSectionIncentives(sow)
  const totalGlobalDiscounts = computeTotalDiscounts(funding)
  const totalIncentives = totalSectionIncentives + totalGlobalDiscounts
  const finalTcp = computeFinalTcp({ funding, sow })
  const totalJobCosts = sections.reduce((sum, s) => sum + s.jobCost, 0)
  const multiplier = totalJobCosts === 0 ? null : finalTcp / totalJobCosts

  const hasAnyCostLines = sections.some(s => s.hasCostLines)
  const hasAnyMissing = sections.some(s => !s.hasCostLines)

  return {
    subtotal,
    totalSectionIncentives,
    totalGlobalDiscounts,
    totalIncentives,
    finalTcp,
    totalJobCosts,
    margin: finalTcp - totalJobCosts,
    multiplier,
    tier: getMultiplierTier(multiplier),
    hasMissingCostData: hasAnyCostLines && hasAnyMissing,
    sections,
    breakdown: buildPricingBreakdown(input),
  }
}
```

- [ ] **Step 2: Add to `index.ts`** (final façade shape)

```ts
export * from './compute-totals'
```

- [ ] **Step 3: Create the worked-example script** (the spec's canonical example: subtotal 27,000; incentives 10,000 (4k section + 6k global); job costs 6,000 → finalTcp 17,000, margin 11,000, multiplier 2.83x)

```ts
// scripts/verify-financials-facade.ts
// Worked-example self-check for the proposal financials façade.
// Run: pnpm tsx scripts/verify-financials-facade.ts
import type { ProjectSection } from '@/shared/entities/proposals/types'
import { computeProposalFinancials } from '@/shared/entities/proposals/lib/financials'

const sow: ProjectSection['data']['sow'] = [
  {
    contentJSON: '',
    html: '',
    scopes: [{ id: 'scope-1', label: 'Demo scope' }],
    title: 'Kitchen',
    trade: { id: 'trade-1', label: 'Kitchen Remodel' },
    financials: {
      sectionPrice: 27000,
      costLines: [
        { id: 'cl-1', label: 'Materials', amount: 4000, relatedScopeId: 'scope-1' },
        { id: 'cl-2', label: 'Labor', amount: 2000, relatedScopeId: 'scope-1' },
      ],
      incentives: [
        { id: 'si-1', label: 'Showcase discount', amount: 4000 },
      ],
    },
  },
]

const financials = computeProposalFinancials({
  pricingMode: 'breakdown',
  sow,
  funding: {
    cashInDeal: 0,
    depositAmount: 1000,
    miscPrice: 0,
    startingTcp: 27000,
    incentives: [{ type: 'discount', amount: 6000, notes: 'Friends & family' }],
  },
})

const checks: [string, unknown, unknown][] = [
  ['subtotal', financials.subtotal, 27000],
  ['totalSectionIncentives', financials.totalSectionIncentives, 4000],
  ['totalGlobalDiscounts', financials.totalGlobalDiscounts, 6000],
  ['totalIncentives', financials.totalIncentives, 10000],
  ['finalTcp', financials.finalTcp, 17000],
  ['totalJobCosts', financials.totalJobCosts, 6000],
  ['margin', financials.margin, 11000],
  ['multiplier (2dp)', financials.multiplier?.toFixed(2), '2.83'],
  ['tier', financials.tier, 'healthy'],
  ['section netPrice', financials.sections[0]?.netPrice, 23000],
  ['section multiplier (2dp)', financials.sections[0]?.multiplier?.toFixed(2), '3.83'],
  ['section tier', financials.sections[0]?.tier, 'excellent'],
  ['breakdown netSubtotal', financials.breakdown.netSubtotal, 23000],
  ['breakdown finalTcp', financials.breakdown.finalTcp, 17000],
  ['breakdown section netPrice', financials.breakdown.sections[0]?.netPrice, 23000],
  ['breakdown global line amount', financials.breakdown.globalLines[0]?.amount, 6000],
  ['breakdown section-incentive line amount', financials.breakdown.sectionIncentiveLines[0]?.amount, 4000],
]

let failed = 0
for (const [name, actual, expected] of checks) {
  const ok = actual === expected
  if (!ok) {
    failed++
  }
  console.log(`${ok ? '✅' : '❌'} ${name}: ${String(actual)}${ok ? '' : ` (expected ${String(expected)})`}`)
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}
console.log('\nAll façade checks passed')
```

- [ ] **Step 4: Run the script and tsc**

Run: `pnpm tsx scripts/verify-financials-facade.ts && pnpm tsc`
Expected: all ✅ lines, "All façade checks passed", tsc exit 0. (If `@/` alias resolution fails under tsx, mirror the run convention of `scripts/verify-final-tcp-parity.ts` — it already imports app code.)

- [ ] **Step 5: Commit**

```bash
git add src/shared/entities/proposals/lib/financials/ scripts/verify-financials-facade.ts
git commit -m "feat(proposals): computeProposalFinancials — corrected multiplier + worked-example check"
```

---

### Task 5: SectionFinancialsSummary → façade (compact-mode reframe + shared styles)

**Files:**
- Create: `src/shared/entities/proposals/constants/multiplier-styles.ts`
- Modify: `src/shared/entities/proposals/components/section-financials-summary.tsx`

**Interfaces:**
- Consumes: `computeSectionFinancials`, `formatMultiplier` from `@/shared/entities/proposals/lib/financials`; `MULTIPLIER_STYLES` (new)
- Produces: `MULTIPLIER_STYLES: Record<MultiplierTier, string>`; `SectionFinancialsSummary` keeps its existing Props `{ financials: SowFinancials, pricingMode: 'total' | 'breakdown', compact?: boolean }` — call sites unchanged.

- [ ] **Step 1: Create the shared styles constant** (currently duplicated verbatim in `section-financials-summary.tsx:29-34` and `internal-calculation-block.tsx:17-22`)

```ts
// src/shared/entities/proposals/constants/multiplier-styles.ts
import type { MultiplierTier } from '@/shared/entities/proposals/lib/financials'

/** Tier → className map used everywhere a multiplier is rendered. see ../DOCS.md#margin-multiplier-tiers */
export const MULTIPLIER_STYLES: Record<MultiplierTier, string> = {
  danger: 'text-red-600 dark:text-red-400',
  healthy: 'text-emerald-600 dark:text-emerald-400',
  excellent: 'text-emerald-600 dark:text-emerald-300 [text-shadow:0_0_12px_oklch(0.7_0.18_155),0_0_4px_oklch(0.7_0.18_155_/_0.4)]',
  unknown: 'text-muted-foreground',
}
```

- [ ] **Step 2: Rewrite `section-financials-summary.tsx`**

Replace the whole file with:

```tsx
'use client'

import type { SowFinancials } from '@/shared/entities/proposals/schemas'
import { ExpandableLineItems } from '@/shared/components/expandable-line-items'
import { Separator } from '@/shared/components/ui/separator'
import { MULTIPLIER_STYLES } from '@/shared/entities/proposals/constants/multiplier-styles'
import { computeSectionFinancials, formatMultiplier } from '@/shared/entities/proposals/lib/financials'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

interface Props {
  financials: SowFinancials
  pricingMode: 'total' | 'breakdown'
  /** Compact mode: shows only Net Price + Job Costs */
  compact?: boolean
}

/**
 * Shared financial summary for a single SOW section.
 *
 * Layout: inputs (price, costs, incentives) → Separator → outputs (margin, multiplier)
 * In total mode (no sectionPrice), only cost + incentives are shown.
 * Line items toggle open/closed via clickable summary rows.
 */
export function SectionFinancialsSummary({ financials, pricingMode, compact }: Props) {
  const section = computeSectionFinancials({ title: '', financials })
  const isBreakdown = pricingMode === 'breakdown'

  const hasAnyData = section.hasCostLines || section.hasIncentives
  const showOutputs = isBreakdown && section.price != null && section.hasCostLines

  if (compact) {
    return (
      <div className="rounded-lg bg-muted/30 px-4 py-2 text-sm space-y-1">
        {isBreakdown && section.netPrice != null && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Net Price</span>
            <span className="text-emerald-600 dark:text-emerald-400 tabular-nums font-medium">
              {formatAsDollars(section.netPrice)}
            </span>
          </div>
        )}
        {section.hasCostLines && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Job Costs</span>
            <span className="text-red-600/90 dark:text-red-400/90 tabular-nums font-medium">
              -
              {formatAsDollars(section.jobCost)}
            </span>
          </div>
        )}
        {!hasAnyData && (
          <p className="text-xs text-muted-foreground">No cost data</p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-muted/30 px-4 py-3 text-sm space-y-2">
      {/* Section Price (breakdown only) */}
      {isBreakdown && section.price != null && (
        <SummaryRow
          label="Section Price"
          value={formatAsDollars(section.price)}
          className="text-emerald-600 dark:text-emerald-400"
          bold
        />
      )}

      {/* Incentives — reduce the section's PRICE */}
      {section.hasIncentives && (
        <ExpandableLineItems
          label={(
            <span className="font-medium">
              Incentives
              <span className="text-xs text-muted-foreground font-normal ml-1">
                (
                {financials.incentives.length}
                )
              </span>
            </span>
          )}
          value={<span className="font-medium">{`-${formatAsDollars(section.incentives)}`}</span>}
          className="text-emerald-700 dark:text-emerald-400"
          items={financials.incentives.map(inc => ({
            id: inc.id,
            label: inc.label || 'Untitled',
            value: `-${formatAsDollars(inc.amount)}`,
          }))}
        />
      )}

      {/* Net Price (only when incentives moved it off the sticker price) */}
      {isBreakdown && section.netPrice != null && section.hasIncentives && (
        <SummaryRow
          label="Net Price"
          value={formatAsDollars(section.netPrice)}
          className="text-emerald-600 dark:text-emerald-400"
          bold
        />
      )}

      {/* Job Costs — what WE pay */}
      {section.hasCostLines && (
        <ExpandableLineItems
          label={(
            <span className="font-medium">
              Job Costs
              <span className="text-xs text-muted-foreground font-normal ml-1">
                (
                {financials.costLines.length}
                )
              </span>
            </span>
          )}
          value={<span className="font-medium">{`-${formatAsDollars(section.jobCost)}`}</span>}
          className="text-red-600/90 dark:text-red-400/90"
          items={financials.costLines.map(line => ({
            id: line.id,
            label: line.label || 'Untitled',
            value: `-${formatAsDollars(line.amount)}`,
          }))}
        />
      )}

      {showOutputs && <Separator className="my-1" />}

      {showOutputs && (
        <>
          <SummaryRow
            label="Margin"
            value={section.margin == null ? '—' : formatAsDollars(section.margin)}
            className="text-emerald-600 dark:text-emerald-400"
            bold
          />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-medium">Multiplier</span>
            <span className={cn('font-bold tabular-nums', MULTIPLIER_STYLES[section.tier])}>
              {formatMultiplier(section.multiplier)}
            </span>
          </div>
        </>
      )}

      {!hasAnyData && !isBreakdown && (
        <p className="text-center text-xs text-muted-foreground py-1">
          Add cost lines to see financial summary
        </p>
      )}
    </div>
  )
}

function SummaryRow({
  label,
  value,
  className,
  bold,
}: {
  label: string
  value: string
  className?: string
  bold?: boolean
}) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <span className={cn(bold && 'font-medium')}>{label}</span>
      <span className={cn('tabular-nums shrink-0', bold && 'font-medium')}>{value}</span>
    </div>
  )
}
```

Layout change vs today (intentional, per spec): incentives render in emerald (price-side reduction, not a red cost); Net Price row added; compact mode's misleading "Total Costs" (cost+incentives) row replaced by Net Price + Job Costs.

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: both exit 0. (The old lib files still exist and still compile — they are deleted in Task 11.)

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/proposals/constants/multiplier-styles.ts src/shared/entities/proposals/components/section-financials-summary.tsx
git commit -m "refactor(proposals): section summary on façade — fixed multiplier, honest compact rows"
```

---

### Task 6: InternalCalculationBlock → façade + new row story

**Files:**
- Modify: `src/features/proposal-flow/ui/components/pricing-breakdown/internal-calculation-block.tsx`

**Interfaces:**
- Consumes: `computeProposalFinancials`, `formatMultiplier` from `@/shared/entities/proposals/lib/financials`; `MULTIPLIER_STYLES` from `@/shared/entities/proposals/constants/multiplier-styles`
- Produces: `InternalCalculationBlock` keeps Props `{ proposalData: InsertProposalSchema }` — call sites unchanged.

- [ ] **Step 1: Rewrite the aggregate section.** Replace the file's imports, remove the local `MULTIPLIER_STYLES` constant (lines 17-22), and replace the computation + "Aggregate totals" JSX. Full new file:

```tsx
'use client'

import type { InsertProposalSchema } from '@/shared/db/schema'
import { ChevronsUpDownIcon, LockIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { SectionFinancialsSummary } from '@/shared/entities/proposals/components/section-financials-summary'
import { MULTIPLIER_STYLES } from '@/shared/entities/proposals/constants/multiplier-styles'
import { computeProposalFinancials, formatMultiplier } from '@/shared/entities/proposals/lib/financials'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

interface Props {
  proposalData: InsertProposalSchema
}

export function InternalCalculationBlock({ proposalData }: Props) {
  const [expanded, setExpanded] = useState(false)
  const { pricingMode } = proposalData.formMetaJSON
  const sow = proposalData.projectJSON.data.sow
  const financials = computeProposalFinancials({
    funding: proposalData.fundingJSON.data,
    sow,
    pricingMode,
  })

  return (
    <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 overflow-hidden text-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-destructive/20">
        <div className="flex items-center gap-2">
          <LockIcon className="size-4 text-destructive" />
          <span className="font-semibold">Internal Calculation</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Visible only to you</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setExpanded(prev => !prev)}
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
          >
            <ChevronsUpDownIcon className="size-4" />
          </Button>
        </div>
      </div>

      {/* Per-section financials */}
      <div className="px-5 py-4 space-y-4">
        {sow.map((section, i) => (
          <div key={i}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {section.title || `Section ${i + 1}`}
            </p>
            <SectionFinancialsSummary
              financials={section.financials}
              pricingMode={pricingMode}
              compact={!expanded}
            />
          </div>
        ))}
      </div>

      {/* Aggregate totals — price side, then cost side */}
      <div className="border-t border-destructive/20 px-5 py-4 space-y-2">
        <SummaryRow
          label="Subtotal"
          value={formatAsDollars(financials.subtotal)}
          className="text-emerald-600 dark:text-emerald-400"
          bold
        />
        {financials.totalSectionIncentives > 0 && (
          <SummaryRow
            label="Section Incentives"
            value={`-${formatAsDollars(financials.totalSectionIncentives)}`}
            className="text-emerald-700 dark:text-emerald-400"
          />
        )}
        {financials.totalGlobalDiscounts > 0 && (
          <SummaryRow
            label="Global Discounts"
            value={`-${formatAsDollars(financials.totalGlobalDiscounts)}`}
            className="text-emerald-700 dark:text-emerald-400"
          />
        )}
        <SummaryRow
          label="Final Contract Price"
          value={formatAsDollars(financials.finalTcp)}
          bold
        />
        <SummaryRow
          label="Total Job Costs"
          value={`-${formatAsDollars(financials.totalJobCosts)}`}
          className="text-red-600/90 dark:text-red-400/90"
        />

        <Separator />

        <SummaryRow
          label="Total Margin"
          value={formatAsDollars(financials.margin)}
          className="text-emerald-600 dark:text-emerald-400"
          bold
        />
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground font-medium">Multiplier</span>
          <span className={cn('font-bold tabular-nums', MULTIPLIER_STYLES[financials.tier])}>
            {formatMultiplier(financials.multiplier)}
          </span>
        </div>
      </div>

      {financials.hasMissingCostData && (
        <div className="border-t border-destructive/20 px-5 py-3 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs">
          One or more sections are missing cost data — multiplier and margin reflect partial cost.
        </div>
      )}
    </div>
  )
}

function SummaryRow({
  label,
  value,
  className,
  bold,
}: {
  label: string
  value: string
  className?: string
  bold?: boolean
}) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <span className={cn(bold && 'font-medium')}>{label}</span>
      <span className={cn('tabular-nums shrink-0', bold && 'font-medium')}>{value}</span>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/features/proposal-flow/ui/components/pricing-breakdown/internal-calculation-block.tsx
git commit -m "refactor(proposals): internal calc block on façade — Final Contract Price row + fixed multiplier"
```

---

### Task 7: PricingBreakdown component → view-model renderer (viewMode prop removed)

**Files:**
- Modify: `src/features/proposal-flow/ui/components/pricing-breakdown.tsx`
- Modify: `src/features/proposal-flow/ui/components/proposal/funding.tsx` (drop `viewMode` prop at line 98; drop the now-unused `useViewMode` import/call ONLY if nothing else in the file uses it)
- Modify: `src/features/proposal-flow/ui/components/form/funding-fields.tsx:363` (drop `viewMode="agent"` prop — the preview block itself is deleted in Task 9)

**Interfaces:**
- Consumes: `buildPricingBreakdown` from `@/shared/entities/proposals/lib/financials`
- Produces: `PricingBreakdown` with Props `{ proposalData: InsertProposalSchema }` (viewMode GONE; it no longer appends `InternalCalculationBlock` — the modal owns that from Task 9 on)

- [ ] **Step 1: Rewrite `pricing-breakdown.tsx`**

```tsx
'use client'

import type { InsertProposalSchema } from '@/shared/db/schema'
import { CheckIcon } from 'lucide-react'
import { ExpandableLineItems } from '@/shared/components/expandable-line-items'
import { buildPricingBreakdown } from '@/shared/entities/proposals/lib/financials'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { ExpirationBadge } from './expiration-badge'

interface Props {
  proposalData: InsertProposalSchema
}

export function PricingBreakdown({ proposalData }: Props) {
  const breakdown = buildPricingBreakdown({
    funding: proposalData.fundingJSON.data,
    sow: proposalData.projectJSON.data.sow,
    pricingMode: proposalData.formMetaJSON.pricingMode,
  })

  const isBreakdown = breakdown.pricingMode === 'breakdown'
  // In breakdown mode, section incentives render inline under their section's
  // price row. In total mode, they go in the global block.
  const globalLines = isBreakdown
    ? breakdown.globalLines
    : [...breakdown.sectionIncentiveLines, ...breakdown.globalLines]
  const hasAnyIncentives = globalLines.length > 0

  return (
    <div className="rounded-xl border border-border/40 overflow-hidden text-sm">
      <div className="px-5 py-4 space-y-2.5">
        {isBreakdown
          ? (
              <>
                {breakdown.sections.map(section => (
                  section.incentives.length === 0
                    ? (
                        <div key={section.title} className="flex items-center justify-between">
                          <span className="text-muted-foreground">{section.title}</span>
                          <span>{formatAsDollars(section.price)}</span>
                        </div>
                      )
                    : (
                        <ExpandableLineItems
                          key={section.title}
                          label={<span className="text-muted-foreground">{section.title}</span>}
                          value={(
                            <span className="flex items-center gap-2">
                              <span className="text-muted-foreground/50 line-through text-xs tabular-nums">
                                {formatAsDollars(section.price)}
                              </span>
                              <span className="tabular-nums">{formatAsDollars(section.netPrice)}</span>
                            </span>
                          )}
                          items={[
                            { id: '_original', label: 'Original price', value: formatAsDollars(section.price) },
                            ...section.incentives.map(inc => ({
                              id: inc.id,
                              label: inc.label,
                              value: `-${formatAsDollars(inc.amount)}`,
                              className: 'text-emerald-700 dark:text-emerald-400',
                            })),
                          ]}
                        />
                      )
                ))}
                {breakdown.miscPrice != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Misc</span>
                    <span>{formatAsDollars(breakdown.miscPrice)}</span>
                  </div>
                )}
              </>
            )
          : (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Contract Price</span>
                <span>{formatAsDollars(breakdown.subtotal)}</span>
              </div>
            )}
      </div>

      {isBreakdown && (
        <div className="border-t border-border/40 px-5 py-3 flex items-center justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatAsDollars(breakdown.netSubtotal)}</span>
        </div>
      )}

      {hasAnyIncentives && (
        <>
          <div className="border-t border-border/40" />
          <div className="px-5 py-4 space-y-2.5 text-emerald-700 dark:text-emerald-400">
            {globalLines.map((line) => {
              const isExpired = line.expiresAt ? new Date() >= new Date(line.expiresAt) : false
              const expiresAt = line.expiresAt ? new Date(line.expiresAt) : null

              return (
                <div key={line.key} className="space-y-1">
                  <div className={cn('flex items-center justify-between', isExpired && 'line-through opacity-60')}>
                    {line.kind === 'exclusive-offer'
                      ? (
                          <div className="flex items-center">
                            <span>{line.label}</span>
                            {line.notes && (
                              <span className="mx-2 flex items-center gap-2">
                                {' '}
                                -
                                <p className="text-muted-foreground text-xs">{line.notes}</p>
                              </span>
                            )}
                          </div>
                        )
                      : <span>{line.label}</span>}
                    {line.amount != null
                      ? (
                          <span className="font-medium">
                            -
                            {formatAsDollars(line.amount)}
                          </span>
                        )
                      : (
                          <span className="font-medium flex items-center gap-1">
                            <CheckIcon className="w-3.5 h-3.5" />
                            Included
                          </span>
                        )}
                  </div>
                  {expiresAt && !isExpired && (
                    <ExpirationBadge expiresAt={expiresAt} />
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className={cn(
        'border-t border-border/40 bg-muted/30 px-5 py-4 flex items-center justify-between',
        !hasAnyIncentives && !isBreakdown && 'border-t-0',
      )}
      >
        <span className="font-semibold">Final Contract Price</span>
        <span className="font-semibold text-base">{formatAsDollars(breakdown.finalTcp)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update the two call sites that pass `viewMode`**

In `src/features/proposal-flow/ui/components/proposal/funding.tsx` line 98:

```tsx
<PricingBreakdown proposalData={proposalData} />
```

(Keep the `useViewMode` import/call if still referenced elsewhere in the file — check; at time of writing it is only used for this prop, so remove `const viewMode = useViewMode()` and the import.)

In `src/features/proposal-flow/ui/components/form/funding-fields.tsx` line 363:

```tsx
<PricingBreakdown proposalData={formValuesToProposal(form.getValues())} />
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: both exit 0. Note: after this task the agent temporarily has NO inline internal-calc view (the modal arrives in Task 9). That is an acceptable mid-plan state on main only if Tasks 7–9 land in the same working session; do not stop between Task 7 and Task 9 for longer than a session.

- [ ] **Step 4: Commit**

```bash
git add src/features/proposal-flow/ui/components/pricing-breakdown.tsx src/features/proposal-flow/ui/components/proposal/funding.tsx src/features/proposal-flow/ui/components/form/funding-fields.tsx
git commit -m "refactor(proposals): PricingBreakdown renders shared view-model; viewMode prop removed"
```

---

### Task 8: PDF + summary route → view-model renderers

**Files:**
- Modify: `src/shared/lib/pdf/proposal-doc-definition.ts` (`buildInvestment`, lines ~244-298)
- Modify: `src/app/api/proposals/[proposalId]/summary/route.ts` (pricing block, lines ~93-130, plus imports)

**Interfaces:**
- Consumes: `buildPricingBreakdown` from `@/shared/entities/proposals/lib/financials`
- Produces: no signature changes — `buildInvestment(sow, funding, pricingMode)` keeps its signature; the route keeps its response format.

- [ ] **Step 1: Rewrite `buildInvestment` in `proposal-doc-definition.ts`**

Replace the function body (keep the existing imports for `Content`, `TableCell`, `formatAsDollars`; swap the `computeFinalTcp` import for `buildPricingBreakdown` from `@/shared/entities/proposals/lib/financials`; remove the old `compute-final-tcp` import if nothing else in the file uses it):

```ts
function buildInvestment(
  sow: ProposalWithCustomer['projectJSON']['data']['sow'],
  funding: ProposalWithCustomer['fundingJSON']['data'],
  pricingMode: 'total' | 'breakdown',
): Content[] {
  // relies on getFullView incentive hydration (Wave 2 bridge)
  const breakdown = buildPricingBreakdown({ funding, sow, pricingMode })

  const rows: TableCell[][] = []
  if (breakdown.pricingMode === 'breakdown') {
    for (const section of breakdown.sections) {
      rows.push([{ text: section.title }, { text: formatAsDollars(section.price), alignment: 'right' }])
    }
    if (breakdown.miscPrice != null) {
      rows.push([{ text: 'Additional items' }, { text: formatAsDollars(breakdown.miscPrice), alignment: 'right' }])
    }
    rows.push([{ text: 'Subtotal', bold: true }, { text: formatAsDollars(breakdown.subtotal), bold: true, alignment: 'right' }])
  }
  else {
    rows.push([{ text: 'Contract price' }, { text: formatAsDollars(breakdown.subtotal), alignment: 'right' }])
  }
  for (const line of [...breakdown.globalLines, ...breakdown.sectionIncentiveLines]) {
    if (line.amount != null) {
      rows.push([
        { text: `Discount${line.label === 'Discount' ? '' : ` — ${line.label}`}`, color: '#166534' },
        { text: `-${formatAsDollars(line.amount)}`, alignment: 'right', color: '#166534' },
      ])
    }
    else {
      rows.push([
        { text: `Exclusive offer — ${line.label}${line.notes ? ` (${line.notes})` : ''}`, color: '#166534' },
        { text: 'Included', alignment: 'right', color: '#166534' },
      ])
    }
  }
  rows.push([
    { text: 'Final contract price', bold: true, fontSize: 12 },
    { text: formatAsDollars(breakdown.finalTcp), bold: true, fontSize: 12, alignment: 'right' },
  ])
  rows.push([{ text: 'Deposit due at signing' }, { text: formatAsDollars(breakdown.deposit), alignment: 'right' }])

  return [
    // The investment breakdown always opens its own closing page.
    { text: 'Investment', style: 'sectionTitle', pageBreak: 'before' },
    { table: { widths: ['*', 'auto'], body: rows }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 12] },
  ]
}
```

Copy note (intentional): section-incentive PDF rows previously read `Discount — ${label || sectionTitle}`; they now read `Discount — ${label || '<sectionTitle> discount'}` — the unified view-model label.

- [ ] **Step 2: Rewrite the pricing block in `summary/route.ts`**

Replace the import of `computeFinalTcp` with `buildPricingBreakdown` (from `@/shared/entities/proposals/lib/financials`) and replace everything from `lines.push('## Pricing')` down to (and including) the `Cash in Deal` line with:

```ts
  lines.push('## Pricing')
  // relies on getFullView incentive hydration (Wave 2 bridge)
  const breakdown = buildPricingBreakdown({ funding: fund, sow: proj.sow, pricingMode })
  if (breakdown.pricingMode === 'breakdown') {
    for (const section of breakdown.sections) {
      lines.push(`- ${section.title}: ${formatAsDollars(section.price)}`)
    }
    if (breakdown.miscPrice != null) {
      lines.push(`- Misc: ${formatAsDollars(breakdown.miscPrice)}`)
    }
    lines.push(`- **Subtotal:** ${formatAsDollars(breakdown.subtotal)}`)
  }
  else {
    lines.push(`- **Contract Price:** ${formatAsDollars(breakdown.subtotal)}`)
  }

  const incentiveLines = [...breakdown.globalLines, ...breakdown.sectionIncentiveLines]
  if (incentiveLines.length > 0) {
    lines.push('\n**Incentives:**')
    for (const line of incentiveLines) {
      if (line.amount != null) {
        lines.push(`- Discount: -${formatAsDollars(line.amount)}${line.label === 'Discount' ? '' : ` (${line.label})`}`)
      }
      else {
        lines.push(`- Exclusive Offer: ${line.label}${line.notes ? ` — ${line.notes}` : ''}`)
      }
    }
  }

  lines.push(`\n**Final Contract Price:** ${formatAsDollars(breakdown.finalTcp)}`)
  lines.push(`**Deposit:** ${formatAsDollars(breakdown.deposit)}`)
  lines.push(`**Cash in Deal:** ${formatAsDollars(breakdown.cashInDeal)}`)
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/shared/lib/pdf/proposal-doc-definition.ts "src/app/api/proposals/[proposalId]/summary/route.ts"
git commit -m "refactor(proposals): PDF + AI summary render the shared pricing view-model"
```

---

### Task 9: Agent-only Internal Financials modal + kill the showPricingBreakdown toggle

**Files:**
- Create: `src/features/proposal-flow/ui/components/internal-financials-modal.tsx`
- Modify: `src/features/proposal-flow/ui/components/proposal/heading.tsx` (add agent button)
- Modify: `src/features/proposal-flow/ui/components/form/index.tsx` (add toolbar button; remove toggle)
- Modify: `src/features/proposal-flow/ui/components/form/funding-fields.tsx` (delete inline preview block)
- Modify: `src/shared/entities/proposals/schemas/index.ts` (delete `showPricingBreakdown` field + default)
- Modify: `src/features/customer-pipelines/ui/components/create-proposal-popover.tsx:76` (drop key from seeded meta)

**Interfaces:**
- Consumes: `useModalStore` from `@/shared/hooks/use-modal-store`; `Modal` from `@/shared/components/dialogs/modals/base-modal`; `PricingBreakdown`, `InternalCalculationBlock` (same feature); `formValuesToProposal` from `@/features/proposal-flow/lib/converters`
- Produces: `InternalFinancialsModal({ proposalData: InsertProposalSchema })` — opened via the global modal store from both surfaces.

Migration note: `showPricingBreakdown` lives inside the `fundingJSON` JSONB blob. Removing it from the Zod schema means existing persisted values are silently stripped on next parse and disappear on next whole-blob write. **No DB migration.**

- [ ] **Step 1: Create the modal component**

```tsx
// src/features/proposal-flow/ui/components/internal-financials-modal.tsx
'use client'

import type { InsertProposalSchema } from '@/shared/db/schema'
import { Modal } from '@/shared/components/dialogs/modals/base-modal'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { PricingBreakdown } from './pricing-breakdown'
import { InternalCalculationBlock } from './pricing-breakdown/internal-calculation-block'

interface Props {
  proposalData: InsertProposalSchema
}

/**
 * Agent-only financial X-ray: the customer pricing breakdown plus the
 * Internal Calculation (margin/multiplier). Opened via the global modal
 * store — never rendered inline, never reachable by the homeowner.
 */
export function InternalFinancialsModal({ proposalData }: Props) {
  const { isOpen, close } = useModalStore()

  return (
    <Modal
      isOpen={isOpen}
      close={close}
      title="Internal Financials"
      description="Visible only to agents"
      className="sm:max-w-2xl"
    >
      <div className="w-full min-h-0 flex-1 overflow-y-auto space-y-1">
        <PricingBreakdown proposalData={proposalData} />
        <InternalCalculationBlock proposalData={proposalData} />
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Add the button to the main proposal page** (`heading.tsx`)

Add imports:

```tsx
import { CalculatorIcon } from 'lucide-react'   // merge into the existing lucide import
import { InternalFinancialsModal } from '@/features/proposal-flow/ui/components/internal-financials-modal'
```

Add a handler next to `handleViewProfile`:

```tsx
  function handleInternalFinancials() {
    if (!proposal.data) {
      return
    }
    setModal({
      accessor: 'InternalFinancials',
      Component: InternalFinancialsModal,
      props: { proposalData: proposal.data },
    })
    openModal()
  }
```

Add the button inside the existing agent-gated cluster, immediately after the "Edit Proposal" button block (same gating expression `viewMode === 'agent' && ability.can('update', 'Proposal')`):

```tsx
        {viewMode === 'agent' && ability.can('update', 'Proposal') && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Button
              variant="outline"
              size="sm"
              onClick={handleInternalFinancials}
            >
              <CalculatorIcon className="size-4" />
              Internal Financials
            </Button>
          </div>
        )}
```

- [ ] **Step 3: Add the toolbar button + remove the toggle in `form/index.tsx`**

(a) Imports: add `CalculatorIcon` to the lucide import; add:

```tsx
import { formValuesToProposal } from '@/features/proposal-flow/lib/converters'
import { InternalFinancialsModal } from '@/features/proposal-flow/ui/components/internal-financials-modal'
import { useModalStore } from '@/shared/hooks/use-modal-store'
```

(b) Inside `ProposalForm`, remove line 71 (`const showPricingBreakdown = useWatch(...)`) and add:

```tsx
  const { open: openModal, setModal } = useModalStore()

  function handleInternalFinancials() {
    setModal({
      accessor: 'InternalFinancials',
      Component: InternalFinancialsModal,
      props: { proposalData: formValuesToProposal(form.getValues()) },
    })
    openModal()
  }
```

(c) In the settings `PopoverContent` (lines ~156-186): delete the `<Separator />` and the entire "Funding" group (the `Show Pricing Breakdown` label + Switch). The popover keeps only the "General"/"Breakdown Pricing" group. Remove the now-unused `Separator` import if nothing else uses it.

(d) Add the calculator button to the edit-mode toolbar cluster, immediately BEFORE the Settings popover trigger (inside the `isEditMode` toolbar `div`):

```tsx
                {/* Internal financials */}
                <button
                  type="button"
                  onClick={handleInternalFinancials}
                  className={cn(TOOLBAR_BUTTON_BASE, 'aspect-square', TOOLBAR_BUTTON_INACTIVE)}
                  aria-label="Internal financials"
                >
                  <CalculatorIcon className="size-3.5" />
                </button>
```

- [ ] **Step 4: Delete the inline preview in `funding-fields.tsx`**

Delete the `showPricingBreakdown` useWatch (line 45) and the entire "Pricing breakdown helper" block (lines ~360-365). Remove the now-unused imports `PricingBreakdown` and `formValuesToProposal`.

- [ ] **Step 5: Delete the schema field**

In `src/shared/entities/proposals/schemas/index.ts`:
- Delete the `fundingMetaSchema` declaration (lines 97-99) and change `fundingSectionSchema` to use `sectionMetaSchema` directly:

```ts
export const fundingSectionSchema = z.object({
  data: fundingDataSchema,
  meta: sectionMetaSchema,
})
```

- In `proposalFormBaseDefaultValues`, change the funding meta default to:

```ts
    meta: {
      enabled: true,
    },
```

- [ ] **Step 6: Fix the seeded meta in `create-proposal-popover.tsx:76`**

```ts
        meta: { enabled: true },
```

- [ ] **Step 7: Sweep + verify**

Run: `grep -rn "showPricingBreakdown" src`
Expected: no matches.
Run: `pnpm tsc && pnpm lint`
Expected: both exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/features/proposal-flow/ui/components/internal-financials-modal.tsx src/features/proposal-flow/ui/components/proposal/heading.tsx src/features/proposal-flow/ui/components/form/index.tsx src/features/proposal-flow/ui/components/form/funding-fields.tsx src/shared/entities/proposals/schemas/index.ts src/features/customer-pipelines/ui/components/create-proposal-popover.tsx
git commit -m "feat(proposals): agent-only Internal Financials modal; kill showPricingBreakdown toggle"
```

---

### Task 10: Migrate remaining consumers to the façade

**Files:**
- Modify: `src/features/proposal-flow/lib/get-proposal-aggregates.ts`
- Modify: `src/features/proposal-flow/ui/views/edit-proposal-view.tsx:21`
- Modify: `src/features/proposal-flow/ui/components/proposal/funding.tsx:17`
- Modify: `src/shared/services/providers/zoho-sign/lib/documents/proposal-context.ts:4`
- Modify: `src/features/proposal-flow/ui/components/form/sow-financials-fields.tsx` (no import change needed — uses `SectionFinancialsSummary` only; verify)

**Interfaces:**
- Consumes: `computeFinalTcp`, `computeTotalDiscounts`, `computeTotalSectionPrices` from `@/shared/entities/proposals/lib/financials`
- Produces: `getProposalAggregates` keeps its exact return shape `{ totalSOWPriceBreakdown, totalProjectDiscounts, finalTcp }`.

- [ ] **Step 1: Rewrite `get-proposal-aggregates.ts`** (inline Σ sectionPrice dies)

```ts
import type { ProposalFormSchema } from '../schemas/form-schema'
import type { InsertProposalSchema } from '@/shared/db/schema'

import { computeFinalTcp, computeTotalDiscounts, computeTotalSectionPrices } from '@/shared/entities/proposals/lib/financials'

export function getProposalAggregates(proposal: ProposalFormSchema | InsertProposalSchema) {
  const { pricingMode } = 'meta' in proposal ? proposal.meta : proposal.formMetaJSON
  const fundingJSON = 'meta' in proposal ? proposal.funding : proposal.fundingJSON
  const projectJSON = 'meta' in proposal ? proposal.project : proposal.projectJSON

  const totalSOWPriceBreakdown = pricingMode === 'breakdown'
    ? computeTotalSectionPrices(projectJSON.data.sow)
    : undefined

  return {
    totalSOWPriceBreakdown,
    totalProjectDiscounts: computeTotalDiscounts(fundingJSON.data),
    finalTcp: computeFinalTcp({ funding: fundingJSON.data, sow: projectJSON.data.sow }),
  }
}
```

- [ ] **Step 2: Flip the remaining import paths.** In each of `edit-proposal-view.tsx`, `funding.tsx`, `proposal-context.ts`, change:

```ts
import { computeFinalTcp } from '@/shared/entities/proposals/lib/compute-final-tcp'
```

to:

```ts
import { computeFinalTcp } from '@/shared/entities/proposals/lib/financials'
```

(Call sites are unchanged — same signature.)

- [ ] **Step 3: Verify no other consumers remain on the old paths**

Run: `grep -rln "lib/compute-final-tcp\|lib/compute-sow-financials\|lib/compute-proposal-cost-totals" src`
Expected: no matches outside `src/shared/entities/proposals/lib/` itself.

- [ ] **Step 4: Verify + commit**

Run: `pnpm tsc && pnpm lint`
Expected: both exit 0.

```bash
git add src/features/proposal-flow/lib/get-proposal-aggregates.ts src/features/proposal-flow/ui/views/edit-proposal-view.tsx src/features/proposal-flow/ui/components/proposal/funding.tsx src/shared/services/providers/zoho-sign/lib/documents/proposal-context.ts
git commit -m "refactor(proposals): migrate remaining consumers to the financials façade"
```

---

### Task 11: Delete the three old lib files

**Files:**
- Delete: `src/shared/entities/proposals/lib/compute-final-tcp.ts`
- Delete: `src/shared/entities/proposals/lib/compute-sow-financials.ts`
- Delete: `src/shared/entities/proposals/lib/compute-proposal-cost-totals.ts`

- [ ] **Step 1: Delete and verify nothing references them**

```bash
git rm src/shared/entities/proposals/lib/compute-final-tcp.ts src/shared/entities/proposals/lib/compute-sow-financials.ts src/shared/entities/proposals/lib/compute-proposal-cost-totals.ts
```

Run: `grep -rn "compute-final-tcp\|compute-sow-financials\|compute-proposal-cost-totals" src scripts`
Expected: no matches (comments included — fix any stragglers by pointing them at `lib/financials`).

- [ ] **Step 2: Verify + commit**

Run: `pnpm tsc && pnpm lint && pnpm tsx scripts/verify-financials-facade.ts`
Expected: all pass.

```bash
git commit -m "refactor(proposals): delete legacy financial calc files — façade is the single source"
```

---

### Task 12: Meeting-flow deposit-% hotspot

**Files:**
- Modify: `src/features/meeting-flow/ui/components/steps/deal-structure-fields.tsx` (~lines 252-265)

**Interfaces:**
- Consumes: `computeDealDepositPercent(deal)` from `@/shared/entities/meetings/lib/compute-deal-derived` (exists; same call shape as `closing-step.tsx:52`)

- [ ] **Step 1: Replace the inline math.** Add the import:

```ts
import { computeDealDepositPercent } from '@/shared/entities/meetings/lib/compute-deal-derived'
```

Add a reactive watch next to the existing ones (`mode`, `financeTermMonths`, `apr`):

```ts
  const depositAmount = useWatch({ control: form.control, name: 'depositAmount' })
```

Replace the Deposit Percentage `<span>` body (currently `calculatedFinalTcp > 0 ? Math.round(((form.getValues('depositAmount') ?? 0) / calculatedFinalTcp) * 100) + '%' : '—'`) with:

```tsx
              <span className="text-xl font-bold tabular-nums">
                {(() => {
                  const depositPercent = computeDealDepositPercent({ ...form.getValues(), depositAmount })
                  return depositPercent > 0 ? `${depositPercent}%` : '—'
                })()}
              </span>
```

Behavior notes: the helper is mode-gated to `'cash'` — this Card already renders only in cash mode, so results match. The helper returns 0 (→ '—') when deposit is 0; the old code showed "0%". This matches `closing-step.tsx` display and is intentional. If `DealFormValues` is not assignable to the helper's `DealStructure` parameter, build the argument explicitly from the watched fields (`mode: 'cash'`, `startingTcp`, `incentives`, `depositAmount` from form values) rather than casting.

- [ ] **Step 2: Verify + commit**

Run: `pnpm tsc && pnpm lint`
Expected: both exit 0.

```bash
git add src/features/meeting-flow/ui/components/steps/deal-structure-fields.tsx
git commit -m "refactor(meetings): deposit-% via computeDealDepositPercent — kill inline duplicate"
```

---

### Task 13: DOCS.md truth-pass

**Files:**
- Modify: `src/shared/entities/proposals/DOCS.md`
- Modify: `src/shared/entities/proposals/schemas/index.ts` (comment above `fundingDataSchema` only)

- [ ] **Step 1: Rewrite the `### margin-multiplier-tiers` section** (lines ~172-187). Replace with:

```markdown
### margin-multiplier-tiers

Margin and multiplier follow `#price-side-vs-cost-side`:

- Proposal level: margin = `finalTcp − totalJobCosts`; multiplier = `finalTcp ÷ totalJobCosts`.
- Section level: netPrice = `sectionPrice − Σ section incentives`; margin = `netPrice − sectionCost`; multiplier = `netPrice ÷ sectionCost`.

The multiplier drives a 4-tier color classification used across cost-related UI:

| Tier | Threshold | Meaning |
|---|---|---|
| `danger` | multiplier `< 2×` | below break-even safety margin |
| `healthy` | `2×` to `3×` | standard residential remodeling range |
| `excellent` | `≥ 3×` | strong margin |
| `unknown` | no cost data | no signal |

Cost helpers return `null` (not 0) when cost data is incomplete — distinguishes "not tracked" from "actually zero."

**Why**: the tier system is used in multiple UI surfaces; a single classification keeps colors aligned with reality.
**Reference impl**: `lib/financials/` (`getMultiplierTier` in `tiers.ts`, `computeSectionFinancials`, `computeProposalFinancials`); tier→className map in `constants/multiplier-styles.ts`
**Enforced by**: convention
```

- [ ] **Step 2: Add a new section immediately BEFORE `### margin-multiplier-tiers`:**

```markdown
### price-side-vs-cost-side

Every derived proposal financial value follows one semantic model: **incentives and
discounts reduce what the customer pays (price side); they are never something we
pay (cost side).**

    PRICE SIDE (customer)                      COST SIDE (us)
    subtotal (startingTcp)                     totalJobCosts (Σ cost-line amounts)
      − Σ section incentives
      − Σ global 'discount' incentives
      = finalTcp (what the customer pays)

The concept "totalCosts = jobCosts + incentives" is dead — deleted 2026-07 with the
financials façade; do not reintroduce it.

Two intentional consequences:
- Global discounts are NOT allocated to sections, so Σ section margins ≥ total margin
  whenever global discounts exist.
- Internal financials (margin/multiplier/job costs) are agent-only, reachable via the
  Internal Financials modal button (edit form toolbar + proposal page heading). There is
  no persisted display flag — `showPricingBreakdown` was removed from `fundingJSON.meta`.

**Reference impl**: `lib/financials/index.ts` — the ONLY import surface for proposal money
math. The customer-facing breakdown is a price-side-only view-model
(`buildPricingBreakdown`) rendered by the React component, the PDF builder, and the AI
summary route — computed once, so the three can't drift.
**Enforced by**: convention + the `PricingBreakdownModel` type carrying no cost fields
```

- [ ] **Step 3: Update stale path refs in `### final-tcp-derived`** (lines ~115-147): change `lib/compute-final-tcp.ts` to `lib/financials/compute-price-side.ts` in the "Canonical implementation" line, the three-stage lifecycle table's Drafting row, and the "Reference impl" line at the bottom of the rollup discussion (line ~169).

- [ ] **Step 4: Update the schema comment** above `fundingDataSchema` in `schemas/index.ts` (lines 81-84):

```ts
// `finalTcp` is NOT stored here — it is derived via
// `computeFinalTcp({ funding, sow })` in `entities/proposals/lib/financials`.
// Persisted derived values invite drift between inputs and the cached number;
// always compute on demand from `startingTcp` − global discounts − section incentives.
```

- [ ] **Step 5: Update the "Last updated" date at the bottom of DOCS.md** (convention per Rule 29), then verify + commit

Run: `pnpm lint`

```bash
git add src/shared/entities/proposals/DOCS.md src/shared/entities/proposals/schemas/index.ts
git commit -m "docs(proposals): price-side-vs-cost-side model + corrected multiplier formulas"
```

---

### Task 14: Final verification

- [ ] **Step 1: Full static + worked-example pass**

Run: `pnpm tsc && pnpm lint && pnpm tsx scripts/verify-financials-facade.ts`
Expected: all pass, all façade checks ✅.

- [ ] **Step 2: Rollup parity** — the finalTcp TS formula is unchanged, but confirm parity survived the refactor. ⚠️ `scripts/verify-final-tcp-parity.ts` NO LONGER EXISTS — it was deleted in Wave 2 ledger reconciliation (see `docs/plans/jsonb-decomposition-deprecation-ledger.md`, W2 deleted-during-implementation row) because its `finalTcpExpr` counterpart died. Write this TEMPORARY replacement, run it, then `git rm` it in the same step (it must not linger as dead code):

```ts
// scripts/verify-facade-rollup-parity.ts — TEMPORARY, delete after this step passes.
// Confirms the façade's TS finalTcp matches the Wave-2 `final_tcp_cents` rollup per proposal.
// Run: pnpm tsx scripts/verify-facade-rollup-parity.ts   (dev DB by default per env-axes)
import './lib/load-env'
import { db } from '@/shared/db'
import { proposals } from '@/shared/db/schema'
import { listProposalIncentives } from '@/shared/entities/proposals/dal/server/queries'
import { computeFinalTcp } from '@/shared/entities/proposals/lib/financials'
import { incentiveRowsToDomain } from '@/shared/entities/proposals/lib/incentive-rows'

async function main() {
  const rows = await db.select().from(proposals)
  let mismatches = 0
  for (const p of rows) {
    const incentives = incentiveRowsToDomain(await listProposalIncentives(p.id))
    const funding = { ...p.fundingJSON.data, incentives }
    const tsCents = Math.round(computeFinalTcp({ funding, sow: p.projectJSON.data.sow }) * 100)
    if (tsCents !== p.finalTcpCents) {
      mismatches++
      console.error(`❌ ${p.id}: TS ${tsCents} ≠ rollup ${String(p.finalTcpCents)}`)
    }
  }
  console.log(`${rows.length} proposals checked, ${mismatches} mismatches`)
  process.exit(mismatches > 0 ? 1 : 0)
}

void main()
```

Expected: 0 mismatches. (Adjust import specifics to the code as it exists — e.g. if `listProposalIncentives` is not exported standalone, replicate its 5-line query inline. A nonzero count on whole-dollar data is a real regression; a ±1-cent mismatch on fractional-dollar incentive amounts is the known M4 rounding-divergence backlog item — report it, don't "fix" it here.) Then:

```bash
git rm scripts/verify-facade-rollup-parity.ts
```

- [ ] **Step 3: Sweeps**

```bash
grep -rn "showPricingBreakdown" src            # expect: nothing
grep -rn "computeProposalCostTotals\|computeSectionMultiplier\|computeSectionMargin\|getMultiplierTier" src | grep -v "lib/financials\|constants/multiplier-styles"   # expect: only component usages importing from lib/financials
grep -rn "totalCosts" src/shared/entities/proposals src/features/proposal-flow   # expect: nothing (killed concept)
```

- [ ] **Step 4: Manual checks (dev server — `pnpm dev`)** — these need a human or browser tooling:

1. Edit-proposal form: calculator toolbar button opens the Internal Financials modal (breakdown + internal calc); settings popover no longer has a "Show Pricing Breakdown" switch; no inline breakdown preview in the Funding tab.
2. Main proposal page as agent (`?view=agent`): "Internal Financials" button in the heading opens the same modal; the Funding Summary shows the customer breakdown WITHOUT the red internal block inline.
3. Main proposal page without agent ability (homeowner token view): no button, no modal, breakdown numbers unchanged.
4. Internal calc modal on a proposal with section incentives + global discounts: rows read Subtotal → − Section Incentives → − Global Discounts → = Final Contract Price → − Total Job Costs → = Total Margin → Multiplier, and the multiplier equals finalTcp ÷ jobCosts (spot-check with the 27k/10k/6k example → 2.83x).
5. PDF (`/api/proposals/<id>/pdf?token=…`) and summary (`/api/proposals/<id>/summary?token=…`): identical numbers to the web breakdown; no cost/margin/multiplier anywhere.

- [ ] **Step 5: Update memory/spec status** — mark the spec's Status line as implemented (edit `docs/superpowers/specs/2026-07-14-proposal-financials-facade-design.md` header), commit:

```bash
git add docs/superpowers/specs/2026-07-14-proposal-financials-facade-design.md
git commit -m "docs(specs): financials façade — mark implemented"
```

---

## Self-review notes (already applied)

- **Spec coverage**: formulas (T1-T4), façade module (T1-T4), killed totalCosts (T4/T6), breakdown view-model + 3 renderers (T3/T7/T8), modal + toggle removal (T9), consumer map (T5-T10), old-file deletion (T11), deposit-% hotspot (T12), DOCS.md (T13), verification incl. parity + homeowner-safety manual checks (T14). Deferred-metrics backlog: intentionally no task (spec: not in scope).
- **Type consistency**: `computeSectionFinancials({ title, financials })` used identically in T2/T5/T4; `buildPricingBreakdown(input)` identical in T3/T7/T8; `PricingBreakdown` Props `{ proposalData }` after T7 matches T9's modal usage.
- **Sequencing hazard**: Tasks 7→9 leave the agent without an inline internal view until the modal lands — execute 7, 8, 9 in one session.
