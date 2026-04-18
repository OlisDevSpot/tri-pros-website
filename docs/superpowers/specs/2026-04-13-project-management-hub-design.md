# Project Management Hub — Design Spec

**Date:** 2026-04-13 (original) · Revised 2026-04-17
**Status:** Draft v2 (major revision)
**Related Issues:** #69 (showroom→projects refactor, partially done), #67 (project intake modal), #41 (bulk image actions), #64 (related portfolio projects), #72 (stale project detection), #68 (pipeline-specific meeting fields)
**Related Specs:**
- `docs/superpowers/specs/2026-04-17-meeting-participants-gcal-sync-design.md` — Meeting participants model (foundation for this spec)
- `docs/domain/ubiquitous-language.md` — Canonical business terms

## Revision History

**v1 → v2 (2026-04-17):** Complete restructuring after codebase evolution and critical review.

| Theme | v1 | v2 |
|---|---|---|
| Tasks | New `tasks` table | **Removed.** Uses existing `activities` table (`entityType='project'`) |
| Ownership model | Singular `projects.ownerId` | **Derived from meeting participants** — projects inherit roles via meetings |
| Overview tab | Flat field list | **Structured information hierarchy** with accordion groupings |
| Scope changes | "Read-only, locked" | **Change Order / Addendum flow** via Zoho Sign |
| Mobile UX | Unspecified | Responsive strategy per tab |
| Flexibility for new roles | Ignored | Dedicated flexibility layer (CASL subjects, helpers, tab visibility hooks) |
| God query (`getManagementData`) | Single aggregated procedure | **Split into per-tab focused queries** with lazy loading |
| Optimistic updates | Not mentioned | Explicit per-mutation pattern |
| Empty/loading states | Not described | Per-tab specifications |
| Zoho Sign → Documents | Disconnected features | Integrated (signed contracts auto-route to Documents tab) |
| Wishlist → revenue | Vague future stub | Documented upsell pipeline (wishlist → new meeting → proposal → addendum) |
| Enum types | Separate `types/enums/` | Co-located in `constants/enums/` (directory deleted) |
| Entity schemas | `schemas.ts` file | `schemas/index.ts` directory pattern |
| `features/meetings/` | Old path | `features/meeting-flow/` |

---

## Context

The `project-management` feature (renamed from `showroom`) currently serves only as a portfolio showcase editor. Active construction projects exist in the DB with 11 pipeline stages and full lifecycle tracking, but agents have no dedicated UI to manage them. The edit page has two tabs (Photos + Metadata) that are 100% portfolio-focused.

This spec transforms the project edit page into a **tabbed project management hub** — the centralized workspace where everyone involved with a project (sales reps, production, admin, and future roles) stays aligned from contract signing through completion and portfolio archival. Portfolio/story content becomes one tab among many; new capabilities (activities, documents, wishlist/upsells, change orders, meetings) are added.

## Core Decisions

- **Hub shell:** 8-tab hybrid of operational + portfolio UI, responsive per-tab, with role-aware visibility primitives.
- **Ownership = derived from meetings, not stored on projects.** `projects.ownerId` remains as a fast-path cache (the primary owner), but all permission checks and UI displays flow through helper functions that read from `meeting_participants`.
- **Activities, not tasks.** Reuse the existing `activities` table, `scheduleRouter.activities` procedures, and `schedule-management` UI components. Filter by `entityType='project'`.
- **Wishlist storage:** JSONB column on projects (`wishlistJSON`), consistent with how proposals/meetings store scope data.
- **Documents in same `media_files` table** with new `category` column (no separate documents table).
- **Contracted scopes are immutable via UI** — modifications require a signed Change Order (addendum) via Zoho Sign.
- **Focused queries, not a god query.** Each tab has its own tRPC query; Overview aggregates via parallel fetches with lazy loading.
- **Flexibility for future roles** — no role implementation yet, but all helpers, CASL subjects, and UI tab-visibility hooks are designed to accept new roles additively.

---

## 1. Data Relationships & Derivation Rules

**This section is foundational. Every subsequent section assumes it.**

### 1.1 The Hierarchy

```
Customer (1) ──┬── Meeting (many)
               │      ├── MeetingParticipant (many: owner, co_owner, helper)
               │      ├── Proposal (many, created during or after meeting)
               │      └── projectId (set once when a meeting originates a project — permanent)
               │
               └── Project (many)
                      └── Meeting (many, all share projectId)
```

### 1.2 Project Kinds

There are two ways a project comes to exist:

- **Business project** — created from an approved proposal via `businessRouter.create`. This is the common case and all invariants below apply.
- **Portfolio-only project** — created via `projectsRouter.crud.create` (super-admin advanced flow, see §8.3) to represent legacy completed jobs that predate this system. These have NO linked meetings, NO derived participants, and are visible only to super-admins in the management UI. They appear publicly via the existing `showroomDisplay` router for the marketing site.

**All helpers in §1.4 handle both kinds.** `getProjectParticipants` returns `[]` for portfolio-only projects. `canUserAccessProject` returns `true` only for super-admin on portfolio-only projects.

### 1.3 Invariants (enforced in DAL — business projects only unless noted)

| Invariant | Scope | Enforcement |
|---|---|---|
| A business project is created from exactly one originating meeting | business | `businessRouter.create` mutation — already true today |
| A meeting's `projectId` is permanent once set (no disassociation) | all | `meetings.update` in `src/trpc/routers/meetings.router.ts` rejects input where `projectId` changes from a non-null value |
| All meetings on a business project share the same `customerId` | business | `inferProjectCustomer()` validates; throws on divergence |
| `projects.customerId` matches all linked meetings' `customerId` | business | Same helper enforces |
| `projects.ownerId` mirrors the owner of the originating meeting | business | Set on project creation; re-derived on originator reassignment |
| A business project always has ≥1 meeting | business | `meetings.delete` rejects if it's the last meeting on a business project; project deletion cascades to meetings |
| A portfolio-only project has zero linked meetings | portfolio | `projectsRouter.crud.create` does not link meetings; `projectsRouter.crud.update` rejects attempts to set `projectId` on a meeting if the target project was created portfolio-only |

