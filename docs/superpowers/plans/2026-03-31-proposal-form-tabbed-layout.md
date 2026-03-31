# Proposal Form Tabbed Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-card proposal form with a 3-tab layout (General / Scope of Work / Funding) with directional slide animations and nuqs-persisted tab state.

**Architecture:** Extract General fields into a new component, slim down ProjectFields to SOW-only + Agreement Notes, add settings popover + useConfirm + expiry badge to FundingFields, rewrite form/index.tsx as a tab container with AnimatePresence directional slides. Also add agreement notes rendering to the proposal preview.

**Tech Stack:** React, react-hook-form, nuqs, motion/react (AnimatePresence with `custom` + `mode="wait"`), shadcn/ui (Tabs, Card), lucide-react.

**Spec:** `docs/superpowers/specs/2026-03-31-proposal-form-tabbed-layout-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `form/general-fields.tsx` | **Create** | Project name, pricing mode toggle, project type, time allocated, valid through |
| `form/project-fields.tsx` | **Modify** | Remove 3 fields (type/time/timeframe), keep SOW accordions + Agreement Notes only |
| `form/funding-fields.tsx` | **Modify** | Add useConfirm for incentive delete, absorb settings popover, remove showSettings prop |
| `form/incentive-collapsible-header.tsx` | **Modify** | Add expiry date badge |
| `form/index.tsx` | **Rewrite** | Tab container with nuqs state, AnimatePresence directional slides, submit/error |
| `proposal/scope-of-work.tsx` | **Modify** | Render agreement notes below accordion |

---

## Task 1: Create GeneralFields component

**Files:**
- Create: `src/features/proposal-flow/ui/components/form/general-fields.tsx`

- [ ] **Step 1: Create the component**

```tsx
import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { ProjectType } from '@/shared/types/enums'
import { useFormContext, useWatch } from 'react-hook-form'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Switch } from '@/shared/components/ui/switch'
import { projectTypes, validThroughTimeframes } from '@/shared/constants/enums'

