# Adaptive Agent Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **UI build note:** every task that edits UI must load `impeccable`'s `reference/craft-floor.md` immediately before editing, and honor the Command Desk world (DESIGN.md). This plan locks *structure, data, and reuse*; the craft-floor owns the *pixels*.

**Goal:** Replace the `/dashboard` "Coming Soon" stub with a mobile-first, role-adaptive operational home screen for sales agents (super-admin inherits via omni data), built by composing existing compound entity cards.

**Architecture:** A single server component (`page.tsx`) protects + fire-and-forget `prefetch()`es the module queries, then hydrates a client `DashboardView` that renders a vertical stack: snapshot strip → Meetings hub (Today day-timeline + Upcoming/Past lists) → Action queue → Proposals awaiting signature → Open projects. Each module is a small client component that fetches via tRPC hooks (React Query dedupes shared keys), composes the entity's existing compound card via `EntityList`/`EntityActionMenu`, and owns its own skeleton/empty state. Role adaptation is purely data-level (`isOmni` in the procedures); no role branches in the view.

**Tech Stack:** Next.js 15 (App Router, RSC), tRPC + TanStack Query, Drizzle (Postgres/Neon), Tailwind v4, shadcn/ui, motion/react, CASL.

## Global Constraints

- **No test runner exists.** Verify every task with `pnpm tsc` (`tsc --noEmit`) and `pnpm lint` (`next lint`). Do NOT write `*.test.ts` files or reference `pnpm test` — there is no harness. UI tasks additionally get a manual Playwright-MCP visual smoke via the dev-auth route (see Task 11). **Never run `pnpm build`** unless explicitly asked (project rule).
- **Reuse over ad-hoc — expand existing API surface, never add thin/ad-hoc implementations** (project rule + memory `feedback-reuse-existing-api-surface`). Every data need is "already supported" or a minimal "expand X".
- **Compose existing compound cards.** Meetings → `MeetingOverviewCard`; Proposals → `ProposalOverviewCard`; Projects → `ProjectEntityCard`. Collections → `EntityList`. Actions → `EntityActionMenu` (CASL-filtered). No new bespoke entity cards.
- **Command Desk world only** (`DESIGN.md`): cool-paper neutrals, **Cobalt Command** as the single accent (≤10% of a screen), Syne titles / Nunito body / Space Mono eyebrows, tinted depth, frosted-glass for floating menus. DESIGN.md is **untouched**.
- **Fixed stage/outcome colors** (Stage-Color Rule): red=bad, yellow=in-progress, green=converted, purple=action, blue=neutral. Never restyled. Use existing `MEETING_OUTCOME_SENTIMENT` / tier color maps.
- **Mobile-first, field-primary.** Single column on phone; comfortable max-width on desktop. Tap-targets ≥44px. Respect PWA safe-area insets.
- **Path alias:** `@/` → `src/`. **Named exports only.** One component per file. Entity co-location. (Coding conventions apply.)
- **No manual `updatedAt`; no raw `db` in services; event timestamps via JS `new Date().toISOString()`** — not relevant to most tasks here but binding if touched.

## Deviations from spec §6 (verified against code — deliberate)

- **`getActionQueue`: NOT expanded.** Spec suggested adding a `limit`/tier input. Verified unnecessary for v1: the procedure already returns urgent items sorted; the module reuses the existing `getActionQueue` query + `group-items-by-tier` and caps display client-side. "See all →" links to the existing Action Center.
- **`listMeetings`: NOT expanded.** Spec suggested attaching per-meeting proposals+`sowSummary`. Verified unnecessary for v1: `MeetingListRow` already carries `proposalCount`, `hasSentProposal`, `hasApprovedProposal`, and denormalized customer/owner fields — enough for compact timeline/list cards. Nested proposals under meetings is deferred.
- **Action-queue module reuses the existing `ActionCard`.** The action queue's data is `ActionItem` (a summary shape), not an entity row, so it does not map to a compound entity card. Reusing the purpose-built `ActionCard` + `group-items-by-tier` is the strongest reuse and the correct reading of the reuse mandate. (The "don't reuse ActionCard" note in spec §5 governs the meetings/proposals/projects modules, which DO use compound cards.)

