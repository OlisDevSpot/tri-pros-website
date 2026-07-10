# Wave 0 — Proposal Pricing Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the live pricing bug (section incentives now officially reduce final TCP everywhere), unify the two amortization helpers, fix the always-NULL action-queue trade path, and guard the meeting→proposal incentive mapping — per spec Wave 0 + Addendum A.

**Architecture:** `computeFinalTcp` changes signature to require both funding data AND SOW sections (`{ funding, sow }`), so `pnpm tsc` mechanically surfaces every call site. The SQL mirror (`finalTcpExpr`) gains a section-incentives term. A parity script proves TS ≡ SQL over the dev DB. No schema changes in this wave.

**Tech Stack:** Next.js 15, Drizzle ORM (Postgres/Neon), tRPC, pnpm.

**Spec:** `docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md` (Wave 0 + Addendum A). **Epic:** #256.

## Global Constraints

- Verification is `pnpm tsc` + `pnpm lint` ONLY — NEVER `pnpm build` (house rule).
- There is NO test runner in this repo (testing bootstrap is a separate pending project). Verification = tsc + lint + the parity script in Task 2 + manual flow checks listed per task.
- The canonical formula (Addendum A ruling): `finalTcp = max(0, startingTcp − Σ global 'discount' incentives − Σ ALL section incentives)`.
- Money stays whole-dollar JS numbers in this wave (cents columns arrive with W2/W3 schema work — do NOT convert units here).
- Branch: `fix/256-wave-0-pricing-correctness` from `main`. PR references `#256` (do NOT close the epic). Conventional commits.
- DB scripts follow house rules: `import './lib/load-env'` (never `'dotenv/config'`); dev DB is selected via `NODE_ENV`, never `DRIZZLE_TARGET`.

---

### Task 0: Branch setup

**Files:** none

- [ ] **Step 1: Create the branch**

```bash
git checkout -b fix/256-wave-0-pricing-correctness main
```

- [ ] **Step 2: Confirm clean tsc/lint baseline**

Run: `pnpm tsc && pnpm lint`
Expected: both pass (if they fail BEFORE any change, stop and report — do not proceed on a broken baseline).

---

### Task 1: Canonical formula — new `computeFinalTcp` signature + every TS call site

**Files:**
- Modify: `src/shared/entities/proposals/lib/compute-final-tcp.ts`
- Modify: `src/shared/entities/proposals/lib/columns-registry.tsx:84`
- Modify: `src/features/proposal-flow/ui/components/proposal/funding.tsx:36,47`
- Modify: `src/features/proposal-flow/lib/get-proposal-aggregates.ts:17-18`
- Modify: `src/features/proposal-flow/ui/views/edit-proposal-view.tsx:79`
- Modify: `src/features/proposal-flow/ui/components/pricing-breakdown.tsx:22-29`
- Modify: `src/app/api/proposals/[proposalId]/summary/route.ts:121`
- Modify: `src/shared/lib/pdf/proposal-doc-definition.ts:280`
- Modify: `src/shared/services/providers/zoho-sign/lib/documents/proposal-context.ts:32`
- Modify: `src/shared/services/accounting.service.ts:137-138`
- Modify: `src/features/customer-pipelines/dal/server/get-customer-profile.ts:73,116`
- Modify: `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts:243,259,413,427`
- Modify: `src/trpc/routers/lead-sources.router.ts:219,228`

**Interfaces:**
- Produces: `computeFinalTcp(inputs: FinalTcpInputs): number` where `FinalTcpInputs = { funding: FundingSection['data'], sow: ProjectSection['data']['sow'] }`; `computeTotalSectionIncentives(sow): number`; `computeTotalDiscounts(data)` unchanged. Tasks 2–4 rely on these exact names.

- [ ] **Step 1: Rewrite the canonical helper**

Replace the full contents of `src/shared/entities/proposals/lib/compute-final-tcp.ts`:

