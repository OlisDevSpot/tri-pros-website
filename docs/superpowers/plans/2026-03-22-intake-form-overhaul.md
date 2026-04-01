# Intake Form Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the intake form to use RHF + Zod, add trade/scope selection, fix the "Closed By" dropdown, and fix layout with ViewportHero.

**Architecture:** Rewrite `IntakeFormView` from raw `useState` to React Hook Form + Zod. Extract `TradeScopeRow` to shared. Add `closedByOptions` to lead source config. Refactor `createFromIntake` mutation to store telemarketer name + requested trades in `leadMetaJSON`.

**Tech Stack:** React Hook Form, Zod, shadcn/ui Form components, tRPC, Drizzle, ViewportHero + TopSpacer

**Spec:** `docs/superpowers/specs/2026-03-22-intake-form-overhaul-design.md`

**Key constraint:** The `meetings.ownerId` column is `NOT NULL` with a FK to `user.id`. When intake forms lack an internal user assignment (e.g. telemarketing leads), no meeting row is created. The `scheduledFor` value is stored in `leadMetaJSON` instead, and a super-admin creates the meeting later when assigning an owner.

---

### Task 1: Extend schemas (lead source config + customer lead meta)

**Files:**
- Modify: `src/shared/entities/lead-sources/schemas.ts`
- Modify: `src/shared/entities/customers/schemas.ts`

- [ ] **Step 1: Add `closedByOptions` to lead source form config schema**

In `src/shared/entities/lead-sources/schemas.ts`, add the optional field:

```ts
export const leadSourceFormConfigSchema = z.object({
  leadType: z.enum(leadTypes),
  showEmail: z.boolean(),
  requireEmail: z.boolean(),
  showMeetingScheduler: z.boolean(),
  requireMeetingScheduler: z.boolean(),
  showMp3Upload: z.boolean(),
  showNotes: z.boolean(),
  closedByOptions: z.array(z.string()).optional(),
})
```

- [ ] **Step 2: Extend `leadMetaSchema` in customer schemas**

In `src/shared/entities/customers/schemas.ts`, extend the schema:

```ts
export const leadMetaSchema = z.object({
  mp3RecordingKey: z.string().optional(),
  closedBy: z.string().optional(),
  scheduledFor: z.string().optional(),
  requestedTrades: z.array(z.object({
    tradeId: z.string(),
    scopeIds: z.array(z.string()),
  })).optional(),
})
```

Note: `scheduledFor` is stored here because the meetings table requires a non-null `ownerId` FK. When there's no internal user assignment (telemarketing leads), we can't create a meeting row. The super-admin creates the meeting later when they assign an owner.

- [ ] **Step 3: Commit**

```bash
git add src/shared/entities/lead-sources/schemas.ts src/shared/entities/customers/schemas.ts
git commit -m "feat(intake): extend leadSourceFormConfig with closedByOptions, extend leadMetaSchema"
```

---

### Task 2: Rewrite intake form schema

**Files:**
- Rewrite: `src/features/intake/schemas/intake-form-schema.ts`

- [ ] **Step 1: Rewrite the schema file**

Replace entire contents of `src/features/intake/schemas/intake-form-schema.ts`:

```ts
import z from 'zod'

export const tradeRowSchema = z.object({
  tradeId: z.string().min(1, 'Trade is required'),
  scopeIds: z.array(z.string()),
})

export type TradeRow = z.infer<typeof tradeRowSchema>

export const intakeFormSchema = z.object({
  // Required
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(7, 'Phone is required'),
  city: z.string().min(1, 'City is required'),
  zip: z.string().min(3, 'ZIP is required'),
  tradeRows: z.array(tradeRowSchema).min(1, 'At least one trade is required'),

  // Optional (toggled by formConfig)
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  state: z.string().length(2).optional(),
  notes: z.string().optional(),
  scheduledFor: z.string().optional(),
  closedBy: z.string().optional(),
  mp3Key: z.string().optional(),

  // Bot protection
  _honeypot: z.string().max(0, 'Bot detected').optional(),
})

export type IntakeFormData = z.infer<typeof intakeFormSchema>

export const intakeFormDefaultValues: IntakeFormData = {
  name: '',
  phone: '',
  city: '',
  zip: '',
  tradeRows: [{ tradeId: '', scopeIds: [] }],
  email: '',
  address: '',
  state: '',
  notes: '',
  scheduledFor: '',
  closedBy: '',
  mp3Key: '',
  _honeypot: '',
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/intake/schemas/intake-form-schema.ts
git commit -m "feat(intake): rewrite intake form schema with tradeRows, closedBy, RHF defaults"
```

