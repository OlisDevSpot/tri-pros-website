# Meetings Setter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every meeting records its setter (who booked it): picked by a super-admin on the add-meeting form, otherwise the meeting's creator; super-admins see it as a column and a filter on the meetings records table and change it per row.

**Architecture:** A nullable `meetings.set_by` user FK. The meetings crud hooks own the rules (default to the creator, the setter must be on the team, only super-admins change it), so every write path obeys them. The role lists are read off the CASL abilities. The candidates read, the `setters` option source, the `setter` field (filter + sort) and the Setter column all read through one place each, which is where an external setter joins later (tracker D58). One `SetterPicker` serves the form and the row action.

**Tech Stack:** Next.js 15 App Router, tRPC v11, Drizzle + Postgres (Neon), Zod 4, drizzle-zod, TanStack Table/Query, CASL, shadcn/ui (Radix, cmdk), pnpm, `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-28-records-bulk-actions-and-entity-tables-design.md` §4 (v3, approved for planning 2026-09-29), as amended by the records tracker `docs/plans/2026-09-26-records-management-epic.md` **D42, D47, D53–D56, D58, D59**. This plan is Phase B1 of `docs/superpowers/plans/2026-09-29-records-bulk-actions-setter-projects.md` (its Tasks 1–3) plus the single-row Set Setter parts of its Task 9, cut out by D59 (2026-10-05) and re-checked against the code at `c34bb7d7`. Bulk Set Setter stays in that plan.

**What changed from the bulk plan's text (2026-10-05 re-check):**
1. The dev schema push moves to right after the column step. Every meetings read selects all of the table's columns, so between saving the schema file and the push the running dev server fails every meetings query.
2. A duplicate's error toast words the setter refusal too (it said only "Failed to duplicate meeting").
3. Task 4 is new as a task: the single-row Set Setter, lifted from the bulk plan's Task 9 without its bulk pieces (`useConfirm` copy, `describeBulkActionResult`, the bulk configs).
4. Nothing else moved: line references, imports and call shapes in Tasks 1–3 match the code.

## Global Constraints

- Verification per task: `pnpm tsc` and `pnpm lint`. **Never `pnpm build`.**
- **No database writes for testing** (dev included). Browser checks read and open UI only. A write check (creating a meeting, changing a setter) runs only on rows the owner designates, or is verified by code and types.
- No unit runner in the repo: pure functions are checked with throwaway `node:test` files under `.superpowers/sdd/2026-10-05-meetings-setter/tests/` (git-ignored), run from the repo root with `pnpm exec tsx --test <file>` so the `@/` alias resolves. Never commit them.
- Work on `main`; other sessions commit concurrently and the index can hold their staged work. Add only new files with `git add -- <path>`, then **commit with an explicit pathspec** (`git commit -m "…" -- <paths>`, as every commit block below does) so nothing already staged rides along; confirm with `git show --stat HEAD`. Never `git add -A`, `git stash`, `checkout`, `reset`, `restore`, `clean` or `commit --amend`. Before editing any file this plan modifies, run `git status --short <file>`: if it shows changes you didn't make, stop and ask. Message shape `type(scope): subject`, ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Never start, stop or restart a dev server; never touch `.next`. Run `ss -ltnp | grep :3000` and reuse the running one.
- Browser checks: a local Playwright script (memory `reference-playwright-auth.md`, `/api/dev/playwright-session`, roles via `&role=super-admin|agent|dispatcher`), screenshots saved under `.superpowers/sdd/2026-10-05-meetings-setter/` in light and dark, desktop and 390px wide, listed in the task report. Never print `.env.local`, `DEV_LOGIN_SECRET` or a URL containing `secret=`.
- Schema: `pnpm db:push:dev` after Task 1 Step 1 is **owner-run**. `pnpm db:push:prod` must run **before** any deploy that contains Task 1 (every meetings list selects `set_by`); no `db:refresh:dev` between the two pushes.
- Code conventions (memory `coding-conventions.md`): one component per file, named exports, constants in `constants/`, pure helpers in `lib/` (no toasts or other side effects there), only DAL files import `db`, DAL functions return `DalReturn`. Comments say why, never what; no plan, spec or tracker citations in code.
- Render rules (`data-table.tsx` meta doc): a function on an action config that runs while rendering (`hidden`) reads only its argument. Action config arrays go through `useStableCallbacks`, never `useMemo` over mutation objects.
- A role list is derived from the one ability definition (`rolesWithAbility`), never written out as role strings.
- Action labels are Title Case like the existing constants ("Set Setter").
- The setter is meetings-only (D56). Intake, `createFromIntake`, `ingestLead`, `closedByOptions` and `leadMetaJSON.closedBy` are untouched; a meeting they create has a null `set_by`.
- In-house work stays additive to external setters (D58): `set_by` remains a nullable user FK, and the setter is read in one place per surface (`setterName` in `listMeetings`, the `setters` option source, `SetterPicker`).