```ts
import type { FundingSection, ProjectSection } from '@/shared/entities/proposals/types'
import { computeSectionIncentives } from '@/shared/entities/proposals/lib/compute-sow-financials'

/**
 * Canonical TCP helpers —
 *   finalTcp = max(0, startingTcp − Σ global 'discount' incentives − Σ section incentives)
 * Section incentives reduce the customer's price (business ruling 2026-07-09,
 * spec Addendum A). Never persisted. see ../DOCS.md#final-tcp-derived
 */
export function computeTotalDiscounts(data: FundingSection['data']): number {
  return data.incentives.reduce((sum, inc) => {
    return inc.type === 'discount' ? sum + inc.amount : sum
  }, 0)
}

export function computeTotalSectionIncentives(sow: ProjectSection['data']['sow']): number {
  return sow.reduce((sum, section) => sum + computeSectionIncentives(section), 0)
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

If `ProjectSection` is not exported from `@/shared/entities/proposals/types`, check `src/shared/entities/proposals/schemas/index.ts` (it is defined near line 110) and import the type from wherever `FundingSection` actually lives — both sections are declared together.

- [ ] **Step 2: Let tsc enumerate the breakage**

Run: `pnpm tsc`
Expected: FAIL with argument-type errors at exactly the call sites listed in **Files** above (plus possibly `registry.ts:250`, which only re-exports and needs no change). If a site errors that is NOT in the list, fix it with the same mechanical pattern and note it in the commit body.

- [ ] **Step 3: Fix simple call sites (caller already has both blobs)**

Apply the mechanical pattern `computeFinalTcp({ funding: <x>.fundingJSON.data, sow: <x>.projectJSON.data.sow })`:

`columns-registry.tsx:84`:
```ts
    accessorFn: row => computeFinalTcp({ funding: row.fundingJSON.data, sow: row.projectJSON.data.sow }),
```

`funding.tsx:36` and `:47` (both inside the component; `proposal.data` has both blobs):
```ts
      const tcp = computeFinalTcp({ funding: proposal.data.fundingJSON.data, sow: proposal.data.projectJSON.data.sow })
```
```ts
    return computeFinalTcp({ funding: proposal.data.fundingJSON.data, sow: proposal.data.projectJSON.data.sow }) - cashInDeal
```

`get-proposal-aggregates.ts:18`:
```ts
    finalTcp: computeFinalTcp({ funding: fundingJSON.data, sow: projectJSON.data.sow }),
```

`edit-proposal-view.tsx:79`:
```ts
    const nextFinalTcp = computeFinalTcp({ funding: rawData.funding.data, sow: rawData.project.data.sow })
```

`summary/route.ts:121`:
```ts
  lines.push(`\n**Final Contract Price:** ${formatAsDollars(computeFinalTcp({ funding: fund, sow: proj.sow }))}`)
```

`proposal-doc-definition.ts:280` (`buildInvestment` already receives `sow` as its first parameter):
```ts
    { text: formatAsDollars(computeFinalTcp({ funding, sow })), bold: true, fontSize: 12, alignment: 'right' },
```

`proposal-context.ts:32`:
```ts
    finalTcp: computeFinalTcp({ funding: proposal.fundingJSON.data, sow: proposal.projectJSON.data.sow ?? [] }),
```

`accounting.service.ts:137-138`:
```ts
          const funding = proposal.fundingJSON?.data
          const sow = proposal.projectJSON?.data.sow ?? []
          const amount = funding ? computeFinalTcp({ funding, sow }) : 0
```

- [ ] **Step 4: Fix `PricingBreakdown` — it becomes a pure consumer of the canonical formula**

In `pricing-breakdown.tsx`, replace lines 21-29:

```ts
  const { incentives: globalIncentives, miscPrice, startingTcp } = proposalData.fundingJSON.data

  // Canonical formula (spec Addendum A): section incentives reduce the price.
  const finalTcp = computeFinalTcp({ funding: proposalData.fundingJSON.data, sow })
  const totalSectionIncentives = sow.reduce(
    (sum, section) => sum + computeSectionIncentives(section),
    0,
  )
```

(The `globalTcp` variable and the local `Math.max(0, globalTcp - totalSectionIncentives)` are deleted; `totalSectionIncentives` is still used by the Subtotal row at line 112. Everything else in the component is unchanged.)

- [ ] **Step 5: Fix DAL/router selects that fetch `fundingJSON` only — add `projectJSON`**

`get-customer-profile.ts` — in the proposals select (around line 73), add one line and update the consumer:
```ts
      fundingJSON: proposals.fundingJSON,
      projectJSON: proposals.projectJSON,
```
```ts
      value: computeFinalTcp({ funding: p.fundingJSON.data, sow: p.projectJSON.data.sow }),