### 1.4 Derivation Helpers

**Location:** `src/shared/entities/projects/lib/participants/` (new)

All project participant/visibility logic goes through these helpers. **Never read `projects.ownerId` directly in business logic** — always use the helpers. `ownerId` is a denormalized cache, not a source of truth.

```typescript
// src/shared/entities/projects/lib/participants/get-project-participants.ts
export interface ProjectParticipant {
  userId: string
  name: string
  email: string | null
  image: string | null
  roles: MeetingParticipantRole[]  // union across all project meetings (deduped)
  meetingCount: number              // how many project meetings they participated in
  meetingIds: string[]              // which ones
  isPrimaryOwner: boolean           // owner of the originating meeting
  isAnyOwner: boolean               // owner or co_owner on at least one meeting
}

export async function getProjectParticipants(projectId: string): Promise<ProjectParticipant[]>
```

```typescript
// src/shared/entities/projects/lib/participants/get-project-primary-owner.ts
// Returns the owner of the originating (earliest by meetings.createdAt) meeting
export async function getProjectPrimaryOwner(projectId: string): Promise<{
  userId: string
  name: string
  email: string | null
  image: string | null
} | null>
```

```typescript
// src/shared/entities/projects/lib/participants/user-participates-in-project.ts
// Returns a Drizzle exists() SQL clause for use in WHERE filters.
// Checks: does user have ANY participant row on ANY meeting linked to this project?
// Use-case: visibility filtering at the DB level.
export function userParticipatesInProject(
  userId: string,
  projectIdColumn: AnyColumn,
): SQL
```

```typescript
// src/shared/entities/projects/lib/participants/can-user-access-project.ts
// super-admin OR participant in any project meeting (any role).
export async function canUserAccessProject(
  user: PermissionUser,
  projectId: string,
): Promise<boolean>
```

```typescript
// src/shared/entities/projects/lib/participants/can-user-edit-project.ts
// super-admin OR owner/co_owner on at least one project meeting.
// (helpers are read-only.)
export async function canUserEditProject(
  user: PermissionUser,
  projectId: string,
): Promise<boolean>
```

```typescript
// src/shared/entities/projects/lib/infer-project-customer.ts
// Returns the canonical customer for a project, validating that all
// meetings share the same customerId. Throws on divergence.
export async function inferProjectCustomer(projectId: string): Promise<Customer>
```

### 1.5 Visibility Middleware (tRPC)

**Location:** `src/trpc/init.ts` (modification)

Add a `projectProcedure` built on `agentProcedure` that takes a `projectId` input (either `input.projectId` or `input.id`) and enforces `canUserAccessProject` before running the handler. Project-scoped procedures with a flat input shape use this — eliminating per-procedure duplication.

```typescript
export const projectProcedure = agentProcedure.use(async ({ ctx, input, next }) => {
  const projectId = (input as { projectId?: string })?.projectId
    ?? (input as { id?: string })?.id
  if (!projectId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'projectId is required' })

  const allowed = await canUserAccessProject(
    { id: ctx.session.user.id, role: ctx.session.user.role },
    projectId,
  )
  if (!allowed) throw new TRPCError({ code: 'FORBIDDEN' })

  return next({ ctx: { ...ctx, projectId } })
})
```

**When procedures can't use this middleware** (e.g., nested inputs like `{ data: { projectId } }` or operations spanning multiple projects), the handler must call `canUserAccessProject` (for reads) or `canUserEditProject` (for writes) explicitly at the top of the handler. A lint rule or code review checklist should catch missing checks.

### 1.6 Participant Inheritance When Adding Meetings to Existing Projects

When a new meeting is created with `projectId = X` (i.e., a follow-up project meeting), the system **auto-populates participants** from the project's existing roster:

- **Primary owner** of the project → added as `owner` of the new meeting
- **Co-owners** of the project → added as `co_owner` of the new meeting (if the meeting has no existing co-owner)
- **Helpers** → NOT auto-copied (helpers are meeting-specific)

The user creating the meeting can adjust this in the assign-rep dialog. This rule is encoded in `meetings.create` when `projectId` is set.

---

## 2. Flexibility Layer (Future-Proofing for Roles)

No new roles are being added in this spec. But the hub is designed so new roles (`production`, `foreman`, `qa`, etc.) can be added additively without refactoring the hub.

### 2.1 CASL Subjects

**Current subjects:** `Activity | Calendar | Customer | CustomerPipeline | Dashboard | Meeting | Project | Proposal | User | all`

**Additions for this hub:** none right now. `Project` subject is sufficient. When `ChangeOrder` becomes a first-class entity (see §7), add it as a subject.

### 2.2 Role-Aware Tab Visibility Hook

**Location:** `src/features/project-management/hooks/use-project-hub-tabs.ts`

```typescript
interface HubTabConfig {
  id: string                // 'overview' | 'scope' | 'activities' | ...
  label: string
  icon: LucideIcon
  visibleFor: (ability: AppAbility) => boolean  // default: always
  requiredAbility?: { action: AppAction; subject: AppSubject }
}

export function useProjectHubTabs(): HubTabConfig[]
```

All 8 tabs use `visibleFor: () => true` in v1. When roles are introduced, tabs can declare visibility inline:

```typescript
// Example future state (NOT implemented in v1):
{
  id: 'financials',
  visibleFor: (ability) => ability.can('read', 'Financials'),
}
```

This keeps role logic colocated with the tab and avoids scattering `if (role === 'X')` across the codebase.

### 2.3 Participant Role Display

The `ProjectParticipantBadge` component (see §6.1) receives a `ProjectParticipant` and renders based on roles. When new roles are added to `meetingParticipantRoles`, the component's role → color/label mapping gains entries — no structural changes.

---

## 3. Primary User Flows

The hub is designed around 5 flows that recur across roles. Each flow touches multiple tabs; cross-tab navigation is first-class.

### Flow A — "Where is this project?"

