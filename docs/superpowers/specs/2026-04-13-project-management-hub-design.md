# Project Management Hub — Design Spec

**Date:** 2026-04-13
**Status:** Draft
**Related Issues:** #69 (showroom->projects refactor, partially done), #67 (project intake modal), #41 (bulk image actions), #64 (related portfolio projects), #72 (stale project detection), #68 (pipeline-specific meeting fields)

## Context

The `project-management` feature (renamed from `showroom`) currently serves only as a portfolio showcase editor. Active construction projects exist in the DB with 11 pipeline stages and full lifecycle tracking, but agents have no dedicated UI to manage them. The edit page has two tabs (Photos + Metadata) that are 100% portfolio-focused.

This spec transforms the project edit page into a tabbed project management hub -- the central place an agent goes to manage an active construction project from signing through completion. Portfolio/story content becomes one tab among many, and new capabilities (tasks, documents, wishlist/upsells, meetings) are added.

## Decisions Made

- **Approach:** Full tabbed hub with schema changes (tasks table, wishlistJSON, media category). Stubs for Financials (QB) and Gmail document import.
- **Tasks table:** Centralized with `contextType`/`contextId` pattern (not project-specific). Reusable for meetings and future entities.
- **Wishlist storage:** JSONB column on projects table (`wishlistJSON`), consistent with how proposals and meetings store scope data.
- **Document storage:** Same `media_files` table with new `category` column. No separate documents table.
- **Project creation:** Always requires a proposal. Manual creation from `/dashboard/projects` uses a proposal picker flow.
- **Landing page:** Same data table with added status + pipeline stage filters.

---

## 1. Schema Changes

### 1a. New Table: `tasks`

Location: `src/shared/db/schema/tasks.ts`

```
tasks:
  id              uuid PK defaultRandom
  title           varchar(200) NOT NULL
  description     text nullable
  status          taskStatusEnum('todo', 'in_progress', 'done') default 'todo'
  priority        taskPriorityEnum('low', 'medium', 'high', 'urgent') default 'medium'
  contextType     taskContextTypeEnum('project', 'meeting') NOT NULL
  contextId       uuid NOT NULL
  assigneeId      text nullable (FK to auth user)
  dueDate         timestamp(withTimezone, mode:'string') nullable
  sortOrder       integer default 0
  completedAt     timestamp(withTimezone, mode:'string') nullable
  createdAt       timestamp(withTimezone, mode:'string') defaultNow
  updatedAt       timestamp(withTimezone, mode:'string') defaultNow.$onUpdate
```

Enums go in `src/shared/db/schema/meta.ts`. Const arrays in `src/shared/constants/enums/tasks.ts`. Types in `src/shared/types/enums/tasks.ts`.

Index on `(contextType, contextId)` for efficient lookups.

No DB-level FK on `contextId` -- referential integrity enforced in tRPC router (validate that the referenced entity exists before creating/updating).

### 1b. New Column on `projects`

```
wishlistJSON    jsonb nullable
```

Zod schema in `src/shared/entities/projects/schemas.ts`:

```ts
export const wishlistItemSchema = z.object({
  tradeId: z.string().uuid(),
  scopeIds: z.array(z.string().uuid()),
  notes: z.string().optional(),
})

export const wishlistSchema = z.array(wishlistItemSchema)
export type WishlistItem = z.infer<typeof wishlistItemSchema>
export type Wishlist = z.infer<typeof wishlistSchema>
```

### 1c. New Column on `media_files`

```
category    mediaFileCategoryEnum default 'photo'
```

Enum values: `photo`, `contract`, `addendum`, `completion_certificate`, `hoa_approval`, `payment`, `scan`, `general_document`

Existing rows default to `photo` via the column default. The migration should NOT backfill existing rows -- they'll get `photo` as the default. Gallery tab filters `category = 'photo'`. Documents tab filters `category NOT IN ('photo')`.

---

## 2. Page Structure

