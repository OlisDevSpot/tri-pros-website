# Pipeline Native Customers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `needs_confirmation` limbo stage to the active customer pipeline so customers without a scheduled meeting are visible, and provide a `CreateMeetingModal` to schedule meetings directly from the pipeline kanban.

**Architecture:** The feature adds a new first stage to the active pipeline computed by `computeCustomerStage`. The DAL switches from `innerJoin` to `leftJoin` so customers without meetings appear. A `CreateMeetingModal` (triggered by kanban card button or drag interception) creates meetings with type, optional datetime, and optional trade/scope selection. Dashboard cleanup removes obsolete steps and relocates ActionCenter to a sheet in the pipeline view.

**Tech Stack:** Next.js 15, tRPC, Drizzle ORM (Postgres/Neon), React, TanStack Query, shadcn/ui, motion/react, Zod

**Spec:** `docs/superpowers/specs/2026-03-19-pipeline-native-customers-design.md`

---

## File Map

### Modified Files

| File | Responsibility |
|------|---------------|
| `src/shared/constants/enums/meetings.ts` | Add `needs_confirmation` to `meetingPipelineStages`, update `meetingTypes` |
| `src/shared/types/enums/meetings.ts` | Add `MeetingType` derived type |
| `src/shared/entities/meetings/schemas.ts` | Add `meetingScopeEntrySchema`, `meetingScopesSchema`; add `.catch(undefined)` on `meetingType` |
| `src/shared/db/schema/meetings.ts` | Add `type` + `meetingScopesJSON` columns, make `scheduledFor` nullable, fix `insertMeetingSchema` omit |
| `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` | `innerJoin` → `leftJoin`, fix `orderBy` |
| `src/features/customer-pipelines/lib/compute-customer-stage.ts` | Add explicit `meeting_scheduled` check, change fallback to `needs_confirmation` |
| `src/features/customer-pipelines/constants/active-pipeline-stages.ts` | Prepend `needs_confirmation` stage config + drag transitions |
| `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx` | Add modal state, intercept `needs_confirmation→meeting_scheduled` drag, add ActionCenter sheet button |
| `src/features/customer-pipelines/ui/components/customer-kanban-card.tsx` | Add `onCreateMeeting` prop + "Schedule Meeting" button for `needs_confirmation` cards |
| `src/trpc/routers/meetings.router.ts` | Update `create` input to accept `type`, optional `scheduledFor`, optional `meetingScopesJSON` |
| `src/features/agent-dashboard/constants/dashboard-steps.ts` | Remove `action-center` and `create-meeting` |
| `src/features/agent-dashboard/constants/sidebar-items.ts` | Remove `action-center` entry |
| `src/features/agent-dashboard/ui/views/dashboard-hub.tsx` | Remove `ActionCenterView` and `CreateMeetingView` AnimatePresence blocks |
| `src/features/agent-dashboard/ui/components/dashboard-sidebar.tsx` | Remove `CreatePicker` |
| `src/features/agent-dashboard/dal/server/get-action-queue.ts` | Join customers, use COALESCE for `customerName` |
| `src/features/meetings/ui/views/index.ts` | Remove `CreateMeetingView` export |
| `src/features/meetings/ui/views/meetings-dashboard.tsx` | Remove `CreateMeetingView` import + AnimatePresence block |
| `src/features/meetings/lib/url-parsers.ts` | Remove `create-meeting` from `meetingsDashboardStepParser` |
| `src/features/meetings/ui/components/meetings-sidebar.tsx` | Remove "New Meeting" button (was `create-meeting` step) |
| `src/features/customer-pipelines/types/index.ts` | Update `CustomerProfileMeeting` for nullable `scheduledFor` |
| `src/trpc/routers/proposals.router.tsx` | Snapshot `meetingScopesJSON` from meeting into proposal `projectJSON.sow` on create |
| `src/features/meetings/ui/views/meeting-intake-view.tsx` | Embed `MeetingScopePicker` as persistent header section |
| `src/features/meetings/ui/views/meeting-flow.tsx` | Wire `onScopeChange` to `updateMeeting` for intake scopes |

### New Files

| File | Responsibility |
|------|---------------|
| `src/features/meetings/ui/components/create-meeting-modal.tsx` | Modal for creating meetings with type, datetime, scopes |
| `src/features/meetings/ui/components/meeting-scopes-picker.tsx` | Trade/scope selection rows (reusable in modal + intake) |
| `src/features/agent-dashboard/ui/components/action-center-sheet.tsx` | Wraps `ActionCenterView` in `BaseSheet` |

### Deleted Files

| File | Reason |
|------|--------|
| `src/features/meetings/ui/views/create-meeting-view.tsx` | Replaced by `CreateMeetingModal` |
| `src/features/agent-dashboard/ui/components/create-picker.tsx` | Obsolete — proposals come from meetings |

---

## Task 1: Update Enums & Entity Schemas

**Files:**
- Modify: `src/shared/constants/enums/meetings.ts`
- Modify: `src/shared/types/enums/meetings.ts`
- Modify: `src/shared/entities/meetings/schemas.ts`

- [ ] **Step 1: Update `meetingPipelineStages` to prepend `needs_confirmation`**

In `src/shared/constants/enums/meetings.ts`, find the `meetingPipelineStages` array and add `'needs_confirmation'` as the first entry:

```ts
export const meetingPipelineStages = [
  'needs_confirmation',
  'meeting_scheduled',
  'meeting_in_progress',
  'meeting_completed',
  'follow_up_scheduled',
] as const
```

- [ ] **Step 2: Update `meetingTypes` from `['Initial', 'Follow-up']` to `['Fresh', 'Follow-up', 'Rehash']`**

In the same file, replace:
```ts
export const meetingTypes = ['Initial', 'Follow-up'] as const
```
with:
```ts
export const meetingTypes = ['Fresh', 'Follow-up', 'Rehash'] as const
```

- [ ] **Step 3: Add `MeetingType` to the types file**

In `src/shared/types/enums/meetings.ts`, add after the existing imports and types:

```ts
import type { meetingTypes } from '@/shared/constants/enums/meetings'
// ... (add to existing import block)

export type MeetingType = (typeof meetingTypes)[number]
```

Note: add `meetingTypes` to the existing `import type { ... }` block at the top of the file.

- [ ] **Step 4: Add meeting scope schemas and `.catch(undefined)` on legacy meetingType**

In `src/shared/entities/meetings/schemas.ts`, add the scope schemas and protect the `meetingType` field:

```ts
import z from 'zod'
import {
  meetingDecisionMakersPresentOptions,
  meetingDecisionTimelines,
  meetingTypes,
  meetingYearsInHome,
} from '@/shared/constants/enums'

export const situationProfileSchema = z.object({
  decisionMakersPresent: z.enum(meetingDecisionMakersPresentOptions),
  meetingType: z.enum(meetingTypes).catch(undefined as unknown as 'Fresh'),
}).partial()

export const programDataSchema = z.object({
  scope: z.string(),
  bill: z.string(),
  timeline: z.enum(meetingDecisionTimelines),
  yrs: z.enum(meetingYearsInHome),
}).partial()

export type SituationProfile = z.infer<typeof situationProfileSchema>
export type ProgramData = z.infer<typeof programDataSchema>

// Meeting scopes — JSONB on meetings table
export const meetingScopeEntrySchema = z.object({
  trade: z.object({ id: z.string(), label: z.string() }),
  scopes: z.array(z.object({ id: z.string(), label: z.string() })),
})
export type MeetingScopeEntry = z.infer<typeof meetingScopeEntrySchema>

export const meetingScopesSchema = z.array(meetingScopeEntrySchema)
export type MeetingScopes = z.infer<typeof meetingScopesSchema>
```

- [ ] **Step 5: Run lint + build to verify**

```bash
pnpm lint && pnpm build
```

Expected: Build succeeds. Some TypeScript warnings may appear for `meetingType` `.catch()` usage — these are acceptable.

- [ ] **Step 6: Commit**

```bash
git add src/shared/constants/enums/meetings.ts src/shared/types/enums/meetings.ts src/shared/entities/meetings/schemas.ts
git commit -m "feat(pipeline): add needs_confirmation stage enum, update meetingTypes, add MeetingScopes schema"
```

---

## Task 2: Update Meetings DB Schema

**Files:**
- Modify: `src/shared/db/schema/meetings.ts`

- [ ] **Step 1: Add `type` column, `meetingScopesJSON` column, make `scheduledFor` nullable, fix `insertMeetingSchema` omit**

The `meetings` table needs three changes:
1. Add `type: text('type')` column (not an enum — stores 'Fresh' | 'Follow-up' | 'Rehash')
2. Add `meetingScopesJSON: jsonb('meeting_scopes_json').$type<MeetingScopes>()` column
3. Make `scheduledFor` nullable (remove `.notNull()`) so meetings can be created without a scheduled datetime
4. Remove `customerId` from `insertMeetingSchema.omit()` so it can be provided by callers

Update `src/shared/db/schema/meetings.ts`:

```ts
import type z from 'zod'
import type {
  MeetingScopes,
  ProgramData,
  SituationProfile,
} from '@/shared/entities/meetings/schemas'
import { relations } from 'drizzle-orm'
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import {
  meetingScopesSchema,
  programDataSchema,
  situationProfileSchema,
} from '@/shared/entities/meetings/schemas'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { customers } from './customers'
import { meetingStatusEnum } from './meta'

export const meetings = pgTable('meetings', {
  id,
  ownerId: text('owner_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  contactName: text('contact_name'),
  type: text('type'),
  program: text('program'),
  scheduledFor: timestamp('scheduled_for', { mode: 'string', withTimezone: true }),
  status: meetingStatusEnum('status').notNull().default('in_progress'),
  situationProfileJSON: jsonb('situation_objective_profile_json').$type<SituationProfile>(),
  programDataJSON: jsonb('program_data_json').$type<ProgramData>(),
  meetingScopesJSON: jsonb('meeting_scopes_json').$type<MeetingScopes>(),
  createdAt,
  updatedAt,
})

export const meetingsRelations = relations(meetings, ({ one }) => ({
  owner: one(user, {
    fields: [meetings.ownerId],
    references: [user.id],
  }),
  customer: one(customers, {
    fields: [meetings.customerId],
    references: [customers.id],
  }),
}))

export const selectMeetingSchema = createSelectSchema(meetings, {
  situationProfileJSON: situationProfileSchema.nullable(),
  programDataJSON: programDataSchema.nullable(),
  meetingScopesJSON: meetingScopesSchema.nullable(),
})
export type Meeting = z.infer<typeof selectMeetingSchema>

export const insertMeetingSchema = createInsertSchema(meetings, {
  situationProfileJSON: situationProfileSchema.optional(),
  programDataJSON: programDataSchema.optional(),
  meetingScopesJSON: meetingScopesSchema.optional(),
}).omit({
  id: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertMeetingSchema = z.infer<typeof insertMeetingSchema>
```

Key changes from current:
- `scheduledFor` lost `.notNull()`
- `customerId` removed from `.omit()` block
- `type` column added
- `meetingScopesJSON` column + schema overrides added
- `MeetingScopes` type imported

- [ ] **Step 2: Fix `CustomerProfileMeeting` type for nullable `scheduledFor`**

In `src/features/customer-pipelines/types/index.ts`, the `CustomerProfileMeeting` type picks `scheduledFor` from `Meeting`. After making `scheduledFor` nullable, this type auto-updates to `string | null`. No code change needed here — but verify that consumers of this type handle `null` gracefully. If any consumer does `new Date(meeting.scheduledFor)` without a null check, add one.

- [ ] **Step 3: Fix `duplicate` procedure for nullable `scheduledFor`**

In `src/trpc/routers/meetings.router.ts`, the `duplicate` procedure (around line 138) does `scheduledFor: original.scheduledFor`. After making `scheduledFor` nullable, `original.scheduledFor` is `string | null` but the insert expects `string | undefined`. Fix:

Replace:
```ts
          scheduledFor: original.scheduledFor,
```
With:
```ts
          scheduledFor: original.scheduledFor ?? undefined,
```

- [ ] **Step 4: Push schema to database**

```bash
pnpm db:push
```

Expected: Drizzle pushes the new columns and nullable change to Neon.

- [ ] **Step 5: Run lint + build to verify**

```bash
pnpm lint && pnpm build
```

Expected: Build succeeds. The `scheduledFor` nullability is handled by the fixes in Steps 2-3.

- [ ] **Step 6: Commit**

```bash
git add src/shared/db/schema/meetings.ts
git commit -m "feat(schema): add type + meetingScopesJSON columns, make scheduledFor nullable, expose customerId in insertSchema"
```

---

## Task 3: Fix Pipeline DAL (leftJoin) + Update Stage Machine

**Files:**
- Modify: `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts`
- Modify: `src/features/customer-pipelines/lib/compute-customer-stage.ts`
- Modify: `src/features/customer-pipelines/constants/active-pipeline-stages.ts`

**This is the critical prerequisite — without the leftJoin, `needs_confirmation` customers are invisible.**

- [ ] **Step 1: Change `innerJoin` to `leftJoin` and fix `orderBy`**

In `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts`, make two changes in the active pipeline query (around lines 59-66):

Replace:
```ts
    .innerJoin(meetings, and(
      eq(meetings.customerId, customers.id),
      isOmni ? undefined : eq(meetings.ownerId, userId),
    ))
    .where(eq(customers.pipeline, 'active'))
    .groupBy(customers.id)
    .orderBy(desc(max(meetings.createdAt)))
```

With:
```ts
    .leftJoin(meetings, and(
      eq(meetings.customerId, customers.id),
      isOmni ? undefined : eq(meetings.ownerId, userId),
    ))
    .where(eq(customers.pipeline, 'active'))
    .groupBy(customers.id)
    .orderBy(desc(customers.updatedAt))
```

The `latestActivityAt` fallback `?? row.customerId` already handles the case where both timestamps are null — it uses the customer ID as a stable sort tiebreaker. No change needed here.

- [ ] **Step 2: Update `computeCustomerStage` — add explicit `meeting_scheduled` check, change fallback**

In `src/features/customer-pipelines/lib/compute-customer-stage.ts`:

```ts
import type { CustomerPipelineStage } from '../constants/active-pipeline-stages'

interface StageInput {
  hasCompletedMeeting: boolean
  hasInProgressMeeting: boolean
  hasScheduledFutureMeeting: boolean
  proposalStatuses: string[]
  hasSentContract: boolean
}

export function computeCustomerStage(data: StageInput): CustomerPipelineStage {
  const { proposalStatuses } = data

  if (proposalStatuses.includes('approved')) {
    return 'approved'
  }

  if (data.hasSentContract) {
    return 'contract_sent'
  }

  if (proposalStatuses.includes('sent')) {
    return 'proposal_sent'
  }

  if (proposalStatuses.length > 0 && proposalStatuses.every(s => s === 'declined')) {
    return 'declined'
  }

  if (data.hasCompletedMeeting && data.hasInProgressMeeting) {
    return 'follow_up_scheduled'
  }

  if (data.hasCompletedMeeting && !data.hasInProgressMeeting) {
    return 'meeting_completed'
  }

  if (data.hasInProgressMeeting && !data.hasScheduledFutureMeeting) {
    return 'meeting_in_progress'
  }

  if (data.hasScheduledFutureMeeting) {
    return 'meeting_scheduled'
  }

  return 'needs_confirmation'
}
```

Key change: The old default `return 'meeting_scheduled'` is now an explicit check. New default is `'needs_confirmation'`.

- [ ] **Step 3: Update `activeStageConfig` — prepend `needs_confirmation`, update transitions**

In `src/features/customer-pipelines/constants/active-pipeline-stages.ts`:

```ts
import type { KanbanStageConfig } from '@/shared/components/kanban/types'

import {
  CalendarCheckIcon,
  CalendarIcon,
  CheckCircle2Icon,
  PlayCircleIcon,
  RotateCwIcon,
  SendIcon,
  UserCheckIcon,
  XCircleIcon,
} from 'lucide-react'

import { meetingPipelineStages } from '@/shared/constants/enums/meetings'
import { proposalPipelineStages } from '@/shared/constants/enums/proposals'

export const customerPipelineStages = [...meetingPipelineStages, ...proposalPipelineStages] as const

export type CustomerPipelineStage = (typeof customerPipelineStages)[number]

export const activeStageConfig: readonly KanbanStageConfig<CustomerPipelineStage>[] = [
  { key: 'needs_confirmation', label: 'Needs Confirmation', icon: UserCheckIcon, color: 'orange' },
  { key: 'meeting_scheduled', label: 'Meeting Scheduled', icon: CalendarIcon, color: 'blue' },
  { key: 'meeting_in_progress', label: 'In Progress', icon: PlayCircleIcon, color: 'yellow' },
  { key: 'meeting_completed', label: 'Meeting Done', icon: CalendarCheckIcon, color: 'yellow' },
  { key: 'follow_up_scheduled', label: 'Follow-up', icon: RotateCwIcon, color: 'purple' },
  { key: 'proposal_sent', label: 'Proposal Sent', icon: SendIcon, color: 'purple' },
  { key: 'contract_sent', label: 'Contract Sent', icon: CheckCircle2Icon, color: 'purple' },
  { key: 'approved', label: 'Approved', icon: CheckCircle2Icon, color: 'green' },
  { key: 'declined', label: 'Declined', icon: XCircleIcon, color: 'red' },
]

export const ACTIVE_ALLOWED_DRAG_TRANSITIONS: Record<CustomerPipelineStage, readonly CustomerPipelineStage[]> = {
  needs_confirmation: ['meeting_scheduled'],
  meeting_scheduled: ['meeting_in_progress'],
  meeting_in_progress: ['meeting_completed'],
  meeting_completed: [],
  follow_up_scheduled: ['meeting_completed'],
  proposal_sent: ['declined'],
  contract_sent: [],
  approved: [],
  declined: [],
}

export const ACTIVE_BLOCKED_MESSAGES: Record<string, string> = {
  'needs_confirmation->meeting_scheduled': 'Scheduling a meeting…',
  'meeting_completed->proposal_sent': 'Create a proposal from the meeting page',
  'meeting_completed->follow_up_scheduled': 'Schedule a follow-up meeting from the meeting page',
  'proposal_sent->contract_sent': 'Contracts are sent via DocuSign',
  'contract_sent->approved': 'Approval happens when the customer signs via DocuSign',
  'declined->meeting_scheduled': 'Schedule a new follow-up meeting from the customer profile',
  'default': 'This transition is not supported via drag',
}
```

