# Records bulk actions, setter and projects entity table — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Super-admins bulk-act on ticked rows of the records tables through one server runner (meetings and campaign leads here; projects, customers and proposals at D49's bulk step); meetings record their setter from every add-a-meeting form.

**Architecture:** One pure runner (`runBulk`) under two tRPC procedure builders gives each entity router a `bulk.delete` / `bulk.update` leaf whose rows run one at a time through the entity's own crud (hooks fire). `DataTable` owns row selection and mounts a floating `BulkActionBar` that renders ordinary `EntityActionConfig<RowSelection>`s through `EntityActionMenu`. Each entity table is a headless hook (`use<Entity>Table`) on the shared `useEntityTable`, and records pages go through `EntityRecordsTable` (both from the projects plan).

**Tech Stack:** Next.js 15 App Router, tRPC v11, Drizzle + Postgres (Neon), Zod 4, drizzle-zod, TanStack Table/Query, CASL, shadcn/ui (Radix), motion/react, pnpm, `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-28-records-bulk-actions-and-entity-tables-design.md` (v3, approved for planning 2026-09-29). Tracker: `docs/plans/2026-09-26-records-management-epic.md` (D37–D52, O8, O9). **Out of this plan:** the proposals entity table (spec §6, R3), which D50 builds before bulk in its own plan; the customers entity table (R2, D48); the legacy query path's deletion (D49's last step).

> **Status (2026-10-02): partly superseded, and not to be executed as written.** Tracker **D49** (2026-10-01) puts tables first and bulk last: projects → customers (R2) → proposals (R3) → the setter, bulk and selection across all four tables at once. This plan is the base for that last step.
> - **2026-10-05, tracker D59: the setter runs first.** Phase B1 (Tasks 1–3) and the Set Setter parts of Task 9 (the single-row action, the Setter column in the meetings table view) are cut into their own small plan, built right after the projects table lands. Bulk Set Setter and everything in B2–B4 stay for the last step. Re-check Tasks 1–3 against the code when that plan is cut.
> - **Tasks 11–13** are replaced by `docs/superpowers/plans/2026-10-01-projects-entity-table.md`. **Task 14** (projects bulk) moves to the all-tables bulk step. Their text is removed below; git history keeps it.
> - **Task 7 Steps 1–4** (`hidden`, `isActionPermitted`, `getVisibleActions`) landed in `a1d70db1`. Task 7 keeps only the bulk pieces.
> - **Task 9 Step 6** (delete `MeetingsTable`; the view composes its shell) is done by the projects plan's Task 3 (`useEntityTable`, `EntityRecordsTable`, meta key `rowActions`). Task 9 wires into that.
> - **Task 8 was rewritten on 2026-10-02** against the render-isolation code (`data-table-row.tsx`, `isRowClick`): selection reaches each memoized `DataTableRow` as a prop, like `isExpanded`; no row or cell reads `row.getIsSelected()` while rendering (D49).
> - **Task 10** was re-checked on 2026-10-02: campaign leads' meta, columns and mutations match the code.
> - **Not yet planned for D49's step:** the projects, proposals and customers bulk UI (configs on `useProjectsTable` / `useProposalsTable` / `useCustomersTable`, none built yet). Their server leaves are in Task 6. Campaign leads stays on `usePaginatedQuery` (owner, 2026-10-02: partly legacy, left alone), so D49's deletion of the legacy query path keeps what it uses.
> - **Owner rulings 2026-10-02** are recorded as settlements 14–17 and tracker D53–D58 (external setters deferred, D58).
> - The 2026-10-02 reviews' mechanical fixes are applied below. Their open owner decisions are marked **(open)** where they sit.

## Global Constraints

- Verification per task: `pnpm tsc` and `pnpm lint`. **Never `pnpm build`.**
- **No database writes for testing** (dev included). Browser checks read and open UI only; any write check (a bulk run, a setter change) runs only on rows the owner designates, or is verified by code and types.
- No unit runner in the repo: pure functions are checked with throwaway `node:test` files under `.superpowers/sdd/2026-09-29-records-bulk-actions/tests/` (git-ignored), run from the repo root with `pnpm exec tsx --test <file>` so the `@/` alias resolves. Never commit them.
- Work on `main`; other sessions commit concurrently and the index can hold their staged work (on 2026-10-02 it held a deletion and a rename). Stage by explicit path, never `git add -A`, and **commit with an explicit pathspec** (`git commit -m "…" -- <paths>`, as every commit block below does) so nothing already staged rides along; confirm with `git show --stat HEAD`. Never `git stash`, `checkout`, `reset`, `restore`, `clean` or `commit --amend`. Before editing any file this plan modifies, run `git status --short <file>`: if it shows changes you didn't make, stop and ask (on 2026-10-02 `data-table-row.tsx`, `use-meetings-table.tsx` and the meetings `columns-registry.tsx` had another session's edits). Commits happen under the owner's execution go (approving this plan is that go). Message shape `type(scope): subject`, ending with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Render rules (`data-table.tsx` meta doc): meta function entries are event callbacks; anything a cell reads while rendering is a value; rows and cells never read `table.getState()` / `row.getIsSelected()` while rendering.
- Browser checks: a local Playwright script (memory `reference-playwright-auth.md`, `/api/dev/playwright-session`), screenshots saved under `.superpowers/sdd/2026-09-29-records-bulk-actions/` in light and dark, desktop and 390px wide, listed in the task report. Use the running dev server (`ss -ltnp` first); never touch `.next`.
- Schema: `pnpm db:push:dev` after Task 1 is **owner-run**; `db:push:prod` must run **before** deploying Task 1 (every meetings list selects `set_by`); no `db:refresh:dev` between the two pushes.
- Code conventions (memory `coding-conventions.md`): one component per file, named exports, constants in `constants/`, pure helpers in `lib/` (no toasts or other side effects there), only DAL files import `db`, DAL functions return `DalReturn`. Comments say why, never what; no plan/spec/tracker citations in code.
- Action config arrays go through `useStableCallbacks` (`src/shared/hooks/use-stable-callbacks.ts`), never `useMemo` over mutation objects (repo convention since `1135ce23`). A function on a config that runs while rendering (`hidden`) reads only its argument.
- Routers reach a module through its service where one exists (`proposalService`, `projectsService`): writes through its CRUD slots, reads through `<m>Service.queries` (settlement 16), never its `dal/server/*`. New entity files still land under `shared/entities/`; the modules consolidation (memory `project-modules-consolidation.md`) moves them later.
- A role list is derived from the one ability definition (`rolesWithAbility`), never written out as role strings, the way the meetings crud resolves an owner by ability (`entities/meetings/dal/server/crud.ts:24-25`, `resolve-owner.ts:14`). Settlement 13.
- Action labels are Title Case like the existing constants ("Set Setter", "Open Project", "View on Site", "Show on Portfolio", "Hide from Portfolio").
- Bulk is super-admin only (D43): every bulk action config carries `BULK_ACTION_PERMISSION` (`['manage', 'all']`), matching the `superAdminProcedure` the bulk leaves run on. Single-row actions keep their existing permissions.

## Review Focus

