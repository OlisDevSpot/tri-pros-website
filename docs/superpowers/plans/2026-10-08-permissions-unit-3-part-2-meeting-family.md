# Permissions unit 3, part 2: the Meeting family — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Meeting family runs on compiled rules: an agent reaches a meeting through `$participatesViaMeeting` via `self`, a dispatcher reaches every meeting but never its deal structure, a client-supplied `customerId` on a booking must be readable to the creator, and the legacy meeting scope (`meetingVisibility`, the scope stamp in the meetings procedures, the hand-built meeting contexts, `SYSTEM_CONTEXT` at the meeting sites) leaves the tree.

**Architecture:** `COMPILED_SUBJECTS` gains `Meeting`, so `createCrudDal` scopes the meeting slots through `permit` and the `visitMessages` part follows through its root. The hand-written meeting readers AND `permit(ctx, 'read', meetingServerSpec).sql` into their `where` and pass their rows through `projectToReadFields`, which is how a dispatcher's `cannot('read', 'Meeting', ['flowStateJSON'])` takes effect on joined rows. The kanban's four meeting-table arms take the same reach; its proposal arms keep the hand participation check until the Proposal family (part 3), which is the dispatcher's financial wall for now, together with an empty proposal list in the customer profile for an actor holding no `read Proposal` rule. The booking probe is a `create.before` / `update.before` hook on the meeting CRUD, because Meeting is a peer root (D-03) and a `parent` on its spec would make every meeting read require a readable customer, which contradicts D-05. The two meeting system sites become `systemContext(reason)` with two new reasons; the super-admin's pipeline move runs as the actor.

**Tech Stack:** TypeScript 5, Next.js 15.5, tRPC v11, Drizzle (Postgres/Neon), `@casl/ability` 6.8.0 (stays), `@casl/react` 7.0.1 (untouched), Zod 4.

**Spec:** `docs/superpowers/specs/2026-10-05-permissions-structure-design.md` (§5 rules, §6 compiler and DAL, §7 actor, §11 order of work and the rule for unit 3). The part's design as the owner approved it in chat on 2026-10-08 is recorded in `docs/plans/2026-08-10-casl-scope-compiler-epic.md` §4, Unit 3, "Part 2 design"; D-05 as amended that day and Q8 #13 in §2.1 and §0.3 rule the dispatcher's reach, the discovery profile and the booking probe.

**Not in this plan (and why):** Q8 #4 to #7 (Meeting update and delete conditions, the dispatcher's update scope, the shape of the dispatcher's meeting read beyond `flowStateJSON`) wait for unit 4 and #217/#220; the mutation verbs stay bare and inherit D-15. `Application` stays on the legacy engine: its parent is Meeting today and Proposal per main's applications work, and its `visibility` is its own participation predicate, so the engine lets it stay. The kanban's proposal arms, `listMeetingsForProject` (scoped by the project), `getCustomerProjects`'s proposal labels, S12 (every rep's meetings and proposals on a reachable customer) and the Project side of `assignToProject` belong to parts 3 and 4. No bearer path: the tree has no customer-facing meeting page; the share token is minted and handed off only. `createCrudRouter` becoming pure wiring, the deletion of `SYSTEM_CONTEXT`, `ctx.scope`, `buildUserContext`, `scope.ts` and the per-entity procedures of the other families go with the last family and unit 6.

## Global Constraints

- Verification is `pnpm tsc` and `pnpm lint` after every task. Never `pnpm build`. No test runner and no unit tests in the permissions library; the only test file is `src/shared/domains/permissions/type-checks/must-not-compile.ts`.
- No writes to any database for testing, the shared development database included. The worktree runs on the shared dev database (`.env.local` holds only `PORT=3003`). Browser checks that write are the owner's, by hand.
- `@casl/ability` stays at 6.8.0; `@casl/react` stays at 7.0.1 and is imported only in `src/shared/domains/permissions/client.tsx`. No new dependencies.
- No backwards compatibility: a task removes what it replaces in the same change. No alias, re-export, wrapper, unused import or parameter, `any` fallback or dual shape kept for old call sites. `meetingProcedure` is deleted, not re-exported as the agent procedure.
- No outcome or pipeline logic on this branch (owner, 2026-10-07). `OUTCOME_PIPELINE_MAP`, `derived-pipeline-sql.ts` and the `pipeline` column writes are main's; this plan touches none of their meaning.
- Comments say why, never what. No file banners. Never cite plans, specs, tasks, issues or docs from code.
- Names used by this plan, agreed with it: the system reasons `derived:meeting-reschedule` and `derived:meeting-notification`; the constant `DISPATCHER_PIPELINES`; the kanban argument `meetingReach`. Everything else already exists: `permit`, `Permit`, `projectToReadFields`, `systemContext`, `SystemReason`, `COMPILED_SUBJECTS`, `isCompiled`, `meetingServerSpec`, `meetingMessageServerSpec`, `customerServerSpec`, `visitMessagesProcedure`, `agentProcedure`.
- Named exports only. One React component per file (no component is touched here).
- Some files are CRLF (`src/trpc/routers/app.ts` is one; none in this plan). Edit with the Edit tool or `sed -i`; check `git diff --shortstat` before committing.
- Commit per task, by explicit path (`git add <files>`), conventional commits, message ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Never `git stash`, `git reset` or `git checkout <file>` on this shared tree. Branch `refactor/285-refactor-permissions-casl-scope-compiler` in `.worktrees/issue-285`.
- `DEV_LOGIN_SECRET` is never written into a file under the repo or the scratchpad, never echoed, never put in a report. It is exported into the dev server's shell only.
- Task order is load-bearing: Tasks 1 to 3 are safe on the legacy engine and land first; Task 4 flips the switch and converts every meeting reader in one commit, because a meeting query left on `ctx.scope ?? undefined` after the switch is silently unfiltered (the legacy helpers hand a compiled spec a `null` scope), and a reader moved onto `permit` before the switch compiles today's bare `read Meeting` to "every row".

## Review Focus