Key changes: `UserCheckIcon` imported, `needs_confirmation` prepended to stage config + transitions.

- [ ] **Step 4: Run lint + build**

```bash
pnpm lint && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts src/features/customer-pipelines/lib/compute-customer-stage.ts src/features/customer-pipelines/constants/active-pipeline-stages.ts
git commit -m "feat(pipeline): add needs_confirmation stage, leftJoin DAL fix, update stage machine"
```

---

## Task 4: Update tRPC Meetings Router

**Files:**
- Modify: `src/trpc/routers/meetings.router.ts`

- [ ] **Step 1: Update `create` procedure input to accept `type`, optional `scheduledFor`, optional `meetingScopesJSON`**

In `src/trpc/routers/meetings.router.ts`, update the `create` procedure input. The current input is `insertMeetingSchema.extend({ customerId: z.string().uuid(...) })`. Since we removed `customerId` from the omit block, `insertMeetingSchema` now includes it — but it's optional from Drizzle's perspective (since the column is nullable). Override it to be required:

```ts
import { TRPCError } from '@trpc/server'
import { and, desc, eq, getTableColumns, inArray } from 'drizzle-orm'
import z from 'zod'
import { meetingTypes } from '@/shared/constants/enums'
import { db } from '@/shared/db'
import { customers, insertMeetingSchema, meetings, proposals, user } from '@/shared/db/schema'
import { meetingScopesSchema } from '@/shared/entities/meetings/schemas'
import { agentProcedure, createTRPCRouter } from '../init'

export const meetingsRouter = createTRPCRouter({
  // ... getAll stays the same ...

  create: agentProcedure
    .input(z.object({
      customerId: z.string().uuid('A customer is required'),
      type: z.enum(meetingTypes),
      scheduledFor: z.string().optional(),
      meetingScopesJSON: meetingScopesSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { customerId, ...meetingData } = input

      const [created] = await db
        .insert(meetings)
        .values({ ...meetingData, ownerId: ctx.session.user.id, customerId })
        .returning()

      return created
    }),

  // ... rest of router stays the same ...
```

Key changes:
- Input changed from `insertMeetingSchema.extend(...)` to explicit `z.object(...)` with `type` required, `scheduledFor` optional, `meetingScopesJSON` optional
- `meetingTypes` and `meetingScopesSchema` imported

**Important:** Only modify the `create` procedure and its imports. Do NOT change `getAll`, `update`, `getById`, or `linkProposal`.

**Note:** The new `z.object(...)` input intentionally drops all prior optional fields (`program`, `contactName`, `situationProfileJSON`, `programDataJSON`) from the `create` input. These fields are collected during the meeting intake flow via the `update` procedure, not at creation time. This is by design — meeting creation is now a lightweight "schedule" action.

- [ ] **Step 2: Run lint + build**

```bash
pnpm lint && pnpm build
```

Expected: May see warnings in `create-meeting-view.tsx` since its `createMeeting.mutate()` call now needs `type`. This file will be deleted in Task 7, so ignore for now.

- [ ] **Step 3: Commit**

```bash
git add src/trpc/routers/meetings.router.ts
git commit -m "feat(meetings): update create procedure to accept type, optional scheduledFor, optional scopes"
```

---

## Task 5: Create MeetingScopePicker Component

**Files:**
- Create: `src/features/meetings/ui/components/meeting-scopes-picker.tsx`

- [ ] **Step 1: Identify the trade/scope data hooks**

The spec says to reuse `useGetAllTrades` and `useGetScopes` from the Notion DAL. Find them:

```bash
# Search for the hooks — paths may differ from spec
grep -r "useGetAllTrades\|useGetScopes" src/ --include="*.ts" --include="*.tsx" -l
```

Use the actual hook paths found. If they don't exist, check for similar hooks like `useGetTrades` or look in `src/shared/services/notion/`.

- [ ] **Step 2: Create `meeting-scopes-picker.tsx`**

Create `src/features/meetings/ui/components/meeting-scopes-picker.tsx`:

```tsx
'use client'

import type { MeetingScopes } from '@/shared/entities/meetings/schemas'

import { PlusIcon, TrashIcon } from 'lucide-react'
import { useCallback } from 'react'

import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'

// TODO: Replace these placeholder hooks with real Notion DAL hooks:
// import { useGetAllTrades } from '@/shared/services/notion/dal/trades/hooks/queries/use-get-trades'
// import { useGetScopes } from '@/shared/services/notion/dal/scopes/hooks/queries/use-get-scopes'

interface MeetingScopePickerProps {
  value: MeetingScopes
  onChange: (scopes: MeetingScopes) => void
}

export function MeetingScopePicker({ value, onChange }: MeetingScopePickerProps) {
  // TODO: Wire up real hooks — for now, just render the UI structure
  // const { data: trades = [] } = useGetAllTrades()

  const handleAddRow = useCallback(() => {
    onChange([...value, { trade: { id: '', label: '' }, scopes: [] }])
  }, [value, onChange])

  const handleRemoveRow = useCallback((index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }, [value, onChange])

  const handleTradeChange = useCallback((index: number, tradeId: string, tradeLabel: string) => {
    const updated = [...value]
    updated[index] = { trade: { id: tradeId, label: tradeLabel }, scopes: [] }
    onChange(updated)
  }, [value, onChange])

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Trades & Scopes</Label>
      {value.map((entry, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="flex-1 space-y-2">
            <Select
              value={entry.trade.id}
              onValueChange={(id) => handleTradeChange(index, id, id)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select trade" />
              </SelectTrigger>
              <SelectContent>
                {/* TODO: Map trades from hook */}
                <SelectItem value="placeholder">Loading trades…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => handleRemoveRow(index)}
          >
            <TrashIcon size={14} />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-1.5"
        onClick={handleAddRow}
      >
        <PlusIcon size={14} />
        Add trade
      </Button>
    </div>
  )
}
```

