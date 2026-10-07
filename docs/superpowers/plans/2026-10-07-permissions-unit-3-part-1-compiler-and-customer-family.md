# Permissions unit 3, part 1: the compiler and the Customer family — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CASL rules compile to Drizzle `where()` filters through one entry point, `permit`; every CRUD slot of a converted entity scopes itself from the actor's ability; the Customer family (Customer, its profile and lead-attribution parts, customer notes) is the first family on compiled rules.

**Architecture:** `permit(ctx, action, spec, fields?)` walks `ability.rulesFor(action, subject, field)` with CASL's own `rulesToQuery` fold and interprets each rule's AST into SQL on the spec's table; operators (`$participatesViaMeeting`, `$inDerivedPipeline`) are registered server-side with their SQL bodies. `createCrudDal` applies `permit` in every slot for specs whose subject is in the compiled set, and keeps the legacy `ctx.scope` for the others until their family converts. The Customer family's rules gain their conditions, its specs drop `visibility`, the profile and the lead attribution become sub-entities (fields `profile` and `leadAttribution` of `Customer`), and its hand-rolled filters and imperative gates are deleted. `systemContext(reason)` replaces `SYSTEM_CONTEXT` at the family's unscoped sites.

**Tech Stack:** TypeScript 5, Next.js 15.5, tRPC v11, Drizzle (Postgres/Neon), `@casl/ability` 6.8.0 (stays), `@casl/react` 7.0.1 (untouched), Zod 4.

**Spec:** `docs/superpowers/specs/2026-10-05-permissions-structure-design.md` (§3 layers, §4 specs, §5 rules, §6 compiler and DAL, §7 actor, §9 where mistakes are caught, §10 verification, §11 order of work). Decisions D-28 to D-30 in `docs/plans/2026-08-10-casl-scope-compiler-epic.md` §2.1 rule the names, the field lists and `subject`.

**Not in this plan (and why):** the Meeting, Proposal, Project families and the rest (one plan each, after the owner's browser check of this one); `bearerContext` and the token branch of `shareableMiddleware` (Proposal family); the outcome-derived pipeline restore from `db87d28d` (needs the owner's Q11 ruling: it moves `not_good` and `ftd` from rehash to dead in production); `createCrudRouter` becoming pure wiring, the deletion of `SYSTEM_CONTEXT`, `ctx.scope`, `scope.ts` and the per-entity procedures of the other families (they go with the last family and unit 6); the dispatcher's four-bucket reach (`leads`, `rehash`, `dead`, `fresh`, owner ruling of 2026-09-04) — this plan keeps the dispatcher at today's reach (`leads`) so the conversion is checked as behaviour-preserving; the widening is a named permission change of unit 4.

## Global Constraints

- Verification is `pnpm tsc` and `pnpm lint` after every task. Never `pnpm build`. No test runner and no unit tests in the permissions library; the only test file is `src/shared/domains/permissions/type-checks/must-not-compile.ts`.
- No writes to any database for testing, the shared development database included. The worktree runs on the shared dev database (`.env.local` holds only `PORT=3003`).
- `@casl/ability` stays at 6.8.0; `@casl/react` stays at 7.0.1 and is imported only in `src/shared/domains/permissions/client.tsx`. No new dependencies.
- No backwards compatibility: a task removes what it replaces in the same change. No alias, re-export, wrapper, unused parameter, `any` fallback or dual shape kept for old call sites.
- Comments say why, never what. No file banners. Never cite plans, specs, tasks, issues or docs from code.
- Names used by this plan, agreed with it: `AnyServerSpec` (the erased union of the two spec shapes), `ServerSpec` (the union of the listed specs), `permit`, `Permit`, `SubjectOf`, `systemContext`, `SystemReason`, `systemRules`, `COMPILED_SUBJECTS`, `isCompiled`, `OperatorContext`, `Operator`, `defineOperator`, `getOperator`, `interpret`, `whereFor`, `reachFor`, `assertGranted`, `rootRowFor`, `projectToReadFields`, `SERVER_SPECS`, `assertRules`, `assertRulesCompile`, `FieldAction`, `customerProfileServerSpec`, `customerLeadAttributionServerSpec`, the fields `profile` and `leadAttribution`. No other new names.
- Named exports only. One React component per file (no component is touched here).
- Some files are CRLF (`src/trpc/routers/app.ts` is one; none in this plan). Edit with the Edit tool or `sed -i`; check `git diff --shortstat` before committing.
- Commit per task, by explicit path (`git add <files>`), conventional commits, message ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Never `git stash`, `git reset` or `git checkout <file>` on this shared tree. Branch `refactor/285-refactor-permissions-casl-scope-compiler` in `.worktrees/issue-285`.
- `DEV_LOGIN_SECRET` is never written into a file under the repo or the scratchpad, never echoed, never put in a report.

## Review Focus

1. **A bare rule beside a conditioned one** (`can('read', 'Customer')` left next to the operator rule) makes every customer visible to that role. Pinned by the startup check in Task 4 (`assertRules`, check 2) and by the agent browser check in Task 6.
2. **An update slot that checks columns without the row** lets a non-author edit a note: the author condition can only be tested on the loaded row. Pinned by Task 3's `assertColumns` running on the row loaded through the read reach, and by the agent note check in Task 6.
3. **A sub-entity written through the parent's bare `update`** (no field in the check) would let a dispatcher write the discovery profile. Pinned by `upsertOneToOne` testing `profile` and each `profile.<column>` against the parent row (Task 3) and the dispatcher check in Task 6.
4. **The legacy switch**: a spec in `COMPILED_SUBJECTS` whose spec still declares `visibility`, or a converted spec left out of the set, runs on the wrong engine. Pinned by Task 5's startup assertion that no compiled spec declares `visibility`, and by the per-role browser checks.
5. **The dispatcher's leads pool** moves from `pipeline = 'active' AND no meeting` to the derived `leads` bucket, which also excludes a customer with a project but no meeting. The owner confirms in Task 6 that the leads kanban shows the same customers as before.

---

### Task 1: `ServerSpec` names the list; field lists sit on `read` and `update` only

**Files:**
- Modify: `src/shared/domains/permissions/specs.ts` (`ServerSpecs` → `ServerSpec`)
- Modify: `src/shared/dal/server/types.ts` (erased `ServerSpec` → `AnyServerSpec`; `DalError` forbidden names a field)
- Modify: `src/shared/dal/server/lib/define-spec.ts`, `src/shared/dal/server/lib/create-crud-dal.ts`, `src/shared/dal/server/lib/helpers.ts`, `src/shared/dal/server/lib/scope.ts`, `src/trpc/lib/middleware/scope-middleware.ts`, `src/trpc/lib/middleware/shareable-middleware.ts` (rename)
- Modify: `src/trpc/lib/create-crud-router.ts` (generic over the spec)
- Modify: `src/trpc/lib/dal-to-trpc.ts` (forbidden message names the field)
- Modify: `src/shared/domains/permissions/rules/define-rules.ts` (field overloads)
- Modify: `src/shared/domains/permissions/type-checks/must-not-compile.ts`

**Interfaces:**
- Produces: `ServerSpec` (list union) in `permissions/specs.ts`; `AnyServerSpec<TTable>` in `dal/server/types.ts`; `createCrudDal<TSpec extends ServerSpec>`; `createCrudRouter<TSpec extends ServerSpec, …>`; `DalError` member `{ type: 'forbidden', field?: string }`; `FieldAction = 'read' | 'update'`.

- [ ] **Step 1: Rename the list type**

In `src/shared/domains/permissions/specs.ts` replace `export type ServerSpecs` with `export type ServerSpec`, and every internal `ServerSpecs` with `ServerSpec` (the `SubEntitiesOf` helper uses it once). The doc comment stays: `/** Every spec. A spec missing here is invisible to rule typing. */`

- [ ] **Step 2: Rename the erased union and let `forbidden` name a field**

In `src/shared/dal/server/types.ts`:

```ts
/** Any spec over `TTable`: the two shapes the constructors build. Enforcement is typed against the list in `permissions/specs.ts`. */
export type AnyServerSpec<TTable extends PgTable = PgTable>
  = | EntitySpec<TTable, ServerSpecSchemas, EntityName, string, AnyServerSpec>
    | SubEntitySpec<TTable, ServerSpecSchemas, AnyServerSpec, string>
```

Replace every other `ServerSpec` in the file with `AnyServerSpec` (`EntitySpec`'s and `SubEntitySpec`'s `TParent extends …` bound, `SpecInsert`, `SpecUpdate`, `SpecId`, `SpecCrudHandlers`). Change the `DalError` member:

```ts
    | { type: 'forbidden', field?: string }
```

- [ ] **Step 3: Rename the users of the erased union**

In `define-spec.ts`, `create-crud-dal.ts`, `helpers.ts`, `scope.ts`, `scope-middleware.ts`, `shareable-middleware.ts`: import `AnyServerSpec` instead of `ServerSpec` from `@/shared/dal/server/types` (or `../types`) and replace each use. `subjectOf` keeps its erased parameter (`spec: AnyServerSpec`) and its cast: the legacy resolver walks erased parent chains and dies with `scope.ts` in unit 6; the typed path is `permit` (Task 3).

In `create-crud-dal.ts` the factory is bounded by the list, so a spec left out of it cannot be enforced:

```ts
import type { ServerSpec } from '@/shared/domains/permissions/specs'

// Only a listed spec can be enforced: the rules are typed against the list, and a spec outside it has no subject they can name.
export function createCrudDal<TSpec extends ServerSpec>(
```

The internal `getByIdImpl` … `getPkColumn` keep `AnyServerSpec<TTable>`.

- [ ] **Step 4: `createCrudRouter` generic over the spec**

In `src/trpc/lib/create-crud-router.ts`:

```ts
import type { PgTable } from 'drizzle-orm/pg-core'
import type { AnyServerSpec } from '@/shared/dal/server/types'

import type { ServerSpec } from '@/shared/domains/permissions/specs'
import type { AppAbility, AppAction } from '@/shared/domains/permissions/types'
import type { CrudHandlers, SlotName } from '@/trpc/types'
```

```ts
export interface CreateCrudRouterConfig<
  TSpec extends ServerSpec,
  TId extends string | number,
  TInsert extends z.ZodObject<z.ZodRawShape>,
  TUpdate extends z.ZodObject<z.ZodRawShape>,
> {
  spec: TSpec
  schemas: { id: z.ZodType<TId>, insert: TInsert, update: TUpdate }
  /** The entity's single hooked crud instance — the router never rebuilds handlers, so un-hooked ones cannot exist. */
  crud: CrudHandlers<TSpec['table'], TId, z.input<TInsert>, z.input<TUpdate>>
  /** Slot overrides BYPASS the crud's hooks entirely — the override replaces the whole DAL function. */
  handlers?: Partial<CrudHandlers<TSpec['table'], TId, z.input<TInsert>, z.input<TUpdate>>>
}

export function createCrudRouter<
  TSpec extends ServerSpec,
  TId extends string | number,
  TInsert extends z.ZodObject<z.ZodRawShape>,
  TUpdate extends z.ZodObject<z.ZodRawShape>,
>(config: CreateCrudRouterConfig<TSpec, TId, TInsert, TUpdate>) {
  type TTable = TSpec['table']
```

Keep the body as it is. `isGranted`, `assertCan` and `assertCanUpdateFields` take `spec: AnyServerSpec`. The five crud leaves (`customers.router/crud.router.ts`, `customer-notes.router/index.ts`, and the meetings, proposals and applications leaves) do not change; if `TSpec` fails to infer at a leaf, report BLOCKED with the tsc output.

- [ ] **Step 5: `dalToTrpc` names the column**

In `src/trpc/lib/dal-to-trpc.ts`:

```ts
    case 'forbidden':
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: result.error.field ? `You do not have permission to change ${result.error.field}` : undefined,
      })
```

- [ ] **Step 6: Narrow the field overloads**

In `src/shared/domains/permissions/rules/define-rules.ts`, add after `FieldList`:

```ts
/** The actions a field list may sit on: `update` checks columns against it, `read` projects the row to it. Nothing reads one on `create` or `delete`. */
type FieldAction = 'read' | 'update'
```

Replace the two interfaces:

```ts
export interface AddCannotRule {
  <S extends EntitySubject>(action: CrudAction | readonly CrudAction[], subject: S): RuleHandle
  <S extends EntitySubject, const C extends ColumnConditions<S>>(action: CrudAction | readonly CrudAction[], subject: S, conditions: Only<C, ColumnConditions<S>>): RuleHandle
  <S extends EntitySubject>(action: FieldAction | readonly FieldAction[], subject: S, fields: FieldList<S>): RuleHandle
  <S extends EntitySubject, const C extends ColumnConditions<S>>(action: FieldAction | readonly FieldAction[], subject: S, fields: FieldList<S>, conditions: Only<C, ColumnConditions<S>>): RuleHandle
}

export interface AddRule {
  <S extends EntitySubject>(action: CrudAction | readonly CrudAction[], subject: S): RuleHandle
  /** The only form that may carry an operator: `read`, no field list. Operators are SQL-only, so a client cannot test them on a row. */
  <S extends EntitySubject, const C extends ReadConditions<S>>(action: 'read', subject: S, conditions: Only<C, ReadConditions<S>>): RuleHandle
  <S extends EntitySubject, const C extends ColumnConditions<S>>(action: Exclude<CrudAction, 'read'> | readonly CrudAction[], subject: S, conditions: Only<C, ColumnConditions<S>>): RuleHandle
  <S extends EntitySubject>(action: FieldAction | readonly FieldAction[], subject: S, fields: FieldList<S>): RuleHandle
  <S extends EntitySubject, const C extends ColumnConditions<S>>(action: FieldAction | readonly FieldAction[], subject: S, fields: FieldList<S>, conditions: Only<C, ColumnConditions<S>>): RuleHandle
  <S extends keyof ExtraEntityActions>(action: ExtraEntityActions[S], subject: S): RuleHandle
  <S extends keyof SubjectsWithoutSpec>(action: SubjectsWithoutSpec[S] | readonly SubjectsWithoutSpec[S][], subject: S): RuleHandle
}
```

