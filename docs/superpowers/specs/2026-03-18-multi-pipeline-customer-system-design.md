# Multi-Pipeline Customer System Design

## Problem

The customer-pipelines feature currently supports a single pipeline with 8 computed stages. The business needs multiple pipeline types (active, rehash, dead) where:
- **Active**: stages are computed from meeting/proposal data (existing logic)
- **Rehash**: stages are manually set by super-admin (`schedule_manager_meeting` -> `made_contact` -> `meeting_scheduled`)
- **Dead**: stages are manually set by super-admin (`mostly_dead` -> `really_dead`)

Only super-admin users can see the pipeline toggle and move customers between pipelines. Agents see only the "Active" pipeline.

## Schema Changes

### New columns on `customers` table

```typescript
pipeline: customerPipelineEnum('pipeline').notNull().default('active')
pipelineStage: text('pipeline_stage')       // null = compute from data (active pipeline)
```

- `pipeline`: which pipeline bucket the customer belongs to
- `pipelineStage`: explicitly stored stage for rehash/dead pipelines. **null** for active pipeline (stage is computed from meetings/proposals)

### New enum

In `src/shared/db/schema/meta.ts`:
```typescript
export const customerPipelineEnum = pgEnum('customer_pipeline', customerPipelines)
```

In `src/shared/constants/enums/customer-pipelines.ts`:
```typescript
export const customerPipelines = ['active', 'rehash', 'dead'] as const
```

In `src/shared/types/enums/customer-pipelines.ts`:
```typescript
export type CustomerPipeline = (typeof customerPipelines)[number]
```

## Pipeline Stage Definitions

### Active Pipeline (computed — existing logic unchanged)

Stages derived from `[...meetingPipelineStages, ...proposalPipelineStages]`:
`meeting_scheduled` -> `meeting_in_progress` -> `meeting_completed` -> `follow_up_scheduled` -> `proposal_sent` -> `contract_sent` -> `approved` / `declined`

Computation: `computeCustomerStage()` reads meeting statuses + proposal statuses. No changes to this function.

### Rehash Pipeline (manually set by super-admin)

```typescript
export const rehashPipelineStages = [
  'schedule_manager_meeting',
  'made_contact',
  'meeting_scheduled',
] as const
```

### Dead Pipeline (manually set by super-admin)

```typescript
export const deadPipelineStages = [
  'mostly_dead',
  'really_dead',
] as const
```

### Stage Config Structure

Each pipeline gets its own `KanbanStageConfig[]` with icons, colors, labels. These live in `src/features/customer-pipelines/constants/` as separate files per pipeline (e.g., `active-pipeline-stages.ts`, `rehash-pipeline-stages.ts`, `dead-pipeline-stages.ts`).

## Stage Resolution

The existing `computeCustomerStage()` function is wrapped by a resolver:

```typescript
function resolveCustomerStage(customer, meetingData?, proposalData?): string {
  if (customer.pipeline === 'active') {
    return computeCustomerStage(meetingData, proposalData)  // existing logic
  }
  return customer.pipelineStage  // stored value for rehash/dead
}
```

For the active pipeline, `pipelineStage` column is always `null` — the compute function is the source of truth. For rehash/dead, the stored `pipelineStage` value is the source of truth.

## DAL Changes

### `get-customer-pipeline-items.ts`

Currently fetches all customers with meetings for a given user. Needs to:
1. Accept a `pipeline` filter parameter
2. For `active`: existing query + compute logic (unchanged)
3. For `rehash`/`dead`: simpler query — fetch customers where `pipeline = 'rehash'`, read `pipelineStage` directly from the column (no meeting/proposal aggregation needed)

### New procedure: `moveCustomerPipeline`

Super-admin only. Sets `pipeline` and `pipelineStage` on a customer.

```typescript
input: {
  customerId: string
  pipeline: CustomerPipeline
  pipelineStage: string | null  // null when moving to active (computed)
}
```

When moving to `active`: set `pipelineStage = null`.
When moving to `rehash`: set `pipelineStage = 'schedule_manager_meeting'` (first stage).
When moving to `dead`: set `pipelineStage = 'mostly_dead'` (first stage).

### Stage drag within rehash/dead

Super-admin can drag customers between stages within rehash/dead. This updates only `pipelineStage` (not `pipeline`).

## UI Changes

### Pipeline Toggle (super-admin only)

A `Select` dropdown in the pipeline view header, next to the existing `DataViewTypeToggle`. Shows current pipeline name ("Active", "Rehash", "Dead"). Only rendered when `user.role === 'super-admin'`.

When toggled, the kanban/table re-queries with the selected pipeline filter. Stage config, columns, and allowed transitions update to match the selected pipeline.

### Role Gating

- `role === 'agent'`: sees only active pipeline, no toggle, no pipeline move actions
- `role === 'super-admin'`: sees toggle, can move customers between pipelines, can drag stages in rehash/dead

## What Stays the Same

- Active pipeline computation logic (`computeCustomerStage()`) — untouched
- Kanban/table components — they already accept `stageConfig` as props
- Customer profile modal — unchanged
- All existing UI components — they render based on props, not pipeline type
- Meeting/proposal data flow — unchanged