---

### Task 3: Move `TradeScopeRow` to shared

**Files:**
- Move: `src/features/showroom/ui/components/form/trade-scope-row.tsx` -> `src/shared/components/trade-scope-row.tsx`
- Modify: `src/features/showroom/ui/components/form/trade-scope-picker-fields.tsx` (update import)

- [ ] **Step 1: Move the file**

```bash
mv src/features/showroom/ui/components/form/trade-scope-row.tsx src/shared/components/trade-scope-row.tsx
```

- [ ] **Step 2: Update the import in `trade-scope-picker-fields.tsx`**

In `src/features/showroom/ui/components/form/trade-scope-picker-fields.tsx`, change line 12 from:

```ts
import { TradeScopeRow } from './trade-scope-row'
```

to:

```ts
import { TradeScopeRow } from '@/shared/components/trade-scope-row'
```

- [ ] **Step 3: Verify no other files import from the old path**

```bash
grep -r "from.*showroom.*trade-scope-row" src/ --include="*.ts" --include="*.tsx"
```

Expected: no results (only the one we just fixed).

- [ ] **Step 4: Commit**

```bash
git add src/shared/components/trade-scope-row.tsx src/features/showroom/ui/components/form/trade-scope-picker-fields.tsx src/features/showroom/ui/components/form/trade-scope-row.tsx
git commit -m "refactor: move TradeScopeRow to shared/components for cross-feature reuse"
```

---

### Task 4: Create `IntakeTradeScopePicker` component

**Files:**
- Create: `src/features/intake/ui/components/intake-trade-scope-picker.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import type { IntakeFormData } from '@/features/intake/schemas/intake-form-schema'
import { useQuery } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { TradeScopeRow } from '@/shared/components/trade-scope-row'
import { Button } from '@/shared/components/ui/button'
import { FormField, FormItem, FormMessage } from '@/shared/components/ui/form'
import { Label } from '@/shared/components/ui/label'
import { useTRPC } from '@/trpc/helpers'

export function IntakeTradeScopePicker() {
  const trpc = useTRPC()
  const form = useFormContext<IntakeFormData>()

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'tradeRows',
  })

  const { data: trades = [] } = useQuery(trpc.notionRouter.trades.getAll.queryOptions())

  const usedTradeIds = new Set(
    form.getValues('tradeRows').map(r => r.tradeId).filter(Boolean),
  )

  return (
    <FormField
      control={form.control}
      name="tradeRows"
      render={() => (
        <FormItem>
          <Label>
            {'Trades & Scopes '}
            <span className="text-destructive">*</span>
          </Label>
          <div className="space-y-3">
            {fields.map((field, index) => (
              <TradeScopeRow
                key={field.id}
                tradeId={form.watch(`tradeRows.${index}.tradeId`)}
                selectedScopeIds={form.watch(`tradeRows.${index}.scopeIds`)}
                allTrades={trades}
                usedTradeIds={usedTradeIds}
                onTradeChange={(tradeId) => {
                  form.setValue(`tradeRows.${index}.tradeId`, tradeId, { shouldValidate: true })
                  form.setValue(`tradeRows.${index}.scopeIds`, [])
                }}
                onScopesChange={(scopeIds) => {
                  form.setValue(`tradeRows.${index}.scopeIds`, scopeIds)
                }}
                onDelete={() => {
                  if (fields.length > 1) {
                    remove(index)
                  }
                }}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ tradeId: '', scopeIds: [] })}
            disabled={usedTradeIds.size >= trades.length}
          >
            <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
            Add Trade
          </Button>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/intake/ui/components/intake-trade-scope-picker.tsx
git commit -m "feat(intake): create IntakeTradeScopePicker using useFieldArray + shared TradeScopeRow"
```