---

## Phase 1 — Data layer (2 minimal backend expansions)

### Task 1: Proposals "awaiting signature" filter

Adds a precise contract-state filter to the existing proposals list so the dashboard can request the awaiting-signature roster. "Awaiting signature" = contract sent, not yet signed or declined.

**Files:**
- Modify: `src/shared/entities/proposals/dal/server/queries.ts` (filters schema `:68-77` + `buildFilterWhere` map `:198-227`)

**Interfaces:**
- Produces: a new optional filter key `awaitingSignature: boolean` on `proposalListFiltersSchema`, consumed by `proposals.business.list`. When `true`, restricts to `contractSentAt IS NOT NULL AND contractSignedAt IS NULL AND contractDeclinedAt IS NULL`.

- [ ] **Step 1: Add the filter key to the schema**

In `queries.ts`, extend `proposalListFiltersSchema`:

```ts
export const proposalListFiltersSchema = {
  status: z.array(z.enum(proposalStatuses)).optional(),
  kind: z.array(z.enum(proposalKinds)).optional(),
  createdAt: dateRangeSchema.optional(),
  sentAt: dateRangeSchema.optional(),
  pipeline: z.enum(pipelines).optional(),
  price: numberRangeSchema.optional(),
  customerId: z.string().uuid().optional(),
  meetingId: z.string().uuid().optional(),
  awaitingSignature: z.boolean().optional(), // NEW
}
```

- [ ] **Step 2: Handle the key in `buildFilterWhere`**

In `listProposals`'s `buildFilterWhere(input.filters, { ... })` map, add the `awaitingSignature` handler alongside the existing keys (use the same `proposals` table columns confirmed in schema `:58-61`):

```ts
awaitingSignature: (v: boolean) =>
  v
    ? and(
        isNotNull(proposals.contractSentAt),
        isNull(proposals.contractSignedAt),
        isNull(proposals.contractDeclinedAt),
      )
    : undefined,
```

Ensure `isNull`, `isNotNull`, `and` are imported from `drizzle-orm` at the top of the file (add any missing).

