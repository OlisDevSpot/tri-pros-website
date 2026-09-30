# Records bulk actions, setter and projects entity table — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Super-admins bulk-act on ticked rows of the meetings, projects and campaign-leads tables through one server runner; meetings record their setter from every add-a-meeting form; projects move onto a field list and get an entity table with an expanded row.

**Architecture:** One pure runner (`runBulk`) under two tRPC procedure builders gives each entity router a `bulk.delete` / `bulk.update` leaf whose rows run one at a time through the entity's own crud (hooks fire). `DataTable` owns row selection and mounts a floating `BulkActionBar` that renders ordinary `EntityActionConfig<RowSelection>`s through `EntityActionMenu`. Each entity table is a headless hook (`use<Entity>Table`); records views compose the page shell themselves.

**Tech Stack:** Next.js 15 App Router, tRPC v11, Drizzle + Postgres (Neon), Zod 4, drizzle-zod, TanStack Table/Query, CASL, shadcn/ui (Radix), motion/react, pnpm, `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-28-records-bulk-actions-and-entity-tables-design.md` (v3, approved for planning 2026-09-29). Tracker: `docs/plans/2026-09-26-records-management-epic.md` (D37–D48, O8, O9). **Out of this plan:** spec §6 (proposals, B6) — planned after the approval session (`docs/plans/2026-09-29-approval-project-outcome-handoff.md`); the legacy-query-helper deletion that waits for it.

## Global Constraints

- Verification per task: `pnpm tsc` and `pnpm lint`. **Never `pnpm build`.**
- **No database writes for testing** (dev included). Browser checks read and open UI only; any write check (a bulk run, a setter change) runs only on rows the owner designates, or is verified by code and types.
- No unit runner in the repo: pure functions are checked with throwaway `node:test` files under `.superpowers/sdd/2026-09-29-records-bulk-actions/tests/` (git-ignored), run from the repo root with `pnpm exec tsx --test <file>` so the `@/` alias resolves. Never commit them.
- Work on `main`; other sessions commit concurrently. Stage by explicit path, never `git add -A`; before each commit run `git diff --cached --stat` and confirm only this task's files are staged. Commits happen under the owner's execution go (approving this plan is that go). Message shape `type(scope): subject`, ending with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Schema: `pnpm db:push:dev` after Task 1 is **owner-run**; `db:push:prod` must run **before** deploying Task 1 (every meetings list selects `set_by`); no `db:refresh:dev` between the two pushes.
- Code conventions (memory `coding-conventions.md`): one component per file, named exports, constants in `constants/`, pure helpers in `lib/`, only DAL files import `db`, DAL functions return `DalReturn`. Comments say why, never what; no plan/spec/tracker citations in code.
- Action labels are Title Case like the existing constants ("Set Setter", "Open Project", "View on Site", "Show on Portfolio", "Hide from Portfolio").
- Bulk is super-admin only (D43): every bulk action config carries `BULK_ACTION_PERMISSION` (`['manage', 'all']`), matching the `superAdminProcedure` the bulk leaves run on. Single-row actions keep their existing permissions.

## Review Focus

1. **Agents and dispatchers see no bulk UI.** On meetings, projects and campaign leads an agent sees no checkboxes, and on meetings no Setter column, Setter filter or Set Setter action; single-row Show/Hide on Portfolio still shows for agents (they can already toggle Public on the edit form). Pinned by Task 2 Step 6, Task 9 Step 9 and Task 14 Step 4 (browser, agent session).
2. **A checkbox tap is only a checkbox tap.** Ticking a row never expands it (meetings, projects) and never opens campaign leads' drawer, including on a phone-width viewport. Pinned by Task 9 Step 8 and Task 10 Step 6.
3. **Selection only holds what the viewer can see.** Ticked rows that a filter or search removes are un-ticked (not silently re-ticked when they come back); page, page-size and sort changes clear the selection. Pinned by `pruneRowSelection` checks (Task 8 Step 1).
4. **"No setter" is a real value.** Choosing it single-row or in bulk writes `null`; a duplicate starts with no setter; a reschedule keeps it. Pinned by Task 1 Step 7, Task 5 Step 1 (empty-vs-null patch check) and Task 9 Step 9.
5. **A run where nothing happens says so.** Bulk delete on rows that are all skipped toasts "Deleted 0 · skipped 3 (has proposals)", not a success tick, and still clears the selection. Pinned by `formatBulkActionResult` checks (Task 9 Step 1).

## Plan-time settlements (deviations from the spec text; mirrored into the spec in Task 15)

1. **`SetterPicker`, not an extracted `InternalUserPicker`.** `ParticipantPickerContent`'s rows are role-add buttons ("Add as owner…") with slot rules; the setter needs one selectable value. `SetterPicker` (meetings entity) runs the setter-candidates query itself and renders `UserOverviewCard` rows like `AvailableParticipantRow`; `ParticipantPickerContent` is unchanged.
2. **Single-row Set Setter lives in `useMeetingActionConfigs` behind an opt-in** (`withSetSetter: true`), the same way `assignProject` is gated by `onAssignProject`; only `useMeetingsTable` opts in. It keeps the menu order (before Delete) in one place.
3. **The setter invariant runs for every origin** that writes a non-null `setBy` (fail fast). A reschedule of a meeting whose setter was later demoted fails with `set_by_not_internal` until a super-admin changes the setter.
4. **One bulk permission.** Bulk configs use `BULK_ACTION_PERMISSION` (`['manage', 'all']`) rather than each action's single-row permission, so an agent's `update Project` never shows checkboxes the server would refuse.
5. **Toolbar mode renders a promoted `custom` action as a popover button.** The bulk bar promotes every action, so pickers (Set Setter, Enroll) are one click away instead of under More; single-row toolbars gain the same ability.
6. **Selection is pruned in state, not only in view:** when the row ids change, ids no longer present are dropped (render-phase, like the expansion reset).
7. **`ProjectEntityCard` drops its `onView` override:** with `view` relabelled "View on Site", the override would open the dashboard page under that label.
8. **`ProjectMeetingList`** is extracted from `ProjectEntityCard` so the projects sales-history pane reuses it (two callers).
9. **Projects visibility sorts by field `visibility`:** a field list has one id per field, so the `isPublic` column's sort id becomes `visibility` (old `pjsortBy=isPublic` URLs fall back to the default order).

## File map

| Area | Files |
|---|---|
| Setter (B1) | `db/schema/meetings.ts` · `entities/meetings/constants/internal-user-roles.ts` (new) · `entities/users/dal/server/queries.ts` · `entities/meetings/dal/server/crud.ts` · `trpc/routers/meetings.router/{business,reads}.router.ts` · `dal/lib/query/constants.ts` · `dal/client/constants/option-source-reads.ts` · `entities/meetings/dal/meeting-fields.ts` · `entities/meetings/dal/server/{meeting-field-sql,queries}.ts` · `entities/meetings/lib/columns-registry.tsx` · `features/records-management/constants/meetings-records-table-view.ts` · `entities/meetings/components/setter-picker.tsx` (new) · `entities/meetings/components/create-meeting-form.tsx` · `features/intake/{schemas/intake-form-schema.ts, ui/components/set-by-field.tsx (new), ui/views/intake-form-view.tsx}` · `trpc/routers/customers.router/business.router.ts` · `services/customer-intake.service.ts` |
| Bulk server (B2) | `dal/server/lib/run-bulk.ts` (new) · `trpc/lib/{non-empty-patch,bulk-procedures}.ts` (new) · `trpc/routers/{meetings,proposals,projects}.router/{bulk.router.ts (new), index.ts}` · `entities/meetings/dal/server/queries.ts` · `modules/projects/core/dal/server/queries.ts` |
| Selection + bar (B3) | `components/entities/entity-actions/{types.ts, lib/visible-actions.ts (new), lib/format-bulk-action-result.ts (new), lib/toast-bulk-action-result.ts (new), constants/bulk-action-permission.ts (new), ui/entity-action-menu.tsx, ui/entity-action-dropdown.tsx, ui/toolbar-popover-button.tsx (new), ui/bulk-action-bar.tsx (new)}` · `features/schedule-management/ui/components/{schedule-calendar-dot,schedule-activities-calendar}.tsx` · `components/ui/checkbox.tsx` · `components/data-table/{lib/prune-row-selection.ts (new), ui/data-table.tsx, ui/data-table-body.tsx}` |
| Meetings UI (B3) | `entities/meetings/{constants/actions.ts, constants/bulk-skip-labels.ts (new), hooks/use-meeting-actions.ts, hooks/use-meeting-action-configs.tsx, hooks/use-meeting-bulk-action-configs.tsx (new), components/meetings-table/use-meetings-table.tsx}` · delete `components/meetings-table/meetings-table.tsx` · `features/records-management/ui/views/meetings-records-view.tsx` |
| Campaign leads (B4) | `features/campaigns-admin/{constants/lead-bulk-actions.ts (new), hooks/use-lead-bulk-action-configs.tsx (new), ui/components/leads/bulk-enroll-form.tsx (new), ui/lib/leads-columns.tsx, ui/views/campaigns-leads-view.tsx}` · delete `lead-select-cell.tsx`, `lead-select-header.tsx`, `leads-bulk-action-bar.tsx`, `bulk-enroll-popover.tsx` |
| Projects (B5) | `modules/projects/core/{dal/project-fields.ts (new), dal/server/project-field-sql.ts (new), dal/server/queries.ts, constants/status-labels.ts (new), constants/actions.ts, constants/bulk-skip-labels.ts (new), lib/columns-registry.tsx, hooks/use-project-actions.ts, hooks/use-project-action-configs.ts, hooks/use-project-bulk-action-configs.ts (new), components/projects-table/use-projects-table.tsx (new)}` · `trpc/routers/projects.router/crud.router.ts` · `features/agent-dashboard/{constants/dashboard-queries.ts, ui/components/dashboard-project-section.tsx}` · `app/(frontend)/dashboard/(records)/projects/page.tsx` · `features/records-management/{constants/projects-records-table-view.ts (new), ui/views/projects-records-view.tsx (new), ui/components/project-row-panel/* (new), ui/components/record-customer-pane.tsx (new)}` · `entities/customers/{hooks/use-customer-profile.ts (new), components/lists/project-meeting-list.tsx (new), components/lists/project-entity-card.tsx, components/profile/customer-profile-modal.tsx}` · delete `features/project-management/ui/components/table/`, `project-detail-sheet.tsx`, `constants/projects-table-query-config.ts`, `constants/project-table-filter-config.ts`, `features/records-management/ui/components/meeting-row-panel/meeting-customer-pane.tsx` |
| Hand-off (B7, partial) | `components/data-table/types.ts` · `components/data-table/hooks/use-table-url-filters.ts` · `CONTEXT.md` · records tracker · spec |

All paths above are under `src/shared/` unless they start with `features/`, `trpc/` or `app/` (then `src/`), or are repo-root docs.

---

## Phase B1 — the setter

### Task 1: `meetings.set_by`, the internal-user rule, duplicate and reschedule

**Files:**
- Modify: `src/shared/db/schema/meetings.ts:21-41`
- Create: `src/shared/entities/meetings/constants/internal-user-roles.ts`
- Modify: `src/shared/entities/users/dal/server/queries.ts`
- Modify: `src/shared/entities/meetings/dal/server/crud.ts:1-77,132-146`
- Modify: `src/trpc/routers/meetings.router/business.router.ts:120-131`

**Interfaces:**
- Produces: column `meetings.setBy: string | null` (FK `user.id`, `on delete set null`); `PARTICIPANT_ROLES = ['agent', 'super-admin']`, `SETTER_ROLES = ['dispatcher', 'agent', 'super-admin']` (`as const`); `listUsersByRoles(roles, { excludeIds? }): Promise<DalReturn<InternalUserRow[]>>` with `InternalUserRow = { id: string, name: string, email: string, image: string | null, role: UserRole | null }`; `getUserRoleById(id): Promise<DalReturn<UserRole | null>>`; meetings crud refuses a non-internal `setBy` with `precondition-failed: set_by_not_internal`.

- [ ] **Step 1: The column**

In `src/shared/db/schema/meetings.ts`, after the `ownerId` line (`:23`), add:

```ts
  // Who booked the meeting, often a dispatcher. Not ownerId: a dispatcher's booking goes to the system owner.
  setBy: text('set_by').references(() => user.id, { onDelete: 'set null' }),
```

drizzle-zod carries it into `selectMeetingSchema`, `insertMeetingSchema` and the update partial as nullable-optional; no schema edit is needed.

- [ ] **Step 2: The role lists**

Create `src/shared/entities/meetings/constants/internal-user-roles.ts`:

```ts
import type { UserRole } from '@/shared/constants/enums/user'

/** Who can sit a meeting. */
export const PARTICIPANT_ROLES = ['agent', 'super-admin'] as const satisfies readonly UserRole[]

/** Who can have booked a meeting: dispatchers book most of them but never sit one. */
export const SETTER_ROLES = ['dispatcher', 'agent', 'super-admin'] as const satisfies readonly UserRole[]
```

- [ ] **Step 3: The users DAL reads**

In `src/shared/entities/users/dal/server/queries.ts`, change the drizzle import to `import { and, eq, inArray, notInArray } from 'drizzle-orm'`, add `import type { UserRole } from '@/shared/constants/enums/user'` beside the `DalReturn` type import, and append:

```ts
export interface InternalUserRow {
  id: string
  name: string
  email: string
  image: string | null
  role: UserRole | null
}

/** Users with one of these roles, by name. `excludeIds` drops system accounts. */
export async function listUsersByRoles(
  roles: readonly UserRole[],
  options: { excludeIds?: readonly string[] } = {},
): Promise<DalReturn<InternalUserRow[]>> {
  return dalDbOperation(async () =>
    db
      .select({ id: user.id, name: user.name, email: user.email, image: user.image, role: user.role })
      .from(user)
      .where(and(
        inArray(user.role, [...roles]),
        options.excludeIds?.length ? notInArray(user.id, [...options.excludeIds]) : undefined,
      ))
      .orderBy(user.name),
  )
}

export async function getUserRoleById(id: string): Promise<DalReturn<UserRole | null>> {
  return dalDbOperation(async () => {
    const [row] = await db.select({ role: user.role }).from(user).where(eq(user.id, id)).limit(1)
    return row?.role ?? null
  })
}
```

If `pnpm tsc` reports `user.name` / `user.email` as nullable, widen `InternalUserRow` to match the column types rather than casting.

- [ ] **Step 4: The setter rule in the meetings crud hooks**

In `src/shared/entities/meetings/dal/server/crud.ts` add the imports (alphabetical within the `@/` block):

```ts
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { SETTER_ROLES } from '@/shared/entities/meetings/constants/internal-user-roles'
import { getUserRoleById } from '@/shared/entities/users/dal/server/queries'
```

Above `export const meetingCrud`, add:

```ts
// The FK alone would accept any user, including a homeowner's account.
async function assertSetterIsInternal(setBy: string | null | undefined): Promise<void> {
  if (setBy == null) {
    return
  }
  const role = dalVerifySuccess(await getUserRoleById(setBy))
  if (!role || !(SETTER_ROLES as readonly string[]).includes(role)) {
    throw new ThrowableDalError({ type: 'precondition-failed', reason: 'set_by_not_internal' })
  }
}
```

Replace the `create.before` body (`:27-32`) with:

```ts
      async before(input, ctx) {
        await assertSetterIsInternal(input.setBy)
        if (!ctx.session) {
          return input
        }
        return { ...input, ownerId: await resolveMeetingOwnerId(ctx) }
      },
```

and make the first lines of `update.before` (`:60-61`):

```ts
      async before(data, _ctx, { id }) {
        if ('setBy' in data) {
          await assertSetterIsInternal(data.setBy)
        }
        let next = data
```

Both hooks run inside the engine's `dalDbOperation` (`create-crud-dal.ts:81-87,113-119`), so the throw becomes a `precondition-failed` `DalReturn`, which `dalToTrpc` maps to `PRECONDITION_FAILED`.

- [ ] **Step 5: Duplicate clears the setter; reschedule keeps it**

In the same file, add `'setBy',` to `duplicate.exclude` after `'agentNotes',` and extend the comment above the block:

```ts
  // A duplicate is a fresh sit, not a continuation — only reschedule carries flow state and the setter forward.
```

In `src/trpc/routers/meetings.router/business.router.ts`, inside the `meetingCrud.create(SYSTEM_CONTEXT, { … })` call of the reschedule procedure (`:120-131`), add after `meetingType: original.meetingType,`:

```ts
        setBy: original.setBy,
```

- [ ] **Step 6: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 7: Owner gate — dev schema push; read-only confirmation**

Ask the owner to run `pnpm db:push:dev` and paste the printed statements. Expected: exactly `ALTER TABLE "meetings" ADD COLUMN "set_by" text;` plus the FK constraint, no `truncate`, no rebuild. Then confirm by code read that `crud.ts` `duplicate.exclude` lists `'setBy'` and the reschedule create passes `setBy: original.setBy` (Review Focus 4).

- [ ] **Step 8: Commit**

```bash
git add src/shared/db/schema/meetings.ts src/shared/entities/meetings/constants/internal-user-roles.ts src/shared/entities/users/dal/server/queries.ts src/shared/entities/meetings/dal/server/crud.ts src/trpc/routers/meetings.router/business.router.ts
git diff --cached --stat
git commit -m "feat(meetings): setter column; a setter must be on the team; duplicate clears it, reschedule keeps it

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Setter candidates, the Setter filter, sort and column

**Files:**
- Modify: `src/trpc/routers/meetings.router/reads.router.ts:1-51`
- Modify: `src/shared/dal/lib/query/constants.ts:15`
- Modify: `src/shared/dal/client/constants/option-source-reads.ts:19-34`
- Modify: `src/shared/entities/meetings/dal/meeting-fields.ts:11-30`
- Modify: `src/shared/entities/meetings/dal/server/meeting-field-sql.ts`
- Modify: `src/shared/entities/meetings/dal/server/queries.ts:43-62,95-128`
- Modify: `src/shared/entities/meetings/lib/columns-registry.tsx` (new `setter` column)
- Modify: `src/features/records-management/constants/meetings-records-table-view.ts`

**Interfaces:**
- Consumes: `listUsersByRoles`, `PARTICIPANT_ROLES`, `SETTER_ROLES` (Task 1); `getSystemOwnerId` (`entities/users/dal/server/system.ts`).
- Produces: `meetingsRouter.reads.getInternalUsers` input `{ purpose: 'participant' | 'setter' } | undefined` (no input = participants, unchanged); option source `'setters'`; field `setter` in `MEETING_FIELDS` (filter + sort); `setterUser` alias exported from `meeting-field-sql.ts`; `MeetingListRow.setterName: string | null`; column key `setter`.

- [ ] **Step 1: The candidates read**

Edit `src/trpc/routers/meetings.router/reads.router.ts` in place (another session edits this file's `list` procedure; leave `list` and `getByIdWithJoins` untouched):
- imports: delete `import { inArray } from 'drizzle-orm'`, `import { db } from '@/shared/db'` and `import { user } from '@/shared/db/schema'`; add

```ts
import { PARTICIPANT_ROLES, SETTER_ROLES } from '@/shared/entities/meetings/constants/internal-user-roles'
import { listUsersByRoles } from '@/shared/entities/users/dal/server/queries'
import { getSystemOwnerId } from '@/shared/entities/users/dal/server/system'
```

- replace the whole `getInternalUsers` procedure with:

```ts
  // `setter` adds dispatchers, who book meetings but never sit them, so they stay out of the participant picker.
  getInternalUsers: meetingProcedure
    .input(z.object({ purpose: z.enum(['participant', 'setter']) }).optional())
    .query(async ({ ctx, input }) => {
      if (ctx.ability.cannot('assign', 'Meeting')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to assign meeting owners' })
      }
      if (input?.purpose === 'setter') {
        // The system owner holds unassigned bookings; it never booked anything.
        return dalToTrpc(await listUsersByRoles(SETTER_ROLES, { excludeIds: [await getSystemOwnerId()] }))
      }
      return dalToTrpc(await listUsersByRoles(PARTICIPANT_ROLES))
    }),