- [ ] **Step 7: The wrong-on-purpose file**

In `must-not-compile.ts`: change the import `ServerSpecs` → `ServerSpec` and its four uses. Inside the `defineRules((can, cannot) => { … })` block that holds the `@ts-expect-error` lines, after the "an empty field list with conditions" group add:

```ts
  // @ts-expect-error a field list on a create: nothing reads it
  can('create', 'Proposal', ['status'])
  // @ts-expect-error a field list on a delete: nothing reads it
  cannot('delete', 'Proposal', ['status'])
```

After the `DuplicateSubjectIsCaught` line add:

```ts
// @ts-expect-error a spec outside the list cannot be enforced
createCrudDal(_secondCustomer)
```

with `import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'` added to the imports.

- [ ] **Step 8: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: both pass. Then remove the `// @ts-expect-error` above `can('create', 'Proposal', ['status'])`, run `pnpm tsc`, expect an error on that line, and put the directive back.

- [ ] **Step 9: Commit**

```bash
git add src/shared/domains/permissions/specs.ts src/shared/dal/server/types.ts src/shared/dal/server/lib/define-spec.ts src/shared/dal/server/lib/create-crud-dal.ts src/shared/dal/server/lib/helpers.ts src/shared/dal/server/lib/scope.ts src/trpc/lib/middleware/scope-middleware.ts src/trpc/lib/middleware/shareable-middleware.ts src/trpc/lib/create-crud-router.ts src/trpc/lib/dal-to-trpc.ts src/shared/domains/permissions/rules/define-rules.ts src/shared/domains/permissions/type-checks/must-not-compile.ts
git commit -m "refactor(permissions): ServerSpec names the list of specs; field lists sit on read and update only; forbidden names the column

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The compiler — AST, interpreter, operators, the rule walk, and the shared conditions matcher

**Files:**
- Create: `src/shared/dal/server/lib/permit/ast.ts`
- Create: `src/shared/dal/server/lib/permit/operators.ts`
- Create: `src/shared/dal/server/lib/permit/operators/meeting-participation.ts`
- Create: `src/shared/dal/server/lib/permit/operators/derived-pipeline.ts`
- Create: `src/shared/dal/server/lib/permit/interpret.ts`
- Create: `src/shared/dal/server/lib/permit/where.ts`
- Create: `src/shared/domains/permissions/ability-from-rules.ts`
- Modify: `src/shared/domains/permissions/abilities.ts` (loses `abilityFromRules`, gains `import 'server-only'`)
- Modify: `src/shared/domains/permissions/client.tsx:14`, `src/shared/dal/server/types.ts:13`, `src/trpc/lib/middleware/shareable-middleware.ts:12` (import path)

**Interfaces:**
- Consumes: `OPERATOR_NAMES`, `ReadOperators` from `permissions/operators.ts` (unchanged); `derivedPipelineWhere` from `entities/customers/lib/derived-pipeline-sql.ts` (unchanged).
- Produces: `interpret(node: ScopeNode, ctx: OperatorContext): SQL`; `whereFor(ability, action, subject, field, ctx): SQL`; `defineOperator`, `getOperator`, `assertRegistryMatchesDeclarations`; `abilityFromRules(rules): StockAbility` in `ability-from-rules.ts` (client-safe, with the operator instructions).

- [ ] **Step 1: `ast.ts`**

```ts
// The ucast AST that CASL's `rule.ast` returns, seen by structure. `@ucast/core` is a dependency of
// @casl/ability, not ours, so the shapes are matched the way CASL's own SQL guides do: a compound node
// is `{ operator, value: Node[] }`, a field node `{ operator, field, value }`, and a document operator
// `{ operator, value }` with no `field`, which the interpreter routes through the registry first.
export interface CompoundNode { operator: string, value: ScopeNode[] }

export interface FieldNode { operator: string, field: string, value: unknown }

export type ScopeNode = CompoundNode | FieldNode