**Route:** `/dashboard/projects/[projectId]` (existing, currently renders `EditProjectView`)

**New view:** `ProjectManagementView` replaces `EditProjectView`

### Tab Bar (8 tabs)

| Order | Tab | Status | Data Source |
|-------|-----|--------|-------------|
| 1 | Overview | Fully functional | projects table + proposals + meetings + tasks |
| 2 | Scope & SOW | Fully functional | x_projectScopes + wishlistJSON |
| 3 | Tasks | Functional (minimal) | New tasks table |
| 4 | Meetings | Fully functional | meetings table (projectId FK) |
| 5 | Documents | Fully functional | media_files (category != photo) |
| 6 | Gallery | Existing, relocated | media_files (category = photo) |
| 7 | Financials | Stub + existing data | proposals (contract value) |
| 8 | Story | Existing, relocated | projects table (narrative fields) |

Tab selection persisted via nuqs URL param (`?tab=overview`).

---

## 3. Tab Specifications

### 3.1 Overview Tab

**Layout:** Header section + grid of info cards + snapshot widgets

**Header:**
- Title (inline editable)
- Customer name (link to customer profile in pipeline)
- Address (read-only, derived from customer or project)
- Assigned agent badge

**Inline Controls (editable):**
- Status selector: `active` | `completed` | `on_hold`
- Pipeline stage selector: 11 stages from projects pipeline config
- `isPublic` toggle (portfolio visibility)
- URL slug (editable text, for portfolio URL)
- Description (textarea)

**Key Dates:**
- Signed (from project creation / `createdAt`)
- Started (`startedAt`, editable date picker)
- Completed (`completedAt`, editable date picker)

**Contract Value:**
- Derived from sum of approved proposals linked via meetings
- Read-only display

**Wishlist Snapshot:**
- Compact list of trades + scope count from `wishlistJSON`
- "Edit in Scope & SOW" link navigates to tab

**Upcoming Meetings Widget:**
- Next 3 meetings where `meetings.projectId = this project` and `scheduledFor > now`
- Each row: date, type badge, outcome badge
- "View all" links to Meetings tab

**Tasks Widget:**
- Overdue tasks (due date < now, status != done) + next 3 upcoming
- Each row: title, priority badge, due date
- "View all" links to Tasks tab

### 3.2 Scope & SOW Tab

**Contracted Scopes Section:**
- Read from `x_projectScopes` joined with scopes and trades tables
- Each scope card: trade name, scope label, SOW text (from `scopes.scopeOfWorkBase`)
- Read-only -- these are locked from the approved proposal
- Grouped by trade

**Wishlist Section:**
- Header: "Wishlist (Upsell Opportunities)"
- Trade & scope selector -- **reuse the intake form variant** from `src/features/meetings/ui/components/steps/` that auto-opens the scope picker when a trade is selected
- Edits `wishlistJSON` on the project via tRPC mutation
- Agent can add/remove trades and scopes freely
- Optional notes per wishlist item
- Visual distinction from contracted scopes (different styling, e.g., dashed border or muted color)

### 3.3 Tasks Tab

**Layout:** Simple checklist with inline add

**Task Row:**
- Checkbox (toggles status: todo <-> done)
- Title (inline editable)
- Priority badge (color-coded: low=blue, medium=yellow, high=orange, urgent=red)
- Due date (date picker)
- Assignee avatar (nullable)
- Delete action

**Add Task:**
- Inline form at top or bottom: title input + optional due date + add button
- Defaults: status=todo, priority=medium, contextType=project, contextId=projectId

**Filters:**
- Status: all | todo | in_progress | done
- Default: show all non-done tasks, done tasks collapsed below

**tRPC Router:** `tasksRouter` in `src/trpc/routers/tasks.router.ts`
- `getByContext(contextType, contextId)` -- list tasks for an entity
- `create(task)` -- create task with context
- `update(id, data)` -- update task fields
- `delete(id)` -- delete task
- `reorder(updates)` -- batch update sortOrder
- `toggleStatus(id)` -- quick toggle todo<->done (sets completedAt)

