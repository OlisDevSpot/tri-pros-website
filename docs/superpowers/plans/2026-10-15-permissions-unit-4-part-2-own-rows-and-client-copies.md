# Permissions unit 4 part 2: own rows, the public intake, and the client copies

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner's Q8 rulings of batches 2–4 that need a build become rule lines and checks. Activities are their owner's and read only while the linked record does (D-35). Agents delete their draft proposals. The public intake checks its link (D-36). A rep's proposal page gates the phone. Dispatchers stop learning proposal state from the flag. The three hand-written client copies of server rules go.

**Architecture:** Rules live in `src/shared/domains/permissions/rules/{agent,dispatcher}.ts`. The DAL enforces them through `createCrudDal`'s compiled scoping: row reach = the action's rules AND the read rules (D-15), and each changed column is checked on the loaded row (D-17).

Activity becomes a compiled entity with `ownerId` as its condition column. A new read operator, `$linkedRecordInReach`, compiles to "the linked id is among the rows of the linked type's table that this same actor may read". Operators get the actor's read reach through a new `OperatorContext.inReadReach`, which reuses the engine's own `through()`.

The pipeline boards a role opens become field lists on the `CustomerPipeline` subject, so `getAccessiblePipelines` reads the rules instead of hand-kept arrays. UI gates read the same rules; a conditioned mutation rule is checked on the row with the typed `subject()` helper.

**Tech Stack:** TypeScript, Drizzle, CASL 6.8.0 (`defineRules`), `@casl/react`, tRPC, Zod 4.

