# Meetings Complete Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-mode meeting flow (intake + program) with a single 7-step customer journey, backed by a rebuilt schema and lean program model.

**Architecture:** Full rebuild of the meetings data layer (new JSONB columns, new pgEnums, entity schemas) followed by a new flow UI. The customer pipeline feature must be updated to reference the new `meetingOutcome` column instead of the removed `status` column. Programs become lean incentive packages with condensed presentations. Portfolio integration pulls real projects from the showroom database.

**Tech Stack:** Next.js 15, React, tRPC, Drizzle ORM (PostgreSQL/Neon), Zod, TanStack Query, Tailwind v4, shadcn/ui, motion/react, nuqs (URL state), lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-03-25-meetings-overhaul-design.md`

**Quality gates:** `pnpm lint` + `pnpm build` (no test suite configured)

---

## File Map

### Files to Create

```
src/shared/entities/meetings/schemas.ts              — REWRITE (new meetingContextSchema + meetingFlowStateSchema)
src/features/meetings/types/index.ts                 — REWRITE (new type definitions)
src/features/meetings/constants/programs.ts           — REWRITE (lean program model)
src/features/meetings/constants/step-config.ts        — NEW (7-step definitions)
src/features/meetings/constants/energy-trades.ts      — NEW (energy-efficient trade classification)
src/features/meetings/lib/qualify-programs.ts         — NEW (program qualification logic)
src/features/meetings/lib/build-proposal-defaults.ts  — NEW (meeting → proposal data transfer)
src/features/meetings/ui/views/meeting-flow.tsx       — REWRITE (single 7-step flow shell)
src/features/meetings/ui/components/context-panel.tsx             — NEW
src/features/meetings/ui/components/context-panel-trigger.tsx     — NEW
src/features/meetings/ui/components/context-panel-section.tsx     — NEW
src/features/meetings/ui/components/context-panel-field.tsx       — NEW
src/features/meetings/ui/components/step-nav.tsx                  — NEW (replaces step-progress)
src/features/meetings/ui/components/steps/who-we-are-step.tsx     — NEW (Step 1)
src/features/meetings/ui/components/steps/specialties-step.tsx    — NEW (Step 2)
src/features/meetings/ui/components/steps/trade-card.tsx          — NEW (Step 2 child)
src/features/meetings/ui/components/steps/trade-detail.tsx        — NEW (Step 2 expanded)
src/features/meetings/ui/components/steps/portfolio-step.tsx      — NEW (Step 3)
src/features/meetings/ui/components/steps/portfolio-card.tsx      — NEW (Step 3 child)
src/features/meetings/ui/components/steps/program-step.tsx        — NEW (Step 4)
src/features/meetings/ui/components/steps/program-card.tsx        — NEW (Step 4 child — replaces old)
src/features/meetings/ui/components/steps/program-presentation.tsx — NEW (Step 4 expanded)
src/features/meetings/ui/components/steps/deal-structure-step.tsx — NEW (Step 5)
src/features/meetings/ui/components/steps/closing-step.tsx        — NEW (Step 6)
src/features/meetings/ui/components/steps/closing-scope-card.tsx  — NEW (Step 6 child)
src/features/meetings/ui/components/steps/create-proposal-step.tsx — NEW (Step 7)
```

### Files to Modify

```
src/shared/constants/enums/meetings.ts          — Add new enums (meetingOutcomes, observation enums, energyEfficientTradeAccessors)
src/shared/types/enums/meetings.ts              — Add new type exports
src/shared/db/schema/meta.ts                    — Replace meetingStatusEnum with meetingTypeEnum + meetingOutcomeEnum
src/shared/db/schema/meetings.ts                — Full column rebuild
src/shared/types/jsonb.ts                       — Update JsonbSection union + JsonbSectionMap
src/trpc/routers/meetings.router.ts             — Update procedures for new schema + add portfolio query
src/features/meetings/lib/get-jsonb-section.ts  — Update to handle new JSONB keys
src/features/meetings/lib/to-calendar-event.ts  — Update for meetingOutcome
src/features/meetings/hooks/use-meeting-actions.ts — Update for meetingOutcome
src/features/meetings/constants/query-parsers.ts — Remove mode parser, keep step parser
src/features/meetings/constants/status-colors.ts — Update for meetingOutcome values
src/features/meetings/constants/table-filter-config.ts — Update filters
src/features/meetings/ui/components/table/columns.tsx — Update for meetingOutcome
src/features/meetings/ui/components/create-meeting-form.tsx — Update for new schema
src/features/meetings/ui/components/create-meeting-modal.tsx — Update for new schema
src/features/meetings/ui/views/meetings-view.tsx — Update imports
src/features/meetings/ui/views/meetings-dashboard.tsx — Update imports
src/features/meetings/ui/views/past-meetings-view.tsx — Update for meetingOutcome
src/features/meetings/ui/views/index.ts — Update exports

# Customer pipeline fixes (status → meetingOutcome):
src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts — Replace meetings.status refs
src/features/customer-pipelines/dal/server/get-customer-profile.ts — Replace meetings.status ref
src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts — Replace meetings.status ref
src/features/customer-pipelines/lib/build-timeline-events.ts — Replace meeting.status refs
src/features/customer-pipelines/ui/components/meeting-entity-card.tsx — Replace meeting.status refs
src/features/customer-pipelines/ui/components/create-proposal-popover.tsx — Replace meeting.status ref
src/features/agent-dashboard/dal/server/get-action-queue.ts — Replace meetings.status ref
```

### Files to Delete

```
src/features/meetings/constants/step-content.ts
src/features/meetings/constants/framing-types.ts
src/features/meetings/constants/incentives.ts
src/features/meetings/constants/program-accent-map.ts
src/features/meetings/constants/trigger-config.ts
src/features/meetings/schemas/base-meeting-form-schema.ts
src/features/meetings/schemas/tpr-monthly-special-schema.ts
src/features/meetings/ui/components/steps/package-step.tsx
src/features/meetings/ui/components/steps/financing-step.tsx
src/features/meetings/ui/components/steps/stories-step.tsx
src/features/meetings/ui/components/steps/close-step.tsx
src/features/meetings/ui/components/program-quick-pick.tsx
src/features/meetings/ui/components/program-card.tsx
src/features/meetings/ui/components/buy-trigger-bar.tsx
src/features/meetings/ui/components/case-study-panel.tsx
src/features/meetings/ui/components/case-study-content.tsx
src/features/meetings/ui/components/data-collection-panel.tsx
src/features/meetings/ui/components/step-data-panel.tsx
src/features/meetings/ui/components/step-data-content.tsx
src/features/meetings/ui/components/step-progress.tsx
src/features/meetings/ui/views/meeting-intake-view.tsx
src/features/meetings/ui/views/edit-meeting-setup-view.tsx
```

---

## Task 1: Schema Foundation — Enums & Entity Schemas

**Purpose:** Build the new data layer from the bottom up. Enums → entity Zod schemas → Drizzle schema → type exports. Everything downstream depends on this task completing cleanly.

**Files:**
- Modify: `src/shared/constants/enums/meetings.ts`
- Modify: `src/shared/types/enums/meetings.ts`
- Rewrite: `src/shared/entities/meetings/schemas.ts`
- Modify: `src/shared/types/jsonb.ts`

### Steps

- [ ] **Step 1: Add new const arrays to meetings enums**

Open `src/shared/constants/enums/meetings.ts`. Add these new arrays after the existing ones (keep all existing arrays — other features still reference them):

```typescript
// Meeting outcomes (replaces meetingStatuses for the meeting flow)
export const meetingOutcomes = [
  'in_progress',
  'proposal_created',
  'follow_up_needed',
  'not_interested',
  'no_show',
] as const

// Agent observation enums (context panel)
export const observedBudgetComforts = ['comfortable', 'hesitant', 'resistant'] as const
export const spouseDynamics = ['aligned', 'one-skeptical', 'not-present', 'n-a'] as const
export const customerDemeanors = ['engaged', 'guarded', 'enthusiastic', 'anxious'] as const

// Energy-efficient trade classification (for program qualification)
export const energyEfficientTradeAccessors = ['insulation', 'hvac', 'windows', 'solar'] as const
```

- [ ] **Step 2: Add new type exports to meetings types**

Open `src/shared/types/enums/meetings.ts`. Add after the existing type imports and exports:

```typescript
import type {
  // ... existing imports ...
  meetingOutcomes,
  observedBudgetComforts,
  spouseDynamics,
  customerDemeanors,
  energyEfficientTradeAccessors,
} from '@/shared/constants/enums/meetings'

// ... existing type exports ...

export type MeetingOutcome = (typeof meetingOutcomes)[number]
export type ObservedBudgetComfort = (typeof observedBudgetComforts)[number]
export type SpouseDynamic = (typeof spouseDynamics)[number]
export type CustomerDemeanor = (typeof customerDemeanors)[number]
export type EnergyEfficientTrade = (typeof energyEfficientTradeAccessors)[number]
```

- [ ] **Step 3: Rewrite the meetings entity schemas**

Replace the entire contents of `src/shared/entities/meetings/schemas.ts` with:

```typescript
import z from 'zod'
import {
  customerDemeanors,
  meetingDecisionMakersPresentOptions,
  observedBudgetComforts,
  spouseDynamics,
} from '@/shared/constants/enums'

// ── Context Panel Schema (replaces situationProfileSchema) ──────────────────