### 3.4 Meetings Tab

**Layout:** List of linked meetings + action button

**Meeting Row:**
- Scheduled date/time
- Meeting type badge (Fresh, Follow-up, Rehash, Project)
- Outcome badge (color-coded per stage color convention)
- Assigned agent
- Linked proposals count
- Click-through to meeting detail

**Schedule Meeting Action:**
- Button: "Schedule Meeting"
- Creates a new meeting with:
  - `projectId` = current project
  - `meetingType` = 'Project'
  - `customerId` = project's customer
  - `ownerId` = current user
- Redirects to meeting detail page (`/dashboard/meetings/[newMeetingId]`)

**Data Source:** `meetings` table where `projectId = this project`, ordered by `scheduledFor` desc

### 3.5 Documents Tab

**Layout:** Category buckets + upload action

**Categories (displayed as collapsible sections or filter chips):**
- Contract
- Addendum
- Completion Certificate
- HOA Approval
- Payment / Checks
- Scanned Documents
- General

**Document Row:**
- File icon (based on mime type)
- Filename (editable via rename action)
- Category badge
- Upload date
- File size
- Actions: download, rename, change category, delete

**Upload:**
- Reuse existing upload interface (local file + Google Drive)
- Category selector on upload (default: general_document)
- Supports PDF, images of scanned docs, any file type

**Future Stub (documented):**
- Gmail attachment import -- "Import from Gmail" button with coming-soon state
- Auto-categorization of uploaded documents

**tRPC:** Reuse existing `projectsRouter.media` procedures. Add `category` to create/update inputs.

### 3.6 Gallery Tab

**Existing media manager, relocated from current Photos tab.**

- Phase-organized: hero, before, during, after, uncategorized, videos
- All existing functionality: upload (local + Google Drive), reorder, hero toggle, phase move, bulk actions, lightbox
- Filtered to `media_files` where `category = 'photo'` (or null for backward compat)
- No changes to existing behavior