export function isCompound(node: ScopeNode): node is CompoundNode {
  return !('field' in node)
}
```

- [ ] **Step 2: `operators.ts` (the registry)**

```ts
import type { SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'

import type { FieldNode } from './ast'

/** The outer table a filter is built for and its primary key, for an operator to correlate on. */
export interface OperatorContext {
  table: PgTable
  pk: PgColumn
}

export interface Operator {
  name: string
  toSql: (node: FieldNode, ctx: OperatorContext) => SQL
}

const REGISTRY = new Map<string, Operator>()

export function defineOperator(op: Operator): void {
  if (REGISTRY.has(op.name)) {
    throw new Error(`[permit] operator '${op.name}' is already registered`)
  }
  REGISTRY.set(op.name, op)
}

export function getOperator(name: string): Operator | undefined {
  return REGISTRY.get(name)
}

/**
 * Both directions, at boot: a declared name without a body would fail inside a request; a body
 * without a declaration would never parse, because the conditions matcher only knows declared names.
 */
export function assertRegistryMatchesDeclarations(declared: readonly string[]): void {
  const names = new Set(declared)
  const missing = declared.filter(name => !REGISTRY.has(name))
  const undeclared = [...REGISTRY.keys()].filter(name => !names.has(name))
  if (missing.length > 0 || undeclared.length > 0) {
    throw new Error(`[permit] operators without a body: [${missing.join(', ')}]; bodies without a declaration: [${undeclared.join(', ')}]`)
  }
}
```

- [ ] **Step 3: `operators/meeting-participation.ts`**

```ts
import { and, eq, exists } from 'drizzle-orm'

import { db } from '@/shared/db'
import { meetingParticipants, meetings, proposals } from '@/shared/db/schema'

import { defineOperator } from '../operators'

type Via = 'customerId' | 'meetingId' | 'projectId' | 'self'

// One atom, three join shapes. `userId` travels inside the rule's condition, because rules are built
// per user, so the operator never asks who is acting. Registered without the `$`: CASL's parser strips
// it from every node's `operator`, built-in and custom alike.
defineOperator({
  name: 'participatesViaMeeting',
  toSql: (node, ctx) => {
    const { via, userId } = node.value as { via: Via, userId: string }
    switch (via) {
      case 'self':
        return exists(
          db.select({ id: meetingParticipants.id }).from(meetingParticipants)
            .where(and(eq(meetingParticipants.meetingId, ctx.pk), eq(meetingParticipants.userId, userId))),
        )
      case 'customerId':
        return exists(
          db.select({ id: meetingParticipants.id }).from(meetings)
            .innerJoin(meetingParticipants, eq(meetingParticipants.meetingId, meetings.id))
            .where(and(eq(meetings.customerId, ctx.pk), eq(meetingParticipants.userId, userId))),
        )
      case 'projectId':
        return exists(
          db.select({ id: meetingParticipants.id }).from(meetings)
            .innerJoin(meetingParticipants, eq(meetingParticipants.meetingId, meetings.id))
            .where(and(eq(meetings.projectId, ctx.pk), eq(meetingParticipants.userId, userId))),
        )
      case 'meetingId':
        // A proposal correlates on its own foreign key, not its primary key.
        return exists(
          db.select({ id: meetingParticipants.id }).from(meetingParticipants)
            .where(and(eq(meetingParticipants.meetingId, proposals.meetingId), eq(meetingParticipants.userId, userId))),
        )
      default:
        throw new Error(`[permit] $participatesViaMeeting: unknown via '${String(via)}'`)
    }
  },
})
```

- [ ] **Step 4: `operators/derived-pipeline.ts`**

```ts
import type { Pipeline } from '@/shared/constants/enums/pipelines'

import { customers } from '@/shared/db/schema/customers'
import { derivedPipelineWhere } from '@/shared/entities/customers/lib/derived-pipeline-sql'

import { defineOperator } from '../operators'

// `derivedPipelineWhere` correlates on the `customers` table itself, so the operator means something
// only when that is the outer table.
defineOperator({
  name: 'inDerivedPipeline',
  toSql: (node, ctx) => {
    if (ctx.table !== customers) {
      throw new Error('[permit] $inDerivedPipeline sits on Customer only')
    }
    const where = derivedPipelineWhere(node.value as readonly Pipeline[])
    if (!where) {
      throw new Error('[permit] $inDerivedPipeline needs at least one pipeline')
    }
    return where
  },
})
```

- [ ] **Step 5: `interpret.ts`**

```ts
import type { SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'

import type { CompoundNode, FieldNode, ScopeNode } from './ast'
import type { OperatorContext } from './operators'

import { and, eq, inArray, isNull, not, or, sql } from 'drizzle-orm'

import { OPERATOR_NAMES } from '@/shared/domains/permissions/operators'

import { isCompound } from './ast'
import { assertRegistryMatchesDeclarations, getOperator } from './operators'

import './operators/meeting-participation'
import './operators/derived-pipeline'

// Runs once the two modules above have registered their bodies; the declarations are client-safe and hold no SQL.
assertRegistryMatchesDeclarations(OPERATOR_NAMES)

/** One rule's conditions as a predicate on `ctx.table`. Always a real SQL value; an unknown operator throws rather than guessing. */
export function interpret(node: ScopeNode, ctx: OperatorContext): SQL {
  // A document operator parses to `{ operator, value }` with no `field`, which `isCompound` would misfile.
  const custom = getOperator(node.operator)
  if (custom) {
    return custom.toSql(node as FieldNode, ctx)
  }
  return isCompound(node) ? interpretCompound(node, ctx) : interpretField(node, ctx)
}

function interpretCompound(node: CompoundNode, ctx: OperatorContext): SQL {
  if (node.operator === 'not') {
    const [child] = node.value
    return child ? not(interpret(child, ctx)) : sql`false`
  }
  if (node.operator !== 'and' && node.operator !== 'or') {
    throw new Error(`[permit] unsupported compound operator '${node.operator}'`)
  }
  const parts = node.value.map(child => interpret(child, ctx))
  if (parts.length === 0) {
    return node.operator === 'and' ? sql`true` : sql`false`
  }
  if (parts.length === 1) {
    return parts[0]!
  }
  return node.operator === 'or' ? or(...parts)! : and(...parts)!
}

function interpretField(node: FieldNode, ctx: OperatorContext): SQL {
  const column = columnOf(ctx, node.field)
  switch (node.operator) {
    case 'eq':
      // `null` matches rows with no value, as CASL's matcher does on the client.
      return node.value === null ? isNull(column) : eq(column, node.value as never)
    case 'in': {
      const values = node.value as readonly unknown[]
      return values.length === 0 ? sql`false` : inArray(column, values as never[])
    }
    default:
      throw new Error(`[permit] unsupported field operator '${node.operator}' on '${node.field}'`)
  }
}

function columnOf(ctx: OperatorContext, field: string): PgColumn {
  const column = (ctx.table as unknown as Record<string, PgColumn | undefined>)[field]
  if (!column) {
    throw new Error(`[permit] '${field}' is not a column of the table`)
  }
  return column
}
```

- [ ] **Step 6: `where.ts` (the rule walk)**

```ts
import type { SQL } from 'drizzle-orm'

import type { AppAbility, AppAction, AppSubject } from '@/shared/domains/permissions/types'

import type { ScopeNode } from './ast'
import type { OperatorContext } from './operators'

import { and, not, or, sql } from 'drizzle-orm'

import { interpret } from './interpret'

/**
 * The rows of `ctx.table` that `action` reaches on `subject`, for one field or for the subject as a
 * whole. The fold is CASL's own `rulesToQuery`, walked per field so a rule with a field list counts
 * only for its fields: newest rule first; a bare `can` ends the walk as allow-all behind the `cannot`s
 * before it; a bare `cannot` ends it with what was collected; no `can` at all is deny-all.
 */
export function whereFor(ability: AppAbility, action: AppAction, subject: AppSubject, field: string | undefined, ctx: OperatorContext): SQL {
  const allowed: SQL[] = []
  const denied: SQL[] = []
  for (const rule of ability.rulesFor(action, subject, field)) {
    if (!rule.conditions) {
      if (rule.inverted) {
        break
      }
      return denied.length > 0 ? and(...denied)! : sql`true`
    }
    const predicate = interpret(rule.ast as ScopeNode, ctx)
    if (rule.inverted) {
      denied.push(not(predicate))
    }
    else {
      allowed.push(predicate)
    }
  }
  if (allowed.length === 0) {
    return sql`false`
  }
  const granted = allowed.length === 1 ? allowed[0]! : or(...allowed)!
  return denied.length > 0 ? and(...denied, granted)! : granted
}
```

- [ ] **Step 7: `ability-from-rules.ts` (client-safe) and the import moves**

```ts
// Client-safe: the browser builds its ability from the rules the server sends, so the two must parse conditions the same way.

import type { PermissionRule, StockAbility } from './types'

import { buildMongoQueryMatcher, createMongoAbility } from '@casl/ability'

import { OPERATOR_NAMES } from './operators'

// Each operator is a document-level instruction keyed by its `$` spelling, which is how a rule writes
// it. CASL's parser strips the `$` from the node it emits, so the registry and the declarations hold
// the bare names.
const conditionsMatcher = buildMongoQueryMatcher(
  Object.fromEntries(OPERATOR_NAMES.map(name => [`$${name}`, { type: 'document' as const }])),
)

/** The one place an ability is built from rules, so the server and the browser match them the same way. */
export function abilityFromRules(rules: PermissionRule[]): StockAbility {
  return createMongoAbility<StockAbility>(rules, { conditionsMatcher })
}
```

If `buildMongoQueryMatcher`'s instruction typing rejects the literal, cast the instructions object once with a comment saying ucast's instruction generics are keyed off `MongoQuery` and do not line up with the declared names; no other cast.

In `abilities.ts`: delete `abilityFromRules` and the `createMongoAbility` import; import `abilityFromRules` from `./ability-from-rules`; add `import 'server-only'` as the last import (the module now holds only the server's rule loader; nothing in the browser imports it, which Step 8 verifies). In `client.tsx:14`, `dal/server/types.ts:13` and `shareable-middleware.ts:12` import `abilityFromRules` from `@/shared/domains/permissions/ability-from-rules`.

- [ ] **Step 8: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: both pass. Then `grep -rn "permissions/abilities'" src --include=*.tsx` must print nothing (no client component imports the loader). Then a throwaway probe in the scratchpad (never under the repo), run with `pnpm tsx <file>`, that builds an ability with `abilityFromRules([{ action: 'read', subject: 'Customer', conditions: { $participatesViaMeeting: { via: 'customerId', userId: 'u1' } } }])` and prints `JSON.stringify(ability.rules[0].ast)`; expected output contains `"operator":"participatesViaMeeting"` and `"value":{"via":"customerId","userId":"u1"}`. Record the output line in the task report and delete the probe.

- [ ] **Step 9: Commit**

```bash
git add src/shared/dal/server/lib/permit src/shared/domains/permissions/ability-from-rules.ts src/shared/domains/permissions/abilities.ts src/shared/domains/permissions/client.tsx src/shared/dal/server/types.ts src/trpc/lib/middleware/shareable-middleware.ts
git commit -m "feat(permissions): the compiler — AST walk, interpreter, operator registry with the two SQL bodies, and the shared conditions matcher

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `permit`, `systemContext`, and a `createCrudDal` that scopes itself

**Files:**
- Create: `src/shared/dal/server/lib/permit/core.ts`
- Create: `src/shared/dal/server/lib/permit/project.ts`
- Create: `src/shared/dal/server/lib/permit.ts`
- Create: `src/shared/dal/server/lib/contexts.ts`
- Create: `src/shared/domains/permissions/rules/system.ts`
- Modify: `src/shared/dal/server/lib/scope.ts` (`COMPILED_SUBJECTS`, `isCompiled`, the compiled branch of the legacy resolver)
- Modify: `src/trpc/lib/middleware/scope-middleware.ts`, `src/shared/dal/server/lib/helpers.ts` (null scope for a compiled spec)
- Modify: `src/shared/dal/server/lib/create-crud-dal.ts` (whole file)
- Modify: `src/shared/dal/server/types.ts` (`SYSTEM_CONTEXT` comment)

**Interfaces:**
- Consumes: `whereFor`, `interpret`'s `OperatorContext` (Task 2); `subjectOf` (erased); `AnyServerSpec`, `ServerSpec`.
- Produces: `permit<TSpec extends ServerSpec>(ctx, action, spec, fields?): Permit` where `Permit = { sql: SQL, probe(id): Promise<boolean>, test(row): boolean }`; `SubjectOf<TSpec>`; `reachFor`, `assertGranted`, `rootRowFor`, `columnKeyOf`, `pkColumnOf` (erased, for the engine); `projectToReadFields`; `systemContext(reason: SystemReason): ScopedContext`; `COMPILED_SUBJECTS` (empty in this task), `isCompiled(spec)`; `fieldPathOf(spec)`.

After this task nothing behaves differently: the compiled set is empty, so every spec still runs on the legacy engine. Task 5 fills the set.

- [ ] **Step 1: `permit/core.ts` (the erased core the engine uses)**

```ts
import type { SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'

import type { AnyServerSpec, ScopedContext } from '../../types'
import type { AppAbility, CrudAction } from '@/shared/domains/permissions/types'

import { subject as tagSubject } from '@casl/ability'
import { and, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/shared/db'

import { ThrowableDalError } from '../../types'
import { subjectOf } from '../define-spec'
import { whereFor } from './where'

export interface Permit {
  /** AND this into any query over the spec's table. Always a real SQL value: true, false or a predicate. */
  sql: SQL
  /** Is the row with this primary key within reach? */
  probe: (id: string | number) => Promise<boolean>
  /**
   * Is the row the rules are written against within reach: the entity's own row, or the root parent's
   * row for a sub-entity? Mutation rules only: a rule with an operator cannot be tested on a row.
   */
  test: (row: Record<string, unknown>) => boolean
}

// What the rules are asked about: a sub-entity is a field of its root parent's subject, and its
// writes are the parent's `update` of that field.
function ruleTarget(spec: AnyServerSpec, action: CrudAction, fields: readonly string[] | undefined): { subject: string, verb: CrudAction, paths: string[] } {
  if ('subject' in spec) {
    return { subject: spec.subject, verb: action, paths: [...(fields ?? [])] }
  }
  const path = fieldPathOf(spec)
  return {
    subject: subjectOf(spec),
    verb: action === 'read' ? 'read' : 'update',
    paths: fields?.length ? fields.map(field => `${path}.${field}`) : [path],
  }
}

/** The dotted field a sub-entity is under its root parent: `views`, or `applications.answers` two levels down; empty for an entity. */
export function fieldPathOf(spec: AnyServerSpec): string {
  if ('subject' in spec) {
    return ''
  }
  const above = fieldPathOf(spec.parent.spec)
  return above ? `${above}.${spec.parent.field}` : spec.parent.field
}

function walk(ability: AppAbility, action: CrudAction, subject: string, fields: readonly string[], ctx: { table: PgTable, pk: PgColumn }): SQL {
  if (fields.length === 0) {
    return whereFor(ability, action, subject as never, undefined, ctx)
  }
  const parts = fields.map(field => whereFor(ability, action, subject as never, field, ctx))
  return parts.length === 1 ? parts[0]! : and(...parts)!
}

function through(ability: AppAbility, action: CrudAction, parent: AnyServerSpec, fk: PgColumn, fields: readonly string[] | undefined): SQL {
  return inArray(
    fk,
    db.select({ pk: pkColumnOf(parent) }).from(parent.table as PgTable).where(filterFor(ability, action, parent, fields)),
  )
}

/**
 * An entity reads through its own `read` rules, and through its parent's when it has one; it writes
 * through its own rules for the action AND its read filter. A sub-entity reads through the parent's
 * `read` rules that cover its field, and writes through the parent's `update` rules that cover it,
 * AND that read. A row that cannot be read cannot be changed.
 */
export function filterFor(ability: AppAbility, action: CrudAction, spec: AnyServerSpec, fields: readonly string[] | undefined): SQL {
  const ctx = { table: spec.table as PgTable, pk: pkColumnOf(spec) }
  if ('subject' in spec) {
    const own = walk(ability, action, spec.subject, fields ?? [], ctx)
    const read = action === 'read' ? own : walk(ability, 'read', spec.subject, [], ctx)
    const parent = spec.parent ? through(ability, 'read', spec.parent.spec, spec.parent.fk, undefined) : undefined
    return action === 'read' ? and(read, parent)! : and(own, read, parent)!
  }
  const { spec: parentSpec, fk, field } = spec.parent
  const paths = fields?.length ? fields.map(name => `${field}.${name}`) : [field]
  const read = through(ability, 'read', parentSpec, fk, paths)
  return action === 'read' ? read : and(through(ability, 'update', parentSpec, fk, paths), read)!
}

export function reachFor(ctx: ScopedContext, action: CrudAction, spec: AnyServerSpec, fields?: readonly string[]): Permit {
  const { ability } = ctx.actor
  const where = filterFor(ability, action, spec, fields)
  const pk = pkColumnOf(spec)
  return {
    sql: where,
    probe: async (id) => {
      const [row] = await (ctx.tx ?? db)
        .select({ ok: sql`1` })
        .from(spec.table as PgTable)
        .where(and(eq(pk, id), where))
        .limit(1)
      return row != null
    },
    test: (row) => {
      const { subject, verb, paths } = ruleTarget(spec, action, fields)
      const withOperator = ability.rulesFor(verb, subject as never).find(rule =>
        rule.conditions && Object.keys(rule.conditions).some(key => key.startsWith('$')))
      if (withOperator) {
        throw new Error(`[permit] ${verb} ${subject}: a rule with an operator cannot be tested on a row`)
      }
      const tagged = tagSubject(subject, row)
      const granted = (field?: string) => {
        const rule = ability.relevantRuleFor(verb, tagged as never, field)
        return rule != null && !rule.inverted
      }
      return paths.length === 0 ? granted() : paths.every(granted)
    },
  }
}

/** Forbidden when the actor holds no rule at all for the action on the spec's subject (for a sub-entity: the parent's verb on its field). */
export function assertGranted(ability: AppAbility, action: CrudAction, spec: AnyServerSpec): void {
  const { subject, verb, paths } = ruleTarget(spec, action, undefined)
  const rule = ability.relevantRuleFor(verb, subject as never, paths[0])
  if (rule == null || rule.inverted) {
    throw new ThrowableDalError({ type: 'forbidden' })
  }
}

/** The row the rules are tested on: the entity's own, or the root parent's for a sub-entity, each hop loaded through that parent's read reach. */
export async function rootRowFor(ctx: ScopedContext, spec: AnyServerSpec, row: Record<string, unknown>): Promise<Record<string, unknown>> {
  let current: AnyServerSpec = spec
  let currentRow = row
  while (!('subject' in current)) {
    const { spec: parentSpec, fk } = current.parent
    const parentId = currentRow[columnKeyOf(current.table as PgTable, fk)]
    const [parentRow] = await (ctx.tx ?? db)
      .select()
      .from(parentSpec.table as PgTable)
      .where(and(eq(pkColumnOf(parentSpec), parentId), filterFor(ctx.actor.ability, 'read', parentSpec, undefined)))
      .limit(1)
    if (!parentRow) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    current = parentSpec
    currentRow = parentRow as Record<string, unknown>
  }
  return currentRow
}

export function pkColumnOf(spec: AnyServerSpec): PgColumn {
  const table = spec.table as unknown as Record<string, PgColumn | undefined>
  const name = spec.primaryKey ?? 'id'
  const column = table[name]
  if (!column) {
    throw new Error(`[permit] '${name}' is not a column of ${spec.entityName}'s table`)
  }
  return column
}

/** The TypeScript key of a column, by identity: `PgColumn.name` is the database-side name. */
export function columnKeyOf(table: PgTable, column: PgColumn): string {
  const key = Object.entries(table as unknown as Record<string, PgColumn>).find(([, candidate]) => candidate === column)?.[0]
  if (!key) {
    throw new Error('[permit] the column is not on the table')
  }
  return key
}
```

The `as never` casts on `subject` and `tagged` are the one place run-time strings meet CASL's typed parameters: `rulesFor` and `relevantRuleFor` keep CASL's loose signatures on purpose, and this module is where that looseness is used. No other file casts for this.

- [ ] **Step 2: `permit/project.ts` (the read projection, D-29)**

```ts
import type { AnyServerSpec } from '../../types'
import type { AppAbility } from '@/shared/domains/permissions/types'

import { subject as tagSubject } from '@casl/ability'

import { subjectOf } from '../define-spec'
import { fieldPathOf } from './core'

/**
 * A `read` rule with a field list limits what the actor receives: the row leaves the DAL with those
 * columns only. A rule without a field list, or `manage all`, admits every column. For a sub-entity
 * the parent's rules decide: `views` or `views.*` admits every column of a view, `views.viewedAt` one.
 * Lowest priority first, each matching rule adding or removing its columns, as CASL's own
 * `permittedFieldsOf` walks. A rule with an operator counts as matching: the SQL filter that loaded
 * the row already applied it, and the in-memory matcher cannot evaluate it.
 */
export function projectToReadFields(ability: AppAbility, spec: AnyServerSpec, row: Record<string, unknown>): Record<string, unknown> {
  const columns = Object.keys(row)
  const subject = subjectOf(spec)
  const path = fieldPathOf(spec)
  const prefix = path ? `${path}.` : ''
  const tagged = tagSubject(subject, row)
  const permitted = new Set<string>()
  for (const rule of [...ability.possibleRulesFor('read', subject as never)].reverse()) {
    const carriesOperator = rule.conditions != null && Object.keys(rule.conditions).some(key => key.startsWith('$'))
    if (!carriesOperator && !rule.matchesConditions(tagged as never)) {
      continue
    }
    for (const column of rule.fields ? columnsNamedBy(rule.fields, columns, prefix) : columns) {
      if (rule.inverted) {
        permitted.delete(column)
      }
      else {
        permitted.add(column)
      }
    }
  }
  if (columns.every(column => permitted.has(column))) {
    return row
  }
  return Object.fromEntries(columns.filter(column => permitted.has(column)).map(column => [column, row[column]]))
}