1. **A meeting query left on `ctx.scope ?? undefined` after the switch is omni for every role.** Pinned by Task 4 Step 12's grep (`ctx.scope` over the meetings table = 0, `buildUserContext(…, meetingServerSpec)` only in the kanban move) and by the agent's unchanged counts in Task 5 (R6).
2. **A proposal arm moved onto the Meeting reach hands a dispatcher every fresh customer's proposal values and share tokens.** Pinned by Task 4 Step 7 leaving the three proposal arms on `userParticipatesInMeeting(args.userId, proposals.meetingId)` and by the dispatcher card check in Task 5 (R4).
3. **The dispatcher's `cannot` placed before its `can`, or a second `read Meeting` grant, re-allows the column or fails at boot.** Pinned by `assertRules` (the server does not start) and by the dispatcher detail check in Task 5 (R3: no `flowStateJSON` key).
4. **The booking probe must fire for every signed-in creator, duplicates included, and never for a caller without a user.** Pinned by the owner's booking checks in Task 5 (W1, W2) and the intake form check (W5).
5. **Projection drops the key, it does not null it**: a consumer testing `flowStateJSON === null` misbehaves for a dispatcher. Pinned by Task 4 Step 12's grep (no `flowStateJSON === null` or `!== null` in `src/`) and the dispatcher meeting-page and records-panel checks in Task 5 (R3, R7).

---

### Task 1: The dispatcher's Customer-side rulings

**Files:**
- Modify: `src/shared/domains/permissions/rules/dispatcher.ts` (the Customer lines)
- Modify: `src/shared/domains/pipelines/lib/get-accessible-pipelines.ts` (whole file)

**Interfaces:**
- Consumes: `defineRules`, the `Customer` operator `$inDerivedPipeline` (typed `readonly Pipeline[]`), `FieldOf<'Customer'>` (contains `profile` and `profile.*`).
- Produces: nothing new; the dispatcher's `read Customer` names four buckets and its `update Customer` covers the discovery profile; `getAccessiblePipelines(ability)` answers `['leads', 'rehash', 'dead', 'fresh']` for a dispatcher.

The Customer family is already compiled, so these two edits are live the moment they land and are safe on their own. With today's bucket SQL the rehash and dead arms match nothing (nothing writes the stored column that way); main's model arrives by merge.

- [ ] **Step 1: The dispatcher's Customer rules**

In `src/shared/domains/permissions/rules/dispatcher.ts` replace the three Customer lines

```ts
    // The shared leads pool: customers no meeting has claimed yet.
    can('read', 'Customer', { $inDerivedPipeline: ['leads'] })
    // Lead-contact fields only — not the sales-discovery profile.
    can('update', 'Customer', ['name', 'phone', 'email', 'address', 'city', 'state', 'zip', 'pipelineStage'])
```

with

```ts
    // The operational pipeline: every lead bucket, never a customer who holds a project.
    can('read', 'Customer', { $inDerivedPipeline: ['leads', 'rehash', 'dead', 'fresh'] })
    // Lead-contact fields and the discovery profile: collecting a customer's data is the dispatcher's job.
    can('update', 'Customer', ['name', 'phone', 'email', 'address', 'city', 'state', 'zip', 'pipelineStage', 'profile', 'profile.*'])
```

- [ ] **Step 2: The kanban tab list**

Replace the whole of `src/shared/domains/pipelines/lib/get-accessible-pipelines.ts` with

```ts
import type { Pipeline } from '@/shared/constants/enums/pipelines'
import type { AppAbility } from '@/shared/domains/permissions/types'

import { pipelines } from '@/shared/constants/enums/pipelines'

const AGENT_PIPELINES: readonly Pipeline[] = ['projects', 'fresh']
// The lead buckets the dispatcher works; a customer with a project is never theirs.
const DISPATCHER_PIPELINES: readonly Pipeline[] = ['leads', 'rehash', 'dead', 'fresh']

/**
 * The kanban tabs a role may open, in the canonical `pipelines` order. A hand copy of the Customer
 * read rules until the tabs read the ability directly.
 */
export function getAccessiblePipelines(ability: AppAbility): Pipeline[] {
  if (ability.can('manage', 'all')) {
    return [...pipelines]
  }
  if (ability.can('read', 'LeadsPool')) {
    return pipelines.filter(p => DISPATCHER_PIPELINES.includes(p))
  }
  return pipelines.filter(p => AGENT_PIPELINES.includes(p))
}
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: both pass. `grep -n "inDerivedPipeline" src/shared/domains/permissions/rules/dispatcher.ts` prints the one line with the four buckets; `grep -c "profile" src/shared/domains/permissions/rules/dispatcher.ts` is at least 2.

- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/permissions/rules/dispatcher.ts src/shared/domains/pipelines/lib/get-accessible-pipelines.ts
git commit -m "feat(permissions): dispatchers reach the four lead buckets and write the discovery profile; their kanban tabs follow

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The booking probe, and the outcome note's reach before the write

**Files:**
- Modify: `src/shared/entities/meetings/dal/server/crud.ts:40-61` (`create.before`), `:90-110` (`update.before`), the imports
- Modify: `src/shared/modules/meetings/business/service.ts:33-45` (`setOutcomeWithReason`), `:60-67` (`reschedule`, after `original` is loaded), the imports

**Interfaces:**
- Consumes: `permit(ctx, 'read', customerServerSpec).probe(id): Promise<boolean>`; `ThrowableDalError({ type: 'not-found' })`.
- Produces: a meeting create or update whose `customerId` the acting user cannot read answers not found; an outcome-with-reason or a reschedule on a meeting whose customer the actor cannot read answers not found before anything is written.

Both edits are safe on the legacy engine: the Customer family is compiled, and the probes only narrow. Behaviour change, named: an agent cannot book a meeting on a customer they do not already reach; a dispatcher cannot book on a customer outside the four buckets; callers without a user (intake, the reschedule replacement, jobs) skip the probe because their ids are server-derived.

- [ ] **Step 1: The imports**

In `src/shared/entities/meetings/dal/server/crud.ts` add, among the `@/shared/...` imports in alphabetical order:

```ts
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
```

(`customers/lib/server-spec.ts` imports schema and constants only, so no cycle with the customers CRUD, which already imports `meetingCrud` for its delete cascade.)

- [ ] **Step 2: The probe on create**

In `create.before`, after `const { ability, userId } = ctx.actor` and before the setter line, insert:

```ts
        // A client-supplied customer id is checked against the creator's Customer reach: booking a meeting
        // must never be the way to reach a customer. Server-derived creates have no user and skip it.
        if (userId !== null && input.customerId && !(await permit(ctx, 'read', customerServerSpec).probe(input.customerId))) {
          throw new ThrowableDalError({ type: 'not-found' })
        }
```

- [ ] **Step 3: The probe on update**

In `update.before(data, ctx, { id })`, as the first statement of the function body (before the `setBy` block), insert:

```ts
        if (ctx.actor.userId !== null && data.customerId && !(await permit(ctx, 'read', customerServerSpec).probe(data.customerId))) {
          throw new ThrowableDalError({ type: 'not-found' })
        }