**Known bug (issue #41):** Bulk select + move only moves 1 image. Fix as part of this work or separate PR.

### 3.7 Financials Tab

**Existing Data (functional):**
- Contract value: sum of approved proposal amounts linked through meetings
- Number of approved proposals
- Individual proposal breakdown (proposal title, amount, status, date)

**Stub Sections:**
- **QuickBooks Integration** -- empty state: "Connect QuickBooks to track income and expenses per project. Coming soon."
- **Expense Tracking** -- empty state: "Log project expenses and track profitability. Coming soon."
- **Per-Scope P&L** -- empty state: "See profit and loss broken down by trade and scope. Coming soon."

Each stub section includes a brief description of what it will do, styled with the project's `EmptyState` component.

### 3.8 Story Tab

**Existing story/marketing fields, relocated from current Metadata tab:**

- Homeowner name (read-only if populated from customer, editable override)
- Homeowner quote (textarea)
- Project duration (text)
- Challenge description (textarea)
- Solution description (textarea)
- Result description (textarea)
- Before description, During description, After description (textareas)
- Before/after pairs editor (existing `beforeAfterPairsJSON`)

These fields are only relevant when an agent wants to showcase a completed project publicly (portfolio). This tab is intentionally last.

---

## 4. Projects Landing Page Enhancement

**Route:** `/dashboard/projects` (existing `PortfolioProjectsView`)

**Changes:**
- Add filter: **Status** (active, completed, on_hold) -- select filter type
- Add filter: **Pipeline Stage** -- select filter with 11 stage options
- Existing trade filter stays
- Update "Public/Draft" status badge to show project `status` as primary badge, `isPublic` as secondary indicator
- Add columns: **Pipeline Stage** (badge), **Status** (badge)
- "New Project" button behavior changes: opens proposal picker modal -> select unlinked approved proposal -> creates project linked to that proposal's meeting and customer

### Manual Project Creation Flow

1. Agent clicks "New Project"
2. Modal opens with a searchable list of approved proposals that are NOT yet linked to a project (meeting has no projectId)
3. Agent selects a proposal
4. System pre-fills: customer (from proposal->meeting->customer), meeting, proposed title
5. Agent confirms/edits title, description, project duration
6. Project is created via `businessRouter.create` (existing flow)
7. Redirects to the new project's management hub

---

## 5. Data Flow

```
Proposal approved -> Create Project Modal -> businessRouter.create
  -> Project (status=active, pipelineStage=signed)
  -> Meeting gets projectId + outcome=converted_to_project
  -> Scopes extracted from proposal SOW -> x_projectScopes
  -> Agent lands on Project Management Hub

Agent manages project:
  Overview: edit status, pipeline stage, dates, description
  Scope & SOW: view contracted scopes, manage wishlist
  Tasks: create/complete project tasks
  Meetings: view linked meetings, schedule new project meetings
  Documents: upload/categorize project documents
  Gallery: manage project photos (existing)
  Financials: view contract value (stub QB)
  Story: edit marketing/portfolio content (existing)
```

---

## 6. File Structure (new/modified)

### New Files
```
src/shared/db/schema/tasks.ts                          # Tasks table schema
src/shared/constants/enums/tasks.ts                    # Task enum const arrays
src/shared/types/enums/tasks.ts                        # Task enum types
src/trpc/routers/tasks.router.ts                       # Tasks CRUD router
src/features/project-management/ui/views/project-management-view.tsx  # New hub view
src/features/project-management/ui/components/tabs/
  overview-tab.tsx
  scope-sow-tab.tsx
  tasks-tab.tsx
  meetings-tab.tsx
  documents-tab.tsx
  gallery-tab.tsx                                      # Wraps existing media manager
  financials-tab.tsx
  story-tab.tsx
src/features/project-management/ui/components/
  project-header.tsx                                   # Shared header across tabs
  wishlist-editor.tsx                                  # Trade/scope selector for wishlist
  wishlist-snapshot.tsx                                 # Compact wishlist for overview
  task-list.tsx                                        # Task checklist component
  task-row.tsx                                         # Individual task row
  meeting-list.tsx                                     # Meetings list for tab
  document-list.tsx                                    # Documents list with categories
  document-upload.tsx                                  # Upload with category selector
  project-creation-modal.tsx                           # Proposal picker for manual creation
src/features/project-management/dal/server/
  get-project-management-data.ts                       # Aggregated query for hub
  manage-wishlist.ts                                   # Wishlist CRUD
src/features/project-management/hooks/
  use-project-management.ts                            # Data fetching hook for hub
```

### Modified Files
```
src/shared/db/schema/meta.ts                           # New enums
src/shared/db/schema/projects.ts                       # Add wishlistJSON column
src/shared/db/schema/media-files.ts                    # Add category column
src/shared/db/schema/index.ts                          # Export tasks
src/shared/constants/enums/index.ts                    # Export task enums
src/shared/constants/enums/media.ts                    # Add mediaFileCategories to existing file
src/shared/types/enums/index.ts                        # Export task types
src/shared/types/enums/media.ts                        # Add MediaFileCategory type to existing file
src/shared/entities/projects/schemas.ts                # Add wishlistSchema to existing file
src/trpc/routers/app.ts                                # Register tasksRouter
src/features/project-management/ui/views/index.ts      # Export new view
src/app/(frontend)/dashboard/projects/[projectId]/page.tsx  # Use new view
src/features/project-management/ui/views/portfolio-projects-view.tsx  # Add filters + columns
src/features/project-management/ui/components/table/columns.tsx       # Add status + stage columns
src/features/project-management/constants/table-filter-config.ts      # Add new filter configs
```

### Removed/Replaced
```
src/features/project-management/ui/views/edit-project-view.tsx   # Replaced by project-management-view
src/features/project-management/ui/views/create-project-view.tsx # Replaced by project-creation-modal
```

---

## 7. Stub Documentation

### Stubs in this implementation (functional placeholder UI, documented for future work)

| Stub | Location | What it will become |
|------|----------|-------------------|
| Financials: QuickBooks | financials-tab.tsx | QB OAuth connection, transaction sync, per-scope P&L |
| Financials: Expenses | financials-tab.tsx | Manual expense entry + QB sync |
| Documents: Gmail import | documents-tab.tsx | Gmail MCP -> attachment extraction -> auto-upload to R2 |
| Tasks: Reminders | tasks-tab.tsx | QStash-scheduled email/notification reminders for due dates |
| Tasks: Assignee management | task-row.tsx | Agent selector dropdown, multi-assign |
| Meetings: Inline scheduler | meetings-tab.tsx | Currently redirects to meeting flow; future: inline date/time picker |
| Wishlist: Promotion to proposal | scope-sow-tab.tsx | Convert wishlist items into a new proposal for the customer |

---

## 8. tRPC Router Changes

### New Router: `tasksRouter`

Location: `src/trpc/routers/tasks.router.ts`
Registration: Add to `appRouter` in `src/trpc/routers/app.ts`

Procedures (all `agentProcedure`):
- `getByContext({ contextType, contextId })` -- returns tasks filtered by context, ordered by sortOrder
- `create({ title, description?, status?, priority?, contextType, contextId, dueDate?, assigneeId? })` -- validates context entity exists, creates task
- `update({ id, data: { title?, description?, status?, priority?, dueDate?, assigneeId? } })` -- partial update, sets completedAt when status=done
- `delete({ id })` -- delete task
- `reorder({ updates: { id, sortOrder }[] })` -- batch update sort order
- `toggleStatus({ id })` -- toggle between todo and done, auto-set completedAt

### Modified Router: `projectsRouter`

- `crud.update` -- add `wishlistJSON` to accepted input schema
- `media.create` -- add `category` to input schema (default: 'photo')
- `media.updateCategory({ id, category })` -- new procedure, change document category

### New Procedure on `projectsRouter`

- `getManagementData({ id })` -- aggregated query returning:
  - Project with all fields
  - Customer data (name, address, phone, email)
  - Linked meetings with proposals
  - Contract value (sum of approved proposals)
  - Scope data (x_projectScopes joined with scopes + trades)
  - Task summary (overdue count, upcoming count)
  - Recent documents count
  - Owner/agent data

---

## 9. Verification Plan

1. **Schema migration:** Run `pnpm db:push:dev` -- verify tasks table created, wishlistJSON column added, category column added with default
2. **Type check:** `pnpm tsc` passes
3. **Lint:** `pnpm lint` passes (no new errors)
4. **Project hub loads:** Navigate to `/dashboard/projects/[id]` -- all 8 tabs render
5. **Overview tab:** Status/stage selectors work, dates editable, contract value displays, meeting + task widgets show data
6. **Scope & SOW tab:** Contracted scopes display from x_projectScopes. Wishlist editor adds/removes scopes, persists to wishlistJSON
7. **Tasks tab:** Create, toggle, delete tasks. Tasks persist and reload
8. **Meetings tab:** Lists linked meetings. "Schedule Meeting" creates new meeting with projectId
9. **Documents tab:** Upload document with category. Appears in correct bucket. Download/delete work
10. **Gallery tab:** Existing photo manager works unchanged
11. **Financials tab:** Contract value displays. Stub sections render with coming-soon state
12. **Story tab:** Existing narrative fields work unchanged
13. **Landing page:** New filters (status, pipeline stage) filter correctly. New columns display. "New Project" opens proposal picker
14. **Manual project creation:** Select proposal -> project created -> redirects to hub
15. **Cross-feature:** Projects pipeline kanban still works. Customer profile still shows projects