export const meetingContextSchema = z.object({
  // Pre-meeting fields
  decisionMakersPresent: z.enum(meetingDecisionMakersPresentOptions),
  preKnownPainPoints: z.array(z.string()),
  preKnownTrades: z.array(z.string()),
  preMeetingNotes: z.string(),
  // During-meeting observations
  observedUrgency: z.number().int().min(1).max(10),
  observedBudgetComfort: z.enum(observedBudgetComforts),
  spouseDynamic: z.enum(spouseDynamics),
  customerDemeanor: z.enum(customerDemeanors),
}).partial()

export type MeetingContext = z.infer<typeof meetingContextSchema>

// ── Flow State Schema (replaces programDataSchema + meetingScopesSchema) ─────

export const tradeSelectionSchema = z.object({
  tradeId: z.string(),
  tradeName: z.string(),
  selectedScopes: z.array(z.object({ id: z.string(), label: z.string() })),
  painPoints: z.array(z.string()),
  notes: z.string().optional(),
})

export type TradeSelection = z.infer<typeof tradeSelectionSchema>

export const dealStructureIncentiveSchema = z.object({
  label: z.string(),
  amount: z.number(),
  source: z.string(),
})

export type DealStructureIncentive = z.infer<typeof dealStructureIncentiveSchema>

export const dealStructureSchema = z.object({
  mode: z.enum(['finance', 'cash']),
  startingTcp: z.number(),
  incentives: z.array(dealStructureIncentiveSchema),
  finalTcp: z.number(),
  // Finance-specific
  financeTermMonths: z.number().optional(),
  apr: z.number().optional(),
  monthlyPayment: z.number().optional(),
  // Cash-specific
  depositAmount: z.number().optional(),
  depositPercent: z.number().optional(),
}).partial()

export type DealStructure = z.infer<typeof dealStructureSchema>

export const closingAdjustmentsSchema = z.object({
  scopeChanges: z.array(z.string()),
  finalNotes: z.string(),
}).partial()

export type ClosingAdjustments = z.infer<typeof closingAdjustmentsSchema>

export const meetingFlowStateSchema = z.object({
  currentStep: z.number().int().min(1).max(7),
  // Step 2: Trade & Pain selections
  tradeSelections: z.array(tradeSelectionSchema),
  // Step 4: Program
  selectedProgram: z.string().nullable(),
  programQualified: z.boolean(),
  // Step 5: Deal Structure
  dealStructure: dealStructureSchema,
  // Step 6: Closing adjustments
  closingAdjustments: closingAdjustmentsSchema,
}).partial()

export type MeetingFlowState = z.infer<typeof meetingFlowStateSchema>
```

- [ ] **Step 4: Update the JsonbSection type**

Replace the entire contents of `src/shared/types/jsonb.ts` with:

```typescript
import type { CustomerProfile, FinancialProfile, PropertyProfile } from '@/shared/entities/customers/schemas'
import type { MeetingContext, MeetingFlowState } from '@/shared/entities/meetings/schemas'

export type JsonbSection
  = | 'customerProfileJSON'
    | 'financialProfileJSON'
    | 'propertyProfileJSON'
    | 'contextJSON'
    | 'flowStateJSON'

export interface JsonbSectionMap {
  customerProfileJSON: CustomerProfile
  financialProfileJSON: FinancialProfile
  propertyProfileJSON: PropertyProfile
  contextJSON: MeetingContext
  flowStateJSON: MeetingFlowState
}
```

- [ ] **Step 5: Run lint to verify**

Run: `pnpm lint`

Expected: May show errors in files that still import old schema names (`SituationProfile`, `ProgramData`, `situationProfileSchema`, `programDataSchema`). That's expected — those files are updated in later tasks. The new files themselves should have no lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/shared/constants/enums/meetings.ts src/shared/types/enums/meetings.ts src/shared/entities/meetings/schemas.ts src/shared/types/jsonb.ts
git commit -m "feat(meetings): add new enums, entity schemas, and JSONB types for meetings overhaul"
```

---

## Task 2: Drizzle Schema & pgEnum Updates

**Purpose:** Update the Drizzle table definition, pgEnums, and schema exports. This task makes the database layer match the new entity schemas.

**Files:**
- Modify: `src/shared/db/schema/meta.ts`
- Rewrite: `src/shared/db/schema/meetings.ts`

### Steps

- [ ] **Step 1: Update pgEnums in meta.ts**

In `src/shared/db/schema/meta.ts`, replace the meetings section:

```typescript
// MEETINGS — old:
// export const meetingStatusEnum = pgEnum('meeting_status', meetingStatuses)

// MEETINGS — new:
import {
  // ... add to existing imports from '@/shared/constants/enums':
  meetingOutcomes,
  meetingTypes,
} from '@/shared/constants/enums'

export const meetingTypeEnum = pgEnum('meeting_type', meetingTypes)
export const meetingOutcomeEnum = pgEnum('meeting_outcome', meetingOutcomes)
```

Remove `meetingStatuses` from the import list. Remove the old `meetingStatusEnum` export. Keep all other enums untouched.

- [ ] **Step 2: Rewrite the meetings Drizzle schema**

Replace the entire contents of `src/shared/db/schema/meetings.ts` with:

```typescript
import type z from 'zod'
import type {
  MeetingContext,
  MeetingFlowState,
} from '@/shared/entities/meetings/schemas'
import { relations } from 'drizzle-orm'
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import {
  meetingContextSchema,
  meetingFlowStateSchema,
} from '@/shared/entities/meetings/schemas'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { customers } from './customers'
import { meetingOutcomeEnum, meetingTypeEnum } from './meta'

export const meetings = pgTable('meetings', {
  id,
  ownerId: text('owner_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  meetingType: meetingTypeEnum('meeting_type').notNull().default('Fresh'),
  meetingOutcome: meetingOutcomeEnum('meeting_outcome').notNull().default('in_progress'),
  scheduledFor: timestamp('scheduled_for', { mode: 'string', withTimezone: true }),
  contextJSON: jsonb('context_json').$type<MeetingContext>(),
  flowStateJSON: jsonb('flow_state_json').$type<MeetingFlowState>(),
  agentNotes: text('agent_notes'),
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
  contextJSON: meetingContextSchema.nullable(),
  flowStateJSON: meetingFlowStateSchema.nullable(),
})
export type Meeting = z.infer<typeof selectMeetingSchema>

export const insertMeetingSchema = createInsertSchema(meetings, {
  contextJSON: meetingContextSchema.optional(),
  flowStateJSON: meetingFlowStateSchema.optional(),
}).omit({
  id: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertMeetingSchema = z.infer<typeof insertMeetingSchema>
```

- [ ] **Step 3: Push schema to database**

Run: `pnpm db:push`

This will prompt for destructive changes (dropping columns). Confirm — meeting records are expendable. The `customerId` FK column is preserved since it's in the new schema.

Expected: Schema push succeeds. The `meetings` table now has the new columns and lacks the old ones.

- [ ] **Step 4: Commit**

```bash
git add src/shared/db/schema/meta.ts src/shared/db/schema/meetings.ts
git commit -m "feat(meetings): rebuild Drizzle schema with new columns and pgEnums"
```

---

## Task 3: Fix Downstream References — Customer Pipelines & Dashboard

**Purpose:** Every file that referenced `meetings.status` (the old column) needs to reference `meetings.meetingOutcome` (the new column). Every file that imported `SituationProfile`, `ProgramData`, `situationProfileSchema`, `programDataSchema`, or `meetingScopesSchema` from the old entity schemas needs updating. This task fixes all broken imports so the app can compile.

**Files:**
- Modify: `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts`
- Modify: `src/features/customer-pipelines/dal/server/get-customer-profile.ts`
- Modify: `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts`
- Modify: `src/features/customer-pipelines/lib/build-timeline-events.ts`
- Modify: `src/features/customer-pipelines/ui/components/meeting-entity-card.tsx`
- Modify: `src/features/customer-pipelines/ui/components/create-proposal-popover.tsx`
- Modify: `src/features/agent-dashboard/dal/server/get-action-queue.ts`

### Steps

- [ ] **Step 1: Fix get-customer-pipeline-items.ts**

In `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts`, find the SQL expression on line 56:

```typescript
// OLD:
hasPastMeeting: sql<boolean>`bool_or(${meetings.scheduledFor} <= now() - interval '2 hours' OR (${meetings.scheduledFor} IS NULL AND ${meetings.status} IN ('completed', 'converted')))`.as('has_past'),
```

Replace with:

```typescript
// NEW:
hasPastMeeting: sql<boolean>`bool_or(${meetings.scheduledFor} <= now() - interval '2 hours' OR (${meetings.scheduledFor} IS NULL AND ${meetings.meetingOutcome} IN ('proposal_created', 'follow_up_needed', 'not_interested')))`.as('has_past'),
```

Mapping: `completed` → `follow_up_needed` or `not_interested`, `converted` → `proposal_created`. A past meeting is any meeting that has an outcome indicating it's done.

- [ ] **Step 2: Fix get-customer-profile.ts**

In `src/features/customer-pipelines/dal/server/get-customer-profile.ts`, find the select field:

```typescript
// OLD:
status: meetings.status,
```

Replace with:

```typescript
// NEW:
meetingOutcome: meetings.meetingOutcome,
```

Also update the corresponding type in `src/features/customer-pipelines/types/index.ts` if it references `status` — check the `CustomerProfileMeeting` type and update the field name from `status` to `meetingOutcome`.

- [ ] **Step 3: Fix move-customer-pipeline-item.ts**

In `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts`, find:

```typescript
// OLD:
eq(meetings.status, 'in_progress'),
```

Replace with:

```typescript
// NEW:
eq(meetings.meetingOutcome, 'in_progress'),
```

- [ ] **Step 4: Fix get-action-queue.ts**

In `src/features/agent-dashboard/dal/server/get-action-queue.ts`, find:

```typescript
// OLD:
eq(meetings.status, 'completed'),
```

Replace with:

```typescript
// NEW:
inArray(meetings.meetingOutcome, ['follow_up_needed', 'not_interested']),
```

Add `inArray` to the drizzle-orm import if not already there.

- [ ] **Step 5: Fix build-timeline-events.ts**

In `src/features/customer-pipelines/lib/build-timeline-events.ts`, find:

```typescript
// OLD:
if (meeting.status === 'completed' || meeting.status === 'converted') {
```

Replace with:

```typescript
// NEW:
if (meeting.meetingOutcome !== 'in_progress') {
```

- [ ] **Step 6: Fix meeting-entity-card.tsx**

In `src/features/customer-pipelines/ui/components/meeting-entity-card.tsx`, replace references to `meeting.status` with `meeting.meetingOutcome`. Update the Badge display:

```typescript
// OLD:
<Badge variant="outline" className={MEETING_LIST_STATUS_COLORS[meeting.status] ?? ''}>
  {meeting.status.replace('_', ' ')}
</Badge>

// NEW:
<Badge variant="outline" className={MEETING_LIST_STATUS_COLORS[meeting.meetingOutcome] ?? ''}>
  {meeting.meetingOutcome.replace(/_/g, ' ')}
</Badge>
```

- [ ] **Step 7: Fix create-proposal-popover.tsx**

In `src/features/customer-pipelines/ui/components/create-proposal-popover.tsx`, replace:

```typescript
// OLD:
return `${type} — ${program} — ${date} (${meeting.status})`

// NEW:
return `${type} — ${date} (${meeting.meetingOutcome.replace(/_/g, ' ')})`
```

Note: `program` is no longer a top-level column — remove it from the display string.

- [ ] **Step 8: Commit**

```bash
git add src/features/customer-pipelines/ src/features/agent-dashboard/
git commit -m "fix(customer-pipelines): update all references from meetings.status to meetings.meetingOutcome"
```

---

## Task 4: Fix Meetings Feature Internals

**Purpose:** Update all meetings feature files that reference old schema names, old JSONB keys, or old types. This gets the meetings feature itself compiling again (without the new flow UI yet).

**Files:**
- Modify: `src/trpc/routers/meetings.router.ts`
- Modify: `src/features/meetings/lib/get-jsonb-section.ts`
- Modify: `src/features/meetings/lib/to-calendar-event.ts`
- Modify: `src/features/meetings/hooks/use-meeting-actions.ts`
- Modify: `src/features/meetings/constants/query-parsers.ts`
- Modify: `src/features/meetings/constants/status-colors.ts`
- Modify: `src/features/meetings/constants/table-filter-config.ts`
- Modify: `src/features/meetings/ui/components/table/columns.tsx`
- Modify: `src/features/meetings/ui/components/create-meeting-form.tsx`
- Modify: `src/features/meetings/ui/components/create-meeting-modal.tsx`

### Steps

- [ ] **Step 1: Rewrite the meetings router**

Rewrite `src/trpc/routers/meetings.router.ts`. Key changes:

- `create` input: Replace `type: z.enum(meetingTypes)` with `meetingType: z.enum(meetingTypes)`. Remove `meetingScopesJSON`. Add optional `contextJSON` and `flowStateJSON`.
- `update` input: Use the new `insertMeetingSchema.partial()` (which now has `contextJSON`, `flowStateJSON`, `meetingType`, `meetingOutcome`, `agentNotes`).
- `getById`: Keep the join structure. Remove references to old columns in the select.
- `linkProposal`: Change `set({ status: 'converted' })` to `set({ meetingOutcome: 'proposal_created' })`.
- `duplicate`: Copy `contextJSON` instead of `situationProfileJSON`. Don't copy `flowStateJSON` (it's a new meeting).
- Add new procedure `getPortfolioForMeeting` — see Task 9 for full implementation.

Full router code: Read the current router carefully. The structure stays the same — just swap column names and input schemas. All 7 existing procedures (`getAll`, `create`, `update`, `getById`, `linkProposal`, `duplicate`, `delete`, `getInternalUsers`, `assignOwner`) keep their shape.

Key replacements throughout the file:
- `meetingScopesSchema` import → remove
- `meetingTypes` import → keep (used in create input)
- `meetings.status` → `meetings.meetingOutcome`
- `situationProfileJSON` → `contextJSON`
- `programDataJSON` → `flowStateJSON`
- `meetingScopesJSON` → remove (absorbed into flowStateJSON)
- `contactName` → remove from duplicate
- `program` → remove (now in flowStateJSON)

- [ ] **Step 2: Update get-jsonb-section.ts**

In `src/features/meetings/lib/get-jsonb-section.ts`, the function reads a JSONB section from either a meeting or customer record. Update the implementation to handle the new keys (`contextJSON`, `flowStateJSON`) instead of the old ones (`situationProfileJSON`, `programDataJSON`):

```typescript
import type { JsonbSection, JsonbSectionMap } from '@/shared/types/jsonb'

export function getJsonbSection<K extends JsonbSection>(
  source: Record<string, unknown> | null,
  jsonbKey: K,
): Partial<JsonbSectionMap[K]> {
  if (!source) {
    return {} as Partial<JsonbSectionMap[K]>
  }
  return (source[jsonbKey] ?? {}) as Partial<JsonbSectionMap[K]>
}
```

The function itself doesn't change — it's generic. But any caller that passes `'situationProfileJSON'` or `'programDataJSON'` will now get a type error because those are no longer in the `JsonbSection` union. Those callers are updated in later tasks (the new flow UI).

- [ ] **Step 3: Update to-calendar-event.ts**

In `src/features/meetings/lib/to-calendar-event.ts`, replace `meeting.status` with `meeting.meetingOutcome`. Update the `MeetingCalendarEvent` type reference if it uses `status`.

- [ ] **Step 4: Update use-meeting-actions.ts**

In `src/features/meetings/hooks/use-meeting-actions.ts`, replace any reference to `updateStatus` with `updateOutcome`. The mutation should update `meetingOutcome` instead of `status`:

```typescript
// OLD:
updateStatus: useMutation(...)  // set({ status: value })

// NEW:
updateOutcome: useMutation(...)  // set({ meetingOutcome: value })
```

- [ ] **Step 5: Update query-parsers.ts**

In `src/features/meetings/constants/query-parsers.ts`, remove the `modeParser` (no more intake/program modes). Keep `stepParser`:

```typescript
import { parseAsInteger } from 'nuqs'

export const stepParser = parseAsInteger.withDefault(1)
```

- [ ] **Step 6: Update status-colors.ts**

Replace the old status-to-color mapping with the new outcome values:

```typescript
export const MEETING_OUTCOME_COLORS: Record<string, string> = {
  in_progress: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  proposal_created: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  follow_up_needed: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  not_interested: 'border-red-500/30 bg-red-500/10 text-red-400',
  no_show: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400',
}
```

- [ ] **Step 7: Update table columns and filter config**

In `src/features/meetings/ui/components/table/columns.tsx`, replace references to `status` column with `meetingOutcome`. Update the cell renderer to use `MEETING_OUTCOME_COLORS`.

In `src/features/meetings/constants/table-filter-config.ts`, update the filter options from `meetingStatuses` to `meetingOutcomes`.

- [ ] **Step 8: Update create-meeting-form.tsx and create-meeting-modal.tsx**

These forms create new meetings. Update:
- Remove `type` field → add `meetingType` field (same options, different column name)
- Remove `meetingScopesJSON` from the create mutation input
- Remove `contactName` from the form
- Keep `customerId`, `scheduledFor`, `meetingType`

- [ ] **Step 9: Run lint + build**

Run: `pnpm lint && pnpm build`

Expected: There will be errors from files that still import deleted components (old step components, old views). Those files are deleted in Task 5. Focus on: the files touched in this task should have no errors.

- [ ] **Step 10: Commit**

```bash
git add src/trpc/routers/meetings.router.ts src/features/meetings/ src/shared/types/jsonb.ts
git commit -m "feat(meetings): update router, helpers, and constants for new schema"
```

---

## Task 5: Delete Old Files & Clean Up Imports

**Purpose:** Remove all files that belong to the old two-mode architecture. Fix any remaining imports that reference deleted files.

**Files to delete:** See "Files to Delete" section in the file map above.

### Steps

- [ ] **Step 1: Delete old step components**

```bash
rm src/features/meetings/ui/components/steps/package-step.tsx
rm src/features/meetings/ui/components/steps/financing-step.tsx
rm src/features/meetings/ui/components/steps/stories-step.tsx
rm src/features/meetings/ui/components/steps/close-step.tsx
```

- [ ] **Step 2: Delete old flow components**

```bash
rm src/features/meetings/ui/components/program-quick-pick.tsx
rm src/features/meetings/ui/components/program-card.tsx
rm src/features/meetings/ui/components/buy-trigger-bar.tsx
rm src/features/meetings/ui/components/case-study-panel.tsx
rm src/features/meetings/ui/components/case-study-content.tsx
rm src/features/meetings/ui/components/data-collection-panel.tsx
rm src/features/meetings/ui/components/step-data-panel.tsx
rm src/features/meetings/ui/components/step-data-content.tsx
rm src/features/meetings/ui/components/step-progress.tsx
```