---

### Task 5: Create `MeetingDateField` and `ClosedByField` components

**Files:**
- Create: `src/features/intake/ui/components/meeting-date-field.tsx`
- Create: `src/features/intake/ui/components/closed-by-field.tsx`

- [ ] **Step 1: Create `MeetingDateField`**

```tsx
'use client'

import type { IntakeFormData } from '@/features/intake/schemas/intake-form-schema'
import { useFormContext } from 'react-hook-form'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'

interface MeetingDateFieldProps {
  required?: boolean
}

export function MeetingDateField({ required = false }: MeetingDateFieldProps) {
  const form = useFormContext<IntakeFormData>()

  return (
    <FormField
      control={form.control}
      name="scheduledFor"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            Appointment Date & Time
            {required && <span className="ml-1 text-destructive">*</span>}
          </FormLabel>
          <DateTimePicker
            value={field.value ? new Date(field.value) : undefined}
            onChange={d => field.onChange(d?.toISOString() ?? '')}
            placeholder="Select date & time"
            className="w-full justify-start border border-input bg-background px-3 py-2 h-9 text-sm"
          />
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
```

- [ ] **Step 2: Create `ClosedByField`**

```tsx
'use client'

import type { IntakeFormData } from '@/features/intake/schemas/intake-form-schema'
import { useFormContext } from 'react-hook-form'
import { FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'

interface ClosedByFieldProps {
  options: string[]
}

export function ClosedByField({ options }: ClosedByFieldProps) {
  const form = useFormContext<IntakeFormData>()

  return (
    <FormField
      control={form.control}
      name="closedBy"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Closed By</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select agent…" />
            </SelectTrigger>
            <SelectContent>
              {options.map(name => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/intake/ui/components/meeting-date-field.tsx src/features/intake/ui/components/closed-by-field.tsx
git commit -m "feat(intake): create MeetingDateField and ClosedByField as independent RHF components"
```

---

### Task 6: Update `createFromIntake` mutation

**Files:**
- Modify: `src/trpc/routers/customers.router.ts`

- [ ] **Step 1: Update the mutation input and logic**

In `src/trpc/routers/customers.router.ts`, modify the `createFromIntake` procedure:

1. **Remove `closedById` from input** (line 110)
2. **Remove `scheduledFor` from input** (line 109) — it now lives in `leadMetaJSON`
3. **Remove meeting creation logic** (lines 141-148) — meetings are created later by super-admin when an owner is assigned. The `meetings.ownerId` column is `NOT NULL`, so we cannot insert a meeting without an owner.
4. **Update the destructuring** (line 113) — remove `scheduledFor` and `closedById`
5. **Remove unused `meetings` import** (line 12) — `import { meetings } from '@/shared/db/schema/meetings'` is no longer needed

The updated procedure input:

```ts
createFromIntake: baseProcedure
  .input(z.object({
    name: z.string().min(1),
    phone: z.string().min(1),
    address: z.string().optional(),
    city: z.string().min(1),
    state: z.string().length(2).optional(),
    zip: z.string().min(1),
    email: z.string().email().optional(),
    notes: z.string().optional(),
    leadSource: z.enum(leadSources),
    leadType: z.enum(leadTypes),
    leadMetaJSON: leadMetaSchema.optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    const { notes, ...customerData } = input

    // Rate limit by IP
    const ip = (ctx as { req?: Request }).req?.headers.get('x-forwarded-for') ?? 'anonymous'
    const { success } = await intakeRatelimit.limit(ip)
    if (!success) {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many submissions. Please try again later.' })
    }

    // 1. Insert customer
    const [customer] = await db
      .insert(customers)
      .values({ ...customerData, zip: customerData.zip || '' })
      .returning()

    if (!customer) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create customer' })
    }

    // 2. Insert note (if provided) — failure is non-fatal
    if (notes) {
      await db.insert(customerNotes).values({
        customerId: customer.id,
        content: notes,
        authorId: null,
      }).catch(e => console.error('Note insert failed (non-fatal):', e))
    }

    return { customerId: customer.id }
  }),
```