**Entry points:** Customer pipeline kanban, customer profile, projects landing page, direct link.
**Primary tab:** Overview
**Answer surfaces in:** Header status badges + pipeline stage, Key Dates card, Contract Value card, participant avatar group.
**Cross-tab touches:** Overview → Activities (recent completed items), Overview → Meetings (upcoming).

### Flow B — "What needs to happen next?"

**Entry points:** Dashboard action queue, activity notifications.
**Primary tab:** Activities → filtered to open + overdue.
**Cross-tab touches:** Overview widget summarizes; Meetings shows next scheduled; Documents surfaces pending-signature items.

### Flow C — "Scope needs to change mid-project"

**Entry points:** Scope & SOW tab, site visit meeting outcome.
**Primary tab:** Scope & SOW → "Create Change Order" button.
**Cross-tab touches:** Generates a document → lands in Documents tab (Addendum category) → signed via Zoho Sign → signed copy returns → contracted scopes update → history entry logged.

### Flow D — "There's an upsell opportunity"

**Entry points:** Mid-project meeting, customer mentions add-on desire.
**Primary tab:** Scope & SOW → Wishlist section.
**Cross-tab touches:** Wishlist item → "Promote to Proposal" → creates new meeting (type: Project) → proposal flow runs → if approved → becomes a Change Order (see Flow C).

### Flow E — "Project is complete, prep portfolio"

**Entry points:** Project transitions to `status = completed` + `isPublic = true`.
**Primary tab:** Story
**Cross-tab touches:** Gallery (curate photos, mark hero) → Story (narrative fields) → Overview (public slug, isPublic toggle).

---

## 4. Schema Changes

### 4.1 New column on `projects`

```
wishlistJSON    jsonb nullable
```

Zod schema location: `src/shared/entities/projects/schemas/index.ts`

```ts
export const wishlistItemSchema = z.object({
  id: z.string().uuid(),                     // client-generated, for stable keys during edits
  tradeId: z.string(),                        // Notion trade ID
  scopeIds: z.array(z.string()),             // Notion scope IDs
  notes: z.string().optional(),
  addedAt: z.string(),                        // ISO timestamp
  addedByUserId: z.string(),                  // audit trail
  status: z.enum(['open', 'promoted', 'dismissed']).default('open'),
  promotedToMeetingId: z.string().uuid().optional(),
})

export const wishlistSchema = z.array(wishlistItemSchema)
export type WishlistItem = z.infer<typeof wishlistItemSchema>
export type Wishlist = z.infer<typeof wishlistSchema>
```

The `status` field tracks whether the wishlist item became a proposal. `promotedToMeetingId` links back to the meeting created from it (Flow D).

### 4.2 New column on `media_files`

```
category    mediaFileCategoryEnum default 'photo'
```

Enum values: `photo`, `contract`, `addendum`, `completion_certificate`, `hoa_approval`, `payment`, `scan`, `general_document`

**Migration strategy:** Add column with default `'photo'`. Existing rows get `'photo'`. No backfill logic needed (already correct).

Const array + type: `src/shared/constants/enums/media.ts`
pgEnum: `src/shared/db/schema/meta.ts`

**Gallery tab filters:** `category = 'photo'` (strict, no "or null" clause).
**Documents tab filters:** `category != 'photo'`.

### 4.3 No new tables

- **No `tasks` table** — use existing `activities` table with `entityType='project'`.
- **No `project_participants` table** — derive from `meeting_participants` via helpers in §1.4.
- **No `change_orders` table in v1** — Change Orders live in `media_files` with category `'addendum'` + metadata in `tags` JSONB. If the flow matures, extract to its own table in a follow-up spec.

---

## 5. Page Structure & Navigation

### 5.1 Route

`/dashboard/projects/[projectId]` — existing; currently renders `EditProjectView`. Replace with `ProjectManagementView`.

### 5.2 Tab Bar

| Order | Tab | Icon | Data Source | Badge Indicator |
|---|---|---|---|---|
| 1 | Overview | LayoutDashboard | Parallel queries | None |
| 2 | Scope & SOW | ClipboardList | `x_projectScopes` + `wishlistJSON` | Count: wishlist items with `status='open'` |
| 3 | Activities | CheckSquare | `activities` (entityType=project) | Count: overdue tasks |
| 4 | Meetings | CalendarDays | `meetings` (projectId FK) | Count: upcoming meetings next 7d |
| 5 | Documents | FileText | `media_files` (category != photo) | Count: docs awaiting signature |
| 6 | Gallery | Images | `media_files` (category = photo) | None |
| 7 | Financials | DollarSign | `proposals` + future QB | None |
| 8 | Story | BookOpen | `projects` narrative fields | None |

Tab selection persisted via nuqs URL param (`?tab=overview`). Badge counts are live-updated via query invalidation.

### 5.3 Responsive Strategy

**Desktop (≥1024px):** Horizontal tab bar, all tabs visible, content area fills remaining height.

**Tablet (≥768px):** Horizontal tab bar, icons + short labels, content area scrolls.

**Mobile (<768px):**
- Primary tabs (Overview, Activities, Meetings, Documents) remain visible as horizontal scrolling tab bar with icons + short labels.
- Secondary tabs (Scope & SOW, Gallery, Financials, Story) accessible via a "More" overflow menu.
- On mobile, tabs auto-collapse sections; user expands what they need.

### 5.4 Deep Linking

- `?tab=<id>` — selects tab.
- `?tab=activities&filter=overdue` — activities tab with pre-applied filter.
- `?tab=documents&category=addendum` — documents filtered to category.
- `?tab=scope&section=wishlist` — scope tab scrolled/jumped to wishlist section.

Components use `parseAsStringLiteral` from nuqs with enum of valid values.

---

## 6. Tab Specifications

### 6.1 Overview Tab

**Purpose:** At-a-glance answer to "where is this project, who's on it, what's up?" — for all roles.

**Information hierarchy (top → bottom):**

**Permission rule for all inline edits on this tab:** Edit controls render only if `canUserEditProject` returns true for the current user (super-admin, owner, or co-owner). Helpers see read-only views. This is enforced both in the UI (no edit chrome) and in the tRPC mutation (rejects unauthorized updates).