## Review Focus

1. **Agents and dispatchers get no setter controls.** No Setter column in the Columns menu, no Setter filter, no Set Setter in any row menu; the add-meeting form shows "Set by" as "<name> (you)" with no picker. Pinned by Task 2 Step 6, Task 3 Step 5 and Task 4 Step 5 (browser, agent and dispatcher sessions).
2. **"No setter" is a real value, and the setter follows the lead.** Choosing "No setter" writes `null`. A form left unpicked records the creator. A duplicate and a reschedule both keep the setter, a `null` one included (the duplicate engine's null → undefined mapping must not turn it into the person duplicating). Pinned by Task 1 Step 7 (code read) and Task 4 Step 6 (owner's write check).
3. **An ordinary edit never trips the setter guard.** An agent changing an outcome, a date, a confirmation or a participant must not get "forbidden" because some caller sent `setBy` along. Pinned by Task 1 Step 5 (grep of every update caller).
4. **A refused setter says why.** The add-meeting form, a reschedule, a duplicate and Set Setter each toast "That person is no longer on the team…" for `set_by_not_internal`, never a silent failure or "DalError: precondition-failed". Pinned by Task 1 Step 6, Task 3 Step 4 and Task 4 Step 2 (code read of each `onError`).
5. **The right people are offered.** The setter list holds dispatchers, agents and super-admins and never the system owner; the Rep picker and Manage Participants still hold agents and super-admins only. Pinned by Task 2 Step 6 and Task 3 Step 5 (browser).

## Plan-time settlements carried from the bulk plan (owner-approved 2026-10-02)

- **`SetterPicker`, not an extracted `InternalUserPicker`.** `ParticipantPickerContent`'s rows are role-add buttons with slot rules; the setter needs one selectable value. Both compose one users-entity row, `UserCommandItem`. One `SetterSelect` (trigger, popover, label) serves the add-meeting form.
- **Single-row Set Setter lives in `useMeetingActionConfigs`, hidden where the entity carries no setter:** `hidden: entity => entity.setBy === undefined`. Amends spec §4.5.
- **The setter rule runs for every origin** that writes a non-null `setBy` (fail fast). A reschedule or duplicate of a meeting whose setter's role later changed fails with `set_by_not_internal` until a super-admin changes the setter. Exempting copied setters is **open** (a crud hook cannot tell a copy from a choice today); with only in-house setters the case is a dispatcher who left the team.
- **A duplicate keeps the setter** ("it's still their lead"). `setBy` stays off `duplicate.exclude`.
- **The setter and participant role lists derive from CASL:** `SETTER_ROLES` = the roles that can `create Meeting`, `PARTICIPANT_ROLES` = the roles that can `own Meeting`.
- **An unpicked setter is the meeting's creator** (D53): `create.before` fills `setBy` from the session when the input omits it; forms send `setBy` only as held.
- **Only super-admins change a setter** (D54): `update.before` refuses `setBy` from a viewer without `assign Meeting`. An agent naming someone else at create stays #285's (tracker H5).

## File map

