# Proposal — Agent/Customer View Toggle + SOW Financials Redesign

**Issue:** [#159](https://github.com/OlisDevSpot/tri-pros-website/issues/159)
**Branch:** `feat/159-feat-proposal-agent-customer-view-toggle`
**Date:** 2026-05-05

---

## Why

Today the proposal display is shared between agents and homeowners with only two visibility differences (Profile button, Edit Proposal button) and a swap of the agreement section. Agents can never preview the customer experience without logging out, and the page leaks no internal data — but it also surfaces nothing internally useful at the same time.

This work does two things:

1. **Adds an Agent ↔ Customer view toggle** so an agent can flip on the same URL between "what I see" and "what the customer sees" — defaulting to **Customer** so an agent's screen never accidentally exposes internal numbers in front of a homeowner.
2. **Replaces the per-section `price: number` field with a richer `financials` object** (Section Price + Cost Lines), enabling agent-only **Margin** and **Multiplier** intelligence (gross profit per project, by section).

Both changes serve one goal: give agents the operational picture they need (profit per project, mid-meeting customer-perspective demos) without ever bleeding internal data into the customer experience.

---

## Vocabulary

These terms are introduced/formalized by this work and should be added to `docs/domain/ubiquitous-language.md` as part of the implementation:

| Term | Definition |
|---|---|
| **Price** | Customer-facing dollar amount. What the homeowner sees / pays. Lives on `sow[].financials.sectionPrice` (per section) and `funding.startingTcp` (aggregate). |
| **Cost** | Internal dollar amount. What the work costs Tri Pros. Itemized via `costLines[]` per SOW section. Never shown to the homeowner. |
| **Margin** | `Price − Cost`. Computed, not stored. Agent-only display. |
| **Multiplier** | `Price / Cost`, displayed to 2 decimals (e.g., `2.04x`). The headline KPI for agents — "what multiple of cost is the price". `—` when cost is 0. Agent-only display. |
| **View Mode** | `'customer' \| 'agent'`. URL-persisted via `?view=agent`. Determines whether internal data renders. Gated by `ability.can('update', 'Proposal')` — homeowners constructing the param manually still get `'customer'`. |
| **Cost Line** | One internal line of cost. Has `label`, `amount`, `relatedScopeId`, optional `notes`. Lives in `sow[].financials.costLines[]`. |

---

## Scope

### In scope

- Agent/Customer view toggle on the proposal display route (`/proposal-flow/proposal/[proposalId]`).
- Background gradient swap (blue → red) when in agent mode, as a peripheral-vision tell.
- SOW section data model: `sow[].price` removed; `sow[].financials = { sectionPrice, costLines[] }` added.
- SOW form UI: new "Scope of Work" and "Financials" collapsibles inside each section.
- `PricingBreakdown` component grows an agent-only "Internal Calculation" block under the customer-visible rows showing per-section costs + aggregate margin + multiplier.
- Read-time Zod `preprocess` migration so existing proposals load with `financials.sectionPrice` populated from legacy `price`.
- Conditional Zod validation: `sectionPrice` required in breakdown mode; `relatedScopeId` must reference a selected scope.

### Out of scope (deferred)

- Subcontractor assignment per cost line (schema can leave room; no UI).
- Bulk cost-line import / templating.
- Backfill scripts for historical proposals (read-time migration handles them).
- Margin/multiplier surfaces outside the proposal display + form (no pipeline / dashboard rollups).

---

## Architecture Decisions

### 1. View mode source: a single `useViewMode()` hook

```ts
// src/features/proposal-flow/hooks/use-view-mode.ts
export function useViewMode(): 'customer' | 'agent' {
  const [view] = useQueryState('view')
  const ability = useAbility()
  if (view === 'agent' && ability.can('update', 'Proposal')) return 'agent'
  return 'customer'
}
```

Every consumer (Heading toggle, Proposal orchestrator, Navbar back-link, layout shell, ContractStatusPanel) calls this hook. Permission gate is **inside the hook** — no caller can accidentally bypass it. A homeowner appending `?view=agent` deterministically gets `'customer'`.

### 2. Gradient swap: a thin client shell inside the layout

The current layout sets the gradient as an inline style on a server-rendered div. To react to URL state without FOUC, extract that outer div into a client component:

```tsx
// src/features/proposal-flow/ui/components/proposal-flow-shell.tsx ('use client')
export function ProposalFlowShell({ children }) {
  const viewMode = useViewMode()
  const accent = viewMode === 'agent' ? 'var(--destructive)' : 'var(--primary)'
  return (
    <div
      style={{
        '--sidebar-width': '76px',
        '--sidebar-height': '68px',
        background: `radial-gradient(150% 150% at 50% 0%, var(--background), var(--background), color-mix(in oklab, ${accent} 60%, transparent))`,
      }}
      className="h-full flex flex-col"
      data-no-gutter-stable
      data-view-mode={viewMode}
    >
      {children}
    </div>
  )
}
```

`layout.tsx` stays an RSC and renders `<ProposalFlowShell>` around its existing children. No FOUC because the URL is read on the same render that paints the gradient.

### 3. Derived values stay derived

`Margin` and `Multiplier` follow the established `computeFinalTcp` precedent — pure functions in `entities/proposals/lib/`, never persisted. New helpers:

```ts
// entities/proposals/lib/compute-sow-financials.ts
export function computeSectionCost(section: SOWSection): number
export function computeSectionMargin(section: SOWSection): number | null      // null when sectionPrice is null
export function computeSectionMultiplier(section: SOWSection): number | null  // null when cost is 0 or sectionPrice is null

// entities/proposals/lib/compute-proposal-cost-totals.ts
export interface ProposalCostTotals {
  totalCost: number              // Σ all cost lines across all sections
  totalMargin: number            // finalTcp − totalCost (uses computeFinalTcp)
  totalMultiplier: number | null // finalTcp / totalCost; null when totalCost is 0
  hasMissingCostData: boolean    // true if any section has 0 cost lines
}
export function computeProposalCostTotals(data: InsertProposalSchema): ProposalCostTotals
```

Aggregate margin/multiplier compute against **`finalTcp`** (post-discount), not `startingTcp` — discounts come out of agent profit, so the agent's KPI must reflect the actual money received.

### 4. Schema migration via Zod `preprocess`, no SQL needed

JSONB column. Read-time migration in `sowSchema`:

```ts
const sowShape = z.object({
  contentJSON: z.string(),
  html: z.string(),
  scopes: z.array(constructionItemSchema),
  title: z.string(),
  trade: constructionItemSchema,
  financials: sowFinancialsSchema,
})

export const sowSchema = z.preprocess((raw) => {
  if (raw && typeof raw === 'object' && !('financials' in raw)) {
    const legacy = raw as { price?: number }
    const { price, ...rest } = legacy
    return {
      ...rest,
      financials: { sectionPrice: price ?? null, costLines: [] },
    }
  }
  return raw
}, sowShape)
```

Existing proposals load with `costLines: []` and `sectionPrice` populated from legacy `price`. Saving persists the new shape; the legacy field never re-appears.

### 5. PR shape: one atomic PR, tracer-bullet stages

Single PR (matches issue intent). Internal staging in commits:
1. Schema + entity-lib helpers (no UI).
2. Form UI (Financials collapsible, cost lines, validation).
3. Display UI (toggle, gradient, PricingBreakdown agent mode).
4. Permission/gating polish + docs/ubiquitous-language addition.

---

## Data Model

### New: `costLineSchema`

```ts
// entities/proposals/schemas/index.ts
export const costLineSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1, 'Label is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  relatedScopeId: z.string().min(1, 'Related scope is required'),
  notes: z.string().optional(),
})
export type CostLine = z.infer<typeof costLineSchema>
```

### New: `sowFinancialsSchema`

```ts
export const sowFinancialsSchema = z.object({
  sectionPrice: z.number().nullable(),
  costLines: z.array(costLineSchema),
})
```

`sectionPrice` is nullable at the schema level; required-ness is enforced at the proposal root via `superRefine` (next section).

### Updated: `sowSchema`

Top-level `price?: number` is **removed**. Replaced by `financials`. Wrapped in `preprocess` for legacy migration (Architecture Decision §4).

### New: proposal-level conditional validation

```ts
proposalFormSchema.superRefine((proposal, ctx) => {
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

    // 2. Cost-line relatedScopeId must match a selected scope
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

Note: this attaches at the form schema (`proposalFormSchema`), where `meta`/`project`/`funding` paths are valid. The `entities` shape uses different path keys (`formMetaJSON`/`projectJSON`/`fundingJSON`), so if the same `superRefine` is needed on the persisted shape it gets a parallel path. In practice we only need it for form submission — DB writes go through the form path.

### Default values update

```ts
proposalFormBaseDefaultValues.project.data.sow[0] = {
  contentJSON: '',
  html: '',
  scopes: [],
  title: '',
  trade: { id: '', label: '' },
  financials: { sectionPrice: null, costLines: [] },
}
```

`project-fields.tsx`'s `append({ ... price: pricingMode === 'breakdown' ? 0 : undefined ... })` becomes `append({ ... financials: { sectionPrice: pricingMode === 'breakdown' ? 0 : null, costLines: [] } ... })`.

---

## UI Behavior Matrix

| Element | Customer view (default) | Agent view (`?view=agent`) |
|---|---|---|
| Background gradient | `var(--primary)` accent (blue) | `var(--destructive)` accent (red) |
| Toggle Badge | `Customer` (secondary variant) — visible if `ability.can('update', 'Proposal')`, hidden otherwise | `Agent` (destructive variant) |
| `View [Customer]'s Profile` button | Hidden | Visible (still gated by `ability.can('read', 'Customer')`) |
| `Edit Proposal` button | Hidden | Visible |
| Agreement section | `HomeownerContractView` | `AgentContractView` |
| `PricingBreakdown` rows | Customer-only rows | Customer rows + Internal Calculation block |
| Funding tab | Standard layout | Standard layout (Internal Calculation lives in `PricingBreakdown`) |
| Navbar back-link | `/` | `ROOTS.dashboard.root` |

The toggle is **gated by ability**, then the view-mode hook applies permission internally. A homeowner manually constructing `?view=agent` falls through to `'customer'` because the hook rejects.

---

## PricingBreakdown — agent mode

### Mental model

`PricingBreakdown` grows a `viewMode: 'customer' | 'agent'` prop (default `'customer'`). The component now renders **two stacked blocks**, vertically separated:

1. **Customer-Facing Breakdown** (top) — the existing component as it renders today. **Unchanged** in both customer and agent view. This is what the homeowner sees and what the page would look like with no toggle.
2. **Internal Calculation** (below, agent-only) — a brand-new agent-only block, rendered only when `viewMode === 'agent'`. Shows per-section costs and the aggregate margin + multiplier KPIs that drive agent decision-making.

The two blocks are visually distinct: a divider, an `Internal Calculation` header label with a small lock/eye icon and a muted "Visible only to you" sub-label. The internal block is never an extension of the customer rows — it's a separate calculation surface stacked underneath, with its own column structure.

In **customer view**, only block 1 renders. In **agent view**, both blocks render. The agent block's per-section row layout depends on pricing mode (next two sections), but the **aggregate footer is identical regardless of pricing mode** — it always uses `finalTcp` and total cost.

The shared aggregate footer:

```
Total Cost                  Σ all costLine.amount across all sections
Total Margin                finalTcp − Total Cost
Multiplier                  finalTcp ÷ Total Cost      (2 decimals; "—" when Total Cost = 0)
```

`finalTcp` is `computeFinalTcp(funding)` — `startingTcp − Σdiscounts`. Multiplier and margin always reflect the actual money received after discounts. Discount cost-out comes from the agent's profit, not the homeowner's.

---

### Walkthrough — one proposal in both pricing modes

Same proposal, two pricing modes, to make the dual rendering concrete.

**Proposal data:**
- Section A: "Roof Replacement", price $20,000, cost lines: Labor $6,000 + Materials $4,000 = $10,000 cost
- Section B: "Solar", price $42,000, **no cost lines yet**
- Funding: `miscPrice` $1,000, one discount incentive ($5,000 friends-and-family)

**Derived numbers:**
- Σ SOW prices: $62,000
- Subtotal (in breakdown mode, `startingTcp` synced to Σ + miscPrice): $63,000
- In total mode, `startingTcp` is whatever the agent typed manually — for this example, also $63,000
- `finalTcp = $63,000 − $5,000 = $58,000`
- Total Cost = $10,000 (only Section A has cost lines)
- Total Margin = $58,000 − $10,000 = $48,000
- Multiplier = $58,000 ÷ $10,000 = 5.80x

---

### Breakdown pricing mode

**Customer-Facing Breakdown** (block 1 — agent and customer see this):

```
┌──────────────────────────────────────────┐
│  Roof Replacement              $20,000   │
│  Solar                         $42,000   │
│  Misc                           $1,000   │
│ ──────────────────────────────────────── │
│  Subtotal                      $63,000   │
│ ──────────────────────────────────────── │
│  Friends & Family             −$5,000    │
│ ──────────────────────────────────────── │
│  Final Contract Price          $58,000   │
└──────────────────────────────────────────┘
```

**Internal Calculation** (block 2 — agent only, appended below):

```
┌──────────────────────────────────────────────────────────────────────┐
│  🔒 Internal Calculation                       Visible only to you   │
│ ──────────────────────────────────────────────────────────────────── │
│                       Price      Cost       Margin     Multiplier    │
│  Roof Replacement     $20,000    $10,000    $10,000    2.00x         │
│  Solar                $42,000    $—         $—         —             │
│ ──────────────────────────────────────────────────────────────────── │
│  Total Cost                      $10,000                             │
│  Total Margin                    $48,000   (Final Price − Total Cost)│
│  Multiplier                      5.80x     (Final Price ÷ Total Cost)│
│ ──────────────────────────────────────────────────────────────────── │
│  ⚠ 1 section is missing cost data — multiplier reflects partial cost.│
└──────────────────────────────────────────────────────────────────────┘
```

Per-section rows in breakdown mode have **4 data columns** (Price, Cost, Margin, Multiplier) because we know each section's price. `Misc` is **not** a SOW section and does not appear in this block — it's a funding-level number, already counted in the aggregate `finalTcp`.

`Solar` shows `$—` and `—` for cost-derived columns because no cost lines have been added yet. Its presence in the table makes the missing data visible to the agent.

---

### Total pricing mode

**Customer-Facing Breakdown** (block 1):

```
┌──────────────────────────────────────────┐
│  Contract Price                $63,000   │
│ ──────────────────────────────────────── │
│  Friends & Family             −$5,000    │
│ ──────────────────────────────────────── │
│  Final Contract Price          $58,000   │
└──────────────────────────────────────────┘
```

**Internal Calculation** (block 2 — agent only):

```
┌──────────────────────────────────────────────────────────────────────┐
│  🔒 Internal Calculation                       Visible only to you   │
│ ──────────────────────────────────────────────────────────────────── │
│                       Cost                                           │
│  Roof Replacement     $10,000                                        │
│  Solar                $—                                             │
│ ──────────────────────────────────────────────────────────────────── │
│  Total Cost                      $10,000                             │
│  Total Margin                    $48,000   (Final Price − Total Cost)│
│  Multiplier                      5.80x     (Final Price ÷ Total Cost)│
│ ──────────────────────────────────────────────────────────────────── │
│  ⚠ 1 section is missing cost data — multiplier reflects partial cost.│
└──────────────────────────────────────────────────────────────────────┘
```

Per-section rows in total mode have **only 1 data column** (Cost). Per-section margin/multiplier are not computable because there's no per-section price. The aggregate footer is identical to breakdown mode — it never depended on per-section price; it always uses `finalTcp` and `totalCost`.

---

### Customer mode (both pricing modes)

Block 1 only. Block 2 is not rendered. **Zero behavior change** vs. today's component.

---

### Implementation notes for the component

- Single `PricingBreakdown` component takes `viewMode` and `proposalData`. Internally it renders block 1 always, then conditionally renders an `<InternalCalculationBlock>` sub-component when `viewMode === 'agent'`.
- `InternalCalculationBlock` reads `proposalData.formMetaJSON.pricingMode` to decide its per-section column layout (4-column vs 1-column).
- Per-section rows are derived from `proposalData.projectJSON.data.sow` — same array the customer block iterates. Sections appear in both blocks in the same order. Section labels match exactly.
- All number formatting goes through existing `formatAsDollars`. New helper `formatMultiplier(n: number | null): string` returns `'4.60x'` or `'—'`.
- The "Visible only to you" sub-label uses `text-muted-foreground text-xs`. The header uses a small lock icon (lucide `LockIcon` or `EyeIcon`) to reinforce that this block is internal.

---

## SOW Section Form Redesign

### New collapsible structure

```
[Outer SOW Section — collapsible, existing pattern]
  ├─ Trade & Scopes pickers (existing)
  ├─ ▼ Scope of Work (NEW collapsible — default open)
  │     [TipTap editor with Templates button — existing content moved here]
  └─ ▼ Financials (NEW collapsible — default open)
        ├─ Section Price (single number input)
        │     - Required when pricingMode = 'breakdown'
        │     - Disabled and shows "—" when pricingMode = 'total'
        ├─ Cost Lines (useFieldArray)
        │     - "+ Add cost line" button: disabled when section has no scopes selected
        │     - Hint when disabled: "Pick scopes for this section first"
        │     For each line:
        │       • Label (required, text)
        │       • Amount (required, number > 0)
        │       • Related Scope (required, select — options = this section's selected scopes)
        │       • Notes (optional, textarea, hidden under "Add notes" toggle)
        │       • Remove button
        └─ Derived display (read-only, recomputes live)
              • Total Cost: Σ cost-line amounts
              • Margin: Section Price − Total Cost (— in total mode)
              • Multiplier: Section Price / Total Cost, 2 decimals (— in total mode or when cost is 0)
```

Both new collapsibles default open — otherwise agents skip filling cost data.

### Removed from current UI

- The sticky "Section Price" input at `sow-field.tsx:132-154` is removed. Its replacement lives inside the new Financials sub-section.
- The price chip on `sow-collapsible-header.tsx` stays but reads from `sow.financials.sectionPrice`.

### New file: `sow-financials-fields.tsx`

Lives next to `sow-field.tsx`. Owns the section-price input, the `useFieldArray`-driven cost-line editor, and the derived display. Mirrors the `useFieldArray` pattern from `funding-fields.tsx:30`.

---

## Scope Removal Cascade

When an agent removes a scope from a section's MultiSelect, and that scope has cost lines pointing to it:

1. Compute removed scope IDs from old vs new MultiSelect values.
2. Filter the section's `costLines` for any line whose `relatedScopeId` matches a removed scope. If none, just apply the change.
3. If matches exist, fire `useConfirm`:
   > *"Removing 'Roof Replacement' will also remove 2 cost line(s) tied to it. Continue?"*
4. On confirm: apply scope change AND remove orphan cost lines via `setValue('project.data.sow.${index}.financials.costLines', filtered)`.
5. On cancel: revert the MultiSelect (do not change scope selection).

Implementation: wrap `MultiSelect.onValuesChange` in an async handler that diffs and confirms before calling `field.onChange`.

---

## Files Touched

| File | Change |
|---|---|
| `src/shared/entities/proposals/schemas/index.ts` | Add `costLineSchema`, `sowFinancialsSchema`. Update `sowSchema` (remove `price`, add `financials` + `preprocess`). Add `superRefine` on `proposalFormSchema`. Update `proposalFormBaseDefaultValues`. |
| `src/shared/entities/proposals/lib/compute-sow-financials.ts` | NEW — `computeSectionCost`, `computeSectionMargin`, `computeSectionMultiplier`. |
| `src/shared/entities/proposals/lib/compute-proposal-cost-totals.ts` | NEW — `computeProposalCostTotals`. |
| `src/features/proposal-flow/hooks/use-view-mode.ts` | NEW — single source of truth for view mode. |
| `src/features/proposal-flow/ui/components/proposal-flow-shell.tsx` | NEW — client shell that owns gradient + view-mode `data-` attribute. |
| `src/app/(frontend)/proposal-flow/layout.tsx` | Wrap children in `<ProposalFlowShell>`. |
| `src/features/proposal-flow/ui/components/navbar/navbar.tsx` | Replace `ability.can('access', 'Dashboard')` back-link gate with `useViewMode() === 'agent'`. |
| `src/features/proposal-flow/ui/components/proposal/index.tsx` | Read `useViewMode()`. Compute `isAgent = viewMode === 'agent'`. Thread `viewMode` to PricingBreakdown via Funding step. |
| `src/features/proposal-flow/ui/components/proposal/heading.tsx` | Add toggle Badge (clickable, destructive in agent mode, secondary in customer mode). Visibility now `viewMode === 'agent' && ability.can(...)` for Edit + Profile buttons. |
| `src/features/proposal-flow/ui/components/proposal/funding.tsx` | Pass `viewMode` to `PricingBreakdown`. |
| `src/features/proposal-flow/ui/components/pricing-breakdown.tsx` | Add `viewMode` prop. Render Internal Calculation block when `viewMode === 'agent'`. Read `sectionPrice` from `sow[].financials.sectionPrice`. |
| `src/features/proposal-flow/ui/components/form/sow-field.tsx` | Remove sticky section-price block (lines 132-154). Wrap TipTap content in new "Scope of Work" Collapsible. Add new "Financials" Collapsible below it (rendered via `<SOWFinancialsFields>`). Wrap MultiSelect.onValuesChange with scope-removal cascade. |
| `src/features/proposal-flow/ui/components/form/sow-financials-fields.tsx` | NEW — section price + cost-line `useFieldArray` + live derived display. |
| `src/features/proposal-flow/ui/components/form/sow-collapsible-header.tsx` | Read price from `sow.financials.sectionPrice`. |
| `src/features/proposal-flow/ui/components/form/project-fields.tsx` | Update `append({...})` to use new `financials` shape. |
| `src/features/proposal-flow/ui/components/form/funding-fields.tsx` | `<PricingBreakdown viewMode="agent" />` since the form is agent-only. |
| `src/features/proposal-flow/lib/get-proposal-aggregates.ts` | Read `s.financials.sectionPrice` instead of `s.price`. |
| `src/shared/components/contract-status-panel/ui/contract-status-panel.tsx` | `isAgent` prop now sourced from `useViewMode()` upstream — no internal change needed. |
| `docs/domain/ubiquitous-language.md` | Add Price, Cost, Margin, Multiplier, Cost Line, View Mode terms (Sales & Pricing section). |

---

## Acceptance Criteria

- [ ] Agent on a proposal page sees a `Customer` badge top-right by default. Page renders identically to the homeowner experience: blue gradient, no Edit/Profile buttons, `HomeownerContractView`, no Internal Calculation block.
- [ ] Clicking the badge flips to `Agent` mode. URL becomes `?view=agent`. Background gradient swaps to red. Edit + Profile buttons appear. Agreement swaps to `AgentContractView`. PricingBreakdown reveals Internal Calculation block.
- [ ] Reloading on `?view=agent` keeps agent mode. Removing the param returns to customer view.
- [ ] Homeowner accessing via token never sees the toggle, never sees red gradient, never sees Internal Calculation — even if they construct `?view=agent` themselves (the `useViewMode` hook gates with `ability.can('update', 'Proposal')`).
- [ ] Proposal form: each SOW section has two new collapsibles ("Scope of Work" wrapping the TipTap, "Financials" below). Both default open. Financials contains the section price input and a `useFieldArray`-driven cost-line editor with label, amount, related-scope dropdown, optional notes.
- [ ] "+ Add cost line" button is disabled when the section has no scopes selected; hint message visible.
- [ ] Saving a breakdown-mode proposal with any SOW section missing `sectionPrice` (or set to 0) fails Zod validation with a clear field-level error.
- [ ] Saving a total-mode proposal with `sectionPrice = null` succeeds.
- [ ] Saving a proposal with a cost line whose `relatedScopeId` doesn't match any selected scope fails Zod validation.
- [ ] Removing a scope from a SOW section that has cost lines pointing to it shows a confirm dialog. On confirm, those cost lines are removed; on cancel, the scope change is reverted.
- [ ] Existing proposals (with legacy `sow[].price`) load without error and display correctly. On save, they migrate to the new `financials` shape.
- [ ] In customer view (default), `PricingBreakdown` renders only the Customer-Facing Breakdown block — identical to today.
- [ ] In agent view, `PricingBreakdown` renders the Customer-Facing Breakdown block **followed by** a visually distinct Internal Calculation block. The customer block is unchanged; the internal block is appended below it with its own header ("Internal Calculation") and "Visible only to you" sub-label.
- [ ] Internal Calculation block in **breakdown** mode: per-section rows have 4 columns (Price, Cost, Margin, Multiplier). Misc is **not** listed as a per-section row. Aggregate footer shows Total Cost, Total Margin (`finalTcp − Total Cost`), Multiplier (`finalTcp ÷ Total Cost`).
- [ ] Internal Calculation block in **total** mode: per-section rows have 1 column (Cost only). Aggregate footer is identical in shape and math to breakdown mode.
- [ ] Multiplier renders to 2 decimals with `x` suffix (e.g., `2.04x`); falls back to `—` when Total Cost is 0 or when computing per-section multiplier with no cost data.
- [ ] Sections with no cost lines render `—` in cost-derived columns and surface a "missing cost data" warning under the Internal Calculation block.

---

## Verification

End-to-end:

1. `pnpm dev` — open an existing proposal in the dashboard.
2. Confirm default state: badge says `Customer`, gradient is blue, no Edit button, no Internal Calculation block in PricingBreakdown.
3. Click badge → URL becomes `?view=agent`, gradient red, Edit button appears, PricingBreakdown shows Internal Calculation.
4. Reload — agent mode persists.
5. Navigate to proposal edit form. Open a SOW section. Confirm two new collapsibles. Add a cost line, set label/amount/related scope. Confirm derived total cost + margin + multiplier updates live.
6. Try to save a breakdown-mode proposal with a blank section price → confirm Zod error surfaces inline.
7. Switch proposal to total mode → section price requirement disappears.
8. Add cost lines in total mode → save → confirm Internal Calculation in display view shows per-section cost rows + aggregate margin/multiplier against `finalTcp`.
9. Open an OLD proposal (created before this feature). Confirm it loads without error and `Section Price` is populated from the legacy `price` field.
10. Remove a scope that has cost lines → confirm dialog appears; cancel reverts; confirm removes orphan lines.
11. In a fresh browser session (incognito), open the proposal share link with the homeowner token → confirm no toggle, blue gradient, no Internal Calculation, even with manually appended `?view=agent`.

Lint + typecheck:

```
pnpm lint
pnpm tsc
```

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Legacy proposals fail to load after schema change | Read-time `preprocess` migration is unconditional and idempotent; new `costLines: []` is always populated. |
| Form submission breaks for in-flight proposals (drafts that hit `sow[].price` shape) | The form schema's `preprocess` runs on `defaultValues` initialization too — `proposalToFormValues(proposal)` -> validation pass through `proposalFormSchema` will normalize. |
| Background gradient FOUC on URL change | `ProposalFlowShell` is a client component reading `useQueryState` — same render cycle as page paint. |
| Homeowner crafts `?view=agent` and sees internal data | Permission check is **inside** `useViewMode`, not in callers. Cannot be bypassed by URL alone. |
| Cost-line related-scope dropdown becomes stale when scopes change mid-edit | MultiSelect onChange wrapper diffs scope IDs; orphan cost lines either get confirmed-removed or the scope change is reverted. |
| Multiplier shows `Infinity` or `NaN` when cost is 0 | All multiplier helpers return `null` when cost ≤ 0; UI renders `—` for null. |
