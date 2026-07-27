# Wave 3 — Funding/Meta Scalar Decomposition + Drop Ceremony — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose `proposals.fundingJSON`/`formMetaJSON` into six plain columns, freeze both blobs, and batch the W1/W2 frozen-column drops + `signing_request_id` → `contract_envelope_id` rename into this wave's prod ceremony.

**Architecture:** Additive columns land first; a parity-checked backfill fills them; `getFullView` grows a `funding` view-model assembled from columns + incentive rows; consumers migrate group-by-group (tsc-green at every commit); writers flip; then the "contract" commit freezes the blobs and deletes the scrub bridge. The drop ceremony is code-deletion + a human-executed runbook. Spec: `docs/superpowers/specs/2026-07-26-wave-3-scalar-decomposition-design.md`.

**Tech Stack:** Next.js 15, Drizzle (Neon Postgres, push-based), tRPC Entity Server System, Zod, RHF. No test framework — verification is `pnpm tsc` + `pnpm lint` + verify scripts + the backfill's built-in parity check.

## Global Constraints

- Verification = `pnpm tsc` + `pnpm lint`. **NEVER `pnpm build`.**
- Dev schema sync = `pnpm db:push:dev` only. Prod = `pnpm db:push:prod`, human-run, ceremony only.
- Prod data access from scripts = `DRIZZLE_TARGET=prod` prefix ONLY (never NODE_ENV).
- Money columns are integer cents (`*_cents`, `bigint({ mode: 'number' })`); forms/domain stay dollars; convert via `Math.round(x * 100)` in / `x / 100` out.
- No pgEnums (Addendum C): vocabularies are `text({ enum: constArray })`; the W3 push contains ZERO `CREATE TYPE`.
- Named exports only; no manual `updatedAt` (`.$onUpdate()` handles it).
- Work on `main`; stage files explicitly by path (never `git add -A`).
- Any step touching the deprecation ledger: an unchecked row is scheduled scaffolding, not cruft — consult `docs/plans/jsonb-decomposition-deprecation-ledger.md` first.

---

### Task 1: Six additive columns on `proposals`

**Files:**
- Modify: `src/shared/db/schema/proposals.ts`

**Interfaces:**
- Produces: `proposals.startingTcpCents` / `depositAmountCents` / `cashInDealCents` / `miscPriceCents` (`number | null`), `proposals.priceDisplayMode` (`'total' | 'breakdown'`), `proposals.envelopeDocumentIds` (`string[] | null`) — every later task reads these property names.

- [ ] **Step 1: Add the columns**

In `src/shared/db/schema/proposals.ts`, extend the import from `@/shared/constants/enums` (line 9) to include `envelopeDocumentIds`, and insert after the three blob columns (line 41):

```ts
  // ── Wave 3 (epic #256): fundingJSON/formMetaJSON scalars promoted to
  // columns. Money is integer cents; nullable only for the additive/backfill
  // window (Zod requires values on write). fundingJSON/formMetaJSON freeze at
  // the W3 cutover — see the deprecation ledger "Waves 3 & 4" section.
  startingTcpCents: bigint('starting_tcp_cents', { mode: 'number' }),
  depositAmountCents: bigint('deposit_amount_cents', { mode: 'number' }),
  cashInDealCents: bigint('cash_in_deal_cents', { mode: 'number' }),
  // Dies post-waves (pricing-editor ruling: misc = just another SOW section).
  miscPriceCents: bigint('misc_price_cents', { mode: 'number' }),
  // Named for the ratified end-state vocabulary (pricingMode → priceDisplayMode,
  // 2026-07-24 ruling). Until the pricing editor lands it still gates authoring
  // behavior (breakdown-mode validation + client-side startingTcp sync).
  priceDisplayMode: text('price_display_mode', { enum: ['total', 'breakdown'] }).notNull().default('total'),
  // see ../entities/proposals/DOCS.md#agreement-context-as-coherent-unit
  envelopeDocumentIds: text('envelope_document_ids').array(),
```

- [ ] **Step 2: Zod overrides on the insert schema**

In the same file, extend `createInsertSchema(proposals, { ... })` (line 100) with:

```ts
export const insertProposalSchema = createInsertSchema(proposals, {
  projectJSON: projectSectionSchema,
  fundingJSON: fundingSectionSchema,
  startingTcpCents: z.number().int().min(0).nullish(),
  depositAmountCents: z.number().int().min(0).nullish(),
  cashInDealCents: z.number().int().min(0).nullish(),
  miscPriceCents: z.number().int().min(0).nullish(),
  envelopeDocumentIds: z.array(z.enum(envelopeDocumentIds)).nullish(),
})
```

(keep the existing `.omit()`/`.extend()` chain unchanged).

- [ ] **Step 3: Push to dev DB and verify**

Run: `pnpm db:push:dev` (review the diff: exactly 6 `ADD COLUMN`, zero `CREATE TYPE`), then `pnpm tsc && pnpm lint`.
Expected: clean push, tsc/lint pass.

- [ ] **Step 4: Commit**

```bash
git add src/shared/db/schema/proposals.ts
git commit -m "feat(proposals): add W3 scalar columns (funding cents + price_display_mode + envelope_document_ids)"
```

