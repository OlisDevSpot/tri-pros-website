# Proposal Form UX Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the proposal form less scroll-heavy by adding collapsible SOW sections, and fix mobile layout issues in the funding/incentives area.

**Architecture:** Two independent UI changes within `src/features/proposal-flow/ui/components/form/`. Task 1 creates a new `SOWCollapsibleHeader` component and wraps SOW sections in shadcn `Collapsible` inside `ProjectFields`. Task 2 restructures `FundingFields` from a side-by-side layout to a vertical flow with visually grouped incentive cards.

**Tech Stack:** React, react-hook-form, shadcn/ui (Collapsible), Tailwind CSS, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-03-31-proposal-form-ux-improvements-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/features/proposal-flow/ui/components/form/sow-collapsible-header.tsx` | **Create** | Collapsed summary header for a SOW section — title, trade badge, scope count badge, price, chevron, delete button |
| `src/features/proposal-flow/ui/components/form/project-fields.tsx` | **Modify** | Wrap each SOW section in shadcn `Collapsible`, manage open/closed state set |
| `src/features/proposal-flow/ui/components/form/funding-fields.tsx` | **Modify** | Restructure to vertical layout — funding fields on top, incentives below with per-card grouping |

---

## Task 1: Create SOWCollapsibleHeader Component

**Files:**
- Create: `src/features/proposal-flow/ui/components/form/sow-collapsible-header.tsx`

This component renders the trigger bar that shows when a SOW section is collapsed (and stays visible when expanded). It displays the section title, trade/scope badges, optional price, and a delete button.

- [ ] **Step 1: Create the SOWCollapsibleHeader component**

Create the file at `src/features/proposal-flow/ui/components/form/sow-collapsible-header.tsx`:

```tsx
import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { ChevronDownIcon, TrashIcon } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface Props {
  isOpen: boolean
  onDelete: (e: React.MouseEvent) => void
  pricingMode: 'total' | 'breakdown'
  sow: ProposalFormSchema['project']['data']['sow'][0]
}

