# Proposal — Agent/Customer View Toggle + SOW Financials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the agent/customer view toggle on the proposal display, replace the per-section `price` field with a richer `financials` object (Section Price + Cost Lines), and surface agent-only Margin and Multiplier KPIs in `PricingBreakdown` — without breaking any existing proposal.

**Architecture:** A `useViewMode()` hook gates internal data behind `ability.can('update', 'Proposal')` AND `?view=agent`. A client `ProposalFlowShell` swaps the layout gradient. Schema migrates via Zod `preprocess` (read-time, no SQL). New pure helpers in `entities/proposals/lib/` compute margin/multiplier — never persisted, following the `computeFinalTcp` precedent. `PricingBreakdown` grows two stacked blocks: customer-facing (always) and Internal Calculation (agent only).

**Tech Stack:** Next.js 15 App Router, Drizzle (Postgres JSONB), Zod, react-hook-form, nuqs, motion/react, Tailwind v4, shadcn/ui, CASL.

**Verification model:** This project has no test runner. Each task ends with `pnpm lint && pnpm tsc` (must pass) and a browser smoke check (manual steps in each task). Commit only after both pass.

**Spec:** `docs/superpowers/specs/2026-05-05-proposal-agent-customer-view-toggle-design.md`

---

## File Structure

**New files:**

| Path | Responsibility |
|---|---|
| `src/features/proposal-flow/hooks/use-view-mode.ts` | Single source of truth for view mode. Reads `?view` and applies CASL gate. |
| `src/features/proposal-flow/ui/components/proposal-flow-shell.tsx` | Client wrapper around layout children. Owns gradient + `data-view-mode` attribute. |
| `src/features/proposal-flow/ui/components/proposal/view-mode-toggle.tsx` | Clickable Badge that toggles `?view=agent`. Visibility gated by ability. |
| `src/features/proposal-flow/ui/components/pricing-breakdown/internal-calculation-block.tsx` | Agent-only "Internal Calculation" block. Sub-component of PricingBreakdown. |
| `src/features/proposal-flow/ui/components/form/sow-financials-fields.tsx` | New SOW "Financials" sub-section: section-price input + cost-line `useFieldArray` + derived totals. |
| `src/shared/entities/proposals/lib/compute-sow-financials.ts` | Pure helpers: `computeSectionCost`, `computeSectionMargin`, `computeSectionMultiplier`, `formatMultiplier`. |
| `src/shared/entities/proposals/lib/compute-proposal-cost-totals.ts` | Pure helper: `computeProposalCostTotals` (aggregate cost, margin, multiplier vs `finalTcp`). |

**Modified files:**

| Path | Change |
|---|---|
| `src/shared/entities/proposals/schemas/index.ts` | Add `costLineSchema`, `sowFinancialsSchema`. Replace `sowSchema` (drop `price`, add `financials` via `preprocess`). Add `superRefine` on `proposalFormSchema`. Update default values. |
| `src/app/(frontend)/proposal-flow/layout.tsx` | Wrap children in `<ProposalFlowShell>`. Move gradient out. |
| `src/features/proposal-flow/ui/components/proposal/index.tsx` | Replace `ability.can('update', 'Proposal')` with `useViewMode()` for `isAgent`. |
| `src/features/proposal-flow/ui/components/proposal/heading.tsx` | Add `<ViewModeToggle>` at start of action row. Gate Profile/Edit buttons on `viewMode === 'agent'`. |
| `src/features/proposal-flow/ui/components/proposal/funding.tsx` | Pass `viewMode` to `<PricingBreakdown>`. |
| `src/features/proposal-flow/ui/components/pricing-breakdown.tsx` | Add `viewMode` prop. Read `sectionPrice` from `financials`. Render `<InternalCalculationBlock>` when agent. |
| `src/features/proposal-flow/ui/components/navbar/navbar.tsx` | Back-link uses `useViewMode()` (agent → dashboard, customer → `/`). |
| `src/features/proposal-flow/ui/components/form/sow-field.tsx` | Remove sticky section-price block. Wrap TipTap in "Scope of Work" Collapsible. Render new "Financials" Collapsible. Wrap MultiSelect.onValuesChange with scope-removal cascade. |
| `src/features/proposal-flow/ui/components/form/sow-collapsible-header.tsx` | Read price chip from `sow.financials.sectionPrice`. |
| `src/features/proposal-flow/ui/components/form/project-fields.tsx` | Update `append({...})` shape. |
| `src/features/proposal-flow/ui/components/form/funding-fields.tsx` | Pass `viewMode="agent"` to PricingBreakdown preview. |
| `src/features/proposal-flow/lib/get-proposal-aggregates.ts` | Read `s.financials.sectionPrice` instead of `s.price`. |
| `docs/domain/ubiquitous-language.md` | Add Price, Cost, Margin, Multiplier, Cost Line, View Mode terms. |

---

## Task 1 — Schema migration foundation

**Goal:** Replace `sow[].price` with `sow[].financials.sectionPrice`, with a `preprocess` that quietly migrates legacy data on read. Update every consumer that reads `sow[].price` so the codebase compiles. **No new UI yet** — the existing sticky section-price input stays put, just rebound to the new path.

**Files:**
- Modify: `src/shared/entities/proposals/schemas/index.ts`
- Modify: `src/features/proposal-flow/ui/components/pricing-breakdown.tsx`
- Modify: `src/features/proposal-flow/ui/components/form/sow-field.tsx`
- Modify: `src/features/proposal-flow/ui/components/form/sow-collapsible-header.tsx`
- Modify: `src/features/proposal-flow/ui/components/form/project-fields.tsx`
- Modify: `src/features/proposal-flow/lib/get-proposal-aggregates.ts`

- [ ] **Step 1.1: Add cost-line + financials schemas, replace sowSchema with preprocess wrapper**

In `src/shared/entities/proposals/schemas/index.ts`, replace the existing `sowSchema` block (currently lines 7-18) with:

```ts
// SUB-SCHEMAS
const homeAreaSchema = z.enum(homeAreas)
export const constructionItemSchema = z.object({
  id: z.string(),
  label: z.string(),
})

export const costLineSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1, 'Label is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  relatedScopeId: z.string().min(1, 'Related scope is required'),
  notes: z.string().optional(),
})
export type CostLine = z.infer<typeof costLineSchema>

export const sowFinancialsSchema = z.object({
  sectionPrice: z.number().nullable(),
  costLines: z.array(costLineSchema),
})
export type SowFinancials = z.infer<typeof sowFinancialsSchema>

const sowShape = z.object({
  contentJSON: z.string(),
  html: z.string(),
  scopes: z.array(constructionItemSchema),
  title: z.string(),
  trade: constructionItemSchema,
  financials: sowFinancialsSchema,
})

/**
 * Read-time migration: legacy proposals stored `sow[].price` at the top
 * level. Map that into the new `financials` shape so existing data loads
 * without error. Idempotent — once a proposal is saved with the new
 * shape, the `'financials' in raw` branch short-circuits.
 */
export const sowSchema = z.preprocess((raw) => {
  if (raw && typeof raw === 'object' && !('financials' in raw)) {
    const { price, ...rest } = raw as { price?: number, [k: string]: unknown }
    return {
      ...rest,
      financials: {
        sectionPrice: typeof price === 'number' ? price : null,
        costLines: [],
      },
    }
  }
  return raw
}, sowShape)
```

- [ ] **Step 1.2: Update default values for new shape**

In the same file, replace the `sow[0]` entry inside `proposalFormBaseDefaultValues` (currently around lines 113-123):

```ts
sow: [
  {
    contentJSON: '',
    html: '',
    scopes: [],
    title: '',
    trade: {
      id: '',
      label: '',
    },
    financials: {
      sectionPrice: null,
      costLines: [],
    },
  },
],
```

- [ ] **Step 1.3: Update PricingBreakdown to read sectionPrice from financials**

In `src/features/proposal-flow/ui/components/pricing-breakdown.tsx`, replace the breakdown-mode iteration (currently lines 17-33). Find:

```tsx
{pricingMode === 'breakdown'
  ? (
      <>
        {sow.filter(s => (s.price ?? 0) > 0).map((section, i) => (
          <div key={`${section.title || i}}`} className="flex items-center justify-between">
            <span className="text-muted-foreground">{section.title || `Section ${i + 1}`}</span>
            <span>{formatAsDollars(section.price!)}</span>
          </div>
        ))}
        {(miscPrice ?? 0) > 0 && (
```

Replace with:

```tsx
{pricingMode === 'breakdown'
  ? (
      <>
        {sow.filter(s => (s.financials.sectionPrice ?? 0) > 0).map((section, i) => (
          <div key={`${section.title || i}}`} className="flex items-center justify-between">
            <span className="text-muted-foreground">{section.title || `Section ${i + 1}`}</span>
            <span>{formatAsDollars(section.financials.sectionPrice!)}</span>
          </div>
        ))}
        {(miscPrice ?? 0) > 0 && (
```

- [ ] **Step 1.4: Update sow-field.tsx form path**

In `src/features/proposal-flow/ui/components/form/sow-field.tsx`, change the existing FormField name (currently line 135). Find:

```tsx
<FormField
  name={`project.data.sow.${index}.price`}
  control={form.control}
```

Replace with:

```tsx
<FormField
  name={`project.data.sow.${index}.financials.sectionPrice`}
  control={form.control}
```

Also update the input's onChange inline value — find (around line 145-147):

```tsx
value={String(field.value || '')}
onChange={e => field.onChange(Number(e.target.value || ''))}
```

Replace with:

```tsx
value={field.value == null ? '' : String(field.value)}
onChange={(e) => {
  const raw = e.target.value
  field.onChange(raw === '' ? null : Number(raw))
}}
```

(`null` is now a legitimate value — it means "no section price", which is valid in total mode. Don't coerce empty string to 0.)

- [ ] **Step 1.5: Update sow-collapsible-header.tsx price chip**

In `src/features/proposal-flow/ui/components/form/sow-collapsible-header.tsx`, find (around line 33):

```tsx
const showPrice = pricingMode === 'breakdown' && sow.price != null && sow.price > 0
```

Replace with:

```tsx
const sectionPrice = sow.financials.sectionPrice
const showPrice = pricingMode === 'breakdown' && sectionPrice != null && sectionPrice > 0
```

Then find (around line 134-136):

```tsx
{showPrice && (
  <Badge variant="secondary" className="bg-emerald-500/10 text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
    $
    {sow.price!.toLocaleString()}
  </Badge>
)}
```

Replace with:

```tsx
{showPrice && (
  <Badge variant="secondary" className="bg-emerald-500/10 text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
    $
    {sectionPrice!.toLocaleString()}
  </Badge>
)}
```

- [ ] **Step 1.6: Update project-fields.tsx append default**

In `src/features/proposal-flow/ui/components/form/project-fields.tsx`, find the `append({...})` call (currently lines 150-160):

```tsx
append({
  contentJSON: '',
  html: '',
  price: pricingMode === 'breakdown' ? 0 : undefined,
  scopes: [],
  title: '',
  trade: {
    id: '',
    label: '',
  },
})
```

Replace with:

```tsx
append({
  contentJSON: '',
  html: '',
  scopes: [],
  title: '',
  trade: {
    id: '',
    label: '',
  },
  financials: {
    sectionPrice: pricingMode === 'breakdown' ? 0 : null,
    costLines: [],
  },
})
```

Also update the duplicate handler (around lines 56-60):

```tsx
function handleDuplicateSection(index: number) {
  const source = form.getValues(`project.data.sow.${index}`)
  const duplicate = {
    ...source,
    title: source.title ? `${source.title} (copy)` : '',
  }
  insert(index + 1, duplicate)
```

This works as-is because `source` already has the new shape via spread. No change needed — but visually verify the spread is shallow-cloning `financials`. To be safe and idempotent, replace with:

```tsx
function handleDuplicateSection(index: number) {
  const source = form.getValues(`project.data.sow.${index}`)
  const duplicate = {
    ...source,
    title: source.title ? `${source.title} (copy)` : '',
    financials: {
      sectionPrice: source.financials.sectionPrice,
      costLines: source.financials.costLines.map(line => ({ ...line, id: crypto.randomUUID() })),
    },
  }
  insert(index + 1, duplicate)
```

(Cost lines need fresh IDs to avoid collisions in the field array's key tracking.)

- [ ] **Step 1.7: Update get-proposal-aggregates.ts**

In `src/features/proposal-flow/lib/get-proposal-aggregates.ts`, find (line 19):

```ts
const totalSOWPriceBreakdown = pricingMode === 'breakdown' ? projectJSON.data.sow.reduce((sum, s) => sum + (s.price ?? 0), 0) : undefined
```

Replace with:

```ts
const totalSOWPriceBreakdown = pricingMode === 'breakdown' ? projectJSON.data.sow.reduce((sum, s) => sum + (s.financials.sectionPrice ?? 0), 0) : undefined
```

- [ ] **Step 1.8: Verify**

Run:

```bash
pnpm lint
pnpm tsc
```

Both must pass. The `tsc` pass is the proof that every consumer of the old `sow.price` field has been updated.

Browser smoke (terminal in worktree):

```bash
pnpm dev -- --port 3001
```

Navigate to an existing proposal in the dashboard. Confirm:
- Existing proposal loads (legacy `price` migrated to `financials.sectionPrice` via preprocess).
- The sticky section-price input in the form still works.
- Saving and reloading round-trips through the new shape.

- [ ] **Step 1.9: Commit**

```bash
git add src/shared/entities/proposals/schemas/index.ts \
        src/features/proposal-flow/ui/components/pricing-breakdown.tsx \
        src/features/proposal-flow/ui/components/form/sow-field.tsx \
        src/features/proposal-flow/ui/components/form/sow-collapsible-header.tsx \
        src/features/proposal-flow/ui/components/form/project-fields.tsx \
        src/features/proposal-flow/lib/get-proposal-aggregates.ts
git commit -m "$(cat <<'EOF'
refactor(proposals): replace sow[].price with financials.sectionPrice

Lays the schema groundwork for cost lines and margin/multiplier KPIs.
Legacy proposals migrate at read time via Zod preprocess. UI placement
unchanged in this commit — only the path is rebound.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 — Pure compute helpers

**Goal:** Add the side-effect-free helpers that compute per-section and aggregate cost / margin / multiplier. No UI changes; just the math.

**Files:**
- Create: `src/shared/entities/proposals/lib/compute-sow-financials.ts`
- Create: `src/shared/entities/proposals/lib/compute-proposal-cost-totals.ts`

- [ ] **Step 2.1: Create compute-sow-financials.ts**

Create `src/shared/entities/proposals/lib/compute-sow-financials.ts`:

```ts
import type { z } from 'zod'
import type { sowSchema } from '@/shared/entities/proposals/schemas'

type SowSection = z.infer<typeof sowSchema>

/**
 * Σ of all cost-line amounts in this section. Returns 0 when there are
 * no cost lines.
 */
export function computeSectionCost(section: SowSection): number {
  return section.financials.costLines.reduce((sum, line) => sum + line.amount, 0)
}

/**
 * `sectionPrice − totalCost`. Returns null when there is no
 * `sectionPrice` (total-mode sections) or when there are no cost lines
 * (cost is unknown rather than zero).
 */
export function computeSectionMargin(section: SowSection): number | null {
  const price = section.financials.sectionPrice
  if (price == null) return null
  if (section.financials.costLines.length === 0) return null
  return price - computeSectionCost(section)
}

/**
 * `sectionPrice ÷ totalCost`. Returns null when sectionPrice is null,
 * cost is 0, or there are no cost lines. Caller formats display.
 */
export function computeSectionMultiplier(section: SowSection): number | null {
  const price = section.financials.sectionPrice
  if (price == null) return null
  const cost = computeSectionCost(section)
  if (cost === 0) return null
  return price / cost
}

/**
 * Format a multiplier for display: 2 decimals, "x" suffix, "—" for null.
 * Used by the agent-only Internal Calculation block.
 */
export function formatMultiplier(value: number | null): string {
  if (value == null) return '—'
  return `${value.toFixed(2)}x`
}
```

- [ ] **Step 2.2: Create compute-proposal-cost-totals.ts**

Create `src/shared/entities/proposals/lib/compute-proposal-cost-totals.ts`:

```ts
import type { InsertProposalSchema } from '@/shared/db/schema'
import { computeFinalTcp } from './compute-final-tcp'
import { computeSectionCost } from './compute-sow-financials'

export interface ProposalCostTotals {
  totalCost: number
  totalMargin: number
  totalMultiplier: number | null
  hasMissingCostData: boolean
}

/**
 * Aggregate cost + margin + multiplier for a proposal, evaluated against
 * `finalTcp` (post-discount). Margin and multiplier are the agent's
 * headline KPIs for "profit per project" — discounts come out of agent
 * profit, so they must be netted in.
 *
 * `totalMultiplier` is null when total cost is 0 (avoids Infinity / NaN).
 * `hasMissingCostData` flags the case where any SOW section has zero
 * cost lines, so the UI can warn that totals are partial.
 */
export function computeProposalCostTotals(data: InsertProposalSchema): ProposalCostTotals {
  const finalTcp = computeFinalTcp(data.fundingJSON.data)

  const totalCost = data.projectJSON.data.sow.reduce(
    (sum, section) => sum + computeSectionCost(section),
    0,
  )

  const hasMissingCostData = data.projectJSON.data.sow.some(
    section => section.financials.costLines.length === 0,
  )

  return {
    totalCost,
    totalMargin: finalTcp - totalCost,
    totalMultiplier: totalCost === 0 ? null : finalTcp / totalCost,
    hasMissingCostData,
  }
}
```

- [ ] **Step 2.3: Verify**

```bash
pnpm lint
pnpm tsc
```

Both must pass. No browser check needed — these are pure functions, no consumers yet.

- [ ] **Step 2.4: Commit**

```bash
git add src/shared/entities/proposals/lib/compute-sow-financials.ts \
        src/shared/entities/proposals/lib/compute-proposal-cost-totals.ts
git commit -m "$(cat <<'EOF'
feat(proposals): add cost / margin / multiplier compute helpers

Pure derived values — never persisted. Aggregate margin and multiplier
use computeFinalTcp (post-discount) so the agent KPI reflects actual
profit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 — View mode infrastructure

**Goal:** Add `useViewMode()` and `<ProposalFlowShell>`. Wire the layout so the gradient swaps when `?view=agent` is in the URL. **No toggle UI yet** — the agent has to set the param manually for this task's smoke test.

**Files:**
- Create: `src/features/proposal-flow/hooks/use-view-mode.ts`
- Create: `src/features/proposal-flow/ui/components/proposal-flow-shell.tsx`
- Modify: `src/app/(frontend)/proposal-flow/layout.tsx`

- [ ] **Step 3.1: Create use-view-mode.ts**

Create `src/features/proposal-flow/hooks/use-view-mode.ts`:

```ts
'use client'

import { useQueryState } from 'nuqs'
import { useAbility } from '@/shared/domains/permissions/hooks'

export type ViewMode = 'customer' | 'agent'

/**
 * Single source of truth for the proposal-flow view mode. Reads `?view`
 * and applies the CASL permission gate inside the hook so no caller can
 * accidentally bypass it: a homeowner who appends `?view=agent` to the
 * URL deterministically gets `'customer'`.
 *
 * Default (no `?view` param) is `'customer'` — agents must opt in,
 * which keeps internal data hidden by default.
 */
export function useViewMode(): ViewMode {
  const [view] = useQueryState('view')
  const ability = useAbility()
  if (view === 'agent' && ability.can('update', 'Proposal')) return 'agent'
  return 'customer'
}
```

- [ ] **Step 3.2: Create proposal-flow-shell.tsx**

Create `src/features/proposal-flow/ui/components/proposal-flow-shell.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'
import { useViewMode } from '@/features/proposal-flow/hooks/use-view-mode'

interface Props {
  children: ReactNode
}

/**
 * Client wrapper for the proposal-flow layout. Owns the page background
 * gradient and a `data-view-mode` attribute. The gradient accent swaps
 * from primary (blue) to destructive (red) when the agent is in agent
 * mode — peripheral-vision tell that internal data is exposed.
 *
 * Lives here (not in `layout.tsx`) because the layout is a server
 * component and the gradient depends on a client-side URL param.
 */
export function ProposalFlowShell({ children }: Props) {
  const viewMode = useViewMode()
  const accent = viewMode === 'agent' ? 'var(--destructive)' : 'var(--primary)'

  return (
    <div
      style={{
        '--sidebar-width': '76px',
        '--sidebar-height': '68px',
        background: `radial-gradient(150% 150% at 50% 0%, var(--background), var(--background), color-mix(in oklab, ${accent} 60%, transparent))`,
      } as React.CSSProperties}
      className="h-full flex flex-col"
      data-no-gutter-stable
      data-view-mode={viewMode}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 3.3: Update layout.tsx to use the shell**

In `src/app/(frontend)/proposal-flow/layout.tsx`, replace the existing layout body. The current body wraps everything in a `<div style={{...}}>`. Replace lines 22-46 (everything from `<div style={...}>` through its closing `</div>`) with:

```tsx
import { ProposalFlowShell } from '@/features/proposal-flow/ui/components/proposal-flow-shell'

// ... existing imports ...

export default async function ProposalFlowLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders })
  const isAuthenticated = Boolean(session)

  return (
    <>
      <ProposalSplashScreen isAuthenticated={isAuthenticated} />
      <GlobalDialogs />
      <ProposalFlowShell>
        <ScrollRootProvider>
          <div className="pt-[env(safe-area-inset-top)]">
            <ProposalPageNavbar />
          </div>
          <div className="container grow min-h-0 py-4 lg:py-8 pb-[max(env(safe-area-inset-bottom),1rem)]">
            <div className="h-full">
              <Suspense fallback={<ProposalFlowLoadingState />}>
                {children}
              </Suspense>
            </div>
          </div>
        </ScrollRootProvider>
      </ProposalFlowShell>
    </>
  )
}
```

(Add the `ProposalFlowShell` import to the top of the file.)

- [ ] **Step 3.4: Verify**

```bash
pnpm lint
pnpm tsc
```

Both must pass.

Browser smoke:

```bash
pnpm dev -- --port 3001
```

1. Open an existing proposal as an agent (signed in as `@triprosremodeling.com`). Default view: blue gradient. Confirm.
2. Manually edit the URL to add `?view=agent`. Reload. Gradient should turn **red** (destructive accent).
3. Inspect the DOM: outer `div` should have `data-view-mode="agent"` (or `"customer"` without the param).
4. Open the proposal in incognito with the homeowner token + manually added `?view=agent`. Gradient must still be **blue** — the hook rejects because the homeowner has no `update` permission.

- [ ] **Step 3.5: Commit**

```bash
git add src/features/proposal-flow/hooks/use-view-mode.ts \
        src/features/proposal-flow/ui/components/proposal-flow-shell.tsx \
        src/app/(frontend)/proposal-flow/layout.tsx
