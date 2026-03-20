# Multi-Pipeline Customer System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-pipeline support (active/rehash/dead) to the customer-pipelines feature with role-gated access: agents see only "Active", super-admins see a pipeline toggle and can move customers between pipelines.

**Architecture:** Add `pipeline` (enum) and `pipelineStage` (text, nullable) columns to `customers` table. Active pipeline stages are computed from meeting/proposal data (existing logic, unchanged). Rehash/dead pipeline stages are stored explicitly in `pipelineStage` and set manually by super-admin. A `resolveCustomerStage()` function routes between computed and stored stages based on the pipeline value.

**Tech Stack:** Next.js 15, TypeScript, Drizzle ORM, tRPC, Zod, React, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-18-multi-pipeline-customer-system-design.md`

---

## Task 1: Schema — Add Pipeline Enum, Constants, and DB Columns

**Files:**
- Create: `src/shared/constants/enums/customer-pipelines.ts`
- Create: `src/shared/types/enums/customer-pipelines.ts`
- Modify: `src/shared/constants/enums/index.ts` (add re-export)
- Modify: `src/shared/types/enums/index.ts` (add re-export)
- Modify: `src/shared/db/schema/meta.ts` (add `customerPipelineEnum`)
- Modify: `src/shared/db/schema/customers.ts` (add `pipeline` and `pipelineStage` columns)

- [ ] **Step 1: Create `src/shared/constants/enums/customer-pipelines.ts`**

```typescript
export const customerPipelines = ['active', 'rehash', 'dead'] as const
```

- [ ] **Step 2: Create `src/shared/types/enums/customer-pipelines.ts`**

```typescript
import type { customerPipelines } from '@/shared/constants/enums/customer-pipelines'

export type CustomerPipeline = (typeof customerPipelines)[number]
```

- [ ] **Step 3: Add re-exports to barrel files**

In `src/shared/constants/enums/index.ts` add: `export * from './customer-pipelines'`
In `src/shared/types/enums/index.ts` add: `export * from './customer-pipelines'`

- [ ] **Step 4: Add pgEnum to `src/shared/db/schema/meta.ts`**

```typescript
import { customerPipelines } from '@/shared/constants/enums'
export const customerPipelineEnum = pgEnum('customer_pipeline', customerPipelines)
```

- [ ] **Step 5: Add columns to `src/shared/db/schema/customers.ts`**

Add to the `customers` pgTable definition:

```typescript
pipeline: customerPipelineEnum('pipeline').notNull().default('active'),
pipelineStage: text('pipeline_stage'),
```

Import `customerPipelineEnum` from `@/shared/db/schema/meta`.

- [ ] **Step 6: Push schema changes**

Run: `pnpm db:push`

- [ ] **Step 7: Run typecheck**

Run: `pnpm tsc --noEmit`

- [ ] **Step 8: Commit**

```
git commit -m "feat: add pipeline + pipelineStage columns to customers schema"
```

---

## Task 2: Pipeline Stage Definitions per Pipeline Type

**Files:**
- Create: `src/features/customer-pipelines/constants/rehash-pipeline-stages.ts`
- Create: `src/features/customer-pipelines/constants/dead-pipeline-stages.ts`
- Modify: `src/features/customer-pipelines/constants/customer-pipeline-stages.ts` (rename to `active-pipeline-stages.ts`)

- [ ] **Step 1: Rename active pipeline stages file**

```bash
git mv src/features/customer-pipelines/constants/customer-pipeline-stages.ts src/features/customer-pipelines/constants/active-pipeline-stages.ts
```

Update ALL imports of `customer-pipeline-stages` to `active-pipeline-stages` across the codebase. Search: `grep -rn "customer-pipeline-stages" src/`

- [ ] **Step 2: Create `src/features/customer-pipelines/constants/rehash-pipeline-stages.ts`**

```typescript
import type { KanbanStageConfig } from '@/shared/components/kanban/types'

import { CalendarIcon, PhoneIcon, UserCheckIcon } from 'lucide-react'

export const rehashPipelineStages = [
  'schedule_manager_meeting',
  'made_contact',
  'meeting_scheduled',
] as const

export type RehashPipelineStage = (typeof rehashPipelineStages)[number]