**Note:** The real hooks exist at:
- `src/shared/services/notion/dal/trades/hooks/queries/use-get-trades.ts` (exports `useGetTrades`)
- `src/shared/services/notion/dal/scopes/hooks/queries/use-get-scopes.ts` (exports `useGetScopes`)

The existing `src/shared/components/trade-scope-row.tsx` component also uses these hooks — reference it for the correct hook API and data shape. Wire the real hooks during implementation. The TODO comments in the skeleton above mark where they should be placed. An existing working example is `src/features/proposal-flow/ui/components/form/sow-field.tsx`.

- [ ] **Step 3: Run lint + build**

```bash
pnpm lint && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add src/features/meetings/ui/components/meeting-scopes-picker.tsx
git commit -m "feat(meetings): add MeetingScopePicker component for trade/scope selection"
```

---

## Task 6: Create CreateMeetingModal

**Files:**
- Create: `src/features/meetings/ui/components/create-meeting-modal.tsx`

- [ ] **Step 1: Create `create-meeting-modal.tsx`**

Create `src/features/meetings/ui/components/create-meeting-modal.tsx`:

```tsx
'use client'

import type { MeetingScopes } from '@/shared/entities/meetings/schemas'
import type { MeetingType } from '@/shared/types/enums/meetings'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { MeetingScopePicker } from '@/features/meetings/ui/components/meeting-scopes-picker'
import { Modal } from '@/shared/components/dialogs/modals/base-modal'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { meetingTypes } from '@/shared/constants/enums'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

interface CreateMeetingModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  customerId: string
  customerName: string
}

export function CreateMeetingModal({ isOpen, onClose, onSuccess, customerId, customerName }: CreateMeetingModalProps) {
  const trpc = useTRPC()

  const [type, setType] = useState<MeetingType | null>(null)
  const [scheduledFor, setScheduledFor] = useState<Date | undefined>(undefined)
  const [scopes, setScopes] = useState<MeetingScopes>([])

  const createMeeting = useMutation(
    trpc.meetingsRouter.create.mutationOptions({
      onSuccess: () => {
        toast.success('Meeting created!')
        onSuccess?.()
        resetAndClose()
      },
      onError: err => toast.error(err.message),
    }),
  )

  function resetAndClose() {
    setType(null)
    setScheduledFor(undefined)
    setScopes([])
    onClose()
  }

  function handleSubmit() {
    if (!type) {
      return
    }

    createMeeting.mutate({
      customerId,
      type,
      scheduledFor: scheduledFor?.toISOString(),
      meetingScopesJSON: scopes.length > 0 ? scopes : undefined,
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      close={resetAndClose}
      title={`Schedule Meeting — ${customerName}`}
    >
      <div className="space-y-5 w-full">
        {/* Meeting Type — pill radio */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Meeting Type</Label>
          <div className="flex gap-2">
            {meetingTypes.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
                  type === t
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-input hover:bg-accent',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Date & Time — optional */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Date & Time
            <span className="ml-1 text-muted-foreground font-normal">(optional)</span>
          </Label>
          <DateTimePicker
            value={scheduledFor}
            onChange={setScheduledFor}
            placeholder="Select date & time"
            className="w-full justify-start border border-input bg-background px-3 py-2 h-9 text-sm"
          />
        </div>

        {/* Trades & Scopes — optional */}
        <MeetingScopePicker value={scopes} onChange={setScopes} />

        {/* Submit */}
        <Button
          className="w-full"
          disabled={!type || createMeeting.isPending}
          onClick={handleSubmit}
        >
          {createMeeting.isPending ? 'Creating…' : 'Create Meeting'}
        </Button>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Run lint + build**

```bash
pnpm lint && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add src/features/meetings/ui/components/create-meeting-modal.tsx
git commit -m "feat(meetings): add CreateMeetingModal with type, datetime, and scopes"
```

---

## Task 7: Update Kanban Card + Pipeline View (Modal Integration)

**Files:**
- Modify: `src/features/customer-pipelines/ui/components/customer-kanban-card.tsx`
- Modify: `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx`

- [ ] **Step 1: Add "Schedule Meeting" button to kanban card**

In `src/features/customer-pipelines/ui/components/customer-kanban-card.tsx`, add:

1. New prop: `onCreateMeeting?: (customerId: string) => void`
2. Import `Button` from shadcn
3. After the meta row (the `<div className="flex items-center gap-2 text-xs...">` block), add conditional button:

```tsx
{item.stage === 'needs_confirmation' && onCreateMeeting && (
  <Button
    size="sm"
    className="w-full mt-1"
    onClick={(e) => {
      e.stopPropagation()
      onCreateMeeting(item.id)
    }}
  >
    + Schedule Meeting
  </Button>
)}
```

Add `onCreateMeeting` to the Props interface and destructure it.

- [ ] **Step 2: Update pipeline view — add modal state, intercept drag, pass `onCreateMeeting` to card**

In `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx`:

**Add imports:**
```ts
import { CreateMeetingModal } from '@/features/meetings/ui/components/create-meeting-modal'
```

**Add state inside `CustomerPipelineView`:**
```ts
const [createMeetingForCustomer, setCreateMeetingForCustomer] = useState<{ id: string, name: string } | null>(null)
```

**Update `handleMoveItem` to intercept `needs_confirmation → meeting_scheduled`:**
```ts
function handleMoveItem(itemId: string, fromStage: string, toStage: string) {
  // Intercept: needs_confirmation → meeting_scheduled opens modal instead
  if (fromStage === 'needs_confirmation' && toStage === 'meeting_scheduled') {
    const item = pipelineQuery.data?.find(i => i.id === itemId)
    if (item) {
      setCreateMeetingForCustomer({ id: item.id, name: item.name })
    }
    return
  }

  moveMutation.mutate({
    customerId: itemId,
    fromStage,
    toStage,
    pipeline,
  })
}
```

**Add `handleCreateMeeting` callback:**
```ts
const handleCreateMeeting = useCallback((customerId: string) => {
  const item = pipelineQuery.data?.find(i => i.id === customerId)
  if (item) {
    setCreateMeetingForCustomer({ id: item.id, name: item.name })
  }
}, [pipelineQuery.data])
```

**Update `renderCard` to pass `onCreateMeeting`:**
```ts
const renderCard = useCallback(
  (item: CustomerPipelineItem, _href: string, isDragOverlay?: boolean) => (
    <CustomerKanbanCard
      item={item}
      currentPipeline={pipeline}
      isDragOverlay={isDragOverlay}
      canManagePipeline={canManagePipeline}
      onViewProfile={handleViewProfile}
      onMoveToPipeline={handleMoveToPipeline}
      onCreateMeeting={handleCreateMeeting}
    />
  ),
  [handleViewProfile, handleMoveToPipeline, handleCreateMeeting, pipeline, canManagePipeline],
)
```

**Add modal to the JSX, just before the closing `</motion.div>`:**
```tsx
{createMeetingForCustomer && (
  <CreateMeetingModal
    isOpen={!!createMeetingForCustomer}
    onClose={() => setCreateMeetingForCustomer(null)}
    onSuccess={() => pipelineQuery.refetch()}
    customerId={createMeetingForCustomer.id}
    customerName={createMeetingForCustomer.name}
  />
)}
```

- [ ] **Step 3: Run lint + build**

```bash
pnpm lint && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add src/features/customer-pipelines/ui/components/customer-kanban-card.tsx src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx
git commit -m "feat(pipeline): wire CreateMeetingModal to kanban card + drag intercept for needs_confirmation"
```

---

## Task 8: Dashboard Cleanup

**Files:**
- Modify: `src/features/agent-dashboard/constants/dashboard-steps.ts`
- Modify: `src/features/agent-dashboard/constants/sidebar-items.ts`
- Modify: `src/features/agent-dashboard/ui/views/dashboard-hub.tsx`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-sidebar.tsx`
- Modify: `src/features/meetings/ui/views/index.ts`
- Delete: `src/features/meetings/ui/views/create-meeting-view.tsx`
- Delete: `src/features/agent-dashboard/ui/components/create-picker.tsx`