export function SOWCollapsibleHeader({
  isOpen,
  onDelete,
  pricingMode,
  sow,
}: Props) {
  const hasTitle = sow.title.trim().length > 0
  const hasTrade = sow.trade.label.trim().length > 0
  const scopeCount = sow.scopes.length
  const showPrice = pricingMode === 'breakdown' && sow.price != null && sow.price > 0

  return (
    <div className="flex w-full cursor-pointer items-start justify-between gap-4 rounded-lg px-4 py-3 hover:bg-muted/50 transition-colors">
      <div className="flex flex-col gap-1.5 min-w-0">
        <span className={cn(
          'text-base font-medium truncate',
          !hasTitle && 'text-muted-foreground italic',
        )}>
          {hasTitle ? sow.title : 'Untitled Section'}
        </span>
        {(hasTrade || scopeCount > 0) && (
          <div className="flex items-center gap-2 flex-wrap">
            {hasTrade && (
              <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                {sow.trade.label}
              </Badge>
            )}
            {scopeCount > 0 && (
              <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">
                {scopeCount} {scopeCount === 1 ? 'scope' : 'scopes'}
              </Badge>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 pt-0.5">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onDelete}
        >
          <TrashIcon className="size-4" />
        </Button>
        {showPrice && (
          <span className="text-sm font-semibold tabular-nums text-muted-foreground">
            ${sow.price!.toLocaleString()}
          </span>
        )}
        <ChevronDownIcon
          className={cn(
            'size-5 text-muted-foreground transition-transform duration-200',
            !isOpen && '-rotate-90',
          )}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify lint passes**

Run: `pnpm lint`
Expected: No errors related to the new file.

- [ ] **Step 3: Commit**

```bash
git add src/features/proposal-flow/ui/components/form/sow-collapsible-header.tsx
git commit -m "feat(proposal): add SOWCollapsibleHeader component for collapsed SOW summary"
```

---

## Task 2: Add Collapsible Wrappers to ProjectFields

**Files:**
- Modify: `src/features/proposal-flow/ui/components/form/project-fields.tsx`

Wrap each SOW section in a shadcn `Collapsible`. Track which sections are open via a `Set<number>`. Default: only index 0 open. Newly appended sections auto-open.

- [ ] **Step 1: Update imports in project-fields.tsx**

Add imports for `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger`, `useWatch`, `useState`, and the new header component. The full updated import block:

```tsx
import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { ProjectType } from '@/shared/types/enums'
import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { Button } from '@/shared/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Textarea } from '@/shared/components/ui/textarea'
import { projectTypes, validThroughTimeframes } from '@/shared/constants/enums'
import { SOWCollapsibleHeader } from './sow-collapsible-header'
import { SOWSection } from './sow-field'
```

- [ ] **Step 2: Add open state and watch SOW fields**

Inside the `ProjectFields` function body, after the existing `useFieldArray` hook, add:

```tsx
const [openSections, setOpenSections] = useState<Set<number>>(() => new Set([0]))

const sowValues = useWatch({ control: form.control, name: 'project.data.sow' })

function toggleSection(index: number) {
  setOpenSections((prev) => {
    const next = new Set(prev)
    if (next.has(index)) {
      next.delete(index)
    }
    else {
      next.add(index)
    }
    return next
  })
}
```

- [ ] **Step 3: Replace the SOW fields.map rendering**

Replace the existing block (the `<div className="flex flex-col gap-8 flex-wrap w-full">` containing `fields.map` and the append button) with:

```tsx
<div className="flex flex-col gap-4 w-full">
  {fields.map((fieldOfArray, index) => {
    const isOpen = openSections.has(index)
    return (
      <Collapsible
        key={fieldOfArray.id}
        open={isOpen}
        onOpenChange={() => toggleSection(index)}
      >
        <div className="border border-border/30 rounded-xl overflow-hidden bg-[color-mix(in_oklch,var(--card)_97%,var(--foreground)_3%)]">
          <CollapsibleTrigger asChild>
            <div>
              <SOWCollapsibleHeader
                isOpen={isOpen}
                onDelete={(e) => {
                  e.stopPropagation()
                  remove(index)
                  setOpenSections((prev) => {
                    const next = new Set<number>()
                    for (const i of prev) {
                      if (i < index)
                        next.add(i)
                      else if (i > index)
                        next.add(i - 1)
                    }
                    return next
                  })
                }}
                pricingMode={pricingMode}
                sow={sowValues[index] ?? fieldOfArray}
              />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SOWSection
              index={index}
              onDelete={() => {
                remove(index)
                setOpenSections((prev) => {
                  const next = new Set<number>()
                  for (const i of prev) {
                    if (i < index)
                      next.add(i)
                    else if (i > index)
                      next.add(i - 1)
                  }
                  return next
                })
              }}
              pricingMode={pricingMode}
              sowSnapshot={fieldOfArray}
            />
          </CollapsibleContent>
        </div>
      </Collapsible>
    )
  })}
  <Button
    type="button"
    size="icon"
    variant="outline"
    onClick={() => {
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
      setOpenSections(prev => new Set(prev).add(fields.length))
    }}
  >
    <PlusIcon />
  </Button>
</div>
```

**Important:** The delete button now lives in `SOWCollapsibleHeader`, but we keep the `onDelete` prop on `SOWSection` because `SOWSection` also has its own internal delete button in the trade/scope header row. Both delete handlers do the same thing: `remove(index)` + reindex the open set. We need to remove the duplicate delete button from `SOWSection` in the next step.

- [ ] **Step 4: Remove the delete button from SOWSection**

In `src/features/proposal-flow/ui/components/form/sow-field.tsx`, the `SOWSection` component has a delete button at line 133-141 (the `<Button>` with `<TrashIcon />`). Remove it and the wrapping flex container. 

Replace the current top-row div (lines 53-142, from `<div key={sowSnapshot.title} className="flex flex-col...">` through the closing `</div>` of the trade/scope row):

The outer wrapper `<div key={sowSnapshot.title} className="flex flex-col gap-4 items-center border w-full max-h-187.5 overflow-auto">` should become:

```tsx
<div className="flex flex-col gap-4 items-center w-full max-h-187.5 overflow-auto">
```

Remove `border` class (the border is now on the Collapsible wrapper) and remove the `key` prop (it's on the `Collapsible`).

Then remove the delete `<Button>` at lines 133-141 entirely. The trade/scope flex row (lines 53-142) should end after the `MultiSelect` `FormField` closing tag, with no trailing delete button. The containing `<div className="flex items-end rounded-lg h-full w-full">` stays but only wraps the two form fields (trade Select + scopes MultiSelect).

- [ ] **Step 5: Remove the `onDelete` prop from SOWSection**

In `sow-field.tsx`, remove the `onDelete` prop from the `Props` interface and the function parameters:

```tsx
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
```

Then in `project-fields.tsx`, remove the `onDelete` prop from the `<SOWSection>` usage inside `CollapsibleContent`:

```tsx
<SOWSection
  index={index}
  pricingMode={pricingMode}
  sowSnapshot={fieldOfArray}
/>
```

- [ ] **Step 6: Verify lint passes**

Run: `pnpm lint`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/proposal-flow/ui/components/form/project-fields.tsx src/features/proposal-flow/ui/components/form/sow-field.tsx
git commit -m "feat(proposal): wrap SOW sections in collapsible accordion with summary headers"
```

---

## Task 3: Restructure FundingFields Layout

**Files:**
- Modify: `src/features/proposal-flow/ui/components/form/funding-fields.tsx`

Restructure from side-by-side `flex gap-12` to vertical flow: Funding heading + fields on top, incentives section below with per-card visual grouping.

- [ ] **Step 1: Rewrite the FundingFields JSX**

Replace the entire JSX return (lines 55-303) in `funding-fields.tsx` with:

```tsx
return (
  <section className="space-y-8">
    <div className="flex flex-col gap-6 border border-border/30 shadow p-6 rounded-xl bg-[color-mix(in_oklch,var(--card)_97%,var(--foreground)_3%)]">
      {/* Funding heading + fields */}
      <div className="space-y-4">
        <h3 className="text-2xl font-semibold">Funding</h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {pricingMode === 'breakdown' && (
            <FormField
              name="funding.data.miscPrice"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Misc Pricing</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="$0"
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
          )}
          <FormField
            name="funding.data.startingTcp"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total Contract Price</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    disabled={pricingMode === 'breakdown'}
                    placeholder="$50,000"
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
      </div>

      {/* Incentives section */}
      {showSettings && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-t border-border/30 pt-4">
            <h4 className="text-lg font-semibold">Incentives</h4>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                append({
                  type: 'discount',
                  amount: 0,
                  notes: '',
                })
              }}
            >
              <PlusIcon className="size-4" />
              Add
            </Button>
          </div>

          {fields.length === 0
            ? (
                <div className="rounded-xl border border-dashed border-border/50 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
                  No incentives added
                </div>
              )
            : (
                <div className="space-y-4 rounded-xl border border-dashed border-border/50 bg-muted/10 p-4">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="rounded-lg border border-border/40 bg-muted/30 p-4 space-y-4"
                    >
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <FormField
                          name={`funding.data.incentives.${index}.type`}
                          control={form.control}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Incentive Type</FormLabel>
                              <FormControl>
                                <Select
                                  defaultValue="discount"
                                  onValueChange={(val: IncentiveType) => {
                                    field.onChange(val)
                                  }}
                                >
                                  <SelectTrigger {...field} className="w-full">
                                    <SelectValue placeholder="Select an incentive type" />
                                  </SelectTrigger>
                                  <SelectContent {...field}>
                                    {incentiveTypes.filter(t => t === 'discount' || t === 'exclusive-offer').map(t => (
                                      <SelectItem key={t} value={t}>
                                        {t.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {incentives[index]?.type === 'discount' && (
                          <FormField
                            name={`funding.data.incentives.${index}.amount`}
                            control={form.control}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Amount</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="$1,000"
                                    onChange={(value) => {
                                      const numericValue = Number(value.target.value.replace(/\D/g, ''))
                                      field.onChange(numericValue)
                                      const { totalProjectDiscounts } = getProposalAggregates(form.getValues())
                                      form.setValue('funding.data.finalTcp', form.getValues('funding.data.startingTcp') - totalProjectDiscounts)
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                        {incentives[index]?.type === 'exclusive-offer' && (
                          <FormField
                            name={`funding.data.incentives.${index}.offer`}
                            control={form.control}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Offer</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <FormField
                          name={`funding.data.incentives.${index}.notes`}
                          control={form.control}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Notes</FormLabel>
                              <FormControl>
                                {incentives[index]?.type === 'discount'
                                  ? (
                                      <Input
                                        {...field}
                                        placeholder="Friends & Family Discount"
                                        onChange={(e) => {
                                          field.onChange(e.target.value || '')
                                        }}
                                      />
                                    )
                                  : (
                                      <Textarea
                                        {...field}
                                        placeholder="Complementary 10 ft gutters"
                                        onChange={(e) => {
                                          field.onChange(e.target.value || '')
                                        }}
                                      />
                                    )}
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          name={`funding.data.incentives.${index}.expiresAt`}
                          control={form.control}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Expiration</FormLabel>
                              <FormControl>
                                <DateTimePicker
                                  placeholder="Set expiration"
                                  value={field.value ? new Date(field.value) : undefined}
                                  onChange={(date) => {
                                    field.onChange(date ? date.toISOString() : undefined)
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="gap-1.5"
                          onClick={() => {
                            remove(index)
                          }}
                        >
                          <TrashIcon className="size-4" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
        </div>
      )}

      {/* Pricing breakdown helper */}
      {showPricingBreakdown && (
        <div className="w-full">
          <PricingBreakdown proposalData={formValuesToProposal(form.getValues())} />
        </div>
      )}
    </div>
  </section>
)
```

- [ ] **Step 2: Clean up unused imports**

After the rewrite, remove the unused `_finalTcp` watch (line 39 in the original) since it was unused. The `useEffect` and all watches for `startingTcp`, `incentives`, `sow`, `miscPrice` remain unchanged — they drive the auto-calculation logic.

The imports stay the same — all existing imports are still used (`DateTimePicker`, `Button`, `FormControl`, `FormField`, `FormItem`, `FormLabel`, `FormMessage`, `Input`, `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`, `Textarea`, `PlusIcon`, `TrashIcon`, `incentiveTypes`, `PricingBreakdown`, `formValuesToProposal`, `getProposalAggregates`).

Remove only:
```tsx
// Remove this line (was unused, prefixed with _)
const _finalTcp = useWatch({ control: form.control, name: 'funding.data.finalTcp' })
```

- [ ] **Step 3: Verify lint passes**

Run: `pnpm lint`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/proposal-flow/ui/components/form/funding-fields.tsx
git commit -m "feat(proposal): restructure funding layout with vertical flow and grouped incentive cards"
```

---

## Task 4: Verify Build and Final Review

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript check**

Run: `pnpm tsc`
Expected: No type errors.

- [ ] **Step 2: Run lint**

Run: `pnpm lint`
Expected: No lint errors.

- [ ] **Step 3: Review diff**

Run: `git diff --stat`

Verify:
- 3 files changed (1 new, 2 modified)
- No unintended changes, no debug logs, no leftover code
- `sow-collapsible-header.tsx` — new component (~60 lines)
- `project-fields.tsx` — collapsible wrappers + state management
- `sow-field.tsx` — delete button + onDelete prop removed, border class removed
- `funding-fields.tsx` — vertical layout restructure

- [ ] **Step 4: Manual visual check (optional)**

Start dev server: `pnpm dev -- --port 3002`

Test scenarios:
1. Create proposal — first SOW section open, add second → opens, collapse first → shows summary header
2. Edit proposal with 3+ SOW sections — only first open, others show title/trade/scope badges
3. Delete a collapsed section — works without error, open state reindexes correctly
4. Funding fields stack on mobile (< 1024px), grid on desktop
5. Add incentive — card appears with grouped fields, delete works
6. No horizontal overflow on mobile in incentives area