```

`getInternalUsers.queryOptions()` with no argument keeps today's query key, so the participant picker, the `reps` option source and analytics labels are untouched.

- [ ] **Step 2: The `setters` option source**

In `src/shared/dal/lib/query/constants.ts:15`:

```ts
export const OPTION_SOURCES = ['trades', 'reps', 'setters', 'leadSources'] as const
```

In `src/shared/dal/client/constants/option-source-reads.ts`, after the `reps` entry:

```ts
  setters: {
    canRead: ability => ability.can('assign', 'Meeting'),
    queryOptions: trpc => trpc.meetingsRouter.reads.getInternalUsers.queryOptions({ purpose: 'setter' }),
  },
```

(`satisfies Record<OptionSource, OptionSourceRead>` fails `pnpm tsc` if either half is missing.)

- [ ] **Step 3: The `setter` field and its SQL**

In `src/shared/entities/meetings/dal/meeting-fields.ts`, after the `rep` line:

```ts
  setter: { label: 'Setter', filter: multiSelect({ schema: z.string().min(1), source: 'setters' }), sort: true },
```

In `src/shared/entities/meetings/dal/server/meeting-field-sql.ts` add `import { alias } from 'drizzle-orm/pg-core'` (after the `drizzle-orm` import), then above `proposalStatusCondition`:

```ts
/** The setter's user row: `user` is already joined for the owner, so the setter needs its own alias. */
export const setterUser = alias(user, 'setter_user')
```

and add to the `filter` map after `rep`:

```ts
    setter: v => inArray(meetings.setBy, v),
```

and to the `sort` map after `rep`:

```ts
    setter: setterUser.name,
```

- [ ] **Step 4: `setterName` on the list row**

In `src/shared/entities/meetings/dal/server/queries.ts`:
- change the `meeting-field-sql` import to `import { MEETING_FIELD_SQL, setterUser } from '@/shared/entities/meetings/dal/server/meeting-field-sql'`;
- in `MeetingListRow` add after `ownerImage: string | null`:

```ts
  setterName: string | null
```

- in the `listMeetings` select add after `ownerImage: user.image,`:

```ts
          setterName: setterUser.name,
```

- after `.leftJoin(user, eq(user.id, meetings.ownerId))` add:

```ts
        .leftJoin(setterUser, eq(setterUser.id, meetings.setBy))
```

The count query needs no join: the setter filter reads `meetings.set_by` only.

- [ ] **Step 5: The Setter column and the toolbar slot**

In `src/shared/entities/meetings/lib/columns-registry.tsx`, add after the `ownerName` entry:

```tsx
  setter: {
    label: 'Setter',
    sort: 'setter',
    defaultHidden: true,
    permission: ['assign', 'Meeting'],
    accessorFn: row => row.setterName ?? '',
    cell: ({ row }) => row.original.setterName
      ? <span className="block truncate text-sm">{row.original.setterName}</span>
      : <span className="text-muted-foreground">—</span>,
  },
```

In `src/features/records-management/constants/meetings-records-table-view.ts`: add `'setter'` to `toolbar` after `'rep'`, and to `columns` after `'ownerName'`.

- [ ] **Step 6: Type-check, lint, browser read check**

Run: `pnpm tsc && pnpm lint` → clean.

Start `pnpm dev` (check `ss -ltnp | grep 3000` first; reuse a running server). Sign in as a super-admin through `/api/dev/playwright-session` (memory `reference-playwright-auth.md`). On `/dashboard/meetings`: the Columns menu lists "Setter" (off by default); turning it on shows "—" for unset rows; the filter bar offers "Setter" listing dispatchers, agents and super-admins but not the system owner; sorting the Setter column changes the URL `pmsortBy=setter` and returns rows. As an agent: no Setter column in the Columns menu, no Setter filter (Review Focus 1).

- [ ] **Step 7: Commit**

```bash
git add src/trpc/routers/meetings.router/reads.router.ts src/shared/dal/lib/query/constants.ts src/shared/dal/client/constants/option-source-reads.ts src/shared/entities/meetings/dal/meeting-fields.ts src/shared/entities/meetings/dal/server/meeting-field-sql.ts src/shared/entities/meetings/dal/server/queries.ts src/shared/entities/meetings/lib/columns-registry.tsx src/features/records-management/constants/meetings-records-table-view.ts
git diff --cached --stat
git commit -m "feat(meetings): setter candidates include dispatchers; Setter filter, sort and column for super-admins

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `SetterPicker`; "Set by" on every add-a-meeting form

**Files:**
- Create: `src/shared/entities/meetings/components/setter-picker.tsx`
- Modify: `src/shared/entities/meetings/components/create-meeting-form.tsx`
- Modify: `src/features/intake/schemas/intake-form-schema.ts:26-32,61-62`
- Create: `src/features/intake/ui/components/set-by-field.tsx`
- Modify: `src/features/intake/ui/views/intake-form-view.tsx`
- Modify: `src/trpc/routers/customers.router/business.router.ts` (`createFromIntake`)
- Modify: `src/shared/services/customer-intake.service.ts:20,115-120`

**Interfaces:**
- Consumes: `getInternalUsers({ purpose: 'setter' })` (Task 2).
- Produces: `SetterPicker({ value: string | null | undefined, onPick: (userId: string | null) => void, disabled?: boolean })` — `undefined` value = no checkmark (mixed bulk selection); `createFromIntake` input `setBy?: string | null`; `IngestLeadInput.meeting.setBy?: string | null`.

- [ ] **Step 1: The picker**

Create `src/shared/entities/meetings/components/setter-picker.tsx`:

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { CheckIcon } from 'lucide-react'

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/shared/components/ui/command'
import { UserOverviewCard } from '@/shared/entities/users/components/overview-card'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

interface SetterPickerProps {
  /** The current setter; `null` = none; `undefined` = unknown (a mixed selection), so nothing is checked. */
  value: string | null | undefined
  onPick: (userId: string | null) => void
  disabled?: boolean
}