export const rehashStageConfig: readonly KanbanStageConfig<RehashPipelineStage>[] = [
  { key: 'schedule_manager_meeting', label: 'Schedule Manager Meeting', icon: CalendarIcon, color: 'blue' },
  { key: 'made_contact', label: 'Made Contact', icon: PhoneIcon, color: 'yellow' },
  { key: 'meeting_scheduled', label: 'Meeting Scheduled', icon: UserCheckIcon, color: 'green' },
]

export const REHASH_ALLOWED_DRAG_TRANSITIONS: Record<RehashPipelineStage, readonly RehashPipelineStage[]> = {
  schedule_manager_meeting: ['made_contact'],
  made_contact: ['meeting_scheduled'],
  meeting_scheduled: [],
}

export const REHASH_BLOCKED_MESSAGES: Record<string, string> = {
  default: 'This transition is not supported via drag',
}
```

- [ ] **Step 3: Create `src/features/customer-pipelines/constants/dead-pipeline-stages.ts`**

```typescript
import type { KanbanStageConfig } from '@/shared/components/kanban/types'

import { SkullIcon, XCircleIcon } from 'lucide-react'

export const deadPipelineStages = [
  'mostly_dead',
  'really_dead',
] as const

export type DeadPipelineStage = (typeof deadPipelineStages)[number]

export const deadStageConfig: readonly KanbanStageConfig<DeadPipelineStage>[] = [
  { key: 'mostly_dead', label: 'Mostly Dead', icon: SkullIcon, color: 'yellow' },
  { key: 'really_dead', label: 'Really Dead', icon: XCircleIcon, color: 'red' },
]

export const DEAD_ALLOWED_DRAG_TRANSITIONS: Record<DeadPipelineStage, readonly DeadPipelineStage[]> = {
  mostly_dead: ['really_dead'],
  really_dead: [],
}

export const DEAD_BLOCKED_MESSAGES: Record<string, string> = {
  default: 'This transition is not supported via drag',
}
```

- [ ] **Step 4: Create a pipeline config lookup**

Create `src/features/customer-pipelines/constants/pipeline-config.ts`:

```typescript
import type { CustomerPipeline } from '@/shared/types/enums'

import {
  ACTIVE_ALLOWED_DRAG_TRANSITIONS,
  ACTIVE_BLOCKED_MESSAGES,
  activeStageConfig,
  customerPipelineStages,
} from './active-pipeline-stages'
import {
  DEAD_ALLOWED_DRAG_TRANSITIONS,
  DEAD_BLOCKED_MESSAGES,
  deadPipelineStages,
  deadStageConfig,
} from './dead-pipeline-stages'
import {
  REHASH_ALLOWED_DRAG_TRANSITIONS,
  REHASH_BLOCKED_MESSAGES,
  rehashPipelineStages,
  rehashStageConfig,
} from './rehash-pipeline-stages'