| Task | Files |
|---|---|
| 1 Column and rules | `src/shared/db/schema/meetings.ts` · `src/shared/domains/permissions/lib/roles-with-ability.ts` (new) · `src/shared/entities/meetings/constants/{internal-user-roles.ts, set-by-not-internal.ts}` (new) · `src/shared/entities/users/dal/server/queries.ts` · `src/shared/entities/meetings/dal/server/crud.ts` · `src/trpc/routers/meetings.router/business.router.ts` |
| 2 Candidates, filter, sort, column | `src/trpc/routers/meetings.router/reads.router.ts` · `src/shared/dal/lib/query/constants.ts` · `src/shared/dal/client/constants/option-source-reads.ts` · `src/shared/entities/meetings/dal/meeting-fields.ts` · `src/shared/entities/meetings/dal/server/{meeting-field-sql,queries}.ts` · `src/shared/entities/meetings/lib/columns-registry.tsx` · `src/features/records-management/constants/meetings-records-table-view.ts` |
| 3 Pickers and the form | `src/shared/entities/users/components/user-command-item.tsx` (new) · `src/shared/entities/meetings/constants/participant-add-labels.ts` (new) · `src/shared/entities/meetings/components/participant-picker/available-participant-row.tsx` · `src/shared/entities/meetings/components/{setter-picker,setter-select}.tsx` (new) · `src/shared/entities/meetings/components/create-meeting-form.tsx` |
| 4 Set Setter per row | `src/shared/entities/meetings/constants/actions.ts` · `src/shared/entities/meetings/hooks/{use-meeting-actions.ts, use-meeting-action-configs.tsx}` |
| 5 Hand-off | `CONTEXT.md` · `docs/plans/2026-09-26-records-management-epic.md` · `docs/superpowers/specs/2026-09-28-records-bulk-actions-and-entity-tables-design.md` |

---

### Task 1: `meetings.set_by`, the team rule, duplicate and reschedule

**Files:**
- Modify: `src/shared/db/schema/meetings.ts:21-41`
- Create: `src/shared/domains/permissions/lib/roles-with-ability.ts`
- Create: `src/shared/entities/meetings/constants/internal-user-roles.ts`
- Create: `src/shared/entities/meetings/constants/set-by-not-internal.ts`
- Modify: `src/shared/entities/users/dal/server/queries.ts`
- Modify: `src/shared/entities/meetings/dal/server/crud.ts:1-77,132-151`
- Modify: `src/trpc/routers/meetings.router/business.router.ts:120-131`
- Test (throwaway): `.superpowers/sdd/2026-10-05-meetings-setter/tests/roles-with-ability.test.ts`

**Interfaces:**
- Produces: column `meetings.setBy: string | null` (FK `user.id`, `on delete set null`); `rolesWithAbility(action, subject): UserRole[]`; `PARTICIPANT_ROLES` (= `own Meeting`: agent, super-admin) and `SETTER_ROLES` (= `create Meeting`: agent, super-admin, dispatcher); `SET_BY_NOT_INTERNAL = { reason, message }`; `listUsersByRoles(roles, { excludeIds? }): Promise<DalReturn<InternalUserRow[]>>` with `InternalUserRow = Pick<User, 'id' | 'name' | 'email' | 'image' | 'role'>`; `getUserRoleById(id): Promise<DalReturn<UserRole | null>>`; the meetings crud defaults an unpicked `setBy` to the creating session's user, refuses a non-team `setBy` with `precondition-failed: set_by_not_internal`, and refuses a `setBy` update from a viewer without `assign Meeting` (`forbidden`).

- [ ] **Step 1: The column**

In `src/shared/db/schema/meetings.ts`, after the `ownerId` line (`:23`), add:

```ts
  // Who booked the meeting, often a dispatcher. Not ownerId: a dispatcher's booking goes to the system owner.
  setBy: text('set_by').references(() => user.id, { onDelete: 'set null' }),
```

drizzle-zod carries it into `selectMeetingSchema`, `insertMeetingSchema` and the update partial (`lib/server-spec.ts:11`) as nullable-optional; no schema edit is needed.

- [ ] **Step 2: Owner gate — dev schema push, right now**

Stop and ask the owner to run `pnpm db:push:dev` before any other step: `listMeetings` and every other meetings read select all of the table's columns, so the running dev server fails each meetings query until the column exists. Ask them to paste the printed statements. Expected: exactly `ALTER TABLE "meetings" ADD COLUMN "set_by" text;` plus the FK constraint to `user`, no `truncate`, no table rebuild. If the push prints anything else (another session's pending columns are fine; a `truncate`, a drop or a rename prompt is not), stop and report it.

- [ ] **Step 3: The role lists, read off the abilities (test first)**