- [ ] **Step 3: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS (no errors touching `queries.ts`).

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/proposals/dal/server/queries.ts
git commit -m "feat(proposals): awaitingSignature list filter (contract sent, unsigned)"
```

---

### Task 2: Projects scoping via meeting participation

`projects.crud.list` is currently a bare `agentProcedure` with no scoping — every agent sees all projects. Add participation-based scoping so a non-omni agent sees only projects they participate in (via `meetings.projectId` → `meetingParticipants`), while super-admin (omni) keeps seeing all. Mirrors the inline omni pattern already in `getActionQueue`.

**Files:**
- Create: `src/shared/entities/projects/lib/visibility.ts`
- Modify: `src/trpc/routers/projects.router/crud.router.ts` (`list` procedure `:23-111`)

**Interfaces:**
- Produces: `projectParticipationScope(userId: string): SQL` — an `EXISTS` predicate true when the user participates in any meeting whose `projectId` = `projects.id`. Consumed by `projects.crud.list`, AND-ed into its `where` when not omni.

- [ ] **Step 1: Write the visibility predicate**

Create `src/shared/entities/projects/lib/visibility.ts`:

```ts
import { and, eq, exists, type SQL, sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { meetingParticipants, meetings } from '@/shared/db/schema'
import { projects } from '@/shared/db/schema/projects'

/**
 * A project is "owned" by a user when they participate in ≥1 of its meetings.
 * See docs/superpowers/specs/2026-08-06-adaptive-agent-dashboard-design.md §6.
 */
export function projectParticipationScope(userId: string): SQL {
  return exists(
    db
      .select({ id: meetings.id })
      .from(meetings)
      .innerJoin(meetingParticipants, eq(meetingParticipants.meetingId, meetings.id))
      .where(and(
        eq(meetings.projectId, projects.id),
        eq(meetingParticipants.userId, userId),
      )),
  )
}
```

Verify the real import paths/column names against `src/shared/db/schema/` before finalizing (`meetings.projectId`, `meetingParticipants.meetingId`, `meetingParticipants.userId`, `projects.id`). Adjust the `db` import to the project's canonical path (`@/shared/db`).

- [ ] **Step 2: Apply the scope in `projects.crud.list`**

In `crud.router.ts`, change the `list` query callback from `{ input }` to `{ ctx, input }`, compute omni, and AND the scope into the existing `where`:

```ts
.query(async ({ ctx, input }) => {
  const isOmni = ctx.ability.can('manage', 'all')
  const scopeWhere = isOmni ? undefined : projectParticipationScope(ctx.session.user.id)
  // ...existing searchWhere + filterWhere...
  const where = and(scopeWhere, searchWhere, filterWhere) // scope prepended
  // ...unchanged: select/orderBy/limit/offset + count + x_projectScopes aggregation...
})
```

Import `projectParticipationScope` from `@/shared/entities/projects/lib/visibility`. Confirm `ctx.ability` and `ctx.session` are present on `agentProcedure`'s context (they are — `scopeMiddleware` reads the same).

- [ ] **Step 3: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Manual sanity (optional, Playwright-MCP)**

Navigate (dev-auth) as an agent to `/dashboard/projects` and confirm the list is now participation-scoped (non-empty only where the agent has meetings); as super-admin, confirm all projects still show. Route ritual in Task 11.

- [ ] **Step 5: Commit**

```bash
git add src/shared/entities/projects/lib/visibility.ts src/trpc/routers/projects.router/crud.router.ts
git commit -m "feat(projects): scope crud.list by meeting participation (omni sees all)"
```

---

## Phase 2 — Dashboard shell & shared data

### Task 3: Meeting-window helpers + dashboard query configs

Small pure helpers that produce the `scheduledFor` date ranges for Today/Upcoming/Past, and reusable dashboard query-input builders so every module and the strip share one query key per concern.

**Files:**
- Create: `src/features/agent-dashboard/lib/meeting-windows.ts`
- Create: `src/features/agent-dashboard/constants/dashboard-queries.ts`

**Interfaces:**
- Produces:
  - `meetingWindow(kind: 'today' | 'upcoming' | 'past'): { from?: string, to?: string }` — ISO bounds for the `scheduledFor` filter.
  - `DASHBOARD_LIMITS` — `{ meetings: 8, proposals: 20, projects: 15 }` (top-N caps).
  - `todaysMeetingsInput()`, `upcomingMeetingsInput()`, `pastMeetingsInput()`, `awaitingProposalsInput()`, `activeProjectsInput()` — objects matching the respective `*ListInputSchema`, with `pagination.limit` set to the cap and `sort` set (asc `scheduledFor` for today/upcoming; desc for past; desc `sentAt` for proposals; desc `createdAt` for projects).

- [ ] **Step 1: Write the window helper**

Create `src/features/agent-dashboard/lib/meeting-windows.ts`:

```ts
export type MeetingWindowKind = 'today' | 'upcoming' | 'past'

/** ISO bounds for the meetings `scheduledFor` dateRange filter, local-day based. */
export function meetingWindow(kind: MeetingWindowKind): { from?: string, to?: string } {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTomorrow = new Date(startOfToday)
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)
  switch (kind) {
    case 'today':
      return { from: startOfToday.toISOString(), to: startOfTomorrow.toISOString() }
    case 'upcoming':
      return { from: startOfTomorrow.toISOString() }
    case 'past':
      return { to: startOfToday.toISOString() }
  }
}
```

- [ ] **Step 2: Write the query-input builders**

Create `src/features/agent-dashboard/constants/dashboard-queries.ts` building inputs that satisfy the real schemas (`meetingListInputSchema`, `proposalListInputSchema`, and the `projects.crud.list` input). Use the exact filter keys confirmed in the explore (`scheduledFor`, `status`, `awaitingSignature`). Example:

```ts
import { meetingWindow, type MeetingWindowKind } from '../lib/meeting-windows'