**Tier 1 — Identity & status (always visible, above fold):**
- Project title (inline-editable, `Pencil` icon on hover)
- Customer name with link to customer profile
- Address (formatted, with map icon link to Google Maps)
- **Participant avatar group** (stacked): primary owner prominent, co-owners next, helpers muted. Hover → tooltip with name + role breakdown across meetings. See §6.1.1.
- Status badge: `active` | `completed` | `on_hold` — inline editable Select
- Pipeline stage badge: 11 stages — inline editable Select (from `projectPipelineStages`)

**Tier 2 — Key metrics (grid of 3-4 cards):**
- **Contract Value card:** Sum of approved proposals + signed addendums. Tooltip shows breakdown. Editable? No — derived.
- **Key Dates card:** Signed (read-only, from `projects.createdAt`), Started (editable `startedAt`), Completed (editable `completedAt`).
- **Activity Summary card:** X overdue, Y upcoming, Z completed this week. Click → Activities tab.
- **Meeting Summary card:** Next meeting (date + type) or "No upcoming". Click → Meetings tab.

**Tier 3 — Details (accordion, collapsed by default):**
- **Project Details accordion:** Description (textarea), URL slug (inline-editable for portfolio), `isPublic` toggle.
- **Wishlist snapshot accordion:** Compact list of open wishlist items. Count badge on accordion header. "Edit in Scope & SOW" link.
- **Recent activity accordion:** Last 5 completed activities + last 3 document uploads — a unified feed. Shows "who did what when."

**Layout:**
- Desktop: Tier 1 header row, Tier 2 as 3-column grid, Tier 3 as single-column accordions.
- Mobile: Tier 1 as stacked rows, Tier 2 as 1-column grid, Tier 3 accordions unchanged.

**shadcn components:** `Card`, `Badge`, `Avatar`, `AvatarGroup` (custom or from registry), `Select`, `Accordion`, `Tooltip`, `Input` (inline-edit), `Separator`.

#### 6.1.1 ProjectParticipantBadge component

**Location:** `src/shared/entities/projects/components/project-participant-badge.tsx`

Accepts a `ProjectParticipant` (see §1.4). Renders:
- Avatar with photo or initials
- Primary owner gets subtle ring indicator
- Tooltip content: full name, email, list of roles across meetings ("Owner on Initial Meeting, Co-Owner on Follow-up")

Used in Overview and Meetings tabs.

#### 6.1.2 Loading, Empty, Error States (Overview)

- **Loading:** Skeleton card grid matching the 3-tier layout.
- **Empty:** Not applicable — a project always has identity data.
- **Error:** `ErrorState` component from `src/shared/components/states/` with "Retry" button.

#### 6.1.3 Optimistic Updates (Overview)

| Field | Optimistic? | Rationale |
|---|---|---|
| Title, description, URL slug | Yes | Local text edit, revert on error |
| Status, pipeline stage | Yes | Single-field mutation, quick feedback |
| Dates (startedAt, completedAt) | Yes | Same |
| `isPublic` toggle | Yes | Same |
| Contract Value | N/A | Derived, not editable |

Follow `pattern-optimistic-updates.md` from memory — `onMutate`/`onError`/`onSettled`.

---

### 6.2 Scope & SOW Tab

**Purpose:** Show what the customer contracted for, document changes to that scope, track upsell opportunities.

**Three sections, in order:**

#### 6.2.1 Contracted Scopes (read-only)

Source: `x_projectScopes` joined with scopes + trades tables.
Grouped by trade. Each scope card shows:
- Trade name (section header with icon)
- Scope label
- SOW text (from `scopes.scopeOfWorkBase`)
- Variable data badges (if `x_projectScopes.variablesData` has entries)

Visually distinct styling (solid border, filled background) to convey "locked."

#### 6.2.2 Change Orders (history, read-mostly)

**Source:** `media_files` where `projectId = X` AND `category = 'addendum'`, ordered by `createdAt` desc.

Each change order row shows:
- Date created
- Description / title (from `media_files.name`)
- Status: `pending` | `sent` | `signed` | `declined` (from Zoho Sign webhook)
- Delta: "+$X.XX" or "−$X.XX" if known (from `media_files.tags` JSONB)
- Action: "View Document" → opens signed PDF from R2

**"Create Change Order" button** — primary action. Opens modal:
- Description (required)
- Scopes to add (trade/scope picker, reuses `src/features/meeting-flow/ui/components/steps/` patterns)
- Scopes to remove (from current contracted scopes, multi-select)
- Price delta (manual entry — no auto-calculation in v1)
- Customer note (textarea, appears in signed document)