export function SetterPicker({ value, onPick, disabled = false }: SetterPickerProps) {
  const trpc = useTRPC()
  const setters = useQuery(trpc.meetingsRouter.reads.getInternalUsers.queryOptions({ purpose: 'setter' }))

  return (
    <Command className="w-full bg-transparent">
      <CommandInput placeholder="Search team by name or email…" autoComplete="off" spellCheck={false} />
      <CommandList className="max-h-72">
        {setters.isError
          ? <p className="px-3 py-4 text-center text-xs text-muted-foreground">Couldn’t load the team.</p>
          : (
              <>
                <CommandEmpty>{setters.isLoading ? 'Loading team…' : 'No team members match.'}</CommandEmpty>
                <CommandGroup>
                  <CommandItem value="No setter" disabled={disabled} onSelect={() => onPick(null)} className="gap-3 px-3 py-2">
                    <CheckIcon className={cn('size-3.5 shrink-0', value === null ? 'opacity-100' : 'opacity-0')} />
                    <span className="text-sm text-muted-foreground">No setter</span>
                  </CommandItem>
                  {(setters.data ?? []).map(setter => (
                    <CommandItem
                      key={setter.id}
                      // cmdk filters on `value`; name and email both match.
                      value={`${setter.name} ${setter.email}`}
                      disabled={disabled}
                      onSelect={() => onPick(setter.id)}
                      className="gap-3 px-3 py-2 data-[selected=true]:bg-muted/70"
                    >
                      <CheckIcon className={cn('size-3.5 shrink-0', value === setter.id ? 'opacity-100' : 'opacity-0')} />
                      <UserOverviewCard user={{ id: setter.id, name: setter.name, image: setter.image, email: setter.email }} className="contents">
                        <UserOverviewCard.Avatar size="sm" className="size-7" />
                        <div className="flex min-w-0 flex-1 flex-col gap-px overflow-hidden">
                          <UserOverviewCard.Name className="truncate text-sm font-medium text-foreground" />
                          <UserOverviewCard.Email className="truncate text-xs text-muted-foreground" />
                        </div>
                      </UserOverviewCard>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
      </CommandList>
    </Command>
  )
}
```

- [ ] **Step 2: "Set by" on `CreateMeetingForm`**

In `src/shared/entities/meetings/components/create-meeting-form.tsx`:

Add imports:

```tsx
import { ChevronsUpDownIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { useSession } from '@/shared/domains/auth/client'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { SetterPicker } from './setter-picker'
```

(merge `ChevronsUpDownIcon` into the existing `lucide-react` import.)

After the `projectId` state (`:54`):

```tsx
  const ability = useAbility()
  const canPickSetter = ability.can('assign', 'Meeting')
  const { data: session } = useSession()
  // Null until the viewer picks, so the default follows the session once it loads.
  const [setterChoice, setSetterChoice] = useState<{ userId: string | null } | null>(null)
  const [setterOpen, setSetterOpen] = useState(false)
  const setBy = setterChoice ? setterChoice.userId : (session?.user.id ?? null)
  const settersQuery = useQuery({
    ...trpc.meetingsRouter.reads.getInternalUsers.queryOptions({ purpose: 'setter' }),
    enabled: canPickSetter && !isEditMode,
  })
  const setterLabel = setBy === null
    ? 'No setter'
    : settersQuery.data?.find(user => user.id === setBy)?.name ?? session?.user.name ?? 'You'
```

In `createMutation`'s `onSuccess`, add `setSetterChoice(null)` beside the other resets. In `handleSubmit`'s create branch, add `setBy,` to the `createMutation.mutate({ … })` payload (after `scheduledFor`).

Render, between the "Date & Time" block and the "Trade & Scope Selection" block, only when creating:

```tsx
      {!isEditMode && (
        <div className="space-y-2">
          <Label>Set by</Label>
          {canPickSetter
            ? (
                <Popover open={setterOpen} onOpenChange={setSetterOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between font-normal">
                      <span className="truncate">{setterLabel}</span>
                      <ChevronsUpDownIcon className="size-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[min(420px,calc(100vw-2rem))] p-0">
                    <SetterPicker
                      value={setBy}
                      onPick={(userId) => {
                        setSetterChoice({ userId })
                        setSetterOpen(false)
                      }}
                    />
                  </PopoverContent>
                </Popover>
              )
            : <p className="text-sm text-muted-foreground">{`${session?.user.name ?? 'You'} (you)`}</p>}
        </div>
      )}
```

Agents and dispatchers send their own id; the server invariant accepts both roles.

- [ ] **Step 3: The intake form carries `setBy`**

In `src/features/intake/schemas/intake-form-schema.ts`, add to `customerAndMeetingSchema` after `mp3Key`:

```ts
  // Only the in-dashboard sheet sets it (super-admins); the public intake form never shows the field.
  setBy: z.string().nullable().optional(),
```

and in `getIntakeFormDefaults`' meeting branch return `{ ...base, mode, scheduledFor: '', closedBy: '', mp3Key: '', setBy: undefined }`.

Create `src/features/intake/ui/components/set-by-field.tsx`:

```tsx
'use client'

import type { IntakeFormData } from '@/features/intake/schemas/intake-form-schema'

import { useQuery } from '@tanstack/react-query'
import { ChevronsUpDownIcon } from 'lucide-react'
import { useState } from 'react'
import { useFormContext } from 'react-hook-form'

import { Button } from '@/shared/components/ui/button'
import { FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { SetterPicker } from '@/shared/entities/meetings/components/setter-picker'
import { useTRPC } from '@/trpc/helpers'

interface SetByFieldProps {
  /** The signed-in super-admin: the setter until someone else is picked. */
  selfId: string | null
  selfName: string | null
}

export function SetByField({ selfId, selfName }: SetByFieldProps) {
  const form = useFormContext<IntakeFormData>()
  const [open, setOpen] = useState(false)
  const trpc = useTRPC()
  // Same key as the picker's own read, so the list loads once.
  const setters = useQuery(trpc.meetingsRouter.reads.getInternalUsers.queryOptions({ purpose: 'setter' }))

  return (
    <FormField
      control={form.control}
      name="setBy"
      render={({ field }) => {
        const value = field.value === undefined ? selfId : field.value
        const label = value === null
          ? 'No setter'
          : setters.data?.find(setter => setter.id === value)?.name ?? (value === selfId ? selfName : null) ?? 'Loading…'
        return (
          <FormItem>
            <FormLabel>Set by</FormLabel>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-between font-normal">
                  <span className="truncate">{label}</span>
                  <ChevronsUpDownIcon className="size-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[min(420px,calc(100vw-2rem))] p-0">
                <SetterPicker
                  value={value}
                  onPick={(userId) => {
                    field.onChange(userId)
                    setOpen(false)
                  }}
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}
```

In `src/features/intake/ui/views/intake-form-view.tsx`:
- add imports `import { SetByField } from '@/features/intake/ui/components/set-by-field'`, `import { useSession } from '@/shared/domains/auth/client'`, `import { useAbility } from '@/shared/domains/permissions/hooks'`;
- after `const trpc = useTRPC()`:

```tsx
  const ability = useAbility()
  const canPickSetter = ability.can('assign', 'Meeting')
  const { data: session } = useSession()
  const selfId = session?.user.id ?? null
```

- in `onSubmit`, before `submit.mutate`:

```tsx
    const setBy = data.mode === 'customer_and_meeting' && canPickSetter
      ? (data.setBy === undefined ? selfId : data.setBy)
      : undefined
```

and add `setBy,` to the `submit.mutate({ … })` payload;
- inside the meeting-mode block, after the `ClosedByField` conditional:

```tsx
                  {canPickSetter && <SetByField selfId={selfId} selfName={session?.user.name ?? null} />}
```

On the public `/intake` page there is no session, so the field never renders and `setBy` is not sent.

- [ ] **Step 4: The router and the intake service pass it through**

In `src/trpc/routers/customers.router/business.router.ts`:
- add `import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'`;
- in `createFromIntake`'s `.input(z.object({ … }))`, after `leadSourceSlug`:

```ts
      setBy: z.string().min(1).nullable().optional(),
```

- change the first line of the mutation body to `const { notes, mode, leadSourceSlug, setBy, ...customerData } = input`;
- the body binds `const session = (ctx as { session?: { user: { id: string } } }).session ?? null`; widen that cast to `{ session?: { user: { id: string, role: UserRole } } }` (add `import type { UserRole } from '@/shared/constants/enums/user'`) and, right after the binding, add:

```ts
      // Naming a setter is an assign-level act; the public intake form never sends one.
      if (setBy && !(session && defineAbilitiesFor({ id: session.user.id, role: session.user.role }).can('assign', 'Meeting'))) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to name a setter' })
      }
```

- change `meeting = { ownerId: ownerId! }` to `meeting = { ownerId: ownerId!, setBy: setBy ?? null }` and the declaration above it to `let meeting: { ownerId: string, setBy: string | null } | null = null`.

In `src/shared/services/customer-intake.service.ts`:
- in `IngestLeadInput` (`:20`), change the field to `meeting?: { ownerId: string, setBy?: string | null } | null`;
- in the meeting branch's `meetingCrud.create(ctx, { … })`, add after `ownerId: input.meeting.ownerId,`:

```ts
          setBy: input.meeting.setBy,
```

Under `SYSTEM_CONTEXT` the meetings `create.before` still runs `assertSetterIsInternal`.

- [ ] **Step 5: Type-check, lint, browser read check**

Run: `pnpm tsc && pnpm lint` → clean.

Browser (super-admin): open a customer profile → "Add meeting": the form shows "Set by" with the signed-in user; the popover lists setters incl. dispatchers, "No setter" first. Pipeline kanban (`/dashboard/customer-pipelines`, leads): drag a card to "Meeting scheduled" → the modal form shows the same field. Lead-sources admin → "Add customer" → toggle "Customer + meeting": "Set by" appears; the public `/intake?source=…&token=…` page shows no such field. As an agent: "Add meeting" shows "Set by" as "<name> (you)", no picker. Do not submit any form unless the owner designates a customer for it.

- [ ] **Step 6: Commit**

```bash
git add src/shared/entities/meetings/components/setter-picker.tsx src/shared/entities/meetings/components/create-meeting-form.tsx src/features/intake/schemas/intake-form-schema.ts src/features/intake/ui/components/set-by-field.tsx src/features/intake/ui/views/intake-form-view.tsx src/trpc/routers/customers.router/business.router.ts src/shared/services/customer-intake.service.ts
git diff --cached --stat
git commit -m "feat(meetings): Set by on every add-a-meeting form — a picker for super-admins, yourself for everyone else

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Phase B2 — the bulk server

### Task 4: `runBulk`

**Files:**
- Create: `src/shared/dal/server/lib/run-bulk.ts`
- Test (throwaway): `.superpowers/sdd/2026-09-29-records-bulk-actions/tests/run-bulk.test.ts`

**Interfaces:**
- Produces: `BULK_MAX_IDS = 100`; `BulkActionResult<TReason extends string = never> = { done: string[], skipped: { id, reason: TReason | 'notFound' }[], failed: { id, error: DalError['type'], reason?: string }[] }`; `runBulk<TReason, TOut>(ids, { classify?, run }): Promise<{ result, outputs: TOut[] }>`.

- [ ] **Step 1: Write the failing test**

Create `.superpowers/sdd/2026-09-29-records-bulk-actions/tests/run-bulk.test.ts`:

```ts
import type { DalReturn } from '@/shared/dal/server/types'

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { runBulk } from '@/shared/dal/server/lib/run-bulk'

const ok = (id: string): DalReturn<string> => ({ success: true, data: `row-${id}` })

test('dedupes ids and runs them in order', async () => {
  const seen: string[] = []
  const { result, outputs } = await runBulk(['a', 'b', 'a'], { run: async (id) => { seen.push(id); return ok(id) } })
  assert.deepEqual(seen, ['a', 'b'])
  assert.deepEqual(result, { done: ['a', 'b'], skipped: [], failed: [] })
  assert.deepEqual(outputs, ['row-a', 'row-b'])
})

test('a classified row is skipped and never run', async () => {
  const seen: string[] = []
  const { result } = await runBulk<'hasProposals', string>(['a', 'b'], {
    classify: id => (id === 'a' ? 'hasProposals' : null),
    run: async (id) => { seen.push(id); return ok(id) },
  })
  assert.deepEqual(seen, ['b'])
  assert.deepEqual(result.skipped, [{ id: 'a', reason: 'hasProposals' }])
  assert.deepEqual(result.done, ['b'])
})

test('not-found becomes a notFound skip; other errors fail and the loop continues', async () => {
  const { result, outputs } = await runBulk(['gone', 'frozen', 'broken', 'fine'], {
    run: async (id): Promise<DalReturn<string>> => {
      if (id === 'gone') return { success: false, error: { type: 'not-found' } }
      if (id === 'frozen') return { success: false, error: { type: 'precondition-failed', reason: 'set_by_not_internal' } }
      if (id === 'broken') return { success: false, error: { type: 'db-error', cause: new Error('x') } }
      return ok(id)
    },
  })
  assert.deepEqual(result.skipped, [{ id: 'gone', reason: 'notFound' }])
  assert.deepEqual(result.failed, [
    { id: 'frozen', error: 'precondition-failed', reason: 'set_by_not_internal' },
    { id: 'broken', error: 'db-error' },
  ])
  assert.deepEqual(result.done, ['fine'])
  assert.deepEqual(outputs, ['row-fine'])
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm exec tsx --test .superpowers/sdd/2026-09-29-records-bulk-actions/tests/run-bulk.test.ts`
Expected: FAIL — cannot find module `@/shared/dal/server/lib/run-bulk`.

- [ ] **Step 3: Implement**

Create `src/shared/dal/server/lib/run-bulk.ts`:

```ts
import type { DalError, DalReturn } from '@/shared/dal/server/types'

/** One page of rows: bulk actions run on the ticked rows of the page, never a whole result set. */
export const BULK_MAX_IDS = 100

export interface BulkActionResult<TReason extends string = never> {
  done: string[]
  skipped: { id: string, reason: TReason | 'notFound' }[]
  failed: { id: string, error: DalError['type'], reason?: string }[]
}

interface RunBulkSteps<TReason extends string, TOut> {
  /** A skip reason for a row the action must not touch, or null to run it. */
  classify?: (id: string) => TReason | 'notFound' | null
  run: (id: string) => Promise<DalReturn<TOut>>
}

/**
 * One entity write per id, in order, so every row goes through the entity's own hooks.
 * A failed row is recorded and the rest still run.
 */
export async function runBulk<TReason extends string = never, TOut = void>(
  ids: readonly string[],
  steps: RunBulkSteps<TReason, TOut>,
): Promise<{ result: BulkActionResult<TReason>, outputs: TOut[] }> {
  const result: BulkActionResult<TReason> = { done: [], skipped: [], failed: [] }
  const outputs: TOut[] = []
  for (const id of new Set(ids)) {
    const reason = steps.classify?.(id) ?? null
    if (reason) {
      result.skipped.push({ id, reason })
      continue
    }
    const outcome = await steps.run(id)
    if (outcome.success) {
      result.done.push(id)
      outputs.push(outcome.data)
    }
    else if (outcome.error.type === 'not-found') {
      result.skipped.push({ id, reason: 'notFound' })
    }
    else {
      result.failed.push({
        id,
        error: outcome.error.type,
        ...(outcome.error.type === 'precondition-failed' ? { reason: outcome.error.reason } : {}),
      })
    }
  }
  return { result, outputs }
}
```

- [ ] **Step 4: Run it to see it pass; type-check and lint**

Run: `pnpm exec tsx --test .superpowers/sdd/2026-09-29-records-bulk-actions/tests/run-bulk.test.ts` → 3 pass.
Run: `pnpm tsc && pnpm lint` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/shared/dal/server/lib/run-bulk.ts
git diff --cached --stat
git commit -m "feat(dal): runBulk — one entity write per id, skips classified rows, reports done, skipped and failed

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: The procedure builders; meetings `bulk.delete` / `bulk.update`

**Files:**
- Create: `src/trpc/lib/non-empty-patch.ts`
- Create: `src/trpc/lib/bulk-procedures.ts`
- Modify: `src/shared/entities/meetings/dal/server/queries.ts` (append the facts read)
- Create: `src/trpc/routers/meetings.router/bulk.router.ts`
- Modify: `src/trpc/routers/meetings.router/index.ts`

**Interfaces:**
- Consumes: `runBulk`, `BULK_MAX_IDS`, `BulkActionResult` (Task 4); `meetingCrud`, `meetingSchemas` (`entities/meetings/lib/server-spec.ts`).
- Produces: `nonEmptyPatch(schema)` (pure); `bulkDeleteProcedure({ crud, facts, classify })`, `bulkUpdateProcedure({ crud, data, afterRun? })` (both `superAdminProcedure`, input `ids: uuid[1..100]`); `getMeetingBulkDeleteFacts(ctx, ids): Promise<DalReturn<{ id, hasProposals, hasApplications }[]>>`; `meetingsRouter.bulk.delete({ ids })` → `BulkActionResult<'hasProposals' | 'hasApplications'>`; `meetingsRouter.bulk.update({ ids, data: { setBy } })` → `BulkActionResult`.

- [ ] **Step 1: Write the failing check for the non-empty patch rule**

Create `.superpowers/sdd/2026-09-29-records-bulk-actions/tests/bulk-patch.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import z from 'zod'

import { nonEmptyPatch } from '@/trpc/lib/non-empty-patch'

const patch = nonEmptyPatch(z.object({ setBy: z.string().nullable().optional() }))

test('a null value is a real write ("No setter")', () => {
  assert.equal(patch.safeParse({ setBy: null }).success, true)
})

test('an empty patch is refused', () => {
  assert.equal(patch.safeParse({}).success, false)
  assert.equal(patch.safeParse({ setBy: undefined }).success, false)
})
```

Run: `pnpm exec tsx --test .superpowers/sdd/2026-09-29-records-bulk-actions/tests/bulk-patch.test.ts` → FAIL (module not found).

- [ ] **Step 2: The builders**

Create `src/trpc/lib/non-empty-patch.ts` (pure: zod only, so the check above runs outside Next):

```ts
import type z from 'zod'

/** An update schema narrowed to the fields a bulk update may write, refusing a patch that writes nothing. */
export function nonEmptyPatch<TShape extends z.ZodRawShape>(schema: z.ZodObject<TShape>) {
  // The engine answers an empty update with the unchanged row, which a bulk run would count as done.
  return schema.refine(data => Object.values(data).some(value => value !== undefined), { message: 'Nothing to update' })
}
```

Create `src/trpc/lib/bulk-procedures.ts`:

```ts
import type { BulkActionResult } from '@/shared/dal/server/lib/run-bulk'
import type { DalReturn, MaybePromise, ScopedContext } from '@/shared/dal/server/types'

import z from 'zod'

import { BULK_MAX_IDS, runBulk } from '@/shared/dal/server/lib/run-bulk'
import { superAdminProcedure } from '@/trpc/init'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'
import { nonEmptyPatch } from '@/trpc/lib/non-empty-patch'

const idsInput = z.array(z.string().uuid()).min(1).max(BULK_MAX_IDS)

interface BulkDeleteConfig<TFacts extends { id: string }, TReason extends string> {
  crud: { delete: (ctx: ScopedContext, input: { id: string }) => Promise<DalReturn<void>> }
  /** One read for the whole batch; an id missing from it is skipped as `notFound`. */
  facts: (ctx: ScopedContext, ids: string[]) => Promise<DalReturn<TFacts[]>>
  /** Bulk-delete policy for one row: a skip reason, or null to delete it. */
  classify: (facts: TFacts) => TReason | null
}

export function bulkDeleteProcedure<TFacts extends { id: string }, TReason extends string>(config: BulkDeleteConfig<TFacts, TReason>) {
  return superAdminProcedure
    .input(z.object({ ids: idsInput }))
    .mutation(async ({ ctx, input }): Promise<BulkActionResult<TReason>> => {
      const facts = dalToTrpc(await config.facts(ctx, input.ids))
      const factsById = new Map(facts.map(row => [row.id, row]))
      const { result } = await runBulk<TReason>(input.ids, {
        classify: (id) => {
          const row = factsById.get(id)
          return row ? config.classify(row) : 'notFound'
        },
        run: id => config.crud.delete(ctx, { id }),
      })
      return result
    })
}

interface BulkUpdateConfig<TShape extends z.ZodRawShape, TRow> {
  crud: { update: (ctx: ScopedContext, input: { id: string, data: z.output<z.ZodObject<TShape>> }) => Promise<DalReturn<TRow>> }
  /** The entity's update schema picked down to the fields a bulk update may write. */
  data: z.ZodObject<TShape>
  afterRun?: (rows: TRow[]) => MaybePromise<void>
}

export function bulkUpdateProcedure<TShape extends z.ZodRawShape, TRow>(config: BulkUpdateConfig<TShape, TRow>) {
  return superAdminProcedure
    .input(z.object({ ids: idsInput, data: nonEmptyPatch(config.data) }))
    .mutation(async ({ ctx, input }): Promise<BulkActionResult> => {
      // Zod 4 can't resolve a generic object's output inside z.object; runtime validation already ran.
      const data = input.data as z.output<z.ZodObject<TShape>>
      const { result, outputs } = await runBulk(input.ids, { run: id => config.crud.update(ctx, { id, data }) })
      await config.afterRun?.(outputs)
      return result
    })
}
```

- [ ] **Step 3: The meetings facts read**

In `src/shared/entities/meetings/dal/server/queries.ts` add `inArray` to the `drizzle-orm` import and the imports:

```ts
import { applications } from '@/shared/db/schema/applications'
import { proposals } from '@/shared/db/schema/proposals'
```

Append:

```ts
export interface MeetingBulkDeleteFacts {
  id: string
  hasProposals: boolean
  hasApplications: boolean
}

/** What bulk delete decides on, for the whole batch in one read. */
export async function getMeetingBulkDeleteFacts(
  ctx: ScopedContext,
  ids: string[],
): Promise<DalReturn<MeetingBulkDeleteFacts[]>> {
  return dalDbOperation(async () =>
    db
      .select({
        id: meetings.id,
        hasProposals: sql<boolean>`EXISTS (SELECT 1 FROM ${proposals} WHERE ${proposals.meetingId} = ${meetings.id})`,
        hasApplications: sql<boolean>`EXISTS (SELECT 1 FROM ${applications} WHERE ${applications.meetingId} = ${meetings.id})`,
      })
      .from(meetings)
      .where(and(inArray(meetings.id, ids), ctx.scope ?? undefined)),
  )
}
```

(If `applications.ts` exports the table under another name, use that export; `applications.meeting_id` is the FK column.)

- [ ] **Step 4: The meetings leaf**

Create `src/trpc/routers/meetings.router/bulk.router.ts`:

```ts
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { getMeetingBulkDeleteFacts } from '@/shared/entities/meetings/dal/server/queries'
import { meetingSchemas } from '@/shared/entities/meetings/lib/server-spec'

import { createTRPCRouter } from '../../init'
import { bulkDeleteProcedure, bulkUpdateProcedure } from '../../lib/bulk-procedures'

export const bulkRouter = createTRPCRouter({
  // A deleted meeting strands its proposals (they reach their customer only through it) and cascades its applications.
  delete: bulkDeleteProcedure({
    crud: meetingCrud,
    facts: getMeetingBulkDeleteFacts,
    classify: facts => facts.hasProposals ? 'hasProposals' as const : facts.hasApplications ? 'hasApplications' as const : null,
  }),
  update: bulkUpdateProcedure({
    crud: meetingCrud,
    data: meetingSchemas.update.pick({ setBy: true }),
  }),
})
```

In `src/trpc/routers/meetings.router/index.ts` add `import { bulkRouter } from './bulk.router'` and `bulk: bulkRouter,` after `business: businessRouter,`.

- [ ] **Step 5: Run the check; type-check and lint**

Run: `pnpm exec tsx --test .superpowers/sdd/2026-09-29-records-bulk-actions/tests/bulk-patch.test.ts` → 2 pass.
Run: `pnpm tsc && pnpm lint` → clean. If `meetingSchemas.update.pick` does not typecheck because `meetingSchemas.update` is not a `ZodObject` in its declared type, read `server-spec.ts` and pass the `insertMeetingSchema.partial()` object it is built from.

- [ ] **Step 6: Commit**

```bash
git add src/trpc/lib/non-empty-patch.ts src/trpc/lib/bulk-procedures.ts src/shared/entities/meetings/dal/server/queries.ts src/trpc/routers/meetings.router/bulk.router.ts src/trpc/routers/meetings.router/index.ts
git diff --cached --stat
git commit -m "feat(meetings): bulk delete skips meetings with proposals or applications; bulk set setter

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Proposals and projects bulk leaves

**Files:**
- Create: `src/trpc/routers/proposals.router/bulk.router.ts`
- Modify: `src/trpc/routers/proposals.router/index.ts`
- Modify: `src/shared/modules/projects/core/dal/server/queries.ts` (append the facts read)
- Create: `src/trpc/routers/projects.router/bulk.router.ts`
- Modify: `src/trpc/routers/projects.router/index.ts`

**Interfaces:**
- Consumes: `bulkDeleteProcedure`, `bulkUpdateProcedure` (Task 5); `getProposalsByIds`, `getProposalLockState`, `proposalService`; `projectCrud`, `projectSchemas`, `hasAssociatedMeeting`.
- Produces: `proposalsRouter.bulk.delete({ ids })` → `BulkActionResult<'notDraft' | 'locked'>`; `getProjectBulkFacts(ctx, ids): Promise<DalReturn<{ id, isPublic, hasMeeting }[]>>`; `projectsRouter.bulk.delete({ ids })` → `BulkActionResult<'onPortfolio' | 'linkedToMeeting'>`; `projectsRouter.bulk.update({ ids, data: { isPublic } })` → `BulkActionResult`.

- [ ] **Step 1: The proposals leaf**

Create `src/trpc/routers/proposals.router/bulk.router.ts`:

```ts
import { getProposalsByIds } from '@/shared/modules/proposals/core/dal/server/queries'
import { getProposalLockState } from '@/shared/modules/proposals/core/lib/proposal-lock'
import { proposalService } from '@/shared/modules/proposals/service'

import { createTRPCRouter } from '../../init'
import { bulkDeleteProcedure } from '../../lib/bulk-procedures'

export const bulkRouter = createTRPCRouter({
  // Only an untouched draft goes: a sent proposal is a customer's live link, and an enveloped one is contract evidence.
  delete: bulkDeleteProcedure({
    crud: proposalService,
    facts: getProposalsByIds,
    classify: proposal => proposal.status !== 'draft'
      ? 'notDraft' as const
      : getProposalLockState(proposal) !== 'unlocked' ? 'locked' as const : null,
  }),
})
```

In `src/trpc/routers/proposals.router/index.ts` add `import { bulkRouter } from './bulk.router'` and `bulk: bulkRouter,` after `business: businessRouter,`. (No proposals UI uses it until B6; the leaf lands with its siblings so the three entities stay alike.)

- [ ] **Step 2: The projects facts read**

In `src/shared/modules/projects/core/dal/server/queries.ts` append:

```ts
export interface ProjectBulkFacts {
  id: string
  isPublic: boolean
  hasMeeting: boolean
}

/** What bulk delete decides on, for the whole batch in one read. */
export async function getProjectBulkFacts(
  ctx: ScopedContext,
  ids: string[],
): Promise<DalReturn<ProjectBulkFacts[]>> {
  return dalDbOperation(async () =>
    db
      .select({ id: projects.id, isPublic: projects.isPublic, hasMeeting: sql<boolean>`${hasAssociatedMeeting()}` })
      .from(projects)
      .where(and(inArray(projects.id, ids), ctx.scope ?? undefined)),
  )
}
```

(`and`, `inArray`, `sql`, `hasAssociatedMeeting` are already imported there.)

- [ ] **Step 3: The projects leaf**

Create `src/trpc/routers/projects.router/bulk.router.ts`:

```ts
import { revalidatePath } from 'next/cache'

import { projectCrud } from '@/shared/modules/projects/core/dal/server/crud'
import { getProjectBulkFacts } from '@/shared/modules/projects/core/dal/server/queries'
import { projectSchemas } from '@/shared/modules/projects/core/server-spec'

import { createTRPCRouter } from '../../init'
import { bulkDeleteProcedure, bulkUpdateProcedure } from '../../lib/bulk-procedures'

export const bulkRouter = createTRPCRouter({
  // A public project is on the website; a meeting-linked one is sales history.
  delete: bulkDeleteProcedure({
    crud: projectCrud,
    facts: getProjectBulkFacts,
    classify: project => project.isPublic ? 'onPortfolio' as const : project.hasMeeting ? 'linkedToMeeting' as const : null,
  }),
  update: bulkUpdateProcedure({
    crud: projectCrud,
    data: projectSchemas.update.pick({ isPublic: true }),
    // The public story page is prerendered; without this, a visibility change shows only after the next deploy.
    afterRun: (rows) => {
      for (const row of rows) {
        revalidatePath(`/portfolio/projects/${row.accessor}`)
      }
    },
  }),
})
```

In `src/trpc/routers/projects.router/index.ts` add `import { bulkRouter } from './bulk.router'` and `bulk: bulkRouter,` after `business: businessRouter,`.

- [ ] **Step 4: Type-check and lint**

Run: `pnpm tsc && pnpm lint` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/trpc/routers/proposals.router/bulk.router.ts src/trpc/routers/proposals.router/index.ts src/shared/modules/projects/core/dal/server/queries.ts src/trpc/routers/projects.router/bulk.router.ts src/trpc/routers/projects.router/index.ts
git diff --cached --stat
git commit -m "feat(bulk): proposals bulk delete keeps sent and enveloped ones; projects bulk delete and portfolio visibility

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Phase B3 — selection, the bar, meetings

### Task 7: Entity actions — `hidden`, one visibility helper, promoted pickers, `BulkActionBar`

**Files:**
- Modify: `src/shared/components/entities/entity-actions/types.ts`
- Create: `src/shared/components/entities/entity-actions/lib/visible-actions.ts`
- Create: `src/shared/components/entities/entity-actions/constants/bulk-action-permission.ts`
- Modify: `src/shared/components/entities/entity-actions/ui/entity-action-menu.tsx`
- Create: `src/shared/components/entities/entity-actions/ui/toolbar-popover-button.tsx`
- Modify: `src/shared/components/entities/entity-actions/ui/entity-action-dropdown.tsx:43-52`
- Modify: `src/features/schedule-management/ui/components/schedule-calendar-dot.tsx:24-33`
- Modify: `src/features/schedule-management/ui/components/schedule-activities-calendar.tsx:36-38`
- Create: `src/shared/components/entities/entity-actions/ui/bulk-action-bar.tsx`
- Test (throwaway): `.superpowers/sdd/2026-09-29-records-bulk-actions/tests/visible-actions.test.ts`

**Interfaces:**
- Produces: `RowSelection = { ids: string[], clear: () => void }`; optional `hidden?: (entity: TEntity) => boolean` on click / select / custom configs; `isActionPermitted(action, ability): boolean`; `getVisibleActions(configs, ability, entity)`; `BULK_ACTION_PERMISSION: [AppAction, AppSubject]` = `['manage', 'all']`; toolbar mode renders a promoted `custom` action as `ToolbarPopoverButton`; `BulkActionBar({ selection, actions })`.

- [ ] **Step 1: Write the failing test**

Create `.superpowers/sdd/2026-09-29-records-bulk-actions/tests/visible-actions.test.ts`:

```ts
import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { AppAbility } from '@/shared/domains/permissions/types'

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { EyeIcon } from 'lucide-react'

import { getVisibleActions } from '@/shared/components/entities/entity-actions/lib/visible-actions'

// Only the `can` the helper calls.
const agent = { can: (action: string, subject: string) => !(action === 'delete' && subject === 'Project') } as unknown as AppAbility

interface Row { id: string, isPublic: boolean }

const configs: EntityActionConfig<Row>[] = [
  { action: { id: 'open', label: 'Open', icon: EyeIcon }, onAction: () => {} },
  { action: { id: 'view', label: 'View on Site', icon: EyeIcon }, onAction: () => {}, hidden: row => !row.isPublic },
  { action: { id: 'delete', label: 'Delete', icon: EyeIcon, permission: ['delete', 'Project'] }, onAction: () => {} },
]

test('drops actions the viewer lacks the permission for', () => {
  const ids = getVisibleActions(configs, agent, { id: '1', isPublic: true }).map(c => c.action.id)
  assert.deepEqual(ids, ['open', 'view'])
})

test('drops actions hidden for this entity', () => {
  const ids = getVisibleActions(configs, agent, { id: '1', isPublic: false }).map(c => c.action.id)
  assert.deepEqual(ids, ['open'])
})
```

Run: `pnpm exec tsx --test .superpowers/sdd/2026-09-29-records-bulk-actions/tests/visible-actions.test.ts` → FAIL (module not found).

- [ ] **Step 2: Types**

In `src/shared/components/entities/entity-actions/types.ts`:

Add to `EntityActionClickConfig`, `EntityActionSelectConfig` and `EntityActionCustomConfig` (after `isDisabled?`):

```ts
  /** Leaves the action out for this entity (Approve once approved, Show on Portfolio once public). */
  hidden?: (entity: TEntity) => boolean
```

Append:

```ts
/** What a bulk action receives: the ticked rows' ids, and a way to clear the selection once it ran. */
export interface RowSelection {
  ids: string[]
  clear: () => void
}
```

- [ ] **Step 3: The helper and the bulk permission**

Create `src/shared/components/entities/entity-actions/lib/visible-actions.ts`:

```ts
import type { EntityAction, EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { AppAbility } from '@/shared/domains/permissions/types'

export function isActionPermitted(action: EntityAction, ability: AppAbility): boolean {
  return !action.permission || ability.can(action.permission[0], action.permission[1])
}

/** The actions this viewer may run on this entity: the CASL permission first, then the action's own `hidden` rule. */
export function getVisibleActions<TEntity>(
  configs: EntityActionConfig<TEntity>[],
  ability: AppAbility,
  entity: TEntity,
): EntityActionConfig<TEntity>[] {
  return configs.filter(config => isActionPermitted(config.action, ability) && !config.hidden?.(entity))
}
```

Create `src/shared/components/entities/entity-actions/constants/bulk-action-permission.ts`:

```ts
import type { AppAction, AppSubject } from '@/shared/domains/permissions/types'

/** Bulk actions are super-admin only: the bulk procedures run on superAdminProcedure whatever the single-row permission is. */
export const BULK_ACTION_PERMISSION: [AppAction, AppSubject] = ['manage', 'all']
```

Run the test from Step 1 → 2 pass.

- [ ] **Step 4: Menus use the helper**

In `entity-action-menu.tsx` replace the `permitted` block (`:28-33`) with:

```tsx
  const permitted = getVisibleActions(actions, ability, entity)
```

(import `getVisibleActions` from `@/shared/components/entities/entity-actions/lib/visible-actions`). In `entity-action-dropdown.tsx` replace its `permitted` block (`:47-52`) the same way. In `schedule-calendar-dot.tsx` replace the `permittedActions` block with `const permittedActions = getVisibleActions(actions, ability, event)`. In `schedule-activities-calendar.tsx` (one list for every event, no entity) replace the filter body with `actions.filter(({ action }) => isActionPermitted(action, ability))`.

- [ ] **Step 5: Toolbar mode promotes pickers; destructive buttons look destructive**

Create `src/shared/components/entities/entity-actions/ui/toolbar-popover-button.tsx`:

```tsx
'use client'

import type { EntityActionCustomConfig } from '@/shared/components/entities/entity-actions/types'

import { useState } from 'react'

import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'

interface ToolbarPopoverButtonProps<TEntity> {
  config: EntityActionCustomConfig<TEntity>
  entity: TEntity
}

/** A promoted picker: one click opens its content, instead of a More menu and a sub-menu. */
export function ToolbarPopoverButton<TEntity>({ config, entity }: ToolbarPopoverButtonProps<TEntity>) {
  const [open, setOpen] = useState(false)
  const Icon = config.action.icon
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" data-toolbar-role="promoted" disabled={config.isLoading || config.isDisabled}>
          <Icon className="size-3.5" />
          {config.action.label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(420px,calc(100vw-2rem))] p-0">
        {config.renderContent(entity, () => setOpen(false))}
      </PopoverContent>
    </Popover>
  )
}
```

In `entity-action-menu.tsx`:
- import `EntityActionCustomConfig` (type), `isCustomAction`, and `ToolbarPopoverButton`;
- replace the toolbar branch's `promoted` / `overflow` lines and the `promoted.map(...)` render with:

```tsx
    const promoted = permitted.filter((c): c is EntityActionClickConfig<TEntity> | EntityActionCustomConfig<TEntity> =>
      c.action.promoted === true && c !== primary && (isClickAction(c) || isCustomAction(c)))
    const promotedSet = new Set<EntityActionConfig<TEntity>>(promoted)
    const overflow = permitted.filter(c => c !== primary && !promotedSet.has(c))
```

```tsx
        {promoted.map(config => isCustomAction(config)
          ? <ToolbarPopoverButton key={config.action.id} config={config} entity={entity} />
          : <ToolbarButton key={config.action.id} config={config} entity={entity} variant="outline" toolbarRole="promoted" />)}
```

- in `ToolbarButton`'s `<Button>`, add `className={cn(config.action.destructive && 'text-destructive hover:text-destructive')}`.

- [ ] **Step 6: `BulkActionBar`**

Create `src/shared/components/entities/entity-actions/ui/bulk-action-bar.tsx`:

```tsx
'use client'

import type { EntityActionConfig, RowSelection } from '@/shared/components/entities/entity-actions/types'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo } from 'react'

import { EntityActionMenu } from '@/shared/components/entities/entity-actions/ui/entity-action-menu'
import { Button } from '@/shared/components/ui/button'

interface BulkActionBarProps {
  selection: RowSelection
  actions: EntityActionConfig<RowSelection>[]
}

export function BulkActionBar({ selection, actions }: BulkActionBarProps) {
  const reduceMotion = useReducedMotion()
  // Every bulk action is a button; a picker opens in place.
  const barActions = useMemo(
    () => actions.map(config => ({ ...config, action: { ...config.action, primary: false, promoted: true } })),
    [actions],
  )
  const count = selection.ids.length

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          role="toolbar"
          aria-label={`${count} selected`}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-lg"
        >
          <span className="text-sm font-medium tabular-nums">{`${count} selected`}</span>
          <span aria-hidden className="h-4 w-px bg-border" />
          <EntityActionMenu entity={selection} actions={barActions} mode="toolbar" />
          <Button type="button" size="sm" variant="ghost" onClick={selection.clear}>Clear</Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 7: Type-check, lint, and a regression read**

Run: `pnpm tsc && pnpm lint` → clean. Re-run the Step 1 test → pass. In the browser, the meetings expanded row's action bar still shows Start Meeting, Create Proposal and More; the schedule calendar's meeting dot menu still lists its actions.

- [ ] **Step 8: Commit**

```bash
git add src/shared/components/entities/entity-actions/types.ts src/shared/components/entities/entity-actions/lib/visible-actions.ts src/shared/components/entities/entity-actions/constants/bulk-action-permission.ts src/shared/components/entities/entity-actions/ui/entity-action-menu.tsx src/shared/components/entities/entity-actions/ui/toolbar-popover-button.tsx src/shared/components/entities/entity-actions/ui/entity-action-dropdown.tsx src/features/schedule-management/ui/components/schedule-calendar-dot.tsx src/features/schedule-management/ui/components/schedule-activities-calendar.tsx src/shared/components/entities/entity-actions/ui/bulk-action-bar.tsx
git diff --cached --stat
git commit -m "feat(entity-actions): hidden per entity, one visibility helper, promoted pickers, the bulk action bar

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: `DataTable` owns row selection

**Files:**
- Create: `src/shared/components/data-table/lib/prune-row-selection.ts`
- Modify: `src/shared/components/ui/checkbox.tsx`
- Modify: `src/shared/components/data-table/ui/data-table.tsx`
- Modify: `src/shared/components/data-table/ui/data-table-body.tsx`
- Test (throwaway): `.superpowers/sdd/2026-09-29-records-bulk-actions/tests/prune-row-selection.test.ts`

**Interfaces:**
- Consumes: `RowSelection`, `isActionPermitted`, `BulkActionBar` (Task 7).
- Produces: `DataTableProps.bulkActions?: EntityActionConfig<RowSelection>[]`; `pruneRowSelection(selection, rowIds): RowSelectionState`; `Checkbox` renders `checked="indeterminate"` with a minus glyph; `DataTableBody` prop `canSelect: boolean`.

- [ ] **Step 1: Write the failing test**

Create `.superpowers/sdd/2026-09-29-records-bulk-actions/tests/prune-row-selection.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { pruneRowSelection } from '@/shared/components/data-table/lib/prune-row-selection'

test('keeps ticked ids still among the rows', () => {
  assert.deepEqual(pruneRowSelection({ a: true, b: true }, new Set(['a', 'b', 'c'])), { a: true, b: true })
})

test('drops ids a filter or search removed, so they come back un-ticked', () => {
  assert.deepEqual(pruneRowSelection({ a: true, gone: true }, new Set(['a'])), { a: true })
})

test('drops explicit false entries', () => {
  assert.deepEqual(pruneRowSelection({ a: false, b: true }, new Set(['a', 'b'])), { b: true })
})
```

Run: `pnpm exec tsx --test .superpowers/sdd/2026-09-29-records-bulk-actions/tests/prune-row-selection.test.ts` → FAIL.

- [ ] **Step 2: The prune helper**

Create `src/shared/components/data-table/lib/prune-row-selection.ts`:

```ts
import type { RowSelectionState } from '@tanstack/react-table'

/** Keeps only ticked ids still among the rows, so a row a filter hid never stays secretly ticked. */
export function pruneRowSelection(selection: RowSelectionState, rowIds: ReadonlySet<string>): RowSelectionState {
  const next: RowSelectionState = {}
  for (const [id, selected] of Object.entries(selection)) {
    if (selected && rowIds.has(id)) {
      next[id] = true
    }
  }
  return next
}
```

Run the test → 3 pass.

- [ ] **Step 3: Indeterminate checkbox**

In `src/shared/components/ui/checkbox.tsx`: change the icon import to `import { CheckIcon, MinusIcon } from 'lucide-react'`; add `data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground data-[state=indeterminate]:border-primary` to the Root class list (beside the `data-[state=checked]` classes); and render inside the Indicator:

```tsx
        {props.checked === 'indeterminate' ? <MinusIcon className="size-3.5" /> : <CheckIcon className="size-3.5" />}
```

- [ ] **Step 4: Selection state in `DataTable`**

In `src/shared/components/data-table/ui/data-table.tsx`:

Imports: add `RowSelectionState` to the `@tanstack/react-table` type import; add

```tsx
import type { EntityActionConfig, RowSelection } from '@/shared/components/entities/entity-actions/types'
import { pruneRowSelection } from '@/shared/components/data-table/lib/prune-row-selection'
import { isActionPermitted } from '@/shared/components/entities/entity-actions/lib/visible-actions'
import { BulkActionBar } from '@/shared/components/entities/entity-actions/ui/bulk-action-bar'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { useAbility } from '@/shared/domains/permissions/hooks'
```

`DataTableProps`, after `columnVisibility?`:

```tsx
  /** Actions on the ticked rows. Checkboxes show only when the viewer may run at least one. */
  bulkActions?: EntityActionConfig<RowSelection>[]
```

Destructure `bulkActions` in the component signature. After `const [expanded, setExpanded] = useState<ExpandedState>({})`:

```tsx
  const ability = useAbility()
  const permittedBulkActions = useMemo(
    () => (bulkActions ?? []).filter(config => isActionPermitted(config.action, ability)),
    [bulkActions, ability],
  )
  const canSelect = permittedBulkActions.length > 0
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  // Same render-phase pattern as the expansion reset below: a filter, search or refetch that drops a row drops its tick.
  const rowIdsKey = data.map(row => row.id).join('|')
  const [lastRowIdsKey, setLastRowIdsKey] = useState(rowIdsKey)
  if (rowIdsKey !== lastRowIdsKey) {
    setLastRowIdsKey(rowIdsKey)
    setRowSelection(prev => pruneRowSelection(prev, new Set(data.map(row => row.id))))
  }

  const selectedIds = useMemo(() => Object.keys(rowSelection).filter(id => rowSelection[id]), [rowSelection])
  const clearSelection = useCallback(() => setRowSelection({}), [])
  const selection = useMemo<RowSelection>(() => ({ ids: selectedIds, clear: clearSelection }), [selectedIds, clearSelection])
```

In `useReactTable({ … })`: add `rowSelection,` to `state`; add after `onExpandedChange: setExpanded,`:

```tsx
    onRowSelectionChange: setRowSelection,
    enableRowSelection: canSelect,
```

In the expansion-reset block, add `setRowSelection({})` beside `setExpanded({})`, and change its comment to `// Derived during render, not in a handler: page size and the toolbar's Reset change the URL state without going through this table's handlers. Selection clears with expansion.`

- [ ] **Step 5: The header "select page" checkbox**

In the header's `isFirstCol` branch, make the flex row start with:

```tsx
                              <div className="flex items-center gap-1">
                                {canSelect && (
                                  <label className="-m-1.5 flex shrink-0 cursor-pointer items-center p-1.5">
                                    <Checkbox
                                      checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? 'indeterminate' : false}
                                      onCheckedChange={value => table.toggleAllPageRowsSelected(value === true)}
                                      aria-label={`Select every ${entityName} on this page`}
                                    />
                                  </label>
                                )}
                                <div className="min-w-0 flex-1">
```

(the rest of the branch — the header content and the pin button — is unchanged).

- [ ] **Step 6: The bar's place**

Replace the card's inner structure (the scroller `div` through `<DataTablePagination …/>`) so the scroller sits in a `relative` box with the bar floating over its bottom:

```tsx
      <div className="grow min-h-0 flex flex-col rounded-xl border border-border/50 overflow-hidden">
        <div className="relative grow min-h-0 flex flex-col">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className={cn(
              // A size container: the pull spinner and expanded panels size to it with `cqw`, without measuring it.
              '@container grow min-h-0 overflow-auto overscroll-none touch-pan-x touch-pan-y',
              '**:data-[slot=table-container]:overflow-visible',
              isAnyColumnResizing && 'cursor-col-resize select-none',
              // Room for the bar, so the last row can scroll clear of it.
              selectedIds.length > 0 && 'pb-16',
            )}
          >
            {/* The existing <Table>…</Table> element (data-table.tsx:378-507), unchanged. */}
          </div>
          {canSelect && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-4">
              <BulkActionBar selection={selection} actions={permittedBulkActions} />
            </div>
          )}
        </div>

        <DataTablePagination table={table} serverPagination={serverPagination} />
      </div>
```

Pass `canSelect={canSelect}` to `<DataTableBody … />`.

- [ ] **Step 7: The row checkbox, the selected look and the row-click guard**

In `src/shared/components/data-table/ui/data-table-body.tsx`:
- import `import { Checkbox } from '@/shared/components/ui/checkbox'`;
- add `canSelect: boolean` to `DataTableBodyProps` and destructure it;
- beside `expandToggle`, build:

```tsx
        const selectToggle = canSelect
          ? (
              // The label widens the tap target; it is in the row's interactive selector, so a tap never expands the row.
              <label className="-m-1.5 flex shrink-0 cursor-pointer items-center p-1.5" onClick={e => e.stopPropagation()}>
                <Checkbox
                  checked={row.getIsSelected()}
                  onCheckedChange={value => row.toggleSelected(value === true)}
                  aria-label={`Select ${entityName}`}
                />
              </label>
            )
          : null
```

- `TableRow`: add `data-state={row.getIsSelected() ? 'selected' : undefined}`;
- replace the `onRowClick` branch of the row's `onClick` with:

```tsx
                if (onRowClick) {
                  if (shouldToggleRow(e, window.getSelection()?.toString() ?? '')) {
                    onRowClick(row.original)
                  }
                }
```

- replace the `cellContent` computation with:

```tsx
                const cellContent = colIdx === 0 && (selectToggle || expandToggle)
                  ? (
                      <div className="flex items-center gap-1">
                        {selectToggle}
                        {expandToggle}
                        <div className="min-w-0 flex-1">{content}</div>
                      </div>
                    )
                  : content
```

- the frozen cell's opaque overlay (`absolute inset-0 bg-background group-hover:bg-muted/50 …`) gains `group-data-[state=selected]:bg-muted` so the tint reaches the frozen column.

- [ ] **Step 8: Type-check, lint, tests**

Run: `pnpm tsc && pnpm lint` → clean. Run the prune test → pass.

- [ ] **Step 9: Browser regression read (no consumer passes `bulkActions` yet)**

As a super-admin: `/dashboard/meetings` shows no checkboxes yet, rows still expand, the pin toggle still freezes the first column; `/dashboard/customers` row click still opens the profile, and clicking a control inside a row (e.g. a date picker) no longer also opens it; campaign leads still shows its own select column (replaced in Task 10).

- [ ] **Step 10: Commit**

```bash
git add src/shared/components/data-table/lib/prune-row-selection.ts src/shared/components/ui/checkbox.tsx src/shared/components/data-table/ui/data-table.tsx src/shared/components/data-table/ui/data-table-body.tsx
git diff --cached --stat
git commit -m "feat(data-table): row selection owned by the table — checkbox in the primary cell, select page, the bulk bar

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Meetings — bulk actions, Set Setter, the records view composes its shell

**Files:**
- Create: `src/shared/components/entities/entity-actions/lib/format-bulk-action-result.ts`
- Create: `src/shared/components/entities/entity-actions/lib/toast-bulk-action-result.ts`
- Create: `src/shared/components/entities/entity-actions/constants/bulk-skip-labels.ts`
- Create: `src/shared/entities/meetings/constants/bulk-skip-labels.ts`
- Modify: `src/shared/entities/meetings/constants/actions.ts`
- Modify: `src/shared/entities/meetings/hooks/use-meeting-actions.ts`
- Modify: `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx`
- Create: `src/shared/entities/meetings/hooks/use-meeting-bulk-action-configs.tsx`
- Modify: `src/shared/entities/meetings/components/meetings-table/use-meetings-table.tsx`
- Delete: `src/shared/entities/meetings/components/meetings-table/meetings-table.tsx`
- Modify: `src/features/records-management/ui/views/meetings-records-view.tsx`
- Test (throwaway): `.superpowers/sdd/2026-09-29-records-bulk-actions/tests/format-bulk-action-result.test.ts`

**Interfaces:**
- Consumes: `meetingsRouter.bulk.{delete,update}` (Task 5); `SetterPicker` (Task 3); `BULK_ACTION_PERMISSION`, `RowSelection` (Task 7); `DataTableProps.bulkActions` (Task 8).
- Produces: `formatBulkActionResult(result, verb, reasonLabels): string`; `toastBulkActionResult(result, verb, reasonLabels): void`; `BULK_NOT_FOUND_LABELS`; `MEETING_BULK_DELETE_SKIP_LABELS`; `MEETING_ACTIONS.setSetter`; `useMeetingActions()` gains `updateSetter`, `bulkDeleteMeetings`, `bulkSetSetter`; `useMeetingActionConfigs` override `withSetSetter?: boolean` and `MeetingEntity.setBy?`; `useMeetingBulkActionConfigs(): { bulkActions: EntityActionConfig<RowSelection>[], dialogs: ReactNode }`; `useMeetingsTable` returns `{ query, visibility, dataTableProps, dialogs }` (no `MeetingsTableQuery` export).

- [ ] **Step 1: Write the failing test**

Create `.superpowers/sdd/2026-09-29-records-bulk-actions/tests/format-bulk-action-result.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { formatBulkActionResult } from '@/shared/components/entities/entity-actions/lib/format-bulk-action-result'

const labels = { hasProposals: 'with proposals', notFound: 'no longer there' }

test('all done', () => {
  assert.equal(formatBulkActionResult({ done: ['a', 'b', 'c'], skipped: [], failed: [] }, 'Deleted', labels), 'Deleted 3')
})

test('everything skipped for one reason still reports the zero', () => {
  const result = { done: [], skipped: [{ id: 'a', reason: 'hasProposals' }, { id: 'b', reason: 'hasProposals' }, { id: 'c', reason: 'hasProposals' }], failed: [] }
  assert.equal(formatBulkActionResult(result, 'Deleted', labels), 'Deleted 0 · skipped 3 (with proposals)')
})

test('mixed reasons are counted; failures are reported', () => {
  const result = {
    done: ['a', 'b'],
    skipped: [{ id: 'c', reason: 'hasProposals' }, { id: 'd', reason: 'hasProposals' }, { id: 'e', reason: 'notFound' }],
    failed: [{ id: 'f', error: 'db-error' }],
  }
  assert.equal(formatBulkActionResult(result, 'Deleted', labels), 'Deleted 2 · skipped 3 (2 with proposals, 1 no longer there) · 1 failed')
})
```

Run: `pnpm exec tsx --test .superpowers/sdd/2026-09-29-records-bulk-actions/tests/format-bulk-action-result.test.ts` → FAIL.

- [ ] **Step 2: Result formatting and the toast**

Create `src/shared/components/entities/entity-actions/lib/format-bulk-action-result.ts`:

```ts
interface BulkResultCounts {
  done: readonly unknown[]
  skipped: readonly { reason: string }[]
  failed: readonly unknown[]
}

/** "Deleted 2 · skipped 3 (2 with proposals, 1 no longer there) · 1 failed" */
export function formatBulkActionResult(
  result: BulkResultCounts,
  verb: string,
  reasonLabels: Readonly<Record<string, string>>,
): string {
  const parts = [`${verb} ${result.done.length}`]
  if (result.skipped.length > 0) {
    const counts = new Map<string, number>()
    for (const { reason } of result.skipped) {
      counts.set(reason, (counts.get(reason) ?? 0) + 1)
    }
    const reasons = [...counts].map(([reason, count]) => {
      const label = reasonLabels[reason] ?? reason
      return counts.size === 1 ? label : `${count} ${label}`
    })
    parts.push(`skipped ${result.skipped.length} (${reasons.join(', ')})`)
  }
  if (result.failed.length > 0) {
    parts.push(`${result.failed.length} failed`)
  }
  return parts.join(' · ')
}
```

Create `src/shared/components/entities/entity-actions/lib/toast-bulk-action-result.ts`:

```ts
import { toast } from 'sonner'

import { formatBulkActionResult } from './format-bulk-action-result'

type BulkResult = Parameters<typeof formatBulkActionResult>[0]

/** A run that changed nothing warns rather than celebrates. */
export function toastBulkActionResult(result: BulkResult, verb: string, reasonLabels: Readonly<Record<string, string>>): void {
  const message = formatBulkActionResult(result, verb, reasonLabels)
  if (result.failed.length > 0) {
    toast.error(message)
  }
  else if (result.done.length === 0) {
    toast.warning(message)
  }
  else {
    toast.success(message)
  }
}
```

Create `src/shared/components/entities/entity-actions/constants/bulk-skip-labels.ts`:

```ts
/** Every bulk procedure can skip a row that vanished between the page load and the run. */
export const BULK_NOT_FOUND_LABELS = { notFound: 'no longer there' } as const
```

Create `src/shared/entities/meetings/constants/bulk-skip-labels.ts`:

```ts
import type { AppRouterOutputs } from '@/trpc/routers/app'

import { BULK_NOT_FOUND_LABELS } from '@/shared/components/entities/entity-actions/constants/bulk-skip-labels'

type MeetingBulkDeleteSkip = AppRouterOutputs['meetingsRouter']['bulk']['delete']['skipped'][number]['reason']

export const MEETING_BULK_DELETE_SKIP_LABELS = {
  ...BULK_NOT_FOUND_LABELS,
  hasProposals: 'with proposals',
  hasApplications: 'with applications',
} as const satisfies Record<MeetingBulkDeleteSkip, string>
```

Run the Step 1 test → 3 pass.

- [ ] **Step 3: The action and the mutations**

In `src/shared/entities/meetings/constants/actions.ts` add `UserPenIcon` to the lucide import and, after `assignOwner`:

```ts
  setSetter: {
    id: 'setSetter',
    label: 'Set Setter',
    icon: UserPenIcon,
    permission: ['assign', 'Meeting'],
  },
```

In `src/shared/entities/meetings/hooks/use-meeting-actions.ts` add the imports:

```ts
import { BULK_NOT_FOUND_LABELS } from '@/shared/components/entities/entity-actions/constants/bulk-skip-labels'
import { toastBulkActionResult } from '@/shared/components/entities/entity-actions/lib/toast-bulk-action-result'
import { MEETING_BULK_DELETE_SKIP_LABELS } from '@/shared/entities/meetings/constants/bulk-skip-labels'
```

and before the `return`:

```ts
  const updateSetter = useMutation(
    trpc.meetingsRouter.crud.update.mutationOptions({
      onSuccess: () => {
        invalidateMeeting()
        toast.success('Setter updated')
      },
      onError: err => toast.error(err.message || 'Failed to update setter'),
    }),
  )

  const bulkDeleteMeetings = useMutation(
    trpc.meetingsRouter.bulk.delete.mutationOptions({
      onSuccess: (result) => {
        invalidateMeeting()
        toastBulkActionResult(result, 'Deleted', MEETING_BULK_DELETE_SKIP_LABELS)
      },
      onError: err => toast.error(err.message || 'Failed to delete meetings'),
    }),
  )

  const bulkSetSetter = useMutation(
    trpc.meetingsRouter.bulk.update.mutationOptions({
      onSuccess: (result) => {
        invalidateMeeting()
        toastBulkActionResult(result, 'Updated', BULK_NOT_FOUND_LABELS)
      },
      onError: err => toast.error(err.message || 'Failed to update setters'),
    }),
  )
```

and add `updateSetter, bulkDeleteMeetings, bulkSetSetter` to the returned object.

- [ ] **Step 4: Single-row Set Setter behind an opt-in**

In `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx`:
- import `import { SetterPicker } from '@/shared/entities/meetings/components/setter-picker'`;
- `MeetingEntity`: add `setBy?: string | null`;
- `MeetingActionOverrides`: add

```ts
  /** Adds Set Setter. Only the records table opts in: the schedule and the cards don't carry the setter. */
  withSetSetter?: boolean
```

- add `updateSetter` to the `useMeetingActions()` destructure in the hook body;
- before the `configs.push({ action: MEETING_ACTIONS.delete, … })`:

```tsx
    if (overrides.withSetSetter) {
      configs.push({
        action: MEETING_ACTIONS.setSetter,
        type: 'custom',
        isLoading: updateSetter.isPending,
        renderContent: (entity: T, closeMenu) => (
          <SetterPicker
            value={entity.setBy ?? null}
            onPick={(setBy) => {
              closeMenu()
              updateSetter.mutate({ id: entity.id, data: { setBy } })
            }}
          />
        ),
      })
    }
```

- add `updateSetter` to that `useMemo`'s dependency list.

- [ ] **Step 5: The bulk configs**

Create `src/shared/entities/meetings/hooks/use-meeting-bulk-action-configs.tsx`:

```tsx
'use client'

import type { EntityActionConfig, RowSelection } from '@/shared/components/entities/entity-actions/types'

import { useMemo, useState } from 'react'

import { BULK_ACTION_PERMISSION } from '@/shared/components/entities/entity-actions/constants/bulk-action-permission'
import { SetterPicker } from '@/shared/entities/meetings/components/setter-picker'
import { MEETING_ACTIONS } from '@/shared/entities/meetings/constants/actions'
import { useConfirm } from '@/shared/hooks/use-confirm'

import { useMeetingActions } from './use-meeting-actions'

export function useMeetingBulkActionConfigs() {
  const { bulkDeleteMeetings, bulkSetSetter } = useMeetingActions()
  // The confirm copy is read when the dialog renders, so the count set just before `confirm()` shows.
  const [pendingCount, setPendingCount] = useState(0)
  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: `Delete ${pendingCount} ${pendingCount === 1 ? 'meeting' : 'meetings'}?`,
    message: 'Meetings with proposals or applications are skipped. This cannot be undone.',
  })

  const bulkActions = useMemo((): EntityActionConfig<RowSelection>[] => [
    {
      action: { ...MEETING_ACTIONS.setSetter, permission: BULK_ACTION_PERMISSION },
      type: 'custom',
      isLoading: bulkSetSetter.isPending,
      renderContent: (selection, closeMenu) => (
        <SetterPicker
          value={undefined}
          onPick={(setBy) => {
            closeMenu()
            bulkSetSetter.mutate({ ids: selection.ids, data: { setBy } }, { onSuccess: selection.clear })
          }}
        />
      ),
    },
    {
      action: { ...MEETING_ACTIONS.delete, permission: BULK_ACTION_PERMISSION },
      isLoading: bulkDeleteMeetings.isPending,
      onAction: async (selection) => {
        setPendingCount(selection.ids.length)
        if (await confirmDelete()) {
          bulkDeleteMeetings.mutate({ ids: selection.ids }, { onSuccess: selection.clear })
        }
      },
    },
  ], [bulkDeleteMeetings, bulkSetSetter, confirmDelete])

  return { bulkActions, dialogs: <DeleteConfirmDialog /> }
}
```

- [ ] **Step 6: Wire the table; the records view composes its shell**

In `src/shared/entities/meetings/components/meetings-table/use-meetings-table.tsx`:
- import `useMeetingBulkActionConfigs` from `@/shared/entities/meetings/hooks/use-meeting-bulk-action-configs`;
- in the `overrides` memo add `withSetSetter: true,`;
- after the `useMeetingActionConfigs` line: `const { bulkActions, dialogs: bulkDialogs } = useMeetingBulkActionConfigs()`;
- add `bulkActions,` to `dataTableProps`;
- add `{bulkDialogs}` as the first child of the `dialogs` fragment;
- delete the `export type MeetingsTableQuery = …` line.

Delete `src/shared/entities/meetings/components/meetings-table/meetings-table.tsx` (`git rm`). Run `grep -rn "meetings-table/meetings-table\|MeetingsTableQuery\|<MeetingsTable" src` → expected: no hits after the next edit.

Replace `src/features/records-management/ui/views/meetings-records-view.tsx` with:

```tsx
'use client'

import type { MeetingsExpandedRowContext } from '@/shared/entities/meetings/components/meetings-table/use-meetings-table'
import type { MeetingRow } from '@/shared/entities/meetings/lib/columns-registry'

import { MEETINGS_RECORDS_TABLE_VIEW } from '@/features/records-management/constants/meetings-records-table-view'
import { MeetingRowPanel } from '@/features/records-management/ui/components/meeting-row-panel'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { RecordsPageHeader } from '@/shared/components/records-page-header'
import { RecordsPageMotionShell } from '@/shared/components/records-page-motion-shell'
import { RecordsPageShell } from '@/shared/components/records-page-shell'
import { useMeetingsTable } from '@/shared/entities/meetings/components/meetings-table/use-meetings-table'

// Module level keeps its identity stable, so the table's props don't churn.
function renderMeetingRowPanel(row: MeetingRow, { actions }: MeetingsExpandedRowContext) {
  return <MeetingRowPanel meeting={row} actions={actions} />
}

export function MeetingsRecordsView() {
  const { query, visibility, dataTableProps, dialogs } = useMeetingsTable(MEETINGS_RECORDS_TABLE_VIEW, { renderExpandedRow: renderMeetingRowPanel })

  return (
    <RecordsPageMotionShell>
      {dialogs}
      <RecordsPageShell
        header={<RecordsPageHeader title="Meetings" query={query} />}
        toolbar={(
          <QueryToolbar query={query} entityName="meetings">
            <QueryToolbar.Standard searchPlaceholder="Search by customer or type…" visibility={visibility} />
          </QueryToolbar>
        )}
        table={<DataTable {...dataTableProps} />}
      />
    </RecordsPageMotionShell>
  )
}
```

- [ ] **Step 7: Type-check, lint, tests**

Run: `pnpm tsc && pnpm lint` → clean. Re-run the four throwaway tests → all pass.

- [ ] **Step 8: Browser check — super-admin (read-only)**

On `/dashboard/meetings` (desktop, then a 390px viewport):
1. Each row's first cell shows a checkbox left of the chevron; ticking it neither expands the row nor scrolls; the header checkbox goes indeterminate, then ticks the whole page.
2. The bar shows "N selected · Set Setter · Delete · Clear"; Set Setter opens the picker in a popover; Delete opens "Delete N meetings?" — press **Cancel**; Clear hides the bar.
3. Changing page, page size or sort clears the ticks; searching away a ticked row and clearing the search shows it un-ticked (Review Focus 3).
4. A row's More menu has "Set Setter" with the picker (checkmark on the current setter, or on "No setter").
5. The Setter column (turned on) reads the same as the picker's checkmark.

- [ ] **Step 9: Browser check — agent, and the owner's write check**

As an agent: no checkboxes, no bar, no Set Setter in the row menu, no Setter column or filter (Review Focus 1).
Owner-designated rows only: the owner ticks one meeting with a proposal and one without, runs Delete → toast "Deleted 1 · skipped 1 (with proposals)"; ticks two meetings and sets "No setter" → toast "Updated 2", the Setter column shows "—" (Review Focus 4, 5).

- [ ] **Step 10: Commit**

```bash
git add src/shared/components/entities/entity-actions/lib/format-bulk-action-result.ts src/shared/components/entities/entity-actions/lib/toast-bulk-action-result.ts src/shared/components/entities/entity-actions/constants/bulk-skip-labels.ts src/shared/entities/meetings/constants/bulk-skip-labels.ts src/shared/entities/meetings/constants/actions.ts src/shared/entities/meetings/hooks/use-meeting-actions.ts src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx src/shared/entities/meetings/hooks/use-meeting-bulk-action-configs.tsx src/shared/entities/meetings/components/meetings-table/use-meetings-table.tsx src/shared/entities/meetings/components/meetings-table/meetings-table.tsx src/features/records-management/ui/views/meetings-records-view.tsx
git diff --cached --stat
git commit -m "feat(meetings): bulk delete and set setter on the records table; Set Setter per row; the view composes its shell

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Phase B4 — campaign leads

### Task 10: Campaign leads on the shared selection

**Files:**
- Create: `src/features/campaigns-admin/constants/lead-bulk-actions.ts`
- Create: `src/features/campaigns-admin/ui/components/leads/bulk-enroll-form.tsx`
- Create: `src/features/campaigns-admin/hooks/use-lead-bulk-action-configs.tsx`
- Modify: `src/features/campaigns-admin/ui/views/campaigns-leads-view.tsx`
- Modify: `src/features/campaigns-admin/ui/lib/leads-columns.tsx`
- Delete: `src/features/campaigns-admin/ui/components/leads/{lead-select-cell,lead-select-header,leads-bulk-action-bar,bulk-enroll-popover}.tsx`

**Interfaces:**
- Consumes: `DataTableProps.bulkActions` (Task 8); `RowSelection`, `BULK_ACTION_PERMISSION` (Task 7); `useCampaignMutations` (`enrollSelected`, `removeBulk`, `disqualifyBulk`, `markDnc` — unchanged, `{ customerIds }` inputs).
- Produces: `LEAD_BULK_ACTIONS`; `BulkEnrollForm({ campaigns, customerIds, onDone })`; `useLeadBulkActionConfigs(campaigns): { bulkActions, dialogs }`; `LeadsTableMeta` without `pageRowIds` / `selectedIds` / `toggleSelect` / `toggleSelectAll`.

- [ ] **Step 1: The actions**

Create `src/features/campaigns-admin/constants/lead-bulk-actions.ts`:

```ts
import type { EntityAction } from '@/shared/components/entities/entity-actions/types'

import { BanIcon, PhoneOffIcon, PhoneOutgoingIcon, UserMinusIcon } from 'lucide-react'

import { BULK_ACTION_PERMISSION } from '@/shared/components/entities/entity-actions/constants/bulk-action-permission'

export const LEAD_BULK_ACTIONS = {
  enroll: { id: 'enroll', label: 'Enroll', icon: PhoneOutgoingIcon, permission: BULK_ACTION_PERMISSION },
  remove: { id: 'remove', label: 'Remove', icon: UserMinusIcon, permission: BULK_ACTION_PERMISSION },
  disqualify: { id: 'disqualify', label: 'Disqualify', icon: BanIcon, permission: BULK_ACTION_PERMISSION },
  markDnc: { id: 'markDnc', label: 'Mark DNC', icon: PhoneOffIcon, permission: BULK_ACTION_PERMISSION, destructive: true },
} as const satisfies Record<string, EntityAction>
```

- [ ] **Step 2: The enroll picker as content**

Create `src/features/campaigns-admin/ui/components/leads/bulk-enroll-form.tsx` (the body of `bulk-enroll-popover.tsx` without its Popover and trigger):

```tsx
'use client'

import type { VoipCampaign } from '@/shared/entities/voip-campaigns/types'

import { useState } from 'react'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { CampaignSelect } from '@/features/campaigns-admin/ui/components/shared/campaign-select'
import { Button } from '@/shared/components/ui/button'

interface BulkEnrollFormProps {
  campaigns: VoipCampaign[]
  customerIds: string[]
  onDone: () => void
}

export function BulkEnrollForm({ campaigns, customerIds, onDone }: BulkEnrollFormProps) {
  const { enrollSelected } = useCampaignMutations()
  const [campaignId, setCampaignId] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="text-sm font-medium">{`Enroll ${customerIds.length} into a campaign`}</p>
      <CampaignSelect campaigns={campaigns} onChange={setCampaignId} value={campaignId ?? undefined} />
      <Button
        disabled={!campaignId || enrollSelected.isPending}
        size="sm"
        onClick={() => {
          if (!campaignId) {
            return
          }
          enrollSelected.mutate({ campaignId, customerIds }, { onSuccess: onDone })
        }}
      >
        {enrollSelected.isPending ? 'Enrolling…' : 'Enroll'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: The bulk configs**

Create `src/features/campaigns-admin/hooks/use-lead-bulk-action-configs.tsx`:

```tsx
'use client'

import type { EntityActionConfig, RowSelection } from '@/shared/components/entities/entity-actions/types'
import type { VoipCampaign } from '@/shared/entities/voip-campaigns/types'

import { useMemo } from 'react'

import { LEAD_BULK_ACTIONS } from '@/features/campaigns-admin/constants/lead-bulk-actions'
import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { BulkEnrollForm } from '@/features/campaigns-admin/ui/components/leads/bulk-enroll-form'
import { useConfirm } from '@/shared/hooks/use-confirm'

export function useLeadBulkActionConfigs(campaigns: VoipCampaign[]) {
  const { disqualifyBulk, markDnc, removeBulk } = useCampaignMutations()
  const [ConfirmDialog, confirm] = useConfirm({
    message: 'This affects every selected lead and stops/curates their dialer calls.',
    title: 'Apply to selected leads?',
  })

  const bulkActions = useMemo((): EntityActionConfig<RowSelection>[] => [
    {
      action: LEAD_BULK_ACTIONS.enroll,
      type: 'custom',
      renderContent: (selection, closeMenu) => (
        <BulkEnrollForm
          campaigns={campaigns}
          customerIds={selection.ids}
          onDone={() => {
            closeMenu()
            selection.clear()
          }}
        />
      ),
    },
    {
      action: LEAD_BULK_ACTIONS.remove,
      isLoading: removeBulk.isPending,
      onAction: selection => removeBulk.mutate({ customerIds: selection.ids }, { onSuccess: selection.clear }),
    },
    {
      action: LEAD_BULK_ACTIONS.disqualify,
      isLoading: disqualifyBulk.isPending,
      onAction: async (selection) => {
        if (await confirm()) {
          disqualifyBulk.mutate({ customerIds: selection.ids }, { onSuccess: selection.clear })
        }
      },
    },
    {
      action: LEAD_BULK_ACTIONS.markDnc,
      isLoading: markDnc.isPending,
      onAction: async (selection) => {
        if (await confirm()) {
          markDnc.mutate({ customerIds: selection.ids }, { onSuccess: selection.clear })
        }
      },
    },
  ], [campaigns, removeBulk, disqualifyBulk, markDnc, confirm])

  return { bulkActions, dialogs: <ConfirmDialog /> }
}
```

- [ ] **Step 4: The view and the columns**

In `src/features/campaigns-admin/ui/lib/leads-columns.tsx`: delete the `LeadSelectCell` / `LeadSelectHeader` imports, the `select` column object, and the `pageRowIds`, `selectedIds`, `toggleSelect`, `toggleSelectAll` fields of `LeadsTableMeta`.

In `src/features/campaigns-admin/ui/views/campaigns-leads-view.tsx`:
- delete the `LeadsBulkActionBar` import, the `selectedIds` state, `toggleSelect`, `toggleSelectAll`, `pageRowIds`, and those four fields in `meta` (and its deps);
- import `useLeadBulkActionConfigs` and add after the `campaigns` memo: `const { bulkActions, dialogs } = useLeadBulkActionConfigs(campaigns)`;
- pass `bulkActions={bulkActions}` to `<DataTable>`;
- replace the `<LeadsBulkActionBar … />` element with `{dialogs}`;
- the wrapper's `relative` class is no longer needed: `className="flex min-h-0 flex-1 flex-col gap-3"`.

`git rm` the four files listed under Delete, then run `grep -rn "lead-select-cell\|lead-select-header\|leads-bulk-action-bar\|bulk-enroll-popover\|LeadsBulkActionBar\|BulkEnrollPopover" src` → expected: no hits.

- [ ] **Step 5: Type-check and lint**

Run: `pnpm tsc && pnpm lint` → clean.

- [ ] **Step 6: Browser check (super-admin, read-only)**

On the campaigns admin Leads view: the name column carries the checkbox; ticking it does **not** open the lead drawer (Review Focus 2); clicking elsewhere on the row still opens it; the bar shows Enroll, Remove, Disqualify, Mark DNC, Clear; Enroll opens the campaign picker in place; Disqualify and Mark DNC ask to confirm — press Cancel. Paging clears the ticks (per-page selection, D41). No action runs unless the owner designates leads.

- [ ] **Step 7: Commit**

```bash
git add src/features/campaigns-admin/constants/lead-bulk-actions.ts src/features/campaigns-admin/ui/components/leads/bulk-enroll-form.tsx src/features/campaigns-admin/hooks/use-lead-bulk-action-configs.tsx src/features/campaigns-admin/ui/views/campaigns-leads-view.tsx src/features/campaigns-admin/ui/lib/leads-columns.tsx src/features/campaigns-admin/ui/components/leads/lead-select-cell.tsx src/features/campaigns-admin/ui/components/leads/lead-select-header.tsx src/features/campaigns-admin/ui/components/leads/leads-bulk-action-bar.tsx src/features/campaigns-admin/ui/components/leads/bulk-enroll-popover.tsx
git diff --cached --stat
git commit -m "refactor(campaigns): leads use the table's selection and bulk bar; the hand-rolled select column and bar go

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Phase B5 — projects (R4)

### Task 11: Projects on a field list; the projects entity table and records view

**Files:**
- Create: `src/shared/modules/projects/core/constants/status-labels.ts`
- Create: `src/shared/modules/projects/core/dal/project-fields.ts`
- Create: `src/shared/modules/projects/core/dal/server/project-field-sql.ts`
- Modify: `src/shared/modules/projects/core/dal/server/queries.ts` (`listProjects` and its input)
- Modify: `src/trpc/routers/projects.router/crud.router.ts:24-37`
- Modify: `src/features/agent-dashboard/constants/dashboard-queries.ts:10-25,76-91`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-project-section.tsx:3,16`
- Modify: `src/shared/modules/projects/core/lib/columns-registry.tsx`
- Create: `src/shared/modules/projects/core/components/projects-table/use-projects-table.tsx`
- Create: `src/features/records-management/constants/projects-records-table-view.ts`
- Create: `src/features/records-management/ui/views/projects-records-view.tsx`
- Modify: `src/app/(frontend)/dashboard/(records)/projects/page.tsx`
- Delete: `src/features/project-management/ui/components/table/index.tsx`, `src/features/project-management/ui/components/project-detail-sheet.tsx`, `src/features/project-management/constants/projects-table-query-config.ts`, `src/features/project-management/constants/project-table-filter-config.ts`

**Interfaces:**
- Produces: `PROJECT_STATUS_BUCKET_LABELS`, `PROJECT_VISIBILITY_LABELS`; `PROJECT_FIELDS` (sortable `title`, `city`, `visibility`, `completedAt`, `createdAt`; filters `statusBucket`, `visibility`, `completedAt`, `createdAt`; fixed `excludePortfolio`); `PROJECT_FIELD_SQL`; `projectListInputSchema` / `ProjectListInput` (replaces the hand-mirrored interface); `ProjectColumnKey`; `useProjectsTable(tableView, { renderExpandedRow? })` → `{ query, visibility, dataTableProps, dialogs }`; `ProjectsExpandedRowContext = { actions }`; `PROJECTS_RECORDS_TABLE_VIEW`; `ProjectsRecordsView`.

- [ ] **Step 1: Labels and the field list**

Create `src/shared/modules/projects/core/constants/status-labels.ts` (moved out of the legacy filter config):

```ts
import type { ProjectStatusBucket, ProjectVisibility } from '@/shared/constants/enums'

export const PROJECT_STATUS_BUCKET_LABELS: Record<ProjectStatusBucket, string> = {
  active: 'Active',
  completed: 'Completed',
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
}

export const PROJECT_VISIBILITY_LABELS: Record<ProjectVisibility, string> = {
  public: 'Public',
  draft: 'Draft',
}
```

Create `src/shared/modules/projects/core/dal/project-fields.ts`:

```ts
import z from 'zod'

import { projectStatusBuckets, projectVisibilities } from '@/shared/constants/enums'
import { dateRange, defineFieldList, fixedOnly, multiSelect, select } from '@/shared/dal/lib/query/field-list'
import { PROJECT_STATUS_BUCKET_LABELS, PROJECT_VISIBILITY_LABELS } from '@/shared/modules/projects/core/constants/status-labels'

/** Every filterable and sortable projects field; each id is both the URL key suffix and the read's filter/sort key. */
export const PROJECT_FIELDS = defineFieldList({
  title: { label: 'Project', sort: true },
  city: { label: 'Location', sort: true },
  statusBucket: { label: 'Status', filter: multiSelect({ values: projectStatusBuckets, optionLabel: bucket => PROJECT_STATUS_BUCKET_LABELS[bucket] }) },
  visibility: { label: 'Visibility', filter: select({ values: projectVisibilities, optionLabel: visibility => PROJECT_VISIBILITY_LABELS[visibility] }), sort: true },
  completedAt: { label: 'Completed', filter: dateRange(), sort: true },
  createdAt: { label: 'Created', filter: dateRange(), sort: true },
  // Showcase-only projects never ran the lifecycle; the dashboard's work counts drop them.
  excludePortfolio: { filter: fixedOnly(z.boolean()) },
})
```

- [ ] **Step 2: The field SQL**

Create `src/shared/modules/projects/core/dal/server/project-field-sql.ts`:

```ts
import { desc, eq, inArray, sql } from 'drizzle-orm'

import { stagesForBuckets } from '@/shared/constants/enums'
import { dateRangeCondition, defineFieldSql } from '@/shared/dal/server/lib/query/field-sql'
import { projects } from '@/shared/db/schema'
import { PROJECT_FIELDS } from '@/shared/modules/projects/core/dal/project-fields'
import { hasAssociatedMeeting } from '@/shared/modules/projects/core/lib/visibility'
import 'server-only'

export const PROJECT_FIELD_SQL = defineFieldSql(PROJECT_FIELDS, {
  filter: {
    // Null stage groups with Completed, as deriveProjectStatusBucket does.
    statusBucket: v => inArray(sql`coalesce(${projects.pipelineStage}, 'closed')`, stagesForBuckets(v)),
    visibility: v => eq(projects.isPublic, v === 'public'),
    completedAt: v => dateRangeCondition(projects.completedAt, v),
    createdAt: v => dateRangeCondition(projects.createdAt, v),
    excludePortfolio: v => (v ? hasAssociatedMeeting() : undefined),
  },
  sort: {
    title: projects.title,
    city: projects.city,
    visibility: projects.isPublic,
    completedAt: projects.completedAt,
    createdAt: projects.createdAt,
  },
}, { defaultOrder: [desc(projects.createdAt)], tieBreaker: projects.id })
```

- [ ] **Step 3: `listProjects` on the field list**

In `src/shared/modules/projects/core/dal/server/queries.ts`:
- delete the hand-mirrored `ProjectListInput` interface and its doc comment;
- above `listProjects` add:

```ts
export const projectListInputSchema = fieldListInput(PROJECT_FIELDS, { pagination: true })
export type ProjectListInput = z.infer<typeof projectListInputSchema>
```

- replace `listProjects`' doc comment with `/** The records table's and the agent dashboard's projects read. Each row carries its \`scopeIds\`, so a row resolves its trades without a per-row fetch. */` and the lines from `const scopeWhere = ctx.scope ?? undefined` through `const orderBy = buildOrderBy(…)` (inclusive) with:

```ts
    const where = and(
      ctx.scope ?? undefined,
      buildSearchWhere(input.search, [projects.title, projects.city]),
      PROJECT_FIELD_SQL.where(input.filters),
    )
    const orderBy = PROJECT_FIELD_SQL.orderBy(input.sort)
```

(the page, count and scope-row queries below stay as they are);
- imports: add `import type z from 'zod'`, `import { fieldListInput } from '@/shared/dal/server/lib/query/field-list-input'`, `import { buildSearchWhere } from '@/shared/dal/server/lib/query/search'`, `import { PROJECT_FIELDS } from '@/shared/modules/projects/core/dal/project-fields'`, `import { PROJECT_FIELD_SQL } from '@/shared/modules/projects/core/dal/server/project-field-sql'`; remove `buildFilterWhere`, `buildOrderBy`, `stagesForBuckets`, the `ProjectStatusBucket` / `ProjectVisibility` / `DateRange` / `PaginationFields` / `SortFields` type imports, and any `drizzle-orm` helper `pnpm lint` then reports unused.

The new search escapes `%` and `_` (`buildSearchWhere`); the old `ilike` did not.

- [ ] **Step 4: The router input and the dashboard builders**

In `src/trpc/routers/projects.router/crud.router.ts` replace the `list` procedure with:

```ts
  list: projectProcedure
    .input(projectListInputSchema)
    .query(async ({ ctx, input }) => dalToTrpc(await listProjects(ctx, input))),
```

import `projectListInputSchema` beside `listProjects`, and remove the imports left unused (`projectStatusBuckets`, `projectVisibilities`, `dateRangeSchema`, `paginatedQueryInput`).

In `src/features/agent-dashboard/constants/dashboard-queries.ts`: delete the `inferRouterInputs` / `AppRouter` type imports if nothing else uses them, delete the `ProjectsListInput` comment and type, add `import type { ProjectListInput } from '@/shared/modules/projects/core/dal/server/queries'`, and change both `satisfies ProjectsListInput` to `satisfies ProjectListInput`. In `dashboard-project-section.tsx` import `ProjectListInput` from the same path and type `input: ProjectListInput`.

- [ ] **Step 5: The registry is typed by the field list**

In `src/shared/modules/projects/core/lib/columns-registry.tsx`: add `import type { SortId } from '@/shared/dal/lib/query/field-list'` and `import type { PROJECT_FIELDS } from '@/shared/modules/projects/core/dal/project-fields'`; change the `isPublic` column's `sort: 'isPublic'` to `sort: 'visibility'`; change the closing line to `} as const satisfies ColumnRegistry<ProjectRow, SortId<typeof PROJECT_FIELDS>>` and append:

```ts
export type ProjectColumnKey = keyof typeof PROJECT_COLUMNS
```

- [ ] **Step 6: The entity table hook**

Create `src/shared/modules/projects/core/components/projects-table/use-projects-table.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'

import type { EntityTableView } from '@/shared/components/data-table/types/entity-table-view'
import type { DataTableProps } from '@/shared/components/data-table/ui/data-table'
import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { PROJECT_FIELDS } from '@/shared/modules/projects/core/dal/project-fields'
import type { ProjectColumnKey, ProjectRow, ProjectTableMeta } from '@/shared/modules/projects/core/lib/columns-registry'

import { useRouter } from 'next/navigation'
import { useCallback, useMemo } from 'react'

import { toDataTablePagination } from '@/shared/components/data-table/lib/to-data-table-pagination'
import { toDataTableSorting } from '@/shared/components/data-table/lib/to-data-table-sorting'
import { useColumnVisibility } from '@/shared/components/data-table/lib/use-column-visibility'
import { useEntityColumns } from '@/shared/components/data-table/lib/use-entity-columns'
import { ROOTS } from '@/shared/config/roots'
import { useDataViewQuery } from '@/shared/dal/client/hooks/use-data-view-query'
import { useProjectActionConfigs } from '@/shared/modules/projects/core/hooks/use-project-action-configs'
import { PROJECT_COLUMNS } from '@/shared/modules/projects/core/lib/columns-registry'
import { useTRPC } from '@/trpc/helpers'

export interface ProjectsExpandedRowContext {
  actions: EntityActionConfig<ProjectRow>[]
}

export interface UseProjectsTableOptions {
  renderExpandedRow?: (row: ProjectRow, ctx: ProjectsExpandedRowContext) => ReactNode
}

export function useProjectsTable(
  tableView: EntityTableView<ProjectColumnKey, typeof PROJECT_FIELDS>,
  { renderExpandedRow }: UseProjectsTableOptions = {},
) {
  const trpc = useTRPC()
  const router = useRouter()
  const query = useDataViewQuery(trpc.projectsRouter.crud.list, {}, tableView.query)

  const { actions, DeleteConfirmDialog } = useProjectActionConfigs<ProjectRow>()

  const columns = useEntityColumns(PROJECT_COLUMNS, { show: tableView.columns })
  const visibility = useColumnVisibility(tableView.tableId, columns)

  const meta = useMemo<ProjectTableMeta>(() => ({ projectActions: () => actions }), [actions])

  const openProject = useCallback((row: ProjectRow) => router.push(ROOTS.dashboard.projects.byId(row.id)), [router])

  const expandedRowRenderer = useMemo(
    () => renderExpandedRow ? (row: ProjectRow) => renderExpandedRow(row, { actions }) : undefined,
    [renderExpandedRow, actions],
  )

  const dataTableProps = {
    tableId: tableView.tableId,
    data: query.rows,
    columns,
    meta,
    entityName: 'project',
    rowDataAttribute: 'data-project-row',
    renderExpandedRow: expandedRowRenderer,
    // Without an expanded row, a row click opens the project.
    onRowClick: expandedRowRenderer ? undefined : openProject,
    serverPagination: toDataTablePagination(query),
    serverSorting: toDataTableSorting(query),
    columnVisibility: visibility.columnVisibility,
  } satisfies DataTableProps<ProjectRow, ProjectTableMeta>

  return { query, visibility, dataTableProps, dialogs: <DeleteConfirmDialog /> }
}
```

- [ ] **Step 7: The table view, the records view, the page**

Create `src/features/records-management/constants/projects-records-table-view.ts`:

```ts
import type { EntityTableView } from '@/shared/components/data-table/types/entity-table-view'
import type { ProjectColumnKey } from '@/shared/modules/projects/core/lib/columns-registry'

import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'
import { PROJECT_FIELDS } from '@/shared/modules/projects/core/dal/project-fields'

export const PROJECTS_RECORDS_TABLE_VIEW = {
  tableId: 'projects',
  query: {
    fields: PROJECT_FIELDS,
    paramPrefix: 'pj',
    toolbar: ['statusBucket', 'visibility', 'completedAt', 'createdAt'],
    window: { kind: 'page', pageSize: 20, pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS },
  },
  columns: ['title', 'city', 'isPublic', 'completedAt', 'createdAt'],
} as const satisfies EntityTableView<ProjectColumnKey, typeof PROJECT_FIELDS>
```

Create `src/features/records-management/ui/views/projects-records-view.tsx`:

```tsx
'use client'

import { PlusIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { PROJECTS_RECORDS_TABLE_VIEW } from '@/features/records-management/constants/projects-records-table-view'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { RecordsPageHeader } from '@/shared/components/records-page-header'
import { RecordsPageMotionShell } from '@/shared/components/records-page-motion-shell'
import { RecordsPageShell } from '@/shared/components/records-page-shell'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'
import { useProjectsTable } from '@/shared/modules/projects/core/components/projects-table/use-projects-table'

export function ProjectsRecordsView() {
  const router = useRouter()
  const { query, visibility, dataTableProps, dialogs } = useProjectsTable(PROJECTS_RECORDS_TABLE_VIEW)

  return (
    <RecordsPageMotionShell>
      {dialogs}
      <RecordsPageShell
        header={(
          <RecordsPageHeader
            title="Projects"
            query={query}
            actions={(
              <Button size="sm" onClick={() => router.push(ROOTS.dashboard.projects.new())}>
                <PlusIcon className="mr-2 h-4 w-4" />
                New Project
              </Button>
            )}
          />
        )}
        toolbar={(
          <QueryToolbar query={query} entityName="projects">
            <QueryToolbar.Standard searchPlaceholder="Search by title or city…" visibility={visibility} />
          </QueryToolbar>
        )}
        table={<DataTable {...dataTableProps} />}
      />
    </RecordsPageMotionShell>
  )
}
```

Replace `src/app/(frontend)/dashboard/(records)/projects/page.tsx` with the meetings page's shape:

```tsx
import type { SearchParams } from 'nuqs/server'

import { PROJECTS_RECORDS_TABLE_VIEW } from '@/features/records-management/constants/projects-records-table-view'
import { ProjectsRecordsView } from '@/features/records-management/ui/views/projects-records-view'
import { loadDataViewQueryInput } from '@/shared/dal/server/lib/query/load-data-view-query-input'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'
import { HydrateClient } from '@/trpc/components/hydrate-client'
import { prefetch } from '@/trpc/lib/prefetch'
import { trpc } from '@/trpc/server'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<SearchParams>
}

export default async function ProjectsPage({ searchParams }: Props) {
  const authState = await protectDashboardPage()

  // Unauthenticated visitors get the layout's sign-in screen; skip the
  // prefetch work.
  if (authState.status === 'authenticated') {
    const input = await loadDataViewQueryInput(searchParams, PROJECTS_RECORDS_TABLE_VIEW.query)
    prefetch(trpc.projectsRouter.crud.list.queryOptions(input))
  }

  return (
    <HydrateClient>
      <ProjectsRecordsView />
    </HydrateClient>
  )
}
```

- [ ] **Step 8: Delete the legacy table**

`git rm` the four files listed under Delete. Run `grep -rn "PortfolioProjectsTable\|ProjectDetailSheet\|PROJECTS_TABLE_QUERY_CONFIG\|PROJECT_FILTER_CONFIG\|project-detail-sheet\|projects-table-query-config\|project-table-filter-config" src` → expected: no hits.

- [ ] **Step 9: Type-check, lint, browser read check**

Run: `pnpm tsc && pnpm lint` → clean.

Browser (super-admin): `/dashboard/projects` loads with the same five columns; the Status, Visibility, Completed and Created filters narrow the list; clicking a sortable header sorts (Visibility too); "New Project" navigates; a row click opens the project page; reloading with filters in the URL hydrates without a refetch flash. The agent dashboard's Active and On Hold project sections still list projects.

- [ ] **Step 10: Commit**

```bash
git add src/shared/modules/projects/core/constants/status-labels.ts src/shared/modules/projects/core/dal/project-fields.ts src/shared/modules/projects/core/dal/server/project-field-sql.ts src/shared/modules/projects/core/dal/server/queries.ts src/trpc/routers/projects.router/crud.router.ts src/features/agent-dashboard/constants/dashboard-queries.ts src/features/agent-dashboard/ui/components/dashboard-project-section.tsx src/shared/modules/projects/core/lib/columns-registry.tsx src/shared/modules/projects/core/components/projects-table/use-projects-table.tsx src/features/records-management/constants/projects-records-table-view.ts src/features/records-management/ui/views/projects-records-view.tsx "src/app/(frontend)/dashboard/(records)/projects/page.tsx" src/features/project-management/ui/components/table/index.tsx src/features/project-management/ui/components/project-detail-sheet.tsx src/features/project-management/constants/projects-table-query-config.ts src/features/project-management/constants/project-table-filter-config.ts
git diff --cached --stat
git commit -m "feat(projects): projects on a field list; the projects entity table and records view replace the portfolio table and sheet

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Shared panel pieces — `useCustomerProfile`, `RecordCustomerPane`, `ProjectMeetingList`

**Files:**
- Create: `src/shared/entities/customers/hooks/use-customer-profile.ts`
- Modify: `src/features/records-management/hooks/use-meeting-row-panel-data.ts`
- Modify: `src/shared/entities/customers/components/profile/customer-profile-modal.tsx:28-30`
- Modify: `src/shared/entities/meetings/components/create-meeting-form.tsx:58-62`
- Create: `src/features/records-management/ui/components/record-customer-pane.tsx`
- Delete: `src/features/records-management/ui/components/meeting-row-panel/meeting-customer-pane.tsx`
- Modify: `src/features/records-management/ui/components/meeting-row-panel/index.tsx`
- Create: `src/shared/entities/customers/components/lists/project-meeting-list.tsx`
- Modify: `src/shared/entities/customers/components/lists/project-entity-card.tsx`

**Interfaces:**
- Produces: `useCustomerProfile(customerId: string | null | undefined)` (the `getCustomerProfile` query, disabled without an id); `RecordCustomerPane({ customer, isLoading, leadSource? })`; `ProjectMeetingList({ customerId, meetings, onMutationSuccess, onNavigate?, onAssignRep?, highlightMeetingId? })`. No behaviour change.

- [ ] **Step 1: The profile hook, adopted by its callers**

Create `src/shared/entities/customers/hooks/use-customer-profile.ts`:

```ts
'use client'

import { useQuery } from '@tanstack/react-query'

import { useTRPC } from '@/trpc/helpers'

/** One query key for the customer profile, so every surface that opens a customer shares the cache. */
export function useCustomerProfile(customerId: string | null | undefined) {
  const trpc = useTRPC()
  return useQuery({
    ...trpc.customerPipelinesRouter.getCustomerProfile.queryOptions({ customerId: customerId ?? '' }),
    enabled: !!customerId,
  })
}
```

- `use-meeting-row-panel-data.ts`: replace the `trpc` / `customerId` / `useQuery` lines with `const profile = useCustomerProfile(meeting.customerId)`; drop the now-unused imports.
- `customer-profile-modal.tsx`: `const profileQuery = useCustomerProfile(customerId)`; remove `useQuery` / `useTRPC` only if nothing else in the file uses them.
- `create-meeting-form.tsx`: `const profileQuery = useCustomerProfile(isProjectType ? customerId : null)`.

- [ ] **Step 2: `RecordCustomerPane`**

Create `src/features/records-management/ui/components/record-customer-pane.tsx`:

```tsx
'use client'

import type { CustomerOverviewCardData } from '@/shared/entities/customers/components/overview-card'
import type { LeadSourceOverviewCardSource } from '@/shared/entities/lead-sources/components/overview-card'

import { ExpandedRowPanel } from '@/shared/components/data-table/ui/expanded-row-panel'
import { CustomerOverviewCard } from '@/shared/entities/customers/components/overview-card'

interface RecordCustomerPaneProps {
  customer: CustomerOverviewCardData | null
  isLoading: boolean
  /** Only rows that carry their lead source pass it (meetings do; proposals and projects don't). */
  leadSource?: LeadSourceOverviewCardSource | null
}

export function RecordCustomerPane({ customer, isLoading, leadSource = null }: RecordCustomerPaneProps) {
  return (
    <ExpandedRowPanel.Pane title="Customer" isLoading={isLoading}>
      {!customer
        ? <p className="text-sm text-muted-foreground">No customer linked</p>
        : (
            <CustomerOverviewCard customer={customer} leadSource={leadSource}>
              <CustomerOverviewCard.ContactActions />
              <CustomerOverviewCard.LeadSource />
              <CustomerOverviewCard.Insights />
              <CustomerOverviewCard.ProfileFields />
            </CustomerOverviewCard>
          )}
    </ExpandedRowPanel.Pane>
  )
}
```

A row with no customer never enables the query (`isLoading` stays false, `customer` stays null), so `hasCustomer` is gone. In `meeting-row-panel/index.tsx` replace the `MeetingCustomerPane` import and element with:

```tsx
          <RecordCustomerPane customer={customer} isLoading={profile.isLoading} leadSource={meeting.leadSource} />
```

and `git rm src/features/records-management/ui/components/meeting-row-panel/meeting-customer-pane.tsx`.

- [ ] **Step 3: `ProjectMeetingList`**

Create `src/shared/entities/customers/components/lists/project-meeting-list.tsx` holding the meetings block of `ProjectEntityCard` (its `project.meetings.map(…)` list, unchanged):

```tsx
'use client'

import type { CustomerProfileProject, CustomerProfileProposal } from '@/shared/entities/customers/types'

import { PlusIcon } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { ROOTS } from '@/shared/config/roots'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { MeetingProposalRow } from '@/shared/entities/meetings/components/meeting-proposal-row'
import { MeetingOverviewCard } from '@/shared/entities/meetings/components/overview-card'
import { ParticipantsSlot } from '@/shared/entities/meetings/components/participants-slot'
import { cn } from '@/shared/lib/utils'

interface ProjectMeetingListProps {
  customerId: string
  meetings: CustomerProfileProject['meetings']
  onMutationSuccess: () => void
  onNavigate?: () => void
  onAssignRep?: (meetingId: string, currentRepId: string | null) => void
  highlightMeetingId?: string
}

export function ProjectMeetingList({ customerId, meetings, onMutationSuccess, onNavigate, onAssignRep, highlightMeetingId }: ProjectMeetingListProps) {
  const ability = useAbility()
  const canCreateProposal = ability.can('create', 'Proposal')

  return (
    <div className="space-y-2.5">
      {meetings.map(meeting => (
        <Card key={meeting.id} className={cn('group pt-0 pb-0 gap-0', meeting.id === highlightMeetingId && 'outline-2 outline-primary -outline-offset-2 shadow-sm')}>
          <CardContent className="p-0">
            <MeetingOverviewCard
              meeting={meeting}
              customerId={customerId}
              onAssignOwner={onAssignRep ? () => onAssignRep(meeting.id, meeting.ownerId ?? null) : undefined}
            >
              <MeetingOverviewCard.Header className="px-3 py-2">
                <MeetingOverviewCard.Fields fields={[
                  { field: 'scheduledDate' },
                  { field: 'type' },
                  { field: 'outcome' },
                  { field: 'proposalCount' },
                ]}
                />
                <MeetingOverviewCard.CreatedAt />
                <MeetingOverviewCard.Actions mode="compact" className="ml-auto opacity-60 hover:opacity-100 transition-opacity" />
              </MeetingOverviewCard.Header>
              <div className="grid grid-cols-1 border-t divide-y md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] md:divide-y-0 md:divide-x">
                <div className="p-3">
                  <ParticipantsSlot meetingId={meeting.id} variant="full" entityListVariant="flush" />
                </div>
                <div className="p-3">
                  <MeetingOverviewCard.Proposals
                    showHeader
                    entityListVariant="flush"
                    emptyStateAction={canCreateProposal && (
                      <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" asChild>
                        <a href={`${ROOTS.dashboard.proposals.new()}?meetingId=${meeting.id}`}>
                          <PlusIcon className="size-3" />
                          Create proposal
                        </a>
                      </Button>
                    )}
                    renderProposal={p => (
                      <MeetingProposalRow
                        key={p.id}
                        proposal={p as CustomerProfileProposal}
                        onMutationSuccess={onMutationSuccess}
                        onNavigate={onNavigate}
                      />
                    )}
                  />
                </div>
              </div>
            </MeetingOverviewCard>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

In `project-entity-card.tsx` replace the `<div className="space-y-2.5">…</div>` inside the "Meetings within this project" block with:

```tsx
              <ProjectMeetingList
                customerId={customerId}
                meetings={project.meetings}
                onMutationSuccess={onMutationSuccess}
                onNavigate={onNavigate}
                onAssignRep={onAssignRep}
                highlightMeetingId={highlightMeetingId}
              />
```

import it, and remove the imports `pnpm lint` then reports unused (`PlusIcon`, `Button`, `MeetingProposalRow`, `MeetingOverviewCard`, `ParticipantsSlot`, `CustomerProfileProposal`, and `canCreateProposal` / `useAbility` if nothing else uses them).

- [ ] **Step 4: Type-check, lint, browser read check (no behaviour change)**

Run: `pnpm tsc && pnpm lint` → clean.

Browser: a meetings row's expanded Customer pane looks as before (lead source line included); a meeting without a customer says "No customer linked"; the customer profile modal's projects list renders its meetings and proposals as before; "Add meeting" with type Project still lists the customer's projects.

- [ ] **Step 5: Commit**

```bash
git add src/shared/entities/customers/hooks/use-customer-profile.ts src/features/records-management/hooks/use-meeting-row-panel-data.ts src/shared/entities/customers/components/profile/customer-profile-modal.tsx src/shared/entities/meetings/components/create-meeting-form.tsx src/features/records-management/ui/components/record-customer-pane.tsx src/features/records-management/ui/components/meeting-row-panel/meeting-customer-pane.tsx src/features/records-management/ui/components/meeting-row-panel/index.tsx src/shared/entities/customers/components/lists/project-meeting-list.tsx src/shared/entities/customers/components/lists/project-entity-card.tsx
git diff --cached --stat
git commit -m "refactor(records): one customer-profile hook; the customer pane and a project's meeting list become shared pieces

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Project actions and the projects expanded row

**Files:**
- Modify: `src/shared/modules/projects/core/constants/actions.ts`
- Modify: `src/shared/modules/projects/core/hooks/use-project-actions.ts`
- Modify: `src/shared/modules/projects/core/hooks/use-project-action-configs.ts`
- Modify: `src/shared/entities/customers/components/lists/project-entity-card.tsx:38-41`
- Create: `src/features/records-management/ui/components/project-row-panel/index.tsx`
- Create: `src/features/records-management/ui/components/project-row-panel/project-row-action-bar.tsx`
- Create: `src/features/records-management/ui/components/project-row-panel/project-row-details.tsx`
- Create: `src/features/records-management/ui/components/project-row-panel/project-scopes-pane.tsx`
- Create: `src/features/records-management/ui/components/project-row-panel/project-sales-history-pane.tsx`
- Modify: `src/features/records-management/ui/views/projects-records-view.tsx`

**Interfaces:**
- Consumes: `hidden` + `getVisibleActions` (Task 7); `useCustomerProfile`, `RecordCustomerPane`, `ProjectMeetingList` (Task 12); `useProjectsTable` (Task 11); `PROJECT_STATUS_BUCKET_LABELS`.
- Produces: `PROJECT_ACTIONS.edit` = "Open Project" (primary), `PROJECT_ACTIONS.view` = "View on Site", new `showOnPortfolio` / `hideFromPortfolio`; `useProjectActions().setPortfolioVisibility`; `ProjectEntity.isPublic?`; `ProjectRowPanel({ project, actions })`.

- [ ] **Step 1: The actions**

Replace `PROJECT_ACTIONS` in `src/shared/modules/projects/core/constants/actions.ts` (icons: `CopyIcon, ExternalLinkIcon, EyeIcon, EyeOffIcon, FolderOpenIcon, TrashIcon`):

```ts
export const PROJECT_ACTIONS = {
  edit: {
    id: 'edit',
    label: 'Open Project',
    icon: FolderOpenIcon,
    permission: ['update', 'Project'],
    primary: true,
  },
  view: {
    id: 'view',
    label: 'View on Site',
    icon: ExternalLinkIcon,
    permission: ['read', 'Project'],
  },
  showOnPortfolio: {
    id: 'showOnPortfolio',
    label: 'Show on Portfolio',
    icon: EyeIcon,
    permission: ['update', 'Project'],
  },
  hideFromPortfolio: {
    id: 'hideFromPortfolio',
    label: 'Hide from Portfolio',
    icon: EyeOffIcon,
    permission: ['update', 'Project'],
  },
  duplicate: {
    id: 'duplicate',
    label: 'Duplicate',
    icon: CopyIcon,
    permission: ['create', 'Project'],
    separatorBefore: true,
  },
  delete: {
    id: 'delete',
    label: 'Delete',
    icon: TrashIcon,
    permission: ['delete', 'Project'],
    destructive: true,
    separatorBefore: true,
  },
} as const satisfies Record<string, EntityAction>
```

- [ ] **Step 2: The mutation and the configs**

In `use-project-actions.ts` add before the `return`:

```ts
  const setPortfolioVisibility = useMutation(trpc.projectsRouter.crud.update.mutationOptions({
    onSuccess: (project) => {
      invalidateProject()
      toast.success(project.isPublic ? 'Shown on portfolio' : 'Hidden from portfolio')
    },
    onError: err => toast.error(err.message || 'Failed to change portfolio visibility'),
  }))
```

and return `{ deleteProject, setPortfolioVisibility }`.

In `use-project-action-configs.ts`:
- `ProjectEntity` gains `/** Absent where the caller's row doesn't carry it (the customer profile); the portfolio actions then stay hidden. */ isPublic?: boolean`;
- destructure `setPortfolioVisibility` beside `deleteProject`;
- the configs become (order: open, site, portfolio, delete):

```ts
  const actions = useMemo((): EntityActionConfig<T>[] => [
    {
      action: PROJECT_ACTIONS.edit,
      onAction: overrides.onEdit ?? defaultEdit,
    },
    {
      action: PROJECT_ACTIONS.view,
      onAction: overrides.onView ?? defaultView,
      // A draft's public page is a 404.
      hidden: entity => entity.isPublic !== true,
    },
    {
      action: PROJECT_ACTIONS.showOnPortfolio,
      onAction: entity => setPortfolioVisibility.mutate({ id: entity.id, data: { isPublic: true } }),
      isLoading: setPortfolioVisibility.isPending,
      hidden: entity => entity.isPublic !== false,
    },
    {
      action: PROJECT_ACTIONS.hideFromPortfolio,
      onAction: entity => setPortfolioVisibility.mutate({ id: entity.id, data: { isPublic: false } }),
      isLoading: setPortfolioVisibility.isPending,
      hidden: entity => entity.isPublic !== true,
    },
    {
      action: PROJECT_ACTIONS.delete,
      onAction: async (entity) => {
        const ok = await confirmDelete()
        if (ok) {
          deleteProject.mutate({ id: entity.id })
        }
      },
      isLoading: deleteProject.isPending,
    },
  ], [overrides.onView, overrides.onEdit, deleteProject, setPortfolioVisibility, confirmDelete])
```

In `project-entity-card.tsx` change the configs call to `useProjectActionConfigs({ onEdit: handleViewProject })` (its `onView` override would open the dashboard under "View on Site").

- [ ] **Step 3: The expanded row**

Create `src/features/records-management/ui/components/project-row-panel/project-row-action-bar.tsx`:

```tsx
'use client'

import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { ProjectRow } from '@/shared/modules/projects/core/lib/columns-registry'

import { useMemo } from 'react'

import { withToolbarRoles } from '@/shared/components/entities/entity-actions/lib/with-toolbar-roles'
import { EntityActionMenu } from '@/shared/components/entities/entity-actions/ui/entity-action-menu'

interface ProjectRowActionBarProps {
  project: ProjectRow
  actions: EntityActionConfig<ProjectRow>[]
}

export function ProjectRowActionBar({ project, actions }: ProjectRowActionBarProps) {
  const toolbarActions = useMemo(
    () => withToolbarRoles(actions, { primaryId: 'edit', promotedIds: ['showOnPortfolio', 'hideFromPortfolio', 'view'] }),
    [actions],
  )
  return <EntityActionMenu entity={project} actions={toolbarActions} mode="toolbar" />
}
```

Create `project-row-details.tsx`:

```tsx
'use client'

import type { ProjectRow } from '@/shared/modules/projects/core/lib/columns-registry'

import { format } from 'date-fns'

import { Badge } from '@/shared/components/ui/badge'
import { deriveProjectStatusBucket } from '@/shared/constants/enums/pipelines'
import { cn } from '@/shared/lib/utils'
import { PROJECT_STATUS_BUCKET_LABELS } from '@/shared/modules/projects/core/constants/status-labels'

export function ProjectRowDetails({ project }: { project: ProjectRow }) {
  const location = project.state ? `${project.city}, ${project.state}` : project.city
  return (
    <>
      <Badge className={cn('text-xs', project.isPublic ? 'bg-emerald-500/15 text-emerald-700' : 'bg-muted text-muted-foreground')}>
        {project.isPublic ? 'Public' : 'Draft'}
      </Badge>
      <span className="font-medium text-foreground">{PROJECT_STATUS_BUCKET_LABELS[deriveProjectStatusBucket(project.pipelineStage)]}</span>
      {project.pipelineStage && <span>{project.pipelineStage.replace(/_/g, ' ')}</span>}
      {location && <span>{location}</span>}
      {project.completedAt && <span>{`Completed ${format(new Date(project.completedAt), 'MMM d, yyyy')}`}</span>}
    </>
  )
}
```

Create `project-scopes-pane.tsx`:

```tsx
'use client'

import type { ProjectRow } from '@/shared/modules/projects/core/lib/columns-registry'

import { useMemo } from 'react'

import { ExpandedRowPanel } from '@/shared/components/data-table/ui/expanded-row-panel'
import { useConstructionCatalog } from '@/shared/modules/construction/core/hooks/use-construction-catalog'
import { resolveScopes } from '@/shared/modules/construction/core/lib/resolve-catalog-ids'

export function ProjectScopesPane({ project }: { project: ProjectRow }) {
  const catalog = useConstructionCatalog()
  const trades = useMemo(() => {
    const scopesByTrade = new Map<string, string[]>()
    for (const scope of resolveScopes(project.scopeIds, catalog).found) {
      scopesByTrade.set(scope.tradeId, [...(scopesByTrade.get(scope.tradeId) ?? []), scope.name])
    }
    return [...scopesByTrade].map(([tradeId, scopes]) => ({ tradeId, name: catalog.tradesById.get(tradeId)?.name ?? 'Unknown trade', scopes }))
  }, [project.scopeIds, catalog])

  return (
    <ExpandedRowPanel.Pane title="Trades and scopes" isLoading={catalog.isLoading}>
      {trades.length === 0
        ? <p className="text-sm text-muted-foreground">No scopes recorded</p>
        : (
            <ul className="flex flex-col gap-2">
              {trades.map(trade => (
                <li key={trade.tradeId}>
                  <span className="text-sm font-medium">{trade.name}</span>
                  <span className="block text-xs text-muted-foreground">{trade.scopes.join(', ')}</span>
                </li>
              ))}
            </ul>
          )}
    </ExpandedRowPanel.Pane>
  )
}
```

Create `project-sales-history-pane.tsx`:

```tsx
'use client'

import type { CustomerProfileProject } from '@/shared/entities/customers/types'

import { ExpandedRowPanel } from '@/shared/components/data-table/ui/expanded-row-panel'
import { ProjectMeetingList } from '@/shared/entities/customers/components/lists/project-meeting-list'

interface ProjectSalesHistoryPaneProps {
  customerId: string | null
  meetings: CustomerProfileProject['meetings']
  isLoading: boolean
  onMutationSuccess: () => void
  className?: string
}

export function ProjectSalesHistoryPane({ customerId, meetings, isLoading, onMutationSuccess, className }: ProjectSalesHistoryPaneProps) {
  return (
    <ExpandedRowPanel.Pane title="Sales history" isLoading={isLoading} className={className}>
      {!customerId || meetings.length === 0
        ? <p className="text-sm text-muted-foreground">No meetings linked to this project</p>
        : <ProjectMeetingList customerId={customerId} meetings={meetings} onMutationSuccess={onMutationSuccess} />}
    </ExpandedRowPanel.Pane>
  )
}
```

Create `index.tsx`:

```tsx
'use client'

import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { ProjectRow } from '@/shared/modules/projects/core/lib/columns-registry'

import { useMemo } from 'react'

import { ProjectRowActionBar } from '@/features/records-management/ui/components/project-row-panel/project-row-action-bar'
import { ProjectRowDetails } from '@/features/records-management/ui/components/project-row-panel/project-row-details'
import { ProjectSalesHistoryPane } from '@/features/records-management/ui/components/project-row-panel/project-sales-history-pane'
import { ProjectScopesPane } from '@/features/records-management/ui/components/project-row-panel/project-scopes-pane'
import { RecordCustomerPane } from '@/features/records-management/ui/components/record-customer-pane'
import { ExpandedRowPanel } from '@/shared/components/data-table/ui/expanded-row-panel'
import { useCustomerProfile } from '@/shared/entities/customers/hooks/use-customer-profile'

interface ProjectRowPanelProps {
  project: ProjectRow
  actions: EntityActionConfig<ProjectRow>[]
}

export function ProjectRowPanel({ project, actions }: ProjectRowPanelProps) {
  const profile = useCustomerProfile(project.customerId)

  const meetings = useMemo(() => {
    const linked = profile.data?.projects.find(p => p.id === project.id)?.meetings ?? []
    const soldIt = (meeting: (typeof linked)[number]) => meeting.proposals.some(proposal => proposal.status === 'approved')
    // The meeting that sold the project leads.
    return [...linked].sort((a, b) => Number(soldIt(b)) - Number(soldIt(a)))
  }, [profile.data, project.id])

  return (
    <ExpandedRowPanel>
      <ExpandedRowPanel.ActionBar>
        <ProjectRowActionBar project={project} actions={actions} />
      </ExpandedRowPanel.ActionBar>
      <ExpandedRowPanel.Details>
        <ProjectRowDetails project={project} />
      </ExpandedRowPanel.Details>
      {profile.isError && (
        <ExpandedRowPanel.Error
          title="Couldn't load this project's customer"
          description="Trades and scopes still show; retry to load the customer and sales history."
          onRetry={() => void profile.refetch()}
        />
      )}
      {/* Scopes come from the row itself, so a failed profile read hides only the panes that need it. */}
      <ExpandedRowPanel.Panes className={profile.isError ? undefined : '@min-[600px]:grid-cols-2 @min-[900px]:grid-cols-[250px_minmax(0,1fr)_minmax(0,1.15fr)]'}>
        {!profile.isError && <RecordCustomerPane customer={profile.data?.customer ?? null} isLoading={profile.isLoading} />}
        <ProjectScopesPane project={project} />
        {!profile.isError && (
          <ProjectSalesHistoryPane
            customerId={project.customerId}
            meetings={meetings}
            isLoading={profile.isLoading}
            onMutationSuccess={() => void profile.refetch()}
            className="@min-[600px]:col-span-2 @min-[900px]:col-span-1"
          />
        )}
      </ExpandedRowPanel.Panes>
    </ExpandedRowPanel>
  )
}
```

In `projects-records-view.tsx` add the imports `import type { ProjectsExpandedRowContext } from '@/shared/modules/projects/core/components/projects-table/use-projects-table'`, `import type { ProjectRow } from '@/shared/modules/projects/core/lib/columns-registry'`, `import { ProjectRowPanel } from '@/features/records-management/ui/components/project-row-panel'`, add above the component:

```tsx
// Module level keeps its identity stable, so the table's props don't churn.
function renderProjectRowPanel(row: ProjectRow, { actions }: ProjectsExpandedRowContext) {
  return <ProjectRowPanel project={row} actions={actions} />
}
```

and pass it: `useProjectsTable(PROJECTS_RECORDS_TABLE_VIEW, { renderExpandedRow: renderProjectRowPanel })`.

- [ ] **Step 4: Type-check, lint, browser read check**

Run: `pnpm tsc && pnpm lint` → clean.

Browser (super-admin, then agent): on `/dashboard/projects` a row click expands the row. A draft project's bar shows Open Project, Show on Portfolio and More (Delete); a public one shows Open Project, Hide from Portfolio, View on Site. Details show public/draft, status, stage, location, completed date. Panes: Customer (none for a pure-portfolio project), Trades and scopes, Sales history (the project's meetings, the approved one first). The customer profile modal's project card menu shows Open Project and Delete only. As an agent the same bar shows (Show/Hide included — they can already toggle Public on the edit form), without Delete. Toggling visibility is a write: only on a project the owner designates.

- [ ] **Step 5: Commit**

```bash
git add src/shared/modules/projects/core/constants/actions.ts src/shared/modules/projects/core/hooks/use-project-actions.ts src/shared/modules/projects/core/hooks/use-project-action-configs.ts src/shared/entities/customers/components/lists/project-entity-card.tsx src/features/records-management/ui/components/project-row-panel/index.tsx src/features/records-management/ui/components/project-row-panel/project-row-action-bar.tsx src/features/records-management/ui/components/project-row-panel/project-row-details.tsx src/features/records-management/ui/components/project-row-panel/project-scopes-pane.tsx src/features/records-management/ui/components/project-row-panel/project-sales-history-pane.tsx src/features/records-management/ui/views/projects-records-view.tsx
git diff --cached --stat
git commit -m "feat(projects): expanded row with customer, scopes and sales history; show or hide on the portfolio per row

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Projects bulk actions

**Files:**
- Create: `src/shared/modules/projects/core/constants/bulk-skip-labels.ts`
- Modify: `src/shared/modules/projects/core/hooks/use-project-actions.ts`
- Create: `src/shared/modules/projects/core/hooks/use-project-bulk-action-configs.tsx`
- Modify: `src/shared/modules/projects/core/components/projects-table/use-projects-table.tsx`

**Interfaces:**
- Consumes: `projectsRouter.bulk.{delete,update}` (Task 6); `toastBulkActionResult`, `BULK_NOT_FOUND_LABELS`, `BULK_ACTION_PERMISSION` (Tasks 7, 9).
- Produces: `PROJECT_BULK_DELETE_SKIP_LABELS`; `useProjectActions()` gains `bulkDeleteProjects`, `bulkSetPortfolioVisibility`; `useProjectBulkActionConfigs(): { bulkActions, dialogs }`.

- [ ] **Step 1: Labels and mutations**

Create `src/shared/modules/projects/core/constants/bulk-skip-labels.ts`:

```ts
import type { AppRouterOutputs } from '@/trpc/routers/app'

import { BULK_NOT_FOUND_LABELS } from '@/shared/components/entities/entity-actions/constants/bulk-skip-labels'

type ProjectBulkDeleteSkip = AppRouterOutputs['projectsRouter']['bulk']['delete']['skipped'][number]['reason']

export const PROJECT_BULK_DELETE_SKIP_LABELS = {
  ...BULK_NOT_FOUND_LABELS,
  onPortfolio: 'on the portfolio',
  linkedToMeeting: 'linked to a meeting',
} as const satisfies Record<ProjectBulkDeleteSkip, string>
```

In `use-project-actions.ts` add the imports for `toastBulkActionResult`, `BULK_NOT_FOUND_LABELS`, `PROJECT_BULK_DELETE_SKIP_LABELS`, and before the `return`:

```ts
  const bulkDeleteProjects = useMutation(trpc.projectsRouter.bulk.delete.mutationOptions({
    onSuccess: (result) => {
      invalidateProject()
      toastBulkActionResult(result, 'Deleted', PROJECT_BULK_DELETE_SKIP_LABELS)
    },
    onError: err => toast.error(err.message || 'Failed to delete projects'),
  }))

  const bulkSetPortfolioVisibility = useMutation(trpc.projectsRouter.bulk.update.mutationOptions({
    onSuccess: (result) => {
      invalidateProject()
      toastBulkActionResult(result, 'Updated', BULK_NOT_FOUND_LABELS)
    },
    onError: err => toast.error(err.message || 'Failed to change portfolio visibility'),
  }))
```

returning `{ deleteProject, setPortfolioVisibility, bulkDeleteProjects, bulkSetPortfolioVisibility }`.

- [ ] **Step 2: The bulk configs**

Create `src/shared/modules/projects/core/hooks/use-project-bulk-action-configs.tsx`:

```tsx
'use client'

import type { EntityActionConfig, RowSelection } from '@/shared/components/entities/entity-actions/types'

import { useMemo, useState } from 'react'

import { BULK_ACTION_PERMISSION } from '@/shared/components/entities/entity-actions/constants/bulk-action-permission'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { PROJECT_ACTIONS } from '@/shared/modules/projects/core/constants/actions'

import { useProjectActions } from './use-project-actions'

export function useProjectBulkActionConfigs() {
  const { bulkDeleteProjects, bulkSetPortfolioVisibility } = useProjectActions()
  // The confirm copy is read when the dialog renders, so the count set just before `confirm()` shows.
  const [pendingCount, setPendingCount] = useState(0)
  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: `Delete ${pendingCount} ${pendingCount === 1 ? 'project' : 'projects'}?`,
    message: 'Public projects and projects linked to a meeting are skipped. Media goes with the rest. This cannot be undone.',
  })

  const bulkActions = useMemo((): EntityActionConfig<RowSelection>[] => [
    {
      action: { ...PROJECT_ACTIONS.showOnPortfolio, permission: BULK_ACTION_PERMISSION },
      isLoading: bulkSetPortfolioVisibility.isPending,
      onAction: selection => bulkSetPortfolioVisibility.mutate({ ids: selection.ids, data: { isPublic: true } }, { onSuccess: selection.clear }),
    },
    {
      action: { ...PROJECT_ACTIONS.hideFromPortfolio, permission: BULK_ACTION_PERMISSION },
      isLoading: bulkSetPortfolioVisibility.isPending,
      onAction: selection => bulkSetPortfolioVisibility.mutate({ ids: selection.ids, data: { isPublic: false } }, { onSuccess: selection.clear }),
    },
    {
      action: { ...PROJECT_ACTIONS.delete, permission: BULK_ACTION_PERMISSION },
      isLoading: bulkDeleteProjects.isPending,
      onAction: async (selection) => {
        setPendingCount(selection.ids.length)
        if (await confirmDelete()) {
          bulkDeleteProjects.mutate({ ids: selection.ids }, { onSuccess: selection.clear })
        }
      },
    },
  ], [bulkDeleteProjects, bulkSetPortfolioVisibility, confirmDelete])

  return { bulkActions, dialogs: <DeleteConfirmDialog /> }
}
```

- [ ] **Step 3: Wire the table**

In `use-projects-table.tsx`: import `useProjectBulkActionConfigs`; add `const { bulkActions, dialogs: bulkDialogs } = useProjectBulkActionConfigs()` after the action configs; add `bulkActions,` to `dataTableProps`; return `dialogs: (<><DeleteConfirmDialog />{bulkDialogs}</>)`.

- [ ] **Step 4: Type-check, lint, browser check**

Run: `pnpm tsc && pnpm lint` → clean.

Browser (super-admin): ticking projects shows "N selected · Show on Portfolio · Hide from Portfolio · Delete · Clear"; Delete asks "Delete N projects?" — Cancel. As an agent: no checkboxes (Review Focus 1). Owner-designated projects only: bulk Hide on two public projects → "Updated 2", their public pages 404 after a reload; bulk Delete on a meeting-linked project and a draft pure-portfolio project → "Deleted 1 · skipped 1 (linked to a meeting)".

- [ ] **Step 5: Commit**

```bash
git add src/shared/modules/projects/core/constants/bulk-skip-labels.ts src/shared/modules/projects/core/hooks/use-project-actions.ts src/shared/modules/projects/core/hooks/use-project-bulk-action-configs.tsx src/shared/modules/projects/core/components/projects-table/use-projects-table.tsx
git diff --cached --stat
git commit -m "feat(projects): bulk show, hide and delete on the records table; public and meeting-linked projects are skipped

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Phase B7 (partial) — hand-off

### Task 15: Docs, tracker, spec

**Files:**
- Modify: `src/shared/components/data-table/types.ts:44-49`
- Modify: `src/shared/components/data-table/hooks/use-table-url-filters.ts:9-16`
- Modify: `CONTEXT.md:62`
- Modify: `docs/plans/2026-09-26-records-management-epic.md`
- Modify: `docs/superpowers/specs/2026-09-28-records-bulk-actions-and-entity-tables-design.md`

- [ ] **Step 1: Stale deprecation text**

In `data-table/types.ts`, replace the `@deprecated` block above `DataTableFilterConfig` with:

```ts
/**
 * @deprecated No table filters on the client any more: tables read through `useDataViewQuery` and
 * `<QueryToolbar>`. Kept only until DataTable's client-filter path is deleted (records tracker O11).
 */
```

In `use-table-url-filters.ts`, replace the `@deprecated` lead line with `@deprecated Use \`useDataViewQuery\` + \`<QueryToolbar>\` for new tables.` and delete the list of legacy callers under it if `grep -rn "useTableUrlFilters" src` shows none of them use it any more.

- [ ] **Step 2: Glossary**

In `CONTEXT.md:62` (Setter row), replace the code cell `\`meetings.setBy\` (planned, analytics Spec D; not built)` with `\`meetings.setBy\` · captured on every add-a-meeting form; super-admins change it per row or in bulk`.

- [ ] **Step 3: Records tracker**

In `docs/plans/2026-09-26-records-management-epic.md`:
- status line: R4 projects and O8 (meetings, projects, campaign leads) built on local `main` (list the commit range); R3 proposals after the approval session;
- R4 row → `[x]` with the commit range; O8 row → `built (meetings, projects, campaign leads); proposals with R3`;
- H2: replace `loadPaginatedQueryInput` / `usePaginatedQuery` with `loadDataViewQueryInput` / `useDataViewQuery`;
- add two open items:
  - **O10** — legacy query path retirement: after R3 moves proposals onto a field list, delete `buildFilterWhere`, `buildOrderBy` and `loadPaginatedQueryInput`; moving campaign leads onto a field list (campaigns and lead-source option sources keyed by id) retires `usePaginatedQuery`, `fromPaginatedQuery` and `paginatedQueryInput` (the filtering plan's Task 21 step 5.3 follow-up).
  - **O11** — `DataTable`'s client-side filter path (`filterConfig`, `DataTableFilterBar`, time presets, `getPaginationRowModel`) has no callers; delete it.

- [ ] **Step 4: Spec**

In the spec, add under the header a `> **Plan:** \`docs/superpowers/plans/2026-09-29-records-bulk-actions-setter-projects.md\` (B1–B5, B7 partial; B6 after the approval session). Plan-time settlements 1–9 amend §4.5 (\`SetterPicker\`; Set Setter behind an opt-in in \`useMeetingActionConfigs\`), §4.2 (the invariant runs for every origin), §5.3–5.4 (bulk permission constant; promoted pickers; state-level pruning) and §7 (\`ProjectEntityCard\` drops \`onView\`; the visibility sort id).` line, and change §4.5's `InternalUserPicker` bullets to describe `SetterPicker` as built.

- [ ] **Step 5: Verify and commit**

Run: `pnpm tsc && pnpm lint` → clean.

```bash
git add src/shared/components/data-table/types.ts src/shared/components/data-table/hooks/use-table-url-filters.ts CONTEXT.md docs/plans/2026-09-26-records-management-epic.md docs/superpowers/specs/2026-09-28-records-bulk-actions-and-entity-tables-design.md
git diff --cached --stat
git commit -m "docs(records): bulk actions, setter and projects table shipped; legacy query and client-filter clean-ups tracked

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

(If the owner has not yet committed the spec, tracker and handoff as a docs commit of their own, ask before staging those files here.)

---

## Self-review notes (kept for the executor)

- **Spec coverage.** §4.1 → Task 1; §4.2 → Tasks 1–2; §4.3 → Task 2; §4.4 → Tasks 1, 3; §4.5 → Tasks 2, 3, 9; §5.1–5.2 → Tasks 4–6; §5.3 → Task 8; §5.4 → Tasks 7, 9, 14; §5.5 → Tasks 9, 14; §6 → not in this plan (B6); §7 → Tasks 11–14; §8 → Tasks 11–12 (hook-only entity tables, `RecordCustomerPane`, `useCustomerProfile`); §9 → Task 10; §10 → Tasks 4, 5, 9 (toasts); §11 → Global Constraints + Task 15; §12 → every task's verification.
- **Type consistency.** `RowSelection` (Task 7) is the entity of every bulk config (Tasks 9, 10, 14) and of `DataTableProps.bulkActions` (Task 8). `BulkActionResult` (Task 4) is what `bulkDeleteProcedure` / `bulkUpdateProcedure` return (Task 5) and what `toastBulkActionResult` formats (Task 9). `MEETING_BULK_DELETE_SKIP_LABELS` and `PROJECT_BULK_DELETE_SKIP_LABELS` are typed against the router outputs, so a renamed skip reason fails `pnpm tsc`. `ProjectListInput` (Task 11) replaces `ProjectsListInput` everywhere. `useMeetingsTable` / `useProjectsTable` return the same four-key shape.
- **Order.** Task 5 needs Task 1's column (the update schema must contain `setBy`); Task 9 needs Tasks 2, 3, 5, 7, 8; Task 10 needs Tasks 7, 8; Task 13 needs Tasks 7, 11, 12; Task 14 needs Tasks 6, 8, 9. B2 (Tasks 4–6) can run in parallel with Task 3.