- [ ] **Step 2: Commit**

```bash
git add src/trpc/routers/customers.router.ts
git commit -m "refactor(intake): simplify createFromIntake — remove closedById/scheduledFor, store in leadMetaJSON"
```

---

### Task 7: Refactor `IntakeFormView` to RHF

**Files:**
- Rewrite: `src/features/intake/ui/views/intake-form-view.tsx`
- Delete: `src/features/intake/ui/components/meeting-scheduler-field.tsx`

This is the largest task. The view is rewritten from raw `useState` to React Hook Form.

- [ ] **Step 1: Delete old `meeting-scheduler-field.tsx`**

```bash
rm src/features/intake/ui/components/meeting-scheduler-field.tsx
```

- [ ] **Step 2: Rewrite `IntakeFormView`**

Replace entire contents of `src/features/intake/ui/views/intake-form-view.tsx`:

```tsx
/* eslint-disable node/prefer-global/process */
'use client'

import type { LeadSourceFormConfig } from '@/shared/entities/lead-sources/schemas'
import type { LeadSource, LeadType } from '@/shared/types/enums'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { APIProvider } from '@vis.gl/react-google-maps'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { intakeFormDefaultValues, intakeFormSchema } from '@/features/intake/schemas/intake-form-schema'
import type { IntakeFormData } from '@/features/intake/schemas/intake-form-schema'
import { AddressAutocompleteField } from '@/features/intake/ui/components/address-autocomplete-field'
import { ClosedByField } from '@/features/intake/ui/components/closed-by-field'
import { IntakeTradeScopePicker } from '@/features/intake/ui/components/intake-trade-scope-picker'
import { MeetingDateField } from '@/features/intake/ui/components/meeting-date-field'
import { Mp3UploadField } from '@/features/intake/ui/components/mp3-upload-field'
import { Button } from '@/shared/components/ui/button'
import { Form, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { useTRPC } from '@/trpc/helpers'

interface IntakeFormViewProps {
  leadSourceSlug: LeadSource
  formConfig: LeadSourceFormConfig
  leadSourceName: string
}

export function IntakeFormView({ leadSourceSlug, formConfig, leadSourceName }: IntakeFormViewProps) {
  const trpc = useTRPC()

  const form = useForm<IntakeFormData>({
    resolver: zodResolver(intakeFormSchema),
    defaultValues: intakeFormDefaultValues,
  })

  const submit = useMutation(
    trpc.customersRouter.createFromIntake.mutationOptions({
      onSuccess: () => form.reset({ ...intakeFormDefaultValues, _honeypot: 'submitted' }),
      onError: err => toast.error(err.message),
    }),
  )

  const isSubmitted = form.watch('_honeypot') === 'submitted'

  function onSubmit(data: IntakeFormData) {
    if (data._honeypot && data._honeypot !== 'submitted') {
      return
    }

    submit.mutate({
      name: data.name,
      phone: data.phone,
      city: data.city,
      zip: data.zip,
      email: data.email || undefined,
      address: data.address || undefined,
      state: data.state || undefined,
      notes: data.notes || undefined,
      leadSource: leadSourceSlug,
      leadType: formConfig.leadType as LeadType,
      leadMetaJSON: {
        mp3RecordingKey: data.mp3Key || undefined,
        closedBy: data.closedBy || undefined,
        scheduledFor: data.scheduledFor || undefined,
        requestedTrades: data.tradeRows.filter(r => r.tradeId),
      },
    })
  }

  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-2xl font-semibold">Contact Added</p>
        <p className="text-muted-foreground">The lead has been successfully submitted.</p>
        <Button
          variant="outline"
          onClick={() => form.reset(intakeFormDefaultValues)}
        >
          Submit Another
        </Button>
      </div>
    )
  }

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          {/* Honeypot — hidden from real users */}
          <input
            tabIndex={-1}
            aria-hidden="true"
            className="absolute -top-2499.75 left-0 opacity-0"
            {...form.register('_honeypot')}
          />

          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {'Full Name '}
                  <span className="text-destructive">*</span>
                </FormLabel>
                <Input {...field} />
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Phone */}
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {'Phone '}
                  <span className="text-destructive">*</span>
                </FormLabel>
                <Input type="tel" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Email (conditional) */}
          {formConfig.showEmail && (
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Email
                    {formConfig.requireEmail && <span className="ml-1 text-destructive">*</span>}
                  </FormLabel>
                  <Input type="email" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Address */}
          <FormField
            control={form.control}
            name="address"
            render={() => (
              <FormItem>
                <FormLabel>
                  {'Address '}
                  <span className="text-destructive">*</span>
                </FormLabel>
                <AddressAutocompleteField
                  onChange={(fields) => {
                    form.setValue('address', fields.address)
                    form.setValue('city', fields.city)
                    form.setValue('state', fields.state)
                    form.setValue('zip', fields.zip)
                  }}
                  onClear={() => {
                    form.setValue('address', '')
                    form.setValue('city', '')
                    form.setValue('state', '')
                    form.setValue('zip', '')
                  }}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Trade/Scope Picker */}
          <IntakeTradeScopePicker />

          {/* MP3 upload (conditional) */}
          {formConfig.showMp3Upload && (
            <FormField
              control={form.control}
              name="mp3Key"
              render={() => (
                <FormItem>
                  <FormLabel>Call Recording (optional)</FormLabel>
                  <Mp3UploadField
                    customerName={form.watch('name')}
                    onUploaded={key => form.setValue('mp3Key', key)}
                    onClear={() => form.setValue('mp3Key', '')}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Meeting date (conditional) */}
          {formConfig.showMeetingScheduler && (
            <MeetingDateField required={formConfig.requireMeetingScheduler} />
          )}

          {/* Closed By (conditional — only when closedByOptions configured) */}
          {formConfig.closedByOptions && formConfig.closedByOptions.length > 0 && (
            <ClosedByField options={formConfig.closedByOptions} />
          )}

          {/* Notes (conditional) */}
          {formConfig.showNotes && (
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <Textarea
                    rows={3}
                    placeholder="Any context about this lead…"
                    {...field}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <Button type="submit" size="lg" disabled={submit.isPending} className="w-full py-6">
            {submit.isPending ? 'Submitting…' : 'Submit Lead'}
          </Button>
        </form>
      </Form>
    </APIProvider>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/intake/ui/views/intake-form-view.tsx src/features/intake/ui/components/meeting-scheduler-field.tsx
git commit -m "feat(intake): rewrite IntakeFormView with RHF + Zod, new field components"
```