```

- [ ] **Step 4: The outcome note's customer, probed before the meeting write**

In `src/shared/modules/meetings/business/service.ts` add to the imports:

```ts
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
```

In `setOutcomeWithReason`, replace

```ts
      const updated = dalVerifySuccess(await meetingCrud.update(ctx, {
        id: input.meetingId,
        data: { meetingOutcome: input.outcome },
      }))
```

with

```ts
      // The note is written after the outcome; its customer is probed first so a meeting is never
      // changed by an actor whose note on it would then be refused.
      const current = dalVerifySuccess(await meetingCrud.getById(ctx, { id: input.meetingId }))
      if (!current) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      if (current.customerId && !(await permit(ctx, 'read', customerServerSpec).probe(current.customerId))) {
        throw new ThrowableDalError({ type: 'not-found' })
      }

      const updated = dalVerifySuccess(await meetingCrud.update(ctx, {
        id: input.meetingId,
        data: { meetingOutcome: input.outcome },
      }))
```

In `reschedule`, directly after

```ts
      if (!original) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
```

insert

```ts
      if (original.customerId && !(await permit(ctx, 'read', customerServerSpec).probe(original.customerId))) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
```

- [ ] **Step 5: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: both pass. `grep -c "permit(ctx, 'read', customerServerSpec).probe" src/shared/entities/meetings/dal/server/crud.ts` prints 2; the same grep on `src/shared/modules/meetings/business/service.ts` prints 2.

- [ ] **Step 6: Commit**

```bash
git add src/shared/entities/meetings/dal/server/crud.ts src/shared/modules/meetings/business/service.ts
git commit -m "feat(permissions): a booking's customer must be within the creator's reach; an outcome note's customer is probed before the meeting is written

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Two system reasons, and the meeting sites that carry them

**Files:**
- Modify: `src/shared/domains/permissions/rules/system.ts` (the `SystemReason` list)
- Modify: `src/shared/modules/meetings/business/service.ts:87-88` (the replacement create) and its imports
- Modify: `src/shared/services/notification.service.ts:7`, `:154`, `:181-184`
- Modify: `src/features/customer-pipelines/dal/server/move-customer-to-pipeline.ts` (whole file)
- Modify: `src/trpc/routers/customer-pipelines.router.ts:44-55` (`moveCustomerToPipeline`)

**Interfaces:**
- Consumes: `systemContext(reason: SystemReason): ScopedContext`.
- Produces: `moveCustomerToPipeline(ctx: ScopedContext, customerId: string, pipeline: MeetingPipeline): Promise<void>`; the `SystemReason` union gains `'derived:meeting-reschedule'` and `'derived:meeting-notification'`.

Behaviour-neutral: `systemContext(reason)` is `manage all` with no user, as `SYSTEM_CONTEXT` is; the pipeline move's caller is already gated to `manage CustomerPipeline`, so the acting super-admin is omni too.

- [ ] **Step 1: The reasons**

In `src/shared/domains/permissions/rules/system.ts` extend the union so it reads:

```ts
export type SystemReason
  = | 'intake:form'
    | 'intake:funnel'
    | 'intake:landing'
    | 'webhook:bina'
    | 'webhook:justcall'
    | 'sync:quickbooks'
    | 'job:campaign-enrollment'
    | 'derived:new-lead-notification'
    | 'derived:customer-delete-cascade'
    | 'derived:meeting-reschedule'
    | 'derived:meeting-notification'
```

- [ ] **Step 2: The reschedule replacement**

In `src/shared/modules/meetings/business/service.ts` change the import line

```ts
import { SYSTEM_CONTEXT, ThrowableDalError } from '@/shared/dal/server/types'
```

to

```ts
import { ThrowableDalError } from '@/shared/dal/server/types'
```

add

```ts
import { systemContext } from '@/shared/dal/server/lib/contexts'
```

and replace

```ts
      // SYSTEM_CONTEXT so create.before keeps this ownerId; an authed create would hand the meeting to the office user.
      const replacement = dalVerifySuccess(await meetingCrud.create(SYSTEM_CONTEXT, {
```

with

```ts
      // A system create keeps this ownerId: an authed create would resolve the owner from the acting user.
      const replacement = dalVerifySuccess(await meetingCrud.create(systemContext('derived:meeting-reschedule'), {
```

- [ ] **Step 3: The notification reads**

In `src/shared/services/notification.service.ts` delete the import `import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'` (the `systemContext` import on line 5 already exists), replace both

```ts
      const meeting = dalVerifySuccess(await getByIdWithJoins(SYSTEM_CONTEXT, { id: params.meetingId }))
```

with

```ts
      const meeting = dalVerifySuccess(await getByIdWithJoins(systemContext('derived:meeting-notification'), { id: params.meetingId }))
```

and change the comment on the `excludeUserId` field from

```ts
      /** Optional so SYSTEM_CONTEXT callers (inbound GCal sync) notify everyone — there is no actor to exclude. */
```

to

```ts
      /** Optional: a caller with no actor (inbound calendar sync) notifies everyone. */
```

- [ ] **Step 4: The pipeline move runs as the actor**

Replace the whole of `src/features/customer-pipelines/dal/server/move-customer-to-pipeline.ts` with

```ts
import type { MeetingPipeline } from '@/shared/constants/enums/pipelines'
import type { ScopedContext } from '@/shared/dal/server/types'

import { and, eq, isNull } from 'drizzle-orm'

import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema/meetings'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'

/**
 * Moves all of a customer's non-project meetings to a target pipeline; project meetings stay where they are.
 * Through `meetingCrud.update` so the update hook fires per row and open meeting cards repaint.
 * The caller is gated to `manage CustomerPipeline`, so the acting user reaches every meeting.
 */
export async function moveCustomerToPipeline(
  ctx: ScopedContext,
  customerId: string,
  pipeline: MeetingPipeline,
): Promise<void> {
  const meetingIds = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(and(
      eq(meetings.customerId, customerId),
      isNull(meetings.projectId),
    ))

  for (const m of meetingIds) {
    dalVerifySuccess(await meetingCrud.update(ctx, { id: m.id, data: { pipeline } }))
  }
}
```

In `src/trpc/routers/customer-pipelines.router.ts` change the call

```ts
      await moveCustomerToPipeline(input.customerId, input.pipeline)
```

to

```ts
      await moveCustomerToPipeline(ctx, input.customerId, input.pipeline)
```

- [ ] **Step 5: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: both pass. `grep -rn "SYSTEM_CONTEXT" src/shared/modules/meetings src/shared/services/notification.service.ts src/features/customer-pipelines/dal/server/move-customer-to-pipeline.ts` prints nothing. `grep -rn "SYSTEM_CONTEXT" src --include='*.ts' --include='*.tsx' | wc -l` is 4 lower than before this task (report both numbers; the five comment mentions in `entities/meetings/dal/server/crud.ts` are reworded in Task 4).