export const DASHBOARD_LIMITS = { meetings: 8, proposals: 20, projects: 15 } as const

export function meetingsWindowInput(kind: MeetingWindowKind) {
  return {
    pagination: { limit: DASHBOARD_LIMITS.meetings, offset: 0 },
    sort: { sortBy: 'scheduledDate', sortDir: kind === 'past' ? 'desc' : 'asc' },
    filters: { scheduledFor: meetingWindow(kind) },
  }
}

export function awaitingProposalsInput() {
  return {
    pagination: { limit: DASHBOARD_LIMITS.proposals, offset: 0 },
    sort: { sortBy: 'sentAt', sortDir: 'desc' },
    filters: { awaitingSignature: true },
  }
}

export function activeProjectsInput() {
  return {
    pagination: { limit: DASHBOARD_LIMITS.projects, offset: 0 },
    sort: { sortBy: 'createdAt', sortDir: 'desc' },
    filters: { status: ['active'] },
  }
}
```

Confirm the exact `sortBy` field names accepted by each list's `buildOrderBy` (check the meetings/proposals sort maps; adjust `'scheduledDate'`/`'sentAt'`/`'createdAt'` to the real keys). If a sort key is unsupported, omit `sort` and rely on the DAL default.

- [ ] **Step 3: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. If the input objects don't satisfy the Zod input types, fix the shapes now (this is why they're isolated in one file).

- [ ] **Step 4: Commit**

```bash
git add src/features/agent-dashboard/lib/meeting-windows.ts src/features/agent-dashboard/constants/dashboard-queries.ts
git commit -m "feat(dashboard): meeting-window helpers + shared query inputs"
```

---

### Task 4: Page shell + DashboardView scaffold + prefetch

Replace the stub with the real server component and an empty-but-wired client view. Modules are added in Phase 3; this task establishes the shell, prefetch, and hydration so each later module can be dropped in and immediately render.

**Files:**
- Modify: `src/app/(frontend)/dashboard/page.tsx` (currently the stub)
- Create: `src/features/agent-dashboard/ui/views/dashboard-view.tsx`

**Interfaces:**
- Consumes: `protectDashboardPage()`, `prefetch`, `trpc` server client, `HydrateClient`, the Task 3 input builders, `dashboardRouter.getActionQueue`.
- Produces: `DashboardView` (client) — the vertical stack container; renders module slots (added in Phase 3) with `id` anchors (`#meetings`, `#queue`, `#proposals`, `#projects`) for the strip jump-links.

- [ ] **Step 1: Write the server page**

Replace `src/app/(frontend)/dashboard/page.tsx`:

```tsx
import { activeProjectsInput, awaitingProposalsInput, meetingsWindowInput } from '@/features/agent-dashboard/constants/dashboard-queries'
import { DashboardView } from '@/features/agent-dashboard/ui/views/dashboard-view'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'
import { HydrateClient } from '@/trpc/components/hydrate-client'
import { prefetch } from '@/trpc/lib/prefetch'
import { trpc } from '@/trpc/server'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const authState = await protectDashboardPage()
  if (authState.status === 'authenticated') {
    prefetch(trpc.meetingsRouter.reads.list.queryOptions(meetingsWindowInput('today')))
    prefetch(trpc.dashboardRouter.getActionQueue.queryOptions())
    prefetch(trpc.proposalsRouter.business.list.queryOptions(awaitingProposalsInput()))
    prefetch(trpc.projectsRouter.crud.list.queryOptions(activeProjectsInput()))
  }
  return (
    <HydrateClient>
      <DashboardView />
    </HydrateClient>
  )
}
```