---

### Task 2: `FundingData` view-model type + dollars↔cents mapper pair

**Files:**
- Modify: `src/shared/entities/proposals/types.ts`
- Create: `src/shared/entities/proposals/lib/funding-columns.ts`

**Interfaces:**
- Consumes: Task 1 column properties.
- Produces: `type FundingData = FundingSection['data']` (exported from `types.ts`); `fundingColumnsToDomain(row, incentives): FundingData` and `fundingDomainToColumns(data): { startingTcpCents, depositAmountCents, cashInDealCents, miscPriceCents }` (exported from `lib/funding-columns.ts`). Tasks 3–9 use these exact names.

- [ ] **Step 1: Export the view-model type**

In `src/shared/entities/proposals/types.ts` add:

```ts
/** Flat dollars view-model assembled from the W3 cents columns + incentive
 *  rows (getFullView) AND the live RHF funding form state — one shape for the
 *  financials façade. Tally marker: re-examine post-waves (ledger). */
export type FundingData = FundingSection['data']
```

- [ ] **Step 2: Create the mapper pair**

Create `src/shared/entities/proposals/lib/funding-columns.ts` (pattern: `lib/incentive-rows.ts`):

```ts
import type { ProposalIncentiveRow } from '@/shared/db/schema'
import type { FundingData } from '@/shared/entities/proposals/types'

import { incentiveRowsToDomain } from '@/shared/entities/proposals/lib/incentive-rows'

interface FundingColumns {
  startingTcpCents: number | null
  depositAmountCents: number | null
  cashInDealCents: number | null
  miscPriceCents: number | null
}

/** Columns + incentive rows → the dollars view-model the façade/UI/PDF speak. */
export function fundingColumnsToDomain(
  row: FundingColumns,
  incentives: ProposalIncentiveRow[],
): FundingData {
  return {
    startingTcp: (row.startingTcpCents ?? 0) / 100,
    depositAmount: (row.depositAmountCents ?? 0) / 100,
    cashInDeal: (row.cashInDealCents ?? 0) / 100,
    ...(row.miscPriceCents == null ? {} : { miscPrice: row.miscPriceCents / 100 }),
    incentives: incentiveRowsToDomain(incentives),
  }
}

/** Form dollars → column cents. Incentives are NOT here — they are rows
 *  (replaceProposalIncentives). */
export function fundingDomainToColumns(
  data: Pick<FundingData, 'startingTcp' | 'depositAmount' | 'cashInDeal' | 'miscPrice'>,
): FundingColumns {
  return {
    startingTcpCents: Math.round(data.startingTcp * 100),
    depositAmountCents: Math.round(data.depositAmount * 100),
    cashInDealCents: Math.round(data.cashInDeal * 100),
    miscPriceCents: data.miscPrice == null ? null : Math.round(data.miscPrice * 100),
  }
}
```

- [ ] **Step 3: Verify + commit**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

```bash
git add src/shared/entities/proposals/types.ts src/shared/entities/proposals/lib/funding-columns.ts
git commit -m "feat(proposals): FundingData view-model type + funding column mappers"
```

---

### Task 3: Backfill script with built-in parity check

**Files:**
- Create: `scripts/backfill-wave3-scalars.ts`

**Interfaces:**
- Consumes: Task 1 columns, `fundingSectionSchema` / `formMetaSectionSchema` from `@/shared/entities/proposals/schemas`.
- Produces: `pnpm tsx scripts/backfill-wave3-scalars.ts [--dry-run]` — idempotent, exits non-zero on any Zod failure or parity mismatch.

- [ ] **Step 1: Write the script**

Copy the harness shape of `scripts/backfill-wave2-children.ts` (db singleton via `@/shared/db`, `describeTargetDb` banner, `--dry-run` flag). Core loop:

```ts
// ⚠️ CUTOVER-WINDOW-ONLY (like backfill-wave2-children before it): the blobs
// are the source of truth ONLY until the Wave-3 cutover release flips writers.
// After deploy, a full re-run would overwrite live column data with stale blob
// data. Post-deploy verification: --dry-run only (reports drift, writes nothing).
// Dies with the frozen blobs on the Wave-4 push (deprecation ledger).
import { eq } from 'drizzle-orm'

import { db } from '@/shared/db'
import { proposals } from '@/shared/db/schema'
import { formMetaSectionSchema, fundingSectionSchema } from '@/shared/entities/proposals/schemas'

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const rows = await db.select({
    id: proposals.id,
    fundingJSON: proposals.fundingJSON,
    formMetaJSON: proposals.formMetaJSON,
    startingTcpCents: proposals.startingTcpCents,
    depositAmountCents: proposals.depositAmountCents,
    cashInDealCents: proposals.cashInDealCents,
    miscPriceCents: proposals.miscPriceCents,
    priceDisplayMode: proposals.priceDisplayMode,
    envelopeDocumentIds: proposals.envelopeDocumentIds,
  }).from(proposals)

  const failures: string[] = []
  let written = 0
  for (const row of rows) {
    const funding = fundingSectionSchema.safeParse(row.fundingJSON)
    const formMeta = formMetaSectionSchema.safeParse(row.formMetaJSON)
    if (!funding.success || !formMeta.success) {
      failures.push(`${row.id}: zod ${funding.success ? 'formMeta' : 'funding'} ${(funding.error ?? formMeta.error)?.message}`)
      continue
    }
    const f = funding.data.data
    const target = {
      startingTcpCents: Math.round(f.startingTcp * 100),
      depositAmountCents: Math.round(f.depositAmount * 100),
      cashInDealCents: Math.round(f.cashInDeal * 100),
      miscPriceCents: f.miscPrice == null ? null : Math.round(f.miscPrice * 100),
      priceDisplayMode: formMeta.data.pricingMode,
      envelopeDocumentIds: formMeta.data.envelopeDocumentIds ?? null,
    }
    if (!dryRun) {
      await db.update(proposals).set(target).where(eq(proposals.id, row.id))
      written++
    }
    // Parity: read back and field-diff against the blob-derived target.
    const [back] = await db.select({
      startingTcpCents: proposals.startingTcpCents,
      depositAmountCents: proposals.depositAmountCents,
      cashInDealCents: proposals.cashInDealCents,
      miscPriceCents: proposals.miscPriceCents,
      priceDisplayMode: proposals.priceDisplayMode,
      envelopeDocumentIds: proposals.envelopeDocumentIds,
    }).from(proposals).where(eq(proposals.id, row.id))
    const source = dryRun ? row : back
    for (const key of Object.keys(target) as (keyof typeof target)[]) {
      const a = JSON.stringify(source?.[key] ?? null)
      const b = JSON.stringify(target[key])
      if (!dryRun && a !== b) failures.push(`${row.id}: parity ${key} column=${a} blob=${b}`)
      if (dryRun && a !== b) console.log(`[dry-run] ${row.id}: would set ${key} ${a} → ${b}`)
    }
  }
  console.log(`${rows.length} proposals scanned, ${written} written, ${failures.length} failures`)
  if (failures.length > 0) {
    failures.forEach(f => console.error(`FAIL ${f}`))
    process.exit(1)
  }
}
main().then(() => process.exit(0))
```

(Adjust the `describeTargetDb` banner import to match `backfill-wave2-children.ts` exactly — copy its first ~30 lines.)

- [ ] **Step 2: Dry-run, real run, idempotence re-run on dev**

Run: `pnpm tsx scripts/backfill-wave3-scalars.ts --dry-run`, then without the flag, then without the flag AGAIN.
Expected: dry-run lists would-set lines; real run writes with 0 failures; second real run converges (0 failures, same values — idempotent).

- [ ] **Step 3: Verify + commit**

Run: `pnpm tsc && pnpm lint`

```bash
git add scripts/backfill-wave3-scalars.ts
git commit -m "feat(scripts): wave-3 scalar backfill with per-row zod + parity gate"
```

---

### Task 4: `getFullView` grows the `funding` view-model (expand — blob shape still served)

**Files:**
- Modify: `src/shared/entities/proposals/dal/server/queries.ts:47-52,139-151`

**Interfaces:**
- Consumes: `fundingColumnsToDomain` (Task 2).
- Produces: `ProposalWithCustomer` gains `funding: FundingData`. `fundingJSON` hydration REMAINS until Task 9 (both shapes served during the migration window).

- [ ] **Step 1: Extend the type and assembly**

In `queries.ts`, add to `ProposalWithCustomer` (line 47):

```ts
export type ProposalWithCustomer = Proposal & {
  customer: ProposalCustomer | null
  meetingProjectId: string | null
  projectFirstContractSentAt: string | null
  incentives: ProposalIncentiveRow[]
  /** W3 view-model: dollars, assembled from cents columns + incentive rows. */
  funding: FundingData
}
```

and in `getFullView`, after the `incentives` fetch (line 144), add the assembly and include it in the return:

```ts
    const funding = fundingColumnsToDomain(row, incentives)
    // ...existing hydratedFunding block stays until every consumer migrates (Task 9)...
    return { ...row, fundingJSON: hydratedFunding, funding, customer, incentives } as ProposalWithCustomer
```

Import `fundingColumnsToDomain` from `@/shared/entities/proposals/lib/funding-columns` and `FundingData` from the types module.

- [ ] **Step 2: Verify + commit**

Run: `pnpm tsc && pnpm lint`
Expected: PASS (additive — no consumer breaks).

```bash
git add src/shared/entities/proposals/dal/server/queries.ts
git commit -m "feat(proposals): getFullView assembles funding view-model from columns (expand phase)"
```

---

### Task 5: Form-shape rename `meta.pricingMode` → `meta.priceDisplayMode`

**Files:**
- Modify: `src/shared/entities/proposals/schemas/index.ts:98-108,142-170,174-206`
- Modify: every form reference (grep-driven): `features/proposal-flow/ui/components/form/funding-fields.tsx`, `form/index.tsx`, `ui/views/*.tsx`, `features/proposal-flow/lib/converters.ts`, `ui/components/proposal/scope-of-work.tsx`, `envelope-configuration-section.tsx`

**Interfaces:**
- Produces: `formMetaSectionSchema` field `priceDisplayMode` (was `pricingMode`); `ProposalFormSchema['meta'].priceDisplayMode`. All later tasks use the NEW name.