Create `.superpowers/sdd/2026-10-05-meetings-setter/tests/roles-with-ability.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { PARTICIPANT_ROLES, SETTER_ROLES } from '@/shared/entities/meetings/constants/internal-user-roles'

test('setters are everyone who can book a meeting, in userRoles order', () => {
  assert.deepEqual(SETTER_ROLES, ['agent', 'super-admin', 'dispatcher'])
})

test('participants are the roles that own the meetings they book', () => {
  assert.deepEqual(PARTICIPANT_ROLES, ['agent', 'super-admin'])
})
```

Run: `pnpm exec tsx --test .superpowers/sdd/2026-10-05-meetings-setter/tests/roles-with-ability.test.ts`
Expected: FAIL (module not found).

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

If `defineAbilitiesFor`'s `PermissionUser` needs more than `{ id, role }`, pass the smallest object its type accepts; do not widen the type.

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

Run the test again → 2 pass. If the arrays differ from the expected ones, stop and report: the abilities changed, and the owner decides who is a setter.

- [ ] **Step 4: The users DAL reads**

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

If `@/shared/db/schema/auth` exports no `User` type, derive the row from the table instead (`Pick<typeof user.$inferSelect, …>`); a column change must reach it without a hand edit.

- [ ] **Step 5: The setter rule in the meetings crud hooks**

First confirm no update caller sends `setBy` today (Review Focus 3):

Run: `grep -rn "setBy" src --include=*.ts --include=*.tsx`
Expected: only the lines this task has added so far. Then read every `meetingCrud.update(` and `meetingsRouter.crud.update` caller (`grep -rn "meetingCrud.update(\|meetingsRouter.crud.update" src`) and confirm each passes a `data` object of named fields, never a spread of a whole meeting row. If one spreads a row, stop and report it; do not work around it.

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

Make the first lines of `update.before` (`:60-61`; rename its `_ctx` parameter to `ctx`):

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

Both hooks run inside the engine's `dalDbOperation` (`create-crud-dal.ts`, `createImpl` and `updateImpl`), so the throw becomes a `precondition-failed` `DalReturn`, which `dalToTrpc` maps to `PRECONDITION_FAILED` with the reason as the message.

- [ ] **Step 6: Duplicate and reschedule keep the setter**

In the same file, leave `setBy` **off** `duplicate.exclude`, and copy it explicitly in `duplicate.overrides`: the engine turns every `null` into `undefined` before the insert (`duplicateImpl`, "null → undefined"), and `create.before` would then make the person duplicating the setter of a "No setter" meeting. Extend the block comment and the overrides:

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

and change that call's unwrap from `dalVerifySuccess(await meetingCrud.create(…))` to `dalToTrpc(await meetingCrud.create(…))` (already imported). `dalVerifySuccess` throws a `ThrowableDalError` outside any `dalDbOperation`, which tRPC turns into a 500 reading "DalError: precondition-failed"; `dalToTrpc` sends PRECONDITION_FAILED with the reason, which the reschedule toast words (Task 4 Step 2). Leave the later `dalVerifySuccess(await meetingCrud.update(…))` as it is.

- [ ] **Step 7: Type-check, lint, code-read confirmation**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

Confirm by reading the saved files (Review Focus 2): `duplicate.exclude` does **not** list `'setBy'`; `duplicate.overrides` sets `setBy: source.setBy`; the reschedule create passes `setBy: original.setBy` and unwraps with `dalToTrpc`; `create.before` keeps a `null` input as `null`. Write the four confirmations into the task report with their line numbers.

- [ ] **Step 8: Commit**

```bash
git add -- src/shared/domains/permissions/lib/roles-with-ability.ts src/shared/entities/meetings/constants/internal-user-roles.ts src/shared/entities/meetings/constants/set-by-not-internal.ts
git commit -m "feat(meetings): setter column, defaulting to the creator; a setter must be on the team; only super-admins change it

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/shared/db/schema/meetings.ts src/shared/domains/permissions/lib/roles-with-ability.ts src/shared/entities/meetings/constants/internal-user-roles.ts src/shared/entities/meetings/constants/set-by-not-internal.ts src/shared/entities/users/dal/server/queries.ts src/shared/entities/meetings/dal/server/crud.ts src/trpc/routers/meetings.router/business.router.ts
git show --stat HEAD
```