1. **Agents and dispatchers see no bulk UI.** On meetings and campaign leads neither an agent nor a dispatcher sees checkboxes, and on meetings no Setter column, Setter filter or Set Setter action. Pinned by Task 2 Step 6 and Task 9 Step 10 (browser, agent and dispatcher sessions).
2. **A checkbox tap is only a checkbox tap.** Ticking a row never expands it (meetings) and never opens campaign leads' drawer, including on a phone-width viewport. Pinned by Task 9 Step 8 and Task 10 Step 6.
3. **Selection only holds what the viewer can see.** Ticked rows that a filter or search removes are un-ticked (not silently re-ticked when they come back); page, page-size and sort changes clear the selection. Pinned by `pruneRowSelection` checks (Task 8 Step 1).
4. **"No setter" is a real value, and the setter follows the lead.** Choosing "No setter" single-row or in bulk writes `null`. A form left unpicked records the creator. A duplicate and a reschedule both keep the setter, including a `null` one (the duplicate engine's null → undefined mapping must not turn it into the duplicator). Pinned by Task 1 Step 7, Task 5 Step 1 (empty-vs-null patch check) and Task 9 Step 9.
5. **A run where nothing happens says so.** Bulk delete on rows that are all skipped toasts "Deleted 0 · skipped 3 (with proposals)" as a warning, not a success tick, and still clears the selection. Pinned by `describeBulkActionResult` checks (Task 9 Step 1).

## Plan-time settlements (deviations from the spec text; mirrored into the spec in Task 15)

1. **`SetterPicker`, not an extracted `InternalUserPicker`.** `ParticipantPickerContent`'s rows are role-add buttons ("Add as owner…") with slot rules; the setter needs one selectable value. Both pickers compose one users-entity row, `UserCommandItem`, extracted from `AvailableParticipantRow`. `SetterPicker` (meetings entity) runs the setter-candidates query itself; `ParticipantPickerContent` is otherwise unchanged. One `SetterSelect` (trigger, popover, label) serves the add-meeting form (and the lead-source work later).
2. **Single-row Set Setter lives in `useMeetingActionConfigs`, hidden where the entity carries no setter** (owner, 2026-10-02: `hidden`): `hidden: entity => entity.setBy === undefined`, the `ProjectEntity.isPublic?` pattern. Only the records table's rows carry `setBy`, so the schedule calendar and the overview card never show it. It keeps the menu order (before Delete) in one place. Amends spec §4.5 ("appended inside `useMeetingsTable`").
3. **The setter invariant runs for every origin** that writes a non-null `setBy` (fail fast). A reschedule or a duplicate of a meeting whose setter's role later changed fails with `set_by_not_internal` until a super-admin changes the setter. Reschedule's create unwraps with `dalToTrpc`, so that reason reaches the client as PRECONDITION_FAILED and the toast words it. **(open)** Exempting copied setters needs a way for a crud hook to tell a copy from a choice, which it cannot today. With only in-house setters (D58) the case is a dispatcher who leaves the team while their meetings are still being rescheduled; a super-admin clears or changes the setter, then the reschedule succeeds.
4. **One bulk permission.** Bulk configs use `BULK_ACTION_PERMISSION` (`['manage', 'all']`) rather than each action's single-row permission, so an agent's `update Project` never shows checkboxes the server would refuse.
5. **Toolbar mode renders a promoted `custom` action as a popover button.** The bulk bar promotes every action, so pickers (Set Setter, Enroll) are one click away instead of under More; single-row toolbars gain the same ability.
6. **Selection is pruned in state, not only in view:** when the row ids change, ids no longer present are dropped (render-phase, like the expansion reset). Task 8's rewrite (D49) keeps this rule.
7–9. Moved with Tasks 11–13 to the projects plan.
10. **A duplicate keeps the setter** (owner, 2026-10-02: "it's still their lead"). Amends spec §4.4 ("joins `duplicate.exclude`") and tracker D42 ("duplicate clears"). `setBy` stays off `duplicate.exclude`.
11. **The bulk procedure builders take the same config as `createCrudRouter`:** `spec` and `schemas.id` beside `crud`. They resolve the entity's visibility scope like `createCrudRouter` does, so relaxing D43 later can never run a bulk leaf unscoped. Amends spec §5.2's `idSchema`.
12. **Each entity's delete skip labels are the source of its skip-reason type** (`MEETING_DELETE_SKIP_LABELS` → `MeetingDeleteSkipReason`), in the entity's `constants/`. The router's `classify` returns that type; no client file derives it from `AppRouterOutputs`. The result formatter labels `notFound` itself.
13. **The setter and participant role lists derive from CASL:** `SETTER_ROLES` = the roles that can `create Meeting`, `PARTICIPANT_ROLES` = the roles that can `own Meeting`. Same sets as written out today; they can no longer drift from `abilities.ts`.
14. **An unpicked setter is the meeting's creator** (owner, 2026-10-02): `create.before` fills `setBy` from the session when the input omits it; forms send `setBy` only as held. Amends D47 ("no server default").
15. **Only super-admins change a setter** (owner, 2026-10-02): `update.before` refuses `setBy` from a viewer without `assign Meeting`. This takes the update half of H5 out of #285; an agent naming someone else at create stays H5's.
16. **Routers read a module through `<m>Service.queries`** (owner, 2026-10-02; the modules-consolidation shape): the proposals and projects bulk leaves read `proposalService.queries.getProposalsByIds` and `projectsService.queries.getProjectDeleteFacts`, never `dal/server/queries`. An entity without a service (meetings) keeps its DAL reads.
17. **The setter is meetings-only; external setters are deferred** (owner, 2026-10-02; tracker D56, D58). Intake carries no setter in this plan and keeps its `closedByOptions` / `closedBy` path untouched. External setters later add `meetings.external_setter_id` beside `set_by` (never both), so this plan keeps `set_by` a nullable user FK and reads the setter in one place per surface (`setterName` in `listMeetings`, the `setters` option source, `SetterPicker`); that is where the external kind joins.

Settlements 1–13 and the names they introduce were approved by the owner on 2026-10-02.

## File map

| Area | Files |
|---|---|
| Setter (B1) | `db/schema/meetings.ts` · `domains/permissions/lib/roles-with-ability.ts` (new) · `entities/meetings/constants/{internal-user-roles.ts, set-by-not-internal.ts}` (new) · `entities/users/dal/server/queries.ts` · `entities/meetings/dal/server/crud.ts` · `trpc/routers/meetings.router/{business,reads}.router.ts` · `dal/lib/query/constants.ts` · `dal/client/constants/option-source-reads.ts` · `entities/meetings/dal/meeting-fields.ts` · `entities/meetings/dal/server/{meeting-field-sql,queries}.ts` · `entities/meetings/lib/columns-registry.tsx` · `features/records-management/constants/meetings-records-table-view.ts` · `entities/users/components/user-command-item.tsx` (new) · `entities/meetings/constants/participant-add-labels.ts` (new) · `entities/meetings/components/participant-picker/available-participant-row.tsx` · `entities/meetings/components/{setter-picker,setter-select}.tsx` (new) · `entities/meetings/components/create-meeting-form.tsx` |
| Bulk server (B2) | `dal/server/lib/run-bulk.ts` (new) · `trpc/lib/{non-empty-patch,bulk-procedures}.ts` (new) · `trpc/routers/{meetings,proposals,projects}.router/{bulk.router.ts (new), index.ts}` · `trpc/routers/projects.router/crud.router.ts` (revalidate line) · `entities/meetings/{dal/server/queries.ts, constants/delete-skip-reasons.ts (new)}` · `modules/projects/core/{dal/server/queries.ts, constants/delete-skip-reasons.ts (new)}` · `modules/proposals/core/constants/delete-skip-reasons.ts` (new) |
| Selection + bar (B3) | `components/entities/entity-actions/{types.ts, lib/with-toolbar-roles.ts, lib/describe-bulk-action-result.ts (new), constants/bulk-action-permission.ts (new), constants/bulk-not-found-label.ts (new), ui/entity-action-menu.tsx, ui/toolbar-button.tsx (new), ui/toolbar-popover-button.tsx (new), ui/bulk-action-bar.tsx (new)}` · `hooks/use-confirm.tsx` · `components/ui/checkbox.tsx` · `components/data-table/{lib/prune-row-selection.ts (new), ui/data-table.tsx, ui/data-table-body.tsx, ui/data-table-row.tsx}` |
| Meetings UI (B3) | `entities/meetings/{constants/actions.ts, constants/bulk-actions.ts (new), hooks/use-meeting-actions.ts, hooks/use-meeting-action-configs.tsx, hooks/use-meeting-bulk-action-configs.tsx (new), components/meetings-table/use-meetings-table.tsx}` |
| Campaign leads (B4) | `features/campaigns-admin/{constants/lead-bulk-actions.ts (new), hooks/use-lead-bulk-action-configs.tsx (new), ui/components/leads/bulk-enroll-form.tsx (new), ui/lib/leads-columns.tsx, ui/views/campaigns-leads-view.tsx}` · delete `lead-select-cell.tsx`, `lead-select-header.tsx`, `leads-bulk-action-bar.tsx`, `bulk-enroll-popover.tsx` |
| Projects (B5) | Moved: `docs/superpowers/plans/2026-10-01-projects-entity-table.md` (Tasks 11–13) and the all-tables bulk step (Task 14). |
| Hand-off (B7, partial) | `components/data-table/types.ts` · `components/data-table/hooks/use-table-url-filters.ts` · `CONTEXT.md` · records tracker · spec |

All paths above are under `src/shared/` unless they start with `features/`, `trpc/` or `app/` (then `src/`), or are repo-root docs.

---

## Phase B1 — the setter

### Task 1: `meetings.set_by`, the internal-user rule, duplicate and reschedule

**Files:**
- Modify: `src/shared/db/schema/meetings.ts:21-41`
- Create: `src/shared/domains/permissions/lib/roles-with-ability.ts`
- Create: `src/shared/entities/meetings/constants/internal-user-roles.ts`
- Create: `src/shared/entities/meetings/constants/set-by-not-internal.ts`
- Modify: `src/shared/entities/users/dal/server/queries.ts`
- Modify: `src/shared/entities/meetings/dal/server/crud.ts:1-77,132-151`
- Modify: `src/trpc/routers/meetings.router/business.router.ts:120-131`

**Interfaces:**
- Produces: column `meetings.setBy: string | null` (FK `user.id`, `on delete set null`); `rolesWithAbility(action, subject): UserRole[]`; `PARTICIPANT_ROLES` (= `own Meeting`: agent, super-admin) and `SETTER_ROLES` (= `create Meeting`: dispatcher, agent, super-admin); `SET_BY_NOT_INTERNAL = { reason, message }`; `listUsersByRoles(roles, { excludeIds? }): Promise<DalReturn<InternalUserRow[]>>` with `InternalUserRow = Pick<User, 'id' | 'name' | 'email' | 'image' | 'role'>`; `getUserRoleById(id): Promise<DalReturn<UserRole | null>>`; meetings crud defaults an unpicked `setBy` to the creating session's user, refuses a non-internal `setBy` with `precondition-failed: set_by_not_internal`, and refuses a `setBy` update from a viewer without `assign Meeting` (`forbidden`).

- [ ] **Step 1: The column**

In `src/shared/db/schema/meetings.ts`, after the `ownerId` line (`:23`), add:

```ts
  // Who booked the meeting, often a dispatcher. Not ownerId: a dispatcher's booking goes to the system owner.
  setBy: text('set_by').references(() => user.id, { onDelete: 'set null' }),
```

drizzle-zod carries it into `selectMeetingSchema`, `insertMeetingSchema` and the update partial as nullable-optional; no schema edit is needed.

- [ ] **Step 2: The role lists, read off the abilities**

Create `src/shared/domains/permissions/lib/roles-with-ability.ts`:

```ts
import type { UserRole } from '@/shared/constants/enums'
import type { AppAction, AppSubject } from '@/shared/domains/permissions/types'

import { userRoles } from '@/shared/constants/enums'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'

/** A SQL `role IN (…)` needs role strings; deriving them from the abilities keeps the two from drifting. */
export function rolesWithAbility(action: AppAction, subject: AppSubject): UserRole[] {
  return userRoles.filter(role => defineAbilitiesFor({ id: '', role }).can(action, subject))
}
```

Create `src/shared/entities/meetings/constants/internal-user-roles.ts`:

```ts
import { rolesWithAbility } from '@/shared/domains/permissions/lib/roles-with-ability'

/** Who can sit a meeting: the roles that own the meetings they book. */
export const PARTICIPANT_ROLES = rolesWithAbility('own', 'Meeting')

/** Who can have booked a meeting: dispatchers book most of them but never sit one. */
export const SETTER_ROLES = rolesWithAbility('create', 'Meeting')
```

Create `src/shared/entities/meetings/constants/set-by-not-internal.ts`:

```ts
/** The crud's refusal code for a setter who isn't on the team, and the words a toast shows for it. */
export const SET_BY_NOT_INTERNAL = {
  reason: 'set_by_not_internal',
  message: 'That person is no longer on the team, so they can\'t be the setter. Choose another setter.',
} as const
```

- [ ] **Step 3: The users DAL reads**

In `src/shared/entities/users/dal/server/queries.ts`, change the drizzle import to `import { and, eq, inArray, notInArray } from 'drizzle-orm'`, add `import type { UserRole } from '@/shared/constants/enums/user'` and `import type { User } from '@/shared/db/schema/auth'` beside the `DalReturn` type import, and append:

```ts
export type InternalUserRow = Pick<User, 'id' | 'name' | 'email' | 'image' | 'role'>

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

The row type comes from the `user` select schema, so a column change reaches it without a hand edit.

- [ ] **Step 4: The setter rule in the meetings crud hooks**

In `src/shared/entities/meetings/dal/server/crud.ts` add the imports (alphabetical within the `@/` block):

```ts
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { SETTER_ROLES } from '@/shared/entities/meetings/constants/internal-user-roles'
import { SET_BY_NOT_INTERNAL } from '@/shared/entities/meetings/constants/set-by-not-internal'
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
  if (!role || !SETTER_ROLES.includes(role)) {
    throw new ThrowableDalError({ type: 'precondition-failed', reason: SET_BY_NOT_INTERNAL.reason })
  }
}
```

Replace the `create.before` body (`:27-32`) with:

```ts
      async before(input, ctx) {
        // No setter picked: whoever books the meeting set it. A picked "No setter" (`null`) stays null;
        // SYSTEM_CONTEXT has no session, so its unpicked setter is null.
        const setBy = input.setBy === undefined ? ctx.session?.user.id ?? null : input.setBy
        await assertSetterIsInternal(setBy)
        if (!ctx.session) {
          return { ...input, setBy }
        }
        return { ...input, setBy, ownerId: await resolveMeetingOwnerId(ctx) }
      },