export const pipelineConfigs = {
  active: {
    stages: customerPipelineStages,
    stageConfig: activeStageConfig,
    allowedTransitions: ACTIVE_ALLOWED_DRAG_TRANSITIONS,
    blockedMessages: ACTIVE_BLOCKED_MESSAGES,
  },
  rehash: {
    stages: rehashPipelineStages,
    stageConfig: rehashStageConfig,
    allowedTransitions: REHASH_ALLOWED_DRAG_TRANSITIONS,
    blockedMessages: REHASH_BLOCKED_MESSAGES,
  },
  dead: {
    stages: deadPipelineStages,
    stageConfig: deadStageConfig,
    allowedTransitions: DEAD_ALLOWED_DRAG_TRANSITIONS,
    blockedMessages: DEAD_BLOCKED_MESSAGES,
  },
} as const satisfies Record<CustomerPipeline, unknown>
```

Note: rename exports in `active-pipeline-stages.ts` from `CUSTOMER_ALLOWED_DRAG_TRANSITIONS` to `ACTIVE_ALLOWED_DRAG_TRANSITIONS`, `CUSTOMER_BLOCKED_MESSAGES` to `ACTIVE_BLOCKED_MESSAGES`, `customerStageConfig` to `activeStageConfig` for consistency. Update all consumers of the old names.

- [ ] **Step 5: Run typecheck and commit**

Run: `pnpm tsc --noEmit`

```
git commit -m "feat: add rehash + dead pipeline stage definitions with pipeline config lookup"
```

---

## Task 3: DAL — Pipeline-Filtered Queries + Move Between Pipelines

**Files:**
- Modify: `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts`
- Create: `src/features/customer-pipelines/dal/server/move-customer-to-pipeline.ts`
- Modify: `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts`

- [ ] **Step 1: Add `pipeline` filter to `getCustomerPipelineItems`**

Modify the function signature: `getCustomerPipelineItems(userId: string, pipeline: CustomerPipeline = 'active')`

For `active` pipeline: existing query logic (unchanged) — but add `WHERE customers.pipeline = 'active'` to the initial meetings query.

For `rehash`/`dead` pipelines: simpler query — no meeting/proposal aggregation needed. Query customers where `pipeline = pipeline`, read `pipelineStage` directly:

```typescript
if (pipeline !== 'active') {
  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      address: customers.address,
      city: customers.city,
      pipeline: customers.pipeline,
      pipelineStage: customers.pipelineStage,
    })
    .from(customers)
    .where(eq(customers.pipeline, pipeline))
    .orderBy(desc(customers.updatedAt))

  return rows.map(row => ({
    id: row.id,
    type: 'customer' as const,
    stage: row.pipelineStage ?? rehashPipelineStages[0],  // fallback to first stage
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    city: row.city,
    totalPipelineValue: 0,
    meetingCount: 0,
    proposalCount: 0,
    latestActivityAt: '',
  }))
}
```

- [ ] **Step 2: Create `move-customer-to-pipeline.ts`**

New DAL function for super-admin to move a customer between pipelines:

```typescript
import type { CustomerPipeline } from '@/shared/types/enums'

import { eq } from 'drizzle-orm'

import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'

import { deadPipelineStages } from '../constants/dead-pipeline-stages'
import { rehashPipelineStages } from '../constants/rehash-pipeline-stages'

const FIRST_STAGE: Record<CustomerPipeline, string | null> = {
  active: null,
  rehash: rehashPipelineStages[0],
  dead: deadPipelineStages[0],
}

export async function moveCustomerToPipeline(
  customerId: string,
  pipeline: CustomerPipeline,
): Promise<void> {
  await db
    .update(customers)
    .set({
      pipeline,
      pipelineStage: FIRST_STAGE[pipeline],
    })
    .where(eq(customers.id, customerId))
}
```

- [ ] **Step 3: Update `move-customer-pipeline-item.ts` for rehash/dead drag**

For rehash/dead pipelines, drag simply updates `pipelineStage`:

```typescript
// At the top of moveCustomerPipelineItem, before existing logic:
if (pipeline !== 'active') {
  await db
    .update(customers)
    .set({ pipelineStage: toStage })
    .where(eq(customers.id, customerId))
  return
}
// ... existing active pipeline logic follows
```

The function needs to accept a `pipeline` parameter (or read it from the customer record).

- [ ] **Step 4: Run typecheck and commit**

Run: `pnpm tsc --noEmit`

```
git commit -m "feat: add pipeline-filtered DAL queries and cross-pipeline move"
```

---

## Task 4: tRPC Router — New Procedures

**Files:**
- Modify: `src/trpc/routers/customer-pipelines.router.ts`
- Modify: `src/trpc/init.ts` (check if super-admin procedure exists)

- [ ] **Step 1: Add `pipeline` input to `getCustomerPipelineItems`**

```typescript
getCustomerPipelineItems: agentProcedure
  .input(z.object({
    pipeline: z.enum(customerPipelines).default('active'),
  }).optional())
  .query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id
    return getCustomerPipelineItems(userId, input?.pipeline ?? 'active')
  }),
```

Import `customerPipelines` from `@/shared/constants/enums`.

- [ ] **Step 2: Add `moveCustomerToPipeline` procedure**

Super-admin only. Check the user's role before executing:

```typescript
moveCustomerToPipeline: agentProcedure
  .input(z.object({
    customerId: z.string().uuid(),
    pipeline: z.enum(customerPipelines),
  }))
  .mutation(async ({ ctx, input }) => {
    if (ctx.session.user.role !== 'super-admin') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Only super-admins can move customers between pipelines' })
    }
    await moveCustomerToPipeline(input.customerId, input.pipeline)
  }),