- [ ] **Step 3: Delete old views**

```bash
rm src/features/meetings/ui/views/meeting-intake-view.tsx
rm src/features/meetings/ui/views/edit-meeting-setup-view.tsx
```

- [ ] **Step 4: Delete old constants and schemas**

```bash
rm src/features/meetings/constants/step-content.ts
rm src/features/meetings/constants/framing-types.ts
rm src/features/meetings/constants/incentives.ts
rm src/features/meetings/constants/program-accent-map.ts
rm src/features/meetings/constants/trigger-config.ts
rm src/features/meetings/schemas/base-meeting-form-schema.ts
rm src/features/meetings/schemas/tpr-monthly-special-schema.ts
```

- [ ] **Step 5: Update views/index.ts**

In `src/features/meetings/ui/views/index.ts`, remove the `EditMeetingSetupView` export if present. Ensure `MeetingsView` is still exported:

```typescript
export { MeetingsView } from './meetings-view'
```

- [ ] **Step 6: Fix any remaining broken imports**

Search for imports of deleted files and remove them. Key files to check:
- `meeting-flow.tsx` — This will have many broken imports. It will be fully rewritten in Task 8, so for now just stub it with a placeholder that renders "Meeting flow — rebuilding" so the app compiles.
- Any file importing from deleted constants or schemas.

Run: `pnpm lint` and fix import errors iteratively.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(meetings): delete old two-mode architecture files"
```

---

## Task 6: New Feature Types & Constants

**Purpose:** Define the new type system and constants for the 7-step flow, lean program model, and step configuration.

**Files:**
- Rewrite: `src/features/meetings/types/index.ts`
- Rewrite: `src/features/meetings/constants/programs.ts`
- Create: `src/features/meetings/constants/step-config.ts`
- Create: `src/features/meetings/constants/energy-trades.ts`

### Steps

- [ ] **Step 1: Rewrite feature types**

Replace the entire contents of `src/features/meetings/types/index.ts`:

```typescript
import type { CalendarEvent } from '@/shared/components/calendar/types'
import type { Customer } from '@/shared/db/schema'
import type { MeetingFlowState, TradeSelection } from '@/shared/entities/meetings/schemas'
import type { MeetingOutcome, MeetingType } from '@/shared/types/enums'

// ── Program Types ───────────────────────────────────────────────────────────

export interface ProgramIncentive {
  id: string
  label: string
  description: string
  valueDisplay: string
  valueType: 'fixed' | 'percentage' | 'credit'
  calculateDeduction: (tcp: number) => number
}

export interface ProgramPresentation {
  story: string
  history: string
  timeline: string
  faqs: { question: string; answer: string }[]
  keyStats: { label: string; value: string }[]
}

export interface QualificationContext {
  tradeSelections: TradeSelection[]
  customer: Customer | null
  meetingType: MeetingType
}

export interface QualificationResult {
  qualified: boolean
  reason: string
  matchedCriteria: string[]
  missedCriteria: string[]
}

export interface MeetingProgram {
  accessor: string
  name: string
  tagline: string
  accentColor: 'amber' | 'sky' | 'violet'
  qualify: (ctx: QualificationContext) => QualificationResult
  incentives: ProgramIncentive[]
  expiresLabel: string
  presentation: ProgramPresentation
}

// ── Step Types ──────────────────────────────────────────────────────────────

export type MeetingStepId =
  | 'who-we-are'
  | 'specialties'
  | 'portfolio'
  | 'program'
  | 'deal-structure'
  | 'closing'
  | 'create-proposal'

export interface MeetingStepConfig {
  id: MeetingStepId
  stepNumber: number
  title: string
  shortLabel: string
  isCustomerFacing: boolean
}

// ── Flow Context (passed to step components) ────────────────────────────────

export interface MeetingFlowContext {
  meetingId: string
  customerId: string | null
  customer: Customer | null
  flowState: MeetingFlowState | null
  onFlowStateChange: (patch: Partial<MeetingFlowState>) => void
  onCustomerProfileChange: (jsonbKey: string, patch: Record<string, unknown>) => void
}

// ── Calendar Event ──────────────────────────────────────────────────────────

export interface MeetingCalendarEvent extends CalendarEvent {
  meetingId: string
  meetingOutcome: MeetingOutcome
  meetingType: MeetingType
  customerName: string | null
  customerPhone: string | null
  customerAddress: string | null
  customerCity: string | null
  customerState: string | null
  customerZip: string | null
  createdAt: string
}
```

- [ ] **Step 2: Create step configuration**

Create `src/features/meetings/constants/step-config.ts`:

```typescript
import type { MeetingStepConfig } from '@/features/meetings/types'

export const MEETING_STEPS: MeetingStepConfig[] = [
  {
    id: 'who-we-are',
    stepNumber: 1,
    title: 'Navigating the Construction Industry',
    shortLabel: 'Who We Are',
    isCustomerFacing: true,
  },
  {
    id: 'specialties',
    stepNumber: 2,
    title: 'Which Specialties Matter to You',
    shortLabel: 'Specialties',
    isCustomerFacing: true,
  },
  {
    id: 'portfolio',
    stepNumber: 3,
    title: 'Past References & Projects',
    shortLabel: 'Portfolio',
    isCustomerFacing: true,
  },
  {
    id: 'program',
    stepNumber: 4,
    title: 'Picking the Right Path',
    shortLabel: 'Program',
    isCustomerFacing: true,
  },
  {
    id: 'deal-structure',
    stepNumber: 5,
    title: 'Deal Structure',
    shortLabel: 'Deal',
    isCustomerFacing: false,
  },
  {
    id: 'closing',
    stepNumber: 6,
    title: 'Closing Summary',
    shortLabel: 'Close',
    isCustomerFacing: true,
  },
  {
    id: 'create-proposal',
    stepNumber: 7,
    title: 'Create Proposal',
    shortLabel: 'Proposal',
    isCustomerFacing: false,
  },
]

export const TOTAL_STEPS = MEETING_STEPS.length
```

- [ ] **Step 3: Create energy trades constant**

Create `src/features/meetings/constants/energy-trades.ts`:

```typescript
import { energyEfficientTradeAccessors } from '@/shared/constants/enums'

export function isEnergyEfficientTrade(tradeId: string): boolean {
  return (energyEfficientTradeAccessors as readonly string[]).includes(tradeId)
}
```

- [ ] **Step 4: Rewrite programs.ts with lean program model**

Replace the entire contents of `src/features/meetings/constants/programs.ts`. Each program is now a lean incentive package with a condensed presentation. Full implementation:

```typescript
import type { MeetingProgram, QualificationContext, QualificationResult } from '@/features/meetings/types'
import { getCurrentMonth, getInstallSlotsLeft, getMonthEnd } from '@/features/meetings/lib/buy-triggers'
import { isEnergyEfficientTrade } from '@/features/meetings/constants/energy-trades'

function qualifyMonthlySpecial(): QualificationResult {
  return {
    qualified: true,
    reason: 'All customers qualify for the monthly priority program.',
    matchedCriteria: ['Active customer'],
    missedCriteria: [],
  }
}

function qualifyEnergySaver(ctx: QualificationContext): QualificationResult {
  const energyTrades = ctx.tradeSelections.filter(t => isEnergyEfficientTrade(t.tradeId))
  if (energyTrades.length === 0) {
    return {
      qualified: false,
      reason: 'Requires at least 1 energy-efficient trade (Insulation, HVAC, Windows, or Solar).',
      matchedCriteria: [],
      missedCriteria: ['Energy-efficient trade selected'],
    }
  }
  return {
    qualified: true,
    reason: `Qualified — ${energyTrades.length} energy-efficient trade${energyTrades.length > 1 ? 's' : ''} selected.`,
    matchedCriteria: energyTrades.map(t => t.tradeName),
    missedCriteria: [],
  }
}

function qualifyExistingCustomer(ctx: QualificationContext): QualificationResult {
  // TODO: Check customer's prior completed projects
  // For now, qualify based on meeting type
  if (ctx.meetingType === 'Rehash' || ctx.meetingType === 'Follow-up') {
    return {
      qualified: true,
      reason: 'Returning customer — eligible for loyalty benefits.',
      matchedCriteria: ['Returning customer'],
      missedCriteria: [],
    }
  }
  return {
    qualified: false,
    reason: 'Available for returning Tri Pros customers only.',
    matchedCriteria: [],
    missedCriteria: ['Prior completed project with TPR'],
  }
}