Confirm the exact server-side router accessor names (`trpc.meetingsRouter.reads.list`, `trpc.dashboardRouter.getActionQueue`, `trpc.proposalsRouter.business.list`, `trpc.projectsRouter.crud.list`) against `src/trpc/server.ts` + the router index; fix any naming mismatch. `getActionQueue` takes no input → `.queryOptions()`.

- [ ] **Step 2: Write the client view scaffold**

Create `src/features/agent-dashboard/ui/views/dashboard-view.tsx` — a `'use client'` component that lays out the vertical stack with anchor ids and placeholder sections (filled in Phase 3):

```tsx
'use client'

export function DashboardView() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-24 pt-4">
      {/* Task 5 */}
      {/* <DashboardSnapshotStrip /> */}
      <section id="meetings">{/* Task 6 */}</section>
      <section id="queue">{/* Task 7 */}</section>
      <section id="proposals">{/* Task 8 */}</section>
      <section id="projects">{/* Task 9 */}</section>
    </div>
  )
}
```

(Spacing/max-width are placeholders; the craft-floor refines them. `max-w-3xl` keeps mobile single-column and a comfortable desktop measure.)

- [ ] **Step 3: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. The page renders an empty stack (no runtime error).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(frontend)/dashboard/page.tsx" src/features/agent-dashboard/ui/views/dashboard-view.tsx
git commit -m "feat(dashboard): page shell + prefetch + DashboardView scaffold"
```

---

## Phase 3 — Modules

> Each module is a `'use client'` component that fetches with `trpc.<...>.useQuery(input)` (React Query dedupes the same key already prefetched in Task 4), renders a card-shaped skeleton while loading, an empty-with-next-step state when zero, and the composed compound cards otherwise, capped at the Task 3 limit with a "See all →" link. Load the craft-floor before editing.

### Task 5: Snapshot strip

**Files:**
- Create: `src/features/agent-dashboard/ui/components/dashboard-snapshot-strip.tsx`

**Interfaces:**
- Consumes: the same query hooks/inputs used by the modules (Task 3 builders) to read totals — `meetingsWindowInput('today')` total, `awaitingProposalsInput()` total, and the `getActionQueue` follow-up-due count.
- Produces: `DashboardSnapshotStrip` — 3 count chips, each an anchor link (`href="#meetings"|"#proposals"|"#queue"`) that smooth-scrolls to its section.

- [ ] **Step 1: Build the strip**

Read totals from the shared queries (deduped): meetings-today `data.total`, awaiting-signature `data.total`, and follow-ups-due = count of `getActionQueue` items with `tier === 'FOLLOW_UP_DUE'` (import `ActionItem`/tier from `@/features/agent-dashboard/dal/server/get-action-queue` types or the client-safe type). Render three compact chips (Space Mono eyebrow label + Syne number), each an `<a href="#...">`. Non-sticky (scrolls with content per the brief). While counts load, show muted dashes, not spinners.

- [ ] **Step 2: Mount it in `DashboardView`**

Uncomment/insert `<DashboardSnapshotStrip />` at the top of the stack in `dashboard-view.tsx`.

- [ ] **Step 3: Type-check, lint, visual**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. Confirm the three anchors scroll to their sections.

- [ ] **Step 4: Commit**

```bash
git add src/features/agent-dashboard/ui/components/dashboard-snapshot-strip.tsx src/features/agent-dashboard/ui/views/dashboard-view.tsx
git commit -m "feat(dashboard): snapshot strip with jump-links"
```

---

### Task 6: Meetings hub (Today timeline + Upcoming/Past lists)

**Files:**
- Create: `src/features/agent-dashboard/ui/components/dashboard-meetings-hub.tsx`
- Create: `src/features/agent-dashboard/ui/components/dashboard-today-timeline.tsx`
- Create: `src/features/agent-dashboard/ui/components/dashboard-meetings-list.tsx`

**Interfaces:**
- Consumes: `trpc.meetingsRouter.reads.list.useQuery(meetingsWindowInput(kind))`; `MeetingOverviewCard` (+ `ParticipantsSlot`, `.Fields`, `.Actions`); `EntityList`; `MeetingListRow` type.
- Produces: `DashboardMeetingsHub` — tabbed section (Today | Upcoming | Past, default Today) inside `#meetings`. Today → `DashboardTodayTimeline`; Upcoming/Past → `DashboardMeetingsList kind=...`.