- [ ] **Step 6: Commit**

```bash
git add src/shared/domains/permissions/rules/system.ts src/shared/modules/meetings/business/service.ts src/shared/services/notification.service.ts src/features/customer-pipelines/dal/server/move-customer-to-pipeline.ts src/trpc/routers/customer-pipelines.router.ts
git commit -m "refactor(permissions): the reschedule replacement and the meeting notifications run as named system contexts; the super-admin's pipeline move runs as the actor

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The Meeting family on compiled rules

One commit: the switch, the rules, every meeting reader, the kanban arms, the routers and the dispatcher's walls land together (see the last Global Constraint).

**Files:**
- Modify: `src/shared/domains/permissions/rules/agent.ts` (the Meeting lines), `src/shared/domains/permissions/rules/dispatcher.ts` (the Meeting lines)
- Modify: `src/shared/entities/meetings/lib/server-spec.ts` (drop `visibility`)
- Delete: `src/shared/entities/meetings/lib/visibility.ts`
- Modify: `src/shared/dal/server/lib/scope.ts:24` (`COMPILED_SUBJECTS`)
- Modify: `src/trpc/routers/meetings.router/procedures.ts` (whole file), `reads.router.ts`, `participants.router.ts`, `business.router.ts` (`meetingProcedure` → `agentProcedure`; the participants probe)
- Modify: `src/shared/entities/meetings/dal/server/participants.ts:23-34` (delete `isParticipant`)
- Modify: `src/shared/entities/meetings/dal/server/queries.ts` (`listMeetings`, `getByIdWithJoins`, `getRescheduleChain`, `listMeetingsForProject`)
- Modify: `src/shared/entities/meetings/dal/server/meetings-with-proposals.ts` (takes the context; the proposal wall)
- Modify: `src/shared/entities/customers/dal/server/get-customer-profile.ts:68`
- Modify: `src/shared/entities/customers/dal/server/pipeline-items.ts` (`PipelineBranchArgs`, the four meeting arms)
- Modify: `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts:106`, `:140`
- Modify: `src/trpc/routers/customer-pipelines.router.ts` (`getCustomerProjects`, `assignToProject`, imports)
- Modify: `src/trpc/routers/meeting-flow.router.ts` (`getPersonaProfile`, imports)
- Modify: `src/trpc/routers/projects.router/business.router.ts:60-64` and imports
- Modify: `src/trpc/routers/schedule.router/sync.router.ts:37-47` (`triggerSync`)
- Modify: `src/shared/entities/meetings/dal/server/crud.ts` (five comments that name `SYSTEM_CONTEXT`)
- Modify: `src/shared/entities/meetings/DOCS.md:74-82` (the visibility paragraph)

**Interfaces:**
- Consumes: `permit(ctx, action, spec, fields?)`, `projectToReadFields(ability, spec, row, target)`, `agentProcedure`, `defineRules((can, cannot) => …)`, the `Meeting` operator `$participatesViaMeeting: { via: 'self', userId }` (declared in `operators.ts`, SQL body in `operators/meeting-participation.ts`).
- Produces: `getMeetingsWithProposals(ctx: ScopedContext, where: SQL)`; `PipelineBranchArgs.meetingReach: SQL`; `meetingProcedure` no longer exists; `isParticipant` no longer exists.

- [ ] **Step 1: The rules**

In `src/shared/domains/permissions/rules/agent.ts` replace

```ts
    can('read', 'Meeting')
```

with

```ts
    // A meeting is reached by sitting in it; the row filter and the UI read this one rule.
    can('read', 'Meeting', { $participatesViaMeeting: { via: 'self', userId } })
```

In `src/shared/domains/permissions/rules/dispatcher.ts` change the builder signature to `defineRules((can, cannot) => {` and replace

```ts
    can('read', 'Meeting')
    can('create', 'Meeting') // books appointments (lands unassigned — see resolve-owner.ts)
    can('update', 'Meeting')
```

with

```ts
    // Every meeting, project meetings included: the dispatcher schedules the agents' days.
    can('read', 'Meeting')
    can('create', 'Meeting') // books appointments (lands unassigned — see resolve-owner.ts)
    can('update', 'Meeting')
    // The in-meeting deal structure is pricing. Not readable, so not writable either.
    cannot(['read', 'update'], 'Meeting', ['flowStateJSON'])
```

The `cannot` comes after both Meeting grants: `assertRules` refuses a `can` for the same action and subject after a `cannot`.

- [ ] **Step 2: The spec and the switch**

Replace the whole of `src/shared/entities/meetings/lib/server-spec.ts` with

```ts
import { defineEntitySpec } from '@/shared/dal/server/lib/define-spec'
import {
  insertMeetingSchema,
  meetings,
  selectMeetingSchema,
} from '@/shared/db/schema'
import { MEETING } from '@/shared/entities/meetings/lib/constants'

const updateMeetingSchema = insertMeetingSchema.partial()

const SERVER_OWNED_COLUMNS = {
  shareToken: true,
  homeownerConfirmedAt: true,
  homeownerConfirmedVia: true,
  newTimeRequestedAt: true,
  rescheduledFromId: true,
} as const

/**
 * The crud router's schemas. Only server code writes these columns, and Zod strips an unknown key,
 * so a client that sends one writes nothing. The DAL keeps the full schemas: it parses after the hooks run.
 */
export const meetingClientSchemas = {
  insert: insertMeetingSchema.omit(SERVER_OWNED_COLUMNS),
  update: updateMeetingSchema.omit(SERVER_OWNED_COLUMNS),
}

export const meetingServerSpec = defineEntitySpec({
  entityName: MEETING,
  subject: MEETING,
  conditionColumns: [],
  table: meetings,
  schemas: {
    insert: insertMeetingSchema,
    update: updateMeetingSchema,
    select: selectMeetingSchema,
  },
})
```

Delete `src/shared/entities/meetings/lib/visibility.ts` (`git rm`). `userParticipatesInMeeting` in `dal/server/participants.ts` stays: applications, proposals and the kanban's proposal arms still use it. The `visitMessages` part needs no line of its own: `isCompiled(meetingMessageServerSpec)` is true once `Meeting` is in the set, because `subjectOf` walks a sub-entity to its root parent's subject; its reads follow the meeting and its writes need `update Meeting` on `visitMessages`, which agents and dispatchers hold through their bare `update`. The `VisitMessages` feature gate on `visitMessagesProcedure` is untouched.

In `src/shared/dal/server/lib/scope.ts` change line 24 to

```ts
export const COMPILED_SUBJECTS: ReadonlySet<EntitySubject> = new Set<EntitySubject>(['Customer', 'CustomerNote', 'Meeting'])
```

- [ ] **Step 3: The meeting procedures**

Replace the whole of `src/trpc/routers/meetings.router/procedures.ts` with

```ts
import { TRPCError } from '@trpc/server'

import { agentProcedure } from '../../init'

/** The visit-message surfaces. No role is granted `VisitMessages`, so only a super-admin passes today. */
export const visitMessagesProcedure = agentProcedure.use(async ({ ctx, next }) => {
  if (ctx.actor.ability.cannot('read', 'VisitMessages')) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to see visit messages.' })
  }
  return next({ ctx })
})
```

In `reads.router.ts`, `participants.router.ts` and `business.router.ts` replace the import `import { meetingProcedure } from './procedures'` with `import { agentProcedure } from '@/trpc/init'` (`business.router.ts` already imports `createTRPCRouter` from `'../../init'`; add `agentProcedure` to that import instead) and every `meetingProcedure` with `agentProcedure`. In `reads.router.ts` the existing `import { createTRPCRouter } from '@/trpc/init'` becomes `import { agentProcedure, createTRPCRouter } from '@/trpc/init'`; the same in `participants.router.ts`.

- [ ] **Step 4: The participants list probes the Meeting reach**

In `src/trpc/routers/meetings.router/participants.router.ts` replace the body of `getParticipants`

```ts
    .query(async ({ ctx, input }) => {
      const isOmni = ctx.actor.ability.can('manage', 'all')

      if (!isOmni && !(await isParticipant(input.meetingId, ctx.session.user.id))) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this meeting',
        })
      }

      return getParticipantsForMeeting(input.meetingId)
    }),