function columnsNamedBy(fields: readonly string[], columns: string[], prefix: string): string[] {
  return fields.flatMap((field) => {
    if (!prefix) {
      return columns.includes(field) ? [field] : []
    }
    if (field === prefix.slice(0, -1) || field === `${prefix}*` || field === `${prefix}**`) {
      return columns
    }
    const own = field.startsWith(prefix) ? field.slice(prefix.length) : ''
    return own && columns.includes(own) ? [own] : []
  })
}
```

- [ ] **Step 3: `permit.ts` (the typed entry point)**

```ts
import type { ScopedContext } from '../types'
import type { EntitySubject, FieldOf, ServerSpec } from '@/shared/domains/permissions/specs'
import type { CrudAction } from '@/shared/domains/permissions/types'

import type { Permit } from './permit/core'

import { reachFor } from './permit/core'

export type { Permit } from './permit/core'

/** The subject a spec is checked under: its own, or its root parent's for a sub-entity. */
export type SubjectOf<TSpec> = TSpec extends { subject: infer S extends EntitySubject }
  ? S
  : TSpec extends { parent: { spec: infer P } } ? SubjectOf<P> : never

/**
 * The one entry point for enforcement. `fields` narrows the walk to the rules that cover those fields;
 * several fields must all be covered. A sub-entity's fields are its own column names.
 */
export function permit<TSpec extends ServerSpec>(
  ctx: ScopedContext,
  action: CrudAction,
  spec: TSpec,
  fields?: readonly FieldOf<SubjectOf<TSpec>>[],
): Permit {
  return reachFor(ctx, action, spec, fields)
}
```

- [ ] **Step 4: `rules/system.ts` and `contexts.ts`**

`src/shared/domains/permissions/rules/system.ts`:

```ts
import { defineRules } from './define-rules'

/** The closed list of reasons a request runs with every permission. A new site adds its reason here first. */
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

export const systemRules = (reason: SystemReason) => defineRules((can) => {
  can('manage', 'all').because(reason)
})
```

`src/shared/dal/server/lib/contexts.ts`:

```ts
import type { ScopedContext } from '../types'
import type { SystemReason } from '@/shared/domains/permissions/rules/system'

import { abilityFromRules } from '@/shared/domains/permissions/ability-from-rules'
import { systemRules } from '@/shared/domains/permissions/rules/system'

/** An unrestricted context for jobs, webhooks and server-derived writes. The reason rides on the rule, so every privileged site is named. */
export function systemContext(reason: SystemReason): ScopedContext {
  return { actor: { ability: abilityFromRules(systemRules(reason)), userId: null }, scope: null }
}
```

In `dal/server/types.ts` the comment above `SYSTEM_CONTEXT` becomes: `// Sites not yet classified into \`systemContext(reason)\`; each family moves its own, and the constant goes with the last.`

- [ ] **Step 5: The legacy switch in `scope.ts`, `scope-middleware.ts`, `helpers.ts`**

In `src/shared/dal/server/lib/scope.ts` add after the imports (importing `EntitySubject` from `@/shared/domains/permissions/specs` and `subjectOf` from `./define-spec`):

```ts
/**
 * The subjects whose rules are compiled: their specs declare no `visibility`, and `createCrudDal`
 * scopes them through `permit`. A family joins when it converts; the set and this module go when
 * the last one has.
 */
export const COMPILED_SUBJECTS: ReadonlySet<EntitySubject> = new Set<EntitySubject>([])

export function isCompiled(spec: AnyServerSpec): boolean {
  return COMPILED_SUBJECTS.has(subjectOf(spec))
}
```

In `bridgeToParent`, before `const parentScope = …`:

```ts
  if (isCompiled(parent.spec)) {
    throw new Error(`[resolveEffectiveScope] ${parent.spec.entityName} is compiled: a family converts its children with it.`)
  }
```

In `isVisible`, after the omni check: `if (isCompiled(spec)) { return (await reachFor(ctx, 'read', spec).probe(id)) }` with `reachFor` imported from `./permit/core`.

In `src/trpc/lib/middleware/scope-middleware.ts`:

```ts
export function resolveVisibilityScope(
  spec: AnyServerSpec,
  auth: { userId: string, ability: AppAbility },
): SQL | null {
  // A compiled spec is scoped by the DAL itself; a legacy procedure hands it no filter.
  if (isCompiled(spec) || auth.ability.can('manage', 'all')) {
    return null
  }
  return resolveEffectiveScope(spec, { userId: auth.userId, ability: auth.ability })
}
```

In `helpers.ts`, `buildUserContext`:

```ts
export function buildUserContext(user: VisibilityScope, spec: AnyServerSpec): ScopedContext {
  const unscoped = isCompiled(spec) || user.ability.can('manage', 'all')
  return {
    actor: { ability: user.ability, userId: user.userId },
    scope: unscoped ? null : resolveEffectiveScope(spec, user),
  }
}
```

- [ ] **Step 6: `create-crud-dal.ts` — the whole file**

```ts
import type { SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'

import type {
  AnyServerSpec,
  CreateAfterMeta,
  CrudCallsiteHooks,
  CrudConfig,
  CrudConfigFactory,
  CrudHandlers,
  DalReturn,
  ScopedContext,
  SpecCrudHandlers,
  SpecId,
  SpecInsert,
  SpecUpdate,
  UpdateAfterMeta,
} from '../types'
import type { Insert, Row, Update } from '@/shared/db/types'
import type { ServerSpec } from '@/shared/domains/permissions/specs'
import type { CrudAction } from '@/shared/domains/permissions/types'

import { and, eq } from 'drizzle-orm'

import { db } from '@/shared/db'

import { ThrowableDalError } from '../types'
import { dalDbOperation } from './helpers'
import { assertGranted, columnKeyOf, reachFor, rootRowFor } from './permit/core'
import { projectToReadFields } from './permit/project'
import { isCompiled } from './scope'

/**
 * How a slot narrows its rows while the legacy engine and the compiled rules coexist: a converted
 * family answers through `permit`, the others through the `ctx.scope` their procedures resolved.
 */
interface Scoping {
  read: (ctx: ScopedContext) => SQL | undefined
  write: (ctx: ScopedContext, action: 'update' | 'delete') => SQL | undefined
  /** Forbidden when the actor has no rule at all for the slot's action. */
  assert: (ctx: ScopedContext, action: CrudAction) => void
  /** Each changed column against the loaded row, or against the root parent's row for a sub-entity. */
  assertColumns: (ctx: ScopedContext, row: Record<string, unknown>, columns: string[]) => Promise<void>
  /** A create under a parent: readable for an entity with a parent, updatable on this field for a sub-entity. A miss is not found. */
  assertParentReachable: (ctx: ScopedContext, input: Record<string, unknown>) => Promise<void>
  /** Always loaded before an update, so the columns can be checked against it. */
  loadsRowBeforeUpdate: boolean
  project: (ctx: ScopedContext, row: Record<string, unknown>) => Record<string, unknown>
}

const legacyScoping: Scoping = {
  read: ctx => ctx.scope ?? undefined,
  write: ctx => ctx.scope ?? undefined,
  assert: () => {},
  assertColumns: async () => {},
  assertParentReachable: async () => {},
  loadsRowBeforeUpdate: false,
  project: (_ctx, row) => row,
}

function compiledScoping(spec: AnyServerSpec): Scoping {
  return {
    read: ctx => reachFor(ctx, 'read', spec).sql,
    write: (ctx, action) => reachFor(ctx, action, spec).sql,
    assert: (ctx, action) => assertGranted(ctx.actor.ability, action, spec),
    assertColumns: async (ctx, row, columns) => {
      const target = await rootRowFor(ctx, spec, row)
      for (const column of columns) {
        if (!reachFor(ctx, 'update', spec, [column]).test(target)) {
          throw new ThrowableDalError({ type: 'forbidden', field: `${spec.entityName}.${column}` })
        }
      }
    },
    assertParentReachable: async (ctx, input) => {
      if (!spec.parent) {
        return
      }
      const parentId = input[columnKeyOf(spec.table as PgTable, spec.parent.fk)] as string | number
      const reach = 'subject' in spec
        ? reachFor(ctx, 'read', spec.parent.spec)
        : reachFor(ctx, 'update', spec.parent.spec, [spec.parent.field])
      if (!(await reach.probe(parentId))) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
    },
    loadsRowBeforeUpdate: true,
    project: (ctx, row) => projectToReadFields(ctx.actor.ability, spec, row),
  }
}

// Generic over the spec, not the table, so handler payload types are the spec's Zod inputs.
// Only a listed spec can be enforced: the rules are typed against the list, and a spec outside it has no subject they can name.
export function createCrudDal<TSpec extends ServerSpec>(
  spec: TSpec,
  configFactory?: CrudConfigFactory<TSpec['table'], SpecId<TSpec>, SpecInsert<TSpec>, SpecUpdate<TSpec>>,
): SpecCrudHandlers<TSpec> {
  type TTable = TSpec['table']
  type TId = SpecId<TSpec>
  type TInsert = SpecInsert<TSpec>
  type TUpdate = SpecUpdate<TSpec>
  const pkColumn = getPkColumn(spec)
  const scoping = isCompiled(spec) ? compiledScoping(spec) : legacyScoping
  const crudHandlers = {} as CrudHandlers<TTable, TId, TInsert, TUpdate> // ← bootstrap cast (spec §2.3)
  const cfg: CrudConfig<TTable, TId, TInsert, TUpdate> = configFactory
    ? configFactory(crudHandlers)
    : {}

  Object.assign(crudHandlers, {
    getById: (ctx: ScopedContext, input: { id: TId }) => getByIdImpl<TTable>(spec, scoping, pkColumn, ctx, input),
    create: (ctx: ScopedContext, input: TInsert, options?: CrudCallsiteHooks<TTable, TId, 'create', TInsert, TUpdate>) =>
      createImpl<TTable, TId, TInsert, TUpdate>(spec, scoping, cfg, ctx, input, options),
    update: (ctx: ScopedContext, input: { id: TId, data: TUpdate }, options?: CrudCallsiteHooks<TTable, TId, 'update', TInsert, TUpdate>) =>
      updateImpl<TTable, TId, TInsert, TUpdate>(spec, scoping, cfg, pkColumn, ctx, input, options),
    delete: (ctx: ScopedContext, input: { id: TId }, options?: CrudCallsiteHooks<TTable, TId, 'delete', TInsert, TUpdate>) =>
      deleteImpl<TTable, TId, TInsert, TUpdate>(spec, scoping, cfg, pkColumn, ctx, input, options),
    duplicate: (ctx: ScopedContext, input: { id: TId }, options?: CrudCallsiteHooks<TTable, TId, 'create', TInsert, TUpdate>) =>
      duplicateImpl<TTable, TId, TInsert, TUpdate>(spec, scoping, cfg, pkColumn, ctx, input, options),
  })
  return crudHandlers
}

async function getByIdImpl<TTable extends PgTable>(
  spec: AnyServerSpec<TTable>,
  scoping: Scoping,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: string | number },
): Promise<DalReturn<Row<TTable> | undefined>> {
  return dalDbOperation(async () => {
    scoping.assert(ctx, 'read')
    const exec = ctx.tx ?? db
    const where = and(eq(pkColumn, input.id), scoping.read(ctx))
    const [row] = await exec
      .select()
      .from(spec.table as PgTable)
      .where(where)
      .limit(1)
    return row ? scoping.project(ctx, row) as Row<TTable> : undefined
  })
}

async function createImpl<TTable extends PgTable, TId extends string | number, TInsert, TUpdate>(
  spec: AnyServerSpec<TTable>,
  scoping: Scoping,
  cfg: CrudConfig<TTable, TId, TInsert, TUpdate>,
  ctx: ScopedContext,
  input: TInsert,
  callsite?: CrudCallsiteHooks<TTable, TId, 'create', TInsert, TUpdate>,
): Promise<DalReturn<Row<TTable>>> {
  return dalDbOperation(async () => {
    scoping.assert(ctx, 'create')
    const exec = ctx.tx ?? db
    let data = input
    if (cfg.hooks?.create?.before)
      data = await cfg.hooks.create.before(data, ctx)
    if (callsite?.before)
      data = await callsite.before(data, ctx)
    const validated = spec.schemas.insert.parse(data) as Insert<TTable>
    await scoping.assertParentReachable(ctx, validated as Record<string, unknown>)

    const [inserted] = await exec.insert(spec.table as PgTable).values(validated).returning()
    if (!inserted) {
      throw new ThrowableDalError({ type: 'create-failed' })
    }

    let result = inserted as Row<TTable>
    const meta: CreateAfterMeta<TTable, TInsert> = { input }
    if (callsite?.after)
      result = (await callsite.after(result, ctx, meta)) ?? result
    if (cfg.hooks?.create?.after)
      result = (await cfg.hooks.create.after(result, ctx, meta)) ?? result
    return result
  })
}

async function updateImpl<TTable extends PgTable, TId extends string | number, TInsert, TUpdate>(
  spec: AnyServerSpec<TTable>,
  scoping: Scoping,
  cfg: CrudConfig<TTable, TId, TInsert, TUpdate>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: TId, data: TUpdate },
  callsite?: CrudCallsiteHooks<TTable, TId, 'update', TInsert, TUpdate>,
): Promise<DalReturn<Row<TTable>>> {
  return dalDbOperation(async () => {
    const exec = ctx.tx ?? db
    let data = input.data
    if (cfg.hooks?.update?.before)
      data = await cfg.hooks.update.before(data, ctx, { id: input.id })
    if (callsite?.before)
      data = await callsite.before(data, ctx, { id: input.id })
    const validated = spec.schemas.update.parse(data) as Update<TTable>

    // An empty update is a no-op: updatedAt must not move and after-hooks must not fire.
    const changed = Object.entries(validated as Record<string, unknown>).filter(([, value]) => value !== undefined).map(([key]) => key)
    if (changed.length === 0) {
      const current = await getByIdImpl(spec, scoping, pkColumn, ctx, { id: input.id })
      if (!current.success) {
        throw new ThrowableDalError(current.error)
      }
      if (!current.data) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      return current.data
    }

    // Prefetched before the write so a failed prefetch aborts with nothing written; the compiled
    // engine always needs the row, to check each changed column against it.
    const needsPrev = scoping.loadsRowBeforeUpdate || Boolean(cfg.hooks?.update?.after || callsite?.after)
    let previousRow: Row<TTable> | undefined
    if (needsPrev) {
      const prev = await getByIdImpl(spec, scoping, pkColumn, ctx, { id: input.id })
      if (!prev.success) {
        throw new ThrowableDalError({
          type: 'precondition-failed',
          reason: `[create-crud-dal] previousRow prefetch failed for '${spec.entityName}' update — refusing to commit without after-hook context`,
        })
      }
      if (!prev.data) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      previousRow = prev.data as Row<TTable>
      await scoping.assertColumns(ctx, previousRow as Record<string, unknown>, changed)
    }

    // Drizzle drops undefined keys and appends $onUpdate columns here (updatedAt bumps).
    const where = and(eq(pkColumn, input.id), scoping.write(ctx, 'update'))
    const [updated] = await exec.update(spec.table as PgTable).set(validated as Record<string, unknown>).where(where).returning()
    if (!updated) {
      throw new ThrowableDalError({ type: 'not-found' })
    }

    let result = updated as Row<TTable>
    const meta: UpdateAfterMeta<TTable, TUpdate> = { previousRow: previousRow!, input: input.data }
    if (callsite?.after)
      result = (await callsite.after(result, ctx, meta)) ?? result
    if (cfg.hooks?.update?.after)
      result = (await cfg.hooks.update.after(result, ctx, meta)) ?? result
    return result
  })
}

async function deleteImpl<TTable extends PgTable, TId extends string | number, TInsert, TUpdate>(
  spec: AnyServerSpec<TTable>,
  scoping: Scoping,
  cfg: CrudConfig<TTable, TId, TInsert, TUpdate>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: TId },
  callsite?: CrudCallsiteHooks<TTable, TId, 'delete', TInsert, TUpdate>,
): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    scoping.assert(ctx, 'delete')
    const exec = ctx.tx ?? db
    const needsRow = Boolean(
      cfg.hooks?.delete?.before || cfg.hooks?.delete?.after || callsite?.before || callsite?.after,
    )
    let row: Row<TTable> | undefined
    if (needsRow) {
      const pre = await getByIdImpl(spec, scoping, pkColumn, ctx, { id: input.id })
      if (!pre.success) {
        throw new ThrowableDalError({
          type: 'precondition-failed',
          reason: `[create-crud-dal] delete-row prefetch failed for '${spec.entityName}' — refusing to delete without hook context`,
        })
      }
      if (!pre.data) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      row = pre.data as Row<TTable>
    }

    if (cfg.hooks?.delete?.before)
      await cfg.hooks.delete.before(row!, ctx) // pre-DELETE
    if (callsite?.before)
      await callsite.before(row!, ctx)

    const where = and(eq(pkColumn, input.id), scoping.write(ctx, 'delete'))
    const deleted = await exec.delete(spec.table as PgTable).where(where).returning({ id: pkColumn })
    if (deleted.length === 0) {
      throw new ThrowableDalError({ type: 'not-found' })
    }

    if (callsite?.after)
      await callsite.after(row!, ctx)
    if (cfg.hooks?.delete?.after)
      await cfg.hooks.delete.after(row!, ctx)
  })
}

async function duplicateImpl<TTable extends PgTable, TId extends string | number, TInsert, TUpdate>(
  spec: AnyServerSpec<TTable>,
  scoping: Scoping,
  cfg: CrudConfig<TTable, TId, TInsert, TUpdate>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: TId },
  callsite?: CrudCallsiteHooks<TTable, TId, 'create', TInsert, TUpdate>,
): Promise<DalReturn<Row<TTable>>> {
  const srcResult = await getByIdImpl(spec, scoping, pkColumn, ctx, input)
  if (!srcResult.success) {
    return srcResult
  }
  const source = srcResult.data
  if (!source) {
    return { success: false, error: { type: 'not-found' } }
  }

  // null → undefined: insert schemas use .optional(), which rejects null.
  const pkName = spec.primaryKey ?? 'id'
  const excludeSet = new Set<string>([pkName, ...(cfg.duplicate?.exclude ?? [])])
  const base = Object.fromEntries(
    Object.entries(source as Record<string, unknown>)
      .filter(([key]) => !excludeSet.has(key))
      .map(([key, val]) => [key, val === null ? undefined : val]),
  )

  const overrides = cfg.duplicate?.overrides?.(source, ctx) ?? {}
  const insertData = { ...base, ...overrides } as unknown as TInsert

  const created = await createImpl<TTable, TId, TInsert, TUpdate>(spec, scoping, cfg, ctx, insertData, callsite)
  if (!created.success || !cfg.duplicate?.after) {
    return created
  }

  // duplicate.after — the seam for cloning child rows the row copy cannot see.
  // Runs inside dalDbOperation so a ThrowableDalError from the hook becomes a
  // structured DalError instead of escaping as a throw.
  const after = cfg.duplicate.after
  return dalDbOperation(async () => (await after(created.data, ctx, { source })) ?? created.data)
}

function getPkColumn<TTable extends PgTable>(
  spec: AnyServerSpec<TTable>,
): PgColumn {
  const pkName = spec.primaryKey ?? 'id'
  const table = spec.table as unknown as Record<string, PgColumn>
  const column = table[pkName]
  if (!column) {
    throw new Error(
      `[create-crud-dal] Spec for '${spec.entityName}' references primary key `
      + `column '${pkName}' which is not on its table.`,
    )
  }
  return column
}
```