git commit -m "$(cat <<'EOF'
feat(proposal-flow): view-mode hook + client gradient shell

Adds useViewMode() (?view=agent + CASL gate) and ProposalFlowShell
that swaps the page gradient accent. No toggle UI yet — agent mode
is reachable only by URL.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 — View mode toggle Badge + Heading wiring

**Goal:** Render a clickable Badge in the proposal heading. Badge label is `Customer`/`Agent`, variant flips, click toggles `?view=agent`. Profile + Edit buttons gate on `viewMode === 'agent'`.

**Files:**
- Create: `src/features/proposal-flow/ui/components/proposal/view-mode-toggle.tsx`
- Modify: `src/features/proposal-flow/ui/components/proposal/heading.tsx`

- [ ] **Step 4.1: Create view-mode-toggle.tsx**

Create `src/features/proposal-flow/ui/components/proposal/view-mode-toggle.tsx`:

```tsx
'use client'

import { useQueryState } from 'nuqs'
import { useViewMode } from '@/features/proposal-flow/hooks/use-view-mode'
import { Badge } from '@/shared/components/ui/badge'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { cn } from '@/shared/lib/utils'

/**
 * Clickable Badge that flips between Customer and Agent view by writing
 * `?view=agent` to the URL. Only renders for agents; homeowners never
 * see the toggle. The CASL gate inside `useViewMode` is what actually
 * enforces visibility — this guard is a UX nicety to avoid showing a
 * non-functional control.
 */
export function ViewModeToggle() {
  const ability = useAbility()
  const viewMode = useViewMode()
  const [, setView] = useQueryState('view')

  if (!ability.can('update', 'Proposal')) return null

  const isAgent = viewMode === 'agent'

  return (
    <Badge
      variant={isAgent ? 'destructive' : 'secondary'}
      role="button"
      tabIndex={0}
      aria-pressed={isAgent}
      aria-label={isAgent ? 'Switch to customer view' : 'Switch to agent view'}
      onClick={() => setView(isAgent ? null : 'agent')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setView(isAgent ? null : 'agent')
        }
      }}
      className={cn(
        'cursor-pointer text-xs font-semibold uppercase tracking-widest select-none',
        'transition-colors',
      )}
    >
      {isAgent ? 'Agent' : 'Customer'}
    </Badge>
  )
}
```