- [ ] **Step 1: Rename in the schema**

In `schemas/index.ts` (~line 98), rename the field inside `formMetaSectionSchema`:

```ts
export const formMetaSectionSchema = z.object({
  // Ratified vocabulary (2026-07-24 pricing-editor ruling): display preference.
  // Until that editor lands it still gates breakdown-mode validation + the
  // client-side startingTcp sync — interim coupling, documented in the W3 spec.
  priceDisplayMode: z.enum(['total', 'breakdown']),
  envelopeDocumentIds: z.array(z.enum(envelopeDocumentIds)).nullish(),
})
```

and update the `superRefine` (~line 143) `proposal.meta.pricingMode` → `proposal.meta.priceDisplayMode`, plus `proposalFormBaseDefaultValues`.

- [ ] **Step 2: tsc-driven sweep**

Run: `pnpm tsc` — fix every error by renaming the access path (`meta.pricingMode` → `meta.priceDisplayMode`, `formMetaJSON.pricingMode` → keep reading `formMetaJSON.pricingMode` ONLY where it reads the DB blob — those flip in Tasks 6–7; form-state reads rename now). Then `grep -rn "pricingMode" src/features/proposal-flow src/shared/entities/proposals` and confirm every remaining hit is a DB-blob read (queries/display), not form state.

- [ ] **Step 3: Verify + commit**

Run: `pnpm tsc && pnpm lint`

```bash
git add -u src/features/proposal-flow src/shared/entities/proposals
git commit -m "refactor(proposals): rename form pricingMode → priceDisplayMode (ratified vocabulary)"
```

---

### Task 6: Display consumers read `proposal.funding` + columns (proposal-flow UI + converters)

**Files:**
- Modify: `features/proposal-flow/ui/components/proposal/funding.tsx`, `pricing-breakdown.tsx`, `pricing-breakdown/internal-calculation-block.tsx`, `proposal/project-overview.tsx`, `proposal/scope-of-work.tsx`, `envelope-configuration-section.tsx`, `features/proposal-flow/lib/converters.ts`, `ui/views/edit-proposal-view.tsx` (hydration side only)

**Interfaces:**
- Consumes: `proposal.funding` (Task 4), `proposal.priceDisplayMode` / `proposal.envelopeDocumentIds` (Task 1 columns — already on the row).
- Produces: zero `fundingJSON` / `formMetaJSON` reads left in `features/proposal-flow` display code.

- [ ] **Step 1: Mechanical path swap, file by file**

| Old read | New read |
|---|---|
| `proposal.data.fundingJSON.data.X` | `proposal.data.funding.X` |
| `proposal.data.formMetaJSON.pricingMode` | `proposal.data.priceDisplayMode` |
| `proposal.data.formMetaJSON?.envelopeDocumentIds` | `proposal.data.envelopeDocumentIds` |

Façade call sites pass `funding` directly, e.g. in `funding.tsx`:

```ts
const finalTcp = computeFinalTcp({
  funding: proposal.data.funding,
  sow: proposal.data.projectJSON.data.sow,
})
```

In `converters.ts` (`proposalToFormValues`), build form values from the view-model + columns:

```ts
export function proposalToFormValues(proposal: ProposalWithCustomer): ProposalFormSchema {
  return {
    meta: {
      priceDisplayMode: proposal.priceDisplayMode,
      envelopeDocumentIds: proposal.envelopeDocumentIds,
    },
    project: proposal.projectJSON,
    funding: { data: proposal.funding, meta: { enabled: true } },
  }
}
```

- [ ] **Step 2: Rename the façade's input field**