```

with

```ts
    .query(async ({ ctx, input }) => {
      // The participants table has no spec of its own; whoever reaches the meeting reads its participants.
      if (!(await permit(ctx, 'read', meetingServerSpec).probe(input.meetingId))) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' })
      }
      return getParticipantsForMeeting(input.meetingId)
    }),
```

Delete the five-line comment above `getParticipants` that starts `// Returns all participants for a meeting` and ends `// queries meetingParticipants table directly — keep the explicit isParticipant check.`; keep a one-line `// Used by the inline ParticipantPicker and ManageParticipantsModal.` if you want the consumer named, nothing about scope. Remove `isParticipant` from the `participants` import list and add

```ts
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
```

In `src/shared/entities/meetings/dal/server/participants.ts` delete the `isParticipant` function (lines 23 to 34, including its doc comment); it has no other caller.

- [ ] **Step 5: The meeting readers**

In `src/shared/entities/meetings/dal/server/queries.ts` add the imports

```ts
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { projectToReadFields } from '@/shared/dal/server/lib/permissions/project'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
```

`listMeetings`: replace

```ts
    const where = and(
      ctx.scope ?? undefined,
      buildSearchWhere(input.search, [customers.name, sql`${meetings.meetingType}::text`]),
      MEETING_FIELD_SQL.where(input.filters),
    )
```

with

```ts
    const where = and(
      permit(ctx, 'read', meetingServerSpec).sql,
      buildSearchWhere(input.search, [customers.name, sql`${meetings.meetingType}::text`]),
      MEETING_FIELD_SQL.where(input.filters),
    )
```

and in the returned object wrap each assembled row so the `rows:` entry reads

```ts
      rows: result.rows.map((row) => {
        const rowParticipants = participantsByMeeting.get(row.id) ?? []
        const ownerRow = rowParticipants.find(p => p.role === 'owner')
        const coOwnerRow = rowParticipants.find(p => p.role === 'co_owner')

        // A read field rule (a dispatcher's withheld deal structure) applies to a hand-written row too.
        return projectToReadFields(ctx.actor.ability, meetingServerSpec, {
          ...row,
          leadSource: row.leadSource,
          participants: rowParticipants.map(p => ({
            id: p.userId,
            name: p.userName,
            image: p.userImage,
            role: p.role,
          })),
          owner: ownerRow
            ? {
                id: ownerRow.participantId,
                userId: ownerRow.userId,
                role: 'owner' as const,
                userName: ownerRow.userName,
                userEmail: ownerRow.userEmail,
                userImage: ownerRow.userImage,
              }
            : null,
          coOwner: coOwnerRow
            ? {
                id: coOwnerRow.participantId,
                userId: coOwnerRow.userId,
                role: 'co_owner' as const,
                userName: coOwnerRow.userName,
                userEmail: coOwnerRow.userEmail,
                userImage: coOwnerRow.userImage,
              }
            : null,
        }, row)
      }),
```

(the existing `as PaginatedResult<MeetingListRow>` cast on the whole return stays: the projection returns `Record<string, unknown>`).

`getByIdWithJoins`: replace

```ts
      .where(and(
        eq(meetings.id, input.id),
        ctx.scope ?? undefined,
      ))
```

with

```ts
      .where(and(
        eq(meetings.id, input.id),
        permit(ctx, 'read', meetingServerSpec).sql,
      ))
```

and the tail

```ts
    const customer = row.customer?.id ? row.customer : null

    return { ...row, customer } as MeetingWithCustomer
```

with

```ts
    const customer = row.customer?.id ? row.customer : null

    return projectToReadFields(ctx.actor.ability, meetingServerSpec, { ...row, customer }, row) as MeetingWithCustomer
```

`getRescheduleChain`: replace `ctx.scope ?? undefined` in the `WHERE` with `permit(ctx, 'read', meetingServerSpec).sql`, and in its doc comment replace "`ctx.scope` gates the meeting asked for" with "the Meeting read reach gates the meeting asked for".