- [ ] **Step 7: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: both pass (the compiled set is empty, so every spec still takes the legacy branch). Then, with the dev server on port 3003 already running on this worktree (restart it if the engine file does not hot-reload: `ss -ltnp | grep 3003`, kill that pnpm process, `pnpm dev`), sign in as super-admin through `http://localhost:3003/api/dev/playwright-session?secret=…&role=super-admin` (the secret is exported in that shell from the main checkout's `.env.local`, never written anywhere) and open `/dashboard/customers`: the list renders as before. Record "rendered, N rows" in the report.

- [ ] **Step 8: Commit**

```bash
git add src/shared/dal/server/lib/permit src/shared/dal/server/lib/permit.ts src/shared/dal/server/lib/contexts.ts src/shared/domains/permissions/rules/system.ts src/shared/dal/server/lib/scope.ts src/trpc/lib/middleware/scope-middleware.ts src/shared/dal/server/lib/helpers.ts src/shared/dal/server/lib/create-crud-dal.ts src/shared/dal/server/types.ts
git commit -m "feat(permissions): permit, systemContext, and a CRUD engine that scopes compiled specs itself

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The Customer family's specs, the rules per role, and the startup checks

**Files:**
- Modify: `src/shared/entities/customers/lib/server-spec.ts` (adds the two sub-entity specs; keeps `visibility` until Task 5)
- Modify: `src/shared/domains/permissions/specs.ts` (list gains two specs)
- Modify: `src/shared/domains/permissions/types.ts` (`SubjectsWithoutSpec` loses `CustomerProfile` and `CustomerLeadAttribution`)
- Create: `src/shared/domains/permissions/rules/super-admin.ts`, `rules/agent.ts`, `rules/dispatcher.ts`, `rules/homeowner.ts`, `rules/user.ts`, `rules/check-rules.ts`
- Modify: `src/shared/domains/permissions/abilities.ts` (whole file)
- Create: `src/shared/dal/server/specs.ts` (`SERVER_SPECS`), `src/shared/dal/server/lib/permit/check-rules.ts`
- Modify: `src/shared/domains/permissions/server/get-request-actor.ts` (runs the compile check at load)
- Modify: `src/shared/domains/permissions/type-checks/must-not-compile.ts`
- Modify: `src/shared/entities/customers/hooks/use-customer-edit-form.ts:30`, `src/trpc/routers/customers.router/profile.router.ts`, `src/trpc/routers/meeting-flow.router.ts` (the three `'CustomerProfile'` checks; the routers' full edits are Task 5, here only the check line changes so tsc passes)

**Interfaces:**
- Produces: `customerProfileServerSpec` (field `profile` of `Customer`), `customerLeadAttributionServerSpec` (field `leadAttribution`); `agentRules(userId)`, `dispatcherRules()`, `superAdminRules()`, `homeownerRules()`, `userRules()`; `assertRules(roles)`; `SERVER_SPECS`; `assertRulesCompile()`.
- The Customer family's rules after this task: agent `read Customer` via `$participatesViaMeeting`, `update Customer ['age', 'profile', 'profile.*']`, `read`/`create CustomerNote`, `update`/`delete CustomerNote { authorId }`; dispatcher `read Customer` via `$inDerivedPipeline: ['leads']`, `update Customer [contact fields]`; super-admin `manage all`.

Both specs keep their `visibility` until Task 5 turns the family on: a spec with neither `visibility` nor a compiled subject makes the legacy resolver throw on its first request, so the two go in one commit.

- [ ] **Step 1: The specs**

`src/shared/entities/customers/lib/server-spec.ts` becomes:

```ts
import { z } from 'zod'

import { defineEntitySpec, defineSubEntitySpec } from '@/shared/dal/server/lib/define-spec'
import {
  customers,
  insertCustomerSchema,
  selectCustomerSchema,
} from '@/shared/db/schema'
import {
  customerLeadAttribution,
  insertCustomerLeadAttributionSchema,
  leadAttributionCaptureSchema,
  selectCustomerLeadAttributionSchema,
} from '@/shared/db/schema/customer-lead-attribution'
import {
  customerProfilePatchSchema,
  customerProfiles,
  insertCustomerProfileSchema,
  selectCustomerProfileSchema,
} from '@/shared/db/schema/customer-profiles'
import { CUSTOMER, CUSTOMER_LEAD_ATTRIBUTION, CUSTOMER_PROFILE } from '@/shared/entities/customers/lib/constants'
import { customerVisibility } from '@/shared/entities/customers/lib/visibility'

// Updates allow `createdAt` (super-admin-only via CASL field gate) — legacy
// Notion imports land with import-day timestamps and lead-source stats by
// range stay misleading until the super-admin corrects them. The base insert
// schema omits `createdAt`, so re-add it here for the update surface.
const updateCustomerSchema = insertCustomerSchema
  .partial()
  .extend({ createdAt: z.string().datetime().optional() })

export const customerSchemas = {
  insert: insertCustomerSchema,
  update: updateCustomerSchema,
}

// duplicate (default createCrudDal impl) copies only `customers` columns — it
// does NOT copy the customer's `customer_profiles` child row.
//
// Lifecycle hooks (address-change geocode invalidation, customer-change
// propagation, delete cascade) live in the config factory in
// ../dal/server/crud.ts — NOT on this spec.
export const customerServerSpec = defineEntitySpec({
  entityName: CUSTOMER,
  subject: CUSTOMER,
  conditionColumns: [],
  visibility: customerVisibility,
  table: customers,
  schemas: {
    insert: insertCustomerSchema,
    update: updateCustomerSchema,
    select: selectCustomerSchema,
  },
})

// The discovery profile is a part of the customer: a rule names it as the field `profile`, and a
// write needs the customer's `update` on `profile` and on each `profile.<column>`.
export const customerProfileServerSpec = defineSubEntitySpec({
  entityName: CUSTOMER_PROFILE,
  table: customerProfiles,
  schemas: {
    insert: insertCustomerProfileSchema,
    update: customerProfilePatchSchema,
    select: selectCustomerProfileSchema,
  },
  primaryKey: 'customerId',
  parent: { spec: customerServerSpec, fk: customerProfiles.customerId, field: 'profile' },
})

// Written once at capture by the system; read with the customer.
export const customerLeadAttributionServerSpec = defineSubEntitySpec({
  entityName: CUSTOMER_LEAD_ATTRIBUTION,
  table: customerLeadAttribution,
  schemas: {
    insert: insertCustomerLeadAttributionSchema,
    update: leadAttributionCaptureSchema,
    select: selectCustomerLeadAttributionSchema,
  },
  primaryKey: 'customerId',
  parent: { spec: customerServerSpec, fk: customerLeadAttribution.customerId, field: 'leadAttribution' },
})
```

In `permissions/specs.ts` add to the type-only imports `customerLeadAttributionServerSpec, customerProfileServerSpec` (same module as `customerServerSpec`) and two members to the union, alphabetically: `| typeof customerLeadAttributionServerSpec` after `customerNoteServerSpec`, `| typeof customerProfileServerSpec` after it.

In `permissions/types.ts`, `SubjectsWithoutSpec` becomes:

```ts
export interface SubjectsWithoutSpec {
  all: 'manage'
  Dashboard: 'access'
  Calendar: 'manage'
  CustomerPipeline: 'read'
  LeadsPool: 'read'
  User: 'read'
  Activity: CrudAction
}
```

- [ ] **Step 2: The rules, one file per role**

`rules/super-admin.ts`:

```ts
import { defineRules } from './define-rules'

export const superAdminRules = () => defineRules((can) => {
  can('manage', 'all')
})
```

`rules/agent.ts`:

```ts
import { defineRules } from './define-rules'

export const agentRules = (userId: string) => defineRules((can) => {
  can('access', 'Dashboard')

  // A customer is reached through a meeting the agent sits in; the row filter and the UI read this one rule.
  can('read', 'Customer', { $participatesViaMeeting: { via: 'customerId', userId } })
  // `age` and the discovery profile are the only parts of a customer an agent writes; customers are created by the office.
  can('update', 'Customer', ['age', 'profile', 'profile.*'])

  can('read', 'CustomerNote')
  can('create', 'CustomerNote')
  can(['update', 'delete'], 'CustomerNote', { authorId: userId })

  can('read', 'Meeting')
  can('create', 'Meeting')
  can('update', 'Meeting')
  can('own', 'Meeting') // agents own the meetings they create (implicitly the sales rep)

  can('read', 'Proposal')
  can('create', 'Proposal')
  can('update', 'Proposal')

  can('read', 'Application')
  can('create', 'Application')
  can('update', 'Application')

  can('read', 'Project')
  can('create', 'Project')
  can('update', 'Project')

  can(['read', 'create', 'update', 'delete'], 'Activity')
  can('manage', 'Calendar')

  // Read only: leads, rehash and dead pipelines are super-admin-managed.
  can('read', 'CustomerPipeline')

  can('read', 'User')

  // Row scoping (own rows only) is enforced by entity visibility predicates until these families convert.
  can('read', 'VoipCall')
  can('create', 'VoipCall') // placeAgentCall via softphone

  can('read', 'VoipMessage')
  can('create', 'VoipMessage') // sendSms via thread UI

  can('read', 'VoipDid') // resolve own sticky DID

  can('read', 'VoipLinkToken')
  can('create', 'VoipLinkToken') // mint L-DOC links

  // Resync, source binding and bulk enroll-all are super-admin-only — no agent rule for those.
  can('read', 'VoipCampaign')
  can('read', 'VoipContactField')
  can('read', 'VoipCampaignContact')
  can('update', 'VoipCampaignContact') // disqualify (unenroll) a lead

  // No agent rule for AppSetting — super-admin only via the 'manage' on 'all'.
})
```

`rules/dispatcher.ts`:

```ts
import { defineRules } from './define-rules'

// Internal lead-qualifier, NOT a sales agent: deliberately without can('own','Meeting'),
// so the appointments they book land unassigned (system-owned) for the dispatch flow.
export const dispatcherRules = () => defineRules((can) => {
  can('access', 'Dashboard')
  can('read', 'LeadsPool') // the shared leads pool drives phone and pipeline access

  // The shared leads pool: customers no meeting has claimed yet.
  can('read', 'Customer', { $inDerivedPipeline: ['leads'] })
  // Lead-contact fields only — not the sales-discovery profile.
  can('update', 'Customer', ['name', 'phone', 'email', 'address', 'city', 'state', 'zip', 'pipelineStage'])

  can('read', 'Meeting')
  can('create', 'Meeting') // books appointments (lands unassigned — see resolve-owner.ts)
  can('update', 'Meeting')

  can('read', 'User')

  can('read', 'VoipCall')
  can('create', 'VoipCall')
  can('read', 'VoipMessage')
  can('create', 'VoipMessage')
  can('read', 'VoipDid')
})
```

`rules/homeowner.ts`:

```ts
import { defineRules } from './define-rules'

// Authenticated homeowners only — most use token-based access instead. Proposal read has no
// "own" condition because proposals link through Meeting → Customer; the token gate covers it today.
export const homeownerRules = () => defineRules((can) => {
  can('read', 'Proposal')
  can('read', 'User')
})
```

`rules/user.ts`:

```ts
import { defineRules } from './define-rules'

// "Own record" is enforced at the DAL layer.
export const userRules = () => defineRules((can) => {
  can('read', 'User')
})
```

`rules/check-rules.ts` (client-safe: rule data only):

```ts
import type { PermissionRule } from '../types'

import type { UserRole } from '@/shared/constants/enums'

/**
 * Three facts the types cannot see, asserted when the rules load. CASL reads rules newest first and
 * ORs the conditioned ones, so a `can` after a `cannot` overrides it, and a bare rule beside a
 * conditioned one allows every row.
 */
export function assertRules(roles: { role: UserRole, rules: PermissionRule[] }[]): void {
  for (const { role, rules } of roles) {
    if (rules.length === 0) {
      throw new Error(`[rules] ${role} has no rules`)
    }
    const seen = new Map<string, { cannot: boolean, conditioned: boolean, bare: boolean }>()
    for (const rule of rules) {
      for (const action of [rule.action].flat()) {
        for (const subject of [rule.subject].flat()) {
          const key = `${action} ${String(subject)}`
          const entry = seen.get(key) ?? { cannot: false, conditioned: false, bare: false }
          if (rule.inverted) {
            entry.cannot = true
          }
          else {
            if (entry.cannot) {
              throw new Error(`[rules] ${role}: a can for '${key}' comes after a cannot, which it would override`)
            }
            if (rule.conditions) {
              entry.conditioned = true
            }
            else {
              entry.bare = true
            }
          }
          seen.set(key, entry)
        }
      }
    }
    for (const [key, entry] of seen) {
      if (entry.conditioned && entry.bare) {
        throw new Error(`[rules] ${role}: '${key}' has a can without conditions beside one with conditions; the bare one would allow every row`)
      }
    }
  }
}
```

`abilities.ts` becomes:

```ts
import type { PermissionRule } from './types'
import type { AppAbility } from './types'

import type { UserRole } from '@/shared/constants/enums'

import { userRoles } from '@/shared/constants/enums'
import { ACTIVITY } from '@/shared/entities/activities/lib/constants'
import { APP_SETTING } from '@/shared/entities/app-settings/lib/constants'
import { APPLICATION } from '@/shared/entities/applications/lib/constants'
import { CUSTOMER_NOTE } from '@/shared/entities/customer-notes/lib/constants'
import { CUSTOMER, CUSTOMER_LEAD_ATTRIBUTION, CUSTOMER_PROFILE } from '@/shared/entities/customers/lib/constants'
import { LEAD_SOURCE } from '@/shared/entities/lead-sources/lib/constants'
import { MEETING } from '@/shared/entities/meetings/lib/constants'
import { VOIP_CALL } from '@/shared/entities/voip-calls/lib/constants'
import { VOIP_CAMPAIGN_CONTACT } from '@/shared/entities/voip-campaign-contacts/lib/constants'
import { VOIP_CAMPAIGN } from '@/shared/entities/voip-campaigns/lib/constants'
import { VOIP_CONTACT_FIELD } from '@/shared/entities/voip-contact-fields/lib/constants'
import { VOIP_DID } from '@/shared/entities/voip-dids/lib/constants'
import { VOIP_LINK_TOKEN } from '@/shared/entities/voip-link-tokens/lib/constants'
import { VOIP_MESSAGE } from '@/shared/entities/voip-messages/lib/constants'
import { PROJECT } from '@/shared/modules/projects/core/lib/constants'
import { PROJECT_MEDIA_FILE } from '@/shared/modules/projects/media/lib/constants'
import { PROPOSAL } from '@/shared/modules/proposals/core/lib/constants'
import { PROPOSAL_INCENTIVE } from '@/shared/modules/proposals/incentives/lib/constants'
import { PROPOSAL_MEDIA_FILE } from '@/shared/modules/proposals/media/lib/constants'
import { PROPOSAL_VIEW } from '@/shared/modules/proposals/views/lib/constants'

import { abilityFromRules } from './ability-from-rules'
import { agentRules } from './rules/agent'
import { assertRules } from './rules/check-rules'
import { dispatcherRules } from './rules/dispatcher'
import { homeownerRules } from './rules/homeowner'
import { superAdminRules } from './rules/super-admin'
import { userRules } from './rules/user'
import 'server-only'

export const ENTITY_NAMES = [
  CUSTOMER,
  CUSTOMER_PROFILE,
  CUSTOMER_LEAD_ATTRIBUTION,
  CUSTOMER_NOTE,
  MEETING,
  PROPOSAL,
  PROPOSAL_MEDIA_FILE,
  PROPOSAL_VIEW,
  PROPOSAL_INCENTIVE,
  PROJECT,
  PROJECT_MEDIA_FILE,
  // Agents have no lead-source grants by design — super-admin's `manage all` is the only access path.
  LEAD_SOURCE,
  ACTIVITY,
  VOIP_CALL,
  VOIP_DID,
  VOIP_MESSAGE,
  VOIP_LINK_TOKEN,
  APP_SETTING,
  VOIP_CAMPAIGN,
  VOIP_CONTACT_FIELD,
  VOIP_CAMPAIGN_CONTACT,
  APPLICATION,
] as const
export type EntityName = (typeof ENTITY_NAMES)[number]

interface PermissionUser {
  id: string
  role: UserRole
}

/** The user's id is written into the conditions when the rules are built; nothing looks up "the current user" later. */
export function rulesForUser({ id, role }: PermissionUser): PermissionRule[] {
  switch (role) {
    case 'super-admin':
      return superAdminRules()
    case 'agent':
      return agentRules(id)
    case 'dispatcher':
      return dispatcherRules()
    case 'homeowner':
      return homeownerRules()
    case 'user':
      return userRules()
  }
}

/** No user means an ability with no rules, never `null`. */
export function defineAbilitiesFor(user: PermissionUser | null): AppAbility {
  return abilityFromRules(user ? rulesForUser(user) : [])
}

// A placeholder id: the checks read the shape of the rules, not whose they are.
assertRules(userRoles.map(role => ({ role, rules: rulesForUser({ id: '00000000-0000-4000-8000-000000000000', role }) })))
```

If `ENTITY_NAMES` has a client importer (`grep -rn "ENTITY_NAMES" src` shows none today besides a comment), stop and report: `server-only` would break it.

- [ ] **Step 3: The runtime list and the compile check**

`src/shared/dal/server/specs.ts`:

```ts
import { appSettingServerSpec } from '@/shared/entities/app-settings/lib/server-spec'
import { applicationServerSpec } from '@/shared/entities/applications/lib/server-spec'
import { customerNoteServerSpec } from '@/shared/entities/customer-notes/lib/server-spec'
import { customerLeadAttributionServerSpec, customerProfileServerSpec, customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import { leadSourceServerSpec } from '@/shared/entities/lead-sources/lib/server-spec'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
import { voipCallServerSpec } from '@/shared/entities/voip-calls/lib/server-spec'
import { voipCampaignContactServerSpec } from '@/shared/entities/voip-campaign-contacts/lib/server-spec'
import { voipCampaignServerSpec } from '@/shared/entities/voip-campaigns/lib/server-spec'
import { voipContactFieldServerSpec } from '@/shared/entities/voip-contact-fields/lib/server-spec'
import { voipDidServerSpec } from '@/shared/entities/voip-dids/lib/server-spec'
import { voipLinkTokenServerSpec } from '@/shared/entities/voip-link-tokens/lib/server-spec'
import { voipMessageServerSpec } from '@/shared/entities/voip-messages/lib/server-spec'
import { projectServerSpec } from '@/shared/modules/projects/core/server-spec'
import { projectMediaServerSpec } from '@/shared/modules/projects/media/server-spec'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import { proposalIncentiveServerSpec } from '@/shared/modules/proposals/incentives/server-spec'
import { proposalMediaServerSpec } from '@/shared/modules/proposals/media/server-spec'
import { proposalViewServerSpec } from '@/shared/modules/proposals/views/server-spec'

/** Every spec, for the checks that need them at run time. The type list in `permissions/specs.ts` is what rules are typed against; the wrong-on-purpose file keeps the two equal. */
export const SERVER_SPECS = [
  appSettingServerSpec,
  applicationServerSpec,
  customerLeadAttributionServerSpec,
  customerNoteServerSpec,
  customerProfileServerSpec,
  customerServerSpec,
  leadSourceServerSpec,
  meetingServerSpec,
  projectMediaServerSpec,
  projectServerSpec,
  proposalIncentiveServerSpec,
  proposalMediaServerSpec,
  proposalServerSpec,
  proposalViewServerSpec,
  voipCallServerSpec,
  voipCampaignContactServerSpec,
  voipCampaignServerSpec,
  voipContactFieldServerSpec,
  voipDidServerSpec,
  voipLinkTokenServerSpec,
  voipMessageServerSpec,
] as const
```

`src/shared/dal/server/lib/permit/check-rules.ts`:

```ts
import type { AnyServerSpec } from '../../types'

import type { ScopeNode } from './ast'

import { userRoles } from '@/shared/constants/enums'
import { SERVER_SPECS } from '@/shared/dal/server/specs'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'

import { interpret } from './interpret'
import { pkColumnOf } from './core'

/** Every rule's conditions walk through the interpreter at boot, so an unknown key nested inside a condition value fails here, not on a request. */
export function assertRulesCompile(): void {
  const specBySubject = new Map<string, AnyServerSpec>()
  for (const spec of SERVER_SPECS) {
    if ('subject' in spec) {
      specBySubject.set(spec.subject, spec)
    }
  }
  for (const role of userRoles) {
    const ability = defineAbilitiesFor({ id: '00000000-0000-4000-8000-000000000000', role })
    for (const rule of ability.rules) {
      if (!rule.conditions) {
        continue
      }
      for (const subject of [rule.subject].flat()) {
        const spec = specBySubject.get(String(subject))
        if (!spec) {
          throw new Error(`[permit] ${role}: conditions on '${String(subject)}', which has no spec`)
        }
        interpret(rule.ast as ScopeNode, { table: spec.table, pk: pkColumnOf(spec) })
      }
    }
  }
}
```

In `get-request-actor.ts` add `import { assertRulesCompile } from '@/shared/dal/server/lib/permit/check-rules'` and, after the imports, `assertRulesCompile()` with the comment `// Once per server process: the first request of a process with a rule the interpreter rejects fails here.`

- [ ] **Step 4: The three `'CustomerProfile'` checks**

`use-customer-edit-form.ts:27-30` becomes:

```ts
  // The discovery profile is a part of the customer: writing it is `update Customer` on `profile`.
  const canEditProfiles = ability.can('update', 'Customer', 'profile')
```

`profile.router.ts:20` and `meeting-flow.router.ts:33`: `ctx.actor.ability.cannot('update', 'Customer', 'profile')`. (Task 5 deletes both checks with the rest of those routers' edits.)

- [ ] **Step 5: The wrong-on-purpose file**

- `TheListIsExact`: `ConditionColumnOf<'Customer'>` stays `never`; nothing changes.
- `customerFields` becomes `['age', 'name', 'phone', 'email', 'address', 'city', 'state', 'zip', 'pipelineStage', 'profile', 'profile.*', 'profile.**', 'profile.hoa', 'leadAttribution', 'leadAttribution.kind']`.
- In `checksThatMustCompile`: replace `ability.can('update', 'CustomerProfile')` with `ability.can('update', 'Customer', 'profile')` and add `ability.can('update', 'Customer', 'profile.hoa')`.
- After the `// @ts-expect-error \`own\` belongs to Meeting` line add:

```ts
// @ts-expect-error the profile is a part of Customer, not a subject
ability.can('update', 'CustomerProfile')
```

- Add, after `DuplicateSubjectIsCaught`, with `SERVER_SPECS` imported from `@/shared/dal/server/specs`:

```ts
export type RuntimeListMatchesTypeList = Expect<Equal<(typeof SERVER_SPECS)[number], ServerSpec>>
```

- [ ] **Step 6: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: both pass. Then start (or restart) the dev server on 3003 and request `http://localhost:3003/` once: the server log shows no `[rules]` or `[permit]` error (the checks ran on the first request). Then, as a negative check, temporarily add `can('read', 'Customer')` as the first line of `agentRules`, request the page again, and confirm the log shows `[rules] agent: 'read Customer' has a can without conditions beside one with conditions`; remove the line. Record both log lines in the report.

- [ ] **Step 7: Commit**

```bash
git add src/shared/entities/customers/lib/server-spec.ts src/shared/domains/permissions/specs.ts src/shared/domains/permissions/types.ts src/shared/domains/permissions/rules src/shared/domains/permissions/abilities.ts src/shared/dal/server/specs.ts src/shared/dal/server/lib/permit/check-rules.ts src/shared/domains/permissions/server/get-request-actor.ts src/shared/domains/permissions/type-checks/must-not-compile.ts src/shared/entities/customers/hooks/use-customer-edit-form.ts src/trpc/routers/customers.router/profile.router.ts src/trpc/routers/meeting-flow.router.ts
git commit -m "feat(permissions): one rules file per role; the Customer family's rules carry their conditions; the profile and lead attribution are parts of Customer; startup checks

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Nothing enforces differently yet: the compiled set is still empty, and both specs still carry their `visibility`.

---

### Task 5: Turn the Customer family on — DAL, routers, the unscoped sites, the client copy

**Files:**
- Modify: `src/shared/dal/server/lib/scope.ts` (`COMPILED_SUBJECTS` = Customer, CustomerNote; the assertion that a compiled spec declares no `visibility`)
- Modify: `src/shared/entities/customers/lib/server-spec.ts`, `src/shared/entities/customer-notes/lib/server-spec.ts` (drop `visibility`)
- Delete: `src/shared/entities/customers/lib/visibility.ts`, `src/shared/entities/customer-notes/lib/visibility.ts`
- Modify: `src/shared/dal/server/lib/upsert-one-to-one.ts` (whole file: the one-to-one part's write slot)
- Modify: `src/shared/entities/customers/dal/server/queries.ts` (`getCustomer`, `listCustomers`)
- Modify: `src/shared/entities/customers/dal/server/pipeline-items.ts`
- Modify: `src/shared/entities/customers/dal/server/get-customer-profile.ts`
- Modify: `src/shared/entities/customers/dal/server/mutations.ts` (`upsertCustomerProfile`, `upsertLeadAttribution`)
- Modify: `src/shared/entities/customers/dal/server/crud.ts` (the cascade's context)
- Delete: `src/shared/entities/customers/dal/server/visibility.ts`, `src/shared/entities/customer-notes/lib/assert-note-author.ts`
- Modify: `src/shared/entities/customer-notes/dal/server/crud.ts` (whole file)
- Modify: `src/shared/services/customer-intake.service.ts:75`
- Modify: `src/trpc/routers/customers.router/procedures.ts`, `business.router.ts`, `profile.router.ts`, `crud.router.ts` (comment)
- Modify: `src/trpc/routers/meeting-flow.router.ts`, `src/trpc/routers/customer-pipelines.router.ts`
- Modify: `src/trpc/routers/funnels.router.ts`, `src/trpc/routers/landing.router/index.tsx`, `src/app/api/webhooks/bina/route.ts`, `src/app/api/webhooks/justcall/route.ts`, `src/shared/services/accounting.service.ts`, `src/shared/services/notification.service.ts`, `src/trpc/routers/voip-campaigns.router.ts`, the six jobs under `src/shared/services/providers/upstash/jobs/` (`bulk-enroll`, `enroll-source-batch`, `enroll-lead`, `bulk-unenroll`, `graduate-from-campaign`, `bulk-dnc`)
- Modify: `src/shared/entities/customers/DOCS.md` (the rule's reference implementation)

**Interfaces:**
- Consumes: `permit`, `systemContext`, `upsertOneToOne(ctx, spec, parentId, set)`, `customerProfileServerSpec`, `customerLeadAttributionServerSpec`.
- Produces: `getCustomerProfile(ctx: ScopedContext, customerId: string)`; `upsertLeadAttribution(ctx, input)`; `customerProcedure` is gone (callers use `agentProcedure`).

- [ ] **Step 1: Turn the switch**

In `scope.ts`: `export const COMPILED_SUBJECTS: ReadonlySet<EntitySubject> = new Set<EntitySubject>(['Customer', 'CustomerNote'])`. Below `isCompiled`, add a module-scope assertion (importing `SERVER_SPECS` from `../specs`):

```ts
// A compiled spec that still declared `visibility` would run on both engines, the legacy one silently.
for (const spec of SERVER_SPECS) {
  if (COMPILED_SUBJECTS.has(subjectOf(spec)) && spec.visibility) {
    throw new Error(`[scope] ${spec.entityName} is compiled and still declares visibility`)
  }
}
```

In `customers/lib/server-spec.ts` delete the `visibility: customerVisibility,` line and the `customerVisibility` import. In `customer-notes/lib/server-spec.ts` delete the `visibility: customerNoteVisibility,` line and the `import { customerNoteVisibility } from './visibility'` line; the comment above that spec loses "customer-visibility probe + authorId stamp on create, author-gate on update/delete" and reads: `// The authorId stamp on create lives in the config factory in ../dal/server/crud.ts — NOT on this spec.` Delete `src/shared/entities/customers/lib/visibility.ts` and `src/shared/entities/customer-notes/lib/visibility.ts` (their specs were their only importers).

- [ ] **Step 2: The customer reads**

`queries.ts`: add `import { permit } from '@/shared/dal/server/lib/permit'` and `import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'`. In `getCustomer`: `.where(and(eq(customers.id, input.id), permit(ctx, 'read', customerServerSpec).sql))`. In `listCustomers`: the first `and` member becomes `permit(ctx, 'read', customerServerSpec).sql`; its doc comment becomes `/** One customers list for every table: the rules scope it, and callers pin a source or segment through fixed filters. */`.

`pipeline-items.ts`: same two imports; in `getCustomerPipelineItems` replace the comment on line 50 and the `customerWhere` member:

```ts
      // The customer reach comes from the rules; each branch adds the meeting-side participation its pipeline needs.
      userId: ctx.actor.userId ?? '',
      isOmni: ctx.actor.ability.can('manage', 'all'),
      canSeeUngated: canSeeUngatedPhone(ctx.actor.ability),
      customerWhere: and(
        permit(ctx, 'read', customerServerSpec).sql,
        buildSearchWhere(input.search, [customers.name, customers.email]),
        CUSTOMER_FIELD_SQL.where(input.filters),
      ),
```

The branches' own `userParticipatesInMeeting` checks stay: they are the meeting side of each pipeline and belong to the Meeting family.

`get-customer-profile.ts`: the signature becomes `export async function getCustomerProfile(ctx: ScopedContext, customerId: string): Promise<CustomerProfileData>`; delete the `CustomerProfileViewer` interface and the comment block above it (lines 26–35); replace `gatedPhoneSql(viewer.canSeeUngated)` with `gatedPhoneSql(canSeeUngatedPhone(ctx.actor.ability))`; replace the `viewer.isSuperAdmin ? undefined : userCanSeeCustomer(viewer.userId, customers.id)` member with `permit(ctx, 'read', customerServerSpec).sql`; imports: add `ScopedContext` (type) from `@/shared/dal/server/types`, `permit`, `customerServerSpec`, `canSeeUngatedPhone` (from `phone-gating-sql`), remove `userCanSeeCustomer`.

Delete `src/shared/entities/customers/dal/server/visibility.ts` (no importer remains; verify with `grep -rn "dal/server/visibility" src`).

- [ ] **Step 3: The profile and attribution writes**

`src/shared/dal/server/lib/upsert-one-to-one.ts` becomes the write slot of a one-to-one part:

```ts
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'

import type { AnyServerSpec, DalReturn, ScopedContext } from '../types'
import type { Insert, Row } from '@/shared/db/types'
import type { ServerSpec } from '@/shared/domains/permissions/specs'

import { db } from '@/shared/db'

import { ThrowableDalError } from '../types'
import { dalDbOperation } from './helpers'
import { columnKeyOf, reachFor, rootRowFor } from './permit/core'
import { isCompiled } from './scope'

/**
 * The write slot of a one-to-one part (its primary key is its foreign key): the first write inserts,
 * every write after updates the same row. The actor must hold the parent's `update` on the part and
 * on each column written, tested on the parent row, which is loaded through the parent's read reach.
 */
export async function upsertOneToOne<TSpec extends ServerSpec & { parent: { field: string } }>(
  ctx: ScopedContext,
  spec: TSpec,
  parentId: string,
  set: Record<string, unknown>,
): Promise<DalReturn<Row<TSpec['table']>>> {
  return dalDbOperation(async () => {
    if (!isCompiled(spec)) {
      throw new Error(`[upsert-one-to-one] ${spec.entityName} is not compiled: its family converts it first`)
    }
    const validated = spec.schemas.update.parse(set) as Record<string, unknown>
    // Undefined = untouched (never overwrite with `undefined`); explicit `null` is a legitimate clear and passes through.
    const filtered = Object.fromEntries(Object.entries(validated).filter(([, value]) => value !== undefined))
    const columns = Object.keys(filtered)
    if (columns.length === 0) {
      throw new ThrowableDalError({
        type: 'precondition-failed',
        reason: 'upsertOneToOne: no fields to write (patch was empty or all-undefined)',
      })
    }

    const erased: AnyServerSpec = spec
    const fkKey = columnKeyOf(erased.table as PgTable, spec.parent.fk as PgColumn)
    const parentRow = await rootRowFor(ctx, erased, { [fkKey]: parentId })
    if (!reachFor(ctx, 'update', erased).test(parentRow)) {
      throw new ThrowableDalError({ type: 'forbidden', field: erased.entityName })
    }
    for (const column of columns) {
      if (!reachFor(ctx, 'update', erased, [column]).test(parentRow)) {
        throw new ThrowableDalError({ type: 'forbidden', field: `${erased.entityName}.${column}` })
      }
    }

    const [row] = await (ctx.tx ?? db)
      .insert(erased.table as PgTable)
      .values({ [fkKey]: parentId, ...filtered } as Insert<TSpec['table']>)
      .onConflictDoUpdate({ target: spec.parent.fk as PgColumn, set: filtered })
      .returning()
    return row as Row<TSpec['table']>
  })
}
```

`mutations.ts`: `upsertCustomerProfile` becomes:

```ts
/** The discovery profile is a part of the customer: the engine tests `update Customer` on `profile` and each written column against the customer row. */
export async function upsertCustomerProfile(
  ctx: ScopedContext,
  input: { customerId: string, patch: CustomerProfilePatch },
): Promise<DalReturn<CustomerProfileRow>> {
  return upsertOneToOne(ctx, customerProfileServerSpec, input.customerId, input.patch)
}
```

`upsertLeadAttribution` takes `ctx: ScopedContext` as its first parameter and calls `dalVerifySuccess(await upsertOneToOne(ctx, customerLeadAttributionServerSpec, input.customerId, attributionWithExtra))`; delete the local `leadAttributionCaptureSchema.parse` line (the slot validates with the spec's update schema) and the comment above it. Imports: add `customerLeadAttributionServerSpec, customerProfileServerSpec` from `@/shared/entities/customers/lib/server-spec`; remove `and, eq`, `ThrowableDalError`, `customerProfilePatchSchema, customerProfiles`, `customers`, `leadAttributionCaptureSchema` (keep `customerLeadAttribution` for `upsertFunnelEnrichment`, `customerEnrichment`, `db`, `dalDbOperation`, `dalVerifySuccess`, `upsertOneToOne`). `customer-intake.service.ts:75` becomes `const attr = await upsertLeadAttribution(ctx, { customerId: customer.id, leadMeta: input.leadMeta, extra: input.attributionExtra })`.

- [ ] **Step 4: The notes**

`customer-notes/dal/server/crud.ts` becomes:

```ts
import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { customerNoteServerSpec } from '@/shared/entities/customer-notes/lib/server-spec'

// Reach is the rules': a note is read through its customer, and edited or deleted by its author
// (`authorId` in the rule) or by a super-admin. The engine probes the customer before a create.
export const customerNoteCrud = createCrudDal(customerNoteServerSpec, () => ({
  hooks: {
    create: {
      // The author is whoever acts; an intake note has no user and keeps the author it was given (none).
      before: (input, ctx) => ({ ...input, authorId: ctx.actor.userId ?? input.authorId ?? null }),
    },
  },
}))
```

Delete `src/shared/entities/customer-notes/lib/assert-note-author.ts`.

- [ ] **Step 5: The customer routers**

`customers.router/procedures.ts`: delete `customerProcedure` and the `resolveVisibilityScope` and `customerServerSpec` imports; the file keeps `customerPublicProcedure` and the header comment loses its first paragraph (the pre-scoped procedure is gone) and keeps the one about `server-spec.ts` staying pure.

`business.router.ts`: import `agentProcedure` from `'../../init'` beside `createTRPCRouter`, `permit` from `@/shared/dal/server/lib/permit`, `systemContext` from `@/shared/dal/server/lib/contexts`, `customerServerSpec` from `@/shared/entities/customers/lib/server-spec`; remove the `SYSTEM_CONTEXT` import and the `customerProcedure` import (keep `customerPublicProcedure`). `list` and `search` use `agentProcedure`; in `search`: `.where(and(textWhere, permit(ctx, 'read', customerServerSpec).sql))`; in `createFromIntake`: `customerIntakeService.ingestLead(systemContext('intake:form'), {`.

`profile.router.ts` becomes:

```ts
import z from 'zod'

import { customerProfilePatchSchema } from '@/shared/db/schema'
import { upsertCustomerProfile } from '@/shared/entities/customers/dal/server/mutations'

import { agentProcedure, createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'

export const profileRouter = createTRPCRouter({
  // The engine answers forbidden when the actor may not write the profile, and not found when the customer is out of reach.
  upsert: agentProcedure
    .input(z.object({ id: z.string().uuid(), data: customerProfilePatchSchema }))
    .mutation(async ({ ctx, input }) => dalToTrpc(await upsertCustomerProfile(ctx, { customerId: input.id, patch: input.data }))),
})
```

`crud.router.ts`: the header comment's last paragraph (lines 15–19) becomes `// crud.update: the engine checks each changed column against the loaded row. The agent grant on 'Customer' covers \`age\` and the discovery profile (the \`profile\` part); dispatchers hold the contact fields.`

`meeting-flow.router.ts`: `updateCustomerProfile` loses the `cannot(...)` block and calls `upsertCustomerProfile(ctx, { customerId, patch })`; remove the `SYSTEM_CONTEXT` import (keep `buildUserContext` for `getPersonaProfile`); the comment above the procedure loses "(Addendum B 1:1 child table; emits realtime sync event)" and reads `// Upsert into customer_profiles from within the meeting flow; emits a realtime sync event. Flat column patch — no read-modify-merge, the column IS the field.`

`customer-pipelines.router.ts`:
- `getCustomerPipelineItems`: `dalToTrpc(await getCustomerPipelineItems(ctx, input))`.
- `getCustomerProfile`: `.query(async ({ input, ctx }) => getCustomerProfile(ctx, input.customerId))`; remove the `canSeeUngatedPhone` import if nothing else uses it.
- `getRecordingUrl`: before the select, `if (!(await permit(ctx, 'read', customerServerSpec).probe(input.customerId))) { throw new TRPCError({ code: 'NOT_FOUND' }) }` (the handler takes `{ input, ctx }`); imports `permit` and `customerServerSpec`.

- [ ] **Step 6: The unscoped sites of the family**

Replace `SYSTEM_CONTEXT` with `systemContext('<reason>')` (import `systemContext` from `@/shared/dal/server/lib/contexts`; drop the `SYSTEM_CONTEXT` import where no use remains in the file):

| File | Lines | Reason |
|---|---|---|
| `src/trpc/routers/funnels.router.ts` | 121, 217, 241 | `'intake:funnel'` |
| `src/trpc/routers/landing.router/index.tsx` | 125 | `'intake:landing'` |
| `src/app/api/webhooks/bina/route.ts` | 35 | `'webhook:bina'` |
| `src/app/api/webhooks/justcall/route.ts` | 62, 94 | `'webhook:justcall'` |
| `src/shared/services/accounting.service.ts` | 24, 77 only (the proposal and project lines stay) | `'sync:quickbooks'` |
| `src/shared/services/notification.service.ts` | 49 only | `'derived:new-lead-notification'` |
| `src/shared/entities/customers/dal/server/crud.ts` | 112 | `'derived:customer-delete-cascade'`; the comment "SYSTEM_CONTEXT because the caller has already passed `delete:Customer`…" keeps its reasoning with the new name |
| the six jobs | each `campaignEnrollmentService.enroll/unenroll(SYSTEM_CONTEXT, …)` | `'job:campaign-enrollment'` |
| `src/trpc/routers/voip-campaigns.router.ts` | 118, 141, 150 | `ctx` itself: these procedures are super-admin-only, and a super-admin actor is `manage all`; the comment at 137 becomes `// Super-admin-only: a scoped agent could otherwise drop any customer out of a campaign.` |

- [ ] **Step 7: The customers DOCS**

In `src/shared/entities/customers/DOCS.md` the `visibility-via-meeting-participation` rule's two lines become:

```
**Reference impl**: `rules/agent.ts`: `can('read', 'Customer', { $participatesViaMeeting: { via: 'customerId', userId } })`; SQL body in `dal/server/lib/permit/operators/meeting-participation.ts`
**Enforced by**: `createCrudDal` and every customer read through `permit(ctx, 'read', customerServerSpec).sql`
```

- [ ] **Step 8: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: both pass. `grep -rn "SYSTEM_CONTEXT" src | wc -l` is lower by the number of sites in Step 6's table (report the before and after counts). `grep -rn "customerProcedure\b\|assertNoteAuthorOrAdmin\|userCanSeeCustomer\|leadsPoolVisibility\|customerVisibility\|customerNoteVisibility\|'CustomerProfile'\|'CustomerLeadAttribution'" src` prints only the `openModal({ accessor: 'CustomerProfile', …})` modal-registry lines (the modal's name, not a subject) and the two constants in `customers/lib/constants.ts`.

Then, with the dev server on 3003 restarted on this tree, sign in as super-admin and open `/dashboard/customers`, one customer's profile modal, and `/dashboard/pipelines` (leads and fresh): all render. Sign in as dispatcher: `/dashboard/customers` lists only leads-pool customers; `/dashboard/pipelines` leads renders. Sign in as agent: `/dashboard/customers` renders (empty unless the fixture participates in a meeting). Save a screenshot of each to the scratchpad (`$SCRATCH/unit3-part1/`) and list them in the report. No writes.

- [ ] **Step 9: Commit**

```bash
git add src/shared/dal/server/lib/scope.ts src/shared/entities/customers/lib/server-spec.ts src/shared/entities/customer-notes/lib/server-spec.ts src/shared/entities/customers/lib/visibility.ts src/shared/entities/customer-notes/lib/visibility.ts src/shared/dal/server/lib/upsert-one-to-one.ts src/shared/entities/customers/dal/server/queries.ts src/shared/entities/customers/dal/server/pipeline-items.ts src/shared/entities/customers/dal/server/get-customer-profile.ts src/shared/entities/customers/dal/server/mutations.ts src/shared/entities/customers/dal/server/crud.ts src/shared/entities/customers/dal/server/visibility.ts src/shared/entities/customer-notes/lib/assert-note-author.ts src/shared/entities/customer-notes/dal/server/crud.ts src/shared/services/customer-intake.service.ts src/trpc/routers/customers.router src/trpc/routers/meeting-flow.router.ts src/trpc/routers/customer-pipelines.router.ts src/trpc/routers/funnels.router.ts src/trpc/routers/landing.router/index.tsx src/app/api/webhooks/bina/route.ts src/app/api/webhooks/justcall/route.ts src/shared/services/accounting.service.ts src/shared/services/notification.service.ts src/trpc/routers/voip-campaigns.router.ts src/shared/services/providers/upstash/jobs/bulk-enroll.ts src/shared/services/providers/upstash/jobs/enroll-source-batch.ts src/shared/services/providers/upstash/jobs/enroll-lead.ts src/shared/services/providers/upstash/jobs/bulk-unenroll.ts src/shared/services/providers/upstash/jobs/graduate-from-campaign.ts src/shared/services/providers/upstash/jobs/bulk-dnc.ts src/shared/entities/customers/DOCS.md
git commit -m "feat(permissions): the Customer family runs on compiled rules — reads through permit, the profile and attribution as parts, notes gated by the author rule, the family's unscoped sites named

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Browser checks per role (HITL) and the record

**Files:**
- Create (scratchpad only, never committed): `$SCRATCH/unit3-part1/checks.cjs` modelled on `$SCRATCH/unit2-browser-checks/checks.cjs`
- Modify: `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (Unit 3 block: part 1 landed, commits, verification line, what is carried), `docs/superpowers/specs/2026-10-05-permissions-structure-design.md` (status line), `docs/plans/2026-09-07-casl-re-grounding/DISTILLED-2026-10-01.md` (§1 status, §7 next steps)

**Owner prerequisites, stated before the check runs:** the dev `agent` fixture participates in no meeting, so the agent's positive checks need the owner to add that user as a participant of one meeting by hand (no DB writes by the implementer). The write checks (notes add, edit, delete; profile save) are the owner's, by hand, on records the owner names.

- [ ] **Step 1: The read checks, scripted**

With `DEV_LOGIN_SECRET` exported in the shell only, the script signs in through `/api/dev/playwright-session?secret=…&role=<role>` and records, per role, status codes and row counts, GET-only (every tRPC POST is aborted at the route level, as the unit 2 script did):

| # | Role | Check | Expected |
|---|---|---|---|
| R1 | super-admin | `/dashboard/customers`, a customer modal, `/dashboard/pipelines` leads and fresh | render; counts recorded |
| R2 | dispatcher | `/dashboard/customers` | only leads-pool customers (same set as the leads kanban) |
| R3 | dispatcher | `customersRouter.crud.getById` for a customer with a meeting (id from R1) | NOT_FOUND |
| R4 | dispatcher | `customerPipelinesRouter.getRecordingUrl` for that customer | NOT_FOUND |
| R5 | agent (after the owner's prerequisite) | `/dashboard/customers` | only the participation customer(s) |
| R6 | agent | `crud.getById` for a customer outside participation | NOT_FOUND |
| R7 | agent | `getCustomerProfile` for the participation customer | renders with notes |
| R8 | homeowner, user | `/dashboard` | redirected as before |

- [ ] **Step 2: The write checks, by the owner**

| # | Role | Action | Expected |
|---|---|---|---|
| W1 | agent | add a note on the participation customer | created, author = agent |
| W2 | agent | edit that note; edit a note by another author on the same customer | own: saved; other's: FORBIDDEN naming `CustomerNote.content` |
| W3 | agent | delete the other author's note | FORBIDDEN |
| W4 | agent | save the discovery profile on the participation customer; on a customer outside reach (by id, through the API) | saved; NOT_FOUND |
| W5 | dispatcher | save the discovery profile on a leads-pool customer | FORBIDDEN naming `CustomerProfile` |
| W6 | dispatcher | edit a lead's phone | saved |
| W7 | super-admin | everything above | allowed |
| W8 | anyone | submit the intake form at `/intake` | customer created with attribution (the `intake:form` context) |

- [ ] **Step 3: Record**

In the tracker's Unit 3 block add under the checkbox: `**Part 1 landed <date>:** compiler, permit, systemContext, the Customer family (commits …). Verified <date>: R1–R8 (script) and W1–W8 (owner) PASS; <anything that did not>.` Carry into the "Customer family" line: the db87d28d restore waits on Q11; the dispatcher's four-bucket reach is unit 4's. Update the spec's status line to "Units 1 and 2 of §11, and part 1 of unit 3, are built". Update the distilled record's §1 and §7 (step 2 becomes: part 2, the Meeting family).

- [ ] **Step 4: Commit**

```bash
git add docs/plans/2026-08-10-casl-scope-compiler-epic.md docs/superpowers/specs/2026-10-05-permissions-structure-design.md docs/plans/2026-09-07-casl-re-grounding/DISTILLED-2026-10-01.md
git commit -m "docs(permissions): unit 3 part 1 recorded — the compiler and the Customer family, with the browser evidence

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

The plan file itself is deleted in the same commit once the owner has seen the record (`git rm docs/superpowers/plans/2026-10-07-permissions-unit-3-part-1-compiler-and-customer-family.md`), as the unit 2 plan was.