On submit: generates a PDF → uploads to `media_files` with category `'addendum'` and status `'pending'` → sends to Zoho Sign → sends signing email to customer. (Zoho Sign webhook handling is in the existing contract infrastructure; extending for addendums is part of this spec's implementation.)

**When customer signs** (Zoho webhook): status → `signed`. Contracted scopes updated: additions inserted into `x_projectScopes`, removals deleted. Contract value recalculates. Audit log row created.

#### 6.2.3 Wishlist (editable upsell tracker)

Source: `wishlistJSON` column on `projects`.

Header: "Wishlist (Upsell Opportunities)" — with popover explaining this is NOT contracted work, just tracking.

Each wishlist item shows:
- Trade + scope summary
- Added by (user avatar) + added date
- Notes (if any)
- Status pill: `open` | `promoted` | `dismissed`
- Actions: Edit, Dismiss, **"Promote to Proposal"** (primary, `open` items only)

**Add Wishlist Item form (inline, below list):**
Trade & scope selector — reuses `TradeScopePickerFields` from `src/features/project-management/ui/components/form/`. Optional notes.

**"Promote to Proposal" action:** Opens confirmation dialog. On confirm, a single server-side transaction:
1. Creates a new meeting (`customerId` from project, `meetingType = 'Project'`, `projectId` set, participants inherited per §1.6)
2. Updates the wishlist item in `wishlistJSON`: `status = 'promoted'`, `promotedToMeetingId = newMeeting.id`
3. Returns both IDs

Client then redirects to `/dashboard/meetings/[newMeetingId]` where the agent builds the proposal. If the agent abandons the meeting, the wishlist item remains `promoted` (correctly — a meeting was created, the promotion happened). The agent can always create a fresh wishlist entry if needed.

This atomic mutation lives in `src/features/project-management/dal/server/promote-wishlist-item.ts` and is exposed via `projectsRouter.scope.promoteWishlistItem`.

**Visual distinction:** Wishlist cards use dashed border, muted background — visually "aspirational" vs. contracted.

#### 6.2.4 Loading, Empty, Error States (Scope & SOW)

- **Loading:** Skeleton with 3 section headers + 2 placeholder cards each.
- **Empty — Contracted Scopes:** "No scopes contracted yet — this project was created without SOW linkage. Contact a super-admin." (Should never happen if created via `businessRouter.create`, but defensive.)
- **Empty — Change Orders:** "No change orders. [Create Change Order]" CTA.
- **Empty — Wishlist:** "No upsell items tracked. Add one to start building the next proposal."
- **Error:** Per-section `ErrorState`.

#### 6.2.5 Optimistic Updates (Scope & SOW)

- Add/remove/dismiss wishlist item: Yes
- Create Change Order: No (involves external PDF generation + Zoho API call)
- Promote to Proposal: No (navigates away; let server confirm)

---

### 6.3 Activities Tab

**Purpose:** Project-scoped task/reminder/note/event management. All participant roles see the same activities.

**Reuse:** `schedule-management` feature's `ActivityForm` and `ActivitiesTable` — wrap with project-scoped pre-fills and filtering.

**Layout:** Filter bar on top, activity list below, inline add form, completed-collapsed footer section.

**Filters:**
- Type: all | task | note | reminder | event
- Status: open | completed | all (default: open)
- URL-controlled via nuqs (`?tab=activities&filter=overdue`).

**Activity row:**
- Checkbox (calls `schedule.activities.complete`) — optimistic
- Title (inline-editable via `schedule.activities.update`) — optimistic
- Type badge (task/note/reminder/event)
- Priority badge (task-only, reads `metaJSON.priority`)
- Due date / scheduled date
- Owner avatar
- Actions: edit (opens form dialog), delete (confirm)

**Add form:**
- Reuse `ActivityForm` from `src/features/schedule-management/ui/components/activity-form.tsx`
- Pre-fill: `entityType='project'`, `entityId=projectId`, default `type='task'`
- Hide entity-link fields in this context

**Inline quick-add:**
A single-line input: "Add task…" with Enter-to-submit. Defaults: type=task, no due date, priority=medium. For full options, user clicks "More" → opens the full form dialog.

#### 6.3.1 New tRPC procedure: `scheduleRouter.activities.getByEntity`

```typescript
getByEntity: agentProcedure
  .input(z.object({
    entityType: z.enum(activityEntityTypes),
    entityId: z.string().uuid(),
  }))
  .query(async ({ ctx, input }): Promise<ActivityWithOwner[]> => {
    // Return same shape as getAll (activities + ownerName + ownerImage)
    // Ordered by: completedAt nulls first, then dueAt asc, then createdAt desc.
    // Visibility: super-admin sees all; otherwise user must participate in
    // the parent entity (for projects: userParticipatesInProject).
  })
```

**Visibility note:** This procedure must delegate to entity-specific visibility checks. For `entityType='project'`, use `userParticipatesInProject`. For `entityType='meeting'`, use `userParticipatesInMeeting`. For `customer` and `proposal`, use the respective visibility helpers (or the existing CASL `can('read', Subject)` check).

#### 6.3.2 Loading, Empty, Error States (Activities)

- **Loading:** Skeleton rows × 5.
- **Empty (no filter):** "No activities yet. Add your first task to start tracking."
- **Empty (filter applied):** "No activities match this filter. [Clear filter]"
- **Error:** `ErrorState`.

#### 6.3.3 Google Calendar sync

Events and reminders created with a `scheduledFor` value will sync to the user's personal calendar via the existing `scheduling.service`. Tasks and notes don't sync. No project-level change — this is activity-owner-scoped.

---

### 6.4 Meetings Tab

**Purpose:** Browse the project's meeting history, schedule new project meetings, see who attended what.

**Layout:** List of meetings (sorted by `scheduledFor` desc), with "Schedule Meeting" action.

**Each meeting row displays:**
- Scheduled date/time
- Meeting type badge
- Outcome badge (color-coded)
- **"Originating" indicator** on the earliest meeting (a star icon with tooltip "Project was created from this meeting")
- Participant avatar group for that meeting (owner + co-owner + helpers)
- Linked proposals count
- Click → navigates to meeting detail

**Schedule Meeting action:**
- Button triggers `meetingsRouter.create` with: `projectId` = this project, `customerId` = project's customer, `meetingType = 'Project'`, participants auto-populated per §1.6 (primary owner + co-owners), `ownerId` = primary owner (or current user if creator is not yet a participant — which shouldn't happen due to visibility filtering).
- On success → navigate to `/dashboard/meetings/[newMeetingId]` where the user can adjust participants via the existing assign-rep dialog (`manageParticipants` mutation) and set `scheduledFor`.
- No modal in v1 — keep the flow consistent with other meeting creation paths in the app. A quick-create modal is a future enhancement (noted in §11).

**tRPC:** Use existing `meetingsRouter.getAll` filtered client-side by `projectId`, OR add `meetingsRouter.getByProject({ projectId })` — prefer the latter for clarity and DB-level visibility.

#### 6.4.1 Loading, Empty, Error States (Meetings)

- **Loading:** Skeleton rows × 3.
- **Empty:** Should never be empty (project always has ≥1 meeting — the originating one). If empty, show error: "Data inconsistency: this project has no linked meetings. Contact support."
- **Error:** `ErrorState`.

---

### 6.5 Documents Tab

**Purpose:** Central hub for all project paperwork — contracts, addendums, HOA approvals, permits, receipts, scanned docs.