- [ ] **Step 1: Remove `action-center` and `create-meeting` from dashboard steps**

In `src/features/agent-dashboard/constants/dashboard-steps.ts`:

```ts
export const dashboardSteps = [
  'customer-pipelines',
  'meetings',
  'edit-meeting',
  'proposals',
  'create-proposal',
  'edit-proposal',
  'showroom',
  'create-project',
  'edit-project',
] as const
```

- [ ] **Step 2: Remove `action-center` from sidebar items**

In `src/features/agent-dashboard/constants/sidebar-items.ts`:

```ts
import type { DashboardStep } from '@/features/agent-dashboard/types'

import { CalendarIcon, FileTextIcon, GitBranchIcon, ImageIcon } from 'lucide-react'

interface SidebarItem {
  step: DashboardStep
  icon: typeof GitBranchIcon
  label: string
  enabled: boolean
}

export const dashboardSidebarItems: readonly SidebarItem[] = [
  { step: 'customer-pipelines', icon: GitBranchIcon, label: 'Pipeline', enabled: true },
  { step: 'meetings', icon: CalendarIcon, label: 'Meetings', enabled: true },
  { step: 'proposals', icon: FileTextIcon, label: 'Proposals', enabled: true },
  { step: 'showroom', icon: ImageIcon, label: 'Showroom', enabled: true },
]
```

Note: `ZapIcon` removed from imports since the action-center sidebar item is gone.

- [ ] **Step 3: Update `DashboardHub` — remove `ActionCenterView` and `CreateMeetingView` blocks**

In `src/features/agent-dashboard/ui/views/dashboard-hub.tsx`:

Remove these imports:
```ts
import { ActionCenterView } from '@/features/agent-dashboard/ui/views/action-center-view'
import { CreateMeetingView, EditMeetingSetupView, MeetingsView } from '@/features/meetings/ui/views'
```

Replace with:
```ts
import { EditMeetingSetupView, MeetingsView } from '@/features/meetings/ui/views'
```

Remove these AnimatePresence blocks from the JSX:
```tsx
<AnimatePresence>
  {step === 'action-center' && (
    <ActionCenterView key="action-center" />
  )}
</AnimatePresence>
<AnimatePresence>
  {step === 'create-meeting' && (
    <CreateMeetingView key="create-meeting" />
  )}
</AnimatePresence>
```

Note: TypeScript will enforce this — `'action-center'` and `'create-meeting'` no longer exist in the `DashboardStep` type.

- [ ] **Step 4: Remove `CreatePicker` from `DashboardSidebar`**

In `src/features/agent-dashboard/ui/components/dashboard-sidebar.tsx`:

Remove the import:
```ts
import { CreatePicker } from '@/features/agent-dashboard/ui/components/create-picker'
```

Remove from the JSX:
```tsx
<CreatePicker />
```

- [ ] **Step 5: Remove `CreateMeetingView` export from meetings views barrel**

In `src/features/meetings/ui/views/index.ts`:

```ts
export { EditMeetingSetupView } from './edit-meeting-setup-view'
export { MeetingsView } from './meetings-view'
```

- [ ] **Step 6: Clean up `meetings-dashboard.tsx` — remove `CreateMeetingView`**

In `src/features/meetings/ui/views/meetings-dashboard.tsx`:

Remove this import:
```ts
import { CreateMeetingView } from '@/features/meetings/ui/views/create-meeting-view'
```

Remove this AnimatePresence block:
```tsx
<AnimatePresence>
  {step === 'create-meeting' && (
    <CreateMeetingView key="create-meeting" />
  )}
</AnimatePresence>
```

- [ ] **Step 7: Remove `create-meeting` from meetings URL parser**

In `src/features/meetings/lib/url-parsers.ts`, update the step parser:

Replace:
```ts
export const meetingsDashboardStepParser = parseAsStringLiteral(['past-meetings', 'create-meeting', 'edit-meeting'] as const)
  .withDefault('past-meetings')
  .withOptions({ clearOnDefault: false })
```
With:
```ts
export const meetingsDashboardStepParser = parseAsStringLiteral(['past-meetings', 'edit-meeting'] as const)
  .withDefault('past-meetings')
  .withOptions({ clearOnDefault: false })
```

- [ ] **Step 8: Remove "New Meeting" button from meetings sidebar**

In `src/features/meetings/ui/components/meetings-sidebar.tsx`, remove the button that navigates to `create-meeting`:

Remove (around lines 23-31):
```tsx
      <Button
        data-active={step === 'create-meeting'}
        size="icon"
        variant={step === 'create-meeting' ? 'default' : 'outline'}
        className="data-[active=true]:bg-primary/80 lg:data-[active=true]:h-20"
        onClick={() => setStep('create-meeting')}
      >
        <PlusIcon size={20} />
      </Button>
```

Also remove `PlusIcon` from the lucide-react import if it's no longer used.

- [ ] **Step 9: Delete obsolete files**

```bash
rm src/features/meetings/ui/views/create-meeting-view.tsx
rm src/features/agent-dashboard/ui/components/create-picker.tsx
```

- [ ] **Step 10: Run lint + build**

```bash
pnpm lint && pnpm build
```

Expected: Build succeeds. TypeScript catches any remaining stale references to removed steps.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "cleanup(dashboard): remove action-center step, CreatePicker, CreateMeetingView; simplify sidebar"
```

---

## Task 9: Create ActionCenterSheet + Add to Pipeline View

**Files:**
- Create: `src/features/agent-dashboard/ui/components/action-center-sheet.tsx`
- Modify: `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx`

- [ ] **Step 1: Create `action-center-sheet.tsx`**

Create `src/features/agent-dashboard/ui/components/action-center-sheet.tsx`:

```tsx
'use client'

import { ActionCenterView } from '@/features/agent-dashboard/ui/views/action-center-view'
import { BaseSheet } from '@/shared/components/dialogs/sheets/base-sheet'

interface ActionCenterSheetProps {
  isOpen: boolean
  onClose: () => void
}

export function ActionCenterSheet({ isOpen, onClose }: ActionCenterSheetProps) {
  return (
    <BaseSheet isOpen={isOpen} close={onClose} title="Action Center">
      <ActionCenterView />
    </BaseSheet>
  )
}
```

- [ ] **Step 2: Add ActionCenterSheet button to pipeline view header**

In `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx`:

Add imports:
```ts
import { ZapIcon } from 'lucide-react'
import { ActionCenterSheet } from '@/features/agent-dashboard/ui/components/action-center-sheet'
import { Button } from '@/shared/components/ui/button'
```

Add state:
```ts
const [isActionCenterOpen, setIsActionCenterOpen] = useState(false)
```

Add the ZapIcon button in the header, before the pipeline select:
```tsx
<div className="flex items-center gap-2">
  <Button
    variant="outline"
    size="icon"
    onClick={() => setIsActionCenterOpen(true)}
  >
    <ZapIcon size={16} />
  </Button>
  {canManagePipeline && <PipelineSelect value={pipeline} onChange={setPipeline} />}
</div>
```

Add the sheet component before the closing `</motion.div>`:
```tsx
<ActionCenterSheet
  isOpen={isActionCenterOpen}
  onClose={() => setIsActionCenterOpen(false)}
/>
```

- [ ] **Step 3: Run lint + build**

```bash
pnpm lint && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add src/features/agent-dashboard/ui/components/action-center-sheet.tsx src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx
git commit -m "feat(pipeline): add ActionCenterSheet with ZapIcon button in pipeline header"
```

---

## Task 10: Fix ActionQueue Orphan Query

**Files:**
- Modify: `src/features/agent-dashboard/dal/server/get-action-queue.ts`

- [ ] **Step 1: Update orphan meetings query to join customers and use COALESCE**

In `src/features/agent-dashboard/dal/server/get-action-queue.ts`, replace the orphan meetings query (around lines 140-153):

Replace:
```ts
  const orphanMeetings = await db
    .select({
      id: meetings.id,
      contactName: meetings.contactName,
      program: meetings.program,
      createdAt: meetings.createdAt,
    })
    .from(meetings)
    .where(and(
      isOmni ? undefined : eq(meetings.ownerId, userId),
      eq(meetings.status, 'completed'),
    ))
    .orderBy(desc(meetings.createdAt))
```

With:
```ts
  const orphanMeetings = await db
    .select({
      id: meetings.id,
      customerName: sql<string>`COALESCE(${customers.name}, ${meetings.contactName}, 'Unknown')`.as('customer_name'),
      program: meetings.program,
      createdAt: meetings.createdAt,
    })
    .from(meetings)
    .leftJoin(customers, eq(customers.id, meetings.customerId))
    .where(and(
      isOmni ? undefined : eq(meetings.ownerId, userId),
      eq(meetings.status, 'completed'),
    ))
    .orderBy(desc(meetings.createdAt))
```

- [ ] **Step 2: Update the mapping block to use `m.customerName`**

In the mapping block (around line 186-203), replace:
```ts
    customerName: m.contactName ?? 'Unknown',
```
With:
```ts
    customerName: m.customerName,