```

Import `moveCustomerToPipeline` from the new DAL file. Import `TRPCError` from `@trpc/server`.

- [ ] **Step 3: Update `moveCustomerPipelineItem` input to include pipeline context**

The existing `moveCustomerPipelineItem` procedure needs to know which pipeline the drag is happening in, to route to the correct logic (active = update meetings/proposals, rehash/dead = update `pipelineStage`).

Add `pipeline` to the input schema and pass it through to the DAL function.

- [ ] **Step 4: Run typecheck and commit**

Run: `pnpm tsc --noEmit`

```
git commit -m "feat: add tRPC procedures for multi-pipeline queries and moves"
```

---

## Task 5: UI — Pipeline Toggle + View Updates

**Files:**
- Create: `src/features/customer-pipelines/ui/components/pipeline-select.tsx`
- Modify: `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx`

- [ ] **Step 1: Create `pipeline-select.tsx`**

A `Select` dropdown that shows current pipeline and allows switching. Only rendered for super-admin.

```typescript
'use client'

import type { CustomerPipeline } from '@/shared/types/enums'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'

const PIPELINE_LABELS: Record<CustomerPipeline, string> = {
  active: 'Active',
  rehash: 'Rehash',
  dead: 'Dead',
}

interface Props {
  value: CustomerPipeline
  onChange: (value: CustomerPipeline) => void
}

export function PipelineSelect({ value, onChange }: Props) {
  return (
    <Select value={value} onValueChange={v => onChange(v as CustomerPipeline)}>
      <SelectTrigger className="w-35">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(PIPELINE_LABELS).map(([key, label]) => (
          <SelectItem key={key} value={key}>{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 2: Update `customer-pipeline-view.tsx`**

Key changes:
1. Add `pipeline` state: `const [pipeline, setPipeline] = useState<CustomerPipeline>('active')`
2. Pass `pipeline` to query: `trpc.customerPipelinesRouter.getCustomerPipelineItems.queryOptions({ pipeline })`
3. Look up stage config from `pipelineConfigs[pipeline]` instead of hardcoded active config
4. Conditionally render `PipelineSelect` only for super-admin:

```typescript
import { useSession } from '@/shared/auth/client'
import { pipelineConfigs } from '@/features/customer-pipelines/constants/pipeline-config'
import { PipelineSelect } from '@/features/customer-pipelines/ui/components/pipeline-select'

// Inside component:
const session = useSession()
const isSuperAdmin = session.data?.user?.role === 'super-admin'
const config = pipelineConfigs[pipeline]

// In header, next to DataViewTypeToggle:
{isSuperAdmin && <PipelineSelect value={pipeline} onChange={setPipeline} />}

// Pass config to KanbanBoard:
<KanbanBoard
  stageConfig={config.stageConfig}
  allowedTransitions={config.allowedTransitions}
  blockedMessages={config.blockedMessages}
  // ... rest of props
/>
```

5. Update `handleMoveItem` to pass `pipeline` to the mutation
6. For rehash/dead, disable drag for non-super-admin (agents shouldn't see these pipelines, but as a safety measure)

- [ ] **Step 3: Run typecheck and commit**

Run: `pnpm tsc --noEmit`

```
git commit -m "feat: add pipeline toggle UI with role-gated visibility"
```

---

## Task 6: Lint + Final Verification

- [ ] **Step 1: Run lint and fix**

Run: `pnpm lint`
Fix any issues with: `npx eslint --fix <files>`

- [ ] **Step 2: Run typecheck**

Run: `pnpm tsc --noEmit`

- [ ] **Step 3: Manual test checklist**

Run: `pnpm dev`

Test as agent user:
- Pipeline view shows only active pipeline
- No pipeline toggle visible
- Kanban stages are the existing 8 active stages
- Drag behavior unchanged

Test as super-admin user:
- Pipeline toggle visible (Active / Rehash / Dead)
- Switching to "Rehash" shows 3-stage kanban (schedule_manager_meeting, made_contact, meeting_scheduled)
- Switching to "Dead" shows 2-stage kanban (mostly_dead, really_dead)
- Can drag customers within rehash/dead stages
- Moving a customer to a different pipeline via context menu/action works

- [ ] **Step 4: Commit any remaining fixes**

```
git commit -m "fix: lint and final adjustments for multi-pipeline"
```