```

`get-customer-pipeline-items.ts` — BOTH selects (lines ~243 and ~413) get:
```ts
      fundingJSON: proposals.fundingJSON,
      projectJSON: proposals.projectJSON,
```
and both consumers (lines ~259 and ~427):
```ts
    const value = computeFinalTcp({ funding: r.fundingJSON.data, sow: r.projectJSON.data.sow })
```
(second site uses `p.` instead of `r.` — match the existing variable name).

`lead-sources.router.ts:219`:
```ts
          .select({ fundingJSON: proposals.fundingJSON, projectJSON: proposals.projectJSON })
```
and line 228:
```ts
        totalSales += computeFinalTcp({ funding: p.fundingJSON.data, sow: p.projectJSON.data.sow })
```

- [ ] **Step 6: Verify clean**

Run: `pnpm tsc && pnpm lint`
Expected: PASS, zero errors.

- [ ] **Step 7: Commit**

```bash
git add src/shared/entities/proposals/lib/compute-final-tcp.ts src/shared/entities/proposals/lib/columns-registry.tsx src/features/proposal-flow src/app/api/proposals src/shared/lib/pdf/proposal-doc-definition.ts src/shared/services/providers/zoho-sign/lib/documents/proposal-context.ts src/shared/services/accounting.service.ts src/features/customer-pipelines/dal/server/get-customer-profile.ts src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts src/trpc/routers/lead-sources.router.ts
git commit -m "fix(proposals): section incentives reduce final TCP — unify canonical formula (#256)"
```

---

### Task 2: SQL mirror + parity proof

**Files:**
- Modify: `src/shared/entities/proposals/dal/server/queries.ts:156-165`
- Create: `scripts/verify-final-tcp-parity.ts`

**Interfaces:**
- Consumes: `computeFinalTcp(FinalTcpInputs)` from Task 1.
- Produces: `finalTcpExpr` (unchanged name, extended semantics); the parity script becomes the seed of W2's verify/repair script.

- [ ] **Step 1: Extend `finalTcpExpr` with the section-incentives term**

Replace lines 156-165 of `queries.ts`:

```ts
    // SQL mirror of `computeFinalTcp` (incl. section incentives — spec Addendum A).
    // Temporary jsonb form: W2 replaces this with the stored final_tcp_cents rollup.
    // see ../../DOCS.md#final-tcp-derived
    const finalTcpExpr = sql<number>`GREATEST(
      0::numeric,
      COALESCE((${proposals.fundingJSON}->'data'->>'startingTcp')::numeric, 0)
      - COALESCE((
          SELECT SUM((inc->>'amount')::numeric)
          FROM jsonb_array_elements(${proposals.fundingJSON}->'data'->'incentives') AS inc
          WHERE inc->>'type' = 'discount'
        ), 0)
      - COALESCE((
          SELECT SUM((si->>'amount')::numeric)
          FROM jsonb_array_elements(${proposals.projectJSON}->'data'->'sow') AS sec,
               jsonb_array_elements(COALESCE(sec->'financials'->'incentives', '[]'::jsonb)) AS si
        ), 0)
    )`
