# Unified Proposal Pricing Editor — Track 1 Implementation Plan

> ⏸️ **ON HOLD — DO NOT EXECUTE (Oliver's ruling, 2026-07-24).** This work is sequenced POST-WAVES in epic #256, after the post-W3 frozen-column-drop / dead-code tally sweep. The plan was written against the pre-W3 blob shape; when the work is re-examined post-waves, most of its bridge/prefill machinery (Tasks 2, 5, and the sync bridge) will be unnecessary and the plan must be re-derived. The business rulings live in the spec (`docs/superpowers/specs/2026-07-24-unified-proposal-pricing-editor-design.md`) — those are canonical; this plan is a shelved artifact.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SOW section prices the sole price source in the proposal editor (read-only derived TCP, misc input removed, display-mode toggle demoted to a homeowner display preference), and unify create + edit into one draft-first experience — with zero schema/SQL/server-recompute changes.

**Architecture:** Client-only precursor to Wave 3 (spec: `docs/superpowers/specs/2026-07-24-unified-proposal-pricing-editor-design.md`). The editor becomes pricing-display-agnostic; the blob field `funding.data.startingTcp` keeps being written as a form-derived mirror of Σ `sectionPrice` (a ledger-registered bridge) so the untouched server rollup `recomputeProposalFinancials` stays correct. Legacy `startingTcp`-only / `miscPrice` proposals get an on-edit-open prefill that mirrors the Wave 3 migration rules.

**Tech Stack:** Next.js 15 App Router, React Hook Form + Zod (`zodResolver`), tRPC + TanStack Query, the proposals financials façade (`src/shared/entities/proposals/lib/financials/`), sonner toasts, nuqs.

## Global Constraints

- **NO schema, SQL, server-recompute, or Zod *field* changes.** `fundingDataSchema` keeps `startingTcp` (required) and `miscPrice` (optional) — only the `superRefine` rules and comments change. `recomputeProposalFinancials`, `getFullView`, backfill scripts: untouched.
- **Money math comes ONLY from the façade** `@/shared/entities/proposals/lib/financials` (`computeFinalTcp`, `computeTotalSectionPrices`, …). Never inline price arithmetic.
- **Meeting flow is off-limits by ruling** ("broken and unused"). Do not edit anything under `src/features/meeting-flow/` — even if `buildProposalDefaults` becomes unimported, leave it.
- **Homeowner renderers survive unchanged** in Track 1: `pricing-breakdown.tsx`, `compute-breakdown.ts`, the PDF doc definition, and the summary route keep rendering `PricingBreakdownModel.miscPrice` and branching on `pricingMode` (dual-shape tolerance; dies at Wave 3).
- **Verification is `pnpm tsc` + `pnpm lint` — NEVER `pnpm build`.** This repo has no unit-test runner; each task's gate is a clean typecheck + lint plus the targeted checks written into the task.
- **Commits stage explicit paths only — never `git add -A`.** The working tree carries unrelated WIP (portfolio-scraper, `.vscode/settings.json`, `src/shared/lib/phone.ts`, untracked docs) that must never ride along.
- **Branch:** create `feat/<issue>-unified-pricing-editor` from up-to-date `main` before Task 1 (open the GitHub issue first per `memory/reference-github-workflow.md`). Do not commit to `main`.
- Coding conventions apply (`memory/coding-conventions.md`): one component per file, named exports only, no file-level constants for JSX data, RHF + Zod for all form state (never `useState` for form data), `motion/react` not framer-motion.
- **Copy (exact strings from the spec/rulings):** settings toggle label = `Show per-section pricing to homeowner`; legacy prefill section title = `Miscellaneous`; prefill toast = `Legacy pricing was converted to per-section prices — review and save.`

## File map

| File | Fate | Task |
|---|---|---|
| `src/features/proposal-flow/ui/components/form/sow-financials-fields.tsx` | sectionPrice always editable; drop `pricingMode` | 1 |
| `src/features/proposal-flow/ui/components/form/sow-collapsible-header.tsx` | price badge always; drop `pricingMode` | 1 |
| `src/shared/entities/proposals/components/section-financials-summary.tsx` | mode-agnostic (data-presence gates) | 1 |
| `src/features/proposal-flow/ui/components/form/sow-field.tsx`, `project-fields.tsx` | drop `pricingMode` pass-through | 1 |
| `src/features/proposal-flow/ui/components/pricing-breakdown/internal-calculation-block.tsx` | drop `pricingMode` from summary call | 1 |
| `src/features/proposal-flow/ui/components/form/funding-fields.tsx` | misc input dies; startingTcp input → read-only derived display; unconditional sync bridge | 2 |
| `src/shared/entities/proposals/schemas/index.ts` | superRefine unconditional; defaults drop `miscPrice`; bridge comments | 2 |
| `src/shared/entities/proposals/lib/build-draft-proposal-payload.ts` | **create** — shared draft-create payload | 3 |
| `src/features/proposal-flow/ui/views/create-draft-proposal-view.tsx` | **create** — create-draft-and-redirect view | 3 |
| `src/features/proposal-flow/ui/views/create-new-proposal-view.tsx` | **delete** | 3 |
| `src/features/proposal-flow/lib/get-proposal-aggregates.ts` | **delete** (last consumer dies in this task) | 3 |
| `src/features/proposal-flow/ui/views/index.ts`, `src/app/(frontend)/dashboard/proposals/new/page.tsx`, `src/features/customer-pipelines/ui/components/create-proposal-popover.tsx` | rewire to the new view/payload | 3 |
| `src/features/proposal-flow/ui/components/form/index.tsx` | single editor chrome; lenient draft saves; toggle relabel | 4 |
| `src/features/proposal-flow/ui/views/edit-proposal-view.tsx` | pass `isDraft` + `prefillLegacyPricing` | 4, 5 |
| `src/features/proposal-flow/lib/apply-legacy-pricing-prefill.ts` | **create** — T1.7 prefill helper | 5 |
| `docs/plans/jsonb-decomposition-deprecation-ledger.md` | 3 new bridge rows + row-87 update + Track 2 riders | 6 |

**Spec-bullet deviation (intentional, flag to reviewer):** spec T1.1 says "`getProposalAggregates` computes Σ sectionPrice unconditionally". After Task 2 rewires `funding-fields.tsx` straight to the façade and Task 3 deletes the create view, the helper has zero consumers — so it is **deleted** (Oliver's explicit no-dead-code ruling) instead of kept unconditional. Same outcome (no conditional aggregate remains), less code.

---

### Task 1: SOW editor becomes mode-agnostic (spec T1.1)

Section price inputs, badges, and the agent-side section summary stop caring about `pricingMode`. The prop is removed from the whole SOW component chain. (`FundingFields` keeps its prop until Task 2.)

**Files:**
- Modify: `src/features/proposal-flow/ui/components/form/sow-financials-fields.tsx`
- Modify: `src/features/proposal-flow/ui/components/form/sow-collapsible-header.tsx`
- Modify: `src/shared/entities/proposals/components/section-financials-summary.tsx`
- Modify: `src/features/proposal-flow/ui/components/form/sow-field.tsx`
- Modify: `src/features/proposal-flow/ui/components/form/project-fields.tsx`
- Modify: `src/features/proposal-flow/ui/components/form/index.tsx` (one line: `<ProjectFields />`)
- Modify: `src/features/proposal-flow/ui/components/pricing-breakdown/internal-calculation-block.tsx`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `SOWFinancialsFields({ index }: { index: number })`; `SOWCollapsibleHeader` props without `pricingMode`; `SectionFinancialsSummary({ financials, compact? })`; `ProjectFields()` (no props); `SOWSection({ index, sowSnapshot })`. Tasks 2/4 rely on `ProjectFields` taking no props.

- [ ] **Step 1: `sow-financials-fields.tsx` — always-editable section price**

Change the Props interface (lines 15–18) and remove the mode flag:

```tsx
interface Props {
  index: number
}

export function SOWFinancialsFields({ index }: Props) {
```

Delete the line `const isBreakdown = pricingMode === 'breakdown'` (line 56). Replace the entire Section Price `FormControl` ternary (lines 92–127, the `!isBreakdown ? <HybridPopoverTooltip>… : <Input…>` block) with the enabled input only:

```tsx
            <FormControl>
              <Input
                type="text"
                placeholder="$10,000"
                className="w-full lg:w-48"
                value={field.value == null ? '' : String(field.value)}
                onChange={(e) => {
                  const raw = e.target.value
                  field.onChange(raw.trim() === '' ? null : Number(raw.replace(/\D/g, '')))
                }}
              />
            </FormControl>
```

Remove the now-unused import `HybridPopoverTooltip` (line 7). Change the summary call (line 373) to:

```tsx
      <SectionFinancialsSummary financials={watchedFinancials} />
```

- [ ] **Step 2: `sow-collapsible-header.tsx` — price badge whenever priced**

Remove `pricingMode: 'total' | 'breakdown'` from `Props` (line 16) and from the destructured parameters (line 25). Change line 35 to:

```tsx
  const showPrice = sectionPrice != null && sectionPrice > 0
```

- [ ] **Step 3: `section-financials-summary.tsx` — data-presence gates instead of mode gates**

This is the agent-facing summary (editor + internal calc block); with sections as the sole price source it must always show price-derived outputs. Remove `pricingMode` from `Props` and the function signature:

```tsx
interface Props {
  financials: SowFinancials
  /** Compact mode: shows only Net Price + Job Costs */
  compact?: boolean
}

export function SectionFinancialsSummary({ financials, compact }: Props) {
  const section = computeSectionFinancials({ title: '', financials })

  const hasAnyData = section.hasCostLines || section.hasIncentives
  const showOutputs = section.price != null && section.hasCostLines
```

(delete the `const isBreakdown = …` line.) Then replace every `isBreakdown &&` gate with a data gate:

- compact Net Price row: `{isBreakdown && section.netPrice != null && (` → `{section.netPrice != null && (`
- "Section Price" row: `{isBreakdown && section.price != null && (` → `{section.price != null && (`
- "Net Price" row: `{isBreakdown && section.netPrice != null && section.hasIncentives && (` → `{section.netPrice != null && section.hasIncentives && (`
- bottom empty state: `{!hasAnyData && !isBreakdown && (` → `{!hasAnyData && section.price == null && (` and change its copy to `Add a section price and cost lines to see financial summary`

- [ ] **Step 4: drop the prop chain**

`sow-field.tsx`: remove `pricingMode: 'total' | 'breakdown'` from `Props` (line 34) and the destructure (line 40); change line 321 to `<SOWFinancialsFields index={index} />`.

`project-fields.tsx`: change to `export function ProjectFields()` with no `Props` interface (delete lines 17–19's interface and the destructure); remove `pricingMode={pricingMode}` from both the `SOWCollapsibleHeader` call (line ~125) and the `SOWSection` call (line ~141).

`form/index.tsx` line 291: `{tab === 'sow' && <ProjectFields />}` (leave the `FundingFields` line and the `pricingMode` watch alone — Task 2 and the Settings switch still use them).

`internal-calculation-block.tsx`: remove `pricingMode={pricingMode}` from the `SectionFinancialsSummary` call (~line 60). Keep `const { pricingMode } = proposalData.formMetaJSON` — it still feeds `computeProposalFinancials` (the homeowner breakdown view-model needs it).

- [ ] **Step 5: verify**

Run: `pnpm tsc && pnpm lint`
Expected: both clean. `grep -rn "pricingMode" src/features/proposal-flow/ui/components/form/` should now hit only `index.tsx` and `funding-fields.tsx`.

- [ ] **Step 6: Commit**

```bash
git add src/features/proposal-flow/ui/components/form/sow-financials-fields.tsx \
        src/features/proposal-flow/ui/components/form/sow-collapsible-header.tsx \
        src/features/proposal-flow/ui/components/form/sow-field.tsx \
        src/features/proposal-flow/ui/components/form/project-fields.tsx \
        src/features/proposal-flow/ui/components/form/index.tsx \
        src/features/proposal-flow/ui/components/pricing-breakdown/internal-calculation-block.tsx \
        src/shared/entities/proposals/components/section-financials-summary.tsx
git commit -m "feat(proposals): section prices always editable — SOW editor is display-mode-agnostic"
```

---

### Task 2: Derived read-only TCP, misc input removal, unconditional validation (spec T1.2 + T1.3 + T1.5)

**Files:**
- Modify: `src/features/proposal-flow/ui/components/form/funding-fields.tsx`
- Modify: `src/shared/entities/proposals/schemas/index.ts`
- Modify: `src/features/proposal-flow/ui/components/form/index.tsx` (call site)

**Interfaces:**
- Consumes: façade `computeFinalTcp({ funding, sow }): number`, `computeTotalSectionPrices(sow): number` from `@/shared/entities/proposals/lib/financials`; `formatAsDollars` from `@/shared/lib/formatters`.
- Produces: `FundingFields()` — no props. Task 5's prefill relies on the sync effect here recomputing `startingTcp` after any sow change.

- [ ] **Step 1: rewrite the top of `funding-fields.tsx`**

Imports: remove `import { getProposalAggregates } from '@/features/proposal-flow/lib/get-proposal-aggregates'`; add:

```tsx
import { computeFinalTcp, computeTotalSectionPrices } from '@/shared/entities/proposals/lib/financials'
import { formatAsDollars } from '@/shared/lib/formatters'
```

Delete the `interface Props { pricingMode: 'total' | 'breakdown' }` block and change the signature to `export function FundingFields() {`. Delete the `miscPrice` watch (line 42). Keep the existing `incentives` and `sow` watches. After the watches, add the derived display values:

```tsx
  // Live derived pricing — the façade is the only money-math source.
  const subtotal = computeTotalSectionPrices(sow ?? [])
  const finalTcp = computeFinalTcp({
    funding: { ...form.getValues('funding.data'), startingTcp: subtotal, incentives: incentives ?? [] },
    sow: sow ?? [],
  })
```

- [ ] **Step 2: replace the sync effect (lines 75–87) with the unconditional bridge**

```tsx
  useEffect(() => {
    // BRIDGE (ledger-registered — dies at Wave 3): the blob's startingTcp mirrors
    // Σ sectionPrice so the untouched server rollup (recomputeProposalFinancials)
    // stays correct until W3 derives it from proposal_sow_items rows.
    // see docs/plans/jsonb-decomposition-deprecation-ledger.md
    const total = computeTotalSectionPrices(form.getValues('project.data.sow'))
    if (form.getValues('funding.data.startingTcp') !== total) {
      form.setValue('funding.data.startingTcp', total)
    }
  }, [sow, form])
```

Note: no early-return on 0 and no `miscPrice` term — that is the point. Legacy blobs are protected by Task 5's prefill (applied at form-reset time, before the agent can save).

- [ ] **Step 3: replace the misc + startingTcp inputs with the read-only display**

Replace the whole Base Pricing grid content (lines 95–159: the `{pricingMode === 'breakdown' && (…Misc Pricing…)}` block AND the `funding.data.startingTcp` FormField) — keeping the `depositAmount` FormField — so the grid becomes:

```tsx
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Total Contract Price</p>
              <div className="flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm font-semibold tabular-nums">
                {formatAsDollars(finalTcp)}
              </div>
              <p className="text-xs text-muted-foreground">
                Derived from
                {' '}
                {formatAsDollars(subtotal)}
                {' '}
                in section prices, minus incentives
              </p>
            </div>
            <FormField
              name="funding.data.depositAmount"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deposit</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="$1,000"
                      onChange={(value) => {
                        const numericValue = Number(value.target.value.replace(/\D/g, ''))
                        field.onChange(numericValue)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
```

- [ ] **Step 4: update the call site**

`form/index.tsx` line 292: `{tab === 'funding' && <FundingFields />}`. The `pricingMode` watch in `index.tsx` stays (the Settings switch uses it).

- [ ] **Step 5: `schemas/index.ts` — unconditional section-price rule + bridge comments**

Replace the comment block above `fundingDataSchema` (lines 81–84) with:

```ts
// `finalTcp` is NOT stored here — it is derived via
// `computeFinalTcp({ funding, sow })` in `entities/proposals/lib/financials`.
// TRACK-1 BRIDGES (both die at Wave 3 — see
// docs/plans/jsonb-decomposition-deprecation-ledger.md):
// - `startingTcp` is a form-derived mirror of Σ sectionPrice (the editor syncs
//   it so the server rollup stays correct until W3 derives from sow rows).
// - `miscPrice` is display-only legacy data; the editor no longer writes it.
```

In `proposalFormSchema.superRefine` (lines 142–170): delete `const isBreakdown = proposal.meta.pricingMode === 'breakdown'`, and make rule 1 unconditional:

```ts
  proposal.project.data.sow.forEach((section, sectionIndex) => {
    // 1. Section price required + positive — sections are the sole price source
    const sp = section.financials.sectionPrice
    if (sp === null || sp <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['project', 'data', 'sow', sectionIndex, 'financials', 'sectionPrice'],
        message: 'Section price is required',
      })
    }
```

Also update the doc comment above `proposalFormSchema` (line ~137): change `- Breakdown mode: every section's \`sectionPrice\` must be a positive number.` to `- Every section's \`sectionPrice\` must be a positive number.`

In `proposalFormBaseDefaultValues`, delete the `miscPrice: 0,` line (line 199). Do NOT remove `miscPrice` from `fundingDataSchema` — the Zod field survives until Wave 3.

- [ ] **Step 6: verify**

Run: `pnpm tsc && pnpm lint`
Expected: both clean. `grep -rn "miscPrice" src/features/` should return nothing; `grep -rn "miscPrice" src/shared/` should hit only the schema, `compute-breakdown.ts`, and homeowner renderers (PDF/summary) — the sanctioned display tolerance.

- [ ] **Step 7: Commit**

```bash
git add src/features/proposal-flow/ui/components/form/funding-fields.tsx \
        src/features/proposal-flow/ui/components/form/index.tsx \
        src/shared/entities/proposals/schemas/index.ts
git commit -m "feat(proposals): TCP is read-only and derived; misc input removed; section prices required"
```

---

### Task 3: Draft-first create (spec T1.6, route + views)

`/dashboard/proposals/new?meetingId=X` now creates a `draft` row and redirects into the editor. `CreateNewProposalView` (the parallel create-form experience) dies; the pipeline popover reuses the same payload builder it already effectively had inline.

**Files:**
- Create: `src/shared/entities/proposals/lib/build-draft-proposal-payload.ts`
- Create: `src/features/proposal-flow/ui/views/create-draft-proposal-view.tsx`
- Modify: `src/features/proposal-flow/ui/views/index.ts`
- Modify: `src/app/(frontend)/dashboard/proposals/new/page.tsx`
- Modify: `src/features/customer-pipelines/ui/components/create-proposal-popover.tsx`
- Delete: `src/features/proposal-flow/ui/views/create-new-proposal-view.tsx`
- Delete: `src/features/proposal-flow/lib/get-proposal-aggregates.ts`

**Interfaces:**
- Consumes: `useCreateProposal()` (wraps `trpc.proposalsRouter.crud.create`); `createEmptySowSection()` from `@/shared/entities/proposals/lib/create-empty-sow-section`; `ROOTS.dashboard.proposals.byId(id)`.
- Produces: `buildDraftProposalPayload({ meetingId, ownerId }: { meetingId: string, ownerId: string })` — returns the exact `crud.create` input shape; `CreateDraftProposalView()` exported from the views barrel. Task 4 assumes every proposal now enters the editor via `EditProposalView`.

- [ ] **Step 1: create `src/shared/entities/proposals/lib/build-draft-proposal-payload.ts`**

```ts
import { createEmptySowSection } from './create-empty-sow-section'

interface DraftProposalArgs {
  meetingId: string
  ownerId: string
}

/**
 * Minimal draft-first create payload — the single shape every "New proposal"
 * entry point sends to `proposalsRouter.crud.create`. The proposal is born as
 * a `draft` and all real editing happens in the unified editor.
 * `incentives: []` — rows are the source of truth (Wave 2); the blob array is
 * dead. see docs/plans/jsonb-decomposition-deprecation-ledger.md
 */
export function buildDraftProposalPayload({ meetingId, ownerId }: DraftProposalArgs) {
  return {
    meetingId,
    ownerId,
    label: '',
    status: 'draft' as const,
    formMetaJSON: { pricingMode: 'total' as const },
    projectJSON: {
      data: {
        label: '',
        type: 'general-remodeling' as const,
        timeAllocated: '',
        validThroughTimeframe: '60 days' as const,
        projectObjectives: [],
        homeAreasUpgrades: [],
        sow: [createEmptySowSection()],
      },
      meta: { enabled: true },
    },
    fundingJSON: {
      data: {
        cashInDeal: 0,
        depositAmount: 0,
        startingTcp: 0,
        incentives: [],
      },
      meta: { enabled: true },
    },
  }
}
```

(This is byte-for-byte the payload `CreateProposalPopover` sends today, so the create surface is already proven. `depositAmount: 0` intentionally matches the popover, not the form default of 1000 — the editor's defaults apply only to form state, and the agent sets the real deposit while editing.)

- [ ] **Step 2: create `src/features/proposal-flow/ui/views/create-draft-proposal-view.tsx`**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useCreateProposal } from '@/features/proposal-flow/dal/client/mutations/use-create-proposal'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { ROOTS } from '@/shared/config/roots'
import { useSession } from '@/shared/domains/auth/client'
import { buildDraftProposalPayload } from '@/shared/entities/proposals/lib/build-draft-proposal-payload'

/**
 * Draft-first create (spec T1.6): `/dashboard/proposals/new?meetingId=X`
 * creates a `draft` proposal and lands in the unified editor. There is no
 * separate create-form experience anymore.
 */
export function CreateDraftProposalView() {
  const [meetingId] = useQueryState('meetingId', { defaultValue: '' })
  const router = useRouter()
  const { data: session } = useSession()
  const createProposal = useCreateProposal()
  const hasCreated = useRef(false)

  const userId = session?.user.id

  useEffect(() => {
    if (!meetingId || !userId || hasCreated.current) {
      return
    }
    hasCreated.current = true
    createProposal.mutate(buildDraftProposalPayload({ meetingId, ownerId: userId }), {
      onSuccess: (proposal) => {
        router.replace(ROOTS.dashboard.proposals.byId(proposal.id))
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to create proposal')
      },
    })
  }, [meetingId, userId, createProposal, router])

  if (!meetingId) {
    return (
      <ErrorState
        title="No meeting selected"
        description="A proposal must be created from a meeting. Please go back and select a meeting first."
      />
    )
  }

  if (createProposal.isError) {
    return (
      <ErrorState
        title="Could not create proposal"
        description="Please go back and try again."
      />
    )
  }

  return (
    <LoadingState
      title="Creating Proposal"
      description="Setting up a new draft..."
    />
  )
}
```

(The `hasCreated` ref guards against the mutation-object identity changing per render; `router.replace` keeps `/new` out of history so Back doesn't re-create.)

- [ ] **Step 3: rewire the barrel and route**

`src/features/proposal-flow/ui/views/index.ts`:

```ts
export { CreateDraftProposalView } from './create-draft-proposal-view'
export { EditProposalView } from './edit-proposal-view'
```

`src/app/(frontend)/dashboard/proposals/new/page.tsx`:

```tsx
import { CreateDraftProposalView } from '@/features/proposal-flow/ui/views'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function NewProposalPage() {
  await protectDashboardPage()
  return <CreateDraftProposalView />
}
```

- [ ] **Step 4: popover reuses the builder**

`create-proposal-popover.tsx`: replace the inline object in `handleCreate` (lines 51–78) with:

```ts
    createMutation.mutate(buildDraftProposalPayload({
      meetingId: selectedMeetingId,
      ownerId: session.user.id,
    }))
```

Add `import { buildDraftProposalPayload } from '@/shared/entities/proposals/lib/build-draft-proposal-payload'` and remove the now-unused `createEmptySowSection` import.

- [ ] **Step 5: delete the dead files**

```bash
git rm src/features/proposal-flow/ui/views/create-new-proposal-view.tsx \
       src/features/proposal-flow/lib/get-proposal-aggregates.ts
```

Before deleting, confirm zero remaining importers: `grep -rn "CreateNewProposalView\|getProposalAggregates" src/` must return nothing outside the two deleted files. Do NOT touch `src/features/meeting-flow/lib/build-proposal-defaults.ts` even though this removes its last importer — meeting flow is off-limits by ruling (its W3 stubbing is a pre-registered Track 2 rider).

- [ ] **Step 6: verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean. The 5 existing `/new?meetingId=` link sites (meeting-flow create-proposal-step, agent-dashboard action-detail-sheet, customer-meetings-list, project-entity-card, use-meeting-action-configs) need no edits — the route contract (`?meetingId=`) is unchanged. `action-detail-sheet` navigates without a meetingId and now gets the same "No meeting selected" error state the old view showed.

- [ ] **Step 7: Commit**

```bash
git add src/shared/entities/proposals/lib/build-draft-proposal-payload.ts \
        src/features/proposal-flow/ui/views/create-draft-proposal-view.tsx \
        src/features/proposal-flow/ui/views/index.ts \
        "src/app/(frontend)/dashboard/proposals/new/page.tsx" \
        src/features/customer-pipelines/ui/components/create-proposal-popover.tsx
git commit -m "feat(proposals): draft-first create — /new creates a draft and lands in the editor"
```

(The `git rm` in Step 5 already staged the deletions; the commit picks them up.)

---

### Task 4: Unified editor chrome + lenient draft saves + toggle relabel (spec T1.6 + T1.4)

With the create view gone, `ProposalForm` has exactly one consumer (`EditProposalView`). Make `onSave` required, delete the create-only branch, add draft-lenient saves, and relabel the pricing switch.

**Files:**
- Modify: `src/features/proposal-flow/ui/components/form/index.tsx`
- Modify: `src/features/proposal-flow/ui/views/edit-proposal-view.tsx`

**Interfaces:**
- Consumes: Task 3's guarantee that `EditProposalView` is the only `ProposalForm` consumer.
- Produces: `ProposalForm` props: `{ onSubmit, onSave, isDraft: boolean, isLoading, initialValues?, viewHref? }` with `onSave` **required**. Task 5 adds `prefillLegacyPricing` to this same interface.

- [ ] **Step 1: `form/index.tsx` — required `onSave`, `isDraft`, single chrome**

Props:

```tsx
interface Props {
  onSubmit: (data: ProposalFormSchema) => void
  onSave: (data: ProposalFormSchema) => void
  /** Lenient saves while the proposal is a draft (spec T1.6 / Nuance 1). */
  isDraft: boolean
  isLoading: boolean
  initialValues?: OverrideProposalValues
  viewHref?: string
}

export function ProposalForm({ isLoading, onSubmit, onSave, isDraft, initialValues, viewHref }: Props) {
```

Delete `const isEditMode = !!onSave`. Replace `handleSaveOnly`:

```tsx
  function handleSaveOnly() {
    closeSavePopovers()
    if (isDraft) {
      // Lenient draft saves (spec T1.6): drafts persist whatever exists — the
      // strict schema (positive section prices) gates only Save & Preview.
      onSave(form.getValues())
      return
    }
    form.handleSubmit(onSave, onInvalid)()
  }
```

In the toolbar JSX, remove the `isEditMode ? (…) : (<Button …>Save & Preview</Button>)` ternary — keep only the toolbar `<div className="inline-flex h-9 …">` block (the former true-branch), unconditionally.

- [ ] **Step 2: relabel the pricing switch (T1.4)**

Replace the Switch row (lines 180–190) with:

```tsx
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <Label htmlFor="pricing-mode" className="text-sm font-normal">
                              Show per-section pricing to homeowner
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Display preference only — never changes the price.
                            </p>
                          </div>
                          <Switch
                            id="pricing-mode"
                            checked={pricingMode === 'breakdown'}
                            onCheckedChange={checked =>
                              form.setValue('meta.pricingMode', checked ? 'breakdown' : 'total')}
                          />
                        </div>
```

It still writes `meta.pricingMode` exactly as before — the key rename (`priceDisplayMode`) rides Wave 3.

- [ ] **Step 3: `edit-proposal-view.tsx` — pass `isDraft`**

In the `ProposalForm` call (lines 233–239), add:

```tsx
            isDraft={proposal.data.status === 'draft'}
```

(`proposal.data` is the full-view row and carries `status`; the call sits below the `!proposal.data` guard, so no optional chaining is needed.)

- [ ] **Step 4: verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean. `grep -n "isEditMode" src/features/proposal-flow/` returns nothing.

- [ ] **Step 5: Commit**

```bash
git add src/features/proposal-flow/ui/components/form/index.tsx \
        src/features/proposal-flow/ui/views/edit-proposal-view.tsx
git commit -m "feat(proposals): single editor chrome, lenient draft saves, homeowner display toggle relabel"
```

---

### Task 5: Legacy pricing prefill on edit-open (spec T1.7)

Legacy proposals (all `sectionPrice` empty + `startingTcp > 0`, and/or `miscPrice > 0`) get their prices converted to sections when opened for editing — equal split + a "Miscellaneous" section — marked dirty so the agent reviews before saving. Without this, Task 2's sync (Σ sectionPrice, no misc) would zero/shrink legacy prices on the next save. Both helpers are ledger-registered and DIE at the Wave 3 migration (Oliver's explicit ruling).

**Files:**
- Create: `src/features/proposal-flow/lib/apply-legacy-pricing-prefill.ts`
- Modify: `src/features/proposal-flow/ui/components/form/index.tsx`
- Modify: `src/features/proposal-flow/ui/views/edit-proposal-view.tsx`

**Interfaces:**
- Consumes: Task 4's `ProposalForm` props; `createEmptySowSection(overrides?)`.
- Produces: `applyLegacyPricingPrefill(values: ProposalFormSchema): { sow: ProposalFormSchema['project']['data']['sow'], miscPrice: number | undefined, prefillApplied: boolean }`; new `ProposalForm` prop `prefillLegacyPricing: boolean`.

- [ ] **Step 1: create `src/features/proposal-flow/lib/apply-legacy-pricing-prefill.ts`**

```ts
import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { createEmptySowSection } from '@/shared/entities/proposals/lib/create-empty-sow-section'

export interface LegacyPricingPrefillResult {
  sow: ProposalFormSchema['project']['data']['sow']
  miscPrice: number | undefined
  prefillApplied: boolean
}

/**
 * INTERIM bridge for legacy `startingTcp`-only / `miscPrice` blobs (spec T1.7).
 * Registered in docs/plans/jsonb-decomposition-deprecation-ledger.md — DELETE at
 * the Wave 3 data migration, which applies these exact rules in-place:
 * - All sections unpriced + startingTcp > 0 → equal split of
 *   (startingTcp − miscPrice) across sections, remainder on the first, so the
 *   converted Σ sectionPrice reproduces the legacy total exactly.
 * - miscPrice > 0 → appended "Miscellaneous" section priced at miscPrice
 *   (misc is just another SOW section by ruling).
 * Edge: if miscPrice ≥ startingTcp the split is skipped (sections stay
 * unpriced) and only the Miscellaneous section is added — the strict schema
 * then forces the agent to price the sections before Save & Preview.
 */
export function applyLegacyPricingPrefill(values: ProposalFormSchema): LegacyPricingPrefillResult {
  const { sow } = values.project.data
  const { startingTcp, miscPrice } = values.funding.data
  const misc = miscPrice ?? 0

  const allUnpriced = sow.every(section => !section.financials.sectionPrice)
  const splitTotal = startingTcp - misc

  let nextSow = sow
  let applied = false

  if (allUnpriced && startingTcp > 0 && splitTotal > 0 && sow.length > 0) {
    const base = Math.floor(splitTotal / sow.length)
    const remainder = splitTotal - base * sow.length
    nextSow = sow.map((section, i) => ({
      ...section,
      financials: { ...section.financials, sectionPrice: i === 0 ? base + remainder : base },
    }))
    applied = true
  }

  if (misc > 0) {
    nextSow = [
      ...nextSow,
      createEmptySowSection({
        title: 'Miscellaneous',
        financials: { sectionPrice: misc, costLines: [], incentives: [] },
      }),
    ]
    applied = true
  }

  return { sow: nextSow, miscPrice: misc > 0 ? 0 : miscPrice, prefillApplied: applied }
}
```

- [ ] **Step 2: wire into the `ProposalForm` reset effect**

`form/index.tsx`: add prop `prefillLegacyPricing: boolean` to `Props` (and the destructure), import the helper and `toast` is already imported. Replace the reset effect (lines 94–99):

```tsx
  useEffect(() => {
    if (initialValues) {
      const merged = deepMergeDefaults(baseDefaultValues, initialValues)
      form.reset(merged)
      if (prefillLegacyPricing) {
        const prefill = applyLegacyPricingPrefill(merged)
        if (prefill.prefillApplied) {
          // shouldDirty: the agent must review the converted prices and save.
          form.setValue('project.data.sow', prefill.sow, { shouldDirty: true })
          form.setValue('funding.data.miscPrice', prefill.miscPrice, { shouldDirty: true })
          toast.info('Legacy pricing was converted to per-section prices — review and save.')
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues])
```

Import: `import { applyLegacyPricingPrefill } from '@/features/proposal-flow/lib/apply-legacy-pricing-prefill'`.

- [ ] **Step 3: `edit-proposal-view.tsx` — gate on lock state**

Add to the `ProposalForm` call:

```tsx
            prefillLegacyPricing={!proposalLocked}
```

Locked proposals (draft-locked / in-flight / terminal) must NOT be prefilled — the editor is read-only there and a synthetic split would misrepresent what was signed. The prefill fires only where the agent can actually review and save.

- [ ] **Step 4: verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean. Sanity-trace (no runtime needed): after prefill, Task 2's sync effect fires on the `sow` watch change and sets `startingTcp = Σ sectionPrice`, which equals the legacy `startingTcp` in the normal case (split + misc reproduce it exactly).

- [ ] **Step 5: Commit**

```bash
git add src/features/proposal-flow/lib/apply-legacy-pricing-prefill.ts \
        src/features/proposal-flow/ui/components/form/index.tsx \
        src/features/proposal-flow/ui/views/edit-proposal-view.tsx
git commit -m "feat(proposals): legacy startingTcp/misc prefill on edit-open (W3-migration-mirroring bridge)"
```

---

### Task 6: Ledger obligations + final verification (spec "Ledger obligations")

**Files:**
- Modify: `docs/plans/jsonb-decomposition-deprecation-ledger.md`

**Interfaces:** consumes the exact file/symbol locations produced by Tasks 2, 3, 5.

- [ ] **Step 1: add a Track 1 bridge section**

Read the ledger first. Under the existing `## Wave 2 — bridges that die in W3 (do NOT delete before the SOW wave)` section, append a new subsection:

```markdown
### Track 1 (unified pricing editor, 2026-07-24) — bridges that die in W3

| | Item | Where | W3 replacement |
|---|---|---|---|
| [ ] | Form-derived `startingTcp` sync bridge — editor mirrors Σ sectionPrice into the blob so `recomputeProposalFinancials` stays correct | `features/proposal-flow/ui/components/form/funding-fields.tsx` (unconditional `useEffect`) + bridge comment in `entities/proposals/schemas/index.ts` above `fundingDataSchema` | `startingTcp` deleted from `fundingDataSchema` + blobs; recompute derives from `proposal_sow_items` rows |
| [ ] | `miscPrice` display-only tolerance — editor never writes it, but `PricingBreakdownModel.miscPrice` + the React/PDF/summary renderers keep showing legacy values so old blobs aren't silently understated | `entities/proposals/lib/financials/compute-breakdown.ts` (`miscPrice` model field) + `proposal-flow/ui/components/pricing-breakdown.tsx` "Misc" row + PDF doc-definition "Additional items" row + summary route "Misc" line | W3 migration converts `miscPrice` → a "Miscellaneous" SOW section, then the model field + renderer rows die |
| [ ] | `applyLegacyPricingPrefill` (equal split + misc→"Miscellaneous" section on edit-open, `prefillLegacyPricing` prop + reset-effect wiring) | `features/proposal-flow/lib/apply-legacy-pricing-prefill.ts` + `form/index.tsx` reset effect + `edit-proposal-view.tsx` prop | W3 data migration applies the same rules in-place; helper + wiring deleted in the same sweep (Oliver's explicit no-dead-code ruling) |
```

- [ ] **Step 2: update the blank-writer row**

Find the existing bridge row listing the `incentives: []` blank-writers (currently cites `edit-proposal-view.tsx` + `create-new-proposal-view.tsx` + the pipelines popover). Update its "Where" to reflect Track 1: `create-new-proposal-view.tsx` is DELETED; the blank-writers are now `edit-proposal-view.tsx` (`buildMutationData`) and `entities/proposals/lib/build-draft-proposal-payload.ts` (consumed by the pipelines popover + `/dashboard/proposals/new`). Add a dated note, e.g. `(updated 2026-07-24, Track 1: create view deleted; payload builder added)`.

- [ ] **Step 3: append Track 2 riders to the W3 pre-registration section**

Under `## Wave 3 (pre-registered, expand when W3 is planned)`, append these bullets (condensed from the spec's Track 2 list — the W3 spec elaborates them):

```markdown
- **Track 2 riders (unified pricing editor spec 2026-07-24, §Track 2):**
  - `recomputeProposalFinancials` derives final TCP from Σ `proposal_sow_items.sectionPrice` (+ `proposal_incentives`), not blob `startingTcp`; revisit whether the pre-registered `starting_tcp_cents` column is still needed.
  - Delete `startingTcp` + `miscPrice` from `fundingDataSchema` + blobs (expand-and-contract; add `_v` per jsonb-columns rule).
  - `calc_version` v2: build the (currently inert) version machinery — stamping + targeted rebuild — then bump + full recompute.
  - Rename `pricingMode` → `priceDisplayMode` (+ ubiquitous-language entry).
  - Data migration: legacy `startingTcp`-only → equal split across sections; `pricingMode` forced `'total'`; **explicit migrated-flag** for internal badging; `miscPrice > 0` → "Miscellaneous" SOW section; locked/signed rows **skip + report** (partition by `getProposalLockState`).
  - Kill the three Track 1 bridges above in the same sweep.
  - Stub/remove the meeting-flow `startingTcp` seed in `build-proposal-defaults.ts` (flow itself stays deferred).
```

- [ ] **Step 4: final verification sweep**

```bash
pnpm tsc && pnpm lint
pnpm tsx scripts/verify-financials-facade.ts
```

Expected: tsc/lint clean; the façade verify script passes unchanged (Track 1 never touched the façade). Then confirm the Track 1 grep contract:

- `grep -rn "pricingMode" src/features/proposal-flow/ src/shared/entities/proposals/` → hits only: form `index.tsx` (Switch + watch), homeowner renderers (`pricing-breakdown*`, `compute-breakdown.ts`, `compute-totals.ts`), PDF/summary builders, and schema definitions. No editor input gating.
- `grep -rn "startingTcp" src/features/proposal-flow/` → only the sync bridge in `funding-fields.tsx` and the prefill helper.

- [ ] **Step 5: Commit**

```bash
git add docs/plans/jsonb-decomposition-deprecation-ledger.md
git commit -m "docs(ledger): register Track 1 pricing-editor bridges + W3 rider pre-registration"
```

---

## Manual smoke checklist (Oliver / post-merge, from the spec)

Not executable by the implementer — hand to Oliver after PR:

1. Legacy total-mode proposal opens in the editor with equal-split section prices, dirty + toast, and Save preserves the original total.
2. Legacy proposal with `miscPrice > 0` gains a "Miscellaneous" section; total unchanged after save.
3. New-proposal flow end-to-end: pipeline popover AND a meeting-list "Create proposal" link both land in the editor on a fresh draft; lenient Save works with empty sections; Save & Preview blocks until every section is priced.
4. Homeowner surfaces (React review page, PDF, summary route) unchanged in both display modes; the toggle only changes homeowner display.
5. Frozen-proposal banners intact; locked legacy proposals show original values (no prefill).