- [ ] **Step 1: Build the tab shell**

`DashboardMeetingsHub` renders a segmented control (reuse the app's existing tabs primitive — check `src/shared/components/ui` for `Tabs`) with three tabs; default `today`. Header shows a Syne title "Meetings" + a "See all →" link to `/dashboard/meetings`. Each tab lazy-mounts its content.

- [ ] **Step 2: Build the Today timeline**

`DashboardTodayTimeline` fetches `meetingsWindowInput('today')`, then renders a **compact left time rail**: for each meeting, a time label (from `scheduledFor`, formatted `h:mma`) on a hairline rail, with a `MeetingOverviewCard` attached to the right. Compose the card densely: customer name, `.Fields` for `outcome` + `type`, `proposalCount` badge, `ParticipantsSlot variant="compact"`, and `.Actions mode="compact"` (start, log outcome, create proposal, navigate — all from the existing meeting action configs). Skeleton = 2–3 rail rows. Empty = "No meetings today — book one" with a link to the schedule. Cap at `DASHBOARD_LIMITS.meetings`.

- [ ] **Step 3: Build the Upcoming/Past list**

`DashboardMeetingsList` takes `kind: 'upcoming' | 'past'`, fetches `meetingsWindowInput(kind)`, and renders an `EntityList` of `MeetingOverviewCard` (dense, no time rail — show date+time in `.Fields`). Same empty/skeleton/cap conventions ("No upcoming meetings" / "No past meetings").

- [ ] **Step 4: Mount the hub**

Insert `<DashboardMeetingsHub />` into `#meetings` in `dashboard-view.tsx`.

- [ ] **Step 5: Type-check, lint, visual**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. Visually confirm the tabs switch and the Today rail renders with real cards.

- [ ] **Step 6: Commit**

```bash
git add src/features/agent-dashboard/ui/components/dashboard-meetings-hub.tsx src/features/agent-dashboard/ui/components/dashboard-today-timeline.tsx src/features/agent-dashboard/ui/components/dashboard-meetings-list.tsx src/features/agent-dashboard/ui/views/dashboard-view.tsx
git commit -m "feat(dashboard): meetings hub with Today timeline + upcoming/past lists"
```

---

### Task 7: Action queue module

**Files:**
- Create: `src/features/agent-dashboard/ui/components/dashboard-action-queue.tsx`

**Interfaces:**
- Consumes: `trpc.dashboardRouter.getActionQueue.useQuery()`; the existing `group-items-by-tier` lib, `action-tiers` constants, `tier-color-map`, and the existing `ActionCard` component (all in `src/features/agent-dashboard/`).
- Produces: `DashboardActionQueue` — grouped-by-tier list of `ActionCard`, urgent-only, capped, inside `#queue`, with "See all →" to the Action Center.

- [ ] **Step 1: Build the module**

Reuse the exact rendering the Action Center already uses: fetch `getActionQueue`, `groupByTier(items)`, render per-tier sections of the existing `ActionCard` (do not rebuild it). Cap total displayed rows (e.g. first ~8 across tiers, preserving tier order) and add "See all →" to the Action Center route/sheet. Header: Syne title "Needs attention". Skeleton = 3 card rows. Empty = "You're all caught up" (positive empty state). Reuse `TIER_*` color maps for the redundant color+label+icon urgency encoding (never color alone).

- [ ] **Step 2: Mount it**

Insert `<DashboardActionQueue />` into `#queue`.

- [ ] **Step 3: Type-check, lint, visual**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. Confirm tiers render in order with correct colors.

- [ ] **Step 4: Commit**

```bash
git add src/features/agent-dashboard/ui/components/dashboard-action-queue.tsx src/features/agent-dashboard/ui/views/dashboard-view.tsx
git commit -m "feat(dashboard): action queue module (reuses ActionCard + tier grouping)"
```

---

### Task 8: Proposals awaiting signature module

**Files:**
- Create: `src/features/agent-dashboard/ui/components/dashboard-proposals.tsx`

**Interfaces:**
- Consumes: `trpc.proposalsRouter.business.list.useQuery(awaitingProposalsInput())`; `ProposalOverviewCard`; `EntityList`; `ProposalListRow`.
- Produces: `DashboardProposals` — calm `EntityList` of `ProposalOverviewCard`, awaiting-signature roster, inside `#proposals`, "See all →" to `/dashboard/proposals`.

- [ ] **Step 1: Build the module**

Fetch `awaitingProposalsInput()`. Render `EntityList` of `ProposalOverviewCard` composed densely: `.StatusIcon`/`.StatusBadge`, `.Label`, `.Trade`, `.Value`, `.ViewCount`, `.CreatedAt format="relative"` (days-since-sent), `.Actions mode="compact"`. Map `ProposalListRow` → the card's `ProposalOverviewCardData` (derive `trade`/`value`/`sowSummary` as the existing proposal-row renderers do; if a field isn't on `ProposalListRow`, omit its slot rather than inventing data). Header: "Awaiting signature". Skeleton = 3 rows. Empty = "No proposals awaiting signature". Cap at `DASHBOARD_LIMITS.proposals`.