**Layout:** Category filter chips → document list grouped by category (or flat when filtered).

**Categories (from `mediaFileCategories` enum):**
- Contract
- Addendum (change orders)
- Completion Certificate
- HOA Approval
- Payment / Checks
- Scanned Documents
- General

**Document row:**
- File icon (mime-type-aware)
- Filename (editable rename action)
- Category badge (changeable via dropdown)
- Upload date
- File size
- **Signature status** (if applicable): `not applicable` | `pending signature` | `signed {date}` — derived from `media_files.tags.zohoSignStatus`
- Actions: download, rename, change category, delete (confirm)

**Upload action:**
- Reuses existing `SortableMediaManager` upload flow
- Adds a category selector (default: `general_document`)
- Supports local file + Google Drive imports

**Zoho Sign integration** (NEW for this spec):
- When an addendum or contract is sent via Zoho Sign, the `media_files` row is created with `category='addendum'` or `category='contract'` and `tags.zohoSignStatus='pending'`.
- The existing Zoho webhook handler (`src/app/api/...`) updates the status when signed. The Documents tab reflects this live.
- Signed PDFs are auto-downloaded from Zoho and stored in R2, linked back to the same `media_files` row.

**Gmail import stub:**
- "Import from Gmail" button in upload menu — opens a dialog with "Coming soon: scan your inbox for project-related attachments and auto-upload them."

#### 6.5.1 Loading, Empty, Error States (Documents)

- **Loading:** Skeleton grid.
- **Empty (all):** "No documents uploaded yet. [Upload Document]"
- **Empty (filtered):** "No documents in this category."
- **Error:** `ErrorState`.

---

### 6.6 Gallery Tab

**Purpose:** Project photo management (existing functionality, relocated).

Existing `SortableMediaManager` component, filtered to `media_files` where `category = 'photo'`.

All existing functionality preserved: phases (hero/before/during/after/uncategorized/videos), upload (local + Google Drive), reorder, hero toggle, phase move, bulk actions, lightbox.