---

### Task 2: Setter candidates, the Setter filter, sort and column

**Files:**
- Modify: `src/trpc/routers/meetings.router/reads.router.ts:1-57`
- Modify: `src/shared/dal/lib/query/constants.ts:15`
- Modify: `src/shared/dal/client/constants/option-source-reads.ts:19-34`
- Modify: `src/shared/entities/meetings/dal/meeting-fields.ts:11-30`
- Modify: `src/shared/entities/meetings/dal/server/meeting-field-sql.ts`
- Modify: `src/shared/entities/meetings/dal/server/queries.ts` (`MeetingListRow`, `listMeetings`)
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

- after `.leftJoin(user, eq(user.id, meetings.ownerId))` in `listMeetings` add:

```ts
        .leftJoin(setterUser, eq(setterUser.id, meetings.setBy))
```

The count query needs no join: the setter filter reads `meetings.set_by` only. Any other read in this file that uses `MEETING_FIELD_SQL.orderBy` (`grep -n "MEETING_FIELD_SQL" src -r`) must also join `setterUser`, or a sort by setter fails there; add the same join to each and name them in the task report.

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

Browser (reuse the running server on :3000; sign in through `/api/dev/playwright-session`). As a super-admin on `/dashboard/meetings`:
- the Columns menu lists "Setter", off by default; turned on, unset rows show "—";
- the filter bar offers "Setter", and its options hold dispatchers, agents and super-admins but not the system owner (Review Focus 5);
- sorting the Setter column puts the sort in the URL under the table's `pm` prefix (report the exact key and value) and returns rows, no error toast;
- an old URL without any setter key still loads.

As an agent, then as a dispatcher: no "Setter" in the Columns menu, no Setter filter (Review Focus 1). Screenshots per Global Constraints.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(meetings): setter candidates include dispatchers; Setter filter, sort and column for super-admins

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/trpc/routers/meetings.router/reads.router.ts src/shared/dal/lib/query/constants.ts src/shared/dal/client/constants/option-source-reads.ts src/shared/entities/meetings/dal/meeting-fields.ts src/shared/entities/meetings/dal/server/meeting-field-sql.ts src/shared/entities/meetings/dal/server/queries.ts src/shared/entities/meetings/lib/columns-registry.tsx src/features/records-management/constants/meetings-records-table-view.ts
git show --stat HEAD
```

---

### Task 3: `SetterPicker` and `SetterSelect`; "Set by" on the add-meeting form

**Files:**
- Create: `src/shared/entities/users/components/user-command-item.tsx`
- Create: `src/shared/entities/meetings/constants/participant-add-labels.ts`
- Modify: `src/shared/entities/meetings/components/participant-picker/available-participant-row.tsx`
- Create: `src/shared/entities/meetings/components/setter-picker.tsx`
- Create: `src/shared/entities/meetings/components/setter-select.tsx`
- Modify: `src/shared/entities/meetings/components/create-meeting-form.tsx`

**Interfaces:**
- Consumes: `getInternalUsers({ purpose: 'setter' })` (Task 2); `SET_BY_NOT_INTERNAL` (Task 1).
- Produces: `UserCommandItem({ user, onSelect, disabled?, leading?, trailing?, ariaLabel?, className? })`; `PARTICIPANT_ADD_LABELS`; `SetterPicker({ value: string | null | undefined, onPick: (userId: string | null) => void, disabled?: boolean })` (`undefined` = no checkmark); `SetterSelect({ value: string | null | undefined, onChange: (userId: string | null) => void, selfId: string | null, selfName: string | null })`.

One encoding wherever a form holds the setter: `undefined` = not picked (the crud records the creator, Task 1), `null` = "No setter", a string = that user. The form sends what it holds; it never resolves the default itself.

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

Re-read `available-participant-row.tsx` before writing this file and copy its `CommandItem` class list as it stands that day (another session retunes hover tokens); the classes above are the 2026-10-05 ones.

Create `src/shared/entities/meetings/constants/participant-add-labels.ts` (today a file-level constant in the row component):

```ts
import type { MeetingParticipantRole } from '@/shared/constants/enums'