- [ ] **Step 4.2: Update heading.tsx — add toggle, gate buttons on viewMode**

In `src/features/proposal-flow/ui/components/proposal/heading.tsx`, add the import:

```tsx
import { useViewMode } from '@/features/proposal-flow/hooks/use-view-mode'
import { ViewModeToggle } from './view-mode-toggle'
```

Add the hook call inside the component (after `const { open: openModal, setModal } = useModalStore()`):

```tsx
const viewMode = useViewMode()
```

Replace the action row (currently lines 81-116, the `<div className="flex flex-col lg:flex-row gap-2 lg:gap-6">` block). Find this section:

```tsx
<div className="flex flex-col lg:flex-row gap-2 lg:gap-6">
  <div className="flex items-center justify-center gap-2 text-muted-foreground">
    <CalendarIcon size={20} className="" />
    <p>{formatStringAsDate(proposal.data.createdAt, { hour: undefined, minute: undefined })}</p>
  </div>
  <div className="flex items-center justify-center gap-2 text-muted-foreground">
    <Logo variant="icon" className="size-5" />
    <p>{companyInfo.name}</p>
  </div>
  {ability.can('read', 'Customer') && proposal.data.customer?.id && (
    <div className="flex items-center justify-center gap-2 text-muted-foreground">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleViewProfile(proposal.data?.customer?.id)}
      >
        <UserIcon className="size-4" />
        {`View ${customerName}'s Profile`}
      </Button>
    </div>
  )}
  {ability.can('update', 'Proposal') && (
    <div className="flex items-center justify-center gap-2 text-muted-foreground">
      <Button
        variant="outline"
        size="sm"
        asChild
      >
        <a href={ROOTS.dashboard.proposals.byId(proposal.data.id)}>
          <PencilIcon className="size-4" />
          Edit Proposal
        </a>
      </Button>
    </div>
  )}
</div>
```

Replace with:

```tsx
<div className="flex flex-col lg:flex-row items-center gap-2 lg:gap-6">
  <ViewModeToggle />
  <div className="flex items-center justify-center gap-2 text-muted-foreground">
    <CalendarIcon size={20} className="" />
    <p>{formatStringAsDate(proposal.data.createdAt, { hour: undefined, minute: undefined })}</p>
  </div>
  <div className="flex items-center justify-center gap-2 text-muted-foreground">
    <Logo variant="icon" className="size-5" />
    <p>{companyInfo.name}</p>
  </div>
  {viewMode === 'agent' && ability.can('read', 'Customer') && proposal.data.customer?.id && (
    <div className="flex items-center justify-center gap-2 text-muted-foreground">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleViewProfile(proposal.data?.customer?.id)}
      >
        <UserIcon className="size-4" />
        {`View ${customerName}'s Profile`}
      </Button>
    </div>
  )}
  {viewMode === 'agent' && ability.can('update', 'Proposal') && (
    <div className="flex items-center justify-center gap-2 text-muted-foreground">
      <Button
        variant="outline"
        size="sm"
        asChild
      >
        <a href={ROOTS.dashboard.proposals.byId(proposal.data.id)}>
          <PencilIcon className="size-4" />
          Edit Proposal
        </a>
      </Button>
    </div>
  )}
</div>
```

(Two changes: `<ViewModeToggle />` is the first child, and the Profile + Edit buttons now require `viewMode === 'agent'` AND the existing CASL check.)

- [ ] **Step 4.3: Verify**

```bash
pnpm lint
pnpm tsc
```

Both must pass.

Browser smoke:
1. Open a proposal as agent. Default state: badge says `Customer` (secondary), no Edit/Profile buttons visible, blue gradient.
2. Click the badge. URL gains `?view=agent`. Badge turns red and says `Agent`. Edit + Profile buttons appear. Gradient turns red.
3. Click again. `?view` removed. Back to customer state.
4. Reload on `?view=agent` — agent mode persists.
5. Tab to the badge and press Enter / Space — same toggle behavior (a11y check).

- [ ] **Step 4.4: Commit**

```bash
git add src/features/proposal-flow/ui/components/proposal/view-mode-toggle.tsx \
        src/features/proposal-flow/ui/components/proposal/heading.tsx
git commit -m "$(cat <<'EOF'
feat(proposal): clickable view-mode toggle in heading

Agent-only Badge that flips ?view between unset (customer) and 'agent'.
Profile + Edit buttons are now gated on viewMode === 'agent', so the
default agent view matches the homeowner experience.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 — Thread viewMode through the proposal display

**Goal:** Switch the agreement section, navbar back-link, and `PricingBreakdown` viewMode prop to source from `useViewMode()` instead of raw ability checks. Add the `<InternalCalculationBlock>` sub-component to `PricingBreakdown` so agent view shows the second stacked block.

**Files:**
- Create: `src/features/proposal-flow/ui/components/pricing-breakdown/internal-calculation-block.tsx`
- Modify: `src/features/proposal-flow/ui/components/pricing-breakdown.tsx`
- Modify: `src/features/proposal-flow/ui/components/proposal/index.tsx`
- Modify: `src/features/proposal-flow/ui/components/proposal/funding.tsx`
- Modify: `src/features/proposal-flow/ui/components/navbar/navbar.tsx`
- Modify: `src/features/proposal-flow/ui/components/form/funding-fields.tsx`

- [ ] **Step 5.1: Create internal-calculation-block.tsx**

Create the directory and file: `src/features/proposal-flow/ui/components/pricing-breakdown/internal-calculation-block.tsx`:

```tsx
import type { InsertProposalSchema } from '@/shared/db/schema'
import { LockIcon } from 'lucide-react'
import { computeProposalCostTotals } from '@/shared/entities/proposals/lib/compute-proposal-cost-totals'
import {
  computeSectionCost,
  computeSectionMargin,
  computeSectionMultiplier,
  formatMultiplier,
} from '@/shared/entities/proposals/lib/compute-sow-financials'
import { formatAsDollars } from '@/shared/lib/formatters'

interface Props {
  proposalData: InsertProposalSchema
}

/**
 * Agent-only "Internal Calculation" block. Renders below the
 * customer-facing PricingBreakdown when viewMode === 'agent'. Shows
 * per-section cost (and price/margin/multiplier in breakdown mode)
 * plus an aggregate footer with Total Cost, Total Margin, Multiplier
 * computed against finalTcp.
 */
export function InternalCalculationBlock({ proposalData }: Props) {
  const { pricingMode } = proposalData.formMetaJSON
  const sow = proposalData.projectJSON.data.sow
  const totals = computeProposalCostTotals(proposalData)
  const isBreakdown = pricingMode === 'breakdown'

  return (
    <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 overflow-hidden text-sm">
      <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-destructive/20">
        <div className="flex items-center gap-2">
          <LockIcon className="size-4 text-destructive" />
          <span className="font-semibold">Internal Calculation</span>
        </div>
        <span className="text-xs text-muted-foreground">Visible only to you</span>
      </div>

      <div className="px-5 py-4 space-y-2">
        {isBreakdown
          ? (
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-6 gap-y-2 items-baseline">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Section</span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground text-right">Price</span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground text-right">Cost</span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground text-right">Margin</span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground text-right">Multiplier</span>

                {sow.map((section, i) => {
                  const cost = computeSectionCost(section)
                  const margin = computeSectionMargin(section)
                  const multiplier = computeSectionMultiplier(section)
                  const hasCost = section.financials.costLines.length > 0
                  return (
                    <Fragment key={`${section.title || i}`}>
                      <span className="text-muted-foreground truncate">{section.title || `Section ${i + 1}`}</span>
                      <span className="text-right tabular-nums">
                        {section.financials.sectionPrice == null ? '—' : formatAsDollars(section.financials.sectionPrice)}
                      </span>
                      <span className="text-right tabular-nums">{hasCost ? formatAsDollars(cost) : '—'}</span>
                      <span className="text-right tabular-nums">{margin == null ? '—' : formatAsDollars(margin)}</span>
                      <span className="text-right tabular-nums">{formatMultiplier(multiplier)}</span>
                    </Fragment>
                  )
                })}
              </div>
            )
          : (
              <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 items-baseline">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Section</span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground text-right">Cost</span>

                {sow.map((section, i) => {
                  const cost = computeSectionCost(section)
                  const hasCost = section.financials.costLines.length > 0
                  return (
                    <Fragment key={`${section.title || i}`}>
                      <span className="text-muted-foreground truncate">{section.title || `Section ${i + 1}`}</span>
                      <span className="text-right tabular-nums">{hasCost ? formatAsDollars(cost) : '—'}</span>
                    </Fragment>
                  )
                })}
              </div>
            )}
      </div>

      <div className="border-t border-destructive/20 px-5 py-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Total Cost</span>
          <span className="font-medium tabular-nums">{formatAsDollars(totals.totalCost)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            Total Margin
            <span className="ml-2 text-xs">(Final Price − Total Cost)</span>
          </span>
          <span className="font-medium tabular-nums">{formatAsDollars(totals.totalMargin)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            Multiplier
            <span className="ml-2 text-xs">(Final Price ÷ Total Cost)</span>
          </span>
          <span className="font-semibold tabular-nums">{formatMultiplier(totals.totalMultiplier)}</span>
        </div>
      </div>

      {totals.hasMissingCostData && (
        <div className="border-t border-destructive/20 px-5 py-3 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs">
          ⚠ One or more sections are missing cost data — multiplier and margin reflect partial cost.
        </div>
      )}
    </div>
  )
}
```