export function GeneralFields() {
  const form = useFormContext<ProposalFormSchema>()
  const pricingMode = useWatch({ control: form.control, name: 'meta.pricingMode' })

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <FormField
        name="project.data.label"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Project Name</FormLabel>
            <FormControl>
              <Input placeholder="John Doe" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="flex items-center gap-3">
        <Switch
          checked={pricingMode === 'breakdown'}
          onCheckedChange={checked =>
            form.setValue('meta.pricingMode', checked ? 'breakdown' : 'total')}
        />
        <span className="text-sm font-medium">
          {pricingMode === 'breakdown' ? 'Breakdown Pricing' : 'Total Pricing'}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-4">
        <FormField
          name="project.data.type"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Type</FormLabel>
              <FormControl>
                <Select
                  defaultValue="general-remodeling"
                  onValueChange={(val: ProjectType) => {
                    field.onChange(val)
                  }}
                >
                  <SelectTrigger {...field} className="w-full">
                    <SelectValue placeholder="Select a project type" />
                  </SelectTrigger>
                  <SelectContent {...field}>
                    {projectTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {type.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
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
          name="project.data.timeAllocated"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Time Allocated</FormLabel>
              <FormControl>
                <Input placeholder="4-6 weeks" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name="project.data.validThroughTimeframe"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Valid Through Timeframe</FormLabel>
              <FormControl>
                <Select
                  defaultValue="60 days"
                  onValueChange={(val: ProjectType) => {
                    field.onChange(val)
                  }}
                >
                  <SelectTrigger {...field} className="w-full">
                    <SelectValue placeholder="Select a timeframe" />
                  </SelectTrigger>
                  <SelectContent {...field}>
                    {validThroughTimeframes.map(tf => (
                      <SelectItem key={tf} value={tf}>{tf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Lint check**

Run: `pnpm lint`
Expected: No errors on the new file.

- [ ] **Step 3: Commit**

```bash
git add src/features/proposal-flow/ui/components/form/general-fields.tsx
git commit -m "feat(proposal): create GeneralFields component for tabbed form layout"
```

---

## Task 2: Slim down ProjectFields to SOW + Agreement Notes only

**Files:**
- Modify: `src/features/proposal-flow/ui/components/form/project-fields.tsx`

- [ ] **Step 1: Remove the 3 general fields and their grid wrapper**

Remove the entire `<div className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-4">` block (lines 76–120 in current file) containing Project Type, Time Allocated, and Valid Through Timeframe form fields. These now live in `GeneralFields`.

Also remove unused imports: `ProjectType` type, `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue`, `Input`, `projectTypes`, `validThroughTimeframes`.

The component should now only contain:
1. The `useFieldArray`, `useState`, `useWatch`, `useConfirm`, and `toggleSection`/`handleDeleteSection` logic
2. The "Complete Scope of Work" heading + SOW collapsible accordions + add button
3. The Agreement Notes `FormField` with textarea

- [ ] **Step 2: Lint check**

Run: `pnpm lint`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/proposal-flow/ui/components/form/project-fields.tsx
git commit -m "refactor(proposal): slim ProjectFields to SOW accordions + Agreement Notes only"
```

---

## Task 3: Update FundingFields — useConfirm, settings popover, remove showSettings

**Files:**
- Modify: `src/features/proposal-flow/ui/components/form/funding-fields.tsx`

- [ ] **Step 1: Add useConfirm for incentive deletion**

Import `useConfirm` from `@/shared/hooks/use-confirm`. Add to component body:

```tsx
const [DeleteConfirmDialog, confirmDelete] = useConfirm({
  title: 'Delete Incentive',
  message: 'Are you sure you want to delete this incentive? This action cannot be undone.',
})
```

Replace `handleRemoveIncentive`:

```tsx
async function handleRemoveIncentive(index: number) {
  const confirmed = await confirmDelete()
  if (!confirmed)
    return

  remove(index)
  setOpenIncentives((prev) => {
    const next = new Set<number>()
    for (const i of prev) {
      if (i < index)
        next.add(i)
      else if (i > index)
        next.add(i - 1)
    }
    return next
  })
}
```

Render `<DeleteConfirmDialog />` at the top of the returned JSX (wrap in fragment).

- [ ] **Step 2: Absorb settings popover from form/index.tsx**

Add imports for `SettingsIcon` from lucide-react, `Popover`/`PopoverContent`/`PopoverTrigger` from shadcn, `Label` from shadcn, `Switch` from shadcn.

Change the `Props` interface: remove `showSettings` prop, add `showPricingBreakdown` as required boolean (no longer optional).

Add `useWatch` for `showPricingBreakdown`:

```tsx
const showPricingBreakdown = useWatch({ control: form.control, name: 'funding.meta.showPricingBreakdown' })
```

Remove the `showPricingBreakdown` prop — read it from form context instead.

Render the settings popover next to the "Base Pricing" heading:

```tsx
<div className="flex items-center gap-2">
  <h3 className="text-lg font-semibold lg:text-2xl">Base Pricing</h3>
  <Popover>
    <PopoverTrigger asChild>
      <Button type="button" size="icon" variant="outline">
        <SettingsIcon className="size-4" />
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-64" align="start">
      <div className="space-y-3">
        <p className="text-sm font-medium">Funding Settings</p>
        <div className="flex items-center justify-between">
          <Label htmlFor="show-pricing-breakdown" className="text-sm font-normal">
            Show Pricing Breakdown
          </Label>
          <Switch
            id="show-pricing-breakdown"
            checked={showPricingBreakdown}
            onCheckedChange={checked =>
              form.setValue('funding.meta.showPricingBreakdown', checked)}
          />
        </div>
      </div>
    </PopoverContent>
  </Popover>
</div>
```

The Incentives section should always render (remove the `showSettings &&` conditional — it's always shown in the Funding tab now).

- [ ] **Step 3: Update Props interface**

New interface:

```tsx
interface Props {
  pricingMode: 'total' | 'breakdown'
}
```

Remove `showPricingBreakdown` and `showSettings` props — both are now read from form context internally.

- [ ] **Step 4: Lint check**

Run: `pnpm lint`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/proposal-flow/ui/components/form/funding-fields.tsx
git commit -m "feat(proposal): add useConfirm to incentive delete, absorb settings popover into FundingFields"
```

---

## Task 4: Add expiry badge to IncentiveCollapsibleHeader

**Files:**
- Modify: `src/features/proposal-flow/ui/components/form/incentive-collapsible-header.tsx`

- [ ] **Step 1: Add expiry badge**

Import `format` from `date-fns` (already a project dependency). Add after the existing badge logic:

```tsx
const hasExpiry = incentive.expiresAt != null
```

In the header's first row `<div className="flex min-w-0 items-center gap-2">`, after the offer badge, add:

```tsx
{hasExpiry && (
  <Badge variant="secondary" className="bg-amber-500/10 text-xs text-amber-700 dark:text-amber-400">
    Expires {format(new Date(incentive.expiresAt!), 'MMM d')}
  </Badge>
)}
```

- [ ] **Step 2: Lint check**

Run: `pnpm lint`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/proposal-flow/ui/components/form/incentive-collapsible-header.tsx
git commit -m "feat(proposal): add expiry date badge to incentive collapsible header"
```

---

## Task 5: Rewrite form/index.tsx as tab container

**Files:**
- Rewrite: `src/features/proposal-flow/ui/components/form/index.tsx`

This is the core change. Replace the single-card layout with a tab bar + AnimatePresence directional slides.

- [ ] **Step 1: Rewrite the full file**

```tsx
'use client'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { OverrideProposalValues } from '@/features/proposal-flow/types'
import { AnimatePresence, motion } from 'motion/react'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { useEffect, useRef } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { baseDefaultValues } from '@/features/proposal-flow/schemas/form-schema'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { FundingFields } from './funding-fields'
import { GeneralFields } from './general-fields'
import { ProjectFields } from './project-fields'

const FORM_TABS = ['general', 'sow', 'funding'] as const
type FormTab = (typeof FORM_TABS)[number]

const TAB_LABELS: Record<FormTab, string> = {
  general: 'General',
  sow: 'Scope of Work',
  funding: 'Funding',
}

const TRANSITION = { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] } as const

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 100 : -100,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -100 : 100,
    opacity: 0,
  }),
}

interface Props {
  onSubmit: (data: ProposalFormSchema) => void
  isLoading: boolean
  initialValues?: OverrideProposalValues
  hideSubmitButton?: boolean
}

function deepMergeDefaults(base: ProposalFormSchema, override: Props['initialValues'] = {}): ProposalFormSchema {
  if (Object.keys(override).length === 0) {
    return base
  }

  return {
    ...base,
    meta: { ...base.meta, ...(override.meta ?? {}) },
    project: { ...base.project, ...(override.project ?? {}) },
    funding: { ...base.funding, ...(override.funding ?? {}) },
  }
}

export function ProposalForm({ isLoading, onSubmit, initialValues, hideSubmitButton }: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const [proposalId] = useQueryState('proposalId')
  const [activeTab, setActiveTab] = useQueryState(
    'formTab',
    parseAsStringLiteral(FORM_TABS).withDefault('general'),
  )
  const pricingMode = useWatch({ control: form.control, name: 'meta.pricingMode' })

  const prevTabRef = useRef(FORM_TABS.indexOf(activeTab))
  const currentIndex = FORM_TABS.indexOf(activeTab)
  const direction = currentIndex - prevTabRef.current

  useEffect(() => {
    prevTabRef.current = currentIndex
  }, [currentIndex])

  useEffect(() => {
    if (initialValues) {
      form.reset(deepMergeDefaults(baseDefaultValues, initialValues))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues])

  const onInvalid = (errors: any) => {
    // eslint-disable-next-line no-console
    console.log(form.getValues())
    // eslint-disable-next-line no-console
    console.log('INVALID SUBMIT', errors)
    toast.error('Form is invalid (check console)')
  }

  return (
    <form
      id="proposal-form"
      onSubmit={form.handleSubmit(onSubmit, onInvalid)}
      className="flex w-full flex-col gap-6"
    >
      <Tabs
        value={activeTab}
        onValueChange={val => setActiveTab(val as FormTab)}
        className="w-full"
      >
        <div className="flex justify-center">
          <TabsList>
            {FORM_TABS.map(tab => (
              <TabsTrigger key={tab} value={tab}>
                {TAB_LABELS[tab]}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      <Card className="w-full overflow-hidden">
        <CardContent className="p-3 lg:p-6">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={activeTab}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={TRANSITION}
            >
              {activeTab === 'general' && <GeneralFields />}
              {activeTab === 'sow' && <ProjectFields pricingMode={pricingMode} />}
              {activeTab === 'funding' && <FundingFields pricingMode={pricingMode} />}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>

      {form.formState.errors.root && (
        <div className="text-red-500">
          {JSON.stringify(form.formState.errors, null, 2)}
        </div>
      )}
      {!hideSubmitButton && (
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={isLoading}>
            {proposalId ? 'Update & Preview' : 'Save & Preview'}
          </Button>
        </div>
      )}
    </form>
  )
}
```

- [ ] **Step 2: Lint and TypeScript check**

Run: `pnpm tsc && pnpm lint`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/proposal-flow/ui/components/form/index.tsx
git commit -m "feat(proposal): rewrite form as tabbed layout with directional slide animations"
```

---

## Task 6: Add agreement notes to proposal preview

**Files:**
- Modify: `src/features/proposal-flow/ui/components/proposal/scope-of-work.tsx`

- [ ] **Step 1: Render agreement notes below the accordion**

After the closing `</Accordion>` tag and before the closing `</CardContent>`, add:

```tsx
{proposal.data.projectJSON.data.agreementNotes && (
  <div className="mt-6 border-t border-border/30 pt-6">
    <h3 className="text-sm font-semibold text-muted-foreground mb-2">Agreement Notes</h3>
    <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">
      {proposal.data.projectJSON.data.agreementNotes}
    </p>
  </div>
)}
```

- [ ] **Step 2: Lint check**

Run: `pnpm lint`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/proposal-flow/ui/components/proposal/scope-of-work.tsx
git commit -m "feat(proposal): render agreement notes below SOW accordion in proposal preview"
```

---

## Task 7: Verify build and final review

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
- 6 files changed (1 new, 5 modified)
- `general-fields.tsx` — new component (~90 lines)
- `project-fields.tsx` — slimmed down (3 fields removed)
- `funding-fields.tsx` — useConfirm + settings popover absorbed
- `incentive-collapsible-header.tsx` — expiry badge added
- `index.tsx` — full rewrite with tabs + AnimatePresence
- `scope-of-work.tsx` — agreement notes block added
- No debug logs, no leftover code