- [ ] **Step 2: Mount it**

Insert `<DashboardProposals />` into `#proposals`.

- [ ] **Step 3: Type-check, lint, visual**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/agent-dashboard/ui/components/dashboard-proposals.tsx src/features/agent-dashboard/ui/views/dashboard-view.tsx
git commit -m "feat(dashboard): proposals awaiting-signature roster module"
```

---

### Task 9: Open projects module

**Files:**
- Create: `src/features/agent-dashboard/ui/components/dashboard-projects.tsx`

**Interfaces:**
- Consumes: `trpc.projectsRouter.crud.list.useQuery(activeProjectsInput())` (now participation-scoped from Task 2); the existing `ProjectEntityCard`; `EntityList`.
- Produces: `DashboardProjects` — active projects with stage + next action, inside `#projects`, "See all →" to `/dashboard/projects`.

- [ ] **Step 1: Build the module**

Fetch `activeProjectsInput()`. Render an `EntityList` of `ProjectEntityCard` (the proven composition — it already shows title + status/pipelineStage badges + `EntityActionMenu`). If `ProjectEntityCard` requires the richer `CustomerProfileProject` shape rather than the `projects.crud.list` row, either (a) map the `crud.list` row to the minimal props `ProjectEntityCard` needs, or (b) render a lean project row composing the same badges + `EntityActionMenu` from `use-project-action-configs` — **do not** duplicate stage-color logic; reuse the projects pipeline color map. Confirm which shape `ProjectEntityCard` needs before choosing. Header: "Open projects". Skeleton = 2 rows. Empty = "No open projects". Cap at `DASHBOARD_LIMITS.projects`.

- [ ] **Step 2: Mount it**

Insert `<DashboardProjects />` into `#projects`.