**Known bug (issue #41):** Bulk select + move only moves 1 image. Track separately; not blocking this spec.

**No loading/empty/error state changes** — existing component handles these.

---

### 6.7 Financials Tab

**Purpose:** Money picture — what was contracted, what was paid, what the P&L looks like.

**Existing data section (functional):**
- Contract Value (base): sum of approved proposal amounts linked via `meetings.projectId`
- Contract Value (current): base + signed addendum deltas (see §6.2.2)
- Approved proposals: count + list
- Signed addendums: count + list with delta amounts

**Stub sections:**
- **QuickBooks Integration** — uses existing `qbSubCustomerId` field on `projects`; "Connect to sync income & expenses"
- **Expense Tracking** — "Coming soon"
- **Per-Scope P&L** — "Coming soon"

Each stub uses the project's `EmptyState` component.

#### 6.7.1 Loading, Empty, Error States (Financials)

- **Loading:** Skeleton for contract value card + list.
- **Empty — Contract Value:** Impossible in v1 (project always has ≥1 approved proposal via `businessRouter.create`). If hit, show error.
- **Error:** `ErrorState`.

---

### 6.8 Story Tab

**Purpose:** Portfolio marketing content (existing, relocated from "Metadata" tab).

Fields:
- Homeowner name (editable override)
- Homeowner quote (textarea)
- Project duration (text)
- Challenge, Solution, Result descriptions
- Before, During, After descriptions
- `beforeAfterPairsJSON` editor

**Visibility note:** This tab is most relevant for completed + public projects. Consider dimming the tab header for active projects — but do NOT hide it (sales reps may draft story copy during active projects).

**No changes to existing field logic.** Just moved into the hub shell.

---

## 7. Change Order / Addendum Flow

**Critical business flow** — first-class in this spec.

### 7.1 When it's triggered

Mid-project, any of:
- Customer requests scope addition (e.g., "add the garage conversion we discussed")
- Scope reduction (e.g., "skip the backsplash")
- Price adjustment (material cost overrun)

### 7.2 Flow

```
Agent clicks "Create Change Order" in Scope & SOW tab
  → Modal: description, scopes added, scopes removed, price delta, customer note
  → On submit:
      1. Generate addendum PDF (reuse proposal PDF generator infrastructure)
      2. Upload to R2 via media_files insert with category='addendum', tags.zohoSignStatus='pending'
      3. Send to Zoho Sign with customer's email
      4. Zoho Sign returns envelope ID → stored in media_files.tags.zohoEnvelopeId
      5. UI shows addendum in "pending" status

Customer receives Zoho email → signs document
  → Zoho webhook fires → webhook handler:
      1. Downloads signed PDF
      2. Replaces (or appends) media_files row with signed version
      3. Updates tags.zohoSignStatus='signed', tags.signedAt=timestamp
      4. Applies scope changes to x_projectScopes:
          - Inserts rows for added scopes
          - Deletes rows for removed scopes
      5. Logs audit entry (who, when, what changed)
      6. Publishes a realtime event via Ably (`project:{id}:scope-changed`) — the hub subscribes and invalidates Scope, Documents, Financials, and Overview queries so all connected clients see the updated state within seconds without manual refresh

Agent/admin sees:
  → Documents tab: addendum row status changes to "signed"
  → Scope & SOW tab: contracted scopes list updates
  → Financials tab: contract value recalculates
```

### 7.3 Audit Trail

Change order applications must be logged. Options:
- **v1 (lean):** Append entries to `wishlistJSON`-style audit array on project, OR use the existing `activities` table with `type='note'` and a structured `metaJSON` payload.
- **v2 (when needed):** Dedicated `change_orders` table with FK to project + signed media file.

**Decision for v1:** Log to `activities` with `type='note'`, `title='Change Order Applied'`, `metaJSON={ changeOrderId, addedScopes, removedScopes, priceDelta }`. This leverages existing infrastructure and shows up in the Overview "Recent activity" feed and Activities tab.

### 7.4 Edge Cases

- **Customer declines** → Zoho webhook fires with decline status → `media_files.tags.zohoSignStatus='declined'`. No scope changes applied. Displayed in Documents tab. Agent can delete the record or recreate a new one.
- **Customer drags feet (no response)** → addendum stays in `pending` indefinitely. A stale-detection widget (stub for future) could surface this on Overview.
- **Mistake in scope** → Cannot "un-sign" a change order. Agent must create a new change order that reverses/corrects.

---

## 8. Projects Landing Page Enhancement

**Route:** `/dashboard/projects` (existing `PortfolioProjectsView`).

### 8.1 Visibility

- Super-admin: sees all projects.
- Non-admin user: sees only projects they participate in (via `userParticipatesInProject` at the DAL level).

Apply this filter in `projectsRouter.crud.getAll` procedure:

```typescript
getAll: agentProcedure.query(async ({ ctx }) => {
  const isOmni = ctx.ability.can('manage', 'all')
  return db.select(/* ... */).from(projects).where(
    isOmni ? undefined : userParticipatesInProject(ctx.session.user.id, projects.id)
  )
})
```

### 8.2 Filters & Columns

**New filters:**
- **Status** (active, completed, on_hold) — select
- **Pipeline Stage** — select with 11 options from `projectPipelineStages`
- Existing trade filter stays

**New columns:**
- **Pipeline Stage** (badge, sortable by stage order)
- **Status** (badge)

**Updated status column:** Show project `status` as primary badge, `isPublic` as a smaller secondary indicator.

### 8.3 "New Project" button

**Current behavior:** Navigates to `CreateProjectView` (portfolio-style creation — super-admin only in practice).

**New behavior:** Opens a proposal-picker modal (business flow):
- Lists approved proposals NOT yet linked to a project (`meetings.projectId IS NULL` AND proposal is `approved`)
- Agent selects a proposal
- Pre-fills: customer, meeting, proposed title
- Agent confirms/edits title, description, project duration
- Creates project via existing `businessRouter.create` mutation
- Redirects to new project's hub

**Portfolio-only creation (no proposal):** Retained for super-admin via a secondary "Advanced: Create Portfolio Project" option in the modal. Uses existing `projectsRouter.crud.create`. Used for manually adding legacy completed jobs to the portfolio.

---

## 9. Data Flow & tRPC Architecture

### 9.1 No god query

The v1 spec proposed a single `getManagementData` procedure returning everything. Replace with **per-tab focused queries** + Overview aggregator.

**Per-tab queries:**
- Overview: `projectsRouter.crud.getOverview({ id })` — returns project + customer + participants + contract value + activity counts + meeting counts in a SINGLE but FOCUSED query (not everything; just what Overview needs)
- Scope & SOW: `projectsRouter.scope.getContractedScopes({ projectId })` + `projectsRouter.scope.getWishlist({ projectId })` + `projectsRouter.scope.getChangeOrders({ projectId })`
- Activities: `scheduleRouter.activities.getByEntity({ entityType: 'project', entityId })`
- Meetings: `meetingsRouter.getByProject({ projectId })`
- Documents: `projectsRouter.media.getByCategory({ projectId, categories: ['contract', 'addendum', ...] })`
- Gallery: `projectsRouter.media.getByCategory({ projectId, categories: ['photo'] })`
- Financials: `projectsRouter.crud.getFinancialSummary({ projectId })`
- Story: same as Overview (data comes from `projects` table)

**Lazy loading:** Each tab query runs only when the tab is selected (TanStack Query's `enabled: tab === 'X'` pattern).

### 9.2 Visibility at the DAL

Every project-scoped DAL function accepts `{ userId, isOmni }` and applies `userParticipatesInProject` internally when `!isOmni`. No caller should be able to forget this — it's part of the function signature.

### 9.3 Invalidation

Following the documented `pattern-optimistic-updates.md`. Mutations invalidate queries via `useInvalidation` hook in the DAL layer.

---

## 10. File Structure

### 10.1 New Files

```
src/shared/entities/projects/lib/participants/
  get-project-participants.ts
  get-project-primary-owner.ts
  user-participates-in-project.ts
  can-user-access-project.ts
  can-user-edit-project.ts
src/shared/entities/projects/lib/
  infer-project-customer.ts
src/shared/entities/projects/components/
  project-participant-badge.tsx
  project-participant-avatar-group.tsx

src/features/project-management/ui/views/
  project-management-view.tsx                     # New hub view (replaces EditProjectView)

src/features/project-management/ui/components/tabs/
  overview-tab.tsx
  scope-sow-tab.tsx
  activities-tab.tsx
  meetings-tab.tsx
  documents-tab.tsx
  gallery-tab.tsx
  financials-tab.tsx
  story-tab.tsx

src/features/project-management/ui/components/
  project-hub-header.tsx                          # Tier 1 overview header
  project-key-metrics-grid.tsx                    # Tier 2 cards
  project-details-accordion.tsx                   # Tier 3
  recent-activity-feed.tsx                        # Tier 3 recent activity
  wishlist-section.tsx
  wishlist-item-card.tsx
  wishlist-add-form.tsx
  change-order-section.tsx
  change-order-create-modal.tsx
  change-order-row.tsx
  contracted-scopes-section.tsx
  project-activities-panel.tsx                    # Wraps schedule-mgmt components
  project-meetings-list.tsx
  project-documents-panel.tsx
  document-category-filter.tsx
  project-creation-modal.tsx                      # Proposal picker
  project-tab-bar.tsx                             # Responsive tab bar component

src/features/project-management/hooks/
  use-project-hub-tabs.ts
  use-project-overview.ts
  use-project-scope.ts
  use-project-change-orders.ts
  use-project-wishlist.ts

src/features/project-management/dal/server/
  get-project-overview.ts
  get-project-scope.ts
  get-project-wishlist.ts
  get-project-change-orders.ts
  get-project-meetings.ts
  get-project-financials.ts
  manage-wishlist.ts
  create-change-order.ts
```

### 10.2 Modified Files

```
src/shared/db/schema/meta.ts                          # Add mediaFileCategoryEnum
src/shared/db/schema/projects.ts                      # Add wishlistJSON column
src/shared/db/schema/media-files.ts                   # Add category column
src/shared/constants/enums/media.ts                   # Add mediaFileCategories const + type
src/shared/entities/projects/schemas/index.ts         # Add wishlistSchema
src/trpc/init.ts                                      # Add projectProcedure middleware
src/trpc/routers/schedule.router/activities.router.ts # Add getByEntity procedure
src/trpc/routers/projects.router/crud.router.ts       # Add getOverview, getFinancialSummary; update getAll for visibility
src/trpc/routers/projects.router/                     # New scope.router.ts (change orders + wishlist)
src/trpc/routers/meetings.router.ts                   # Add getByProject, participant inheritance on create with projectId
src/features/project-management/ui/views/index.ts     # Export new view
src/app/(frontend)/dashboard/projects/[projectId]/page.tsx     # Use ProjectManagementView
src/features/project-management/ui/views/portfolio-projects-view.tsx  # Add filters + visibility
src/features/project-management/ui/components/table/columns.tsx       # Add status + stage columns
src/features/project-management/constants/table-filter-config.ts      # Add filters
```

### 10.3 Removed/Replaced

```
src/features/project-management/ui/views/edit-project-view.tsx    # Replaced
src/features/project-management/ui/views/create-project-view.tsx  # Replaced by modal (portfolio-only retained as advanced option)
```

---

## 11. Stub Documentation

| Stub | Location | What it will become |
|---|---|---|
| Financials: QuickBooks | financials-tab.tsx | QB OAuth + transaction sync + per-scope P&L |
| Financials: Expenses | financials-tab.tsx | Manual + QB-synced expense entry |
| Documents: Gmail import | documents-tab.tsx | Gmail MCP → attachment extraction → auto-upload |
| Activities: Reminders | (existing system) | QStash-scheduled push notifications |
| Activities: Assignee management | (existing system) | Multi-assign dropdown |
| Meetings: Inline scheduler | meetings-tab.tsx | Inline date/time picker instead of redirect |
| Change Orders: dedicated table | v2 spec | Extract from `media_files` + `activities` to `change_orders` table with richer fields |
| Stale addendum detection | Overview widget | Surface pending addendums >7d old |
| Role-specific tab visibility | use-project-hub-tabs.ts | When roles exist, tabs declare `visibleFor` predicates |

---

## 12. Verification Plan

### 12.1 Schema & Migration
1. Run `pnpm db:push:dev` — verify `wishlistJSON` column added, `category` column added with default `'photo'`
2. `pnpm tsc` passes
3. `pnpm lint` passes

### 12.2 Participant Derivation
4. Create a test project via `businessRouter.create` — verify `getProjectPrimaryOwner` returns the meeting creator
5. Add a second meeting to the project (different owner) — verify `getProjectParticipants` returns both with correct `isPrimaryOwner` / `isAnyOwner` flags
6. Add a helper to one of the meetings — verify they appear with `role: ['helper']` and `isAnyOwner: false`
7. `canUserAccessProject` returns true for participants, false for non-participants, true for super-admin

### 12.3 Hub Loads
8. Navigate to `/dashboard/projects/[id]` — all 8 tabs render
9. Tab selection persists via `?tab=` URL param
10. Mobile viewport: primary tabs visible, secondary in "More" menu

### 12.4 Per-Tab Functionality
11. **Overview:** Tier 1/2/3 hierarchy renders. Inline edits (title, status, pipeline stage, dates) persist and show optimistic UI. Participant avatar group displays correctly with tooltip.
12. **Scope & SOW:** Contracted scopes display grouped by trade. Wishlist add/edit/dismiss works optimistically. "Promote to Proposal" creates a new meeting with participants inherited.
13. **Change Order (happy path):** Create CO → PDF generated → Zoho Sign sends → status `pending`. Simulated sign webhook → status `signed`, scopes update in `x_projectScopes`, contract value recalculates, audit activity logged.
14. **Change Order (decline):** Webhook with decline → status `declined`, no scope changes.
15. **Activities:** `getByEntity` returns project activities. Create/update/complete work. `?filter=overdue` pre-applies filter. GCal sync for events/reminders confirmed.
16. **Meetings:** Lists project meetings. Originating-meeting star icon displays. Schedule new meeting inherits primary owner + co-owners per §1.6.
17. **Documents:** Category filter works. Uploaded doc appears in correct bucket. Zoho Sign status reflects live on addendum rows.
18. **Gallery:** Filtered to `category='photo'`. Existing functionality unchanged.
19. **Financials:** Contract value = base + signed addendum deltas. Stubs render.
20. **Story:** Existing narrative fields work unchanged.

### 12.5 Visibility
21. Non-admin user: `/dashboard/projects` shows only their participant projects. Attempting to access another project's hub via direct URL returns 403.
22. Super-admin: sees all projects everywhere.

### 12.6 Landing Page
23. New filters (status, pipeline stage) filter correctly. New columns render.
24. "New Project" button opens proposal picker. Selecting proposal creates project and redirects to hub.
25. Advanced portfolio-only creation still accessible to super-admin.

### 12.7 Cross-feature
26. Customer profile modal still shows project list for that customer.
27. Customer pipeline kanban still navigates to hub on project card click.
28. Dashboard action queue links to Activities tab with `?tab=activities`.
29. Customer invariant: attempting to update a meeting's `customerId` to differ from the project's linked meetings throws from `inferProjectCustomer`.

---

## 13. What This Spec Does NOT Cover (explicit scope guards)

- **Project participants table** — intentionally derived, not stored.
- **Per-role permission implementations** — only the flexibility layer. Actual `production`, `foreman`, `qa` roles come later.
- **QuickBooks sync** — stubbed.
- **Gmail attachment import** — stubbed.
- **Custom expense tracking** — stubbed.
- **Dedicated change_orders table** — using `media_files` + `activities` audit for v1.
- **Stale addendum alerts** — future widget.
- **Related portfolio projects (#64)** — unchanged; separate spec.
- **Bulk image move bug (#41)** — unchanged; separate PR.