```

- [ ] **Step 3: Run lint + build**

```bash
pnpm lint && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add src/features/agent-dashboard/dal/server/get-action-queue.ts
git commit -m "fix(action-queue): join customers table, use COALESCE for orphan meeting names"
```

---

## Task 11: Proposal Snapshot of Meeting Scopes

**Files:**
- Modify: `src/trpc/routers/proposals.router.tsx`

**Spec reference:** Section 6 — When `createProposal` is called with a `meetingId`, fetch `meetingScopesJSON` from that meeting and inject it as the initial `projectJSON.sow`.

- [ ] **Step 1: Update `createProposal` procedure to snapshot meeting scopes**

In `src/trpc/routers/proposals.router.tsx`, inside the `createProposal` mutation (around line 64-80), after the `meetingId` check and before `createProposal(input)`, add logic to fetch meeting scopes and inject them into the proposal input:

```ts
  createProposal: agentProcedure
    .input(insertProposalSchema.strict())
    .mutation(async ({ input }) => {
      try {
        if (!input.meetingId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'A meetingId is required to create a proposal',
          })
        }

        // Snapshot meeting scopes into proposal SOW
        const [meeting] = await db
          .select({ meetingScopesJSON: meetings.meetingScopesJSON })
          .from(meetings)
          .where(eq(meetings.id, input.meetingId))

        if (meeting?.meetingScopesJSON && meeting.meetingScopesJSON.length > 0) {
          const existingSow = (input.projectJSON as Record<string, unknown>)?.sow
          if (!existingSow) {
            const sowFromScopes = meeting.meetingScopesJSON.map(entry => ({
              trade: entry.trade,
              scopes: entry.scopes,
            }))
            input = {
              ...input,
              projectJSON: {
                ...(input.projectJSON as Record<string, unknown>),
                data: {
                  ...((input.projectJSON as Record<string, unknown>)?.data as Record<string, unknown> ?? {}),
                  sow: sowFromScopes,
                },
              },
            }
          }
        }

        const proposal = await createProposal(input)
```

**Note:** The exact shape of `projectJSON.data.sow` depends on the proposal entity schema. Verify the structure by reading `src/shared/entities/proposals/schemas.ts` — the `projectSectionSchema` defines the SOW shape. The snapshot only pre-fills trade + scopes; SOW content fields (`contentJSON`, `html`, `title`, `price`) are left empty for the agent to fill in during the proposal flow.

Add import at top of file:
```ts
import { meetings } from '@/shared/db/schema/meetings'
```

- [ ] **Step 2: Run lint + build**

```bash
pnpm lint && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add src/trpc/routers/proposals.router.tsx
git commit -m "feat(proposals): snapshot meetingScopesJSON from meeting into proposal SOW on create"
```

---

## Task 12: Meeting Intake Scopes Panel

**Files:**
- Modify: `src/features/meetings/ui/views/meeting-intake-view.tsx`
- Modify: `src/features/meetings/ui/views/meeting-flow.tsx`

**Spec reference:** Section 5 — `MeetingScopePicker` is embedded as a persistent header section in `MeetingIntakeView`, always visible above the step content.

- [ ] **Step 1: Add `onScopeChange` prop and `MeetingScopePicker` to `MeetingIntakeView`**

In `src/features/meetings/ui/views/meeting-intake-view.tsx`:

Add import:
```ts
import type { MeetingScopes } from '@/shared/entities/meetings/schemas'
import { MeetingScopePicker } from '@/features/meetings/ui/components/meeting-scopes-picker'
```

Update the props interface:
```ts
interface MeetingIntakeViewProps {
  currentStep: number
  customer: Customer | null
  meeting: Meeting
  onCompleteIntake: () => void
  onFieldSave: (field: CollectionField, value: string | number | boolean) => void
  onStepChange: (step: number) => void
  onScopeChange: (scopes: MeetingScopes) => void
}
```

Add `onScopeChange` to the destructured props.

Add the `MeetingScopePicker` section in the JSX, between the `StepProgress` bar and the step content:

```tsx
{/* Persistent scopes panel — always visible */}
<div className="px-1">
  <MeetingScopePicker
    value={meeting.meetingScopesJSON ?? []}
    onChange={onScopeChange}
  />
</div>
<Separator />
```

- [ ] **Step 2: Wire `onScopeChange` in `MeetingFlowView`**

In `src/features/meetings/ui/views/meeting-flow.tsx`, find where `MeetingIntakeView` is rendered and add the `onScopeChange` prop:

```tsx
<MeetingIntakeView
  currentStep={...}
  customer={...}
  meeting={...}
  onCompleteIntake={...}
  onFieldSave={...}
  onStepChange={...}
  onScopeChange={(scopes) => {
    updateMeeting.mutate({ id: meetingId, meetingScopesJSON: scopes })
  }}
/>
```

The `updateMeeting` mutation is already wired in `MeetingFlowView` (line 48-57).

- [ ] **Step 3: Run lint + build**

```bash
pnpm lint && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add src/features/meetings/ui/views/meeting-intake-view.tsx src/features/meetings/ui/views/meeting-flow.tsx
git commit -m "feat(meetings): add persistent MeetingScopePicker to meeting intake view"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Run full lint + build**

```bash
pnpm lint && pnpm build
```

Expected: Clean build with no errors.

- [ ] **Step 2: Start dev server and manually verify**

```bash
pnpm dev
```

Verify:
1. Pipeline loads — `needs_confirmation` column appears as the leftmost column
2. Customers without meetings show in `needs_confirmation`
3. "Schedule Meeting" button appears on `needs_confirmation` cards
4. Clicking the button opens `CreateMeetingModal`
5. Dragging from `needs_confirmation` to `meeting_scheduled` opens the modal
6. Creating a meeting moves the customer to `meeting_scheduled` (if `scheduledFor` is set)
7. ActionCenter is accessible via ZapIcon in pipeline header
8. Dashboard sidebar no longer has Actions or CreatePicker

- [ ] **Step 3: Update GitHub issue labels**

```bash
gh issue edit 2 --repo OlisDevSpot/tri-pros-website --remove-label "claude:blocked" --add-label "claude:in-progress"
```