Add the missing `Fragment` import at the top of the file:

```tsx
import { Fragment } from 'react'
```

(Required because the grid layout uses fragments to emit multiple cells per section.)

- [ ] **Step 5.2: Update pricing-breakdown.tsx — viewMode prop + InternalCalculationBlock**

In `src/features/proposal-flow/ui/components/pricing-breakdown.tsx`, replace the entire file contents:

```tsx
import type { InsertProposalSchema } from '@/shared/db/schema'
import { CheckIcon } from 'lucide-react'
import { computeFinalTcp } from '@/shared/entities/proposals/lib/compute-final-tcp'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { ExpirationBadge } from './expiration-badge'
import { InternalCalculationBlock } from './pricing-breakdown/internal-calculation-block'

interface Props {
  proposalData: InsertProposalSchema
  viewMode?: 'customer' | 'agent'
}

export function PricingBreakdown({ proposalData, viewMode = 'customer' }: Props) {
  const { pricingMode } = proposalData.formMetaJSON
  const sow = proposalData.projectJSON.data.sow
  const { incentives, miscPrice, startingTcp } = proposalData.fundingJSON.data
  const finalTcp = computeFinalTcp(proposalData.fundingJSON.data)

  return (
    <div className="space-y-0">
      <div className="rounded-xl border border-border/40 overflow-hidden text-sm">
        <div className="px-5 py-4 space-y-2.5">
          {pricingMode === 'breakdown'
            ? (
                <>
                  {sow.filter(s => (s.financials.sectionPrice ?? 0) > 0).map((section, i) => (
                    <div key={`${section.title || i}}`} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{section.title || `Section ${i + 1}`}</span>
                      <span>{formatAsDollars(section.financials.sectionPrice!)}</span>
                    </div>
                  ))}
                  {(miscPrice ?? 0) > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Misc</span>
                      <span>{formatAsDollars(miscPrice!)}</span>
                    </div>
                  )}
                </>
              )
            : (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Contract Price</span>
                  <span>{formatAsDollars(startingTcp)}</span>
                </div>
              )}
        </div>

        {pricingMode === 'breakdown' && (
          <div className="border-t border-border/40 px-5 py-3 flex items-center justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatAsDollars(startingTcp)}</span>
          </div>
        )}

        {incentives.length > 0 && (
          <>
            <div className="border-t border-border/40" />
            <div className="px-5 py-4 space-y-2.5 text-emerald-700 dark:text-emerald-400">
              {incentives.map((incentive, i) => {
                const isExpired = incentive.expiresAt ? new Date() >= new Date(incentive.expiresAt) : false
                const expiresAt = incentive.expiresAt ? new Date(incentive.expiresAt) : null

                if (incentive.type === 'discount') {
                  return (
                    <div key={`discount-${incentive.notes ?? i}`} className="space-y-1">
                      <div className={cn('flex items-center justify-between', isExpired && 'line-through opacity-60')}>
                        <span>{incentive.notes || 'Discount'}</span>
                        <span className="font-medium">
                          -
                          {formatAsDollars(incentive.amount)}
                        </span>
                      </div>
                      {expiresAt && !isExpired && (
                        <ExpirationBadge expiresAt={expiresAt} />
                      )}
                    </div>
                  )
                }
                return (
                  <div key={`offer-${incentive.offer ?? i}`} className="space-y-1">
                    <div className={cn('flex items-center justify-between', isExpired && 'line-through opacity-60')}>
                      <div className="flex items-center">
                        <span>{incentive.offer || 'Exclusive Offer'}</span>
                        {incentive.notes && (
                          <span className="mx-2 flex items-center gap-2">
                            {' '}
                            -
                            <p className="text-muted-foreground text-xs">{incentive.notes}</p>
                          </span>
                        )}
                      </div>
                      <span className="font-medium flex items-center gap-1">
                        <CheckIcon className="w-3.5 h-3.5" />
                        Included
                      </span>
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
          incentives.length === 0 && pricingMode === 'total' && 'border-t-0',
        )}
        >
          <span className="font-semibold">Final Contract Price</span>
          <span className="font-semibold text-base">{formatAsDollars(finalTcp)}</span>
        </div>
      </div>

      {viewMode === 'agent' && (
        <InternalCalculationBlock proposalData={proposalData} />
      )}
    </div>
  )
}
```

- [ ] **Step 5.3: Update proposal/index.tsx — pass viewMode through**

In `src/features/proposal-flow/ui/components/proposal/index.tsx`, add the import:

```tsx
import { useViewMode } from '@/features/proposal-flow/hooks/use-view-mode'
```

Replace the existing `viewerRole` line (currently around line 71):

```tsx
const viewerRole = ability.can('update', 'Proposal') ? 'agent' : 'homeowner'
const proposalSteps = generateProposalSteps(viewerRole)
```

With:

```tsx
const viewMode = useViewMode()
const viewerRole = ability.can('update', 'Proposal') ? 'agent' : 'homeowner'
const proposalSteps = generateProposalSteps(viewerRole)
```

(`viewerRole` still drives step filtering — agents always see all steps. `viewMode` controls *display* of internal data within those steps.)

Then in the agreement step rendering (around line 100), change the `isAgent` prop:

```tsx
isAgent={ability.can('update', 'Proposal')}
```

To:

```tsx
isAgent={viewMode === 'agent'}
```

- [ ] **Step 5.4: Update proposal/funding.tsx — pass viewMode to PricingBreakdown**

In `src/features/proposal-flow/ui/components/proposal/funding.tsx`, add the import:

```tsx
import { useViewMode } from '@/features/proposal-flow/hooks/use-view-mode'
```

Inside the component, after the existing hooks, add:

```tsx
const viewMode = useViewMode()
```

Find:

```tsx
<PricingBreakdown proposalData={proposalData} />
```

Replace with:

```tsx
<PricingBreakdown proposalData={proposalData} viewMode={viewMode} />
```

- [ ] **Step 5.5: Update navbar.tsx — back-link uses viewMode**

In `src/features/proposal-flow/ui/components/navbar/navbar.tsx`, add the import:

```tsx
import { useViewMode } from '@/features/proposal-flow/hooks/use-view-mode'
```

Find:

```tsx
const backHref = hasMounted && ability.can('access', 'Dashboard') ? ROOTS.dashboard.root : '/'
```

Replace with:

```tsx
const viewMode = useViewMode()
const backHref = hasMounted && viewMode === 'agent' && ability.can('access', 'Dashboard') ? ROOTS.dashboard.root : '/'
```