```

A meeting's creator holds `create Meeting`, which is exactly `SETTER_ROLES`, so the default always passes the check.

and make the first lines of `update.before` (`:60-61`):

```ts
      async before(data, ctx, { id }) {
        if ('setBy' in data) {
          // Only super-admins change a setter for now; SYSTEM_CONTEXT (no ability) may.
          if (ctx.ability?.cannot('assign', 'Meeting')) {
            throw new ThrowableDalError({ type: 'forbidden' })
          }
          await assertSetterIsInternal(data.setBy)
        }
        let next = data
```

Only the setter UI (Tasks 5, 9) sends `setBy` on update; on 2026-10-02 no other update caller sent it (re-check with `grep -rn "setBy" src` before relying on it), so agents' other edits are untouched.

Both hooks run inside the engine's `dalDbOperation` (`create-crud-dal.ts:81-87,113-119`), so the throw becomes a `precondition-failed` `DalReturn`, which `dalToTrpc` maps to `PRECONDITION_FAILED`.

- [ ] **Step 5: Duplicate and reschedule keep the setter**

In the same file, leave `setBy` **off** `duplicate.exclude`, and copy it explicitly in `duplicate.overrides`: the engine turns every `null` into `undefined` before the insert (`create-crud-dal.ts`, "null → undefined"), and `create.before` would then make the person duplicating the setter of a "No setter" meeting. Extend the block comment and the overrides:

```ts
  // A duplicate is a fresh sit, not a continuation — only reschedule carries flow state forward.
  // The setter is copied, `null` included: the lead is still theirs.
```

```ts
    overrides: (source, ctx) => ({
      ownerId: ctx.session?.user.id ?? source.ownerId,
      setBy: source.setBy,
    }),
```

In `src/trpc/routers/meetings.router/business.router.ts`, inside the `meetingCrud.create(SYSTEM_CONTEXT, { … })` call of the reschedule procedure (`:120-131`), add after `meetingType: original.meetingType,`:

```ts
        setBy: original.setBy,
```

and change that call's unwrap from `dalVerifySuccess(await meetingCrud.create(…))` to `dalToTrpc(await meetingCrud.create(…))` (already imported). `dalVerifySuccess` throws a `ThrowableDalError` outside any `dalDbOperation`, which tRPC turns into a 500 reading "DalError: precondition-failed"; `dalToTrpc` sends PRECONDITION_FAILED with the reason, which the reschedule toast words (Task 9 Step 3). Leave the later `dalVerifySuccess(await meetingCrud.update(…))` as it is.

- [ ] **Step 6: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 7: Owner gate — dev schema push; read-only confirmation**

Ask the owner to run `pnpm db:push:dev` and paste the printed statements. Expected: exactly `ALTER TABLE "meetings" ADD COLUMN "set_by" text;` plus the FK constraint, no `truncate`, no rebuild. Then confirm by code read that `crud.ts` `duplicate.exclude` does **not** list `'setBy'`, `duplicate.overrides` sets `setBy: source.setBy`, and the reschedule create passes `setBy: original.setBy` (Review Focus 4). Confirm by a throwaway `node:test` (or a `tsx -e` one-liner) that `SETTER_ROLES` is `['agent', 'super-admin', 'dispatcher']` and `PARTICIPANT_ROLES` is `['agent', 'super-admin']`, in `userRoles` order.

- [ ] **Step 8: Commit**

```bash
git add src/shared/db/schema/meetings.ts src/shared/domains/permissions/lib/roles-with-ability.ts src/shared/entities/meetings/constants/internal-user-roles.ts src/shared/entities/meetings/constants/set-by-not-internal.ts src/shared/entities/users/dal/server/queries.ts src/shared/entities/meetings/dal/server/crud.ts src/trpc/routers/meetings.router/business.router.ts
git commit -m "feat(meetings): setter column, defaulting to the creator; a setter must be on the team; only super-admins change it

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- src/shared/db/schema/meetings.ts src/shared/domains/permissions/lib/roles-with-ability.ts src/shared/entities/meetings/constants/internal-user-roles.ts src/shared/entities/meetings/constants/set-by-not-internal.ts src/shared/entities/users/dal/server/queries.ts src/shared/entities/meetings/dal/server/crud.ts src/trpc/routers/meetings.router/business.router.ts
git show --stat HEAD
```

---

### Task 2: Setter candidates, the Setter filter, sort and column

**Files:**
- Modify: `src/trpc/routers/meetings.router/reads.router.ts:1-51`
- Modify: `src/shared/dal/lib/query/constants.ts:15`
- Modify: `src/shared/dal/client/constants/option-source-reads.ts:19-34`
- Modify: `src/shared/entities/meetings/dal/meeting-fields.ts:11-30`
- Modify: `src/shared/entities/meetings/dal/server/meeting-field-sql.ts`
- Modify: `src/shared/entities/meetings/dal/server/queries.ts` (`MeetingListRow`, `listMeetings`; line numbers moved when `listMeetingsForProject` landed in `fd4ea64b`)
- Modify: `src/shared/entities/meetings/lib/columns-registry.tsx` (new `setter` column)
- Modify: `src/features/records-management/constants/meetings-records-table-view.ts`

**Interfaces:**
- Consumes: `listUsersByRoles`, `PARTICIPANT_ROLES`, `SETTER_ROLES` (Task 1); `getSystemOwnerId` (`entities/users/dal/server/system.ts`).
- Produces: `meetingsRouter.reads.getInternalUsers` input `{ purpose: 'participant' | 'setter' } | undefined` (no input = participants, unchanged); option source `'setters'`; field `setter` in `MEETING_FIELDS` (filter + sort); `setterUser` alias exported from `meeting-field-sql.ts`; `MeetingListRow.setterName: string | null`; column key `setter`.

- [ ] **Step 1: The candidates read**

Edit `src/trpc/routers/meetings.router/reads.router.ts` in place (other sessions edit this file; leave `list`, `getByIdWithJoins` and `listForProject` untouched, and keep the `projectProcedure` import `listForProject` uses):
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
git commit -m "feat(meetings): setter candidates include dispatchers; Setter filter, sort and column for super-admins

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- src/trpc/routers/meetings.router/reads.router.ts src/shared/dal/lib/query/constants.ts src/shared/dal/client/constants/option-source-reads.ts src/shared/entities/meetings/dal/meeting-fields.ts src/shared/entities/meetings/dal/server/meeting-field-sql.ts src/shared/entities/meetings/dal/server/queries.ts src/shared/entities/meetings/lib/columns-registry.tsx src/features/records-management/constants/meetings-records-table-view.ts
git show --stat HEAD
```

---

### Task 3: `SetterPicker` and `SetterSelect`; "Set by" on every add-a-meeting form

**Files:**
- Create: `src/shared/entities/users/components/user-command-item.tsx`
- Create: `src/shared/entities/meetings/constants/participant-add-labels.ts`
- Modify: `src/shared/entities/meetings/components/participant-picker/available-participant-row.tsx`
- Create: `src/shared/entities/meetings/components/setter-picker.tsx`
- Create: `src/shared/entities/meetings/components/setter-select.tsx`
- Modify: `src/shared/entities/meetings/components/create-meeting-form.tsx`

**Interfaces:**
- Consumes: `getInternalUsers({ purpose: 'setter' })` (Task 2).
- Produces: `UserCommandItem({ user, onSelect, disabled?, leading?, trailing?, ariaLabel?, className? })`; `PARTICIPANT_ADD_LABELS`; `SetterPicker({ value: string | null | undefined, onPick: (userId: string | null) => void, disabled?: boolean })` (`undefined` = no checkmark, for a mixed bulk selection); `SetterSelect({ value: string | null | undefined, onChange: (userId: string | null) => void, selfId: string | null, selfName: string | null })`.

One encoding wherever a form holds the setter: `undefined` = not picked (the crud records the creator, Task 1), `null` = "No setter", a string = that user. The form sends what it holds; it never resolves the default itself (owner, 2026-10-02).

Intake is out of this plan (owner, 2026-10-02: the setter belongs to meetings, not intake). The intake form, `createFromIntake` and `ingestLead` are untouched; a meeting they create has a null `set_by`, and a lead source's pick stays in `leadMetaJSON.closedBy` until external setters are built (tracker D58).

- [ ] **Step 1: One user row for both pickers**

Create `src/shared/entities/users/components/user-command-item.tsx` (the row `AvailableParticipantRow` draws today, with a slot on either side):

```tsx
'use client'

import type { ReactNode } from 'react'

import type { UserOverviewCardUser } from '@/shared/entities/users/components/overview-card'

import { CommandItem } from '@/shared/components/ui/command'
import { UserOverviewCard } from '@/shared/entities/users/components/overview-card'
import { cn } from '@/shared/lib/utils'

interface UserCommandItemProps {
  user: UserOverviewCardUser
  onSelect: () => void
  disabled?: boolean
  /** Before the avatar, e.g. a checkmark. */
  leading?: ReactNode
  /** After the name, e.g. an "Add as owner" chip. */
  trailing?: ReactNode
  ariaLabel?: string
  className?: string
}

export function UserCommandItem({ user, onSelect, disabled = false, leading, trailing, ariaLabel, className }: UserCommandItemProps) {
  const name = user.name ?? user.email ?? 'Unknown'

  return (
    <CommandItem
      // cmdk filters on `value`, so name and email both match.
      value={`${name} ${user.email ?? ''}`}
      disabled={disabled}
      onSelect={onSelect}
      aria-label={ariaLabel}
      // shadcn's selected tint is `accent`, which equals `primary` in the dark theme and floods the row; a muted tint stays quiet.
      className={cn(
        'group flex items-center gap-3 rounded-md px-3 py-2.5',
        'data-[selected=true]:bg-muted/70 hover:bg-muted/70',
        'data-[selected=true]:text-foreground',
        className,
      )}
    >
      {leading}
      <UserOverviewCard user={user} className="contents">
        <UserOverviewCard.Avatar size="sm" className="size-8" />
        <div className="flex min-w-0 flex-1 flex-col gap-px overflow-hidden">
          <UserOverviewCard.Name className="truncate text-sm font-medium text-foreground group-data-[selected=true]:font-semibold" />
          <UserOverviewCard.Email className="truncate text-xs text-muted-foreground" />
        </div>
      </UserOverviewCard>
      {trailing}
    </CommandItem>
  )
}
```

Create `src/shared/entities/meetings/constants/participant-add-labels.ts` (today a file-level constant in the row component, which Rule 2 forbids):

```ts
import type { MeetingParticipantRole } from '@/shared/constants/enums'

/** The add affordance's words for the role a picked user will get. */
export const PARTICIPANT_ADD_LABELS = {
  owner: 'Add as owner',
  co_owner: 'Add as co-owner',
  helper: 'Add as helper',
} as const satisfies Record<MeetingParticipantRole, string>
```

Rewrite `available-participant-row.tsx` on `UserCommandItem`. Re-read the file first: another session changed its chip classes on 2026-10-01, and they stay as they are now. Props, the disabled/pending guard and the chip are unchanged; the `ADD_LABEL` constant and the row's own `CommandItem` / `UserOverviewCard` markup go:

```tsx
export function AvailableParticipantRow({ user, inferredRole, disabled, isPending, onAdd }: AvailableParticipantRowProps) {
  const name = user.name ?? user.email ?? 'Unknown'

  return (
    <UserCommandItem
      user={user}
      disabled={disabled || isPending}
      onSelect={() => {
        if (!disabled && !isPending) {
          onAdd()
        }
      }}
      ariaLabel={`${PARTICIPANT_ADD_LABELS[inferredRole]} — ${name}`}
      className={cn(disabled && 'opacity-50')}
      trailing={(
        <span className="{the chip's current classes, unchanged}">
          {isPending
            ? <Loader2 className="size-3 animate-spin" />
            : (
                <>
                  <Plus className="size-3" />
                  {PARTICIPANT_ADD_LABELS[inferredRole]}
                </>
              )}
        </span>
      )}
    />
  )
}
```

- [ ] **Step 2: The picker**

Create `src/shared/entities/meetings/components/setter-picker.tsx`:

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { CheckIcon } from 'lucide-react'

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/shared/components/ui/command'
import { UserCommandItem } from '@/shared/entities/users/components/user-command-item'
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
                  <CommandItem value="No setter" disabled={disabled} onSelect={() => onPick(null)} className="gap-3 px-3 py-2.5 data-[selected=true]:bg-muted/70">
                    <CheckIcon className={cn('size-3.5 shrink-0', value === null ? 'opacity-100' : 'opacity-0')} />
                    <span className="text-sm text-muted-foreground">No setter</span>
                  </CommandItem>
                  {(setters.data ?? []).map(setter => (
                    <UserCommandItem
                      key={setter.id}
                      user={setter}
                      disabled={disabled}
                      onSelect={() => onPick(setter.id)}
                      leading={<CheckIcon className={cn('size-3.5 shrink-0', value === setter.id ? 'opacity-100' : 'opacity-0')} />}
                    />
                  ))}
                </CommandGroup>
              </>
            )}
      </CommandList>
    </Command>
  )
}
```

- [ ] **Step 3: The trigger both forms use**

Create `src/shared/entities/meetings/components/setter-select.tsx`:

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { ChevronsUpDownIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { SetterPicker } from '@/shared/entities/meetings/components/setter-picker'
import { useTRPC } from '@/trpc/helpers'

interface SetterSelectProps {
  /** `undefined` = not picked yet, which means the viewer; `null` = "No setter". */
  value: string | null | undefined
  onChange: (userId: string | null) => void
  selfId: string | null
  selfName: string | null
}

export function SetterSelect({ value, onChange, selfId, selfName }: SetterSelectProps) {
  const [open, setOpen] = useState(false)
  const trpc = useTRPC()
  // Same key as the picker's own read, so the list loads once.
  const setters = useQuery(trpc.meetingsRouter.reads.getInternalUsers.queryOptions({ purpose: 'setter' }))
  const current = value === undefined ? selfId : value
  const label = current === null
    ? 'No setter'
    : setters.data?.find(setter => setter.id === current)?.name ?? (current === selfId ? selfName : null) ?? 'Loading…'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between font-normal">
          <span className="truncate">{label}</span>
          <ChevronsUpDownIcon className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(420px,calc(100vw-2rem))] p-0">
        <SetterPicker
          value={current}
          onPick={(userId) => {
            onChange(userId)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 4: "Set by" on `CreateMeetingForm`**

In `src/shared/entities/meetings/components/create-meeting-form.tsx`:

Add imports:

```tsx
import { toast } from 'sonner'

import { useSession } from '@/shared/domains/auth/client'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { SET_BY_NOT_INTERNAL } from '@/shared/entities/meetings/constants/set-by-not-internal'
import { SetterSelect } from './setter-select'
```

After the `projectId` state:

```tsx
  const canPickSetter = useAbility().can('assign', 'Meeting')
  const { data: session } = useSession()
  const selfId = session?.user.id ?? null
  const selfName = session?.user.name ?? null
  const [setBy, setSetBy] = useState<string | null | undefined>(undefined)
```

In `createMutation`'s `onSuccess`, add `setSetBy(undefined)` beside the other resets. `createMutation` has no `onError` today, so a refused create fails silently (no global mutation error handler exists); add one beside `onSuccess`:

```tsx
      onError: err => toast.error(err.message === SET_BY_NOT_INTERNAL.reason ? SET_BY_NOT_INTERNAL.message : 'Failed to create meeting'),
```

 In `handleSubmit`'s create branch, add after `scheduledFor`:

```tsx
        setBy,
```

Render, between the "Date & Time" block and the "Trade & Scope Selection" block, only when creating:

```tsx
      {!isEditMode && (
        <div className="space-y-2">
          <Label>Set by</Label>
          {canPickSetter
            ? <SetterSelect value={setBy} onChange={setSetBy} selfId={selfId} selfName={selfName} />
            : <p className="text-sm text-muted-foreground">{`${selfName ?? 'You'} (you)`}</p>}
        </div>
      )}