/** The add affordance's words for the role a picked user will get. */
export const PARTICIPANT_ADD_LABELS = {
  owner: 'Add as owner',
  co_owner: 'Add as co-owner',
  helper: 'Add as helper',
} as const satisfies Record<MeetingParticipantRole, string>
```

If `MeetingParticipantRole` is not re-exported from `@/shared/constants/enums`, import it from `@/shared/constants/enums/meeting-participants`.

Rewrite `available-participant-row.tsx` on `UserCommandItem`. Props, the disabled/pending guard and the chip (with its current classes, unchanged) stay; the `ADD_LABEL` constant and the row's own `CommandItem` / `UserOverviewCard` markup go:

```tsx
'use client'

import type { UserOverviewCardUser } from '@/shared/entities/users/components/overview-card'

import { Loader2, Plus } from 'lucide-react'

import { PARTICIPANT_ADD_LABELS } from '@/shared/entities/meetings/constants/participant-add-labels'
import { UserCommandItem } from '@/shared/entities/users/components/user-command-item'
import { cn } from '@/shared/lib/utils'

interface AvailableParticipantRowProps {
  user: UserOverviewCardUser
  /** Role this user will be added as if clicked — used in the affordance label. */
  inferredRole: 'owner' | 'co_owner' | 'helper'
  /** True when both slots are full; row is dimmed and click is no-op. */
  disabled: boolean
  isPending: boolean
  onAdd: () => void
}

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
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-xs font-medium text-muted-foreground opacity-0 group-hover:opacity-100 group-data-[selected=true]:opacity-100 group-data-[selected=true]:text-foreground motion-safe:transition-opacity">
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

The chip's class string above is the file's on 2026-10-05; if the file's differs when you open it, keep the file's.

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
  /** The current setter; `null` = none; `undefined` = unknown, so nothing is checked. */
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

- [ ] **Step 3: The trigger the form uses**

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

In `createMutation`'s `onSuccess`, add `setSetBy(undefined)` beside the other resets. `createMutation` has no `onError` today, so a refused create fails silently; add one beside `onSuccess` (Review Focus 4):

```tsx
      onError: err => toast.error(err.message === SET_BY_NOT_INTERNAL.reason ? SET_BY_NOT_INTERNAL.message : 'Failed to create meeting'),
```

In `handleSubmit`'s create branch, add after `scheduledFor`:

```tsx
        setBy,
```

The edit branch (`updateMutation.mutate`) is not touched: it must never send `setBy` (Review Focus 3).

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

Agents and dispatchers send nothing; the crud records them as the setter (Task 1 Step 5).

- [ ] **Step 5: Type-check, lint, browser read check**

Run: `pnpm tsc && pnpm lint` → clean.

Browser (super-admin): open every mount of the form (`grep -rn "CreateMeetingForm\|CreateMeetingModal" src` lists them; report the list). Each shows "Set by" with the signed-in user; the popover lists setters including dispatchers, "No setter" first, and stays on screen at 390px. The lead-sources admin "Add customer" sheet and the public `/intake` page are unchanged (no "Set by"). As an agent, then a dispatcher: "Add meeting" shows "Set by" as "<name> (you)", no picker (Review Focus 1). The meetings table's Rep picker and the Manage Participants modal list, search and offer "Add as owner / co-owner / helper" exactly as before, with agents and super-admins only (Review Focus 5). **Do not submit any form.** Screenshots per Global Constraints.

- [ ] **Step 6: Commit**

```bash
git add -- src/shared/entities/users/components/user-command-item.tsx src/shared/entities/meetings/constants/participant-add-labels.ts src/shared/entities/meetings/components/setter-picker.tsx src/shared/entities/meetings/components/setter-select.tsx
git commit -m "feat(meetings): Set by on the add-meeting form — a picker for super-admins, the creator by default

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/shared/entities/users/components/user-command-item.tsx src/shared/entities/meetings/constants/participant-add-labels.ts src/shared/entities/meetings/components/participant-picker/available-participant-row.tsx src/shared/entities/meetings/components/setter-picker.tsx src/shared/entities/meetings/components/setter-select.tsx src/shared/entities/meetings/components/create-meeting-form.tsx
git show --stat HEAD
```