---

### Task 8: Refactor intake page layout with ViewportHero

**Files:**
- Modify: `src/app/(frontend)/(site)/intake/[token]/page.tsx`

- [ ] **Step 1: Update the page layout**

Replace the page contents:

```tsx
import type { LeadSource } from '@/shared/types/enums'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { IntakeFormView } from '@/features/intake/ui/views/intake-form-view'
import { db } from '@/shared/db'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'
import { TopSpacer } from '@/shared/components/top-spacer'
import { ViewportHero } from '@/shared/components/viewport-hero'
import { leadSourceFormConfigSchema } from '@/shared/entities/lead-sources/schemas'

interface Props {
  params: Promise<{ token: string }>
}

export default async function IntakePage({ params }: Props) {
  const { token } = await params

  const [row] = await db
    .select()
    .from(leadSourcesTable)
    .where(eq(leadSourcesTable.token, token))
    .limit(1)

  if (!row || !row.isActive) {
    notFound()
  }

  const formConfig = leadSourceFormConfigSchema.parse(row.formConfigJSON)

  return (
    <ViewportHero className="bg-background">
      <TopSpacer>
        <div className="mx-auto flex h-full w-full max-w-lg flex-col items-center justify-center gap-8 px-4 py-10">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">New Lead</h1>
            <p className="mt-2 text-muted-foreground">{row.name}</p>
          </div>
          <div className="w-full rounded-xl border border-border bg-card p-6 shadow-sm">
            <IntakeFormView
              leadSourceSlug={row.slug as LeadSource}
              leadSourceName={row.name}
              formConfig={formConfig}
            />
          </div>
        </div>
      </TopSpacer>
    </ViewportHero>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(frontend\)/\(site\)/intake/\[token\]/page.tsx
git commit -m "feat(intake): wrap intake page in ViewportHero + TopSpacer for proper navbar spacing"
```