(The `ability.can('access', 'Dashboard')` check stays as a defense-in-depth safety net — a homeowner manually appending `?view=agent` would already get `viewMode = 'customer'` from the hook, but this keeps the navbar's intent legible.)

- [ ] **Step 5.6: Update funding-fields.tsx — agent-mode preview**

In `src/features/proposal-flow/ui/components/form/funding-fields.tsx`, find the existing PricingBreakdown render (around line 363):

```tsx
<PricingBreakdown proposalData={formValuesToProposal(form.getValues())} />
```

Replace with:

```tsx
<PricingBreakdown proposalData={formValuesToProposal(form.getValues())} viewMode="agent" />
```

(The form is agent-only, so the preview always renders the Internal Calculation block.)

- [ ] **Step 5.7: Verify**

```bash
pnpm lint
pnpm tsc
```

Both must pass.

Browser smoke:
1. Open a proposal as agent. Default view: customer. Funding section shows only the customer block (no Internal Calculation).
2. Toggle to agent mode. Funding section now shows two stacked blocks — customer breakdown (unchanged) and a destructive-tinted "Internal Calculation" block beneath it with a lock icon.
3. Confirm the Agreement section flips to `AgentContractView` in agent mode.
4. Confirm the navbar back-link points to `/dashboard` in agent mode and `/` in customer mode.
5. Switch the proposal between breakdown and total pricing modes. Confirm the Internal Calculation block changes column layout: 4 columns (Price/Cost/Margin/Multiplier) in breakdown, 1 column (Cost) in total.
6. Open the proposal edit form. The funding-fields preview now shows the Internal Calculation by default (agent-only context).
7. As a homeowner (incognito + token), confirm: still customer-only view, no Internal Calculation block, even with `?view=agent` in URL.

- [ ] **Step 5.8: Commit**

```bash
git add src/features/proposal-flow/ui/components/pricing-breakdown.tsx \
        src/features/proposal-flow/ui/components/pricing-breakdown/internal-calculation-block.tsx \
        src/features/proposal-flow/ui/components/proposal/index.tsx \
        src/features/proposal-flow/ui/components/proposal/funding.tsx \
        src/features/proposal-flow/ui/components/navbar/navbar.tsx \
        src/features/proposal-flow/ui/components/form/funding-fields.tsx
git commit -m "$(cat <<'EOF'
feat(proposal): agent-only Internal Calculation block in PricingBreakdown

Threads viewMode through Proposal → Funding → PricingBreakdown.
Adds a stacked Internal Calculation block (cost / margin / multiplier)
that renders only in agent view. Agreement section + navbar back-link
now also key off viewMode so customer-preview is end-to-end faithful.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 — SOW Financials form UI (cost-line editor)

**Goal:** Replace the sticky section-price block with two new collapsibles inside each SOW section: "Scope of Work" (wraps the existing TipTap) and "Financials" (section price + cost-line editor + derived totals). Wire the scope-removal cascade.

**Files:**
- Create: `src/features/proposal-flow/ui/components/form/sow-financials-fields.tsx`
- Modify: `src/features/proposal-flow/ui/components/form/sow-field.tsx`

- [ ] **Step 6.1: Create sow-financials-fields.tsx**

Create `src/features/proposal-flow/ui/components/form/sow-financials-fields.tsx`:

```tsx
'use client'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { PlusIcon, TrashIcon } from 'lucide-react'
import { useState } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { Button } from '@/shared/components/ui/button'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Textarea } from '@/shared/components/ui/textarea'
import {
  computeSectionCost,
  computeSectionMargin,
  computeSectionMultiplier,
  formatMultiplier,
} from '@/shared/entities/proposals/lib/compute-sow-financials'
import { formatAsDollars } from '@/shared/lib/formatters'

interface Props {
  index: number
  pricingMode: 'total' | 'breakdown'
}