---

### Task 4: Set Setter per row

**Files:**
- Modify: `src/shared/entities/meetings/constants/actions.ts`
- Modify: `src/shared/entities/meetings/hooks/use-meeting-actions.ts`
- Modify: `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx`

**Interfaces:**
- Consumes: `SetterPicker` (Task 3); `SET_BY_NOT_INTERNAL` (Task 1); `hidden` on action configs (`entity-actions/types.ts`, already built); `meetingsRouter.crud.update` accepting `{ id, data: { setBy } }` (Task 1's column).
- Produces: `MEETING_ACTIONS.setSetter` (`id: 'setSetter'`, permission `['assign', 'Meeting']`); `useMeetingActions().updateSetter`; `MeetingEntity.setBy?: string | null`; a Set Setter config in `useMeetingActionConfigs`, hidden where the entity carries no `setBy`. The bulk plan's `MEETING_BULK_ACTIONS.setSetter` later spreads `MEETING_ACTIONS.setSetter`.

- [ ] **Step 1: The action**

In `src/shared/entities/meetings/constants/actions.ts` add `UserPenIcon` to the lucide import (keep the list alphabetical) and, after `assignOwner`:

```ts
  setSetter: {
    id: 'setSetter',
    label: 'Set Setter',
    icon: UserPenIcon,
    permission: ['assign', 'Meeting'],
  },
```

- [ ] **Step 2: The mutation, and toasts that say why**

In `src/shared/entities/meetings/hooks/use-meeting-actions.ts` add the import:

```ts
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
```

and add `updateSetter` to the returned object.

A duplicate and a reschedule both copy the setter, so both can be refused when that person has left the team (Task 1 Step 6). Word it in both (Review Focus 4). In `duplicateMeeting`:

```ts
      onError: err => toast.error(err.message === SET_BY_NOT_INTERNAL.reason ? SET_BY_NOT_INTERNAL.message : 'Failed to duplicate meeting'),
```

In `rescheduleMeeting`:

```ts
      onError: err => toast.error(err.message === SET_BY_NOT_INTERNAL.reason ? SET_BY_NOT_INTERNAL.message : err.message || 'Failed to reschedule meeting'),
```

Confirm by reading `src/trpc/lib/create-crud-router.ts` that the `duplicate` procedure unwraps with `dalToTrpc` (so the reason arrives as the error message). If it does not, report it; do not change the shared router.

- [ ] **Step 3: Single-row Set Setter, hidden where the row has no setter**

In `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx`:
- add `import { SetterPicker } from '@/shared/entities/meetings/components/setter-picker'`;
- `MeetingEntity`: add

```ts
  /** Absent when the caller's rows don't carry the setter; the action then stays out. */
  setBy?: string | null
```

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

`hidden` reads only its argument (Global Constraints). The configs already go through `useStableCallbacks`; there is no dependency list to extend.

- [ ] **Step 4: Where it shows**

List the three callers of `useMeetingActionConfigs` (`grep -rn "useMeetingActionConfigs" src`) and say for each whether the entity it passes carries `setBy` at runtime: the records table (`MeetingRow`, from `listMeetings`, which selects every column: yes), the schedule calendar (`ScheduleCalendarEvent`: read `to-calendar-event.ts`), the overview card (read what its callers pass). Write the three answers into the task report. Change nothing: the action shows wherever a row carries `setBy`, and its `assign Meeting` permission keeps it super-admin only everywhere.

- [ ] **Step 5: Type-check, lint, browser read check**

Run: `pnpm tsc && pnpm lint` → clean.

Browser, super-admin, `/dashboard/meetings` (desktop, then 390px):
- a row's More menu has "Set Setter" after "Manage Participants"; its submenu shows the picker with the checkmark on the row's current setter, or on "No setter"; at 390px the picker stays on screen and its search field takes focus;
- opening the submenu and pressing Escape changes nothing and does not expand or collapse the row;
- with the Setter column turned on, the column reads the same person the checkmark marks.

**Do not pick a setter** (that is a write). As an agent, then a dispatcher: no "Set Setter" in any row menu on the table, the schedule calendar or a customer profile's meeting card (Review Focus 1). Screenshots per Global Constraints.

- [ ] **Step 6: Owner's write check (owner-designated rows only)**

Ask the owner to name one meeting to use, then, as a super-admin: Set Setter → pick a dispatcher → toast "Setter updated", the Setter column shows them; Set Setter → "No setter" → the column shows "—"; duplicate that meeting → the copy's Setter is also "—" (Review Focus 2); add a meeting for a designated customer without touching "Set by" → its Setter is the super-admin. The owner deletes the test rows. If the owner prefers to run these by hand, give them this list.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(meetings): Set Setter per row for super-admins; duplicate and reschedule say why a setter was refused

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/shared/entities/meetings/constants/actions.ts src/shared/entities/meetings/hooks/use-meeting-actions.ts src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx
git show --stat HEAD
```

---

### Task 5: Hand-off — glossary, tracker, spec

**Files:**
- Modify: `CONTEXT.md:62`
- Modify: `docs/plans/2026-09-26-records-management-epic.md`
- Modify: `docs/superpowers/specs/2026-09-28-records-bulk-actions-and-entity-tables-design.md`

Re-read each file first; edit only what this plan built.

- [ ] **Step 1: Glossary**

In `CONTEXT.md:62` (Setter row), replace the code cell `` `meetings.setBy` (planned, analytics Spec D; not built) `` with `` `meetings.setBy` · picked on the add-meeting form, else the meeting's creator; kept by a duplicate and a reschedule; only super-admins change it ``.

- [ ] **Step 2: Records tracker**

In `docs/plans/2026-09-26-records-management-epic.md`: set the **B1** rollout row's status to `[x] built on local main <first-sha>..<last-sha>; prod needs db:push:prod before the deploy`, and in the Status line replace "→ B1 the setter →" wording so it reads as built. Leave every other row.

- [ ] **Step 3: Spec**

In the spec, mirror the settlements into the text they amend, and add under the header `> **Setter plan:** \`docs/superpowers/plans/2026-10-05-meetings-setter.md\` (built).`:
- §4.2: the rule runs for every origin; the role lists derive from CASL;
- §4.4: an unpicked setter is the creator (D53); the lead-sources admin and public intake rows leave this spec (D56; external setters deferred, D58); only super-admins change a setter (D54);
- §4.5: `SetterPicker` and `SetterSelect` on `UserCommandItem` replace the `InternalUserPicker` bullets; single-row Set Setter lives in `useMeetingActionConfigs` behind `hidden`.

- [ ] **Step 4: Commit**

```bash
git commit -m "docs(records): the setter is built — glossary, tracker and spec follow

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- CONTEXT.md docs/plans/2026-09-26-records-management-epic.md docs/superpowers/specs/2026-09-28-records-bulk-actions-and-entity-tables-design.md
git show --stat HEAD
```

If any of the three files carries uncommitted hunks you didn't make, do not commit it; report the edit for the owner to commit with theirs.

---

## Self-review notes (kept for the executor)

- **Spec coverage.** §4.1 → Task 1 Steps 1–2; §4.2 → Task 1 Steps 3–5, Task 2 Steps 1–2; §4.3 → Task 2 Steps 3–5; §4.4 → Task 1 Step 6 (duplicate, reschedule), Task 3 Step 4 (the form); the lead-sources admin and public intake rows are out (D56); §4.5 → Task 2 Step 5 (column), Task 3 (pickers), Task 4 (Set Setter). Bulk Set Setter (§5) stays in the bulk plan.
- **Type consistency.** `SET_BY_NOT_INTERNAL.reason` is thrown in Task 1 and matched in Tasks 3 and 4. `SetterPicker`'s `value` is `string | null | undefined` in Task 3 and receives `entity.setBy ?? null` in Task 4 and `current` in `SetterSelect`. `getInternalUsers({ purpose: 'setter' })` is the one query key used by the option source (Task 2), `SetterPicker` and `SetterSelect` (Task 3). The `setter` field id (Task 2 Step 3) is the column's `sort` value and the toolbar entry (Step 5).
- **Order.** Task 2 needs Task 1's column and reads; Task 3 needs Task 2's read; Task 4 needs Task 3's picker. Nothing runs in parallel.
- **Prod.** `pnpm db:push:prod` before the deploy that carries Task 1; the owner runs it.