---

### Task 9: Seed telemarketing lead source with `closedByOptions`

**Files:**
- None (DB update via script or direct query)

- [ ] **Step 1: Create a one-shot migration script**

Create `scripts/seed-closed-by-options.ts`:

```ts
import { eq, sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'

async function main() {
  const closedByOptions = ['Austin', 'Rico', 'Mei Ann', 'Angelica']

  const [updated] = await db
    .update(leadSourcesTable)
    .set({
      formConfigJSON: sql`jsonb_set(form_config_json, '{closedByOptions}', ${JSON.stringify(closedByOptions)}::jsonb)`,
    })
    .where(eq(leadSourcesTable.slug, 'telemarketing_leads_philippines'))
    .returning({ slug: leadSourcesTable.slug })

  if (updated) {
    console.log(`Updated ${updated.slug} with closedByOptions: ${closedByOptions.join(', ')}`)
  }
  else {
    console.error('No lead source found with slug "telemarketing_leads_philippines"')
  }

  process.exit(0)
}

main()
```

- [ ] **Step 2: Run the script**

```bash
pnpm tsx scripts/seed-closed-by-options.ts
```

Expected: `Updated telemarketing_leads_philippines with closedByOptions: Austin, Rico, Mei Ann, Angelica`

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-closed-by-options.ts
git commit -m "chore: seed telemarketing lead source with closedByOptions"
```

---

### Task 10: Verify and lint

- [ ] **Step 1: Run lint**

```bash
pnpm lint
```

Expected: no errors. Fix any import sorting or lint issues.

- [ ] **Step 2: Run build**

```bash
pnpm build
```

Expected: successful build with no type errors.

- [ ] **Step 3: Fix any issues found, then commit**

```bash
git add -A
git commit -m "fix(intake): resolve lint and type errors from intake form overhaul"
```

---

### Task 11: Manual smoke test

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Navigate to the telemarketing intake form**

Open `http://localhost:3000/intake/<telemarketing-token>` in browser.

Verify:
1. Hero has proper spacing from navbar (ViewportHero + TopSpacer)
2. Form renders in a centered card with "New Lead" heading
3. Trade picker shows with 1 empty row — selecting a trade enables the scope multi-select
4. "Add Trade" button adds a new row
5. Cannot submit with 0 trades selected
6. "Closed By" dropdown shows Austin, Rico, Mei Ann, Angelica (not internal users)
7. Meeting date picker is visible (if `showMeetingScheduler` is true for this source)
8. Submit creates a customer record with `leadMetaJSON` containing `closedBy`, `requestedTrades`, and optionally `scheduledFor`
9. Success screen shows with "Submit Another" button

- [ ] **Step 3: Test a non-telemarketing lead source**

Navigate to another lead source intake form. Verify:
1. No "Closed By" dropdown (since `closedByOptions` is not set)
2. All other fields work normally