- [ ] **Step 3: Type-check, lint, visual**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/agent-dashboard/ui/components/dashboard-projects.tsx src/features/agent-dashboard/ui/views/dashboard-view.tsx
git commit -m "feat(dashboard): open projects module"
```

---

## Phase 4 — Integration, states & finish

### Task 10: Cross-module states, responsiveness & omni check

**Files:**
- Modify: any module component needing state/responsive fixes; `dashboard-view.tsx`.

- [ ] **Step 1: Verify every module's three states** render correctly: loading (card-shaped skeleton, never a bare spinner), empty (next-step copy + link), populated (capped + "See all →"). Fix any that regressed.
- [ ] **Step 2: Responsive pass** — confirm single-column phone layout, ≥44px tap targets, safe-area padding at the bottom (`pb-24` clears the mobile nav), and a comfortable desktop max-width. No horizontal scroll on the page body.
- [ ] **Step 3: Omni check** — sign in (dev-auth) as super-admin and confirm all four modules show org-wide data (higher counts) with owner avatars visible on cards; as agent, confirm own-scoped data. No role branches in the view (data-level only).
- [ ] **Step 4: Type-check, lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src/features/agent-dashboard src/app/(frontend)/dashboard
git commit -m "chore(dashboard): state/responsive/omni integration pass"
```

---

### Task 11: Playwright-MCP visual smoke + impeccable finish

**Files:** none (verification + polish handoff).

**Dev-auth ritual (do this first each session):** navigate the Playwright-MCP browser to `/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET>&as=<agent-email>&redirect=/dashboard` before interacting (see `docs/codebase-conventions/dev-auth-route.md`). Repeat with `role=super-admin` for the omni pass.

- [ ] **Step 1: Visual smoke** — with `pnpm dev` running, load `/dashboard` at a mobile viewport (e.g. 390×844) and desktop (1440). Screenshot both. Confirm: strip → meetings (Today timeline) → queue → proposals → projects order; tabs switch; jump-links scroll; empty/populated states look right; Cobalt accent is scarce (≤10%); stage colors correct.
- [ ] **Step 2: Impeccable finish** — run the impeccable `polish` pass (load `craft-floor.md`) as a single bounded round over the built dashboard: batch desktop+mobile screenshots, scan for defects, apply micro-edits, confirm once, stop. Honor the shaping brief (compact day-timeline, denser rows, non-sticky strip) and the Command Desk world.
- [ ] **Step 3: Final gate** — `pnpm tsc && pnpm lint` PASS.
- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "polish(dashboard): visual finish pass (Command Desk)"
```

---

## Self-Review

**Spec coverage:** strip (Task 5), meetings hub Today/Upcoming/Past + timeline focal moment (Task 6), action queue urgent-only (Task 7), proposals awaiting-signature roster (Tasks 1+8), open projects participation-scoped (Tasks 2+9), single-scroll Approach-A view + prefetch/hydration (Task 4), omni role adaptation (Tasks 2/7/10), states/responsive (Task 10), Command Desk finish (Task 11). Deviations (getActionQueue/listMeetings not expanded; ActionCard reused) documented above with rationale. Dispatcher/FAB/Cmd+K/KPIs/live-now explicitly out of scope.

**Placeholder scan:** verification steps are `pnpm tsc && pnpm lint` (real scripts); no `pnpm test` (no runner); UI craft deferred to the craft-floor by design, with concrete composition/props/data specified per module. Router accessor names and sort keys are flagged "confirm against source" where the explore couldn't guarantee the exact string — these are verification instructions, not blanks.

**Type consistency:** `meetingWindow`/`meetingsWindowInput`/`awaitingProposalsInput`/`activeProjectsInput` (Task 3) are the names consumed in Tasks 4–9; `projectParticipationScope` (Task 2) consumed in `crud.list`; `awaitingSignature` filter key (Task 1) consumed by `awaitingProposalsInput` (Task 3). Card data types (`MeetingListRow`, `ProposalListRow`, project row) are mapped to the compound cards' `*OverviewCardData` at each module with an explicit "omit slot if field absent" rule.