export function SOWFinancialsFields({ index, pricingMode }: Props) {
  const form = useFormContext<ProposalFormSchema>()

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: `project.data.sow.${index}.financials.costLines`,
  })

  const [openNotes, setOpenNotes] = useState<Set<number>>(() => new Set())

  const selectedScopes = useWatch({
    control: form.control,
    name: `project.data.sow.${index}.scopes`,
  })

  const sectionSnapshot = useWatch({
    control: form.control,
    name: `project.data.sow.${index}`,
  })

  const sectionCost = computeSectionCost(sectionSnapshot)
  const sectionMargin = computeSectionMargin(sectionSnapshot)
  const sectionMultiplier = computeSectionMultiplier(sectionSnapshot)

  const canAddCostLine = selectedScopes.length > 0
  const isBreakdown = pricingMode === 'breakdown'

  function toggleNotes(lineIndex: number) {
    setOpenNotes((prev) => {
      const next = new Set(prev)
      if (next.has(lineIndex)) {
        next.delete(lineIndex)
      }
      else {
        next.add(lineIndex)
      }
      return next
    })
  }

  return (
    <div className="space-y-4 px-3 pb-4 pt-2 lg:px-4 lg:pb-5">
      {/* Section Price */}
      <FormField
        name={`project.data.sow.${index}.financials.sectionPrice`}
        control={form.control}
        render={({ field }) => (
          <FormItem className="w-48">
            <FormLabel>
              Section Price
              {!isBreakdown && (
                <span className="ml-2 text-xs text-muted-foreground">(disabled in total mode)</span>
              )}
            </FormLabel>
            <FormControl>
              <Input
                type="text"
                placeholder="$10,000"
                disabled={!isBreakdown}
                value={field.value == null ? '' : String(field.value)}
                onChange={(e) => {
                  const raw = e.target.value
                  field.onChange(raw === '' ? null : Number(raw.replace(/\D/g, '')))
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Cost Lines */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-t border-border/30 pt-3">
          <h5 className="text-sm font-semibold">Cost Lines</h5>
          <div className="flex items-center gap-2">
            {!canAddCostLine && (
              <span className="text-xs text-muted-foreground">Pick scopes for this section first</span>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={!canAddCostLine}
              onClick={() => {
                append({
                  id: crypto.randomUUID(),
                  label: '',
                  amount: 0,
                  relatedScopeId: selectedScopes[0]?.id ?? '',
                  notes: '',
                })
              }}
            >
              <PlusIcon className="size-4" />
              Add cost line
            </Button>
          </div>
        </div>

        {fields.length === 0
          ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                No cost lines yet
              </p>
            )
          : (
              <div className="space-y-3">
                {fields.map((field, lineIndex) => (
                  <div
                    key={field.id}
                    className="rounded-lg border border-border/30 bg-card p-3 space-y-3"
                  >
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr_1.5fr_auto]">
                      <FormField
                        name={`project.data.sow.${index}.financials.costLines.${lineIndex}.label`}
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Label</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Labor" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        name={`project.data.sow.${index}.financials.costLines.${lineIndex}.amount`}
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Amount</FormLabel>
                            <FormControl>
                              <Input
                                type="text"
                                placeholder="$1,000"
                                value={field.value === 0 ? '' : String(field.value)}
                                onChange={(e) => {
                                  const numeric = Number(e.target.value.replace(/\D/g, ''))
                                  field.onChange(numeric)
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        name={`project.data.sow.${index}.financials.costLines.${lineIndex}.relatedScopeId`}
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Related Scope</FormLabel>
                            <FormControl>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select scope" />
                                </SelectTrigger>
                                <SelectContent>
                                  {selectedScopes.map(scope => (
                                    <SelectItem key={scope.id} value={scope.id}>
                                      {scope.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex items-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          onClick={() => toggleNotes(lineIndex)}
                        >
                          {openNotes.has(lineIndex) ? 'Hide notes' : 'Add notes'}
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => remove(lineIndex)}
                          aria-label="Remove cost line"
                        >
                          <TrashIcon className="size-4" />
                        </Button>
                      </div>
                    </div>
                    {openNotes.has(lineIndex) && (
                      <FormField
                        name={`project.data.sow.${index}.financials.costLines.${lineIndex}.notes`}
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Notes</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                value={field.value ?? ''}
                                placeholder="Additional context for this cost line"
                                rows={2}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
      </div>

      {/* Derived totals */}
      <div className="rounded-lg bg-muted/30 px-4 py-3 space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Total Cost</span>
          <span className="font-medium tabular-nums">{formatAsDollars(sectionCost)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Margin</span>
          <span className="font-medium tabular-nums">
            {sectionMargin == null ? '—' : formatAsDollars(sectionMargin)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Multiplier</span>
          <span className="font-semibold tabular-nums">{formatMultiplier(sectionMultiplier)}</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6.2: Restructure sow-field.tsx — two new collapsibles + scope cascade**

In `src/features/proposal-flow/ui/components/form/sow-field.tsx`, replace the file contents:

```tsx
import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { TiptapHandle } from '@/shared/components/tiptap/tiptap'
import type { ScopeOrAddon } from '@/shared/services/notion/lib/scopes/schema'
import { useQueryClient } from '@tanstack/react-query'

import { ChevronDownIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { TemplatesModal } from '@/shared/components/dialogs/modals/templates-modal'
import { Tiptap } from '@/shared/components/tiptap/tiptap'
import { Button } from '@/shared/components/ui/button'
import { Collapsible, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { MultiSelect, MultiSelectContent, MultiSelectGroup, MultiSelectItem, MultiSelectTrigger, MultiSelectValue } from '@/shared/components/ui/multi-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { useGetScopes } from '@/shared/services/notion/dal/scopes/hooks/queries/use-get-scopes'
import { useGetAllTrades } from '@/shared/services/notion/dal/trades/hooks/queries/use-get-trades'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'
import { SOWFinancialsFields } from './sow-financials-fields'

const TRANSITION = { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } as const

interface Props {
  index: number
  pricingMode: 'total' | 'breakdown'
  sowSnapshot: ProposalFormSchema['project']['data']['sow'][0]
}

export function SOWSection({
  index,
  pricingMode,
  sowSnapshot,
}: Props) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const form = useFormContext<ProposalFormSchema>()
  const [tradeId, setTradeId] = useState<string | undefined>(sowSnapshot.trade.id || undefined)
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false)
  const [scopeOpen, setScopeOpen] = useState(true)
  const [financialsOpen, setFinancialsOpen] = useState(true)
  const tiptapRef = useRef<TiptapHandle | null>(null)

  const allTrades = useGetAllTrades()
  const scopesOfTrade = useGetScopes({ query: tradeId, filterProperty: 'relatedTrade' }, { enabled: !!tradeId })

  const [ScopeRemovalDialog, confirmScopeRemoval] = useConfirm({
    title: 'Remove cost lines?',
    message: 'Removing this scope will also remove cost lines tied to it. Continue?',
  })

  function getScopesOfTrade(tradeId: string) {
    if (!tradeId) return
    setTradeId(tradeId)
  }

  const { open: openModal, close: closeModal, setModal } = useModalStore()

  async function handleScopesChange(values: string[]) {
    const oldScopes = form.getValues(`project.data.sow.${index}.scopes`)
    const oldIds = new Set(oldScopes.map(s => s.id))
    const newIds = new Set(values)

    const removedIds: string[] = []
    for (const id of oldIds) {
      if (!newIds.has(id)) removedIds.push(id)
    }

    if (removedIds.length > 0) {
      const costLines = form.getValues(`project.data.sow.${index}.financials.costLines`)
      const orphans = costLines.filter(line => removedIds.includes(line.relatedScopeId))
      if (orphans.length > 0) {
        const confirmed = await confirmScopeRemoval()
        if (!confirmed) return
        const remaining = costLines.filter(line => !removedIds.includes(line.relatedScopeId))
        form.setValue(`project.data.sow.${index}.financials.costLines`, remaining)
      }
    }

    const newScopesArray = values.map((scopeId) => {
      const scopeOfTrade = scopesOfTrade.data?.find(scope => scope.id === scopeId) as ScopeOrAddon
      return { id: scopeOfTrade.id, label: scopeOfTrade.name }
    })
    form.setValue(`project.data.sow.${index}.scopes`, newScopesArray)
  }

  return (
    <>
      <ScopeRemovalDialog />
      <div className="flex flex-col gap-3 items-center w-full overflow-auto lg:gap-4">
        {/* Trade + Scope pickers */}
        <div className="flex flex-col gap-2 rounded-lg w-full px-3 pt-2 lg:flex-row lg:items-end lg:px-0 lg:pt-0">
          <FormField
            control={form.control}
            name={`project.data.sow.${index}.trade.id`}
            render={({ field }) => (
              <FormItem className="w-full lg:max-w-62.5">
                <FormControl className="w-full">
                  <Select
                    value={field.value}
                    onValueChange={(val) => {
                      field.onChange(val)
                      getScopesOfTrade(val)
                      form.setValue(`project.data.sow.${index}.scopes`, [])
                      form.setValue(`project.data.sow.${index}.trade.label`, allTrades.data?.find(trade => trade.id === val)?.name || '')
                    }}
                  >
                    <SelectTrigger {...field} className="w-full bg-transparent dark:bg-transparent border-0">
                      <SelectValue placeholder="Select a trade" />
                    </SelectTrigger>
                    <SelectContent {...field}>
                      {allTrades.data?.map(trade => (
                        <SelectItem key={trade.id} value={trade.id}>
                          {trade.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`project.data.sow.${index}.scopes`}
            render={({ field }) => (
              <FormItem className="w-full">
                <MultiSelect
                  onValuesChange={handleScopesChange}
                  values={field.value.map(scope => scope.id)}
                >
                  <FormControl>
                    <MultiSelectTrigger className="w-full" disabled={scopesOfTrade.isLoading}>
                      <MultiSelectValue placeholder={scopesOfTrade.isLoading ? 'Loading...' : 'Select scopes'} />
                    </MultiSelectTrigger>
                  </FormControl>
                  <MultiSelectContent
                    search={{
                      emptyMessage: 'No scopes found',
                      placeholder: 'Search scopes...',
                    }}
                  >
                    <MultiSelectGroup>
                      {scopesOfTrade.data?.map(scope => (
                        <MultiSelectItem key={scope.id} value={scope.id}>
                          {scope.name}
                        </MultiSelectItem>
                      ))}
                    </MultiSelectGroup>
                  </MultiSelectContent>
                </MultiSelect>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Scope of Work collapsible */}
        <div className="w-full">
          <Collapsible open={scopeOpen} onOpenChange={setScopeOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 lg:px-4"
              >
                <span>Scope of Work</span>
                <ChevronDownIcon className={cn('size-4 transition-transform', !scopeOpen && '-rotate-90')} />
              </button>
            </CollapsibleTrigger>
            <AnimatePresence initial={false}>
              {scopeOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={TRANSITION}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 lg:px-4 lg:pb-4">
                    <FormField
                      name={`project.data.sow.${index}.contentJSON`}
                      control={form.control}
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex gap-2 items-center">
                            <Button
                              variant="outline"
                              type="button"
                              className="text-xs text-muted-foreground hover:underline"
                              size="sm"
                              onClick={() => {
                                setModal({
                                  accessor: 'Templates',
                                  Component: TemplatesModal,
                                  props: {
                                    trade: allTrades.data?.find(trade => trade.id === tradeId),
                                    scopes: form.getValues(`project.data.sow.${index}.scopes`).map(scope => scopesOfTrade.data?.find(scopeOfTrade => scopeOfTrade.id === scope.id)).filter(Boolean) as ScopeOrAddon[],
                                    onSelect: async (sowId) => {
                                      closeModal()
                                      setIsLoadingTemplate(true)
                                      try {
                                        const json = await queryClient.fetchQuery(trpc.notionRouter.scopes.getSOWContent.queryOptions({ sowId }))
                                        tiptapRef.current?.insertContent(JSON.parse(json) || '')
                                      }
                                      finally {
                                        setIsLoadingTemplate(false)
                                      }
                                    },
                                  },
                                })
                                openModal()
                              }}
                            >
                              Templates
                            </Button>
                          </div>
                          <FormControl>
                            <Tiptap
                              ref={tiptapRef}
                              isLoading={isLoadingTemplate}
                              loadingMessage="Loading template from Notion..."
                              onChange={({ html, json }) => {
                                field.onChange(JSON.stringify(json))
                                form.setValue(`project.data.sow.${index}.html`, html)
                              }}
                              initialValues={field.value ? JSON.parse(field.value) : undefined}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Collapsible>
        </div>

        {/* Financials collapsible */}
        <div className="w-full border-t border-border/30">
          <Collapsible open={financialsOpen} onOpenChange={setFinancialsOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 lg:px-4"
              >
                <span>Financials</span>
                <ChevronDownIcon className={cn('size-4 transition-transform', !financialsOpen && '-rotate-90')} />
              </button>
            </CollapsibleTrigger>
            <AnimatePresence initial={false}>
              {financialsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={TRANSITION}
                  className="overflow-hidden"
                >
                  <SOWFinancialsFields index={index} pricingMode={pricingMode} />
                </motion.div>
              )}
            </AnimatePresence>
          </Collapsible>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 6.3: Verify**

```bash
pnpm lint
pnpm tsc
```

Both must pass.

Browser smoke:
1. Navigate to a proposal edit form. Open a SOW section.
2. Confirm two new collapsibles: "Scope of Work" (TipTap editor inside) and "Financials" (section price + cost lines + derived totals).
3. Both default open.
4. With no scopes selected, "Add cost line" button is disabled and shows the "Pick scopes for this section first" hint.
5. Pick a trade → pick a scope. "Add cost line" becomes enabled. Click it. A cost-line card appears with Label / Amount / Related Scope / Add notes / Remove.
6. Fill label "Labor", amount $5,000, scope picker shows the section's scopes. Confirm derived display updates: Total Cost $5,000, Margin = sectionPrice − $5,000, Multiplier shows 2-decimal `Nx`.
7. Add a second cost line, $3,000. Total updates to $8,000.
8. Remove a scope that has cost lines pointing to it → confirm dialog appears. Cancel → scope change reverted. Confirm → orphan cost lines removed.
9. Switch the proposal to total pricing mode. Section Price input goes disabled with "(disabled in total mode)" label. Cost lines + derived display still work.
10. Save the proposal. Reload. Confirm cost lines persist. Open in display view and toggle to agent mode — Internal Calculation block reflects the cost data.

- [ ] **Step 6.4: Commit**

```bash
git add src/features/proposal-flow/ui/components/form/sow-financials-fields.tsx \
        src/features/proposal-flow/ui/components/form/sow-field.tsx
git commit -m "$(cat <<'EOF'
feat(proposal-form): SOW Financials sub-section + cost-line editor

Each SOW section now has Scope-of-Work and Financials collapsibles.
Financials hosts the section price, a useFieldArray cost-line editor
(label/amount/related-scope/notes), and a live derived display of
total cost, margin, and multiplier. Removing a scope with cost lines
attached prompts a confirmation before orphaning the data.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7 — Proposal-level conditional validation

**Goal:** Enforce two rules at form-submit time: (1) `sectionPrice` is required + positive in breakdown mode; (2) every cost line's `relatedScopeId` must reference one of the section's selected scopes.

**Files:**
- Modify: `src/shared/entities/proposals/schemas/index.ts`

- [ ] **Step 7.1: Add superRefine to proposalFormSchema**

In `src/shared/entities/proposals/schemas/index.ts`, find the existing `proposalFormSchema` definition (currently around lines 96-100):

```ts
export const proposalFormSchema = z.object({
  meta: formMetaSectionSchema,
  project: projectSectionSchema,
  funding: fundingSectionSchema,
})
```

Replace with:

```ts
const proposalFormShape = z.object({
  meta: formMetaSectionSchema,
  project: projectSectionSchema,
  funding: fundingSectionSchema,
})

export const proposalFormSchema = proposalFormShape.superRefine((proposal, ctx) => {
  const isBreakdown = proposal.meta.pricingMode === 'breakdown'

  proposal.project.data.sow.forEach((section, sectionIndex) => {
    // 1. Section price required + positive in breakdown mode
    if (isBreakdown) {
      const sp = section.financials.sectionPrice
      if (sp === null || sp <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['project', 'data', 'sow', sectionIndex, 'financials', 'sectionPrice'],
          message: 'Section price is required in breakdown pricing mode',
        })
      }
    }

    // 2. Every cost line's relatedScopeId must match a selected scope
    const selectedScopeIds = new Set(section.scopes.map(s => s.id))
    section.financials.costLines.forEach((line, lineIndex) => {
      if (!selectedScopeIds.has(line.relatedScopeId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['project', 'data', 'sow', sectionIndex, 'financials', 'costLines', lineIndex, 'relatedScopeId'],
          message: "Related scope must be one of this section's selected scopes",
        })
      }
    })
  })
})
```

(Splitting into a base shape + refined export keeps both available — the refined `proposalFormSchema` is the public name; if any consumer ever needs the unrefined shape they can import `proposalFormShape`. The exported type stays the same because `superRefine` doesn't change the inferred type.)

- [ ] **Step 7.2: Verify**

```bash
pnpm lint
pnpm tsc
```

Both must pass.

Browser smoke:
1. Open a proposal in breakdown mode. Clear the Section Price for one SOW section. Try to save → form refuses with "Section price is required in breakdown pricing mode" inline on the field.
2. Set a positive section price. Try to save → succeeds.
3. Switch to total mode. Clear the section price (it's now disabled but null). Try to save → succeeds.
4. Add a cost line in a section. Then deselect that section's scopes (skip the confirmation; or in a fresh section without orphan-handling). The cost-line related-scope dropdown becomes empty. Try to save → form refuses with "Related scope must be one of this section's selected scopes". (This path is hard to hit organically because of Task 6's cascade — the validation is the safety net.)

- [ ] **Step 7.3: Commit**

```bash
git add src/shared/entities/proposals/schemas/index.ts
git commit -m "$(cat <<'EOF'
feat(proposals): conditional validation on financials

Adds superRefine to proposalFormSchema:
- sectionPrice required + positive in breakdown mode
- cost-line relatedScopeId must reference a selected scope

Breakdown mode no longer allows missing prices to slip through; the
cost-line scope reference is now strictly checked at submit time.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8 — Ubiquitous-language updates

**Goal:** Add Price, Cost, Margin, Multiplier, Cost Line, View Mode terms to the canonical glossary.

**Files:**
- Modify: `docs/domain/ubiquitous-language.md`

- [ ] **Step 8.1: Add new terms to the Sales & Pricing section**

In `docs/domain/ubiquitous-language.md`, find the existing "Sales & Pricing" table (around lines 87-94). Add the following rows directly underneath the existing rows in that table:

```markdown
| **Price** | Customer-facing dollar amount. What the homeowner sees / pays. Per-section: `sow[].financials.sectionPrice`. Aggregate: `funding.startingTcp`. |
| **Cost** | Internal dollar amount. What the work costs Tri Pros. Itemized via `sow[].financials.costLines[]`. Never shown to the homeowner. |
| **Cost Line** | One internal line of cost. Has `label`, `amount`, `relatedScopeId`, optional `notes`. |
| **Margin** | `Price − Cost`. Computed via `computeSectionMargin` / `computeProposalCostTotals`. Never persisted. Agent-only display. |
| **Multiplier** | `Price ÷ Cost`, displayed to 2 decimals (`2.04x`). Headline agent KPI. `—` when cost is 0. |
```

Then find the "UI Concepts" section (around line 142). Add a new row to that table:

```markdown
| **View Mode** | `'customer' \| 'agent'`. URL-persisted via `?view=agent`. Determines whether internal data renders on the proposal-flow display route. Sourced from `useViewMode()` which gates with `ability.can('update', 'Proposal')` — homeowners constructing the param manually still get `'customer'`. |
```

Then find the "Terminology Rules" section (around line 215). Add the following bullets:

```markdown
- **Price** is customer-facing; **Cost** is internal. Never use "price" to mean what something costs Tri Pros.
- **Multiplier** is the canonical agent KPI. Format as `Nx` to 2 decimals (e.g., `2.04x`). Use `formatMultiplier` to render — never inline `.toFixed(2)`.
```

- [ ] **Step 8.2: Verify**

```bash
pnpm lint
```

(`tsc` skipped — markdown only.)

Open the file and visually scan that the new rows are well-formed and don't break the table layout.

- [ ] **Step 8.3: Commit**

```bash
git add docs/domain/ubiquitous-language.md
git commit -m "$(cat <<'EOF'
docs(language): formalize Price / Cost / Margin / Multiplier / View Mode

These terms are introduced by the SOW Financials redesign and the
agent/customer view toggle. Naming and rendering rules locked in.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final verification

After all eight tasks are committed, run a full pre-PR check:

- [ ] **Step F.1: Lint + typecheck**

```bash
pnpm lint
pnpm tsc
```

Both must pass.

- [ ] **Step F.2: Acceptance criteria walkthrough**

Step through every acceptance criterion in the spec (`docs/superpowers/specs/2026-05-05-proposal-agent-customer-view-toggle-design.md`, the "Acceptance Criteria" section) using a real proposal in `pnpm dev`. Tick each one off.

- [ ] **Step F.3: Legacy proposal regression test**

Pick a proposal created before this branch (i.e., with the legacy `sow[].price` shape persisted). Confirm:
1. It loads without console errors.
2. The Section Price input shows the legacy value.
3. Saving once persists the new `financials` shape (verifiable via DB inspection or by reloading and confirming everything still works).

- [ ] **Step F.4: Customer/homeowner regression test**

In an incognito window, open the proposal share link with the homeowner token. Confirm:
1. No toggle Badge appears.
2. Blue gradient.
3. No Internal Calculation block.
4. Manually appending `?view=agent` to the URL changes nothing — homeowner stays in customer view.

- [ ] **Step F.5: Say "DONE — ready for review"**

Per the worktree's `CLAUDE.local.md`: do **not** open a PR or push. The user will run `pnpm dispatch pr 159` to push and open the PR.