```

Agents and dispatchers send nothing; the crud records them as the setter (Task 1 Step 4).

- [ ] **Step 5: Type-check, lint, browser read check**

Run: `pnpm tsc && pnpm lint` → clean.

Browser (super-admin): open every mount of the form (`grep -rn "CreateMeetingForm\|CreateMeetingModal" src` lists them; on 2026-10-02 they were the pipeline kanban's `CreateMeetingModal` and the customer profile's command dialogs, which spec §4.4's four entry points — kanban drag to "Meeting scheduled", kanban card "Schedule Meeting", profile "Add meeting", customer meetings tab "Add Meeting" — all reach). Each shows "Set by" with the signed-in user; the popover lists setters incl. dispatchers, "No setter" first. The lead-sources admin "Add customer" sheet and the public `/intake` page are unchanged (no "Set by"). As an agent: "Add meeting" shows "Set by" as "<name> (you)", no picker. The meetings table's Rep picker and the Manage Participants modal list, search and add exactly as before (the `UserCommandItem` extraction). Do not submit any form unless the owner designates a customer for it.

- [ ] **Step 6: Commit**

```bash
git add src/shared/entities/users/components/user-command-item.tsx src/shared/entities/meetings/constants/participant-add-labels.ts src/shared/entities/meetings/components/participant-picker/available-participant-row.tsx src/shared/entities/meetings/components/setter-picker.tsx src/shared/entities/meetings/components/setter-select.tsx src/shared/entities/meetings/components/create-meeting-form.tsx
git commit -m "feat(meetings): Set by on the add-meeting form — a picker for super-admins, the creator by default

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- src/shared/entities/users/components/user-command-item.tsx src/shared/entities/meetings/constants/participant-add-labels.ts src/shared/entities/meetings/components/participant-picker/available-participant-row.tsx src/shared/entities/meetings/components/setter-picker.tsx src/shared/entities/meetings/components/setter-select.tsx src/shared/entities/meetings/components/create-meeting-form.tsx
git show --stat HEAD
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