`listMeetingsForProject`: it stays scoped by the project through `ctx.scope` (the project procedure's), but its call becomes `getMeetingsWithProposals(ctx, where)`.

A note for the implementer: projection removes the key rather than setting it to `null`; every consumer in the tree reads `flowStateJSON` through `?.` or `??` (Step 12 checks it).

- [ ] **Step 6: The profile's proposal wall**

In `src/shared/entities/meetings/dal/server/meetings-with-proposals.ts` change the signature and the proposals query so the function reads

```ts
import type { SQL } from 'drizzle-orm'

import type { ScopedContext } from '@/shared/dal/server/types'
import type { CustomerProfileMeeting, CustomerProfileProposal } from '@/shared/entities/customers/types'

import { count, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema/meetings'
import { proposalViews } from '@/shared/db/schema/proposal-views'
import { proposals } from '@/shared/db/schema/proposals'
import 'server-only'

/**
 * Meetings matching `where`, newest first, each with its proposals: the shape the customer profile and a
 * project's sales history render. An actor with no `read Proposal` rule at all gets the meetings and no
 * proposals: a proposal is money, and the rules say nothing about it for that role.
 */
export async function getMeetingsWithProposals(ctx: ScopedContext, where: SQL): Promise<{ meetings: CustomerProfileMeeting[], proposals: CustomerProfileProposal[] }> {
  const meetingRows = await db
    .select({
      id: meetings.id,
      ownerId: meetings.ownerId,
      projectId: meetings.projectId,
      meetingType: meetings.meetingType,
      meetingOutcome: meetings.meetingOutcome,
      scheduledFor: meetings.scheduledFor,
      confirmedAt: meetings.confirmedAt,
      createdAt: meetings.createdAt,
      updatedAt: meetings.updatedAt,
    })
    .from(meetings)
    .where(where)
    .orderBy(desc(meetings.createdAt))

  const proposalRows = ctx.actor.ability.cannot('read', 'Proposal') || meetingRows.length === 0
    ? []
    : await db
        .select({
          id: proposals.id,
          label: proposals.label,
          status: proposals.status,
          token: proposals.token,
          meetingId: proposals.meetingId,
          sentAt: proposals.sentAt,
          contractSentAt: proposals.contractSentAt,
          createdAt: proposals.createdAt,
          trade: sql<string | null>`${proposals.projectJSON}->'data'->'sow'->0->'trade'->>'label'`.as('trade'),
          finalTcpCents: proposals.finalTcpCents,
          sowRaw: sql<string | null>`${proposals.projectJSON}->'data'->'sow'`.as('sow_raw'),
          viewCount: count(proposalViews.id).as('view_count'),
        })
        .from(proposals)
        .leftJoin(proposalViews, eq(proposalViews.proposalId, proposals.id))
        .where(sql`${proposals.meetingId} IN (${sql.join(meetingRows.map(m => sql`${m.id}`), sql`, `)})`)
        .groupBy(proposals.id)
        .orderBy(desc(proposals.createdAt))
```

The rest of the file (the `allProposals` mapping, `proposalsByMeeting`, `meetingsWithProposals`, the return) is unchanged. The `NULL` placeholder branch of the old `IN` list goes: an empty `meetingRows` now skips the query.

In `src/shared/entities/customers/dal/server/get-customer-profile.ts` line 68 becomes

```ts
  const { meetings: meetingsWithProposals, proposals: allProposals } = await getMeetingsWithProposals(ctx, eq(meetings.customerId, customerId))
```

In `queries.ts` `listMeetingsForProject` the call becomes `await getMeetingsWithProposals(ctx, where)`.

- [ ] **Step 7: The kanban's meeting arms**

In `src/shared/entities/customers/dal/server/pipeline-items.ts` add the import

```ts
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
```

(`permit` and `SQL` are already imported). Extend `PipelineBranchArgs`:

```ts
interface PipelineBranchArgs {
  userId: string
  isOmni: boolean
  canSeeUngated: boolean
  /** The Meeting read reach, for the arms whose outer table is `meetings`. */
  meetingReach: SQL
  customerWhere: SQL | undefined
  /** Undefined keeps the branch's own natural order. */
  customerOrder: SQL[] | undefined
}
```

and in `getCustomerPipelineItems` set it beside the others:

```ts
      meetingReach: permit(ctx, 'read', meetingServerSpec).sql,
```

Replace these four occurrences, and only these (each is in a query whose outer table is `meetings`):

| Line today | From | To |
|---|---|---|
| 162 (the leads/rehash/dead `exists` over `meetings`) | `args.isOmni ? undefined : userParticipatesInMeeting(args.userId, meetings.id),` | `args.meetingReach,` |
| 227 (the fresh `innerJoin(meetings, …)`) | `args.isOmni ? undefined : userParticipatesInMeeting(args.userId, meetings.id),` | `args.meetingReach,` |
| 276 (the assigned-rep `selectDistinctOn` from `meetings`) | `args.isOmni ? undefined : userParticipatesInMeeting(args.userId, meetings.id),` | `args.meetingReach,` |
| 467 (the projects branch's meeting rows from `meetings`) | `args.isOmni ? undefined : userParticipatesInMeeting(args.userId, meetings.id),` | `args.meetingReach,` |

Leave untouched: line 256 and line 294 (`userParticipatesInMeeting(args.userId, proposals.meetingId)` on proposal queries) and line 430 (the projects arm's `ownerId OR isPublic OR participant` filter). Update the comment on `userId` in `getCustomerPipelineItems` from "each branch adds the meeting-side participation its pipeline needs" to "the meeting arms add the Meeting read reach; the proposal arms keep participation until the Proposal family converts". `userParticipatesInMeeting` stays imported (the proposal arms use it).

- [ ] **Step 8: The kanban move's raw meeting selects**

In `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts` add

```ts
import { permit } from '@/shared/dal/server/lib/permissions/permit'
```

and replace the two `ctx.scope ?? undefined,` lines inside the `meetings` selects (lines 106 and 140 today, in the `needs_confirmation`/`meeting_confirmed` branch and the `meeting_completed` branch) with

```ts
        permit(ctx, 'read', meetingServerSpec).sql,
```

The third `ctx.scope ?? undefined` (line 172, the `proposal_sent → declined` branch over `proposals`) stays: Proposal is legacy. The `buildUserContext(user, meetingServerSpec)` calls stay too: for a compiled spec they return the actor with a `null` scope, which the compiled `meetingCrud.update` ignores.

- [ ] **Step 9: The routers that built a meeting context by hand**

`src/trpc/routers/customer-pipelines.router.ts`:
- `getCustomerProjects`: replace
  ```ts
        const scopedCtx = buildUserContext({ userId: ctx.session.user.id, ability: ctx.actor.ability }, meetingServerSpec)
        const meeting = dalToTrpc(await meetingCrud.getById(scopedCtx, { id: input.meetingId }))
  ```
  with
  ```ts
        const meeting = dalToTrpc(await meetingCrud.getById(ctx, { id: input.meetingId }))
  ```
- `assignToProject`: replace
  ```ts
        return dalToTrpc(await meetingCrud.update(
          { actor: ctx.actor, scope: null },
          {
            id: input.meetingId,
            data: { projectId: input.projectId, meetingOutcome: 'converted_to_project' },
          },
        ))
  ```
  with
  ```ts
        // The meeting side is the actor's reach; the project side waits for the Project family.
        return dalToTrpc(await meetingCrud.update(ctx, {
          id: input.meetingId,
          data: { projectId: input.projectId, meetingOutcome: 'converted_to_project' },
        }))
  ```
  and delete the preceding `if (ctx.actor.ability.cannot('update', 'Meeting')) { throw … }` block: the compiled update slot answers forbidden itself when the verb is missing.
- Delete the now-unused imports `buildUserContext` and `meetingServerSpec`.

`src/trpc/routers/meeting-flow.router.ts`, `getPersonaProfile`: replace

```ts
      const scopedCtx = buildUserContext({ userId: ctx.session.user.id, ability: ctx.actor.ability }, meetingServerSpec)
      const row = dalToTrpc(await getByIdWithJoins(scopedCtx, { id: input.meetingId }))
```

with

```ts
      const row = dalToTrpc(await getByIdWithJoins(ctx, { id: input.meetingId }))
```

and delete the imports `buildUserContext` and `meetingServerSpec`. Trim the file's opening comment to its one reason (these procedures serve the meeting-flow feature and are not entity CRUD); drop the sentence about the entity toolkit.

`src/trpc/routers/projects.router/business.router.ts`: replace

```ts
      const meetingCtx = buildUserContext({ userId: ctx.session.user.id, ability: ctx.actor.ability }, meetingServerSpec)
      dalVerifySuccess(await meetingCrud.update(meetingCtx, {
```

with

```ts
      dalVerifySuccess(await meetingCrud.update(ctx, {
```

change the import `import { buildUserContext, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'` to `import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'`, delete the `meetingServerSpec` import, and reword the step-5 comment's last sentence to "`projectId` is in the update hook's calendar trigger set." (no `meetingServerSpec.hooks` reference; the hooks live in the CRUD config).

- [ ] **Step 10: The calendar sweep**

In `src/trpc/routers/schedule.router/sync.router.ts` add the imports

```ts
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
```

and replace

```ts
      // 1. Push unsynced meetings (have scheduledFor but no gcalEventId)
      // All meetings live on the centralized info@ calendar regardless of owner.
      const unsyncedMeetings = await db
        .select({ id: meetings.id })
        .from(meetings)
        .where(and(
          isNotNull(meetings.scheduledFor),
          isNull(meetings.gcalEventId),
        ))
```

with

```ts
      // 1. Push the unsynced meetings within the caller's reach: every meeting lives on the centralized
      //    info@ calendar, but an agent pushes only the ones they sit in.
      const unsyncedMeetings = await db
        .select({ id: meetings.id })
        .from(meetings)
        .where(and(
          isNotNull(meetings.scheduledFor),
          isNull(meetings.gcalEventId),
          permit(ctx, 'read', meetingServerSpec).sql,
        ))
```

- [ ] **Step 11: Comments and the meetings DOCS**

In `src/shared/entities/meetings/dal/server/crud.ts` reword the five comments that name `SYSTEM_CONTEXT`:
- line 45 `// SYSTEM_CONTEXT orchestrators have no user and supply ownerId themselves.` → `// A system caller has no user and supplies ownerId itself.`
- lines 62–63, the two-line comment `// row.ownerId, not the acting user's id, so the participant follows the actual owner on the` / `// SYSTEM_CONTEXT path too. dispatchOrThrow: a missed enqueue must fail the mutation, not drop the event.` → `// row.ownerId, not the acting user's id, so the participant follows the actual owner for a system` / `// caller too. dispatchOrThrow: a missed enqueue must fail the mutation, not drop the event.`
- line 94 `// Only super-admins change a setter for now; SYSTEM_CONTEXT (\`manage all\`) may.` → `// Only super-admins change a setter for now; a system caller (\`manage all\`) may.`
- line 115 `// excludeUserId is optional: under SYSTEM_CONTEXT there is no actor to exclude.` → `// excludeUserId is optional: a system caller has no actor to exclude.`
- line 190 `// Loses to create.before on the authed path; the source.ownerId fallback keeps a SYSTEM_CONTEXT duplicate from crashing.` → `// Loses to create.before on the authed path; the source.ownerId fallback keeps a system caller's duplicate from crashing.`

In `src/shared/entities/meetings/DOCS.md` replace the `### visibility-via-participation` section's last three lines

```
**Why**: meeting participation is the single source of "did this agent work with this customer." Every visibility predicate in the entity graph derives from here.
**Reference impl**: `dal/server/participants.ts:userParticipatesInMeeting`
**Enforced by**: the inline scope step (`resolveVisibilityScope(meetingServerSpec, …)`) on every entity procedure (when meetings is migrated to the entity server system)
```

with

```
**Why**: meeting participation is the single source of "did this agent work with this customer." Every visibility predicate in the entity graph derives from here.
**Reference impl**: the agent's `read Meeting` rule in `src/shared/domains/permissions/rules/agent.ts` (`$participatesViaMeeting` via `self`), whose SQL body is `src/shared/dal/server/lib/permissions/operators/meeting-participation.ts`. Dispatchers hold a bare `read Meeting` (every meeting) with `flowStateJSON` withheld; `dal/server/participants.ts:userParticipatesInMeeting` remains for the families not yet on compiled rules.
**Enforced by**: `permit(ctx, 'read', meetingServerSpec)` inside `createCrudDal` and the hand-written meeting readers (`listMeetings`, `getByIdWithJoins`, `getRescheduleChain`, the kanban's meeting arms).
```

and change the first sentence of that section from "A non-omni agent sees a meeting only if they are a participant …" to "An agent sees a meeting only if they are a participant (any of `owner | co_owner | helper`); a dispatcher sees every meeting; super-admins (`manage all`) bypass scoping."

- [ ] **Step 12: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: both pass.

Run the greps and report each count:
- `grep -rn "meetingVisibility\|meetingProcedure\|\bisParticipant\b" src` → nothing.
- `grep -rn "ctx\.scope" src/shared/entities/meetings src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts` → only `queries.ts` (`listMeetingsForProject`, the project's scope: two code lines and the doc comment) and `move-customer-pipeline-item.ts:172` (the proposal branch).
- `grep -rn "buildUserContext(.*meetingServerSpec" src` → only the two lines in `move-customer-pipeline-item.ts`.
- `grep -rn "SYSTEM_CONTEXT" src --include='*.ts' --include='*.tsx' | wc -l` → 5 lower than after Task 3 (the crud.ts comments).
- `grep -rn "flowStateJSON === null\|flowStateJSON !== null" src` → nothing.
- `grep -n "userParticipatesInMeeting" src/shared/entities/customers/dal/server/pipeline-items.ts` → exactly the import line plus two call sites (the proposal arms).

Start the dev server (port 3003, `DEV_LOGIN_SECRET` exported in that shell only) and load `/`: the server starts, so `assertRules` accepted the dispatcher's `cannot` after its grants and `assertRulesCompile` accepted the agent's operator condition. Stop the server.

- [ ] **Step 13: Commit**

```bash
git add src/shared/domains/permissions/rules/agent.ts src/shared/domains/permissions/rules/dispatcher.ts src/shared/entities/meetings/lib/server-spec.ts src/shared/dal/server/lib/scope.ts src/trpc/routers/meetings.router/procedures.ts src/trpc/routers/meetings.router/reads.router.ts src/trpc/routers/meetings.router/participants.router.ts src/trpc/routers/meetings.router/business.router.ts src/shared/entities/meetings/dal/server/participants.ts src/shared/entities/meetings/dal/server/queries.ts src/shared/entities/meetings/dal/server/meetings-with-proposals.ts src/shared/entities/customers/dal/server/get-customer-profile.ts src/shared/entities/customers/dal/server/pipeline-items.ts src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts src/trpc/routers/customer-pipelines.router.ts src/trpc/routers/meeting-flow.router.ts src/trpc/routers/projects.router/business.router.ts src/trpc/routers/schedule.router/sync.router.ts src/shared/entities/meetings/dal/server/crud.ts src/shared/entities/meetings/DOCS.md
git rm -q src/shared/entities/meetings/lib/visibility.ts
git commit -m "feat(permissions): the Meeting family runs on compiled rules — agents reach meetings they sit in, dispatchers reach every meeting without its deal structure, the meeting readers and kanban arms take the reach, the legacy meeting scope goes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Browser checks per role, the record, the boundary

**Files:**
- Create (scratchpad only, never committed): `$SCRATCH/unit3-part2/checks.cjs`, a Playwright script that signs in through `/api/dev/playwright-session?secret=…&role=<role>` on `http://localhost:3003` and issues GET requests only (every tRPC POST aborted at the route level, as the part 1 script did). The secret comes from the shell environment, never from a file.
- Modify: `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (Unit 3 block: part 2 landed, commits, verification, what is carried), `docs/superpowers/specs/2026-10-05-permissions-structure-design.md` (status line), `docs/plans/2026-09-07-casl-re-grounding/DISTILLED-2026-10-01.md` (§1 status, §7 next steps)

**Owner prerequisites, stated before the check runs:** the dev `agent` fixture participates in one meeting (added by the owner for part 1). The write checks are the owner's, by hand, on records the owner names.

- [ ] **Step 1: The read checks, scripted**

Per role, record status codes, row counts and the presence or absence of keys:

| # | Role | Check | Expected |
|---|---|---|---|
| R1 | super-admin | `/dashboard/schedule`, `/dashboard/meetings`, `/dashboard/pipelines` (fresh, rehash) | render; `meetingsRouter.reads.list` total recorded |
| R2 | dispatcher | `meetingsRouter.reads.list` total; `/dashboard/schedule` and `/dashboard/meetings` | the total equals R1's; project meetings appear |
| R3 | dispatcher | `meetingsRouter.reads.getByIdWithJoins` for a meeting with a deal structure (id from R1); `/dashboard/meetings/<id>`; `/dashboard/meetings` with that meeting's row panel open | the payload has no `flowStateJSON` key; both pages render |
| R4 | dispatcher | `/dashboard/pipelines` tabs; `customerPipelinesRouter.getCustomerPipelineItems` for `fresh` and for `projects` | leads, rehash, dead, fresh tabs and no projects tab; fresh returns rows whose `proposals` are empty and carry no value; projects returns 0 rows |
| R5 | dispatcher | `customerPipelinesRouter.getCustomerProfile` for a fresh customer (id from R4); `meetingsRouter.participants.getParticipants` for any meeting | meetings listed, `proposals` empty; participants listed |
| R6 | agent | `meetingsRouter.reads.list` total; `/dashboard/schedule`; `/dashboard/customers` | the same counts as before part 2 (the fixture's one meeting and its customer) |
| R7 | agent | `getParticipants` for a meeting the fixture does not sit in | NOT_FOUND (was FORBIDDEN) |
| R8 | homeowner, user | `/dashboard` | redirected as before |

- [ ] **Step 2: The write checks, by the owner**

| # | Role | Action | Expected |
|---|---|---|---|
| W1 | agent | book a meeting on the participation customer | created, the agent is its owner participant |
| W2 | agent | book a meeting on a customer outside reach, by id through the API; move an existing meeting to such a customer | NOT_FOUND both times |
| W3 | dispatcher | save a fresh customer's discovery profile; book a meeting on a lead; set an outcome with reason on a lead's meeting | saved; created unassigned; outcome set and the note written |
| W4 | dispatcher | change a meeting's deal structure through the API (`crud.update` with `flowStateJSON`) | FORBIDDEN naming `Meeting.flowStateJSON` (the meeting flow page shows "Failed to save") |
| W5 | anyone | submit the intake form at `/intake` | customer and meeting created (no user, so no probe) |
| W6 | agent | calendar push (`scheduleRouter.sync.triggerSync`) | only the fixture's meeting is swept (server log) |
| W7 | super-admin | everything above | allowed |

- [ ] **Step 3: Record**

In the tracker's Unit 3 block add under the "Part 2 design" bullet: `**Part 2 landed <date>:** the Meeting family (commits …). Verified <date>: R1–R8 (script) and W1–W7 (owner) PASS; <anything that did not>.` Carry: Q8 #4–#7 and the Meeting rows' dependency on #217/#220 (unit 4); the kanban's proposal arms, S12 and `getCustomerProjects`'s proposal labels (part 3); `assignToProject`'s project side (part 4); `Application`'s parent (when main's applications work lands). Update the spec's status line to "Units 1 and 2 of §11, and parts 1 and 2 of unit 3, are built". Update DISTILLED §1 and §7 (step 2 becomes: part 3, the Proposal family). Refresh the memory file `project-permissions-casl-compiler.md` and its `MEMORY.md` line.

- [ ] **Step 4: The boundary**

```bash
git merge main
```

Expect conflicts in files main is moving (`entities/` → `modules/`); resolve toward main's placement, never recreating a file main relocated. Then `pnpm tsc && pnpm lint`, push, and re-run R2, R4 and R6 against the merged tree.

- [ ] **Step 5: Commit**

```bash
git add docs/plans/2026-08-10-casl-scope-compiler-epic.md docs/superpowers/specs/2026-10-05-permissions-structure-design.md docs/plans/2026-09-07-casl-re-grounding/DISTILLED-2026-10-01.md
git commit -m "docs(permissions): unit 3 part 2 recorded — the Meeting family, with the browser evidence

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

The plan file itself is deleted in the same commit once the owner has seen the record (`git rm docs/superpowers/plans/2026-10-08-permissions-unit-3-part-2-meeting-family.md`), as the part 1 plan was.