```

- [ ] **Step 2: Write the parity script**

Create `scripts/verify-final-tcp-parity.ts`:

```ts
import './lib/load-env'
import { sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { proposals } from '@/shared/db/schema'
import { computeFinalTcp } from '@/shared/entities/proposals/lib/compute-final-tcp'

/**
 * Wave 0 parity check: TS canonical formula vs the SQL mirror, over every
 * proposal row. Non-zero exit on any mismatch. Seed of the W2 verify script.
 */
async function main() {
  const sqlTcp = sql<string>`GREATEST(
    0::numeric,
    COALESCE((${proposals.fundingJSON}->'data'->>'startingTcp')::numeric, 0)
    - COALESCE((
        SELECT SUM((inc->>'amount')::numeric)
        FROM jsonb_array_elements(${proposals.fundingJSON}->'data'->'incentives') AS inc
        WHERE inc->>'type' = 'discount'
      ), 0)
    - COALESCE((
        SELECT SUM((si->>'amount')::numeric)
        FROM jsonb_array_elements(${proposals.projectJSON}->'data'->'sow') AS sec,
             jsonb_array_elements(COALESCE(sec->'financials'->'incentives', '[]'::jsonb)) AS si
      ), 0)
  )`

  const rows = await db
    .select({
      id: proposals.id,
      fundingJSON: proposals.fundingJSON,
      projectJSON: proposals.projectJSON,
      sqlTcp,
    })
    .from(proposals)

  let mismatches = 0
  for (const row of rows) {
    const tsTcp = computeFinalTcp({ funding: row.fundingJSON.data, sow: row.projectJSON.data.sow })
    const dbTcp = Number(row.sqlTcp)
    if (tsTcp !== dbTcp) {
      mismatches++
      console.error(`MISMATCH proposal=${row.id} ts=${tsTcp} sql=${dbTcp}`)
    }
  }

  console.warn(`checked=${rows.length} mismatches=${mismatches}`)
  if (mismatches > 0) {
    process.exit(1)
  }
}

main().then(() => process.exit(0))
```

(If `scripts/` uses a different db import path, mirror whatever `scripts/backfill-sow-financials.ts` imports — that script already reads proposals.)

- [ ] **Step 3: Run the parity script against the dev DB**

Run: `pnpm tsx scripts/verify-final-tcp-parity.ts`
Expected: `checked=<N> mismatches=0`, exit 0. Any mismatch = the TS and SQL implementations disagree on a real row — STOP, diagnose (likely null-shape handling in a legacy blob), fix the SQL or the TS null-guard, re-run until 0.

- [ ] **Step 4: Verify clean + commit**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

```bash
git add src/shared/entities/proposals/dal/server/queries.ts scripts/verify-final-tcp-parity.ts
git commit -m "fix(proposals): finalTcpExpr subtracts section incentives; add TS↔SQL parity script (#256)"
```

---

### Task 3: PDF + AI-summary display — show section incentives as discount rows

**Files:**
- Modify: `src/shared/lib/pdf/proposal-doc-definition.ts:264-277` (inside `buildInvestment`)
- Modify: `src/app/api/proposals/[proposalId]/summary/route.ts:109-119`

**Interfaces:**
- Consumes: nothing new (Task 1 already fixed both files' final-price row).

- [ ] **Step 1: PDF — add section-incentive rows after the global-incentives loop**

In `buildInvestment` (`proposal-doc-definition.ts`), directly after the `for (const inc of funding.incentives)` loop closes (line 277) and BEFORE the "Final contract price" row, insert:

```ts
  for (const section of sow) {
    for (const inc of section.financials.incentives ?? []) {
      rows.push([
        { text: `Discount — ${inc.label || section.title || 'Section'}`, color: '#166534' },
        { text: `-${formatAsDollars(inc.amount)}`, alignment: 'right', color: '#166534' },
      ])
    }
  }
```

Table arithmetic stays coherent in both pricing modes: section rows/contract price sum to the Subtotal (`startingTcp`), then global + section discounts subtract, and the final row is the canonical `computeFinalTcp` — the columns now add up.

- [ ] **Step 2: Summary route — same addition**

In `summary/route.ts`, replace lines 109-119:

```ts
  const sectionIncentiveLines = proj.sow.flatMap(s =>
    (s.financials.incentives ?? []).map(inc =>
      `- Discount: -${formatAsDollars(inc.amount)}${inc.label ? ` (${inc.label})` : s.title ? ` (${s.title})` : ''}`,
    ),
  )
  if (fund.incentives.length > 0 || sectionIncentiveLines.length > 0) {
    lines.push('\n**Incentives:**')
    for (const inc of fund.incentives) {
      if (inc.type === 'discount') {
        lines.push(`- Discount: -${formatAsDollars(inc.amount)}${inc.notes ? ` (${inc.notes})` : ''}`)
      }
      else {
        lines.push(`- Exclusive Offer: ${inc.offer}${inc.notes ? ` — ${inc.notes}` : ''}`)
      }
    }
    lines.push(...sectionIncentiveLines)
  }
```

- [ ] **Step 3: Manual verification**

Start dev (`pnpm dev`), open a proposal that has at least one section incentive (create one in the edit form if none exists on dev data), then:
1. Proposal-flow pricing breakdown, the PDF (`/api/proposals/<id>/pdf`), and the summary route must all show the SAME final contract price.
2. In the PDF, visually add the column: sections + misc = subtotal; subtotal − all discount rows = final. It must reconcile.

- [ ] **Step 4: Verify clean + commit**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

```bash
git add src/shared/lib/pdf/proposal-doc-definition.ts "src/app/api/proposals/[proposalId]/summary/route.ts"
git commit -m "fix(proposals): PDF + summary show section incentives as discount rows (#256)"
```

---

### Task 4: Update `DOCS.md#final-tcp-derived`

**Files:**
- Modify: `src/shared/entities/proposals/DOCS.md` (the `#final-tcp-derived` section, around lines 106-120)

- [ ] **Step 1: Rewrite the formula paragraph**

Read the existing `#final-tcp-derived` section first (do not change its anchor). Replace the formula statement with:

```markdown
**Formula** (business ruling 2026-07-09, spec Addendum A — section incentives reduce the price):

    finalTcp = max(0, startingTcp − Σ global incentives where type='discount' − Σ ALL section incentives)

Canonical implementation: `computeFinalTcp({ funding, sow })` in `lib/compute-final-tcp.ts` — it now
requires BOTH the funding data and the SOW sections. The SQL mirror in `dal/server/queries.ts`
(`finalTcpExpr`) implements the same formula for list filter/sort and is parity-checked by
`scripts/verify-final-tcp-parity.ts`; it is temporary and will be replaced by the stored
`final_tcp_cents` rollup in decomposition Wave 2
(see `docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md` Addendum A).
```

Keep any surrounding never-persist language intact.

- [ ] **Step 2: Commit**

```bash
git add src/shared/entities/proposals/DOCS.md
git commit -m "docs(proposals): final-tcp-derived — ruled formula incl. section incentives (#256)"
```

---

### Task 5: Unify amortization into one implementation

**Files:**
- Modify: `src/shared/lib/loan-calculations.ts`
- Modify: `src/shared/entities/meetings/lib/compute-deal-derived.ts:34-38`

**Interfaces:**
- Produces: `amortizedMonthlyPayment(principal: number, annualRatePercent: number, termMonths: number): number` — the ONE amortization formula. `getLoanValues(principal, annualRateFraction, months)` keeps its signature (finance_options stores fractions) but delegates.

- [ ] **Step 1: Rewrite `loan-calculations.ts`**

```ts
/**
 * Canonical amortized monthly payment — the ONE implementation app-wide.
 * `annualRatePercent` is a PERCENT number (9.99 means 9.99% APR).
 * 0% APR → straight principal/term. Non-positive principal or term → 0.
 */
export function amortizedMonthlyPayment(
  principal: number,
  annualRatePercent: number,
  termMonths: number,
): number {
  if (principal <= 0 || termMonths <= 0) {
    return 0
  }
  if (annualRatePercent === 0) {
    return principal / termMonths
  }
  const monthlyRate = annualRatePercent / 100 / 12
  return (principal * monthlyRate) / (1 - (1 + monthlyRate) ** -termMonths)
}

/**
 * Loan display values for finance options.
 * NOTE: `annualRateFraction` is a DECIMAL FRACTION (0.0999 means 9.99% APR) —
 * that is how `finance_options.interestRate` is stored. Converted here, once.
 */
export function getLoanValues(principal: number, annualRateFraction: number, months: number) {
  const monthly = amortizedMonthlyPayment(principal, annualRateFraction * 100, months)
  const annually = monthly * 12

  return {
    monthly,
    monthlyFormatted: monthly.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }),
    annually,
    annuallyFormatted: annually.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }),
  }
}
```

- [ ] **Step 2: Delegate `computeDealMonthlyPayment`**

In `compute-deal-derived.ts`, add the import and replace the body's tail (lines 31-38):

```ts
import { amortizedMonthlyPayment } from '@/shared/lib/loan-calculations'
```

```ts
  if (finalTcp <= 0 || termMonths <= 0) {
    return 0
  }
  return amortizedMonthlyPayment(finalTcp, apr, termMonths)
```

(The local `apr === 0` branch and inline formula are deleted — the canonical helper handles both.)

- [ ] **Step 3: Sanity-check the delegation preserves behavior**

Run: `pnpm tsx -e "import { amortizedMonthlyPayment } from './src/shared/lib/loan-calculations'; console.log(amortizedMonthlyPayment(10000, 0, 12), amortizedMonthlyPayment(10000, 9.99, 60))"`
Expected: first value exactly `833.3333333333334` (0% guard works — this NaN'd before via `getLoanValues`), second ≈ `212.4` (a plausible 5-year payment; must NOT be NaN or ≈ `10.6`, which would indicate a fraction/percent mixup). If the tsx alias `@/` fails in `-e` mode, use relative import as shown.

- [ ] **Step 4: Verify clean + commit**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

```bash
git add src/shared/lib/loan-calculations.ts src/shared/entities/meetings/lib/compute-deal-derived.ts
git commit -m "fix(shared): one amortization implementation — zero-rate guard, explicit APR conventions (#256)"
```

---

### Task 6: Fix the always-NULL action-queue trade path

**Files:**
- Modify: `src/features/agent-dashboard/dal/server/get-action-queue.ts:125`

- [ ] **Step 1: Fix the JSON path**

Replace line 125:

```ts
      trade: sql<string | null>`${proposals.projectJSON}->'data'->'sow'->0->'trade'->>'label'`.as('trade'),
```

(Matches the correct path used in `get-customer-profile.ts:72`. This positional hack is retired entirely in Wave 3.)

- [ ] **Step 2: Manual verification**

With dev running, open the agent dashboard action queue: sent proposals must now show their trade label instead of blank.

- [ ] **Step 3: Verify clean + commit**

Run: `pnpm tsc && pnpm lint` → PASS.

```bash
git add src/features/agent-dashboard/dal/server/get-action-queue.ts
git commit -m "fix(dashboard): action-queue trade label read wrong JSON path — was always NULL (#256)"
```

---

### Task 7: Guard the meeting→proposal incentive mapping

**Files:**
- Modify: `src/features/meeting-flow/lib/build-proposal-defaults.ts:45-51`

- [ ] **Step 1: Only positive-amount meeting incentives become `discount` incentives**

Replace lines 45-51:

```ts
    // Map incentives. Only positive amounts may become price-reducing
    // 'discount' incentives on the proposal — a zero/absent amount at the
    // meeting stage is informational and must not survive the handoff as a
    // price cut. see spec Addendum A (#256).
    if (ds.incentives && ds.incentives.length > 0) {
      defaults.funding.data.incentives = ds.incentives
        .filter(inc => (inc.amount ?? 0) > 0)
        .map(inc => ({
          type: 'discount' as const,
          amount: inc.amount ?? 0,
          notes: `${inc.label} (${inc.source})`,
        }))
    }
```

- [ ] **Step 2: Verify clean + commit**

Run: `pnpm tsc && pnpm lint` → PASS.

```bash
git add src/features/meeting-flow/lib/build-proposal-defaults.ts
git commit -m "fix(meeting-flow): only positive-amount incentives map to proposal discounts (#256)"
```

---

### Task 8: Final verification + PR

**Files:** none new

- [ ] **Step 1: Full gate**

Run: `pnpm tsc && pnpm lint && pnpm tsx scripts/verify-final-tcp-parity.ts`
Expected: all pass, `mismatches=0`.

- [ ] **Step 2: Manual end-to-end flow**

With dev running, walk one proposal that has BOTH a global discount and a section incentive through: edit form (live totals), pricing breakdown, list view sorted by price (order must reflect the new formula), PDF, AI summary. All five surfaces must show the identical final price.

- [ ] **Step 3: Open the PR**

```bash
git push -u origin fix/256-wave-0-pricing-correctness
gh pr create --repo OlisDevSpot/tri-pros-website \
  --title "fix: Wave 0 — proposal pricing correctness (epic #256)" \
  --body "## Summary
Wave 0 of the database-standardization epic #256 (spec: docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md, Addendum A).

- Section incentives now reduce final TCP everywhere (canonical formula, SQL mirror, PDF, Zoho context, AI summary, list sort, pipeline/lead-source rollups) — fixes the live UI-vs-document price disagreement
- One amortization implementation (0% APR guard; explicit percent-vs-fraction conventions)
- Action-queue trade label JSON path fixed (was always NULL)
- Meeting→proposal incentive mapping guarded to positive amounts

## Test Plan
- pnpm tsc + pnpm lint clean
- scripts/verify-final-tcp-parity.ts: TS ≡ SQL over all dev-DB proposals, mismatches=0
- Manual: five surfaces (form, breakdown, list sort, PDF, summary) show identical final price on a proposal with global + section incentives

References #256

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 4: Tick the Wave 0 checkbox on epic #256** (after merge)

```bash
gh issue view 256 --repo OlisDevSpot/tri-pros-website  # edit body: mark Wave 0 done
```
