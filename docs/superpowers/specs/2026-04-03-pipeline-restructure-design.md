# Pipeline Restructure & Project Entity Design

> **Date:** 2026-04-03
> **Status:** Draft
> **Scope:** Schema redesign, shared pipeline infrastructure, sidebar UX, project entity evolution

---

## Table of Contents

1. [Context & Motivation](#1-context--motivation)
2. [Design Decisions Summary](#2-design-decisions-summary)
3. [Entity Model (New)](#3-entity-model-new)
4. [Schema Changes](#4-schema-changes)
5. [Pipeline Derivation Logic](#5-pipeline-derivation-logic)
6. [Meeting Outcome → Pipeline Auto-Assignment](#6-meeting-outcome--pipeline-auto-assignment)
7. [Shared Pipeline Infrastructure](#7-shared-pipeline-infrastructure)
8. [Pipeline Stage Definitions](#8-pipeline-stage-definitions)
9. [Sidebar UX](#9-sidebar-ux)
10. [Cross-Pipeline Movement](#10-cross-pipeline-movement)
11. [Project Entity Lifecycle](#11-project-entity-lifecycle)
12. [DAL & Query Changes](#12-dal--query-changes)
13. [Feature Boundary Changes](#13-feature-boundary-changes)
14. [Ubiquitous Language Updates](#14-ubiquitous-language-updates)
15. [Migration Strategy](#15-migration-strategy)
16. [Deferred Work (GitHub Issues)](#16-deferred-work-github-issues)
17. [Verification Plan](#17-verification-plan)

---

## 1. Context & Motivation

### The Problem

The current schema models pipelines as a **single bucket on the customer** (`customers.pipeline`: `'active' | 'rehash' | 'dead'`). This works for a pure sales pipeline but breaks down when:

- A customer has multiple addresses/projects at different lifecycle stages
- We need a post-sale "Projects" pipeline for construction project management
- A customer should appear in multiple pipelines simultaneously (e.g., signed project at Address A + fresh prospect at Address B)
- The business wants to run end-to-end operations (sales + project delivery) through the same dashboard

### The Solution

Move pipeline ownership from the **customer level** to the **meeting level** (with project override). Introduce the **Project** entity as a post-contract wrapper that groups meetings and reuses the existing `projects` table + showroom media UI.

### Key Insight

Pipeline membership is **derived**, not stored as a single field. A customer's presence in a pipeline is computed from:
- Their meetings' pipeline assignments
- Their projects' existence

This means a customer can naturally appear in Fresh AND Projects simultaneously.

---

## 2. Design Decisions Summary

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Project owns pipeline** (not customer) | Enables multi-address, multi-project customers |
| 2 | **Project created at DocuSign signing only** | Clean trigger — no speculative "draft projects." Meeting without projectId = Fresh pipeline |
| 3 | **Customer cards in every pipeline** | Consistent UX across all pipelines. Projects pipeline shows customer cards enriched with project data |
| 4 | **Extend existing `projects` table** | Reuses showroom media UI, image upload/grouping, and narrative fields for active construction projects |
| 5 | **`pipeline` field on meetings** (Approach A) | Explicit, queryable. Outcomes auto-update it, manual moves update it directly, `projectId` overrides it |
| 6 | **Meeting type deprecated** | `meetingType` (`'Fresh' | 'Follow-up' | 'Rehash'`) superseded by derived pipeline. Keep column for backward compat, stop relying on it |
| 7 | **Simple linear project stages** | `signed → permits_pending → in_progress → punch_list → completed` — exact names may refine |
| 8 | **Sidebar collapsible submenu** | "Pipeline" item with badge showing current selection, chevron expands to show Fresh/Projects/Rehash/Dead sub-items |
| 9 | **Customers can appear in multiple pipelines** | Derived from meetings + projects — not mutually exclusive buckets |
| 10 | **Pipelines become shared infrastructure** | Moved from `features/customer-pipelines/` to `src/shared/pipelines/` for cross-feature consumption |

---

## 3. Entity Model (New)

### Relationship Diagram

```
Customer (outer wrapper — owns everything)
│
├── Meeting (many) — the core sales/project touchpoint
│   ├── pipeline: 'fresh' | 'rehash' | 'dead' (stored, default: 'fresh')
│   ├── projectId: FK → projects (nullable)
│   │   └── IF projectId IS NOT NULL → meeting is in "projects" pipeline (overrides stored field)
│   │   └── IF projectId IS NULL → use meeting.pipeline field
│   ├── meetingOutcome: expanded enum (drives auto-pipeline assignment)
│   └── Proposal (many) — inherits pipeline context from its parent meeting
│
└── Project (many, inner wrapper — created at contract signing)
    ├── customerId: FK → customers (required)
    ├── ownerId: FK → user (required)
    ├── status: 'active' | 'completed' | 'on_hold'
    ├── pipelineStage: text (for project management progression)
    ├── [all existing fields: address, city, state, zip, isPublic, media, narratives...]
    └── Meetings (many) — meetings linked via meeting.projectId
```

### Key Relationships

```
Customer (1) ──→ (many) Meetings
Customer (1) ──→ (many) Projects
Meeting  (1) ──→ (many) Proposals
Meeting  (many) ──→ (1) Project [optional, via meeting.projectId]
Project  (1) ──→ (many) Meetings [via meetings where meeting.projectId = project.id]
Project  (1) ──→ (many) Proposals [indirectly, via project's meetings' proposals]
```

### Customer Pipeline Visibility (Derived)

A customer appears in pipeline X if:

```sql
-- Fresh/Rehash/Dead: customer has meetings in that pipeline with no projectId
EXISTS (
  SELECT 1 FROM meetings
  WHERE meetings.customer_id = customer.id
    AND meetings.project_id IS NULL
    AND meetings.pipeline = X   -- where X is 'fresh', 'rehash', or 'dead'
)

-- Projects: customer has at least one project
OR EXISTS (
  SELECT 1 FROM projects
  WHERE projects.customer_id = customer.id
    AND projects.status IN ('active', 'completed', 'on_hold')
)
```

**A customer CAN appear in multiple pipelines simultaneously.** Example: signed project at Address A (Projects) + fresh meeting at Address B (Fresh).

---

## 4. Schema Changes

### 4.1 `meetings` Table — MODIFY

**File:** `src/shared/db/schema/meetings.ts`

```
CURRENT COLUMNS:
  id, ownerId, customerId, meetingType, meetingOutcome, scheduledFor,
  contextJSON, flowStateJSON, agentNotes, createdAt, updatedAt

CHANGES:
  ADD    pipeline: meetingPipelineEnum('pipeline').notNull().default('fresh')
  ADD    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' })
  KEEP   meetingType — deprecated but kept for backward compat (stop relying on it in new code)
```

New columns:

| Column | Type | Default | Nullable | FK | Purpose |
|--------|------|---------|----------|-----|---------|
| `pipeline` | pgEnum `'fresh' \| 'rehash' \| 'dead'` | `'fresh'` | NOT NULL | — | Stored pipeline for non-project meetings |
| `projectId` | UUID | — | YES | `projects(id)` ON DELETE SET NULL | Links meeting to a construction project |

New relation to add in `meetingsRelations`:

```typescript
project: one(projects, {
  fields: [meetings.projectId],
  references: [projects.id],
})
```

### 4.2 `projects` Table — EXTEND

**File:** `src/shared/db/schema/projects.ts`

```
CURRENT COLUMNS:
  id, title, accessor, description, backstory, isPublic, address, city, state, zip,
  hoRequirements, homeownerName, homeownerQuote, projectDuration, completedAt,
  challengeDescription, solutionDescription, resultDescription,
  beforeDescription, duringDescription, afterDescription, mainDescription,
  beforeAfterPairsJSON, createdAt, updatedAt

NEW COLUMNS:
  ADD    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'cascade' })
  ADD    ownerId: text('owner_id').references(() => user.id, { onDelete: 'cascade' })
  ADD    status: projectStatusEnum('status').notNull().default('active')
  ADD    pipelineStage: text('pipeline_stage')
```

New columns:

| Column | Type | Default | Nullable | FK | Purpose |
|--------|------|---------|----------|-----|---------|
| `customerId` | UUID | — | YES | `customers(id)` ON DELETE CASCADE | Links project to customer (null for legacy portfolio-only projects) |
| `ownerId` | text | — | YES | `user(id)` ON DELETE CASCADE | Agent who owns the project (null for legacy portfolio-only) |
| `status` | pgEnum `'active' \| 'completed' \| 'on_hold'` | `'active'` | NOT NULL | — | Project lifecycle status |
| `pipelineStage` | text | — | YES | — | Current project management stage (e.g., `'signed'`, `'in_progress'`) |

New relations to add in `projectsRelations`:

```typescript
customer: one(customers, {
  fields: [projects.customerId],
  references: [customers.id],
}),
owner: one(user, {
  fields: [projects.ownerId],
  references: [user.id],
}),
meetings: many(meetings),  // meetings that reference this project via projectId
```

**Note:** `customerId` and `ownerId` are nullable to support existing portfolio-only project rows that predate this migration. All NEW projects (created at signing) will always have both set.

### 4.3 `customers` Table — MODIFY

**File:** `src/shared/db/schema/customers.ts`

```
REMOVE:
  pipeline: customerPipelineEnum('pipeline')    — no longer customer-level
  pipelineStage: text('pipeline_stage')          — no longer customer-level
```

These columns move conceptually to the meeting and project level. The customer becomes a pure container entity.

### 4.4 `meta.ts` — Enum Changes

**File:** `src/shared/db/schema/meta.ts`

```
ADD:
  meetingPipelineEnum = pgEnum('meeting_pipeline', meetingPipelines)
  projectStatusEnum = pgEnum('project_status', projectStatuses)

KEEP (for backward compat during migration):
  customerPipelineEnum — will be removed after migration completes

KEEP (unchanged):
  meetingOutcomeEnum — already has 'converted_to_project' in the enum
  meetingTypeEnum — deprecated but column stays
```

### 4.5 Const Arrays & Type Changes

**NEW file:** `src/shared/constants/enums/pipelines.ts`

```typescript
/** All business-wide pipelines (display + routing) */
export const pipelines = ['fresh', 'projects', 'rehash', 'dead'] as const

/** Pipelines storable on the meetings.pipeline column (projects is derived from projectId) */
export const meetingPipelines = ['fresh', 'rehash', 'dead'] as const

/** Project lifecycle statuses */
export const projectStatuses = ['active', 'completed', 'on_hold'] as const

/** Project management pipeline stages */
export const projectPipelineStages = [
  'signed',
  'permits_pending',
  'in_progress',
  'punch_list',
  'completed',
] as const
```

**NEW file:** `src/shared/types/enums/pipelines.ts`

```typescript
import type { meetingPipelines, pipelines, projectPipelineStages, projectStatuses } from '@/shared/constants/enums/pipelines'

export type Pipeline = (typeof pipelines)[number]
export type MeetingPipeline = (typeof meetingPipelines)[number]
export type ProjectStatus = (typeof projectStatuses)[number]
export type ProjectPipelineStage = (typeof projectPipelineStages)[number]
```

**UPDATE:** `src/shared/constants/enums/index.ts` — add re-export of `pipelines.ts`
**UPDATE:** `src/shared/types/enums/index.ts` — add re-export of `pipelines.ts`

---

## 5. Pipeline Derivation Logic

### Core Rule

```typescript
// src/shared/pipelines/lib/derive-meeting-pipeline.ts

import type { MeetingPipeline, Pipeline } from '@/shared/types/enums/pipelines'

interface MeetingPipelineInput {
  projectId: string | null
  pipeline: MeetingPipeline  // the stored field
}

/**
 * Derives the effective pipeline for a meeting.
 * If meeting has a projectId, it's in the "projects" pipeline regardless of stored field.
 * Otherwise, use the stored pipeline field.
 */
export function deriveMeetingPipeline(meeting: MeetingPipelineInput): Pipeline {
  if (meeting.projectId !== null) {
    return 'projects'
  }
  return meeting.pipeline
}
```

### Customer Pipeline Membership

```typescript
// src/shared/pipelines/lib/derive-customer-pipelines.ts

import type { Pipeline } from '@/shared/types/enums/pipelines'

interface CustomerPipelineInput {
  meetings: Array<{ projectId: string | null, pipeline: string }>
  projectCount: number  // number of projects owned by this customer
}

/**
 * Derives which pipelines a customer should appear in.
 * A customer can appear in MULTIPLE pipelines simultaneously.
 */
export function deriveCustomerPipelines(input: CustomerPipelineInput): Pipeline[] {
  const pipelineSet = new Set<Pipeline>()

  for (const meeting of input.meetings) {
    if (meeting.projectId !== null) {
      pipelineSet.add('projects')
    } else {
      pipelineSet.add(meeting.pipeline as Pipeline)
    }
  }

  // Customer with projects always shows in projects pipeline
  if (input.projectCount > 0) {
    pipelineSet.add('projects')
  }

  return Array.from(pipelineSet)
}
```

---

## 6. Meeting Outcome → Pipeline Auto-Assignment

When an agent selects a meeting outcome, the system auto-updates the meeting's pipeline field:

| Outcome | Pipeline Action | Additional Side Effect |
|---------|----------------|----------------------|
| `'not_set'` | No change (stays `'fresh'`) | — |
| `'proposal_created'` | No change (stays `'fresh'`) | Still in sales cycle |
| `'follow_up_needed'` | No change (stays `'fresh'`) | — |
| `'converted_to_project'` | Sets `projectId` → **Projects** pipeline (derived) | **Triggers project creation flow** (modal with project intake form). The meeting + its winning proposal get linked to the new project. |
| `'not_good'` | Auto-set `pipeline` to `'rehash'` | Customer may still be winnable |
| `'pns'` (present, not sold) | Auto-set `pipeline` to `'rehash'` | — |
| `'npns'` (not present, not sold) | Auto-set `pipeline` to `'rehash'` | — |
| `'ftd'` (failed to demo) | Auto-set `pipeline` to `'rehash'` | — |
| `'no_show'` | Auto-set `pipeline` to `'rehash'` | — |
| `'lost_to_competitor'` | Auto-set `pipeline` to `'dead'` | Archived |
| `'not_interested'` | Auto-set `pipeline` to `'dead'` | Deprecated but handled |

### Outcome-to-Pipeline Mapping (Code)

```typescript
// src/shared/pipelines/lib/outcome-pipeline-map.ts

import type { MeetingPipeline } from '@/shared/types/enums/pipelines'

/**
 * Maps meeting outcomes to their auto-assigned pipeline.
 * null = no change (stays on current pipeline).
 * 'converted_to_project' is handled separately (creates project, sets projectId).
 */
export const OUTCOME_PIPELINE_MAP: Record<string, MeetingPipeline | null> = {
  not_set: null,
  proposal_created: null,
  follow_up_needed: null,
  converted_to_project: null,  // handled via project creation flow, not pipeline field
  not_good: 'rehash',
  pns: 'rehash',
  npns: 'rehash',
  ftd: 'rehash',
  no_show: 'rehash',
  lost_to_competitor: 'dead',
  not_interested: 'dead',
}
```

### "Converted to Project" Flow

When agent selects `'converted_to_project'` as a meeting outcome:

1. **UI opens a "New Project" modal** (project intake form — to be designed separately, see Deferred Work)
2. Modal pre-fills: customer name, address from customer record, agent as owner
3. Agent confirms → system creates project record in `projects` table with:
   - `customerId` = meeting's customer
   - `ownerId` = meeting's owner (agent)
   - The triggering meeting (and its proposals) are linked via `meeting.projectId`
   - `status` = `'active'`
   - `pipelineStage` = `'signed'`
   - `isPublic` = `false`
   - `address`, `city`, `state`, `zip` from customer or modal input
4. System updates the meeting: `meeting.projectId = newProject.id`
5. System also links the proposal's meeting to the project (if proposal exists, that meeting gets `projectId` set)
6. Customer now appears in the **Projects** pipeline

---

## 7. Shared Pipeline Infrastructure

### New Module: `src/shared/pipelines/`

Pipelines become a **shared concept** consumed by multiple features. This replaces pipeline constants currently owned by `features/customer-pipelines/`.

```
src/shared/pipelines/
├── constants/
│   ├── pipeline-registry.ts        — master pipeline definitions & config map
│   ├── fresh-pipeline.ts           — stages, transitions, blocked messages for Fresh
│   ├── projects-pipeline.ts        — stages, transitions for Projects
│   ├── rehash-pipeline.ts          — stages, transitions for Rehash (same as current)
│   └── dead-pipeline.ts            — stages, transitions for Dead (same as current)
├── types/
│   └── index.ts                    — PipelineConfig, PipelineStageConfig, etc.
└── lib/
    ├── derive-meeting-pipeline.ts  — (meeting) → Pipeline
    ├── derive-customer-pipelines.ts — (meetings, projects) → Pipeline[]
    └── outcome-pipeline-map.ts     — outcome → auto-assigned pipeline
```

### Pipeline Registry

```typescript
// src/shared/pipelines/constants/pipeline-registry.ts

import type { Pipeline } from '@/shared/types/enums/pipelines'
import type { PipelineConfig } from '../types'

import { deadPipelineConfig } from './dead-pipeline'
import { freshPipelineConfig } from './fresh-pipeline'
import { projectsPipelineConfig } from './projects-pipeline'
import { rehashPipelineConfig } from './rehash-pipeline'

export const PIPELINE_LABELS: Record<Pipeline, string> = {
  fresh: 'Fresh',
  projects: 'Projects',
  rehash: 'Rehash',
  dead: 'Dead',
}

export const pipelineConfigs: Record<Pipeline, PipelineConfig> = {
  fresh: freshPipelineConfig,
  projects: projectsPipelineConfig,
  rehash: rehashPipelineConfig,
  dead: deadPipelineConfig,
}
```

### Pipeline Types

```typescript
// src/shared/pipelines/types/index.ts

import type { LucideIcon } from 'lucide-react'

export interface PipelineStageConfig<TStage extends string = string> {
  key: TStage
  label: string
  icon: LucideIcon
  color: string
}

export interface PipelineConfig<TStage extends string = string> {
  stages: readonly TStage[]
  stageConfig: readonly PipelineStageConfig<TStage>[]
  allowedTransitions: Record<TStage, readonly TStage[]>
  blockedMessages: Record<string, string>
}
```

---

## 8. Pipeline Stage Definitions

### 8.1 Fresh Pipeline (renamed from "Active")

**File:** `src/shared/pipelines/constants/fresh-pipeline.ts`

Same 9 stages as current active pipeline — content migrated from `features/customer-pipelines/constants/active-pipeline-stages.ts`:

```
needs_confirmation → meeting_scheduled → meeting_in_progress →
meeting_completed → follow_up_scheduled → proposal_sent →
contract_sent → approved → declined
```

Stages, icons, colors, allowed transitions, and blocked messages are **identical** to the current `activeStageConfig`. Only the naming context changes ("active" → "fresh").

Stage computation logic (`computeCustomerStage()`) remains the same — it's used to determine which kanban column a customer card sits in within the Fresh pipeline.

### 8.2 Projects Pipeline (NEW)

**File:** `src/shared/pipelines/constants/projects-pipeline.ts`

Simple linear stages for construction project management:

| Stage | Label | Icon | Color |
|-------|-------|------|-------|
| `signed` | Signed | `FileSignatureIcon` | green |
| `permits_pending` | Permits Pending | `ClipboardListIcon` | orange |
| `in_progress` | In Progress | `HammerIcon` | blue |
| `punch_list` | Punch List | `CheckSquareIcon` | yellow |
| `completed` | Completed | `CheckCircle2Icon` | green |

**Allowed drag transitions:**
```
signed → permits_pending
permits_pending → in_progress
in_progress → punch_list
punch_list → completed
```

**Blocked messages:**
```
default: 'This transition is not supported via drag'
```

Stage is stored on `projects.pipelineStage` (not computed like Fresh). Drag transitions update `projects.pipelineStage` directly.

### 8.3 Rehash Pipeline (Unchanged)

**File:** `src/shared/pipelines/constants/rehash-pipeline.ts`

Migrated from `features/customer-pipelines/constants/rehash-pipeline-stages.ts` — no changes to stages, transitions, or messages:

```
schedule_manager_meeting → made_contact → meeting_scheduled
```

### 8.4 Dead Pipeline (Unchanged)

**File:** `src/shared/pipelines/constants/dead-pipeline.ts`

Migrated from `features/customer-pipelines/constants/dead-pipeline-stages.ts` — no changes:

```
mostly_dead → really_dead
```

---

## 9. Sidebar UX

### Current State

The sidebar has a flat "Pipelines" nav item at `ROOTS.dashboard.pipelines()` with icon `GitBranchIcon`. Pipeline switching currently happens inside the pipelines view itself.

**File:** `src/features/agent-dashboard/lib/get-sidebar-nav.ts`

### New Design

The "Pipelines" item (renamed to singular **"Pipeline"**) becomes a **collapsible submenu** using shadcn's `Collapsible` + `SidebarMenuSub` pattern (see sidebar-05 example) combined with `SidebarMenuBadge`.

**Behavior:**

1. **Collapsed state (submenu closed):**
   - Shows `Pipeline` label with the currently selected pipeline name as a `SidebarMenuBadge` on the right (e.g., badge says "Fresh")
   - A `ChevronRightIcon` to the far right hints that clicking will expand
   - When the entire sidebar is collapsed (icon-only mode), badge and chevron are hidden — only the icon shows

2. **Expanded state (submenu open):**
   - Badge disappears
   - `ChevronDownIcon` replaces the chevron
   - `SidebarMenuSub` reveals 4 sub-items: **Fresh**, **Projects**, **Rehash**, **Dead**
   - The currently selected pipeline sub-item is highlighted (`isActive`)
   - Clicking a sub-item sets the active pipeline dashboard-wide and navigates to the kanban view for that pipeline

3. **Pipeline state persisted via URL:** `?pipeline=fresh` (using `nuqs` for type-safe URL state, consistent with existing `useTableUrlFilters` pattern)

4. **Dashboard-wide cascade:** When a pipeline is selected in the sidebar:
   - **Pipelines view** shows the kanban/table for that pipeline
   - **Meetings view** auto-filters to show only meetings belonging to the selected pipeline (derived via `deriveMeetingPipeline()`)
   - **Proposals view** auto-filters to show only proposals whose parent meeting belongs to the selected pipeline

### shadcn Components Used

- `SidebarMenuItem` + `SidebarMenuButton` — the "Pipeline" parent item
- `SidebarMenuBadge` — shows current pipeline name when collapsed
- `Collapsible` + `CollapsibleTrigger` + `CollapsibleContent` — expand/collapse
- `SidebarMenuSub` + `SidebarMenuSubItem` + `SidebarMenuSubButton` — sub-items for each pipeline
- `ChevronRightIcon` / `ChevronDownIcon` — expand hint (via `group-data-[state=open/closed]` pattern from sidebar-05)

### Sidebar Nav Config Change

```typescript
// Updated getSidebarNav() — Pipeline item becomes a collapsible group

// The "Pipeline" item in baseItems is no longer a simple link.
// It becomes a collapsible with sub-items.
// Implementation detail: either handle in getSidebarNav return type (add `children` field)
// or handle directly in the AppSidebar component with a special case for the Pipeline item.

// Recommended: Add optional `children` field to SidebarNavItem:
export interface SidebarNavItem {
  href: string
  icon: LucideIcon
  label: string
  enabled: boolean
  children?: readonly SidebarNavSubItem[]  // NEW
}

export interface SidebarNavSubItem {
  key: string       // pipeline key: 'fresh' | 'projects' | 'rehash' | 'dead'
  label: string     // display: 'Fresh' | 'Projects' | 'Rehash' | 'Dead'
  href: string      // e.g., /dashboard/pipelines?pipeline=fresh
}
```

---

## 10. Cross-Pipeline Movement

### Current Implementation

**File:** `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts`

Currently updates `customers.pipeline` and `customers.pipelineStage`. Also handles meeting outcome changes for certain active pipeline transitions.

### New Implementation

Cross-pipeline movement now operates on **meetings**, not customers.

**"Move to Rehash"** (from Fresh pipeline):
1. Find all of the customer's meetings where `pipeline = 'fresh'` and `projectId IS NULL`
2. Update those meetings: `SET pipeline = 'rehash'`
3. Customer disappears from Fresh (if no other fresh meetings remain) and appears in Rehash

**"Move to Dead"** (from Fresh or Rehash pipeline):
1. Find all of the customer's meetings where `pipeline` = source pipeline and `projectId IS NULL`
2. Update those meetings: `SET pipeline = 'dead'`
3. Customer moves to Dead pipeline

**"Move to Fresh"** (from Rehash or Dead — reactivate):
1. Find all of the customer's meetings in the source pipeline
2. Update: `SET pipeline = 'fresh'`
3. Customer reappears in Fresh

**Projects pipeline movement:**
- Fresh → Projects: **Automatic only** (triggered by DocuSign signing / "Converted to project" outcome). No manual move.
- Projects → Dead: Archive the project (`projects.status = 'on_hold'`). Customer may still have other active projects.

### Context Menu Updates

The existing context menu on customer kanban cards (shadcn ContextMenu) keeps its "Move to Pipeline" sub-menu. Adjustments:

- The sub-menu shows: Fresh, Rehash, Dead (NOT Projects — that's automatic only)
- Clicking "Rehash" or "Dead" updates the `meetings.pipeline` field on the customer's relevant meetings
- If the customer is in the Projects pipeline, the context menu additionally shows "Archive Project" which sets `projects.status = 'on_hold'`

### Multi-Pipeline Indicator

Since a customer can appear in multiple pipelines, we need a visual indicator on the customer card. Design:

- Small pipeline badge(s) on the customer kanban card showing which OTHER pipelines this customer also appears in
- Example: Customer card in Fresh pipeline shows a small "Projects" badge if they also have an active project
- This helps agents understand the customer's full picture at a glance

---

## 11. Project Entity Lifecycle

### Creation

**Trigger:** Agent selects `'converted_to_project'` meeting outcome.

**Flow:**
1. Outcome selection triggers a "New Project" modal (intake form)
2. Modal pre-fills from customer data: name, address, city, state, zip
3. Agent can adjust address (for cases where the project address differs from customer's primary address)
4. On submit:
   - `INSERT INTO projects` with `customerId`, `ownerId`, `status = 'active'`, `pipelineStage = 'signed'`, `isPublic = false`
   - `UPDATE meetings SET project_id = newProject.id` for the triggering meeting
   - If the meeting has proposals with status `'approved'`, those proposals' meeting also gets `projectId` set

### Lifecycle States

| Status | Meaning |
|--------|---------|
| `'active'` | Construction in progress or signed and awaiting start |
| `'completed'` | Work finished. Can be promoted to portfolio (`isPublic = true`) |
| `'on_hold'` | Paused or archived. Effectively "dead" for the project pipeline |

### Portfolio Promotion

When `status = 'completed'`, the agent can flip `isPublic = true` to promote the project to the public showroom/portfolio. This reuses the existing showroom UI — the project already has all the media fields, narrative descriptions, before/after pairs, etc.

### Project → Showroom Continuity

The existing showroom feature (`src/features/showroom/`) evolves:

- **Before:** Only managed portfolio projects (manually created, no customer link)
- **After:** Manages ALL projects — active construction projects (private) and portfolio items (public)
- The showroom table/grid gets a filter for `isPublic` / `status` to switch between "active projects" and "portfolio"
- The feature directory may be renamed from `showroom/` to a broader name (deferred — see GitHub Issues)

---

## 12. DAL & Query Changes

### 12.1 `getCustomerPipelineItems()` — Major Rewrite

**File:** `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts`

**Current:** Filters by `customers.pipeline = ?` and computes stages.

**New:** Filters by derived pipeline membership:

- **For Fresh/Rehash/Dead pipelines:**
  - Join customers → meetings WHERE `meetings.pipeline = ?` AND `meetings.project_id IS NULL`
  - Group by customer
  - Stage computation for Fresh remains the same (`computeCustomerStage()`)
  - Stage for Rehash/Dead comes from a stored value (mechanism TBD — could be stored on the meeting or computed from the pipeline's stage definitions)

- **For Projects pipeline:**
  - Join customers → projects WHERE `projects.status IN ('active', 'completed')`
  - Join projects → meetings WHERE `meetings.project_id = projects.id` (for enrichment)
  - Stage = `projects.pipelineStage`
  - Customer card enriched with project data (address, status, stage, scope count)

### 12.2 `moveCustomerPipelineItem()` — Rewrite

**File:** `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts`

**Current:** Updates `customers.pipeline` and `customers.pipelineStage`, handles meeting outcome changes.

**New:**
- For Fresh pipeline intra-stage drags: same logic (update meeting outcomes for stage transitions)
- For Projects pipeline intra-stage drags: update `projects.pipelineStage`
- For Rehash/Dead intra-stage drags: update a stage tracking mechanism for the customer's meetings in that pipeline
- For cross-pipeline moves: update `meetings.pipeline` on relevant meetings (see Section 10)

### 12.3 Meeting Outcome Update Hook

When `meetings.meetingOutcome` is updated (via the meetings tRPC router `update` procedure), add server-side logic:

1. Look up `OUTCOME_PIPELINE_MAP[newOutcome]`
2. If result is not `null`, update `meetings.pipeline` to the mapped value
3. If outcome is `'converted_to_project'`, trigger project creation flow (return signal to client to open modal)

### 12.4 Meetings & Proposals Filtering

When the dashboard has an active pipeline selection (via URL param `?pipeline=fresh`):

- **Meetings view** (`getAll` procedure or its DAL): add optional `pipeline` filter parameter
  - For `'fresh' | 'rehash' | 'dead'`: `WHERE meetings.pipeline = ? AND meetings.project_id IS NULL`
  - For `'projects'`: `WHERE meetings.project_id IS NOT NULL`

- **Proposals view** (`getProposals` procedure or its DAL): filter via meeting join
  - `JOIN meetings ON proposals.meeting_id = meetings.id`
  - Apply same pipeline derivation filter as above

---

## 13. Feature Boundary Changes

### What Moves to `src/shared/pipelines/`

From `src/features/customer-pipelines/constants/`:
- `active-pipeline-stages.ts` → `src/shared/pipelines/constants/fresh-pipeline.ts` (renamed)
- `rehash-pipeline-stages.ts` → `src/shared/pipelines/constants/rehash-pipeline.ts`
- `dead-pipeline-stages.ts` → `src/shared/pipelines/constants/dead-pipeline.ts`
- `pipeline-config.ts` → `src/shared/pipelines/constants/pipeline-registry.ts` (extended with Projects)
- `pipeline-labels.ts` → merged into `pipeline-registry.ts`

From `src/features/customer-pipelines/lib/`:
- `compute-customer-stage.ts` → `src/shared/pipelines/lib/compute-fresh-stage.ts` (renamed for clarity)

**NEW files** in `src/shared/pipelines/`:
- `constants/projects-pipeline.ts`
- `lib/derive-meeting-pipeline.ts`
- `lib/derive-customer-pipelines.ts`
- `lib/outcome-pipeline-map.ts`
- `types/index.ts`

### What Stays in `src/features/customer-pipelines/`

- `ui/` — all kanban views, customer cards, profile modal, timeline
- `dal/` — pipeline-specific DAL queries (rewritten to use new schema)
- `types/` — `CustomerPipelineItem`, `CustomerProfileData`, etc.
- `constants/profile-field-enums.ts` — customer profile enum options for the modal
- `lib/build-timeline-events.ts` — timeline construction

### Showroom Feature Evolution

`src/features/showroom/` currently owns portfolio project management. It needs to evolve to handle both active construction projects and portfolio items:

- Add filtering by `status` and `isPublic` in the showroom table
- The project detail sheet / edit form works for both types (construction projects just have `isPublic = false`)
- Feature may eventually be renamed (deferred to GitHub issue)

### New Shared Enum Files

- `src/shared/constants/enums/pipelines.ts` (NEW)
- `src/shared/types/enums/pipelines.ts` (NEW)
- `src/shared/constants/enums/customer-pipelines.ts` — **deprecated** (kept during migration only)

---

## 14. Ubiquitous Language Updates

**File:** `docs/domain/ubiquitous-language.md`

### Updates to Core Entities

| Term | Old Definition | New Definition |
|------|---------------|----------------|
| **Project** | A completed remodeling job with media, narrative, and metrics. Shown in portfolio/showroom. | A construction engagement at a specific address. Created at contract signing. Has lifecycle: `active → completed → on_hold`. When `isPublic = true`, appears in portfolio/showroom. |

### New Terms to Add

| Term | Definition |
|------|-----------|
| **SFH** (Single Family Home) | A residential structure type — the primary unit of work. A project is typically associated with a single SFH at a unique physical address. |
| **Pipeline** (updated) | A business-wide workflow track: `fresh` (new sales), `projects` (active construction), `rehash` (re-engagement), `dead` (archived). Pipeline membership is derived from meetings and projects, not stored on the customer. A customer can appear in multiple pipelines simultaneously. |
| **Fresh Pipeline** | For chasing new projects. Contains customers with meetings that have no `projectId`. Replaces the old "active" pipeline. |
| **Projects Pipeline** | For managing signed construction work. Contains customers who have at least one project. Meetings in this pipeline have a `projectId` set. |

### Updates to Pipeline & Lifecycle Section

Replace:
```
| Customer Pipeline | Bucket: active (engaged), rehash (re-engagement eligible), dead (closed). |
| Pipeline Stage | Computed from meetings + proposals: needs_confirmation → ... |
```

With:
```
| Pipeline | Business-wide workflow track: fresh, projects, rehash, dead. Derived from meetings + projects. |
| Pipeline (on meeting) | Stored field: fresh | rehash | dead. If meeting.projectId is set, effective pipeline is "projects" (overrides stored field). |
| Fresh Pipeline Stage | Computed from meetings + proposals: needs_confirmation → meeting_scheduled → ... → approved | declined. |
| Projects Pipeline Stage | Stored on project: signed → permits_pending → in_progress → punch_list → completed. |
| Rehash Pipeline Stage | Stored: schedule_manager_meeting → made_contact → meeting_scheduled. |
| Dead Pipeline Stage | Stored: mostly_dead → really_dead. |
```

### Updates to Features Table

| Feature | Old | New |
|---------|-----|-----|
| Showroom | Public portfolio + agent project editor | All projects (active construction + portfolio). Filter by status/isPublic. |

### Updates to Terminology Rules

Add:
```
- **Pipeline** now refers to business workflow tracks (fresh/projects/rehash/dead), not customer buckets
- **Project** is an active construction engagement, not just a portfolio item
- **SFH** always uppercase. Full form: "Single Family Home"
```

---

## 15. Migration Strategy

### Database Migration Steps

1. **Add new columns (non-breaking):**
   - `meetings.pipeline` (`meeting_pipeline` enum, default `'fresh'`)
   - `meetings.project_id` (UUID, nullable)
   - `projects.customer_id` (UUID, nullable)
   - `projects.owner_id` (text, nullable)
   - `projects.proposal_id` (UUID, nullable)
   - `projects.status` (`project_status` enum, default `'active'`)
   - `projects.pipeline_stage` (text, nullable)

2. **Backfill meeting pipeline from customer pipeline:**
   ```sql
   -- Set meeting.pipeline based on the customer's current pipeline value
   UPDATE meetings m
   SET pipeline = CASE
     WHEN c.pipeline = 'active' THEN 'fresh'
     WHEN c.pipeline = 'rehash' THEN 'rehash'
     WHEN c.pipeline = 'dead' THEN 'dead'
   END
   FROM customers c
   WHERE m.customer_id = c.id;
   ```

3. **Deploy new code** that reads from `meetings.pipeline` and `projects.*` new columns.

4. **Drop old columns** (in a follow-up migration, after verification):
   - `customers.pipeline`
   - `customers.pipelineStage`

### Data Integrity

- Existing portfolio-only projects (no customer link) retain `customerId = NULL`, `ownerId = NULL` — they function as before
- All existing meetings get `pipeline = 'fresh'` (for active customers) or mapped value based on `customers.pipeline`
- No existing meetings have `projectId` — that's expected (projects are created going forward)

---

## 16. Deferred Work (GitHub Issues)

Create the following GitHub issues:

### Issue 1: Project Intake Form Modal
**Title:** `feat: project intake form modal (triggered by "Converted to Project" outcome)`
**Body:** Design and implement the modal that opens when an agent selects the "Converted to project" meeting outcome. Should pre-fill from customer data, allow address adjustment, and create the project record.

### Issue 2: Pipeline-Specific Meeting Fields
**Title:** `feat: extend meeting entity with pipeline-specific fields and context`
**Body:** Meetings in the Projects pipeline may need different fields, context, and UX than Fresh meetings. Design the distinction between pipeline-specific meeting types (different intake forms, different context panels, different flow steps). Reference: pipeline restructure spec section on derived meeting types.

### Issue 3: Showroom → Projects Feature Rename
**Title:** `refactor: evolve showroom feature to unified projects feature`
**Body:** The showroom feature currently manages portfolio projects only. It needs to evolve to manage all projects (active construction + portfolio). Consider renaming the feature directory from `showroom/` to `projects/` and adding status/isPublic filtering.

### Issue 4: Multi-Pipeline Customer Card Indicator
**Title:** `feat: visual indicator for customers appearing in multiple pipelines`
**Body:** When a customer appears in more than one pipeline simultaneously (e.g., Fresh + Projects), their kanban card should show badge(s) indicating which other pipelines they appear in. Design the UI treatment.

### Issue 5: Deprecate `meetingType` Column
**Title:** `chore: deprecate meetingType enum and column`
**Body:** The `meetingType` column (`'Fresh' | 'Follow-up' | 'Rehash'`) is superseded by derived pipeline membership. Plan removal: stop writing new values, remove from UI, eventually drop column. Keep for backward compat during transition.

### Issue 6: Auto-Stale Project Detection
**Title:** `feat: auto-detect stale projects for rehash pipeline`
**Body:** Implement automatic detection of projects/meetings that have gone stale (no activity for X days) and suggest or auto-move them to the Rehash pipeline. Currently movement to Rehash is manual only.

---

## 17. Verification Plan

### Schema Verification
- [ ] Run `pnpm db:push` — new columns added without errors
- [ ] Run migration backfill SQL — meetings get correct pipeline values
- [ ] Verify existing portfolio projects unaffected (`customerId = NULL`)
- [ ] `pnpm tsc` passes — all type changes compile
- [ ] `pnpm lint` passes — all imports sorted, no violations

### Pipeline Derivation
- [ ] Meeting with no projectId → derived pipeline matches `meetings.pipeline` field
- [ ] Meeting with projectId set → derived pipeline is `'projects'` regardless of field
- [ ] Customer with meetings in Fresh + a project → appears in BOTH Fresh and Projects pipeline views
- [ ] Customer with all meetings moved to Rehash → disappears from Fresh, appears in Rehash

### Sidebar UX
- [ ] "Pipeline" item shows badge with current selection when submenu collapsed
- [ ] Chevron indicates expandability
- [ ] Clicking expands to show Fresh/Projects/Rehash/Dead sub-items
- [ ] Currently selected pipeline is highlighted
- [ ] Badge disappears when submenu is open
- [ ] In icon-only collapsed sidebar mode, no badge or chevron shown
- [ ] Selecting a pipeline updates URL param and filters all views

### Meeting Outcome Flow
- [ ] Selecting `'converted_to_project'` opens project intake modal
- [ ] Creating project sets `meeting.projectId` and `project.pipelineStage = 'signed'`
- [ ] Selecting `'no_show'` auto-sets `meeting.pipeline = 'rehash'`
- [ ] Selecting `'lost_to_competitor'` auto-sets `meeting.pipeline = 'dead'`

### Cross-Pipeline Movement
- [ ] Context menu "Move to Rehash" updates `meetings.pipeline` for the customer's fresh meetings
- [ ] Customer disappears from Fresh, appears in Rehash
- [ ] "Move to Fresh" from Rehash reverses the move
- [ ] Projects pipeline cards do NOT show "Move to Fresh/Rehash" — only "Archive Project"

### Meetings & Proposals Filtering
- [ ] With `?pipeline=fresh`, meetings view shows only meetings with `pipeline = 'fresh'` and no projectId
- [ ] With `?pipeline=projects`, meetings view shows only meetings with projectId set
- [ ] Proposals inherit filtering from their parent meeting's pipeline

### Backward Compatibility
- [ ] Existing customer pipeline data migrated correctly to meeting-level pipeline
- [ ] Existing showroom/portfolio projects still display and edit correctly
- [ ] Old `meetingType` values don't break anything (column kept, just not relied on)

---

## Appendix: Critical File Paths

| File | Change Type | Purpose |
|------|-------------|---------|
| `src/shared/db/schema/meetings.ts` | MODIFY | Add `pipeline`, `projectId` columns |
| `src/shared/db/schema/projects.ts` | MODIFY | Add `customerId`, `ownerId`, `status`, `pipelineStage` |
| `src/shared/db/schema/customers.ts` | MODIFY | Remove `pipeline`, `pipelineStage` |
| `src/shared/db/schema/meta.ts` | MODIFY | Add `meetingPipelineEnum`, `projectStatusEnum` |
| `src/shared/constants/enums/pipelines.ts` | NEW | Shared pipeline const arrays |
| `src/shared/types/enums/pipelines.ts` | NEW | Pipeline TS types |
| `src/shared/pipelines/` (entire directory) | NEW | Shared pipeline infrastructure |
| `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` | REWRITE | Query by meeting pipeline, not customer pipeline |
| `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts` | REWRITE | Move meetings between pipelines, not customers |
| `src/features/customer-pipelines/constants/` | MIGRATE | Move to `src/shared/pipelines/constants/` |
| `src/features/customer-pipelines/lib/compute-customer-stage.ts` | MIGRATE | Move to `src/shared/pipelines/lib/compute-fresh-stage.ts` |
| `src/features/agent-dashboard/lib/get-sidebar-nav.ts` | MODIFY | Pipeline collapsible submenu |
| `src/features/agent-dashboard/ui/components/app-sidebar.tsx` | MODIFY | Render collapsible pipeline submenu with badge |
| `src/trpc/routers/meetings.router.ts` | MODIFY | Outcome → pipeline auto-assignment logic |
| `src/trpc/routers/customer-pipelines.router.ts` | MODIFY | Adjust for new schema |
| `docs/domain/ubiquitous-language.md` | MODIFY | Update Project definition, add SFH, update Pipeline terms |