In `entities/proposals/lib/financials/compute-breakdown.ts` (and `compute-totals.ts` if it carries the field), rename the input `pricingMode` → `priceDisplayMode`; update its callers (`pricing-breakdown.tsx`, `internal-calculation-block.tsx`, PDF + summary callers get fixed in Task 7 — leave them compiling by doing the rename and the Task 7 files' field name in ONE commit if tsc demands it; otherwise sequence the rename into Task 7).

- [ ] **Step 3: Verify + commit**

Run: `pnpm tsc && pnpm lint`, then `grep -rn "fundingJSON\|formMetaJSON" src/features/proposal-flow` → only `edit-proposal-view.tsx`/`create-new-proposal-view.tsx` `buildMutationData` writers (Task 8) may remain.

```bash
git add -u src/features/proposal-flow src/shared/entities/proposals/lib/financials
git commit -m "refactor(proposal-flow): display reads flip to funding view-model + scalar columns"
```

---

### Task 7: PDF, summary route, Zoho flip

**Files:**
- Modify: `src/shared/lib/pdf/proposal-doc-definition.ts:24-26,245-291`
- Modify: `src/app/api/proposals/[proposalId]/summary/route.ts:37-39,95`
- Modify: `src/shared/services/providers/zoho-sign/lib/documents/proposal-context.ts:22,33`, `registry.ts:31`, `assemble-envelope.ts:39`

**Interfaces:**
- Consumes: `proposal.funding`, `proposal.priceDisplayMode`, `proposal.envelopeDocumentIds`.
- Produces: zero blob reads in PDF/summary/Zoho for funding/formMeta (projectJSON reads stay — W4).

- [ ] **Step 1: Swap the reads**

Same mapping table as Task 6. Specifics:
- `proposal-doc-definition.ts:25-26`: `const funding = proposal.funding` / `const priceDisplayMode = proposal.priceDisplayMode`; `buildPricingBreakdown({ funding, sow, priceDisplayMode })`. Delete the "relies on getFullView incentive hydration (Wave 2 bridge)" comment — the view-model IS the assembly now.
- `summary/route.ts`: `fundingJSON.data` → `proposal.funding`; `formMetaJSON.pricingMode` → `proposal.priceDisplayMode`.
- `proposal-context.ts:33`: `computeFinalTcp({ funding: proposal.funding, sow: proposal.projectJSON.data.sow })`.
- `registry.ts:31`: `depositSrc: ctx => ctx.proposal.funding.depositAmount`.
- `assemble-envelope.ts:39`: `proposal.envelopeDocumentIds` instead of `formMetaJSON.envelopeDocumentIds`.

- [ ] **Step 2: Verify + commit**

Run: `pnpm tsc && pnpm lint && pnpm tsx scripts/verify-financials-facade.ts && pnpm tsx scripts/verify-assemble-envelope.ts`
Expected: all pass (fixture scripts may need the `priceDisplayMode` field rename — update fixtures in the same commit).

```bash
git add -u src/shared/lib/pdf src/app/api/proposals src/shared/services/providers/zoho-sign scripts
git commit -m "refactor(pdf,summary,zoho): funding/formMeta reads flip to view-model + columns"
```

---

### Task 8: Writers flip (views, setCashInDeal, applyEnvelopeContext, server-spec, lock fields, recompute SQL)

**Files:**
- Modify: `features/proposal-flow/ui/views/edit-proposal-view.tsx:110-135`, `create-new-proposal-view.tsx:66-91`
- Modify: `features/customer-pipelines/ui/components/create-proposal-popover.tsx:51-78`
- Modify: `src/shared/entities/proposals/dal/server/mutations.ts:47-66,125-157`
- Modify: `src/trpc/routers/proposals.router/contracts.router.ts:254-262`
- Modify: `src/shared/entities/proposals/lib/server-spec.ts:46-47,74-93`
- Modify: `src/shared/entities/proposals/lib/proposal-lock.ts:59-66`
- Modify: `scripts/recompute-final-tcp.ts:29-41`

**Interfaces:**
- Consumes: `fundingDomainToColumns` (Task 2).
- Produces: no code path writes `fundingJSON`/`formMetaJSON` any more (blobs go stale from this commit on — backfill is cutover-window-only from here).

- [ ] **Step 1: Form payloads**

`edit-proposal-view.tsx` `buildMutationData` returns:

```ts
return {
  id: proposal.data.id,
  data: {
    label: rawData.project.data.label,
    priceDisplayMode: rawData.meta.priceDisplayMode,
    projectJSON: rawData.project,
    ...fundingDomainToColumns({ ...rawData.funding.data, cashInDeal: clampedCashInDeal }),
  },
}
```

(`envelopeDocumentIds` deliberately leaves the payload — `applyEnvelopeContext` is the only writer; see spec §2.) `create-new-proposal-view.tsx` analogous (insert payload: `label`, `ownerId`, `meetingId`, `priceDisplayMode`, `projectJSON`, spread of `fundingDomainToColumns(...)` with `cashInDeal: finalTcp`). `create-proposal-popover.tsx`: replace its `formMetaJSON`/`fundingJSON` literals with `priceDisplayMode: 'total'` + `...fundingDomainToColumns({ startingTcp: 0, depositAmount: 0, cashInDeal: 0 })`.

- [ ] **Step 2: `setCashInDeal` becomes a column write**

Replace the blob read-modify-write (`mutations.ts:149-154`) with:

```ts
    await db.update(proposals)
      .set({ cashInDealCents: Math.round(input.cashInDeal * 100) })
      .where(eq(proposals.id, input.proposalId))
    return { id: proposal.id, cashInDeal: input.cashInDeal }
```

Drop `fundingJSON` from the probe select and the `scrubBlobIncentives` import/call; rewrite the JSDoc (the "W3 turns this into a plain column write" sentence has come true).

- [ ] **Step 3: `applyEnvelopeContext` writes the column**

In `contracts.router.ts` (~line 254), the `proposalCrud.update` payload becomes `{ envelopeDocumentIds: reconciled }` instead of the `formMetaJSON` spread; the read at ~line 238 becomes `proposal.envelopeDocumentIds`.

- [ ] **Step 4: server-spec hooks**

- `create.before`: delete the `scrubBlobIncentives` wrap (line 47) — `const scrubbed = input`  collapses to using `input` directly.
- `update.before`: delete the `input.fundingJSON` scrub branch (lines 82-84).
- `update.after`: trigger set becomes

```ts
      async after(row, _ctx, meta) {
        if ('startingTcpCents' in meta.input || 'projectJSON' in meta.input) {
          dalVerifySuccess(await recomputeProposalFinancials(row.id))
        }
      },
```

- `create.after` comment: "startingTcp comes from the column; section terms from projectJSON until W4."

- [ ] **Step 5: Lock fields**

`proposal-lock.ts` `frozenProposalLockedFields`:

```ts
export const frozenProposalLockedFields = [
  'label',
  'projectJSON',
  'startingTcpCents',
  'depositAmountCents',
  'cashInDealCents',
  'miscPriceCents',
  'priceDisplayMode',
  'envelopeDocumentIds',
  'financeOptionId',
  'meetingId',
] as const
```

- [ ] **Step 6: Recompute SQL (both copies, one commit)**

`recomputeProposalFinancials` (`mutations.ts:52-59`):

```ts
      finalTcpCents: sql`GREATEST(0::numeric, (
        COALESCE(${proposals.startingTcpCents}, 0)
        - COALESCE((SELECT SUM(pi.amount_cents) FROM proposal_incentives pi
            WHERE pi.proposal_id = ${proposals.id} AND pi.type = 'discount'
              AND pi.sow_item_id IS NULL), 0)
        - COALESCE((SELECT ROUND(SUM((si->>'amount')::numeric) * 100)
            FROM jsonb_array_elements(${proposals.projectJSON}->'data'->'sow') AS sec,
                 jsonb_array_elements(COALESCE(sec->'financials'->'incentives', '[]'::jsonb)) AS si), 0)
      ))::bigint`,
```

Note the **pre-landed `sow_item_id IS NULL` predicate**: a no-op today (all rows are global) but it defuses the W4 double-count hazard structurally — record this in the ledger row (Task 13). Update the JSDoc: ONE remaining residue (section incentives, dies W4). Mirror the same expression (physical column names: `starting_tcp_cents`) in `scripts/recompute-final-tcp.ts:29-41`.

- [ ] **Step 7: Verify + commit**

Run: `pnpm tsc && pnpm lint`, then on dev: `pnpm tsx scripts/recompute-final-tcp.ts --dry-run`
Expected: zero drift (backfilled columns reproduce blob-derived values exactly).

```bash
git add -u src/features src/shared/entities/proposals src/trpc scripts/recompute-final-tcp.ts
git commit -m "feat(proposals): writers flip to scalar columns; recompute reads starting_tcp_cents (+ sow_item_id IS NULL guard)"
```

---

### Task 9: Contract — freeze the blobs, delete the scrub bridge

**Files:**
- Modify: `src/shared/db/schema/proposals.ts:39-41,94-115`
- Modify: `src/shared/entities/proposals/dal/server/queries.ts` (remove `hydratedFunding` + `fundingJSON` from the returned shape)
- Delete: `src/shared/entities/proposals/lib/scrub-blob-incentives.ts`
- Modify: `src/shared/entities/proposals/lib/server-spec.ts` (remove the import)

**Interfaces:**
- Produces: `fundingJSONDeprecated` / `formMetaJSONDeprecated` (omitted, nullable, `.omit()`-fenced); `ProposalWithCustomer` no longer carries `fundingJSON`/`formMetaJSON`. **tsc passing IS the proof the sweep is complete.**

- [ ] **Step 1: Schema freeze**

```ts
  /** @deprecated W3 froze this blob (2026-07-26 spec). Scalars live in the
   * price_display_mode/envelope_document_ids columns. Read only by
   * scripts/backfill-wave3-scalars.ts. Dropped on the Wave-4 push (ledger). */
  formMetaJSONDeprecated: jsonb('form_meta_JSON').$type<FormMetaSection>(),
  projectJSON: jsonb('project_JSON').$type<ProjectSection>().notNull(),
  /** @deprecated same — scalars in *_cents columns, incentives in proposal_incentives. */
  fundingJSONDeprecated: jsonb('funding_JSON').$type<FundingSection>(),
```

`selectProposalSchema`: drop the `fundingJSON` override (keep `projectJSON`). `insertProposalSchema`: drop the `fundingJSON` override and add `formMetaJSONDeprecated: true, fundingJSONDeprecated: true` to the `.omit()`.

- [ ] **Step 2: DB nullability**

Run: `pnpm db:push:dev` — review diff: exactly two `ALTER COLUMN ... DROP NOT NULL` (`form_meta_JSON`, `funding_JSON`), nothing else.

- [ ] **Step 3: tsc-driven contraction**

Run `pnpm tsc`; fix every survivor: remove `hydratedFunding` from `getFullView` (return `{ ...row, funding, customer, incentives }` — the deprecated properties ride along in `...row` but are typed deprecated), fix the backfill script to read `fundingJSONDeprecated`/`formMetaJSONDeprecated` property names, delete `scrub-blob-incentives.ts` + its `server-spec.ts` import. Any OTHER tsc error = an unswept consumer — fix it by the Task 6/7 mapping table.

- [ ] **Step 4: Verify + commit**

Run: `pnpm tsc && pnpm lint`, `grep -rn "fundingJSON\b\|formMetaJSON\b" src/ --include="*.ts" --include="*.tsx" | grep -v Deprecated` → zero hits.

```bash
git add -u src scripts
git commit -m "feat(proposals)!: freeze fundingJSON/formMetaJSON blobs; delete scrub-with-tripwire bridge"
```

---

### Task 10: `incentiveTypes` consolidation

**Files:**
- Modify: `src/shared/constants/enums/proposals.ts:22-23`
- Modify: `src/features/proposal-flow/ui/components/form/funding-fields.tsx:15,242`

- [ ] **Step 1: Single source of truth**

Delete the 5-value `incentiveTypes` + `IncentiveType` from `constants/enums/proposals.ts` (first: `grep -rn "IncentiveType\b" src --include="*.ts" --include="*.tsx"` — any importer of the constants version switches to the schemas version). In `funding-fields.tsx`: import `incentiveTypes` from `@/shared/entities/proposals/schemas` and delete the `.filter(t => t === 'discount' || t === 'exclusive-offer')` (the canonical array IS those two values).

- [ ] **Step 2: Verify + commit**

Run: `pnpm tsc && pnpm lint`

```bash
git add -u src/shared/constants/enums src/features/proposal-flow
git commit -m "refactor(proposals): incentiveTypes single source of truth (schemas 2-value array)"
```

---

### Task 11: Drop-ceremony code deletions + rename literal

**Files:**
- Modify: `src/shared/db/schema/proposals.ts:35` (rename literal), `customers.ts`, `auth.ts`, `lead-sources.ts` (remove frozen column properties + `.omit()` entries + `$type` imports)
- Delete: `scripts/backfill-wave1-columns.ts`, `scripts/backfill-wave2-children.ts`, `scripts/seed-bina-contacts.ts`, `scripts/backfill-interested-trades-raw.ts`
- Modify: `package.json` (remove `backfill:trades`, `backfill:trades:dev`, `seed:bina-contacts`, `seed:bina-contacts:dev`)
- Modify: `src/shared/entities/customers/constants/funnel-intake-fields.ts` (delete `LEGACY_ENRICHMENT_LABELS`), `entities/customers/schemas/index.ts:31-65` (delete `customerProfileSchema`/`propertyProfileSchema`/`financialProfileSchema` + types), `entities/users/schemas.ts:25-36` (delete `agentProfileSchema` + type), `entities/lead-sources/schemas.ts:67-71` (delete `voipConfigSchema` + type)
- Modify: `scripts/snapshot-prod-to-dev.ts:105` (remove skip entry), `scripts/verify-long-path.ts:25-27,71` + `scripts/verify-short-path.ts:55-57,97` (`signing_request_id` → `contract_envelope_id` in raw SQL)

> ⚠️ **Deploy choreography**: this commit's code assumes the prod DDL (drops + rename) has run. It ships in the SAME release as Tasks 4–10; the runbook (Task 12) runs the DDL immediately before deploy. Dev DB: run the DDL on the dev branch first (commands in the runbook) so `db:push:dev` diffs stay clean.

- [ ] **Step 1: Ledger pre-flight**

For each of the 6 columns, re-run the drop-protocol sweep: `grep -rn "<snake_case>\|<camelCaseDeprecated>" src/ scripts/ docs/` — every hit must be a registered ledger row or prose. Also `grep -rn "scrubBlobIncentives" src/` (should be gone since Task 9) and check dev logs for tripwire warnings (`[scrub-blob-incentives]`) — a firing means an unknown writer existed: STOP and escalate.

- [ ] **Step 2: Apply all deletions + the rename literal**

`proposals.ts:35` becomes:

```ts
  contractEnvelopeId: text('contract_envelope_id'),
```

(comment updated: renamed at the W3 ceremony, 2026-07-26). Then the deletions listed under **Files** above. Frozen-column property removals: delete the column definitions AND their `.omit()` entries AND the now-unused type imports at the top of each schema file.

- [ ] **Step 3: Dev DDL + push parity**

Run the dev-branch DDL (from the runbook, Task 12), then `pnpm db:push:dev` — expected: **no changes** (schema file and DB agree). Then `pnpm tsc && pnpm lint`.

- [ ] **Step 4: Commit**

```bash
git add -u src scripts package.json
git commit -m "feat(schema)!: W3 drop ceremony — drop 6 frozen blob columns, rename signing_request_id → contract_envelope_id, delete dead backfill/seed scripts"
```

---

### Task 12: Cutover runbook

**Files:**
- Create: `docs/plans/2026-07-26-wave-3-cutover-runbook.md`

- [ ] **Step 1: Write the runbook** — paste-ready, human-executed (Oliver runs every prod-mutating line). Sections, in order:

1. **Pre-flight**: `pnpm tsc && pnpm lint` green on main; tripwire log check; #256/#279 glance.
2. **Neon rehearsal** (branch from PROD): create branch (Neon MCP/console), `DRIZZLE_TARGET=prod`-style URL override pointed at the branch, additive push, backfill `--dry-run` → real → re-run (idempotence), the DDL block below, `pnpm tsc`, `pnpm tsx scripts/recompute-final-tcp.ts --dry-run` (zero drift). Only a clean rehearsal authorizes prod.
3. **Prod ceremony** (in one sitting):
   ```bash
   pnpm db:push:prod                                   # additive: 6 ADD COLUMN + 2 DROP NOT NULL, review diff — NO drops here
   DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-wave3-scalars.ts --dry-run
   DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-wave3-scalars.ts
   ```
   ```sql
   -- manual DDL (Neon SQL console) — NEVER via drizzle push (rename = DROP+ADD hazard)
   ALTER TABLE proposals RENAME COLUMN signing_request_id TO contract_envelope_id;
   ALTER TABLE customers DROP COLUMN customer_profile_json;
   ALTER TABLE customers DROP COLUMN property_profile_json;
   ALTER TABLE customers DROP COLUMN financial_profile_json;
   ALTER TABLE customers DROP COLUMN lead_meta_json;
   ALTER TABLE "user" DROP COLUMN agent_profile_json;
   ALTER TABLE lead_sources DROP COLUMN voip_config_json;
   ```
   Deploy main immediately after (brief old-deployment window on the renamed column — note expected error shape). PITR window noted per drop protocol.
4. **Post-deploy verification**: `DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-wave3-scalars.ts --dry-run` (drift report vs frozen blobs — expect zero on untouched rows), `DRIZZLE_TARGET=prod pnpm tsx scripts/recompute-final-tcp.ts --dry-run` (zero), then the smoke drive: create-from-meeting → edit+save both display modes → PDF → summary → Zoho envelope assembly → share-token view → setCashInDeal → lock a proposal and confirm the six columns reject edits (`proposal_frozen`).
5. **Aftercare**: ledger check-offs (Task 13), `fundingJSON`/`formMetaJSON` frozen rows now live with W4 kill triggers.

- [ ] **Step 2: Commit**

```bash
git add docs/plans/2026-07-26-wave-3-cutover-runbook.md
git commit -m "docs(runbook): wave-3 cutover + drop-ceremony runbook"
```

---

### Task 13: Docs, ledger, memory riders

**Files:**
- Modify: `src/shared/entities/proposals/DOCS.md`, `src/shared/entities/proposals/schemas/index.ts:81-84`, `docs/codebase-conventions/jsonb-columns.md:41,134,238`, `docs/plans/jsonb-decomposition-deprecation-ledger.md`, `memory/…` (via the memory directory), `docs/plans/2026-07-26-wave-4-design-handoff.md`

- [ ] **Step 1: DOCS.md truth pass**

`#final-tcp-derived`: residue list → ONE (section incentives, dies W4); note the pre-landed `sow_item_id IS NULL` guard; calc_version table gains a note line: "2026-07-26 W3: startingTcp source moved to `starting_tcp_cents` — value-identical, NOT a version bump." `#agreement-context-as-coherent-unit`: `formMetaJSON.envelopeDocumentIds` → `envelope_document_ids` column; note the form-payload tightening. `#jsonb-merge-on-update` + anti-patterns: fundingJSON/formMetaJSON references updated to "frozen W3". Fix the stale derived-values comment at `schemas/index.ts:81-84` (three-stage standard). Fix the 3 `docs/domain/ubiquitous-language.md` path cites in `jsonb-columns.md`.

- [ ] **Step 2: Ledger update**

Check off (with commit hashes): the 8 W1 rows, the 4 W2 frozen/scaffolding rows, the getFullView-hydration-bridge row + scrub-with-tripwire row (W2-bridges section — absorbed/deleted this wave), the recompute residue row (HALF: startingTcp done, section term remains — annotate), `snapshot-prod-to-dev` seam row. New rows: `backfill-wave3-scalars.ts` (cutover-window-only, dies with the frozen blobs on the W4 push), `fundingJSONDeprecated`/`formMetaJSONDeprecated` columns (kill trigger: W4 push), `FundingData` view-model revisit marker (tally: re-examine post-waves — Oliver 2026-07-26), `sow_item_id IS NULL` guard pre-landed (W4 double-count constraint now structurally defused — update the W4 handoff's question 3 accordingly).

- [ ] **Step 3: Wave-4 handoff sync**

In `docs/plans/2026-07-26-wave-4-design-handoff.md`: mark the "Post-W3 state you inherit" section CONFIRMED (it was written predictively), and note the pre-landed recompute guard under open question 3.

- [ ] **Step 4: Memory + verify + commit**

Update `memory/project-jsonb-strategy-research.md` status line (W3 scalar wave shipped; W4 = SOW). Run `pnpm tsc && pnpm lint`.

```bash
git add -u docs src/shared/entities/proposals
git commit -m "docs: W3 truth pass — DOCS.md, ledger check-offs, wave-4 handoff sync"
```

---

## Self-Review Notes (already applied)

- **Spec coverage**: §1→T1/T9, §2→T5/T8, §3→T2/T4/T6/T7 (+calc_version note T13), §4→T3/T12, §5→T11/T12, §6→T10/T13, §8 smoke→T12.4. The `sow_item_id IS NULL` guard (T8.6) is an addition beyond the spec — safe now, defuses the W4 hazard; recorded in ledger (T13).
- **Type consistency**: `FundingData` (T2) consumed by T4/T6/T7; `fundingDomainToColumns` consumed by T8; `priceDisplayMode` renamed once (T5) before any writer/reader uses it (T6–T8).
- **Ordering**: backfill (T3) runs on dev before writers flip (T8) — after T8, backfill is cutover-window-only (header warns). Blob freeze (T9) is deliberately AFTER all reads (T6/T7) and writes (T8) flip, so tsc at T9 proves sweep completeness.