export const MEETING_PROGRAMS: MeetingProgram[] = [
  {
    accessor: 'tpr-monthly-special',
    name: `TPR ${getCurrentMonth()} Priority Program`,
    tagline: `Lock in ${getCurrentMonth()} pricing before ${getMonthEnd()}.`,
    accentColor: 'amber',
    qualify: qualifyMonthlySpecial,
    expiresLabel: getMonthEnd(),
    incentives: [
      {
        id: 'material-upgrade',
        label: 'Architectural Shingle Upgrade',
        description: 'Standard 3-tab shingles upgraded to premium architectural shingles — included at the same price.',
        valueDisplay: '$800 value',
        valueType: 'fixed',
        calculateDeduction: () => 800,
      },
      {
        id: 'warranty-extension',
        label: '5-Year Workmanship Warranty',
        description: 'Standard warranty extended from 3 years to 5 years on all workmanship.',
        valueDisplay: '$400 value',
        valueType: 'fixed',
        calculateDeduction: () => 400,
      },
      {
        id: 'attic-inspection',
        label: 'Free Attic Inspection',
        description: 'A licensed inspector walks your attic before installation — documenting ventilation, insulation levels, and any moisture or pest issues.',
        valueDisplay: '$200 value',
        valueType: 'fixed',
        calculateDeduction: () => 200,
      },
    ],
    presentation: {
      story: `Every few months, we negotiate a bulk materials contract with our SoCal suppliers. Right now, in ${getCurrentMonth()}, we have a contract in place — and we're passing those savings directly to families who schedule this month. This isn't a manufactured promotion. It's a real capacity window.`,
      history: 'Tri Pros has been serving Southern California homeowners for over a decade. Our relationships with local suppliers allow us to offer structured incentive windows that benefit families who are ready to move forward.',
      timeline: `Sign this month → Install coordinator calls within 24 hours → Crew on-site within 3-4 weeks → Most projects complete in 10-14 business days. Program expires ${getMonthEnd()}.`,
      faqs: [
        { question: 'Is this a real discount or a sales tactic?', answer: 'This is a structured incentive based on our current supplier contract. The material upgrade, warranty extension, and inspection are real line items with real value. When the contract period ends, so does the package.' },
        { question: 'What if I\'m not ready to start this month?', answer: 'You can lock in the pricing by signing this month and schedule the install within your preferred window. The incentive is tied to the agreement date, not the start date.' },
        { question: 'Can I combine this with other programs?', answer: 'The Monthly Priority Package is standalone. However, if you qualify for Energy Saver+ incentives (IRA tax credits, utility rebates), those stack on top.' },
      ],
      keyStats: [
        { label: 'Install slots remaining', value: `${getInstallSlotsLeft()}` },
        { label: 'Package value', value: '$1,400' },
        { label: 'Avg. project timeline', value: '10-14 days' },
      ],
    },
  },
  {
    accessor: 'energy-saver-plus',
    name: 'Energy Saver+ Program',
    tagline: 'Turn your monthly utility bill into a monthly savings check.',
    accentColor: 'sky',
    qualify: qualifyEnergySaver,
    expiresLabel: 'Annual program — caps reset yearly',
    incentives: [
      {
        id: 'ira-25c-credit',
        label: 'IRA Section 25C Tax Credit',
        description: 'Federal tax credit of up to 30% for qualifying energy-efficient home improvements.',
        valueDisplay: 'up to 30%',
        valueType: 'percentage',
        calculateDeduction: (tcp: number) => Math.round(tcp * 0.3),
      },
      {
        id: 'ladwp-rebate',
        label: 'LADWP Home Upgrade Rebate',
        description: 'Utility rebate program for qualifying energy improvements — when program is open.',
        valueDisplay: 'up to $3,000',
        valueType: 'credit',
        calculateDeduction: () => 3000,
      },
      {
        id: 'energy-audit',
        label: 'Free Energy Audit',
        description: 'Comprehensive assessment of your home\'s energy performance before any work begins.',
        valueDisplay: 'Included',
        valueType: 'fixed',
        calculateDeduction: () => 0,
      },
    ],
    presentation: {
      story: 'Most homes in Southern California lose between $100 and $250 every month through poor insulation, leaky windows, and inefficient HVAC systems. That\'s not a comfort problem — that\'s a money problem. The good news: it\'s fixable, and a significant portion of the fix can be covered by federal and state programs.',
      history: 'The Inflation Reduction Act of 2022 created the largest residential energy incentive program in U.S. history. Tri Pros has helped hundreds of SoCal families access these credits since the program launched.',
      timeline: 'Energy audit → Scope finalization → Install within 3-4 weeks → Tax credit applied at next filing. LADWP rebate processed separately (4-8 weeks).',
      faqs: [
        { question: 'How do I know if I qualify for the tax credit?', answer: 'If you\'re installing qualifying energy-efficient improvements (HVAC, insulation, windows, or heat pumps) in your primary residence, you likely qualify. We help you document everything for your tax preparer.' },
        { question: 'What if the rebate program fills up?', answer: 'LADWP and SoCalGas rebate programs have annual caps and can fill up mid-year. We submit your application as part of the project process to maximize your chances.' },
        { question: 'How much will I actually save on my bill?', answer: 'Most families see a 30-55% reduction in heating and cooling costs. The exact number depends on your current insulation, HVAC efficiency, and window condition — which the energy audit quantifies.' },
      ],
      keyStats: [
        { label: 'Avg. bill reduction', value: '30-55%' },
        { label: 'Max IRA credit/year', value: '$3,200' },
        { label: 'Max LADWP rebate', value: '$3,000' },
      ],
    },
  },
  {
    accessor: 'existing-customer-savings-plus',
    name: 'Existing Customer Savings+',
    tagline: 'You already trust us. Now let us reward that.',
    accentColor: 'violet',
    qualify: qualifyExistingCustomer,
    expiresLabel: `${getCurrentMonth()} loyalty window`,
    incentives: [
      {
        id: 'loyalty-discount',
        label: '20% Loyalty Discount',
        description: 'Applied to standard labor rates — exclusively for returning customers.',
        valueDisplay: '20% off labor',
        valueType: 'percentage',
        calculateDeduction: (tcp: number) => Math.round(tcp * 0.2 * 0.4), // ~40% of TCP is labor
      },
      {
        id: 'priority-scheduling',
        label: 'Priority Scheduling',
        description: 'Your project goes on the calendar before new customer inquiries.',
        valueDisplay: 'Priority access',
        valueType: 'fixed',
        calculateDeduction: () => 0,
      },
      {
        id: 'vip-warranty',
        label: 'VIP Warranty Extension',
        description: '2 additional years on workmanship warranty — beyond standard coverage.',
        valueDisplay: '+2 years',
        valueType: 'fixed',
        calculateDeduction: () => 0,
      },
      {
        id: 'no-mobilization',
        label: 'No Mobilization Fee',
        description: 'Crew mobilization fee waived for returning customers.',
        valueDisplay: 'Waived',
        valueType: 'fixed',
        calculateDeduction: () => 500,
      },
    ],
    presentation: {
      story: 'You already know how we work. You\'ve seen the quality firsthand, you know our crews are clean and professional, and you know we back our work. Today isn\'t a sales call — it\'s a planning conversation.',
      history: 'Our returning customer program was built because the families who come back are the families we most want to serve. Every repeat project strengthens the relationship and lets us offer better terms.',
      timeline: 'Same-day proposal → Priority scheduling (within days, not weeks) → Same crew when possible → VIP warranty kicks in automatically.',
      faqs: [
        { question: 'Do I automatically get loyalty pricing?', answer: 'Yes — any customer with a prior completed Tri Pros project qualifies. The discount applies to all labor on your next project.' },
        { question: 'Can I request the same crew?', answer: 'We prioritize crew continuity for returning customers. If your original crew is available, they\'re assigned first.' },
        { question: 'Does this stack with other programs?', answer: 'The loyalty discount is standalone. However, if your new project includes energy-efficient upgrades, you may also qualify for IRA tax credits independently.' },
      ],
      keyStats: [
        { label: 'Returning families (2024)', value: '47' },
        { label: 'Avg. loyalty savings', value: '$3,200' },
        { label: 'Crew continuity rate', value: '85%' },
      ],
    },
  },
]

export function getProgramByAccessor(accessor: string): MeetingProgram | undefined {
  return MEETING_PROGRAMS.find(p => p.accessor === accessor)
}
```

- [ ] **Step 5: Commit**

```bash
git add src/features/meetings/types/ src/features/meetings/constants/
git commit -m "feat(meetings): add new types, step config, and lean program model"
```

---

## Task 7: Program Qualification & Proposal Transfer Logic

**Purpose:** Create the library functions for program qualification and meeting-to-proposal data transfer.

**Files:**
- Create: `src/features/meetings/lib/qualify-programs.ts`
- Create: `src/features/meetings/lib/build-proposal-defaults.ts`

### Steps

- [ ] **Step 1: Create program qualification function**

Create `src/features/meetings/lib/qualify-programs.ts`:

```typescript
import type { QualificationContext, QualificationResult } from '@/features/meetings/types'
import { MEETING_PROGRAMS } from '@/features/meetings/constants/programs'

export interface ProgramQualification {
  accessor: string
  name: string
  accentColor: 'amber' | 'sky' | 'violet'
  result: QualificationResult
}

export function qualifyAllPrograms(ctx: QualificationContext): ProgramQualification[] {
  return MEETING_PROGRAMS.map(program => ({
    accessor: program.accessor,
    name: program.name,
    accentColor: program.accentColor,
    result: program.qualify(ctx),
  }))
}
```

- [ ] **Step 2: Create proposal defaults builder**

Create `src/features/meetings/lib/build-proposal-defaults.ts`:

```typescript
import type { ProposalFormSchema } from '@/shared/entities/proposals/schemas'
import type { MeetingFlowState } from '@/shared/entities/meetings/schemas'
import type { Customer, Meeting } from '@/shared/db/schema'
import { proposalFormBaseDefaultValues } from '@/shared/entities/proposals/schemas'
import { getProgramByAccessor } from '@/features/meetings/constants/programs'