test('a row whose write throws fails as unknown-error and the loop continues', async () => {
  const { result } = await runBulk(['boom', 'fine'], {
    run: async (id) => {
      if (id === 'boom') throw new Error('dispatch failed')
      return ok(id)
    },
  })
  assert.deepEqual(result.failed, [{ id: 'boom', error: 'unknown-error' }])
  assert.deepEqual(result.done, ['fine'])
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
    let outcome: DalReturn<TOut>
    try {
      outcome = await steps.run(id)
    }
    catch (cause) {
      // Crud returns DalReturn, so a throw is a hook or dispatch bug; it must not abandon the rows after it.
      outcome = { success: false, error: { type: 'unknown-error', cause } }
    }
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

Run: `pnpm exec tsx --test .superpowers/sdd/2026-09-29-records-bulk-actions/tests/run-bulk.test.ts` → 4 pass.
Run: `pnpm tsc && pnpm lint` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/shared/dal/server/lib/run-bulk.ts
git commit -m "feat(dal): runBulk — one entity write per id, skips classified rows, reports done, skipped and failed

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- src/shared/dal/server/lib/run-bulk.ts
git show --stat HEAD
```

---

### Task 5: The procedure builders; meetings `bulk.delete` / `bulk.update`

**Files:**
- Create: `src/trpc/lib/non-empty-patch.ts`
- Create: `src/trpc/lib/bulk-procedures.ts`
- Create: `src/shared/entities/meetings/constants/delete-skip-reasons.ts`
- Modify: `src/shared/entities/meetings/dal/server/queries.ts` (append the facts read)
- Create: `src/trpc/routers/meetings.router/bulk.router.ts`
- Modify: `src/trpc/routers/meetings.router/index.ts`

**Interfaces:**
- Consumes: `runBulk`, `BULK_MAX_IDS`, `BulkActionResult` (Task 4); `meetingCrud`, `meetingSchemas`, `meetingServerSpec` (`entities/meetings/lib/server-spec.ts`); `resolveVisibilityScope` (`trpc/lib/middleware/scope-middleware.ts`).
- Produces: `nonEmptyPatch(schema)` (pure); `bulkDeleteProcedure({ spec, schemas: { id }, crud, facts, classify })`, `bulkUpdateProcedure({ spec, schemas: { id }, crud, data, afterRun? })` (both on `superAdminProcedure` with the entity's visibility scope resolved, input `ids: id[1..100]`); `MEETING_DELETE_SKIP_LABELS`, `MeetingDeleteSkipReason`; `getMeetingDeleteFacts(ctx, ids): Promise<DalReturn<MeetingDeleteFacts[]>>`; `meetingsRouter.bulk.delete({ ids })` → `BulkActionResult<MeetingDeleteSkipReason>`; `meetingsRouter.bulk.update({ ids, data: { setBy } })` → `BulkActionResult`.

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
  // Refine last: Zod 4 throws at runtime on `.pick` / `.partial` of a refined object, so pick before calling this.
  return schema.refine(data => Object.values(data).some(value => value !== undefined), { message: 'Nothing to update' })
}
```

Create `src/trpc/lib/bulk-procedures.ts`. The config mirrors `CreateCrudRouterConfig` (`spec`, `schemas.id`, `crud`), and the scope is resolved the way `createCrudRouter` does it (`create-crud-router.ts:46-47`). They are not a sixth `createCrudRouter` slot: its five slots are a fixed contract.

```ts
import type { BulkActionResult } from '@/shared/dal/server/lib/run-bulk'
import type { DalReturn, EntityServerSpec, MaybePromise, ScopedContext } from '@/shared/dal/server/types'

import z from 'zod'

import { BULK_MAX_IDS, runBulk } from '@/shared/dal/server/lib/run-bulk'
import { superAdminProcedure } from '@/trpc/init'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'
import { resolveVisibilityScope } from '@/trpc/lib/middleware/scope-middleware'
import { nonEmptyPatch } from '@/trpc/lib/non-empty-patch'

interface BulkEntity {
  spec: EntityServerSpec
  schemas: { id: z.ZodType<string> }
}

// Scoped like the entity's crud router, so a bulk leaf opened to more roles later still sees only their rows.
function bulkProcedure({ spec, schemas }: BulkEntity) {
  return superAdminProcedure
    .use(async ({ ctx, next }) =>
      next({ ctx: { ...ctx, scope: resolveVisibilityScope(spec, { userId: ctx.session.user.id, ability: ctx.ability }) } }))
    .input(z.object({ ids: z.array(schemas.id).min(1).max(BULK_MAX_IDS) }))
}

interface BulkDeleteConfig<TFacts extends { id: string }, TReason extends string> extends BulkEntity {
  crud: { delete: (ctx: ScopedContext, input: { id: string }) => Promise<DalReturn<void>> }
  /** One read for the whole batch; an id missing from it is skipped as `notFound`. */
  facts: (ctx: ScopedContext, ids: string[]) => Promise<DalReturn<TFacts[]>>
  /** Bulk-delete policy for one row: a skip reason, or null to delete it. */
  classify: (facts: TFacts) => TReason | null
}

export function bulkDeleteProcedure<TFacts extends { id: string }, TReason extends string>(config: BulkDeleteConfig<TFacts, TReason>) {
  return bulkProcedure(config)
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

interface BulkUpdateConfig<TShape extends z.ZodRawShape, TRow> extends BulkEntity {
  crud: { update: (ctx: ScopedContext, input: { id: string, data: z.output<z.ZodObject<TShape>> }) => Promise<DalReturn<TRow>> }
  /** The entity's update schema picked down to the fields a bulk update may write. */
  data: z.ZodObject<TShape>
  afterRun?: (rows: TRow[]) => MaybePromise<void>
}

export function bulkUpdateProcedure<TShape extends z.ZodRawShape, TRow>(config: BulkUpdateConfig<TShape, TRow>) {
  return bulkProcedure(config)
    .input(z.object({ data: nonEmptyPatch(config.data) }))
    .mutation(async ({ ctx, input }): Promise<BulkActionResult> => {
      // Zod 4 can't resolve a generic object's output inside z.object; runtime validation already ran.
      const data = input.data as z.output<z.ZodObject<TShape>>
      const { result, outputs } = await runBulk(input.ids, { run: id => config.crud.update(ctx, { id, data }) })
      await config.afterRun?.(outputs)
      return result
    })
}
```

(tRPC merges chained `.input()` objects, so the update leaf's input is `{ ids, data }`; the repo has no chained-input precedent, so `pnpm tsc` is the check, including `TShape`'s inference from both `data` and `crud.update`. If `pnpm tsc` rejects `EntityServerSpec` for a concrete spec, type the field the way `CreateCrudRouterConfig` does, with the table and id generics.)

- [ ] **Step 3: The skip reasons and the meetings facts read**

Create `src/shared/entities/meetings/constants/delete-skip-reasons.ts`:

```ts
/** Why a delete leaves a meeting alone, worded for the bulk toast. Its keys are the skip reasons the bulk delete returns. */
export const MEETING_DELETE_SKIP_LABELS = {
  hasProposals: 'with proposals',
  hasApplications: 'with applications',
} as const
export type MeetingDeleteSkipReason = keyof typeof MEETING_DELETE_SKIP_LABELS
```

In `src/shared/entities/meetings/dal/server/queries.ts` add `inArray` to the `drizzle-orm` import and the imports:

```ts
import { applications } from '@/shared/db/schema/applications'
import { proposals } from '@/shared/db/schema/proposals'
```

Append:

```ts
export interface MeetingDeleteFacts {
  id: string
  hasProposals: boolean
  hasApplications: boolean
}

/** What a delete decides on, for many meetings in one read. */
export async function getMeetingDeleteFacts(
  ctx: ScopedContext,
  ids: string[],
): Promise<DalReturn<MeetingDeleteFacts[]>> {
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

- [ ] **Step 4: The meetings leaf**

Create `src/trpc/routers/meetings.router/bulk.router.ts`:

```ts
import type { MeetingDeleteSkipReason } from '@/shared/entities/meetings/constants/delete-skip-reasons'

import z from 'zod'

import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { getMeetingDeleteFacts } from '@/shared/entities/meetings/dal/server/queries'
import { meetingSchemas, meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'

import { createTRPCRouter } from '../../init'
import { bulkDeleteProcedure, bulkUpdateProcedure } from '../../lib/bulk-procedures'

const meetingEntity = { spec: meetingServerSpec, schemas: { id: z.string().uuid() } }

export const bulkRouter = createTRPCRouter({
  // A deleted meeting strands its proposals (they reach their customer only through it) and cascades its applications.
  delete: bulkDeleteProcedure({
    ...meetingEntity,
    crud: meetingCrud,
    facts: getMeetingDeleteFacts,
    classify: (facts): MeetingDeleteSkipReason | null =>
      facts.hasProposals ? 'hasProposals' : facts.hasApplications ? 'hasApplications' : null,
  }),
  update: bulkUpdateProcedure({
    ...meetingEntity,
    crud: meetingCrud,
    data: meetingSchemas.update.pick({ setBy: true }),
  }),
})
```

In `src/trpc/routers/meetings.router/index.ts` add `import { bulkRouter } from './bulk.router'` and `bulk: bulkRouter,` after `business: businessRouter,`.

- [ ] **Step 5: Run the check; type-check and lint**

Run: `pnpm exec tsx --test .superpowers/sdd/2026-09-29-records-bulk-actions/tests/bulk-patch.test.ts` → 2 pass.
Run: `pnpm tsc && pnpm lint` → clean.

- [ ] **Step 6: Commit**

```bash
git add src/trpc/lib/non-empty-patch.ts src/trpc/lib/bulk-procedures.ts src/shared/entities/meetings/constants/delete-skip-reasons.ts src/shared/entities/meetings/dal/server/queries.ts src/trpc/routers/meetings.router/bulk.router.ts src/trpc/routers/meetings.router/index.ts
git commit -m "feat(meetings): bulk delete skips meetings with proposals or applications; bulk set setter

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- src/trpc/lib/non-empty-patch.ts src/trpc/lib/bulk-procedures.ts src/shared/entities/meetings/constants/delete-skip-reasons.ts src/shared/entities/meetings/dal/server/queries.ts src/trpc/routers/meetings.router/bulk.router.ts src/trpc/routers/meetings.router/index.ts
git show --stat HEAD
```

---

### Task 6: Proposals, projects and customers bulk leaves

**Files:**
- Create: `src/shared/modules/proposals/core/constants/delete-skip-reasons.ts`
- Create: `src/trpc/routers/proposals.router/bulk.router.ts`
- Modify: `src/trpc/routers/proposals.router/index.ts`
- Create: `src/shared/modules/projects/core/constants/delete-skip-reasons.ts`
- Modify: `src/shared/modules/projects/core/dal/server/queries.ts` (append the facts read)
- Modify: `src/shared/modules/proposals/service.ts` (a `queries` namespace)
- Modify: `src/shared/modules/projects/service.ts` (a `queries` namespace)
- Create: `src/trpc/routers/projects.router/bulk.router.ts`
- Modify: `src/trpc/routers/projects.router/index.ts`
- Modify: `src/trpc/routers/projects.router/crud.router.ts` (the `update` procedure's `revalidatePath` line only)
- Create: `src/shared/entities/customers/constants/delete-skip-reasons.ts`
- Modify: `src/shared/entities/customers/dal/server/queries.ts` (append the facts read)
- Create: `src/trpc/routers/customers.router/bulk.router.ts`
- Modify: `src/trpc/routers/customers.router/index.ts`

**Interfaces:**
- Consumes: `bulkDeleteProcedure`, `bulkUpdateProcedure` (Task 5); `getProposalsByIds`, `getProposalLockState`, `proposalService`, `proposalServerSpec`; `projectsService`, `projectServerSpec`, `projectSchemas`, `hasAssociatedMeeting`; `ROOTS.landing.portfolioProject`.
- Produces: `PROPOSAL_DELETE_SKIP_LABELS`, `ProposalDeleteSkipReason`; `proposalsRouter.bulk.delete({ ids })` → `BulkActionResult<ProposalDeleteSkipReason>`; `PROJECT_DELETE_SKIP_LABELS`, `ProjectDeleteSkipReason`; `getProjectDeleteFacts(ctx, ids): Promise<DalReturn<ProjectDeleteFacts[]>>`; `projectsRouter.bulk.delete({ ids })` → `BulkActionResult<ProjectDeleteSkipReason>`; `projectsRouter.bulk.update({ ids, data: { isPublic } })` → `BulkActionResult`; `CUSTOMER_DELETE_SKIP_LABELS`, `CustomerDeleteSkipReason`; `getCustomerDeleteFacts(ctx, ids)`; `customersRouter.bulk.delete({ ids })` → `BulkActionResult<CustomerDeleteSkipReason>`.

Both leaves reach their module through its service only (settlement 16): writes through the spread CRUD slots, reads through a new `queries` namespace on the root service (`<m>Service.queries.*`, the modules-consolidation shape). Neither service has `queries` yet; this task adds it with the one read each leaf needs.

- [ ] **Step 1: The proposals leaf**

Create `src/shared/modules/proposals/core/constants/delete-skip-reasons.ts`:

```ts
/** Why a delete leaves a proposal alone, worded for the bulk toast. Its keys are the skip reasons the bulk delete returns. */
export const PROPOSAL_DELETE_SKIP_LABELS = {
  notDraft: 'not drafts',
  locked: 'with a contract',
} as const
export type ProposalDeleteSkipReason = keyof typeof PROPOSAL_DELETE_SKIP_LABELS
```

In `src/shared/modules/proposals/service.ts`, import `getProposalsByIds` from `@/shared/modules/proposals/core/dal/server/queries` and add, after `...proposalCrud,`:

```ts
  queries: {
    getProposalsByIds,
  },
```

A DAL import at the top level is fine (the DAL never imports a service, per the file's banner). Replace the banner's last paragraph ("Reads stay in the sub-module DALs …") with: `// Reads are reached through \`queries\`, which re-exports the sub-module DAL reads; a service reads on its own only when it must cross into a peer service or a provider.`

Create `src/trpc/routers/proposals.router/bulk.router.ts`:

```ts
import type { ProposalDeleteSkipReason } from '@/shared/modules/proposals/core/constants/delete-skip-reasons'

import z from 'zod'

import { getProposalLockState } from '@/shared/modules/proposals/core/lib/proposal-lock'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import { proposalService } from '@/shared/modules/proposals/service'

import { createTRPCRouter } from '../../init'
import { bulkDeleteProcedure } from '../../lib/bulk-procedures'

export const bulkRouter = createTRPCRouter({
  // Only an untouched draft goes: a sent proposal is a customer's live link, and an enveloped one is contract evidence.
  delete: bulkDeleteProcedure({
    spec: proposalServerSpec,
    schemas: { id: z.string().uuid() },
    crud: proposalService,
    facts: proposalService.queries.getProposalsByIds,
    classify: (proposal): ProposalDeleteSkipReason | null =>
      proposal.status !== 'draft' ? 'notDraft' : getProposalLockState(proposal) !== 'unlocked' ? 'locked' : null,
  }),
})
```

In `src/trpc/routers/proposals.router/index.ts` add `import { bulkRouter } from './bulk.router'` and `bulk: bulkRouter,` after `business: businessRouter,`. (No proposals UI uses it until R3's bulk step; the leaf lands with its siblings so the three entities stay alike.)

- [ ] **Step 2: The projects skip reasons and facts read**

Create `src/shared/modules/projects/core/constants/delete-skip-reasons.ts`:

```ts
/** Why a delete leaves a project alone, worded for the bulk toast. Its keys are the skip reasons the bulk delete returns. */
export const PROJECT_DELETE_SKIP_LABELS = {
  onPortfolio: 'on the portfolio',
  linkedToMeeting: 'linked to a meeting',
} as const
export type ProjectDeleteSkipReason = keyof typeof PROJECT_DELETE_SKIP_LABELS
```

In `src/shared/modules/projects/core/dal/server/queries.ts` append:

```ts
export interface ProjectDeleteFacts {
  id: string
  isPublic: boolean
  hasMeeting: boolean
}

/** What a delete decides on, for many projects in one read. */
export async function getProjectDeleteFacts(
  ctx: ScopedContext,
  ids: string[],
): Promise<DalReturn<ProjectDeleteFacts[]>> {
  return dalDbOperation(async () =>
    db
      .select({ id: projects.id, isPublic: projects.isPublic, hasMeeting: sql<boolean>`${hasAssociatedMeeting()}` })
      .from(projects)
      .where(and(inArray(projects.id, ids), ctx.scope ?? undefined)),
  )
}
```

(`and`, `inArray`, `sql`, `hasAssociatedMeeting` are imported there today; re-check after the projects plan's Task 4 rewrites this file's imports.)

In `src/shared/modules/projects/service.ts`, import `getProjectDeleteFacts` from `@/shared/modules/projects/core/dal/server/queries` and add, after `...projectCrud,`:

```ts
  queries: {
    getProjectDeleteFacts,
  },
```

- [ ] **Step 3: The projects leaf; one way to name the public page**

Create `src/trpc/routers/projects.router/bulk.router.ts`:

```ts
import type { ProjectDeleteSkipReason } from '@/shared/modules/projects/core/constants/delete-skip-reasons'

import { revalidatePath } from 'next/cache'
import z from 'zod'

import { ROOTS } from '@/shared/config/roots'
import { projectSchemas, projectServerSpec } from '@/shared/modules/projects/core/server-spec'
import { projectsService } from '@/shared/modules/projects/service'

import { createTRPCRouter } from '../../init'
import { bulkDeleteProcedure, bulkUpdateProcedure } from '../../lib/bulk-procedures'

const projectEntity = { spec: projectServerSpec, schemas: { id: z.string().uuid() } }

export const bulkRouter = createTRPCRouter({
  // A public project is on the website; a meeting-linked one is sales history.
  delete: bulkDeleteProcedure({
    ...projectEntity,
    crud: projectsService,
    facts: projectsService.queries.getProjectDeleteFacts,
    classify: (project): ProjectDeleteSkipReason | null =>
      project.isPublic ? 'onPortfolio' : project.hasMeeting ? 'linkedToMeeting' : null,
  }),
  update: bulkUpdateProcedure({
    ...projectEntity,
    crud: projectsService,
    data: projectSchemas.update.pick({ isPublic: true }),
    // The public story page is prerendered; without this, a visibility change shows only after the next deploy.
    afterRun: (rows) => {
      for (const row of rows) {
        revalidatePath(ROOTS.landing.portfolioProject(row.accessor))
      }
    },
  }),
})
```

In `src/trpc/routers/projects.router/index.ts` add `import { bulkRouter } from './bulk.router'` and `bulk: bulkRouter,` after `business: businessRouter,`.

The single-row `update` procedure goes through `updateProjectWithScopes`, which also syncs scopes; the bulk leaf writes only `isPublic`, so `projectsService.update` is the right path and the scope sync is not needed.

In `src/trpc/routers/projects.router/crud.router.ts`, change the `update` procedure's `revalidatePath(\`/portfolio/projects/${project.accessor}\`)` to `revalidatePath(ROOTS.landing.portfolioProject(project.accessor))` and import `ROOTS` from `@/shared/config/roots`, so the path is built in one place (`roots.ts`). Touch nothing else in that file: the projects plan rewrites its `list` procedure.

- [ ] **Step 4: The customers leaf**

Spec §5.1's customers rule (recorded for R2, built now so all four entities' leaves land together; its UI waits for D49's step). Customers is an entity without a service, so the leaf reads its DAL directly (settlement 16).

Create `src/shared/entities/customers/constants/delete-skip-reasons.ts`:

```ts
/** Why a delete leaves a customer alone, worded for the bulk toast. Its keys are the skip reasons the bulk delete returns. */
export const CUSTOMER_DELETE_SKIP_LABELS = {
  hasMeetingsOrProjects: 'with meetings or projects',
} as const
export type CustomerDeleteSkipReason = keyof typeof CUSTOMER_DELETE_SKIP_LABELS
```

In `src/shared/entities/customers/dal/server/queries.ts`, add `inArray` and `sql` to the `drizzle-orm` import, import `meetings` from `@/shared/db/schema/meetings` and `projects` from `@/shared/db/schema/projects`, and append:

```ts
export interface CustomerDeleteFacts {
  id: string
  hasMeetingsOrProjects: boolean
}

/** What a delete decides on, for many customers in one read. */
export async function getCustomerDeleteFacts(
  ctx: ScopedContext,
  ids: string[],
): Promise<DalReturn<CustomerDeleteFacts[]>> {
  return dalDbOperation(async () =>
    db
      .select({
        id: customers.id,
        hasMeetingsOrProjects: sql<boolean>`(
          EXISTS (SELECT 1 FROM ${meetings} WHERE ${meetings.customerId} = ${customers.id})
          OR EXISTS (SELECT 1 FROM ${projects} WHERE ${projects.customerId} = ${customers.id})
        )`,
      })
      .from(customers)
      .where(and(inArray(customers.id, ids), ctx.scope ?? undefined)),
  )
}
```

Create `src/trpc/routers/customers.router/bulk.router.ts`:

```ts
import type { CustomerDeleteSkipReason } from '@/shared/entities/customers/constants/delete-skip-reasons'

import z from 'zod'

import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { getCustomerDeleteFacts } from '@/shared/entities/customers/dal/server/queries'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'

import { createTRPCRouter } from '../../init'
import { bulkDeleteProcedure } from '../../lib/bulk-procedures'

export const bulkRouter = createTRPCRouter({
  // A customer's delete takes its meetings' proposals and its projects with it; only an empty record goes in bulk.
  delete: bulkDeleteProcedure({
    spec: customerServerSpec,
    schemas: { id: z.string().uuid() },
    crud: customerCrud,
    facts: getCustomerDeleteFacts,
    classify: (customer): CustomerDeleteSkipReason | null =>
      customer.hasMeetingsOrProjects ? 'hasMeetingsOrProjects' : null,
  }),
})
```

In `src/trpc/routers/customers.router/index.ts` add `import { bulkRouter } from './bulk.router'` and `bulk: bulkRouter,` after `business: businessRouter,`.

- [ ] **Step 5: Type-check and lint**

Run: `pnpm tsc && pnpm lint` → clean.

- [ ] **Step 6: Commit**

```bash
git add src/shared/modules/proposals/core/constants/delete-skip-reasons.ts src/trpc/routers/proposals.router/bulk.router.ts src/trpc/routers/proposals.router/index.ts src/shared/modules/projects/core/constants/delete-skip-reasons.ts src/shared/modules/projects/core/dal/server/queries.ts src/shared/modules/proposals/service.ts src/shared/modules/projects/service.ts src/trpc/routers/projects.router/bulk.router.ts src/trpc/routers/projects.router/index.ts src/trpc/routers/projects.router/crud.router.ts src/shared/entities/customers/constants/delete-skip-reasons.ts src/shared/entities/customers/dal/server/queries.ts src/trpc/routers/customers.router/bulk.router.ts src/trpc/routers/customers.router/index.ts
git commit -m "feat(bulk): proposals bulk delete keeps sent and enveloped ones; projects bulk delete and portfolio visibility; customers bulk delete keeps any with meetings or projects

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- src/shared/modules/proposals/core/constants/delete-skip-reasons.ts src/trpc/routers/proposals.router/bulk.router.ts src/trpc/routers/proposals.router/index.ts src/shared/modules/projects/core/constants/delete-skip-reasons.ts src/shared/modules/projects/core/dal/server/queries.ts src/shared/modules/proposals/service.ts src/shared/modules/projects/service.ts src/trpc/routers/projects.router/bulk.router.ts src/trpc/routers/projects.router/index.ts src/trpc/routers/projects.router/crud.router.ts src/shared/entities/customers/constants/delete-skip-reasons.ts src/shared/entities/customers/dal/server/queries.ts src/trpc/routers/customers.router/bulk.router.ts src/trpc/routers/customers.router/index.ts
git show --stat HEAD
```

---

## Phase B3 — selection, the bar, meetings

### Task 7: Entity actions — promoted pickers, one toolbar-roles helper, `BulkActionBar`

`hidden`, `isActionPermitted` and `getVisibleActions` landed in `a1d70db1` (the projects plan's Task 6); this task builds on them.

**Files:**
- Modify: `src/shared/components/entities/entity-actions/types.ts` (append `RowSelection`)
- Create: `src/shared/components/entities/entity-actions/constants/bulk-action-permission.ts`
- Modify: `src/shared/components/entities/entity-actions/lib/with-toolbar-roles.ts`
- Create: `src/shared/components/entities/entity-actions/ui/toolbar-button.tsx`
- Create: `src/shared/components/entities/entity-actions/ui/toolbar-popover-button.tsx`
- Modify: `src/shared/components/entities/entity-actions/ui/entity-action-menu.tsx`
- Create: `src/shared/components/entities/entity-actions/ui/bulk-action-bar.tsx`

**Interfaces:**
- Consumes: `getVisibleActions`, `isActionPermitted` (`entity-actions/lib/visible-actions.ts`, landed).
- Produces: `RowSelection = { ids: string[], clear: () => void }`; `BULK_ACTION_PERMISSION: [AppAction, AppSubject]` = `['manage', 'all']`; `withToolbarRoles(actions, { primaryId?, promotedIds? })`; `ToolbarButton` in its own file, honouring `destructive`; toolbar mode renders a promoted `custom` action as `ToolbarPopoverButton`; `BulkActionBar({ selection, actions })`.

- [ ] **Step 1: The selection type and the bulk permission**

Append to `src/shared/components/entities/entity-actions/types.ts`:

```ts
/** What a bulk action receives: the ticked rows' ids, and a way to clear the selection once it ran. */
export interface RowSelection {
  ids: string[]
  clear: () => void
}
```

Create `src/shared/components/entities/entity-actions/constants/bulk-action-permission.ts`:

```ts
import type { AppAction, AppSubject } from '@/shared/domains/permissions/types'

/** Bulk actions are super-admin only: the bulk procedures run on superAdminProcedure whatever the single-row permission is. */
export const BULK_ACTION_PERMISSION: [AppAction, AppSubject] = ['manage', 'all']
```

- [ ] **Step 2: A toolbar with no primary**

In `src/shared/components/entities/entity-actions/lib/with-toolbar-roles.ts`, make `primaryId` optional (`primaryId?: string`). `config.action.id === primaryId` is then false for every action when it is absent, so the bulk bar can promote all of its actions without a primary. Existing callers pass it and are unchanged.

- [ ] **Step 3: `ToolbarButton` in its own file; destructive buttons look destructive**

Move `ToolbarButton` and its `ToolbarButtonProps` out of `entity-action-menu.tsx` into `src/shared/components/entities/entity-actions/ui/toolbar-button.tsx` unchanged (one component per file), export it, and import it in the menu. In its `<Button>`, add `className={cn(config.action.destructive && 'text-destructive hover:text-destructive')}`, importing `cn`. Re-read `entity-action-menu.tsx` first: it changed in `a1d70db1`.

- [ ] **Step 4: Toolbar mode promotes pickers**

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
- import `EntityActionCustomConfig` (type), `isCustomAction` (already imported) and `ToolbarPopoverButton`;
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

- [ ] **Step 5: `BulkActionBar`**

Create `src/shared/components/entities/entity-actions/ui/bulk-action-bar.tsx`:

```tsx
'use client'

import type { EntityActionConfig, RowSelection } from '@/shared/components/entities/entity-actions/types'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo } from 'react'

import { withToolbarRoles } from '@/shared/components/entities/entity-actions/lib/with-toolbar-roles'
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
    () => withToolbarRoles(actions, { promotedIds: actions.map(config => config.action.id) }),
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

(Colour classes must pass the `theme-tokens/palette` lint rule; `bg-card`, `border-border` are tokens.)

- [ ] **Step 6: Type-check, lint, and a regression read**

Run: `pnpm tsc && pnpm lint` → clean. In the browser, the meetings expanded row's action bar still shows Start Meeting, Create Proposal and More; a destructive action promoted in a toolbar reads red.

- [ ] **Step 7: Commit**

```bash
git add src/shared/components/entities/entity-actions/types.ts src/shared/components/entities/entity-actions/constants/bulk-action-permission.ts src/shared/components/entities/entity-actions/lib/with-toolbar-roles.ts src/shared/components/entities/entity-actions/ui/toolbar-button.tsx src/shared/components/entities/entity-actions/ui/toolbar-popover-button.tsx src/shared/components/entities/entity-actions/ui/entity-action-menu.tsx src/shared/components/entities/entity-actions/ui/bulk-action-bar.tsx
git commit -m "feat(entity-actions): promoted pickers, an optional primary, the bulk action bar

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- src/shared/components/entities/entity-actions/types.ts src/shared/components/entities/entity-actions/constants/bulk-action-permission.ts src/shared/components/entities/entity-actions/lib/with-toolbar-roles.ts src/shared/components/entities/entity-actions/ui/toolbar-button.tsx src/shared/components/entities/entity-actions/ui/toolbar-popover-button.tsx src/shared/components/entities/entity-actions/ui/entity-action-menu.tsx src/shared/components/entities/entity-actions/ui/bulk-action-bar.tsx
git show --stat HEAD
```

---

### Task 8: `DataTable` owns row selection

Rewritten 2026-10-02 against the render-isolation code. Selection reaches each memoized `DataTableRow` as a prop, like `isExpanded`; no row or cell reads `row.getIsSelected()` while rendering (D49, the `data-table.tsx` meta doc). Rules kept: the checkbox sits in the frozen primary cell beside the chevron; the header holds a tri-state "select page" box; page / page-size / sort changes clear the selection; ids a filter or search removes are pruned in state (`pruneRowSelection`, settlement 6); a checkbox tap never toggles the row or fires `onRowClick` (the existing `isRowClick` guard already treats `label` and `[role=checkbox]` as interactive, so no new guard is needed).

**Files:**
- Create: `src/shared/components/data-table/lib/prune-row-selection.ts`
- Modify: `src/shared/components/ui/checkbox.tsx`
- Modify: `src/shared/components/data-table/ui/data-table.tsx`
- Modify: `src/shared/components/data-table/ui/data-table-body.tsx`
- Modify: `src/shared/components/data-table/ui/data-table-row.tsx` (had another session's uncommitted `tintClassName` edit on 2026-10-02: stop and ask if it is still uncommitted)
- Test (throwaway): `.superpowers/sdd/2026-09-29-records-bulk-actions/tests/prune-row-selection.test.ts`

**Interfaces:**
- Consumes: `RowSelection`, `isActionPermitted`, `BulkActionBar` (Task 7).
- Produces: `DataTableProps.bulkActions?: EntityActionConfig<RowSelection>[]`; `pruneRowSelection(selection, rowIds): RowSelectionState`; `Checkbox` renders `checked="indeterminate"` with a minus glyph; `DataTableBody` prop `canSelect: boolean`; `DataTableRow` props `canSelect: boolean`, `isSelected: boolean`.

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

(sorted into the existing groups the way `pnpm lint` wants them).

`DataTableProps`, after `columnVisibility?`:

```tsx
  /** Actions on the ticked rows. Checkboxes show only when the viewer may run at least one. */
  bulkActions?: EntityActionConfig<RowSelection>[]
```

Destructure `bulkActions` in the component signature. After `const [expanded, setExpanded] = useState<ExpandedState>({})` (`:99`):

```tsx
  const ability = useAbility()
  const permittedBulkActions = useMemo(
    () => (bulkActions ?? []).filter(config => isActionPermitted(config.action, ability)),
    [bulkActions, ability],
  )
  const canSelect = permittedBulkActions.length > 0
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  // Same render-phase pattern as the expansion reset: a filter, search or refetch that drops a row drops its tick.
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

In `useReactTable({ … })` (`:224-289`): add `rowSelection,` to `state` after `expanded,`; add after `onExpandedChange: setExpanded,`:

```tsx
    onRowSelectionChange: setRowSelection,
    enableRowSelection: canSelect,
```

In the reset block (`:291-298`), add `setRowSelection({})` after `setExpanded({})` and extend its comment: `… without going through this table's handlers. Selection clears with expansion.`

- [ ] **Step 5: The header "select page" checkbox**

In the header's `isFirstCol` branch (`:369-396`), insert as the first child of `<div className="flex items-center gap-1">`, before `<div className="min-w-0 flex-1">`:

```tsx
                                {canSelect && (
                                  <label className="-m-1.5 flex shrink-0 cursor-pointer items-center p-1.5">
                                    <Checkbox
                                      checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? 'indeterminate' : false}
                                      onCheckedChange={value => table.toggleAllPageRowsSelected(value === true)}
                                      aria-label={`Select every ${entityName} on this page`}
                                    />
                                  </label>
                                )}
```

The header is not memoized, so reading table state here is allowed.

- [ ] **Step 6: The bar's place**

Wrap the existing scroller `div` (`:324-465`, `ref={scrollRef}` through its closing tag) in a `relative` box and float the bar over its bottom. **Keep the scroller's current classes exactly** (`group/scroller`, the `*:data-[slot=table-container]:@container` comment and class, the resize cursor); only add the padding line:

```tsx
        <div className="relative grow min-h-0 flex flex-col">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className={cn(
              /* …the current classes and comments, unchanged… */
              // Room for the bar, so the last row can scroll clear of it.
              selectedIds.length > 0 && 'pb-16',
            )}
          >
            {/* The current <Table>…</Table>, unchanged. */}
          </div>
          {canSelect && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-4">
              <BulkActionBar selection={selection} actions={permittedBulkActions} />
            </div>
          )}
        </div>
```

`<DataTablePagination …/>` stays after it, inside the outer `surface` card. Pass `canSelect={canSelect}` to `<DataTableBody … />`.

- [ ] **Step 7: Selection as a row prop**

In `src/shared/components/data-table/ui/data-table-body.tsx`: add `canSelect: boolean` to `DataTableBodyProps` and destructure it; in the `rows.map` (`:107-127`), beside `const isExpanded = row.getIsExpanded()`, read `const isSelected = canSelect && row.getIsSelected()` and pass `canSelect={canSelect}` and `isSelected={isSelected}` to `<DataTableRow>`. The body reads state in its own render, as it already does for expansion; `areRowPropsEqual` compares every non-`row` prop, so only the toggled row re-renders.

In `src/shared/components/data-table/ui/data-table-row.tsx`:
- import `import { Checkbox } from '@/shared/components/ui/checkbox'`;
- add to `DataTableRowProps` after `isExpanded: boolean`:

```tsx
  canSelect: boolean
  isSelected: boolean
```

  and destructure both;
- beside `expandToggle`, build:

```tsx
  const selectToggle = canSelect
    ? (
        // The label widens the tap target; `isRowClick` treats it as interactive, so a tap never toggles the row.
        <label className="-m-1.5 flex shrink-0 cursor-pointer items-center p-1.5">
          <Checkbox
            checked={isSelected}
            onCheckedChange={value => row.toggleSelected(value === true)}
            aria-label="Select row"
          />
        </label>
      )
    : null
```

- the status tint steps aside on a selected row as it does on hover: `const tintClassName = rowClassName && cn(rowClassName, 'group-hover:bg-transparent group-data-[state=selected]:bg-transparent')`;
- the first `TableRow` gains `data-state={isSelected ? 'selected' : undefined}` (`TableRow` already styles `data-[state=selected]:bg-row-selected`, `ui/table.tsx:60`);
- the first-cell composition becomes:

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

`row.toggleSelected` runs in the event handler only, the same way the chevron calls `row.toggleExpanded()`.

- [ ] **Step 8: Type-check, lint, tests**

Run: `pnpm tsc && pnpm lint` → clean. Run the prune test → pass.

- [ ] **Step 9: Browser regression read (no consumer passes `bulkActions` yet)**

As a super-admin, with screenshots per Global Constraints: `/dashboard/meetings` shows no checkboxes yet, rows still expand, the pin toggle still freezes the first column, the status tints still show; `/dashboard/customers` row click still opens the profile; campaign leads still shows its own select column (replaced in Task 10). Re-run `node scripts/perf/records-probe.mjs /dashboard/meetings < /dev/null`: expand still re-renders one row, modal open/close zero.

- [ ] **Step 10: Commit**

```bash
git add src/shared/components/data-table/lib/prune-row-selection.ts src/shared/components/ui/checkbox.tsx src/shared/components/data-table/ui/data-table.tsx src/shared/components/data-table/ui/data-table-body.tsx src/shared/components/data-table/ui/data-table-row.tsx
git commit -m "feat(data-table): row selection owned by the table — checkbox in the primary cell, select page, the bulk bar

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- src/shared/components/data-table/lib/prune-row-selection.ts src/shared/components/ui/checkbox.tsx src/shared/components/data-table/ui/data-table.tsx src/shared/components/data-table/ui/data-table-body.tsx src/shared/components/data-table/ui/data-table-row.tsx
git show --stat HEAD
```

---

### Task 9: Meetings — bulk actions and Set Setter

The records page and its shell are the projects plan's Task 3 (`useEntityTable`, `EntityRecordsTable`, `MeetingsTable` deleted). This task wires into them.

**Files:**
- Create: `src/shared/components/entities/entity-actions/constants/bulk-not-found-label.ts`
- Create: `src/shared/components/entities/entity-actions/lib/describe-bulk-action-result.ts`
- Modify: `src/shared/hooks/use-confirm.tsx`
- Modify: `src/shared/entities/meetings/constants/actions.ts`
- Create: `src/shared/entities/meetings/constants/bulk-actions.ts`
- Modify: `src/shared/entities/meetings/hooks/use-meeting-actions.ts`
- Modify: `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx`
- Create: `src/shared/entities/meetings/hooks/use-meeting-bulk-action-configs.tsx`
- Modify: `src/shared/entities/meetings/components/meetings-table/use-meetings-table.tsx`
- Test (throwaway): `.superpowers/sdd/2026-09-29-records-bulk-actions/tests/describe-bulk-action-result.test.ts`

**Interfaces:**
- Consumes: `meetingsRouter.bulk.{delete,update}`, `MEETING_DELETE_SKIP_LABELS` (Task 5); `SetterPicker`, `SET_BY_NOT_INTERNAL` (Tasks 1, 3); `BULK_ACTION_PERMISSION`, `RowSelection` (Task 7); `DataTableProps.bulkActions` (Task 8).
- Produces: `describeBulkActionResult(result, verb, reasonLabels): { message, tone: 'success' | 'warning' | 'error' }`; `BULK_NOT_FOUND_LABEL`; `useConfirm(defaults)` returning `confirm(copy?: Partial<{ title, message }>)`; `MEETING_ACTIONS.setSetter`; `MEETING_BULK_ACTIONS`; `useMeetingActions()` gains `updateSetter`, `bulkDeleteMeetings`, `bulkSetSetter`; `useMeetingActionConfigs` gains Set Setter (hidden without `setBy`) and `MeetingEntity.setBy?`; `useMeetingBulkActionConfigs(): { bulkActions: EntityActionConfig<RowSelection>[], dialogs: ReactNode }`.

- [ ] **Step 1: Write the failing test**

Create `.superpowers/sdd/2026-09-29-records-bulk-actions/tests/describe-bulk-action-result.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { describeBulkActionResult } from '@/shared/components/entities/entity-actions/lib/describe-bulk-action-result'

const labels = { hasProposals: 'with proposals' }

test('all done is a success', () => {
  assert.deepEqual(
    describeBulkActionResult({ done: ['a', 'b', 'c'], skipped: [], failed: [] }, 'Deleted', labels),
    { message: 'Deleted 3', tone: 'success' },
  )
})

test('everything skipped for one reason still reports the zero, as a warning', () => {
  const result = { done: [], skipped: [{ id: 'a', reason: 'hasProposals' }, { id: 'b', reason: 'hasProposals' }, { id: 'c', reason: 'hasProposals' }], failed: [] }
  assert.deepEqual(describeBulkActionResult(result, 'Deleted', labels), { message: 'Deleted 0 · skipped 3 (with proposals)', tone: 'warning' })
})

test('mixed reasons are counted, notFound needs no label, and a failure makes it an error', () => {
  const result = {
    done: ['a', 'b'],
    skipped: [{ id: 'c', reason: 'hasProposals' }, { id: 'd', reason: 'hasProposals' }, { id: 'e', reason: 'notFound' }],
    failed: [{ id: 'f', error: 'db-error' }],
  }
  assert.deepEqual(
    describeBulkActionResult(result, 'Deleted', labels),
    { message: 'Deleted 2 · skipped 3 (2 with proposals, 1 no longer there) · 1 failed', tone: 'error' },
  )
})
```

Run: `pnpm exec tsx --test .superpowers/sdd/2026-09-29-records-bulk-actions/tests/describe-bulk-action-result.test.ts` → FAIL.

- [ ] **Step 2: Describing a result**

Create `src/shared/components/entities/entity-actions/constants/bulk-not-found-label.ts`:

```ts
/** Every bulk procedure can skip a row that vanished between the page load and the run. */
export const BULK_NOT_FOUND_LABEL = 'no longer there'
```

Create `src/shared/components/entities/entity-actions/lib/describe-bulk-action-result.ts` (pure; the toast happens at the mutation):

```ts
import type { BulkActionResult } from '@/shared/dal/server/lib/run-bulk'

import { BULK_NOT_FOUND_LABEL } from '@/shared/components/entities/entity-actions/constants/bulk-not-found-label'

/** "Deleted 2 · skipped 3 (2 with proposals, 1 no longer there) · 1 failed", and how loudly to say it: a run that changed nothing warns rather than celebrates. */
export function describeBulkActionResult(
  result: BulkActionResult<string>,
  verb: string,
  reasonLabels: Readonly<Record<string, string>>,
): { message: string, tone: 'success' | 'warning' | 'error' } {
  const parts = [`${verb} ${result.done.length}`]
  if (result.skipped.length > 0) {
    const counts = new Map<string, number>()
    for (const { reason } of result.skipped) {
      counts.set(reason, (counts.get(reason) ?? 0) + 1)
    }
    const reasons = [...counts].map(([reason, count]) => {
      const label = reason === 'notFound' ? BULK_NOT_FOUND_LABEL : reasonLabels[reason] ?? reason
      return counts.size === 1 ? label : `${count} ${label}`
    })
    parts.push(`skipped ${result.skipped.length} (${reasons.join(', ')})`)
  }
  if (result.failed.length > 0) {
    parts.push(`${result.failed.length} failed`)
  }
  const tone = result.failed.length > 0 ? 'error' : result.done.length === 0 ? 'warning' : 'success'
  return { message: parts.join(' · '), tone }
}
```

Run the Step 1 test → 3 pass.

- [ ] **Step 3: A confirm whose words fit this call**

In `src/shared/hooks/use-confirm.tsx`, let `confirm` take per-call copy, so a bulk confirm can name its count without a state variable at each caller. Existing callers call `confirm()` and are unchanged:

```tsx
interface ConfirmCopy {
  title: string
  message: string
}

export function useConfirm(defaults: ConfirmCopy): [() => JSX.Element, (copy?: Partial<ConfirmCopy>) => Promise<boolean>] {
  const [promise, setPromise] = useState<{ resolve: (value: boolean) => void } | null>(null)
  // Kept after close, so the dialog's exit animation still shows the words it opened with.
  const [copy, setCopy] = useState<ConfirmCopy>(defaults)

  const confirm = (overrides?: Partial<ConfirmCopy>) => {
    setCopy({ ...defaults, ...overrides })
    return new Promise<boolean>((resolve) => {
      setPromise({ resolve })
    })
  }
```

and render `copy.title` / `copy.message` in `DialogTitle` / `DialogDescription` instead of `title` / `message`. The rest of the hook is unchanged.

- [ ] **Step 4: The action and the mutations**

In `src/shared/entities/meetings/constants/actions.ts` add `UserPenIcon` to the lucide import and, after `assignOwner`:

```ts
  setSetter: {
    id: 'setSetter',
    label: 'Set Setter',
    icon: UserPenIcon,
    permission: ['assign', 'Meeting'],
  },
```

Create `src/shared/entities/meetings/constants/bulk-actions.ts` (module constants, so `useStableCallbacks` sees the same `action` objects every render; an inline `{ ...MEETING_ACTIONS.x, permission }` is new each render and re-renders the bar):

```ts
import type { EntityAction } from '@/shared/components/entities/entity-actions/types'

import { BULK_ACTION_PERMISSION } from '@/shared/components/entities/entity-actions/constants/bulk-action-permission'
import { MEETING_ACTIONS } from '@/shared/entities/meetings/constants/actions'

/** The bulk twins of the single-row actions: same words and icons, the bulk permission. */
export const MEETING_BULK_ACTIONS = {
  setSetter: { ...MEETING_ACTIONS.setSetter, permission: BULK_ACTION_PERMISSION },
  delete: { ...MEETING_ACTIONS.delete, permission: BULK_ACTION_PERMISSION },
} as const satisfies Record<string, EntityAction>
```

In `src/shared/entities/meetings/hooks/use-meeting-actions.ts` add the imports:

```ts
import { describeBulkActionResult } from '@/shared/components/entities/entity-actions/lib/describe-bulk-action-result'
import { MEETING_DELETE_SKIP_LABELS } from '@/shared/entities/meetings/constants/delete-skip-reasons'
import { SET_BY_NOT_INTERNAL } from '@/shared/entities/meetings/constants/set-by-not-internal'
```

Before the `return`:

```ts
  const updateSetter = useMutation(
    trpc.meetingsRouter.crud.update.mutationOptions({
      onSuccess: () => {
        invalidateMeeting()
        toast.success('Setter updated')
      },
      onError: err => toast.error(err.message === SET_BY_NOT_INTERNAL.reason ? SET_BY_NOT_INTERNAL.message : 'Failed to update setter'),
    }),
  )

  const bulkDeleteMeetings = useMutation(
    trpc.meetingsRouter.bulk.delete.mutationOptions({
      onSuccess: (result) => {
        invalidateMeeting()
        const { message, tone } = describeBulkActionResult(result, 'Deleted', MEETING_DELETE_SKIP_LABELS)
        toast[tone](message)
      },
      onError: err => toast.error(err.message || 'Failed to delete meetings'),
    }),
  )

  const bulkSetSetter = useMutation(
    trpc.meetingsRouter.bulk.update.mutationOptions({
      onSuccess: (result) => {
        invalidateMeeting()
        const { message, tone } = describeBulkActionResult(result, 'Updated', {})
        toast[tone](message)
      },
      onError: err => toast.error(err.message || 'Failed to update setters'),
    }),
  )
```

and add `updateSetter, bulkDeleteMeetings, bulkSetSetter` to the returned object. In the existing `rescheduleMeeting`, change `onError` to word the setter refusal (Task 1 Step 5 sends it through):

```ts
      onError: err => toast.error(err.message === SET_BY_NOT_INTERNAL.reason ? SET_BY_NOT_INTERNAL.message : err.message || 'Failed to reschedule meeting'),
```

- [ ] **Step 5: Single-row Set Setter, hidden where the row has no setter**

In `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx`:
- import `import { SetterPicker } from '@/shared/entities/meetings/components/setter-picker'`;
- `MeetingEntity`: add `setBy?: string | null` (absent = this caller's rows don't carry the setter);
- add `updateSetter` to the `useMeetingActions()` destructure;
- before the `configs.push({ action: MEETING_ACTIONS.delete, … })`:

```tsx
  configs.push({
    action: MEETING_ACTIONS.setSetter,
    type: 'custom',
    isLoading: updateSetter.isPending,
    // A caller whose rows don't carry the setter can't show the current one, so the action stays out.
    hidden: entity => entity.setBy === undefined,
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
```

`hidden` reads only its argument (Global Constraints). The configs already go through `useStableCallbacks`; there is no dependency list to extend. The action shows wherever a row carries `setBy`: the records table (`listMeetings` selects every column), and any other caller whose read does the same at runtime even if its type omits the field (check the customer profile's meetings read, `get-customer-profile.ts`, at build time). Its `assign Meeting` permission keeps it super-admin only everywhere.

- [ ] **Step 6: The bulk configs**

Create `src/shared/entities/meetings/hooks/use-meeting-bulk-action-configs.tsx`:

```tsx
'use client'

import type { EntityActionConfig, RowSelection } from '@/shared/components/entities/entity-actions/types'

import { SetterPicker } from '@/shared/entities/meetings/components/setter-picker'
import { MEETING_BULK_ACTIONS } from '@/shared/entities/meetings/constants/bulk-actions'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { useStableCallbacks } from '@/shared/hooks/use-stable-callbacks'

import { useMeetingActions } from './use-meeting-actions'

export function useMeetingBulkActionConfigs() {
  const { bulkDeleteMeetings, bulkSetSetter } = useMeetingActions()
  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: 'Delete meetings?',
    message: 'Meetings with proposals or applications are skipped. This cannot be undone.',
  })

  const configs: EntityActionConfig<RowSelection>[] = [
    {
      action: MEETING_BULK_ACTIONS.setSetter,
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
      action: MEETING_BULK_ACTIONS.delete,
      isLoading: bulkDeleteMeetings.isPending,
      onAction: async (selection) => {
        const count = selection.ids.length
        if (await confirmDelete({ title: `Delete ${count} ${count === 1 ? 'meeting' : 'meetings'}?` })) {
          bulkDeleteMeetings.mutate({ ids: selection.ids }, { onSuccess: selection.clear })
        }
      },
    },
  ]

  // Callbacks always reach the latest mutations; only the loading flags (values) re-render the bar.
  const bulkActions = useStableCallbacks(configs)

  return { bulkActions, dialogs: <DeleteConfirmDialog /> }
}
```

- [ ] **Step 7: Wire the meetings table**

In `src/shared/entities/meetings/components/meetings-table/use-meetings-table.tsx` (as the projects plan's Task 3 leaves it):
- call `const { bulkActions, dialogs: bulkDialogs } = useMeetingBulkActionConfigs()`;
- add `bulkActions` to the hook's `dataTableProps` (Task 8's `DataTableProps.bulkActions`);
- add `{bulkDialogs}` to the hook's `dialogs`.

- [ ] **Step 8: Type-check, lint, tests**

Run: `pnpm tsc && pnpm lint` → clean. Re-run the throwaway tests → all pass.

- [ ] **Step 9: Browser check — super-admin (read-only)**

On `/dashboard/meetings` (desktop, then a 390px viewport):
1. Each row's first cell shows a checkbox left of the chevron; ticking it neither expands the row nor scrolls; the header checkbox goes indeterminate, then ticks the whole page.
2. The bar shows "N selected · Set Setter · Delete · Clear"; Set Setter opens the picker in a popover; Delete opens "Delete N meetings?" — press **Cancel**; Clear hides the bar.
3. Changing page, page size or sort clears the ticks; searching away a ticked row and clearing the search shows it un-ticked (Review Focus 3).
4. A row's More menu has "Set Setter" with the picker (checkmark on the current setter, or on "No setter"); at 390px the picker stays on screen.
5. The Setter column (turned on) reads the same as the picker's checkmark.

- [ ] **Step 10: Browser check — agent, and the owner's write check**

As an agent, then as a dispatcher: no checkboxes, no bar, no Set Setter in the row menu, no Setter column or filter (Review Focus 1). Screenshots per Global Constraints.
Owner-designated rows only: the owner ticks one meeting with a proposal and one without, runs Delete → toast "Deleted 1 · skipped 1 (with proposals)"; ticks two meetings and sets "No setter" → toast "Updated 2", the Setter column shows "—" (Review Focus 4, 5).

- [ ] **Step 11: Commit**

```bash
git add src/shared/components/entities/entity-actions/constants/bulk-not-found-label.ts src/shared/components/entities/entity-actions/lib/describe-bulk-action-result.ts src/shared/hooks/use-confirm.tsx src/shared/entities/meetings/constants/actions.ts src/shared/entities/meetings/constants/bulk-actions.ts src/shared/entities/meetings/hooks/use-meeting-actions.ts src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx src/shared/entities/meetings/hooks/use-meeting-bulk-action-configs.tsx src/shared/entities/meetings/components/meetings-table/use-meetings-table.tsx
git commit -m "feat(meetings): bulk delete and set setter on the records table; Set Setter per row

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- src/shared/components/entities/entity-actions/constants/bulk-not-found-label.ts src/shared/components/entities/entity-actions/lib/describe-bulk-action-result.ts src/shared/hooks/use-confirm.tsx src/shared/entities/meetings/constants/actions.ts src/shared/entities/meetings/constants/bulk-actions.ts src/shared/entities/meetings/hooks/use-meeting-actions.ts src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx src/shared/entities/meetings/hooks/use-meeting-bulk-action-configs.tsx src/shared/entities/meetings/components/meetings-table/use-meetings-table.tsx
git show --stat HEAD
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

import { LEAD_BULK_ACTIONS } from '@/features/campaigns-admin/constants/lead-bulk-actions'
import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { BulkEnrollForm } from '@/features/campaigns-admin/ui/components/leads/bulk-enroll-form'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { useStableCallbacks } from '@/shared/hooks/use-stable-callbacks'

export function useLeadBulkActionConfigs(campaigns: VoipCampaign[]) {
  const { disqualifyBulk, markDnc, removeBulk } = useCampaignMutations()
  const [ConfirmDialog, confirm] = useConfirm({
    message: 'This affects every selected lead and stops/curates their dialer calls.',
    title: 'Apply to selected leads?',
  })

  const configs: EntityActionConfig<RowSelection>[] = [
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
  ]

  // Callbacks, `renderContent` included, always reach the latest `campaigns` and mutations; only the loading flags (values) re-render the bar.
  const bulkActions = useStableCallbacks(configs)

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

On the campaigns admin Leads view (screenshots per Global Constraints): the name column carries the checkbox; ticking it does **not** open the lead drawer (Review Focus 2); clicking elsewhere on the row still opens it; the bar shows Enroll, Remove, Disqualify, Mark DNC, Clear; Enroll opens the campaign picker in place; Disqualify and Mark DNC ask to confirm — press Cancel. Paging clears the ticks (per-page selection, D41). No action runs unless the owner designates leads.

- [ ] **Step 7: Commit**

```bash
git add src/features/campaigns-admin/constants/lead-bulk-actions.ts src/features/campaigns-admin/ui/components/leads/bulk-enroll-form.tsx src/features/campaigns-admin/hooks/use-lead-bulk-action-configs.tsx src/features/campaigns-admin/ui/views/campaigns-leads-view.tsx src/features/campaigns-admin/ui/lib/leads-columns.tsx
git commit -m "refactor(campaigns): leads use the table's selection and bulk bar; the hand-rolled select column and bar go

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- src/features/campaigns-admin/constants/lead-bulk-actions.ts src/features/campaigns-admin/ui/components/leads/bulk-enroll-form.tsx src/features/campaigns-admin/hooks/use-lead-bulk-action-configs.tsx src/features/campaigns-admin/ui/views/campaigns-leads-view.tsx src/features/campaigns-admin/ui/lib/leads-columns.tsx src/features/campaigns-admin/ui/components/leads/lead-select-cell.tsx src/features/campaigns-admin/ui/components/leads/lead-select-header.tsx src/features/campaigns-admin/ui/components/leads/leads-bulk-action-bar.tsx src/features/campaigns-admin/ui/components/leads/bulk-enroll-popover.tsx
git show --stat HEAD
```

---

## Phase B5 — projects (R4): moved

Tasks 11–13 are replaced by `docs/superpowers/plans/2026-10-01-projects-entity-table.md`. Task 14 (projects bulk: show, hide and delete on the records table, `useProjectBulkActionConfigs`) moves to D49's all-tables bulk step and is planned there against that plan's `useProjectsTable`, with the corrections above: `useStableCallbacks`, `useConfirm` copy per call, `describeBulkActionResult`, and `PROJECT_DELETE_SKIP_LABELS` (Task 6). The removed text is in git history (`f49749f8`).

---

## Phase B7 (partial) — hand-off

### Task 15: Docs, tracker, spec

**Files:**
- Modify: `src/shared/components/data-table/types.ts:44-49`
- Modify: `src/shared/components/data-table/hooks/use-table-url-filters.ts:9-16`
- Modify: `CONTEXT.md:62`
- Modify: `docs/plans/2026-09-26-records-management-epic.md`
- Modify: `docs/superpowers/specs/2026-09-28-records-bulk-actions-and-entity-tables-design.md`

Re-read each file first: the projects plan's hand-off (its Task 9) and later R2/R3 work edit the same tracker rows. Edit only what this plan built.

- [ ] **Step 1: Stale deprecation text**

In `data-table/types.ts`, replace the `@deprecated` block above `DataTableFilterConfig` with:

```ts
/**
 * @deprecated No table filters on the client any more: tables read through `useDataViewQuery` and
 * `<QueryToolbar>`. Kept only until DataTable's client-filter path is deleted.
 */
```

In `use-table-url-filters.ts`, replace the `@deprecated` lead line with `@deprecated Use \`useDataViewQuery\` + \`<QueryToolbar>\` for new tables.` and delete the list of legacy callers under it if `grep -rn "useTableUrlFilters" src` shows none of them use it any more.

- [ ] **Step 2: Glossary**

In `CONTEXT.md:62` (Setter row), replace the code cell `\`meetings.setBy\` (planned, analytics Spec D; not built)` with `\`meetings.setBy\` · picked on the add-meeting form, else the meeting's creator; kept by a duplicate and a reschedule; only super-admins change it, per row or in bulk`.

- [ ] **Step 3: Records tracker**

In `docs/plans/2026-09-26-records-management-epic.md`:
- O8 row → built for the tables this step covered (list the commit range);
- H2: replace `loadPaginatedQueryInput` / `usePaginatedQuery` with `loadDataViewQueryInput` / `useDataViewQuery` if it still names them;
- if no item covers it yet, add one: `DataTable`'s client-side filter path (`filterConfig`, `DataTableFilterBar`, time presets, `getPaginationRowModel`) has no callers; delete it. (The legacy query path's deletion is already D49's last step.)

D42, D47, spec §1 and §4.4 already record that a duplicate keeps the setter (fixed 2026-10-02).

- [ ] **Step 4: Spec**

In the spec, add under the header a `> **Plan:** \`docs/superpowers/plans/2026-09-29-records-bulk-actions-setter-projects.md\` (setter, bulk server, selection, meetings and campaign-leads bulk; projects moved to \`2026-10-01-projects-entity-table.md\`).` line. Mirror the plan-time settlements into the text they amend:
- §4.2: the invariant runs for every origin; the role lists derive from CASL (settlements 3, 13);
- §4.4: an unpicked setter is the creator (D53); the lead-sources admin and public intake rows leave this spec (D56; external setters deferred, D58); only super-admins change a setter (D54);
- §5.2 and §11: module reads go through `<m>Service.queries` (D55); customers' bulk leaf is built (Task 6); campaign leads stays on the legacy query path (D57);
- §4.5: `SetterPicker` and `SetterSelect` on `UserCommandItem` replace the `InternalUserPicker` bullets; Set Setter as the owner decided (settlements 1, 2);
- §5.2: the builders take `spec` and `schemas.id`; skip reasons come from each entity's labels (settlements 11, 12);
- §5.3–5.4: the bulk permission constant, promoted pickers, state-level pruning (settlements 4–6).

- [ ] **Step 5: Verify and commit**

Run: `pnpm tsc && pnpm lint` → clean.

```bash
git add src/shared/components/data-table/types.ts src/shared/components/data-table/hooks/use-table-url-filters.ts CONTEXT.md docs/plans/2026-09-26-records-management-epic.md docs/superpowers/specs/2026-09-28-records-bulk-actions-and-entity-tables-design.md
git commit -m "docs(records): setter and bulk actions shipped; spec and tracker follow the plan-time settlements

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- src/shared/components/data-table/types.ts src/shared/components/data-table/hooks/use-table-url-filters.ts CONTEXT.md docs/plans/2026-09-26-records-management-epic.md docs/superpowers/specs/2026-09-28-records-bulk-actions-and-entity-tables-design.md
git show --stat HEAD
```

---

## Self-review notes (kept for the executor)

- **Spec coverage.** §4.1 → Task 1; §4.2 → Tasks 1–2; §4.3 → Task 2; §4.4 → Tasks 1, 3; §4.5 → Tasks 2, 3, 9; §5.1–5.2 → Tasks 4–6; §5.3 → Task 8; §5.4 → Tasks 7, 9; §5.5 → Task 9; §6 → R3; §7 → the projects plan, plus projects bulk at D49's step; §8 → the projects plan (shared hook and records page; no `RecordCustomerPane`, D51); §9 → Task 10; §10 → Tasks 4, 5, 9 (toasts); §11 → Global Constraints + Task 15; §12 → every task's verification.
- **Type consistency.** `RowSelection` (Task 7) is the entity of every bulk config (Tasks 9, 10) and of the table's bulk prop (Task 8). `BulkActionResult` (Task 4) is what `bulkDeleteProcedure` / `bulkUpdateProcedure` return (Task 5) and what `describeBulkActionResult` reads (Task 9). Each entity's `*_DELETE_SKIP_LABELS` keys are its skip-reason type, which its router's `classify` returns (Tasks 5, 6), so a renamed reason fails `pnpm tsc`.
- **Order.** Task 5 needs Task 1's column (the update schema must contain `setBy`); Task 9 needs Tasks 2, 3, 5, 7, 8 and the projects plan's Task 3; Task 10 needs Tasks 7 and 8. B2 (Tasks 4–6) can run in parallel with Task 3. Task 6's projects half runs after the projects plan's Task 4 (both edit `projects.router/crud.router.ts` and `projects/core/dal/server/queries.ts`).