**Spec:** `docs/superpowers/specs/2026-10-05-permissions-structure-design.md` (§5 rules, §6 enforcement; §8: the three hand-written copies go in unit 4). Rulings are in the tracker `docs/plans/2026-08-10-casl-scope-compiler-epic.md`:
- §0.3 Q8 (batch 2, the phone gate and `customerHasSentProposal`; batch 3, #14/#15/#21; batch 4, #16/#23/#24)
- §2.1 D-07, D-15, D-17, D-35, D-36
- §5.3 Ledger 2 (three rows close here)
- §5.4 (the hand-written copies)
- Appendix A, 2026-10-15 (batches 3 and 4)

## Global Constraints

- No DB writes for testing (dev included). Writes are checked by the owner's hand (Task 10).
- Never `pnpm build`. Gate: `pnpm tsc` and `pnpm lint`, plus the DB-free rules probe.
- `pnpm tsc` does not type-check `.superpowers/` (dot-directories are skipped). Type-check probes with `pnpm tsc -p .superpowers/tsconfig.probe.json --noEmit`.
- Run probes with `NODE_OPTIONS=--conditions=react-server pnpm -s tsx --tsconfig tsconfig.json <file>` (`server-only` throws otherwise).
- Comments say why, never what; no plan, spec, task or ruling citations in code.
- Never print phones, emails, tokens, slugs or ids in probe output or logs.
- Never `git stash`; stage by explicit path; push after every commit; stay on `refactor/285-refactor-permissions-casl-scope-compiler`.
- The pre-commit hook takes about 110 s: give every `git commit` call a 400 s timeout.
- Some files are CRLF. After any scripted edit, check `git diff --shortstat` shows only the lines you meant.
- No outcome or pipeline-derivation logic (main's lifecycle work).
- No ad-hoc thin APIs: writes go through the entity's crud, reach checks through `permit(...).probe`.
- `CLAUDE.local.md` stays uncommitted.
- **New names, for the owner to agree in the plan review:**
  - the read operator `$linkedRecordInReach` (value `true`)
  - `OperatorContext.inReadReach` and `operatorContextFor` (engine internals)
  - `activityServerSpec` / `activityCrud` / `isWholeLink` at the entity's conventional paths
  - `LINKED_RECORD_SPECS` in `src/shared/entities/activities/lib/linked-record-specs.ts`
  - Proposal `conditionColumns: ['id', 'status']`
  - the type `SubjectFieldsWithoutSpec` (with `CustomerPipeline: Pipeline`)
  - `src/shared/entities/customers/lib/phone-access.ts`, which `canSeeUngatedPhone` moves into
  - `getFullView`'s option `{ gatePhone }`
  - `isProposalStatus` in `src/shared/constants/enums/proposals.ts`
  - `getActiveLeadSourceByLink`
  - `src/trpc/lib/assert-intake-link.ts` (`assertIntakeLink`)

  No other new names.
- Out of scope:
  - #8 (blocked on main's `cancelled_scopes`)
  - VoIP (deferred), except one import line in Task 5
  - the Google Calendar activity sync's own reads and writes (logged, D-35)
  - R2 media left behind by a proposal delete (owner: later)
  - the free-text leads stage (lifecycle work)
  - `loadWorkable`'s plain `Error` (see Decision 11)

## Decisions in this plan (the owner confirms each in the review)

1. **Activity read:** `can('read', 'Activity', { ownerId: userId, $linkedRecordInReach: true })` for agents and dispatchers. `create`, `update` and `delete` are `{ ownerId: userId }`. The crud's `create.before` stamps the owner. The update schema leaves out `ownerId`, so no write can move an activity to someone else.
   - "No link" means `entityType` or `entityId` is null; such an activity passes the link test.
   - New writes must carry the link whole: the router refuses half of one, and the form sends a link only when both halves are filled.
   - A written link is probed through the writer's own read reach for that type, NOT_FOUND on a miss (D-07).
   - I checked that CASL parses a column test and an operator in one conditions object (it emits `and(eq ownerId, linkedRecordInReach)`).
2. **`activities.getById` is deleted.** It has no caller (`git grep "activities.getById"` is empty), and it is the unchecked read that §5.1 S9 names. `list`, `create`, `update`, `complete` and `delete` keep their names and inputs and run through `activityCrud`. A row out of reach now answers NOT_FOUND on every write, so `update`/`delete` no longer reveal which ids exist (S9).
3. **No row check on the activity actions.** The schedule lists only rows the read reach returns, and for agents and dispatchers those are their own. The verb-only `getVisibleActions` check is therefore enough. `read Activity` can never be tested on a row (it carries an operator); the types refuse it.
4. **The agent's draft delete:** `can('delete', 'Proposal', { status: 'draft' })`, narrowed to the agent's participation by D-15. The Delete action is checked on the row. A row that does not carry `status` (some cards) offers Delete only to whoever may delete any proposal.
   - **Consequence:** a draft with a Zoho draft envelope can be deleted, and the Zoho draft (0 credits) stays behind.
   - **Owner choice:** add `contractEnvelopeId: null` to the condition. That needs `contractEnvelopeId` as a third Proposal condition column. Not in this plan unless you say so.
5. **#9:** agents get `cannot('update', 'Project', ['isPublic', 'customerId', 'ownerId'])`, replacing the `isPublic`-only line. The project edit form sends neither column, and conversion links the customer as `derived:project-conversion`. Dispatchers hold no Project rules.
6. **The setter at rule level (optional; recommended).** `cannot('update', 'Meeting', ['ownerId', 'setBy'])` for agents and dispatchers. `update.before` already refuses a `setBy` change without `assign`; the rule makes the client ability say so too. Drop Task 4 Step 3 if you say no.
7. **The phone on the proposal page:**
   - `getFullView` keeps returning the real phone to its server callers: the contract envelope (Zoho reads it as the agent, and a contract can be drafted on a draft proposal at the visit), the PDFs, the views notification and the homeowner's own share-link view.
   - Only the `proposalsRouter.business.getFullView` procedure asks for `{ gatePhone: true }`, and only for a signed-in caller.
   - **Consequence:** an agent who opens the share link or downloads the PDF (they hold the token) still sees the phone. The gate closes the dashboard path only.
8. **`hasSentProposalSql(readsProposals)`:** a caller who holds no `read Proposal` (dispatchers) is told `false`. Dispatchers see the phone ungated, so nothing they use changes.
9. **The phone check is one function.** `canSeeUngatedPhone` moves to a client-safe file, `phone-access.ts`. The SQL gate and the profile header both import it. `can-see-phone.ts` is deleted, which also fixes its missing dispatcher branch (report 12, M2).
10. **Pipelines from the rules.** `can('read', 'CustomerPipeline', ['projects', 'fresh'])` for agents and `['leads', 'rehash', 'dead', 'fresh']` for dispatchers; super-admin opens all through `manage all`. `getAccessiblePipelines` stays, as one line that reads the rule; its server guard, the sidebar, the select and the page keep calling it. The two hand-kept arrays go. The lists themselves do not change.
11. **Part 1's deferred minors.**
    - In: `deleteImpl` builds its delete WHERE once; the decline drag selects proposals with `permit(ctx, 'update', proposalServerSpec, ['status'])`.
    - Out: `loadWorkable`'s plain `Error`. Changing it is an error-mapping design for the contract service, not a permissions fix.
12. **The intake check (D-36):**
    - The rate limit runs first, then the link.
    - A caller without `manage all` must send an active source's slug and token, and not `manual`. Otherwise the answer is NOT_FOUND, "This intake link is no longer valid. Ask for a new one."
    - The `/intake` page reads through the same query, so the page and the write cannot disagree.
    - The source's form mode is not enforced (owner, batch 4).

## Review Focus

- **An activity whose linked record moves out of the agent's reach:** gone from the schedule; `complete`, `update` and `delete` answer NOT_FOUND. Covered by the Task 1 probe's agent SQL (owner AND linked branches), Task 2's grep that no raw `db` write remains, and hand check H2.
- **Activities with no link** (hand-made, and the calendar's own): stay visible to their owner, and the calendar sync still runs after create and update. Covered by the Task 1 probe (the `is null` arms), Task 2 Step 4 (the sync calls kept), and H1.
- **The contract envelope on a draft proposal at the visit** still carries the customer's phone, while the agent's proposal page hides it until a proposal is sent. Covered by Task 5 Step 7 (only `business.getFullView` passes `gatePhone`), H5 and H6.
- **A super-admin's Add customer sheet** (no token, with or without a source) still files leads, and its recording upload still works. Covered by Task 8's probe of `assertIntakeLink` on super-admin, and H9.
- **A proposal card without `status`:** offers no Delete to an agent, and keeps it for super-admin. Covered by the Task 3 probe (`deleteNoStatusFallback`) and H4.

---

### Task 1: The linked-record operator and the Activity rules (D-35)

**Files:**
- Modify: `src/shared/domains/permissions/operators.ts` (`OPERATOR_NAMES`, `ReadOperators`)
- Modify: `src/shared/dal/server/lib/permissions/operators.ts` (`OperatorContext`)
- Modify: `src/shared/dal/server/lib/permissions/core.ts` (`operatorContextFor`; `walk`'s and `filterFor`'s context)
- Modify: `src/shared/dal/server/lib/permissions/check-rules.ts` (the interpret call)
- Create: `src/shared/dal/server/lib/permissions/operators/linked-record.ts`
- Modify: `src/shared/dal/server/lib/permissions/interpret.ts` (register the body)
- Create: `src/shared/entities/activities/lib/linked-record-specs.ts`
- Create: `src/shared/entities/activities/lib/server-spec.ts`
- Modify: `src/shared/domains/permissions/specs.ts` and `src/shared/dal/server/specs.ts` (the spec lists)
- Modify: `src/shared/dal/server/lib/scope.ts` (`COMPILED_SUBJECTS`)
- Modify: `src/shared/domains/permissions/types.ts` (`SubjectsWithoutSpec` loses `Activity`)
- Modify: `src/shared/domains/permissions/rules/agent.ts`, `rules/dispatcher.ts`
- Modify: `src/shared/domains/permissions/type-checks/must-not-compile.ts`
- Probe (git-ignored): `.superpowers/permissions-probes/unit4-part2-rules.ts`; `.superpowers/tsconfig.probe.json`

**Interfaces:**
- Consumes: `through(ability, action, parent, fk, fields)` and `pkColumnOf(spec)` (both `core.ts`); `defineOperator` (`../operators`); `defineEntitySpec` (`@/shared/dal/server/lib/define-spec`).
- Produces:
  - `OperatorContext.inReadReach: (spec: AnyServerSpec, fk: PgColumn) => SQL`
  - `operatorContextFor(ability: AppAbility, spec: AnyServerSpec): OperatorContext`
  - `activityServerSpec` (subject `'Activity'`, `conditionColumns: ['ownerId']`)
  - `isWholeLink(link: { entityType?: string | null, entityId?: string | null }): boolean`
  - `LINKED_RECORD_SPECS: { customer, meeting, project, proposal }`
  - the operator `$linkedRecordInReach`
  - the Activity rule lines

  Tasks 2 and 3 import the spec, `isWholeLink` and `LINKED_RECORD_SPECS`. Tasks 3–6 append to the probe.

- [ ] **Step 1: Write the probe, watch it fail**

`.superpowers/permissions-probes/unit4-part2-rules.ts`:

```ts
// Database-free check of unit 4 part 2's rules: every role's ability built as a request builds it.
import type { UserRole } from '@/shared/constants/enums'
import type { ScopedContext } from '@/shared/dal/server/types'

import { PgDialect } from 'drizzle-orm/pg-core'

import { assertRulesCompile } from '@/shared/dal/server/lib/permissions/check-rules'
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import { subject } from '@/shared/domains/permissions/subject'
import { activityServerSpec } from '@/shared/entities/activities/lib/server-spec'

const USER = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const ROLES: UserRole[] = ['super-admin', 'agent', 'dispatcher']
const dialect = new PgDialect()
// Parameters render as $n, so no id reaches the output.
const render = (s: ReturnType<typeof permit>['sql']) => dialect.sqlToQuery(s).sql.replace(/\s+/g, ' ')
const ctxFor = (role: UserRole): ScopedContext => ({ actor: { ability: defineAbilitiesFor({ id: USER, role }), userId: USER }, scope: null })

assertRulesCompile()
for (const role of ROLES) {
  const ctx = ctxFor(role)
  const ab = ctx.actor.ability
  console.log(`\n── ${role} · Activity`)
  console.log(JSON.stringify({
    createMine: ab.can('create', subject('Activity', { ownerId: USER })),
    updateMine: ab.can('update', subject('Activity', { ownerId: USER })),
    updateOthers: ab.can('update', subject('Activity', { ownerId: OTHER })),
    deleteOthers: ab.can('delete', subject('Activity', { ownerId: OTHER })),
  }))
  console.log('read activity :', render(permit(ctx, 'read', activityServerSpec).sql))
}
```

Point the probe tsconfig at it. `.superpowers/tsconfig.probe.json`:

```json
{ "extends": "../tsconfig.json", "include": ["../next-env.d.ts", "permissions-probes/unit4-part2-rules.ts"] }
```

Run: `pnpm tsc -p .superpowers/tsconfig.probe.json --noEmit 2>&1 | grep unit4-part2 | head -3`
Expected: an error on the `activityServerSpec` import (the module does not exist yet).

- [ ] **Step 2: Declare the operator (client-safe)**

`src/shared/domains/permissions/operators.ts`. Replace the names line:

```ts
export const OPERATOR_NAMES = ['participatesViaMeeting', 'inDerivedPipeline', 'linkedRecordInReach'] as const
```

and add to `ReadOperators`, after `Project`:

```ts
  Activity: { $linkedRecordInReach?: true }
```

- [ ] **Step 3: Operators can ask for the actor's read reach**

`src/shared/dal/server/lib/permissions/operators.ts`. Add the type import beside the existing ones:

```ts
import type { AnyServerSpec } from '../../types'
```

and replace `OperatorContext` with:

```ts
/**
 * What an operator compiles against: the outer table and its primary key to correlate on, and the
 * same actor's read reach on another entity, so an operator that follows a link reads through the
 * target's own rules.
 */
export interface OperatorContext {
  table: PgTable
  pk: PgColumn
  inReadReach: (spec: AnyServerSpec, fk: PgColumn) => SQL
}
```

`src/shared/dal/server/lib/permissions/core.ts`. Add the type import:

```ts
import type { OperatorContext } from './operators'
```

Above `filterFor`, add:

```ts
/** The operator context for filters on `spec`'s table, built for one actor. */
export function operatorContextFor(ability: AppAbility, spec: AnyServerSpec): OperatorContext {
  return {
    table: spec.table as PgTable,
    pk: pkColumnOf(spec),
    inReadReach: (target, fk) => through(ability, 'read', target, fk, undefined),
  }
}
```

In `walk`, change the parameter `ctx: { table: PgTable, pk: PgColumn }` to `ctx: OperatorContext`. In `filterFor`, replace `const ctx = { table: spec.table as PgTable, pk: pkColumnOf(spec) }` with:

```ts
  const ctx = operatorContextFor(ability, spec)
```

`src/shared/dal/server/lib/permissions/check-rules.ts`: replace `import { pkColumnOf } from './core'` with `import { operatorContextFor } from './core'`, and the interpret call with:

```ts
              interpret(rule.ast as ScopeNode, operatorContextFor(ability, spec))
```

- [ ] **Step 4: The link's target specs**

`src/shared/entities/activities/lib/linked-record-specs.ts`:

```ts
import type { ActivityEntityType } from '@/shared/constants/enums'

import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
import { projectServerSpec } from '@/shared/modules/projects/core/server-spec'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'

/** The entity each activity link type points at, so the read filter and the write probe follow the same rules. */
export const LINKED_RECORD_SPECS = {
  customer: customerServerSpec,
  meeting: meetingServerSpec,
  project: projectServerSpec,
  proposal: proposalServerSpec,
} as const satisfies Record<ActivityEntityType, unknown>
```

- [ ] **Step 5: The operator's SQL body**

`src/shared/dal/server/lib/permissions/operators/linked-record.ts`:

```ts
import { and, eq, isNull, or } from 'drizzle-orm'

import { activityEntityTypes } from '@/shared/constants/enums'
import { activities } from '@/shared/db/schema/activities'
import { LINKED_RECORD_SPECS } from '@/shared/entities/activities/lib/linked-record-specs'

import { defineOperator } from '../operators'

// A link is a type and an id, so each type is matched against its own table under the reader's read
// rules for it. Half a link points at nothing and blocks nothing.
defineOperator({
  name: 'linkedRecordInReach',
  toSql: (_node, ctx) => {
    if (ctx.table !== activities) {
      throw new Error('[permit] $linkedRecordInReach sits on Activity only')
    }
    const linked = activityEntityTypes.map(type =>
      and(eq(activities.entityType, type), ctx.inReadReach(LINKED_RECORD_SPECS[type], activities.entityId))!)
    return or(isNull(activities.entityType), isNull(activities.entityId), ...linked)!
  },
})
```

`src/shared/dal/server/lib/permissions/interpret.ts`, below the two existing side-effect imports:

```ts
import './operators/linked-record'
```

- [ ] **Step 6: The Activity spec**

`src/shared/entities/activities/lib/server-spec.ts`:

```ts
import { z } from 'zod'

import { defineEntitySpec } from '@/shared/dal/server/lib/define-spec'
import { activities, insertActivitySchema, selectActivitySchema } from '@/shared/db/schema/activities'
import { ACTIVITY } from './constants'

const metaJSON = z.record(z.string(), z.unknown()).nullish()
// The owner is stamped on create and never moves; the calendar columns are the sync's to write.
const insertActivitySchemaOwned = insertActivitySchema.partial({ ownerId: true }).extend({ metaJSON })
const updateActivitySchema = insertActivitySchema
  .pick({ type: true, title: true, description: true, entityType: true, entityId: true, scheduledFor: true, dueAt: true, completedAt: true })
  .extend({ metaJSON })
  .partial()

/** A link is a type and an id together; half of one points at nothing. */
export function isWholeLink(link: { entityType?: string | null, entityId?: string | null }): boolean {
  return (link.entityType == null) === (link.entityId == null)
}

export const activityServerSpec = defineEntitySpec({
  entityName: ACTIVITY,
  subject: ACTIVITY,
  conditionColumns: ['ownerId'],
  table: activities,
  schemas: {
    insert: insertActivitySchemaOwned,
    update: updateActivitySchema,
    select: selectActivitySchema,
  },
})
```

- [ ] **Step 7: Register it**

- `src/shared/domains/permissions/specs.ts`: add `import type { activityServerSpec } from '@/shared/entities/activities/lib/server-spec'` (first in the import block), and `| typeof activityServerSpec` first in `ServerSpec`.
- `src/shared/dal/server/specs.ts`: add `import { activityServerSpec } from '@/shared/entities/activities/lib/server-spec'` and `activityServerSpec,` first in `SERVER_SPECS`.
- `src/shared/dal/server/lib/scope.ts`: add `'Activity'` to `COMPILED_SUBJECTS`, which becomes `['Activity', 'AppSetting', 'Customer', 'CustomerNote', 'LeadSource', 'Meeting', 'Proposal', 'Project']`.
- `src/shared/domains/permissions/types.ts`: delete the line `  Activity: CrudAction` from `SubjectsWithoutSpec`.

- [ ] **Step 8: The rules**

`src/shared/domains/permissions/rules/agent.ts`, replace:

```ts
    can(['read', 'create', 'update', 'delete'], 'Activity')
```

with:

```ts
    // An activity is its owner's note about a record. Reading it also takes that record, so a customer or
    // meeting handed to someone else takes its reminders out of reach with it.
    can('read', 'Activity', { ownerId: userId, $linkedRecordInReach: true })
    can(['create', 'update', 'delete'], 'Activity', { ownerId: userId })
```

`src/shared/domains/permissions/rules/dispatcher.ts`, replace:

```ts
    cannot('update', 'Meeting', ['ownerId'])

    can('read', 'User')
```

with:

```ts
    cannot('update', 'Meeting', ['ownerId'])

    // An activity is its owner's note about a record. Reading it also takes that record, so a customer or
    // meeting handed to someone else takes its reminders out of reach with it.
    can('read', 'Activity', { ownerId: userId, $linkedRecordInReach: true })
    can(['create', 'update', 'delete'], 'Activity', { ownerId: userId })

    can('read', 'User')
```

- [ ] **Step 9: The wrong-on-purpose file**

`src/shared/domains/permissions/type-checks/must-not-compile.ts`.

In `rulesThatMustCompile`, after `can(['read', 'create', 'update', 'delete'], 'Activity')`:

```ts
  can('read', 'Activity', { ownerId: userId, $linkedRecordInReach: true })
  can(['create', 'update', 'delete'], 'Activity', { ownerId: userId })
```

In the `defineRules` block of expected errors, after the `$inDerivedPipeline: ['nope']` line:

```ts
  // @ts-expect-error the link operator belongs to Activity
  can('read', 'Customer', { $linkedRecordInReach: true })
  // @ts-expect-error an operator on a mutation rule
  can('update', 'Activity', { ownerId: userId, $linkedRecordInReach: true })
```

In `checksThatMustCompile`, after the `subject('CustomerNote', …)` lines:

```ts
  ability.can('delete', subject('Activity', { ownerId: 'user-1' }))
```

and after the existing `@ts-expect-error a read rule on Proposal may carry an operator…` line pair:

```ts
// @ts-expect-error a read rule on Activity carries an operator, which only SQL can evaluate
ability.can('read', subject('Activity', { ownerId: 'user-1' }))
```

- [ ] **Step 10: Run the probe**

Run: `pnpm tsc -p .superpowers/tsconfig.probe.json --noEmit; echo probe-tsc=$?`
Expected: `probe-tsc=0`.

Run: `NODE_OPTIONS=--conditions=react-server pnpm -s tsx --tsconfig tsconfig.json .superpowers/permissions-probes/unit4-part2-rules.ts`
Expected (SQL abridged):

```
── super-admin · Activity
{"createMine":true,"updateMine":true,"updateOthers":true,"deleteOthers":true}
read activity : true            (or an always-true predicate)
── agent · Activity
{"createMine":true,"updateMine":true,"updateOthers":false,"deleteOthers":false}
read activity : ("activities"."owner_id" = $1 and ("activities"."entity_type" is null or "activities"."entity_id" is null
  or ("activities"."entity_type" = $2 and "activities"."entity_id" in (select "id" from "customers" where exists (… "meeting_participants" …)))
  or (… $3 … "meetings" …) or (… $4 … "projects" …) or (… $5 … "proposals" …)))
── dispatcher · Activity
{"createMine":true,"updateMine":true,"updateOthers":false,"deleteOthers":false}
read activity : owner_id = $1 and (… is null or … is null or (… "customers" where true) or (… "meetings" where true) or (… "projects" where false) or (… "proposals" where false))
```

`assertRulesCompile()` must not throw: it walks every rule through the interpreter, the new operator included.

- [ ] **Step 11: Gate**

Run: `pnpm tsc > .superpowers/sdd/u4p2-t1-tsc.log 2>&1; echo tsc=$?; pnpm lint > .superpowers/sdd/u4p2-t1-lint.log 2>&1; echo lint=$?`
Expected: `tsc=0`, `lint=0`.

- [ ] **Step 12: Commit and push**

```bash
git add src/shared/domains/permissions/operators.ts src/shared/dal/server/lib/permissions/operators.ts src/shared/dal/server/lib/permissions/core.ts src/shared/dal/server/lib/permissions/check-rules.ts src/shared/dal/server/lib/permissions/operators/linked-record.ts src/shared/dal/server/lib/permissions/interpret.ts src/shared/entities/activities/lib/linked-record-specs.ts src/shared/entities/activities/lib/server-spec.ts src/shared/domains/permissions/specs.ts src/shared/dal/server/specs.ts src/shared/dal/server/lib/scope.ts src/shared/domains/permissions/types.ts src/shared/domains/permissions/rules/agent.ts src/shared/domains/permissions/rules/dispatcher.ts src/shared/domains/permissions/type-checks/must-not-compile.ts
git commit -m "feat(permissions): an activity is its owner's and reads only while the record it links to does"
git push
```

### Task 2: Activities run through the entity

**Files:**
- Create: `src/shared/entities/activities/dal/server/crud.ts`
- Modify: `src/shared/entities/activities/dal/server/queries.ts` (`listActivities`; `activityOwnerScope` deleted)
- Modify: `src/trpc/routers/schedule.router/activities.router.ts` (whole file)
- Modify: `src/features/schedule-management/ui/components/activity-form.tsx` (the `mutate` call)

**Interfaces:**
- Consumes: `activityServerSpec`, `isWholeLink`, `LINKED_RECORD_SPECS` (Task 1); `createCrudDal`; `permit`; `ThrowableDalError`.
- Produces: `activityCrud` with `create`/`update`/`delete`/`getById`. `scheduleRouter.activities` keeps `list`, `create`, `update`, `complete` and `delete` with today's inputs; `getById` is gone.

- [ ] **Step 1: The crud**

`src/shared/entities/activities/dal/server/crud.ts`:

```ts
import type { ActivityEntityType } from '@/shared/constants/enums'
import type { ScopedContext } from '@/shared/dal/server/types'

import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { LINKED_RECORD_SPECS } from '@/shared/entities/activities/lib/linked-record-specs'
import { activityServerSpec } from '@/shared/entities/activities/lib/server-spec'

// The linked id comes from the client, so it is probed through the writer's own read rules before it is
// stored: an activity cannot point at a record its owner may not see. A system write links nothing.
async function assertLinkInReach(ctx: ScopedContext, link: { entityType?: ActivityEntityType | null, entityId?: string | null }): Promise<void> {
  if (ctx.actor.userId === null || link.entityType == null || link.entityId == null) {
    return
  }
  if (!(await permit(ctx, 'read', LINKED_RECORD_SPECS[link.entityType]).probe(link.entityId))) {
    throw new ThrowableDalError({ type: 'not-found' })
  }
}

// Reach is the rules': an activity is its owner's, and reads only while the record it links to does.
export const activityCrud = createCrudDal(activityServerSpec, () => ({
  hooks: {
    create: {
      // Whoever acts owns what they create; a system caller passes the owner it acts for.
      before: async (input, ctx) => {
        await assertLinkInReach(ctx, input)
        return { ...input, ownerId: ctx.actor.userId ?? input.ownerId }
      },
    },
    update: {
      before: async (data, ctx) => {
        await assertLinkInReach(ctx, data)
        return data
      },
    },
  },
}))
```

- [ ] **Step 2: The list reads through the rules**

`src/shared/entities/activities/dal/server/queries.ts`:
- Delete `activityOwnerScope` and its comment.
- In `listActivities`, replace `activityOwnerScope(ctx),` with `permit(ctx, 'read', activityServerSpec).sql,`.
- Imports: add `import { permit } from '@/shared/dal/server/lib/permissions/permit'` and `import { activityServerSpec } from '@/shared/entities/activities/lib/server-spec'`. Drop `import type { SQL } from 'drizzle-orm'`; `eq` stays (the owner join).

- [ ] **Step 3: The router**

`src/trpc/routers/schedule.router/activities.router.ts` becomes:

```ts
import z from 'zod'

import { activityEntityTypes, activityTypes, gcalSyncableActivityTypes } from '@/shared/constants/enums'
import { activityCrud } from '@/shared/entities/activities/dal/server/crud'
import { activityListInputSchema, listActivities } from '@/shared/entities/activities/dal/server/queries'
import { isWholeLink } from '@/shared/entities/activities/lib/server-spec'
import { schedulingService } from '@/shared/services/scheduling.service'
import { agentProcedure, createTRPCRouter } from '@/trpc/init'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'

const WHOLE_LINK = { message: 'A linked record needs its type and its id together.' }

export const activitiesRouter = createTRPCRouter({
  list: agentProcedure
    .input(activityListInputSchema)
    .query(async ({ ctx, input }) => dalToTrpc(await listActivities(ctx, input))),

  create: agentProcedure
    .input(z.object({
      type: z.enum(activityTypes),
      title: z.string().min(1),
      description: z.string().optional(),
      entityType: z.enum(activityEntityTypes).optional(),
      entityId: z.string().uuid().optional(),
      scheduledFor: z.string().optional(),
      dueAt: z.string().optional(),
      metaJSON: z.record(z.string(), z.unknown()).optional(),
    }).refine(isWholeLink, WHOLE_LINK))
    .mutation(async ({ ctx, input }) => {
      const created = dalToTrpc(await activityCrud.create(ctx, input))

      const isSyncable = (gcalSyncableActivityTypes as readonly string[]).includes(created.type)
        && !!created.scheduledFor
      if (isSyncable) {
        await schedulingService
          .syncActivity(ctx.session.user.id, created.id)
          .catch(() => {})
      }

      return created
    }),

  update: agentProcedure
    .input(z.object({
      id: z.string().uuid(),
      type: z.enum(activityTypes).optional(),
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      entityType: z.enum(activityEntityTypes).optional(),
      entityId: z.string().uuid().optional(),
      scheduledFor: z.string().optional(),
      dueAt: z.string().optional(),
      metaJSON: z.record(z.string(), z.unknown()).optional(),
    }).refine(isWholeLink, WHOLE_LINK))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      const updated = dalToTrpc(await activityCrud.update(ctx, { id, data }))

      await schedulingService
        .syncActivity(ctx.session.user.id, updated.id)
        .catch(() => {})

      return updated
    }),

  complete: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) =>
      dalToTrpc(await activityCrud.update(ctx, { id: input.id, data: { completedAt: new Date().toISOString() } }))),

  delete: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await activityCrud.delete(ctx, { id: input.id }))
      return { deleted: true }
    }),
})
```

- [ ] **Step 4: The form sends a link only whole**

`src/features/schedule-management/ui/components/activity-form.tsx`, in `handleSubmit`, replace:

```ts
    createActivity.mutate({
      type,
      title: title.trim(),
      description: description.trim() || undefined,
      scheduledFor: scheduledFor || undefined,
      dueAt: dueAt || undefined,
      entityType: entityType || undefined,
      entityId: entityId.trim() || undefined,
    })
```

with:

```ts
    // A link is a type and an id together; half of one is left off rather than refused.
    const linkedId = entityId.trim()
    const isLinked = Boolean(entityType && linkedId)
    createActivity.mutate({
      type,
      title: title.trim(),
      description: description.trim() || undefined,
      scheduledFor: scheduledFor || undefined,
      dueAt: dueAt || undefined,
      entityType: isLinked && entityType ? entityType : undefined,
      entityId: isLinked ? linkedId : undefined,
    })
```

- [ ] **Step 5: No raw activity write is left in the router**

Run: `git grep -n "from '@/shared/db'\|db\.\(select\|insert\|update\|delete\)" -- src/trpc/routers/schedule.router/activities.router.ts; echo grep=$?`
Expected: no lines, `grep=1`.

Run: `git grep -n "activities.getById\|activityOwnerScope" -- src; echo grep=$?`
Expected: no lines, `grep=1`.

Run: `git grep -n "syncActivity" -- src/trpc/routers/schedule.router/activities.router.ts`
Expected: two lines (create and update), as before.

- [ ] **Step 6: Gate**

Run: `pnpm tsc > .superpowers/sdd/u4p2-t2-tsc.log 2>&1; echo tsc=$?; pnpm lint > .superpowers/sdd/u4p2-t2-lint.log 2>&1; echo lint=$?`
Expected: `tsc=0`, `lint=0`.

- [ ] **Step 7: Commit and push**

```bash
git add src/shared/entities/activities/dal/server/crud.ts src/shared/entities/activities/dal/server/queries.ts src/trpc/routers/schedule.router/activities.router.ts src/features/schedule-management/ui/components/activity-form.tsx
git commit -m "feat(activities): every activity read and write runs through its rules; a link is probed before it is stored"
git push
```

### Task 3: Agents delete their draft proposals

**Files:**
- Modify: `src/shared/modules/proposals/core/server-spec.ts` (`conditionColumns`)
- Modify: `src/shared/constants/enums/proposals.ts` (`isProposalStatus`)
- Modify: `src/shared/domains/permissions/rules/agent.ts` (the proposal block)
- Modify: `src/shared/modules/proposals/core/hooks/use-proposal-action-configs.ts` (`ProposalEntity`; the delete config; imports)
- Modify: `src/shared/domains/permissions/type-checks/must-not-compile.ts`
- Probe: `.superpowers/permissions-probes/unit4-part2-rules.ts` (append)

**Interfaces:**
- Consumes: `subject()` (`@/shared/domains/permissions/subject`); `useAbility()` (`@/shared/domains/permissions/client`).
- Produces: Proposal `conditionColumns: ['id', 'status']`; `isProposalStatus(value: unknown): value is ProposalStatus`; agent `can('delete', 'Proposal', { status: 'draft' })`; `ProposalEntity` gains `status?: string`.

- [ ] **Step 1: Extend the probe, watch it fail**

Append to the probe:

```ts
for (const role of ROLES) {
  const ab = ctxFor(role).actor.ability
  console.log(`\n── ${role} · Proposal delete`)
  console.log(JSON.stringify({
    deleteDraft: ab.can('delete', subject('Proposal', { id: OTHER, status: 'draft' })),
    deleteSent: ab.can('delete', subject('Proposal', { id: OTHER, status: 'sent' })),
    deleteNoStatusFallback: !ab.cannot('manage', 'all'),
  }))
  console.log('delete proposal :', render(permit(ctxFor(role), 'delete', proposalServerSpec).sql))
}
```

Add `import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'` to its imports.

Run: `pnpm tsc -p .superpowers/tsconfig.probe.json --noEmit 2>&1 | grep unit4-part2 | head -3`
Expected: errors on the two `subject('Proposal', { id, status })` lines (`status` is not yet a condition column).

- [ ] **Step 2: `status` becomes a Proposal condition column**

`src/shared/modules/proposals/core/server-spec.ts`:

```ts
  conditionColumns: ['id', 'status'],
```

- [ ] **Step 3: The status guard**

`src/shared/constants/enums/proposals.ts`, after `export type ProposalStatus …`:

```ts
export function isProposalStatus(value: unknown): value is ProposalStatus {
  return (proposalStatuses as readonly unknown[]).includes(value)
}
```

- [ ] **Step 4: The agent's delete rule**

`src/shared/domains/permissions/rules/agent.ts`, after `can('create', 'Proposal')`:

```ts
    // A draft is the rep's work in progress; once it has gone out, it is the customer's record.
    can('delete', 'Proposal', { status: 'draft' })
```

- [ ] **Step 5: The Delete action is checked on the row**

`src/shared/modules/proposals/core/hooks/use-proposal-action-configs.ts`. Imports:

```ts
import { isProposalStatus } from '@/shared/constants/enums/proposals'
import { useAbility } from '@/shared/domains/permissions/client'
import { subject } from '@/shared/domains/permissions/subject'
```

`ProposalEntity` becomes:

```ts
interface ProposalEntity {
  id: string
  token: string | null
  status?: string
}
```

In `useProposalActionConfigs`, beside `const trpc = useTRPC()`:

```ts
  const ability = useAbility()
```

The delete config becomes:

```ts
    {
      action: PROPOSAL_ACTIONS.delete,
      // Who may delete depends on the proposal's status, so a row without it offers delete only to whoever may delete any.
      hidden: entity => isProposalStatus(entity.status)
        ? ability.cannot('delete', subject('Proposal', { id: entity.id, status: entity.status }))
        : ability.cannot('manage', 'all'),
      onAction: async (entity) => {
        const ok = await confirmDelete()
        if (ok) {
          deleteProposal.mutate({ id: entity.id })
        }
      },
      isLoading: deleteProposal.isPending,
    },
```

- [ ] **Step 6: The wrong-on-purpose file**

`src/shared/domains/permissions/type-checks/must-not-compile.ts`:
- Replace `subject('Proposal', { id: 'proposal-1' })` with `subject('Proposal', { id: 'proposal-1', status: 'draft' })`. There are two places: the `financeOptionId` line in `checksThatMustCompile`, and the `@ts-expect-error a read rule on Proposal…` line.
- In `rulesThatMustCompile`, after `can('read', 'Proposal', { id: proposalId })`, add `can('delete', 'Proposal', { status: 'draft' })`.
- In the expected-errors block, after `can('read', 'Proposal', { id: 42 })`, add:

```ts
  // @ts-expect-error not a proposal status
  can('delete', 'Proposal', { status: 'nope' })
```

- [ ] **Step 7: Run the probe**

Run: `pnpm tsc -p .superpowers/tsconfig.probe.json --noEmit; echo probe-tsc=$?` → `probe-tsc=0`.

Run the probe (command in Task 1 Step 10). Expected, after the Activity lines:

```
── super-admin · Proposal delete
{"deleteDraft":true,"deleteSent":true,"deleteNoStatusFallback":true}
delete proposal : true
── agent · Proposal delete
{"deleteDraft":true,"deleteSent":false,"deleteNoStatusFallback":false}
delete proposal : ("proposals"."status" = $1 and exists (… "meeting_participants" …))
── dispatcher · Proposal delete
{"deleteDraft":false,"deleteSent":false,"deleteNoStatusFallback":false}
delete proposal : false
```

- [ ] **Step 8: Gate**

Run: `pnpm tsc > .superpowers/sdd/u4p2-t3-tsc.log 2>&1; echo tsc=$?; pnpm lint > .superpowers/sdd/u4p2-t3-lint.log 2>&1; echo lint=$?`
Expected: `tsc=0`, `lint=0`. Every row the proposal actions receive either carries `status` (a `ProposalStatus` or a `string`, as `ProposalOverviewCardData` declares it) or leaves it out; both satisfy `status?: string`, so no caller changes.

- [ ] **Step 9: Commit and push**

```bash
git add src/shared/modules/proposals/core/server-spec.ts src/shared/constants/enums/proposals.ts src/shared/domains/permissions/rules/agent.ts src/shared/modules/proposals/core/hooks/use-proposal-action-configs.ts src/shared/domains/permissions/type-checks/must-not-compile.ts
git commit -m "feat(permissions): agents delete their draft proposals"
git push
```

### Task 4: A project's customer and owner, and a meeting's setter, are not a rep's to write

**Files:**
- Modify: `src/shared/domains/permissions/rules/agent.ts` (the project and meeting blocks)
- Modify: `src/shared/domains/permissions/rules/dispatcher.ts` (the meeting block)
- Probe: append

**Interfaces:** rule lines only.

- [ ] **Step 1: Extend the probe**

Append:

```ts
for (const role of ROLES) {
  const ab = ctxFor(role).actor.ability
  console.log(`\n── ${role} · Project and Meeting columns`)
  console.log(JSON.stringify({
    projectTitle: ab.can('update', 'Project', 'title'),
    projectCustomer: ab.can('update', 'Project', 'customerId'),
    projectOwner: ab.can('update', 'Project', 'ownerId'),
    projectPublic: ab.can('update', 'Project', 'isPublic'),
    meetingSetter: ab.can('update', 'Meeting', 'setBy'),
    meetingOwner: ab.can('update', 'Meeting', 'ownerId'),
  }))
}
```

Run it. Expected before the change: agent `projectCustomer: true`, `projectOwner: true`, `meetingSetter: true`.

- [ ] **Step 2: #9 on the agent's project rules**

`src/shared/domains/permissions/rules/agent.ts`, replace:

```ts
    // Publishing puts a customer's job on the public site: the office decides.
    cannot('update', 'Project', ['isPublic'])
```

with:

```ts
    // Publishing puts a customer's job on the public site: the office decides. A project's customer is
    // set from its meeting when it is created, and a project has no owner to move.
    cannot('update', 'Project', ['isPublic', 'customerId', 'ownerId'])
```

- [ ] **Step 3: The setter at rule level (drop this step if the owner declines Decision 6)**

In both `rules/agent.ts` and `rules/dispatcher.ts`, replace:

```ts
    // Ownership moves with the participants, through `assign`.
    cannot('update', 'Meeting', ['ownerId'])
```

with:

```ts
    // Ownership moves with the participants, and who set a meeting with the office, both through `assign`.
    cannot('update', 'Meeting', ['ownerId', 'setBy'])
```

- [ ] **Step 4: Run the probe**

Expected:

```
── super-admin · Project and Meeting columns
every key true
── agent · Project and Meeting columns
{"projectTitle":true,"projectCustomer":false,"projectOwner":false,"projectPublic":false,"meetingSetter":false,"meetingOwner":false}
── dispatcher · Project and Meeting columns
{"projectTitle":false,"projectCustomer":false,"projectOwner":false,"projectPublic":false,"meetingSetter":false,"meetingOwner":false}
```

- [ ] **Step 5: No client sends the refused columns**

Run: `git grep -n "customerId\|ownerId" -- src/shared/modules/projects/core/schemas/index.ts src/features/project-management; echo grep=$?`
Expected: no `customerId`/`ownerId` key in `projectFormSchema` or the edit view's payload (`grep=1`, or only lines unrelated to the update payload).

- [ ] **Step 6: Gate, commit and push**

Run: `pnpm tsc > .superpowers/sdd/u4p2-t4-tsc.log 2>&1; echo tsc=$?; pnpm lint > .superpowers/sdd/u4p2-t4-lint.log 2>&1; echo lint=$?` → `tsc=0`, `lint=0`.

```bash
git add src/shared/domains/permissions/rules/agent.ts src/shared/domains/permissions/rules/dispatcher.ts
git commit -m "feat(permissions): a project's customer and owner, and a meeting's setter, are not a rep's to write"
git push
```

### Task 5: The phone, one rule on both sides

**Files:**
- Create: `src/shared/entities/customers/lib/phone-access.ts`
- Modify: `src/shared/entities/customers/lib/phone-gating-sql.ts` (`canSeeUngatedPhone` moves out; `hasSentProposalSql(readsProposals)`)
- Modify (imports and `hasSentProposalSql` calls):
  - `src/features/agent-dashboard/dal/server/get-action-queue.ts:12`
  - `src/trpc/routers/customers.router/business.router.ts:15,71`
  - `src/shared/entities/customers/dal/server/customer-search-sql.ts:9`
  - `src/shared/entities/customers/dal/server/queries.ts:27,51`
  - `src/shared/entities/customers/dal/server/pipeline-items.ts:30,45-56,62,103,157,218,426`
  - `src/shared/entities/customers/dal/server/get-customer-profile.ts:24,38`
  - `src/shared/entities/meetings/dal/server/queries.ts:26,115,232`
  - `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts:13` (the import only)
- Modify: `src/shared/modules/proposals/core/dal/server/queries.ts` (`getFullView`)
- Modify: `src/trpc/routers/proposals.router/business.router.ts` (`getFullView` procedure)
- Modify: `src/shared/entities/customers/components/profile/customer-hero-header.tsx`
- Delete: `src/shared/entities/customers/lib/can-see-phone.ts`
- Modify: `src/shared/entities/customers/DOCS.md:33` (reference impl line)
- Probe: append

**Interfaces:**
- Produces:
  - `canSeeUngatedPhone(ability: AppAbility): boolean` from `@/shared/entities/customers/lib/phone-access`
  - `hasSentProposalSql(readsProposals: boolean): SQL<boolean>`
  - `getFullView(ctx, input, options?: { gatePhone?: boolean })`
  - `PipelineBranchArgs.readsProposals: boolean`

- [ ] **Step 1: Extend the probe**

Append (and add `import { canSeeUngatedPhone } from '@/shared/entities/customers/lib/phone-access'` to the imports):

```ts
for (const role of ROLES) {
  const ab = ctxFor(role).actor.ability
  console.log(`\n── ${role} · Phone`, JSON.stringify({ ungated: canSeeUngatedPhone(ab), readsProposals: ab.can('read', 'Proposal') }))
}
```

Run `pnpm tsc -p .superpowers/tsconfig.probe.json --noEmit 2>&1 | grep unit4-part2 | head -3`. Expected: the `phone-access` import fails (the module does not exist yet).

- [ ] **Step 2: One phone predicate, client-safe**

`src/shared/entities/customers/lib/phone-access.ts`:

```ts
import type { AppAbility } from '@/shared/domains/permissions/types'

/**
 * Who sees a customer's phone before any proposal goes out: omni callers (super-admin, and the system,
 * which holds `manage all`) and the leads-pool workers (dispatchers, who dial leads). The SQL gate and
 * the profile's unlock notice both ask this, so they cannot disagree.
 */
export function canSeeUngatedPhone(ability: AppAbility): boolean {
  return ability.can('manage', 'all') || ability.can('read', 'LeadsPool')
}
```

`src/shared/entities/customers/lib/phone-gating-sql.ts`:
- Delete `canSeeUngatedPhone`, its doc comment, and the `AppAbility` type import.
- In the file's doc comment, replace `(see \`canSeeUngatedPhone\`)` with `(see \`canSeeUngatedPhone\` in \`phone-access.ts\`)`, and `` `hasSentProposalSql()` `` with `` `hasSentProposalSql(ability.can('read', 'Proposal'))` ``.
- `hasSentProposalSql` becomes:

```ts
// Whether a proposal went out is proposal state: a caller who reads no proposals is told none did.
export function hasSentProposalSql(readsProposals: boolean) {
  return readsProposals ? sql<boolean>`${EXISTS_SENT_PROPOSAL}` : sql<boolean>`false`
}
```

- [ ] **Step 3: Move the eight importers**

In each file below, the single import line `import { canSeeUngatedPhone, gatedPhoneSql[, hasSentProposalSql] } from '@/shared/entities/customers/lib/phone-gating-sql'` becomes two lines:

```ts
import { canSeeUngatedPhone } from '@/shared/entities/customers/lib/phone-access'
import { gatedPhoneSql[, hasSentProposalSql] } from '@/shared/entities/customers/lib/phone-gating-sql'
```

(Keep `hasSentProposalSql` only where it was imported.) Files:
- `get-action-queue.ts`
- `customers.router/business.router.ts`
- `customer-search-sql.ts`
- `customers/dal/server/queries.ts`
- `pipeline-items.ts`
- `get-customer-profile.ts`
- `meetings/dal/server/queries.ts`
- `voip-campaign-contacts/dal/server/queries.ts`

Use the Edit tool (some files may be CRLF), then `pnpm eslint --fix <the eight files>` for import order.

- [ ] **Step 4: The flag asks whether the caller reads proposals**

- `customers.router/business.router.ts:71`: `hasSentProposal: hasSentProposalSql(ctx.actor.ability.can('read', 'Proposal')),`
- `customers/dal/server/queries.ts:51` (in `customerSelectWithGate`): `hasSentProposal: hasSentProposalSql(ctx.actor.ability.can('read', 'Proposal')),`
- `get-customer-profile.ts:38`: `hasSentProposal: hasSentProposalSql(ctx.actor.ability.can('read', 'Proposal')),`
- `meetings/dal/server/queries.ts:115`: `customerHasSentProposal: hasSentProposalSql(ctx.actor.ability.can('read', 'Proposal')),`
- `meetings/dal/server/queries.ts:232`: `hasSentProposal: hasSentProposalSql(ctx.actor.ability.can('read', 'Proposal')),`
- `pipeline-items.ts`:
  - Add `readsProposals: boolean` to `PipelineBranchArgs`.
  - In `getCustomerPipelineItems`, after `canSeeUngated: canSeeUngatedPhone(ctx.actor.ability),`, add `readsProposals: ctx.actor.ability.can('read', 'Proposal'),`.
  - Lines 103, 157, 218 and 426 become `hasSentProposalSql(args.readsProposals)`.

Run: `git grep -n "hasSentProposalSql()" -- src; echo grep=$?` → no lines, `grep=1`.

- [ ] **Step 5: `getFullView` gates the phone when asked**

`src/shared/modules/proposals/core/dal/server/queries.ts`. Imports:

```ts
import { canSeeUngatedPhone } from '@/shared/entities/customers/lib/phone-access'
import { gatedPhoneSql } from '@/shared/entities/customers/lib/phone-gating-sql'
```

The signature becomes:

```ts
export async function getFullView(
  ctx: ScopedContext,
  input: { id: string },
  options: { gatePhone?: boolean } = {},
): Promise<DalReturn<ProposalWithCustomer | undefined>> {
```

and in the select's `customer` object, `phone: customers.phone,` becomes:

```ts
          // A rep sees the phone once a proposal goes out. The contract, the PDFs and the homeowner's own view need it whole.
          phone: gatedPhoneSql(!options.gatePhone || canSeeUngatedPhone(ctx.actor.ability)),
```

(`gatedPhoneSql(true)` is the raw column; the gated form correlates on `"customers"."id"`, which this query joins unaliased.)

- [ ] **Step 6: The proposal page asks for the gate**

`src/trpc/routers/proposals.router/business.router.ts`, the `getFullView` procedure body becomes:

```ts
    .query(async ({ ctx, input }) => {
      // A signed-in reader is staff; a share link's holder is the homeowner, and the phone is their own.
      const view = dalToTrpc(await getFullView(ctx, input, { gatePhone: ctx.actor.userId !== null }))
      return view ? toHomeownerProposalView(ctx.actor.ability, view) : null
    }),
```

- [ ] **Step 7: Only the page gates**

Run: `git grep -n "getFullView(" -- src | grep -v "export async function"`
Expected: only `proposals.router/business.router.ts` passes `{ gatePhone: … }`. Contracts (`contracts.service.ts`, `contracts.router.ts`), PDFs (`pdf.service.ts`, the `pdf`/`summary` routes), `delivery.router.ts` and `views/service.ts` call it with two arguments.

- [ ] **Step 8: The profile header asks the same question**

`src/shared/entities/customers/components/profile/customer-hero-header.tsx`:
- Replace `import { canAgentSeePhone } from '@/shared/entities/customers/lib/can-see-phone'` with `import { canSeeUngatedPhone } from '@/shared/entities/customers/lib/phone-access'`.
- Replace `const phoneUnlocked = canAgentSeePhone(ability, customer)` with:

```tsx
  // A null phone is locked only when the gate applied and no proposal has gone out; otherwise it is empty.
  const phoneUnlocked = canSeeUngatedPhone(ability) || customer.hasSentProposal === true
```

Then `git rm src/shared/entities/customers/lib/can-see-phone.ts`.

`src/shared/entities/customers/DOCS.md:33` becomes:

```md
**Reference impl**: `lib/phone-access.ts` (`canSeeUngatedPhone`, read by the SQL gate and the profile header); `lib/phone-gating-sql.ts` (`gatedPhoneSql`, `hasSentProposalSql`)
```

- [ ] **Step 9: Run the probe**

Expected:

```
── super-admin · Phone {"ungated":true,"readsProposals":true}
── agent · Phone {"ungated":false,"readsProposals":true}
── dispatcher · Phone {"ungated":true,"readsProposals":false}
```

- [ ] **Step 10: Gate**

Run: `pnpm tsc > .superpowers/sdd/u4p2-t5-tsc.log 2>&1; echo tsc=$?; pnpm lint > .superpowers/sdd/u4p2-t5-lint.log 2>&1; echo lint=$?` → `tsc=0`, `lint=0`.

- [ ] **Step 11: Commit and push**

```bash
git add src/shared/entities/customers/lib/phone-access.ts src/shared/entities/customers/lib/phone-gating-sql.ts src/features/agent-dashboard/dal/server/get-action-queue.ts src/trpc/routers/customers.router/business.router.ts src/shared/entities/customers/dal/server/customer-search-sql.ts src/shared/entities/customers/dal/server/queries.ts src/shared/entities/customers/dal/server/pipeline-items.ts src/shared/entities/customers/dal/server/get-customer-profile.ts src/shared/entities/meetings/dal/server/queries.ts src/shared/entities/voip-campaign-contacts/dal/server/queries.ts src/shared/modules/proposals/core/dal/server/queries.ts src/trpc/routers/proposals.router/business.router.ts src/shared/entities/customers/components/profile/customer-hero-header.tsx src/shared/entities/customers/lib/can-see-phone.ts src/shared/entities/customers/DOCS.md
git commit -m "feat(permissions): a rep's proposal page gates the phone; only proposal readers learn that one went out; one phone rule on both sides"
git push
```

### Task 6: The pipelines a role opens are in its rules

**Files:**
- Modify: `src/shared/domains/permissions/types.ts` (`SubjectFieldsWithoutSpec`; `Permission`)
- Modify: `src/shared/domains/permissions/rules/define-rules.ts` (`AddRule`)
- Modify: `src/shared/domains/permissions/rules/agent.ts`, `rules/dispatcher.ts`
- Modify: `src/shared/domains/pipelines/lib/get-accessible-pipelines.ts` (whole file)
- Modify: `src/shared/domains/permissions/type-checks/must-not-compile.ts`
- Probe: append

**Interfaces:**
- Produces:
  - `SubjectFieldsWithoutSpec { CustomerPipeline: Pipeline }`
  - `can('read', 'CustomerPipeline', [...pipelines])`
  - `ability.can('read', 'CustomerPipeline', pipeline)`
  - `getAccessiblePipelines(ability): Pipeline[]` (same signature)

- [ ] **Step 1: Extend the probe**

Append (and add `import { getAccessiblePipelines } from '@/shared/domains/pipelines/lib/get-accessible-pipelines'`):

```ts
for (const role of ROLES) {
  console.log(`\n── ${role} · Pipelines`, JSON.stringify(getAccessiblePipelines(ctxFor(role).actor.ability)))
}
```

Run it now and record the output: it is the baseline the rule must reproduce (`["projects","fresh","leads","rehash","dead"]`, `["projects","fresh"]`, `["fresh","leads","rehash","dead"]`).

- [ ] **Step 2: Field lists on a subject without a spec**

`src/shared/domains/permissions/types.ts`. Add the type import:

```ts
import type { Pipeline } from '@/shared/constants/enums/pipelines'
```

After `SubjectsWithoutSpec`, add:

```ts
/** Subjects without a spec whose rules name fields: each field is one thing the subject opens. */
export interface SubjectFieldsWithoutSpec {
  /** The pipeline boards a role opens. */
  CustomerPipeline: Pipeline
}
```

`Permission` becomes:

```ts
export type Permission = {
  [S in AppSubject]: S extends EntitySubject
    ? [action: ActionOn<S> | 'manage', subject: S, field?: FieldOf<S>]
    : S extends keyof SubjectFieldsWithoutSpec
      ? [action: ActionOn<S> | 'manage', subject: S, field?: SubjectFieldsWithoutSpec[S]]
      : [action: ActionOn<S> | 'manage', subject: S]
}[AppSubject]
```

`src/shared/domains/permissions/rules/define-rules.ts`:
- Add `SubjectFieldsWithoutSpec` to the type import from `@/shared/domains/permissions/types`.
- In `AddRule`, before the last overload (`<S extends keyof SubjectsWithoutSpec>…`), add:

```ts
  <S extends keyof SubjectFieldsWithoutSpec>(action: SubjectsWithoutSpec[S] | readonly SubjectsWithoutSpec[S][], subject: S, fields: readonly [SubjectFieldsWithoutSpec[S], ...SubjectFieldsWithoutSpec[S][]]): RuleHandle
```

- [ ] **Step 3: The rules name the boards**

`rules/agent.ts`, replace:

```ts
    // Read only: leads, rehash and dead pipelines are super-admin-managed.
    can('read', 'CustomerPipeline')
```

with:

```ts
    // The boards a rep works; leads, rehash and dead are the office's.
    can('read', 'CustomerPipeline', ['projects', 'fresh'])
```

`rules/dispatcher.ts`, replace:

```ts
    can('read', 'LeadsPool') // the shared leads pool drives phone and pipeline access
```

with:

```ts
    can('read', 'LeadsPool') // the shared leads pool ungates the phone
    // The lead boards. The projects board carries project and proposal values.
    can('read', 'CustomerPipeline', ['leads', 'rehash', 'dead', 'fresh'])
```

- [ ] **Step 4: The helper reads the rule**

`src/shared/domains/pipelines/lib/get-accessible-pipelines.ts` becomes:

```ts
import type { Pipeline } from '@/shared/constants/enums/pipelines'
import type { AppAbility } from '@/shared/domains/permissions/types'

import { pipelines } from '@/shared/constants/enums/pipelines'

/** The pipelines the rules open to this ability, in the canonical order. The server refuses any other. */
export function getAccessiblePipelines(ability: AppAbility): Pipeline[] {
  return pipelines.filter(pipeline => ability.can('read', 'CustomerPipeline', pipeline))
}
```

- [ ] **Step 5: The wrong-on-purpose file**

In `rulesThatMustCompile`: `can('read', 'CustomerPipeline', ['projects', 'fresh'])`.

In the expected-errors `defineRules` block, after the `User` field line:

```ts
  // @ts-expect-error not a pipeline
  can('read', 'CustomerPipeline', ['nope'])
```

In `checksThatMustCompile`: `ability.can('read', 'CustomerPipeline', 'fresh')`.

After the `ability.can('read', 'User', 'name')` expected error:

```ts
// @ts-expect-error not a pipeline
ability.can('read', 'CustomerPipeline', 'nope')
```

- [ ] **Step 6: Run the probe**

Expected: the three pipeline lines equal Step 1's baseline exactly.

- [ ] **Step 7: Gate, commit and push**

Run: `pnpm tsc > .superpowers/sdd/u4p2-t6-tsc.log 2>&1; echo tsc=$?; pnpm lint > .superpowers/sdd/u4p2-t6-lint.log 2>&1; echo lint=$?` → `tsc=0`, `lint=0`.

```bash
git add src/shared/domains/permissions/types.ts src/shared/domains/permissions/rules/define-rules.ts src/shared/domains/permissions/rules/agent.ts src/shared/domains/permissions/rules/dispatcher.ts src/shared/domains/pipelines/lib/get-accessible-pipelines.ts src/shared/domains/permissions/type-checks/must-not-compile.ts
git commit -m "feat(permissions): the pipelines a role opens are named in its rules"
git push
```

### Task 7: Note actions read the author rule

**Files:**
- Modify: `src/shared/entities/customer-notes/hooks/use-customer-note-action-configs.ts`
- Modify: `src/shared/entities/customers/DOCS.md:219,224-225`

**Interfaces:**
- Produces: `canManage(note)` keeps its signature and answers `ability.can('update', subject('CustomerNote', note))`.

- [ ] **Step 1: The gate is the rule**

In the hook:
- Remove the `useSession` import and add `import { subject } from '@/shared/domains/permissions/subject'`.
- Delete `const { data: session } = useSession()`, `const currentUserId = …` and `const isAdmin = …`.
- `canManage` becomes:

```ts
  const canManage = (note: CustomerNoteWithAuthor) => ability.can('update', subject('CustomerNote', note))
```

- The `canManage` doc comment in `Result` becomes:

```ts
  /**
   * The author rule, tested on the note: the render site mounts the actions menu only on notes the
   * reader may change, rather than filtering inside the memoized `actions` array below.
   */
```

- [ ] **Step 2: The DOCS lines**

`src/shared/entities/customers/DOCS.md`:
- Line 219: the sentence "Mirrored **client-side** by `canManage` … would 403." becomes: "The client asks the same rule on the note (`ability.can('update', subject('CustomerNote', note))` in `useCustomerNoteActionConfigs`) to decide whether the timeline row mounts the edit/delete menu."
- Line 225 (`**Enforced by**`) becomes: `**Enforced by**: compiled rules in \`createCrudDal\` (server); the same rule tested on the note (client, UX only)`.

- [ ] **Step 3: Gate, commit and push**

Run: `pnpm tsc > .superpowers/sdd/u4p2-t7-tsc.log 2>&1; echo tsc=$?; pnpm lint > .superpowers/sdd/u4p2-t7-lint.log 2>&1; echo lint=$?` → `tsc=0`, `lint=0`.

```bash
git add src/shared/entities/customer-notes/hooks/use-customer-note-action-configs.ts src/shared/entities/customers/DOCS.md
git commit -m "refactor(notes): the note menu asks the author rule instead of copying it"
git push
```

### Task 8: The public intake checks its link (D-36)

**Files:**
- Modify: `src/shared/entities/lead-sources/dal/server/queries.ts` (`getActiveLeadSourceByLink`)
- Create: `src/trpc/lib/assert-intake-link.ts`
- Modify: `src/trpc/routers/customers.router/business.router.ts` (`createFromIntake`)
- Modify: `src/trpc/routers/intake.router.ts` (`getRecordingUploadUrl`)
- Modify: `src/app/(frontend)/intake/page.tsx`
- Modify: `src/features/intake/ui/views/intake-form-view.tsx`
- Modify: `src/features/intake/ui/components/mp3-upload-field.tsx`
- Modify: `src/shared/entities/lead-sources/DOCS.md:32`
- Probe: append

**Interfaces:**
- Produces:
  - `getActiveLeadSourceByLink(slug: string, token: string): Promise<DalReturn<LeadSourceRecord | null>>`
  - `assertIntakeLink(ability: AppAbility, link: { leadSourceSlug?: string, token?: string }): Promise<void>`
  - `IntakeFormView` and `Mp3UploadField` gain an optional `token` prop; `Mp3UploadField` gains `leadSourceSlug`.
  - Both procedures accept an optional `token`; `getRecordingUploadUrl` also accepts `leadSourceSlug`.

- [ ] **Step 1: The query**

Append to `src/shared/entities/lead-sources/dal/server/queries.ts` (add `and` to the `drizzle-orm` import):

```ts
/** The active source an intake link names, or null: an unknown slug, a wrong token and an archived source look the same. */
export async function getActiveLeadSourceByLink(slug: string, token: string): Promise<DalReturn<LeadSourceRecord | null>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select()
      .from(leadSourcesTable)
      .where(and(eq(leadSourcesTable.slug, slug), eq(leadSourcesTable.token, token), eq(leadSourcesTable.isActive, true)))
      .limit(1)
    return (row ?? null) as LeadSourceRecord | null
  })
}
```

- [ ] **Step 2: The check**

`src/trpc/lib/assert-intake-link.ts`:

```ts
import type { AppAbility } from '@/shared/domains/permissions/types'

import { TRPCError } from '@trpc/server'

import { getActiveLeadSourceByLink } from '@/shared/entities/lead-sources/dal/server/queries'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'

const INVALID_LINK = 'This intake link is no longer valid. Ask for a new one.'

/**
 * A lead source's link is its credential, so the write checks it, not only the page that shows the form.
 * The office files leads from the dashboard without a link; only the office files one under `manual`.
 */
export async function assertIntakeLink(ability: AppAbility, link: { leadSourceSlug?: string, token?: string }): Promise<void> {
  if (ability.can('manage', 'all')) {
    return
  }
  const { leadSourceSlug, token } = link
  if (!leadSourceSlug || !token || leadSourceSlug === 'manual') {
    throw new TRPCError({ code: 'NOT_FOUND', message: INVALID_LINK })
  }
  if (!dalToTrpc(await getActiveLeadSourceByLink(leadSourceSlug, token))) {
    throw new TRPCError({ code: 'NOT_FOUND', message: INVALID_LINK })
  }
}
```

- [ ] **Step 3: `createFromIntake` checks it**

`src/trpc/routers/customers.router/business.router.ts`:
- Add `import { assertIntakeLink } from '@/trpc/lib/assert-intake-link'`.
- In the input object, after `leadSourceSlug: z.string().optional(),`, add `token: z.string().optional(),`.
- Replace `const { notes, mode, leadSourceSlug, ...customerData } = input` with `const { notes, mode, leadSourceSlug, token, ...customerData } = input`.
- After the rate-limit `if (!success) { … }` block, add:

```ts
      await assertIntakeLink(ctx.actor.ability, { leadSourceSlug, token })
```

- [ ] **Step 4: `getRecordingUploadUrl` checks it**

`src/trpc/routers/intake.router.ts`:
- Add `import { assertIntakeLink } from '../lib/assert-intake-link'`.
- Add `leadSourceSlug: z.string().optional(), token: z.string().optional(),` to the input object.
- After the rate-limit `if (!success) { … }` block, add:

```ts
      await assertIntakeLink(ctx.actor.ability, input)
```

- [ ] **Step 5: The page reads through the same query and hands the token on**

`src/app/(frontend)/intake/page.tsx`:
- Remove the `eq`, `db` and `leadSourcesTable` imports; add `import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'` and `import { getActiveLeadSourceByLink } from '@/shared/entities/lead-sources/dal/server/queries'`.
- Replace the block from `// Fetch lead source by slug, then verify token matches.` through the closing `}` of `if (!row || !row.isActive || row.token !== token) { notFound() }` with:

```tsx
  // One answer for an unknown slug, a wrong token and an archived source, so a guess learns nothing.
  const row = dalVerifySuccess(await getActiveLeadSourceByLink(source, token))
  if (!row) {
    notFound()
  }
```

- Add `token={token}` to `<IntakeFormView … />`.

- [ ] **Step 6: The form sends it**

`src/features/intake/ui/views/intake-form-view.tsx`:
- In `IntakeFormViewProps`, after `leadSourceSlug?: string`, add `token?: string`.
- Destructure it: `export function IntakeFormView({ mode, formConfig, leadSourceSlug, token }: IntakeFormViewProps)`.
- In `submit.mutate({ … })`, after `leadSourceSlug,`, add `token,`.
- On `<Mp3UploadField`, add `leadSourceSlug={leadSourceSlug}` and `token={token}`.

`src/features/intake/ui/components/mp3-upload-field.tsx`:
- Add `leadSourceSlug?: string` and `token?: string` to `Mp3UploadFieldProps`.
- Destructure both.
- The mutate call becomes `getUploadUrl.mutateAsync({ contentType: 'audio/mpeg', customerName, leadSourceSlug, token })`.

The Add customer sheet (`lead-sources-admin/ui/components/add-customer-sheet.tsx`) passes no token and stays unchanged: it is super-admin only.

- [ ] **Step 7: The DOCS line**

`src/shared/entities/lead-sources/DOCS.md:32` becomes:

```md
**Enforced by**: DB unique constraint on `slug` + `token`; the `/intake` page and both intake procedures (`createFromIntake`, `getRecordingUploadUrl`) check the pair through `getActiveLeadSourceByLink` (`assertIntakeLink` for the procedures; super-admins are exempt)
```

- [ ] **Step 8: Probe the check without the database**

Add `import { assertIntakeLink } from '@/trpc/lib/assert-intake-link'` to the probe's imports, then append the following. The super-admin answers before any query, and every refusal below returns before the query:

```ts
const outcome = (p: Promise<void>) => p.then(() => 'pass', (e: { code?: string }) => e.code ?? 'error')
;(async () => {
  console.log('\n── intake link', JSON.stringify({
    superAdminNoLink: await outcome(assertIntakeLink(ctxFor('super-admin').actor.ability, {})),
    publicNoLink: await outcome(assertIntakeLink(defineAbilitiesFor(null), {})),
    publicManual: await outcome(assertIntakeLink(defineAbilitiesFor(null), { leadSourceSlug: 'manual', token: 'x' })),
    agentNoToken: await outcome(assertIntakeLink(ctxFor('agent').actor.ability, { leadSourceSlug: 'any' })),
  }))
})()
```

Expected: `{"superAdminNoLink":"pass","publicNoLink":"NOT_FOUND","publicManual":"NOT_FOUND","agentNoToken":"NOT_FOUND"}`. No query runs: every refusal returns before `getActiveLeadSourceByLink`.

- [ ] **Step 9: Gate, commit and push**

Run: `pnpm tsc > .superpowers/sdd/u4p2-t8-tsc.log 2>&1; echo tsc=$?; pnpm lint > .superpowers/sdd/u4p2-t8-lint.log 2>&1; echo lint=$?` → `tsc=0`, `lint=0`.

```bash
git add src/shared/entities/lead-sources/dal/server/queries.ts src/trpc/lib/assert-intake-link.ts src/trpc/routers/customers.router/business.router.ts src/trpc/routers/intake.router.ts "src/app/(frontend)/intake/page.tsx" src/features/intake/ui/views/intake-form-view.tsx src/features/intake/ui/components/mp3-upload-field.tsx src/shared/entities/lead-sources/DOCS.md
git commit -m "fix(intake): the intake procedures check the lead source's link themselves, not only the page"
git push
```

### Task 9: Dead code and part 1's minors

**Files:**
- Modify: `src/shared/entities/customers/dal/server/queries.ts` (delete `findOrCreateCustomerFromHomeowner`, `HomeownerData` and the TODO above them)
- Modify: `src/shared/dal/server/lib/create-crud-dal.ts` (`deleteImpl`)
- Modify: `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts` (the decline select)

- [ ] **Step 1: Delete the dead raw insert**

Remove from `// TODO: migrate to customerCrud.create — writes \`customers\` directly…` through the end of `findOrCreateCustomerFromHomeowner`. Then run `pnpm eslint --fix src/shared/entities/customers/dal/server/queries.ts` and remove any import it reports unused.

Run: `git grep -n "findOrCreateCustomerFromHomeowner\|HomeownerData" -- src scripts; echo grep=$?` → `grep=1`.

- [ ] **Step 2: `deleteImpl` builds its WHERE once**

In `deleteImpl`, replace:

```ts
    let row: Row<TTable> | undefined
    if (needsRow) {
      // The delete reach, not the read reach: the hooks purge stored files and calendar events, so a
      // row the caller may read but not delete must stop before them.
      const [found] = await exec
        .select()
        .from(spec.table as PgTable)
        .where(and(eq(pkColumn, input.id), scoping.write(ctx, 'delete')))
        .limit(1)
```

with:

```ts
    // The delete reach, not the read reach: the hooks purge stored files and calendar events, so a
    // row the caller may read but not delete must stop before them.
    const where = and(eq(pkColumn, input.id), scoping.write(ctx, 'delete'))
    let row: Row<TTable> | undefined
    if (needsRow) {
      const [found] = await exec
        .select()
        .from(spec.table as PgTable)
        .where(where)
        .limit(1)
```

and delete the later line `    const where = and(eq(pkColumn, input.id), scoping.write(ctx, 'delete'))`.

- [ ] **Step 3: The decline drag selects what it may write**

`move-customer-pipeline-item.ts`, in the `proposal_sent → declined` branch, replace `permit(ctx, 'update', proposalServerSpec).sql` with `permit(ctx, 'update', proposalServerSpec, ['status']).sql`.

- [ ] **Step 4: Gate, commit and push**

Run: `pnpm tsc > .superpowers/sdd/u4p2-t9-tsc.log 2>&1; echo tsc=$?; pnpm lint > .superpowers/sdd/u4p2-t9-lint.log 2>&1; echo lint=$?` → `tsc=0`, `lint=0`.

```bash
git add src/shared/entities/customers/dal/server/queries.ts src/shared/dal/server/lib/create-crud-dal.ts src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts
git commit -m "chore(permissions): delete an unused raw customer insert; the delete slot builds its reach once; the decline drag selects what it may write"
git push
```

### Task 10: Whole-part review, the owner's hand checks, and the record

**Files:**
- Modify: `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (§0 status, §0.3 Q8, §4 Unit 4 record, §5.1 S9, §5.3 Ledger 2, §5.4, Appendix A)
- Modify: `docs/plans/2026-09-07-casl-re-grounding/DISTILLED-2026-10-01.md` (§1 status, §7 next steps)
- Modify: memory `project-permissions-casl-compiler.md` and its `MEMORY.md` line
- Delete (own commit): this plan

- [ ] **Step 1: One fresh whole-part review**, on the most capable model, of `git diff ed66e6d05..HEAD -- src` against this plan and the Review Focus. Fix confirmed defects as their own commits.

- [ ] **Step 2: The owner's hand checks** (dev server on port 3003; the owner chooses the records and makes any data change):
  - **H1 (agent):** on the schedule, create an activity with no link, and one linked to a customer you can see. Both show. Complete one, delete the other. A scheduled one still reaches your calendar.
  - **H2 (agent):** an activity linked to a meeting you sit in. After the owner removes you from that meeting, it is gone from your schedule.
  - **H3 (dispatcher):** on the schedule, create, complete and delete your own activity.
  - **H4 (agent):**
    - On a draft proposal on your meeting, Delete shows and works.
    - On a sent proposal, there is no Delete.
    - A proposal card in the pipeline or records panes shows no Delete.
  - **H5 (agent):**
    - On the proposal page for a customer with no sent proposal, there is no phone.
    - After a proposal for that customer is sent, the phone shows.
  - **H6 (agent):** create a contract draft on a draft proposal. The envelope in Zoho carries the customer's phone.
  - **H7:** the pipeline tabs. Agent: Projects and Fresh. Dispatcher: Fresh, Leads, Rehash and Dead. Super-admin: all five. A dispatcher's customer profile shows the phone with no unlock notice.
  - **H8:** notes. An agent sees edit and delete only on their own notes; a super-admin on every note.
  - **H9:** the intake.
    - **Public link:** a customer-only submit and a customer-plus-meeting submit with a recording upload both save.
    - **Tampered link:** the same form with one character of the token changed answers "This intake link is no longer valid."
    - **Super-admin's Add customer sheet:** files a lead with a source and with none (manual).
  - **H10 (super-admin):** delete any proposal; see every rep's activities.

- [ ] **Step 3: Record**
  - **Tracker §4 Unit 4:** a "Part 2" record (commits, probe output summary, hand checks, consequences named, what remains).
    - Fix the stale part 1 record: it says "the proposal delete purges R2 objects"; the proposal crud has no delete hook (`modules/proposals/core/dal/server/crud.ts`, its own comment).
    - Write what remains: #8, blocked on main; the merge of `origin/main` at the unit boundary.
  - **§0** status.
  - **§0.3 Q8:** the rows built.
  - **§5.1 S9:** closed.
  - **§5.3:** the Activity, intake and note rows closed.
  - **§5.4:** the hand-written copies row closed (`get-accessible-pipelines.ts` stays as the rule's reader).
  - **Appendix A:** one line.
  - **DISTILLED:** the §1 status line and §7 next steps.
  - **Memory:** `project-permissions-casl-compiler.md` and its `MEMORY.md` line.

```bash
git add docs/plans/2026-08-10-casl-scope-compiler-epic.md docs/plans/2026-09-07-casl-re-grounding/DISTILLED-2026-10-01.md
git commit -m "docs(permissions): record unit 4 part 2"
git push
```

- [ ] **Step 4: Delete this plan in its own commit**

```bash
git rm docs/superpowers/plans/2026-10-15-permissions-unit-4-part-2-own-rows-and-client-copies.md
git commit -m "docs(permissions): delete the unit 4 part 2 plan now that it ships"
git push
```