export function buildProposalDefaults(
  meeting: Meeting,
  customer: Customer | null,
): ProposalFormSchema {
  const flowState = meeting.flowStateJSON
  const defaults = structuredClone(proposalFormBaseDefaultValues)

  if (!flowState) {
    return defaults
  }

  // Map trade selections → SOW entries
  if (flowState.tradeSelections && flowState.tradeSelections.length > 0) {
    defaults.project.data.sow = flowState.tradeSelections.map(ts => ({
      contentJSON: '',
      html: '',
      scopes: ts.selectedScopes.map(s => ({ id: s.id, label: s.label })),
      title: '',
      trade: { id: ts.tradeId, label: ts.tradeName },
      price: 0,
    }))
  }

  // Map deal structure → funding
  if (flowState.dealStructure) {
    const ds = flowState.dealStructure
    if (ds.startingTcp !== undefined) {
      defaults.funding.data.startingTcp = ds.startingTcp
    }
    if (ds.finalTcp !== undefined) {
      defaults.funding.data.finalTcp = ds.finalTcp
    }
    if (ds.depositAmount !== undefined) {
      defaults.funding.data.depositAmount = ds.depositAmount
    }
    if (ds.mode === 'cash' && ds.finalTcp !== undefined) {
      defaults.funding.data.cashInDeal = ds.finalTcp
    }

    // Map incentives
    if (ds.incentives && ds.incentives.length > 0) {
      defaults.funding.data.incentives = ds.incentives.map(inc => ({
        type: 'discount' as const,
        amount: inc.amount,
        notes: `${inc.label} (${inc.source})`,
      }))
    }
  }

  // Map program expiration → valid through
  if (flowState.selectedProgram) {
    const program = getProgramByAccessor(flowState.selectedProgram)
    if (program) {
      defaults.project.data.validThroughTimeframe = '30 days'
    }
  }

  // Map pain points → project objectives
  if (flowState.tradeSelections) {
    const objectives = flowState.tradeSelections
      .flatMap(ts => ts.painPoints)
      .filter(Boolean)
      .map(pain => `Address: ${pain}`)
    if (objectives.length > 0) {
      defaults.project.data.projectObjectives = objectives
    }
  }

  // Set label from customer name
  if (customer?.name) {
    defaults.project.data.label = `${customer.name} — Proposal`
  }

  return defaults
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/meetings/lib/qualify-programs.ts src/features/meetings/lib/build-proposal-defaults.ts
git commit -m "feat(meetings): add program qualification and proposal transfer logic"
```

---

## Task 8: Portfolio Query (tRPC Procedure)

**Purpose:** Add the `getPortfolioForMeeting` procedure to the meetings router so Step 3 can pull relevant showroom projects.

**Files:**
- Modify: `src/trpc/routers/meetings.router.ts`

### Steps

- [ ] **Step 1: Add the portfolio query procedure**

Add this procedure to the `meetingsRouter` in `src/trpc/routers/meetings.router.ts`:

```typescript
import { projects, x_projectScopes, mediaFiles } from '@/shared/db/schema'

// Inside createTRPCRouter({...}):

getPortfolioForMeeting: agentProcedure
  .input(z.object({
    scopeIds: z.array(z.string()),
  }))
  .query(async ({ input }) => {
    const { scopeIds } = input

    if (scopeIds.length === 0) {
      // No scopes selected — return recent public projects as fallback
      return db
        .select()
        .from(projects)
        .where(eq(projects.isPublic, true))
        .orderBy(desc(projects.completedAt))
        .limit(4)
        .then(rows => rows.map(r => ({ ...r, matchedScopeCount: 0 })))
    }

    // Query projects that share scopes with the meeting's selected scopes
    const matchedProjects = await db
      .select({
        project: projects,
        matchedScopeCount: count(x_projectScopes.scopeId).as('matched_scope_count'),
      })
      .from(projects)
      .innerJoin(x_projectScopes, eq(x_projectScopes.projectId, projects.id))
      .where(and(
        eq(projects.isPublic, true),
        inArray(x_projectScopes.scopeId, scopeIds),
      ))
      .groupBy(projects.id)
      .orderBy(desc(count(x_projectScopes.scopeId)), desc(projects.completedAt))
      .limit(4)

    // If fewer than 2 matched, backfill with other public projects
    const matchedIds = matchedProjects.map(r => r.project.id)
    let backfill: typeof matchedProjects = []

    if (matchedProjects.length < 2) {
      const backfillRows = await db
        .select()
        .from(projects)
        .where(and(
          eq(projects.isPublic, true),
          matchedIds.length > 0 ? sql`${projects.id} NOT IN (${sql.join(matchedIds.map(id => sql`${id}`), sql`, `)})` : undefined,
        ))
        .orderBy(desc(projects.completedAt))
        .limit(4 - matchedProjects.length)

      backfill = backfillRows.map(r => ({ project: r, matchedScopeCount: 0 }))
    }

    const allProjects = [...matchedProjects, ...backfill]
    const projectIds = allProjects.map(r => r.project.id)

    // Fetch media for all returned projects
    const media = projectIds.length > 0
      ? await db
          .select()
          .from(mediaFiles)
          .where(inArray(mediaFiles.projectId, projectIds))
          .orderBy(mediaFiles.sortOrder)
      : []

    const mediaByProject = new Map<string, typeof media>()
    for (const m of media) {
      const existing = mediaByProject.get(m.projectId) ?? []
      existing.push(m)
      mediaByProject.set(m.projectId, existing)
    }

    return allProjects.map(r => ({
      ...r.project,
      matchedScopeCount: r.matchedScopeCount,
      mediaFiles: mediaByProject.get(r.project.id) ?? [],
    }))
  }),
```

Add the necessary imports at the top of the file: `projects`, `x_projectScopes`, `mediaFiles` from schema, and `count`, `sql` from `drizzle-orm`.

- [ ] **Step 2: Commit**

```bash
git add src/trpc/routers/meetings.router.ts
git commit -m "feat(meetings): add getPortfolioForMeeting tRPC procedure"
```

---

## Task 9: Flow Shell — MeetingFlowView Rewrite

**Purpose:** Build the main flow view that orchestrates all 7 steps, the context panel, and step navigation. This is the skeleton — individual step components are built in Tasks 10-16.

**Files:**
- Rewrite: `src/features/meetings/ui/views/meeting-flow.tsx`
- Create: `src/features/meetings/ui/components/step-nav.tsx`

### Steps

- [ ] **Step 1: Create the step navigation component**

Create `src/features/meetings/ui/components/step-nav.tsx`:

```typescript
'use client'

import type { MeetingStepConfig } from '@/features/meetings/types'
import { MEETING_STEPS } from '@/features/meetings/constants/step-config'
import { cn } from '@/shared/lib/utils'

interface StepNavProps {
  currentStep: number
  onStepClick: (step: number) => void
}

export function StepNav({ currentStep, onStepClick }: StepNavProps) {
  return (
    <nav className="flex items-center gap-1">
      {MEETING_STEPS.map((step) => {
        const isActive = step.stepNumber === currentStep
        const isCompleted = step.stepNumber < currentStep

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepClick(step.stepNumber)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-all',
              isActive && 'bg-primary/10 text-primary',
              isCompleted && 'text-muted-foreground hover:text-foreground',
              !isActive && !isCompleted && 'text-muted-foreground/50 hover:text-muted-foreground',
            )}
            title={step.title}
          >
            <span className={cn(
              'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
              isActive && 'bg-primary text-primary-foreground',
              isCompleted && 'bg-muted-foreground/20 text-muted-foreground',
              !isActive && !isCompleted && 'bg-muted/50 text-muted-foreground/50',
            )}>
              {step.stepNumber}
            </span>
            <span className="hidden lg:inline">{step.shortLabel}</span>
          </button>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 2: Rewrite MeetingFlowView**

Replace the entire contents of `src/features/meetings/ui/views/meeting-flow.tsx`. This is the flow shell that:
- Fetches meeting data via tRPC
- Manages step state via nuqs (URL param)
- Provides mutations for saving context and flow state
- Renders the current step component
- Renders the context panel trigger

```typescript
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react'
import Link from 'next/link'
import { useQueryState } from 'nuqs'
import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'

import type { MeetingFlowContext } from '@/features/meetings/types'
import type { MeetingFlowState } from '@/shared/entities/meetings/schemas'
import { stepParser } from '@/features/meetings/constants/query-parsers'
import { MEETING_STEPS, TOTAL_STEPS } from '@/features/meetings/constants/step-config'
import { StepNav } from '@/features/meetings/ui/components/step-nav'
import { Logo } from '@/shared/components/logo'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { ROOTS } from '@/shared/config/roots'
import { useTRPC } from '@/trpc/helpers'

interface MeetingFlowViewProps {
  meetingId: string
}

export function MeetingFlowView({ meetingId }: MeetingFlowViewProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [currentStep, setCurrentStep] = useQueryState('step', stepParser)

  const meetingQuery = useQuery(
    trpc.meetingsRouter.getById.queryOptions({ id: meetingId }),
  )

  const updateMeeting = useMutation(
    trpc.meetingsRouter.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.meetingsRouter.getById.queryKey({ id: meetingId }),
        })
      },
      onError: () => toast.error('Failed to save'),
    }),
  )

  const updateCustomerProfile = useMutation(
    trpc.customersRouter.updateProfile.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.meetingsRouter.getById.queryKey({ id: meetingId }),
        })
      },
      onError: () => toast.error('Failed to save customer data'),
    }),
  )

  const meeting = meetingQuery.data
  const customer = meeting?.customer?.id ? meeting.customer : null

  const handleFlowStateChange = useCallback((patch: Partial<MeetingFlowState>) => {
    const current = meeting?.flowStateJSON ?? {}
    updateMeeting.mutate({
      id: meetingId,
      flowStateJSON: { ...current, ...patch },
    })
  }, [meeting?.flowStateJSON, meetingId, updateMeeting])

  const handleCustomerProfileChange = useCallback((jsonbKey: string, patch: Record<string, unknown>) => {
    if (!customer?.id) {
      return
    }
    const currentSection = (customer as Record<string, unknown>)[jsonbKey] ?? {}
    updateCustomerProfile.mutate({
      customerId: customer.id,
      [jsonbKey]: { ...(currentSection as Record<string, unknown>), ...patch },
    })
  }, [customer, updateCustomerProfile])

  const flowContext = useMemo<MeetingFlowContext | null>(() => {
    if (!meeting) {
      return null
    }
    return {
      meetingId,
      customerId: meeting.customerId,
      customer,
      flowState: meeting.flowStateJSON,
      onFlowStateChange: handleFlowStateChange,
      onCustomerProfileChange: handleCustomerProfileChange,
    }
  }, [meeting, meetingId, customer, handleFlowStateChange, handleCustomerProfileChange])

  if (meetingQuery.isLoading) {
    return <LoadingState title="Loading meeting" description="Fetching meeting details..." />
  }

  if (!meeting || !flowContext) {
    return <ErrorState title="Meeting not found" description="This meeting could not be loaded." />
  }

  const stepConfig = MEETING_STEPS[currentStep - 1]
  if (!stepConfig) {
    return <ErrorState title="Invalid step" description="This step does not exist." />
  }

  function handleNext() {
    if (currentStep < TOTAL_STEPS) {
      void setCurrentStep(currentStep + 1)
    }
  }

  function handlePrev() {
    if (currentStep > 1) {
      void setCurrentStep(currentStep - 1)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border/40 px-4 py-2.5 md:px-6">
        <Link
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          href={`${ROOTS.dashboard.root}?step=meetings`}
        >
          <ArrowLeftIcon className="size-4" />
          <span className="hidden sm:inline">Meetings</span>
        </Link>

        <StepNav currentStep={currentStep} onStepClick={s => void setCurrentStep(s)} />

        <div className="ml-auto hidden h-6 w-20 sm:block">
          <Logo variant="right" />
        </div>
      </header>

      {/* Step title bar */}
      <div className="shrink-0 border-b border-border/20 px-4 py-2 md:px-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {`Step ${currentStep} of ${TOTAL_STEPS}`}
        </p>
        <h1 className="text-lg font-bold tracking-tight md:text-xl">{stepConfig.title}</h1>
      </div>

      {/* Step content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* TODO: Render step component based on stepConfig.id */}
        {/* Each step component receives flowContext */}
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          Step {currentStep}: {stepConfig.title} — component coming soon
        </div>
      </div>

      {/* Footer navigation */}
      <footer className="shrink-0">
        <Separator />
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <Button
            className="gap-2"
            disabled={currentStep === 1}
            size="sm"
            variant="outline"
            onClick={handlePrev}
          >
            <ArrowLeftIcon className="size-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          <span className="text-xs text-muted-foreground">
            {currentStep} / {TOTAL_STEPS}
          </span>

          <Button
            className="gap-2"
            disabled={currentStep === TOTAL_STEPS}
            size="sm"
            onClick={handleNext}
          >
            <span className="hidden sm:inline">Next</span>
            <ArrowRightIcon className="size-4" />
          </Button>
        </div>
      </footer>

      {/* Context panel trigger — TODO: Task 10 */}
    </div>
  )
}
```

- [ ] **Step 3: Run lint + build**

Run: `pnpm lint && pnpm build`

Fix any remaining import errors. At this point, the app should compile with placeholder step content.

- [ ] **Step 4: Commit**

```bash
git add src/features/meetings/ui/views/meeting-flow.tsx src/features/meetings/ui/components/step-nav.tsx
git commit -m "feat(meetings): rewrite MeetingFlowView with 7-step shell and step navigation"
```

---

## Task 10: Context Panel

**Purpose:** Build the persistent context panel (drawer) that the agent can open from any step.

**Files:**
- Create: `src/features/meetings/ui/components/context-panel.tsx`
- Create: `src/features/meetings/ui/components/context-panel-trigger.tsx`
- Create: `src/features/meetings/ui/components/context-panel-section.tsx`
- Create: `src/features/meetings/ui/components/context-panel-field.tsx`

**Guidance:** This is a slide-out sheet (use shadcn `Sheet` component) from the left side. It contains collapsible sections with field renderers. The existing `field-renderer.tsx` and `debounced-field-input.tsx` can be reused/adapted for the individual field inputs. Each section has a completion indicator (e.g., "4/7 filled").

The panel writes to two entities:
- Meeting fields (contextJSON, meetingOutcome) → via `updateMeeting.mutate`
- Customer fields (customerProfileJSON, propertyProfileJSON, financialProfileJSON) → via `updateCustomerProfile.mutate`

The trigger button should float at the bottom-left with a badge showing overall completion.

**Implementation notes:**
- Use `Sheet` from `@/shared/components/ui/sheet` (shadcn)
- Sections correspond to the 6 sections defined in Design Section 4
- Field types: select (dropdown), text (input), number (input), rating (1-10 buttons), boolean (toggle)
- Reuse `meetingDecisionMakersPresentOptions`, `meetingPainTypes`, etc. from shared enums for option lists
- The outcome label selector (Section 6) uses `meetingOutcomes` enum

After implementing, wire the context panel trigger into `MeetingFlowView` (in the footer area or as a fixed-position element).

- [ ] **Step 1: Build ContextPanelField component** — renders a single field (select/text/number/rating/boolean) with auto-save on change
- [ ] **Step 2: Build ContextPanelSection component** — collapsible section with title, completion count, and field list
- [ ] **Step 3: Build ContextPanel component** — Sheet with all 6 sections, receives meeting + customer data + save handlers
- [ ] **Step 4: Build ContextPanelTrigger component** — floating button with completion badge, opens the Sheet
- [ ] **Step 5: Wire into MeetingFlowView** — add the trigger and panel to the flow view
- [ ] **Step 6: Run lint + build, fix errors**
- [ ] **Step 7: Commit**

```bash
git add src/features/meetings/ui/components/context-panel*.tsx src/features/meetings/ui/views/meeting-flow.tsx
git commit -m "feat(meetings): add persistent context panel with 6 sections"
```

---

## Task 11: Step 1 — "Navigating the Construction Industry"

**Purpose:** Customer-facing first impression. Due diligence story + TPR credentials. Media-rich, clean, large typography.

**Files:**
- Create: `src/features/meetings/ui/components/steps/who-we-are-step.tsx`

**Content to render:**
- TPR credentials: license, insurance, warranty badges
- The 6-point due diligence framework (from `docs/sales/due-diligence-story.md`): Licensing, Scope of Work, Supervision, Communication, Office Support, Proof of Performance
- Each point rendered as a card with icon, title, and brief description
- Company/team imagery (placeholder media slots — actual images stored in R2, URLs can be constants for now)
- Key message: "We're here to educate you, not sell you."

**UX notes:** This is the step the customer sees first. Large, clean layout. No clutter. The due diligence framework should feel like a trusted checklist, not a sales pitch. Use authority-building visual language.

- [ ] **Step 1: Create the component** with due diligence cards, credential badges, and hero messaging. Receives `MeetingFlowContext` as props.
- [ ] **Step 2: Wire into MeetingFlowView** — render when `stepConfig.id === 'who-we-are'`
- [ ] **Step 3: Run lint + build, fix errors**
- [ ] **Step 4: Commit**

```bash
git add src/features/meetings/ui/components/steps/who-we-are-step.tsx src/features/meetings/ui/views/meeting-flow.tsx
git commit -m "feat(meetings): add Step 1 — Navigating the Construction Industry"
```

---

## Task 12: Step 2 — "Which Specialties Matter to You"

**Purpose:** Customer-facing trade/scope/pain selection. Layered: select trade → expand to pain points + scopes per trade.

**Files:**
- Create: `src/features/meetings/ui/components/steps/specialties-step.tsx`
- Create: `src/features/meetings/ui/components/steps/trade-card.tsx`
- Create: `src/features/meetings/ui/components/steps/trade-detail.tsx`

**Data flow:**
- Reads trade list from the DB (or shared constants — check how `meeting-scopes-picker.tsx` currently loads trades/scopes)
- On trade selection → add to `flowState.tradeSelections[]`
- Expanded trade shows: pain point multi-select (`meetingPainTypes`), scope picker for that trade, notes field
- Each change saves to `flowStateJSON` via `onFlowStateChange`

**UX notes:** Trade cards should have outcome-focused labels and trade-specific imagery. When a trade is selected, it expands to show the detail panel inline. Multiple trades can be selected. The `MeetingScopesPicker` logic from the old code can be adapted for loading trades/scopes from the DB.

- [ ] **Step 1: Read the existing `meeting-scopes-picker.tsx`** to understand how trades/scopes are loaded
- [ ] **Step 2: Create TradeCard component** — visual card with outcome label, icon, selected state
- [ ] **Step 3: Create TradeDetail component** — expanded panel with pain points multi-select, scope picker, notes
- [ ] **Step 4: Create SpecialtiesStep component** — renders trade cards grid, manages selections, saves to flowState
- [ ] **Step 5: Wire into MeetingFlowView**
- [ ] **Step 6: Run lint + build, fix errors**
- [ ] **Step 7: Commit**

```bash
git add src/features/meetings/ui/components/steps/specialties-step.tsx src/features/meetings/ui/components/steps/trade-card.tsx src/features/meetings/ui/components/steps/trade-detail.tsx src/features/meetings/ui/views/meeting-flow.tsx
git commit -m "feat(meetings): add Step 2 — Which Specialties Matter to You"
```

---

## Task 13: Step 3 — "Past References & Projects"

**Purpose:** Customer-facing portfolio viewer. Pulls real projects from showroom DB filtered by selected trades.

**Files:**
- Create: `src/features/meetings/ui/components/steps/portfolio-step.tsx`
- Create: `src/features/meetings/ui/components/steps/portfolio-card.tsx`

**Data flow:**
- Collects `scopeIds` from `flowState.tradeSelections[].selectedScopes[].id`
- Calls `meetingsRouter.getPortfolioForMeeting({ scopeIds })` via tRPC
- Renders returned projects with media, testimonials, narratives

**UX notes:** Full-width project cards. Hero image prominent. Before/after slider if pairs exist. Challenge → Solution → Result narrative. Homeowner quote. Matched scope badges. Agent swipes/navigates between projects.

- [ ] **Step 1: Create PortfolioCard component** — renders a single project with media, narrative, quote, badges
- [ ] **Step 2: Create PortfolioStep component** — fetches projects, renders cards with navigation
- [ ] **Step 3: Wire into MeetingFlowView**
- [ ] **Step 4: Run lint + build, fix errors**
- [ ] **Step 5: Commit**

```bash
git add src/features/meetings/ui/components/steps/portfolio-step.tsx src/features/meetings/ui/components/steps/portfolio-card.tsx src/features/meetings/ui/views/meeting-flow.tsx
git commit -m "feat(meetings): add Step 3 — Past References & Projects"
```

---

## Task 14: Step 4 — "Picking the Right Path"

**Purpose:** Customer-facing program selection. Two-phase: selection → presentation.

**Files:**
- Create: `src/features/meetings/ui/components/steps/program-step.tsx`
- Create: `src/features/meetings/ui/components/steps/program-card.tsx`
- Create: `src/features/meetings/ui/components/steps/program-presentation.tsx`

**Data flow:**
- Runs `qualifyAllPrograms()` with current context to get qualification results
- Renders program cards with qualified/not-qualified status
- Includes "Standard Pricing" option (no program)
- On selection → saves `flowState.selectedProgram` and `flowState.programQualified`
- If program selected → phase 2: render `ProgramPresentation` with story, history, timeline, FAQ accordion, key stats

**UX notes:** Program cards show qualification badge (green check or red X with reason). FAQ uses shadcn `Accordion`. Key stats rendered as a small grid. "Standard Pricing" card is always available and styled neutrally.

- [ ] **Step 1: Create ProgramCard component** — shows program name, tagline, qualification status, incentive summary
- [ ] **Step 2: Create ProgramPresentation component** — story, history, timeline, FAQ accordion, key stats
- [ ] **Step 3: Create ProgramStep component** — qualification logic, card grid, phase transition, saves selection
- [ ] **Step 4: Wire into MeetingFlowView**
- [ ] **Step 5: Run lint + build, fix errors**
- [ ] **Step 6: Commit**

```bash
git add src/features/meetings/ui/components/steps/program-step.tsx src/features/meetings/ui/components/steps/program-card.tsx src/features/meetings/ui/components/steps/program-presentation.tsx src/features/meetings/ui/views/meeting-flow.tsx
git commit -m "feat(meetings): add Step 4 — Picking the Right Path"
```

---

## Task 15: Step 5 — "Deal Structure"

**Purpose:** Agent-facing deal builder. Finance vs. cash toggle, TCP, incentives, monthly payment.

**Files:**
- Create: `src/features/meetings/ui/components/steps/deal-structure-step.tsx`

**Data flow:**
- Reads `flowState.tradeSelections` for scope-based pricing
- Reads `flowState.selectedProgram` to auto-apply program incentives
- Finance/cash toggle saves `flowState.dealStructure.mode`
- All deal fields save to `flowState.dealStructure`
- Energy Saver+ specific: show IRA 25C credit and LADWP rebate fields only when that program is selected

**UX notes:** Denser UI — this is agent-private. Number inputs, toggles, calculated fields. Real-time monthly payment preview. Incentive deductions auto-calculate. Show running total.

- [ ] **Step 1: Create DealStructureStep component** — finance/cash toggle, TCP fields, incentive list, payment preview
- [ ] **Step 2: Wire into MeetingFlowView**
- [ ] **Step 3: Run lint + build, fix errors**
- [ ] **Step 4: Commit**

```bash
git add src/features/meetings/ui/components/steps/deal-structure-step.tsx src/features/meetings/ui/views/meeting-flow.tsx
git commit -m "feat(meetings): add Step 5 — Deal Structure"
```

---

## Task 16: Step 6 — "Closing Summary"

**Purpose:** Customer-facing interactive confirmation. Visual recap with editable fields.

**Files:**
- Create: `src/features/meetings/ui/components/steps/closing-step.tsx`
- Create: `src/features/meetings/ui/components/steps/closing-scope-card.tsx`

**Data flow:**
- Reads all `flowState` fields for the summary
- Each section (scopes, program, pricing, timeline) is editable — agent can adjust live
- Outcome label selector accessible here (same one as in context panel)
- Changes save to `flowState.closingAdjustments`

**UX notes:** Clean summary cards. Each card has an edit action. Scope cards show trade + scopes + price. Program card shows name + incentives. Pricing card shows TCP + monthly or deposit. Timeline card shows estimated install dates.

- [ ] **Step 1: Create ClosingScopeCard component** — displays one trade's scopes with edit capability
- [ ] **Step 2: Create ClosingStep component** — summary layout with all cards, outcome selector
- [ ] **Step 3: Wire into MeetingFlowView**
- [ ] **Step 4: Run lint + build, fix errors**
- [ ] **Step 5: Commit**

```bash
git add src/features/meetings/ui/components/steps/closing-step.tsx src/features/meetings/ui/components/steps/closing-scope-card.tsx src/features/meetings/ui/views/meeting-flow.tsx
git commit -m "feat(meetings): add Step 6 — Closing Summary"
```

---

## Task 17: Step 7 — "Create Proposal"

**Purpose:** Agent-facing transition to proposal flow with maximum data transfer.

**Files:**
- Create: `src/features/meetings/ui/components/steps/create-proposal-step.tsx`

**Data flow:**
- Uses `buildProposalDefaults()` from Task 7 to show a preview of what will be transferred
- "Create Proposal" button navigates to proposal flow with `?meetingId={id}`
- Shows a summary of what data will be pre-filled

**UX notes:** Simple confirmation view. Show what will transfer: scopes, pricing, financing, customer info. Big CTA button.

- [ ] **Step 1: Create CreateProposalStep component**
- [ ] **Step 2: Wire into MeetingFlowView** — complete the step routing switch
- [ ] **Step 3: Run lint + build, fix errors**
- [ ] **Step 4: Commit**

```bash
git add src/features/meetings/ui/components/steps/create-proposal-step.tsx src/features/meetings/ui/views/meeting-flow.tsx
git commit -m "feat(meetings): add Step 7 — Create Proposal with data transfer preview"
```

---

## Task 18: Final Verification

**Purpose:** Full lint + build pass. Review diff. Ensure no broken imports, no stale references, no debug logs.

- [ ] **Step 1: Run full lint**

Run: `pnpm lint`

Fix all errors. Common issues: unused imports from deleted files, sort order issues (perfectionist plugin).

- [ ] **Step 2: Run full build**

Run: `pnpm build`

Fix all TypeScript errors. This is the definitive check — if it builds, the type system is consistent.

- [ ] **Step 3: Review the full diff**

Run: `git diff main --stat` to see all changed files. Then `git diff main` for the full diff. Check for:
- Unintended changes to files outside the meetings feature
- Debug `console.log` statements
- Leftover `TODO` comments that should have been resolved
- Any reference to old column names (`status`, `situationProfileJSON`, `programDataJSON`, `meetingScopesJSON`, `contactName`, `program`)

- [ ] **Step 4: Push schema to DB one final time**

Run: `pnpm db:push`

Confirm the schema is in sync.

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "chore(meetings): final cleanup — lint, build, and diff review"
```

---

## Execution Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Schema Foundation — enums, entity schemas, JSONB types | None |
| 2 | Drizzle Schema & pgEnum updates | Task 1 |
| 3 | Fix downstream — customer pipelines & dashboard | Task 2 |
| 4 | Fix meetings feature internals | Task 2 |
| 5 | Delete old files, clean imports | Tasks 3, 4 |
| 6 | New feature types & constants | Task 1 |
| 7 | Program qualification & proposal transfer logic | Task 6 |
| 8 | Portfolio query (tRPC procedure) | Task 2 |
| 9 | Flow shell — MeetingFlowView rewrite | Tasks 5, 6 |
| 10 | Context panel | Task 9 |
| 11 | Step 1 — Who We Are | Task 9 |
| 12 | Step 2 — Specialties | Task 9 |
| 13 | Step 3 — Portfolio | Tasks 8, 12 |
| 14 | Step 4 — Programs | Tasks 7, 12 |
| 15 | Step 5 — Deal Structure | Task 14 |
| 16 | Step 6 — Closing Summary | Task 15 |
| 17 | Step 7 — Create Proposal | Tasks 7, 16 |
| 18 | Final verification | All |

**Parallelizable**: Tasks 3 & 4 can run in parallel. Tasks 6, 7, 8 can run in parallel (after Task 2). Tasks 10, 11, 12 can run in parallel (after Task 9).
