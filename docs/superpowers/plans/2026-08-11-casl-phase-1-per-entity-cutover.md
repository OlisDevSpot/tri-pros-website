# CASL Scope Compiler — Phase 1: Per-Entity Atomic Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire CASL's custom-operator parser into the Phase-0 scope engine, then cut the four root entities (Customer → Meeting → Proposal → Project) over to compiled row-visibility one entity at a time, each equivalence-gated against its pre-change hand-written predicate.

**Architecture:** Phase 0 built the compiler as additive, unwired modules (`compileScope`/`resolveScope`/`canAccess` + `defineScopeOperator` registry + the `$participatesViaMeeting`/`$hasNoMeeting` operators), verified against **hand-built** AST nodes. Phase 1 makes `rulesToAST` emit those nodes from real CASL rules (the parser seam), then flips each root's per-request scope source from the hand-written `spec.visibility` path (`resolveEffectiveScope`) to the compiled path (`resolveScope(spec, actor)`) — via each router's own `procedures.ts`, the per-entity seam. The old engine and the four `visibility` fns stay in place (now belt-and-suspenders, equivalence-guaranteed); their deletion + the shared-resolver flip are Phase 5.

**Tech Stack:** `@casl/ability@6.8.0` (+ `@casl/ability/extra` `rulesToAST`), `@ucast/mongo@2.4.3` / `@ucast/core@1.10.2` (transitive, used structurally — never imported), `drizzle-orm` (Postgres/Neon). No test runner (verification = `pnpm tsc && pnpm lint` + manual `EXPLAIN`).

## Global Constraints

- **No test framework exists.** Verify every task with `pnpm tsc && pnpm lint` green **plus** a throwaway `tsx` scratch script (written under the scratchpad, **uncommitted**, deleted after) that prints the compiled SQL / runs `EXPLAIN` and is diffed by hand against the pre-change fragment. Never add vitest/jest/a `test` script. Never `pnpm build`.
- **The entire risk surface is false-ALLOW (leak), not false-deny** (spec §4.1). A conditionless `can('read', X)` compiles to allow-all. Two rules bind every entity task: (1) the compiled condition **REPLACES** the conditionless verb — it never sits beside it (CASL OR-merges; a leftover conditionless rule dominates → allow-all → leak); (2) the ability's rule edit and that entity's `procedures.ts` scope-source flip land in **one** task, so the entity is never in an allow-all window.
- **Per-entity atomic, equivalence-gated.** Before an entity task is marked complete, its compiled predicate must be `EXPLAIN`-equivalent to the pre-change hand-written fragment for **every role that can read it** (agent, dispatcher where applicable, super-admin/omni → allow-all). The dispatcher×Customer case is the ONE intended behavior change (see Task 6) and is gated against the *intended* predicate, not the pre-change one.
- **Do NOT touch `buildUserContext` (`dal/server/lib/helpers.ts`), `isVisible`/`resolveEffectiveScope` (`dal/server/lib/scope.ts`), `resolveVisibilityScope` (`scope-middleware.ts`), or delete any `*Visibility` fn in this phase.** They are shared across all entities incl. un-migrated ones; flipping/deleting them here would compile a still-conditionless entity (e.g. VoipCall) to allow-all. They are Phase 5.
- **`manager` is a FORTHCOMING role** — NOT in `userRoles` (`user|homeowner|agent|super-admin|dispatcher`) nor `abilities.ts`. Do NOT add it. The architecture already supports it (a conditionless `read` → allow-all); no rule to author now.
- **Homeowner is ALWAYS `token`, never `user`** (spec §3). Phase 1 does not construct homeowner actors (no root migrated here is homeowner-reachable via `user`), but never introduce a `userActor` on the homeowner/bearer path.
- **Coding conventions** (CLAUDE.local.md + `memory/coding-conventions.md`): one component/file, no file-level constants in component files, no helper fns in component files, named exports only, `schemas/` sibling of `lib/`. These are backend/pure-module changes — keep helpers in `lib/`, operators in the `scope/operators/` dir.
- **Stay on branch `refactor/285-refactor-permissions-casl-scope-compiler` in worktree `.worktrees/issue-285`.** No PR, no push, no auto-commit beyond the task commits this plan specifies.

---

## File Structure

**Task 1–3 — engine integration (unwired to production still):**
- Create: `src/shared/domains/permissions/scope/conditions-matcher.ts` — `buildScopeConditionsMatcher()`, the custom CASL `conditionsMatcher` that teaches `rulesToAST` the three document operators.
- Modify: `src/shared/domains/permissions/types.ts` — widen `AppAbility` so `can('read','Customer',{ … })` type-checks.
- Modify: `src/shared/domains/permissions/scope/interpret.ts` — route registered custom operators before the compound/field split; add `not` support.
- Modify: `src/shared/domains/permissions/scope/operators/meeting-participation.ts` — register `parseValue`-less document-op instruction shape (no behavior change to `toSql`).
- Create: `src/shared/domains/permissions/scope/operators/derived-pipeline.ts` — the `$inDerivedPipeline` operator.
- Modify: `src/shared/domains/permissions/scope/interpret.ts` import side-effect list — register the new operator module.
- Create: `src/shared/domains/permissions/scope/exhaustiveness.ts` — the startup assert (`assertScopeWiring()`); called once from `abilities.ts` module load (or the entity-registry barrel).

**Task 4 — abilities build:**
- Modify: `src/shared/domains/permissions/abilities.ts` — build the ability with `buildScopeConditionsMatcher()`; this is the switch that makes conditional rules parseable. (No rule edits yet.)

**Tasks 5–8 — per-entity cutovers (one `procedures.ts` + one `abilities.ts` rule-block each):**
- Modify: `src/shared/domains/permissions/abilities.ts` — replace the conditionless `can('read', X)` with the conditional rule(s), per entity.
- Modify: `src/trpc/routers/<entity>.router/procedures.ts` — construct a `userActor` and source `ctx.scope` from `resolveScope(spec, actor)`.
- Task 8 (Project) additionally modifies `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` (delete the `isPublic`/`ownerId` drift branch).

---

## Interfaces (produced in Task 1, consumed by later tasks)

```ts
// scope/conditions-matcher.ts
export function buildScopeConditionsMatcher(): AppAbility['conditionsMatcher']
// A CASL conditionsMatcher (from @casl/ability `buildMongoQueryMatcher`) that
// knows the three document operators AND preserves their leading `$` in the
// emitted AST node's `operator` (so node.operator === the defineScopeOperator name).

// types.ts (widened)
export type AppAbility = MongoAbility<[AppAction, AppSubject], AppConditions>
// where AppConditions permits the custom operator keys as top-level conditions.

// scope/operators/derived-pipeline.ts — registers, via defineScopeOperator:
//   name: '$inDerivedPipeline', toSql(node, ctx) => derivedPipelineWhere(node.value as Pipeline[])!

// scope/exhaustiveness.ts
export function assertScopeWiring(): void
// throws if any operator referenced in any role's rules is not registered.
```

Per-entity rule shapes (authored in Tasks 5–8, all REPLACE the conditionless rule):

```ts
// Customer (Task 6):
//   agent      → can('read','Customer', { $participatesViaMeeting: { via: 'customerId' } })
//   dispatcher → can('read','Customer', { $inDerivedPipeline: ['leads','rehash'] })
// Meeting (Task 7):
//   agent      → can('read','Meeting',  { $participatesViaMeeting: { via: 'self' } })
// Proposal (Task 8a):
//   agent      → can('read','Proposal', { $participatesViaMeeting: { via: 'meetingId' } })
// Project (Task 8b):
//   agent      → can('read','Project',  { $participatesViaMeeting: { via: 'projectId' } })
//   agent      → can('read','Project',  { ownerId: <user.id> })   // OR-merged 2nd rule
```

---

## Task 1: Wire the CASL custom-operator parser + widen `AppAbility` + fix interpreter dispatch

**Why first:** every later rule edit fails to compile (or silently mis-parses) until `rulesToAST` can turn a `{ $participatesViaMeeting: … }` condition into a node the interpreter recognizes. This is the single load-bearing integration unknown (epic "Open risks").

**Files:**
- Create: `src/shared/domains/permissions/scope/conditions-matcher.ts`
- Modify: `src/shared/domains/permissions/types.ts`
- Modify: `src/shared/domains/permissions/scope/interpret.ts`
- Modify: `src/shared/domains/permissions/scope/operators/meeting-participation.ts` (instruction shape only)

**Interfaces:**
- Consumes: `defineScopeOperator`/`getScopeOperator` (`scope/operators.ts`), `rulesToAST` (`@casl/ability/extra`), `buildMongoQueryMatcher` (`@casl/ability`).
- Produces: `buildScopeConditionsMatcher()`; a widened `AppAbility`; an interpreter that dispatches document-level custom operators and handles `not`.

**Key facts (verified against installed packages — do not re-derive):**
- `@casl/ability` **exports** `buildMongoQueryMatcher(fieldInstructions?, interpreters?, options?)` → a `conditionsMatcher`. It merges its args onto the mongo defaults and forwards `options` to ucast's `createFactory`.
- `rulesToAST(ability, action, subject)` builds each rule's node from **`ability.conditionsMatcher(rule.conditions).ast`** — so teaching the matcher the operators is what makes `rulesToAST` emit them.
- ucast's `MongoQueryParser` defaults `operatorToConditionName: e => e.slice(1)` → it **strips the leading `$`**. Pass `operatorToConditionName: (op) => op` in `options` to KEEP the `$`, so the emitted node's `operator` equals the `defineScopeOperator` name (`'$participatesViaMeeting'`), matching Phase 0's registry + EXPLAIN evidence.
- Our operators are **document-level** (whole-row EXISTS, not tied to a column) → register them as `{ type: 'document' }` instructions. A document node has shape `{ operator, value }` with **no `field`** — so Phase 0's `isCompound` (`!('field' in node)`) misclassifies it as compound. The interpreter must check the custom registry FIRST.

- [ ] **Step 1: Widen `AppAbility`'s conditions type**

In `types.ts`, add a conditions type and thread it as `MongoAbility`'s 2nd type param. `MongoAbility<Abilities, Conditions>` — the default `Conditions` is `MongoQuery`, which rejects unknown `$`-operators. Define an open conditions type that permits our operator keys and known columns:

```ts
import type { MongoAbility, MongoQuery } from '@casl/ability'

/** Row conditions our rules use — the three custom document operators plus the
 * scalar column conditions CASL already supports (e.g. { ownerId }). Kept open
 * (`& MongoQuery` union) so existing scalar conditions still type-check. */
export type AppConditions =
  | MongoQuery
  | { $participatesViaMeeting?: { via: 'customerId' | 'meetingId' | 'projectId' | 'self' } }
  | { $hasNoMeeting?: boolean }
  | { $inDerivedPipeline?: readonly ('leads' | 'rehash' | 'fresh' | 'projects' | 'dead')[] }

export type AppAbility = MongoAbility<[AppAction, AppSubject], AppConditions>
```

Run: `pnpm tsc`. Expected: no new errors from `types.ts` (the ability is not yet used with conditions anywhere).

- [ ] **Step 2: Write `buildScopeConditionsMatcher`**

Create `scope/conditions-matcher.ts`:

```ts
import { buildMongoQueryMatcher } from '@casl/ability'

import type { AppAbility } from '@/shared/domains/permissions/types'

import { registeredOperatorNames } from './operators'

import './operators/meeting-participation' // registers $participatesViaMeeting, $hasNoMeeting
import './operators/derived-pipeline' // registers $inDerivedPipeline (Task 2)

/**
 * A CASL conditionsMatcher that teaches `rulesToAST` our document operators.
 * - Each registered scope operator becomes a `{ type: 'document' }` parsing
 *   instruction, so `{ $op: value }` at the top of a rule's conditions parses
 *   to a DocumentCondition whose `value` is the raw payload.
 * - `operatorToConditionName: op => op` KEEPS the leading `$`, so the emitted
 *   node's `operator` equals the `defineScopeOperator` name (interpreter +
 *   registry match on the full `$`-name). Default ucast strips it.
 * We supply NO custom interpreters (2nd arg): on the server the matcher fn is
 * never invoked — only `.ast` is read by rulesToAST. The Client Mirror (toJS)
 * lands later via the same operator registration, not here.
 */
export function buildScopeConditionsMatcher(): AppAbility['conditionsMatcher'] {
  const instructions = Object.fromEntries(
    registeredOperatorNames().map(name => [name, { type: 'document' as const }]),
  )
  return buildMongoQueryMatcher(instructions, {}, { operatorToConditionName: op => op }) as AppAbility['conditionsMatcher']
}
```

If `tsc` rejects the `buildMongoQueryMatcher` arg/return types, cast narrowly at the boundary (the ucast instruction generics are intricate) — a single `as` on the instructions object or the return is acceptable here (documented boundary cast, same posture as `compile-scope.ts`'s `as unknown as ScopeNode`). Do NOT loosen `AppConditions`.

- [ ] **Step 3: Make the interpreter dispatch document-level custom operators first + add `not`**

In `interpret.ts`, change `interpret()` so a registered custom operator is handled regardless of node shape (document nodes have no `field`), and extend `interpretCompound` to support `not`:

```ts
export function interpret(node: ScopeNode, ctx: OperatorCtx): SQL | null {
  // Custom document operators ($participatesViaMeeting, $hasNoMeeting,
  // $inDerivedPipeline) parse to `{ operator, value }` with NO `field`, so
  // isCompound would misfile them. Route by the registry first.
  const custom = getScopeOperator(node.operator)
  if (custom)
    return custom.toSql(node as FieldNode, ctx)
  return isCompound(node) ? interpretCompound(node, ctx) : interpretField(node, ctx)
}
```

`interpretCompound`: replace the throw-on-non-and/or with `not` support. `not` compounds carry a single child (the negated condition):

```ts
function interpretCompound(node: CompoundNode, ctx: OperatorCtx): SQL | null {
  if (node.operator === 'not') {
    const [child] = node.value
    const inner = child ? interpret(child, ctx) : null
    return inner ? not(inner) : sql`false` // not(allow-all) → deny
  }
  if (node.operator !== 'and' && node.operator !== 'or')
    throw new Error(`[scope] unsupported compound operator '${node.operator}'`)
  const parts = node.value.map(c => interpret(c, ctx)).filter((p): p is SQL => p != null)
  if (parts.length === 0)
    return null
  if (parts.length === 1)
    return parts[0]
  return node.operator === 'or' ? or(...parts)! : and(...parts)!
}
```

Add `not` and `sql` to the `drizzle-orm` import; keep `interpretField` unchanged. Note `interpretField` still handles the case where a custom op is looked up there (harmless duplicate guard) — leave it, it is now unreachable for document ops but still correct for any field-attached custom op.

- [ ] **Step 4: Run tsc + lint**

Run: `pnpm tsc && pnpm lint`. Expected: green (0 errors). The matcher/interpreter are still unimported by production (only Task 4 wires the matcher into `abilities.ts`).

- [ ] **Step 5: Scratch-verify the parser emits the right node and SQL**

Write `<scratchpad>/verify-parser.ts` (uncommitted). Build a real agent ability WITH the custom matcher and a conditional Customer rule, run `rulesToAST`, interpret against the customers table, and print SQL:

```ts
import { AbilityBuilder } from '@casl/ability'
import { rulesToAST } from '@casl/ability/extra'
import { createMongoAbility } from '@casl/ability'
import { buildScopeConditionsMatcher } from '@/shared/domains/permissions/scope/conditions-matcher'
import { interpret } from '@/shared/domains/permissions/scope/interpret'
import { customers } from '@/shared/db/schema'
// build ability: can('read','Customer',{ $participatesViaMeeting: { via: 'customerId' } })
// const ast = rulesToAST(ability, 'read', 'Customer')
// const sql = interpret(ast as any, { table: customers, pk: customers.id, actor: userActor('U1', ability) })
// print sql via db.select(...).where(sql).toSQL()
```

Run with `pnpm tsx <scratchpad>/verify-parser.ts`. **Expected:** the AST node has `operator: '$participatesViaMeeting'` (WITH `$`) and the emitted SQL's EXISTS is identical to `userCanSeeCustomer('U1', customers.id)` (compare `.toSQL()` strings — Phase 0 recorded: `exists (select 1 from "meetings" inner join "meeting_participants" on … where ("meetings"."customer_id" = "customers"."id" and "meeting_participants"."user_id" = $1))`). Record the printed SQL in the ledger. Delete the scratch file.

- [ ] **Step 6: Commit**

```bash
git add src/shared/domains/permissions/scope/conditions-matcher.ts \
        src/shared/domains/permissions/types.ts \
        src/shared/domains/permissions/scope/interpret.ts \
        src/shared/domains/permissions/scope/operators/meeting-participation.ts
git commit -m "feat(permissions): wire CASL custom-operator parser into scope engine"
```

---

## Task 2: Add the `$inDerivedPipeline` operator (dispatcher leads+rehash)

**Why:** the canonical dispatcher Customer rule is derived-pipeline membership `['leads','rehash']` (user ruling 2026-08-11), which the existing `$hasNoMeeting` cannot express (rehash HAS a meeting). This operator emits the convention-enforced `derivedPipelineWhere` helper so the "never raw `customers.pipeline`" rule holds.

**Files:**
- Create: `src/shared/domains/permissions/scope/operators/derived-pipeline.ts`
- (Import side-effect already added to `conditions-matcher.ts` in Task 1 Step 2.)

**Interfaces:**
- Consumes: `defineScopeOperator` (`../operators`), `derivedPipelineWhere` (`@/shared/entities/customers/lib/derived-pipeline-sql`), `Pipeline` (`@/shared/constants/enums/pipelines`).
- Produces: a registered `$inDerivedPipeline` operator.

- [ ] **Step 1: Write the operator**

```ts
import type { Pipeline } from '@/shared/constants/enums/pipelines'

import { derivedPipelineWhere } from '@/shared/entities/customers/lib/derived-pipeline-sql'

import { defineScopeOperator } from '../operators'

/**
 * "This customer's DERIVED 5-bucket pipeline ∈ the given set." Canonical
 * dispatcher visibility = ['leads','rehash'] (user ruling 2026-08-11). Emits the
 * convention-enforced `derivedPipelineWhere` (customers/lib/derived-pipeline-sql)
 * — never raw `customers.pipeline`. Correlates on the outer `customers` row, so
 * it only makes sense on the Customer subject (ctx.table === customers).
 * Node value is the Pipeline[] straight from the rule condition.
 */
defineScopeOperator({
  name: '$inDerivedPipeline',
  parseValue: value => value,
  toSql: (node) => {
    const values = node.value as readonly Pipeline[]
    const where = derivedPipelineWhere(values)
    if (!where)
      throw new Error('[scope] $inDerivedPipeline requires a non-empty pipeline set')
    return where
  },
})
```

Note: `derivedPipelineWhere` returns `SQL | undefined` (empty → undefined). The `ScopeOperator.toSql` return type is `SQL`; the empty-set guard throws (an empty dispatcher set is a misconfiguration, fail loud). `derivedPipelineSql` already scopes to the outer `"customers"."id"` literal, so no `ctx.pk` correlation is needed here.

- [ ] **Step 2: Run tsc + lint**

Run: `pnpm tsc && pnpm lint`. Expected: green.

- [ ] **Step 3: Scratch-verify EXPLAIN equivalence to the intended dispatcher predicate**

Write `<scratchpad>/verify-dispatcher.ts` (uncommitted): build a dispatcher ability with `can('read','Customer',{ $inDerivedPipeline: ['leads','rehash'] })`, compile, and print `.toSQL()`. **Expected:** identical to `db.select().from(customers).where(derivedPipelineWhere(['leads','rehash'])!).toSQL()` — an `inArray(CASE … END, ['leads','rehash'])`. Confirm the CASE arms match `derived-pipeline-sql.ts` (rehash/dead passthrough; project→projects; meeting→fresh; else leads). Record SQL in ledger; delete scratch.

- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/permissions/scope/operators/derived-pipeline.ts
git commit -m "feat(permissions): add \$inDerivedPipeline scope operator for dispatcher"
```

---

## Task 3: Startup exhaustiveness assert (spec §11.4)

**Why:** a rule referencing an unregistered operator, or a mistyped operator name, must fail LOUD at load — not silently mis-parse to allow-all. Ship the "every rule-referenced operator is registered" half now (the "every EntityName has a spec" half is Phase 3, where the entity registry lands).

**Files:**
- Create: `src/shared/domains/permissions/scope/exhaustiveness.ts`
- Modify: `src/shared/domains/permissions/abilities.ts` (call it once at module scope — see Task 4; if Task 4 not yet done, call from the bottom of `exhaustiveness.ts`'s own eager check is not possible without abilities — so this task WIRES the call in Task 4).

**Interfaces:**
- Consumes: `registeredOperatorNames` (`./operators`), `defineAbilitiesFor` + `userRoles`.
- Produces: `assertScopeWiring()`.

- [ ] **Step 1: Write the assert**

```ts
import { userRoles } from '@/shared/constants/enums'
import { rulesToAST } from '@casl/ability/extra' // not needed if we inspect rules directly

import { registeredOperatorNames } from './operators'

/**
 * Fail LOUD at startup if any role's rules reference a scope operator that
 * isn't registered (spec §11.4). Walks every role's built ability rules and
 * collects the `$`-prefixed condition keys, asserting each is registered.
 * The "every EntityName has a spec" half lands in Phase 3 with the registry.
 */
export function assertScopeWiring(): void {
  const registered = new Set(registeredOperatorNames())
  const referenced = new Set<string>()
  for (const role of userRoles) {
    const ability = defineAbilitiesFor({ id: '__assert__', role })
    for (const rule of ability.rules) {
      const conditions = rule.conditions as Record<string, unknown> | undefined
      if (!conditions)
        continue
      for (const key of Object.keys(conditions))
        if (key.startsWith('$'))
          referenced.add(key)
    }
  }
  const missing = [...referenced].filter(op => !registered.has(op))
  if (missing.length)
    throw new Error(`[scope] rules reference unregistered operators: ${missing.join(', ')}`)
}
```

`defineAbilitiesFor` is imported from `../abilities` — but `exhaustiveness.ts` is imported BY `abilities.ts`, creating a cycle. Avoid it: have `assertScopeWiring(abilities: AppAbility[])` take the already-built abilities, OR call the assert from `abilities.ts` AFTER `defineAbilitiesFor` is defined, passing a locally-built array. Choose the parameterized form:

```ts
export function assertScopeWiring(abilitiesByRole: AppAbility[]): void { /* same body, iterate arg */ }
```

- [ ] **Step 2: Run tsc + lint**

Run: `pnpm tsc && pnpm lint`. Expected: green. (Wired to production in Task 4.)

- [ ] **Step 3: Commit**

```bash
git add src/shared/domains/permissions/scope/exhaustiveness.ts
git commit -m "feat(permissions): add scope-wiring exhaustiveness assert"
```

---

## Task 4: Build the ability with the custom conditions matcher + run the assert

**Why:** this is the switch that makes conditional rules parseable app-wide. It changes NO rules yet (all still conditionless) → provably zero behavior change, and it lets the assert run at load.

**Files:**
- Modify: `src/shared/domains/permissions/abilities.ts`

**Interfaces:**
- Consumes: `buildScopeConditionsMatcher` (Task 1), `assertScopeWiring` (Task 3).

- [ ] **Step 1: Pass the matcher to `build()`**

In `defineAbilitiesFor`, change `return build()` → `return build({ conditionsMatcher: buildScopeConditionsMatcher() })`. Add the import. The `if (!user) return build()` early-return should also pass the matcher for consistency (harmless — no conditions): `return build({ conditionsMatcher: buildScopeConditionsMatcher() })`.

- [ ] **Step 2: Run the assert once at module load**

At the bottom of `abilities.ts` (module scope), build one ability per role and assert:

```ts
assertScopeWiring(userRoles.map(role => defineAbilitiesFor({ id: '__assert__', role })))
```

This runs once when the module is first imported. With all rules still conditionless, `referenced` is empty → no throw.

- [ ] **Step 3: Run tsc + lint**

Run: `pnpm tsc && pnpm lint`. Expected: green.

- [ ] **Step 4: Scratch-verify no behavior change**

Write `<scratchpad>/verify-conditionless.ts`: build the agent ability, `rulesToAST(ability, 'read', 'Customer')` — with the conditionless rule still in place, expect `buildAnd([])` (empty AND) → `interpret` → `null` (allow-all). Confirm `compileScope(userActor('U1', ability), 'read', 'Customer', ctx)` returns `null`. This proves Task 4 alone changed nothing (Customer still allow-all until Task 6). Record; delete scratch.

- [ ] **Step 5: Commit**

```bash
git add src/shared/domains/permissions/abilities.ts
git commit -m "feat(permissions): build ability with scope conditions matcher + startup assert"
```

---

## Task 5: Add a reusable actor-sourced scope helper for migrated procedures

**Why:** each root's `procedures.ts` will need the same three lines (build `userActor`, call `resolveScope`, handle omni-emergent-null). Extract once so the four cutover tasks are a one-line swap and can't drift — mirroring how `resolveVisibilityScope` is shared today.

**Files:**
- Create: `src/trpc/lib/middleware/resolve-actor-scope.ts`

**Interfaces:**
- Consumes: `resolveScope` (`@/shared/dal/server/lib/resolve-scope`), `userActor` (`@/shared/domains/permissions/scope/actor`), `EntityServerSpec`, `AppAbility`.
- Produces: `resolveActorScope(spec, { userId, ability }) → SQL | null`.

- [ ] **Step 1: Write the helper**

```ts
import type { SQL } from 'drizzle-orm'

import type { EntityServerSpec } from '@/shared/dal/server/types'
import type { AppAbility } from '@/shared/domains/permissions/types'

import { resolveScope } from '@/shared/dal/server/lib/resolve-scope'
import { userActor } from '@/shared/domains/permissions/scope/actor'

/**
 * Compiled scope for a `user` request (spec §4). The COMPILED counterpart to
 * `resolveVisibilityScope` — omni is emergent (super-admin `manage all` → empty
 * AST → null), so there is no `isOmni` pre-check here. Used by MIGRATED roots'
 * procedures.ts only; un-migrated roots keep `resolveVisibilityScope`.
 */
export function resolveActorScope(
  spec: EntityServerSpec,
  auth: { userId: string, ability: AppAbility },
): SQL | null {
  return resolveScope(spec, userActor(auth.userId, auth.ability))
}
```

- [ ] **Step 2: Run tsc + lint**

Run: `pnpm tsc && pnpm lint`. Expected: green (unimported still).

- [ ] **Step 3: Commit**

```bash
git add src/trpc/lib/middleware/resolve-actor-scope.ts
git commit -m "feat(permissions): add resolveActorScope helper for compiled request scope"
```

---

## Task 6: Cut **Customer** over (agent participation + dispatcher leads/rehash)

**⚠️ This task carries the ONE intended behavior change in Phase 1:** the dispatcher rule changes from `leadsPoolVisibility()` (leads only) to `derivedPipelineWhere(['leads','rehash'])` (leads **and** rehash). The equivalence gate for dispatcher compares against this **intended** predicate, not the pre-change one. Agent + omni are strict equivalence.

**Files:**
- Modify: `src/shared/domains/permissions/abilities.ts` (agent + dispatcher `read Customer` rules)
- Modify: `src/trpc/routers/customers.router/procedures.ts` (source `ctx.scope` from `resolveActorScope`)

**Interfaces:**
- Consumes: `resolveActorScope` (Task 5), `customerServerSpec`.

- [ ] **Step 1: Replace the agent + dispatcher Customer rules**

In `abilities.ts`, agent block: `can('read', 'Customer')` → `can('read', 'Customer', { $participatesViaMeeting: { via: 'customerId' } })`. Leave `can('update','Customer',['age'])` untouched (field grant, not row scope).

Dispatcher block: `can('read', 'Customer')` → `can('read', 'Customer', { $inDerivedPipeline: ['leads', 'rehash'] })`. Leave `can('read','LeadsPool')` and the field-scoped `can('update','Customer',[…])` untouched — `LeadsPool` still drives phone-ungate + pipeline-set (deferred Field-Mask spec); this task only migrates row-visibility.

Confirm NO other `can('read','Customer')` remains in either block (grep the file) — a leftover conditionless rule OR-merges to allow-all.

- [ ] **Step 2: Flip `customerProcedure` to the compiled path**

In `customers.router/procedures.ts`, swap the scope source:

```ts
import { resolveActorScope } from '../../lib/middleware/resolve-actor-scope'
// ...
export const customerProcedure = agentProcedure.use(async ({ ctx, next }) => {
  const scope = resolveActorScope(customerServerSpec, { userId: ctx.session.user.id, ability: ctx.ability })
  return next({ ctx: { ...ctx, scope } })
})
```

Remove the now-unused `resolveVisibilityScope` import from this file only. `ctx.scope` stays the transport — every downstream customer DAL/list consumer is untouched.

- [ ] **Step 3: Run tsc + lint**

Run: `pnpm tsc && pnpm lint`. Expected: green. If `can('read','Customer',{ … })` errors `TS2769`, the `AppConditions` widening (Task 1 Step 1) is incomplete — fix there, not with a cast at the call site.

- [ ] **Step 4: Equivalence gate — agent, dispatcher, omni**

Write `<scratchpad>/gate-customer.ts` (uncommitted). For each role build the ability, `resolveScope(customerServerSpec, userActor(uid, ability))`, print `.toSQL()`:
- **agent** → must equal `userCanSeeCustomer(uid, customers.id)` (the pre-change `customerVisibility` non-leads branch). Compare `.toSQL()` strings verbatim.
- **dispatcher** → must equal `derivedPipelineWhere(['leads','rehash'])!` (the INTENDED predicate). Note the delta vs pre-change `leadsPoolVisibility()`: pre-change = `pipeline='active' AND NOT EXISTS(meeting)` (leads only); new = leads ∪ rehash. Record BOTH so the review sees the intended widening.
- **super-admin** → `resolveScope` returns `null` (omni, allow-all). Assert `=== null`.
Record all four SQL strings + the intended-delta note in the ledger. Delete scratch.

- [ ] **Step 5: Commit**

```bash
git add src/shared/domains/permissions/abilities.ts src/trpc/routers/customers.router/procedures.ts
git commit -m "refactor(permissions): compile Customer row-visibility from CASL rules (adds dispatcher rehash)"
```

---

## Task 7: Cut **Meeting** over (agent + dispatcher participation via self) + Task-6 dispatcher tweak

**Fork RESOLVED (user ruling 2026-08-12):** the dispatcher's intended leads+rehash Meeting visibility
depends on the customer pipeline derivation, which is DEFERRED (see memory
`project-pipelines-domain-rethink`). Interim = **clean leads-only / participation, behavior-preserving**:
- **Task 6 dispatcher Customer** rule is tweaked here: `$inDerivedPipeline: ['leads','rehash']` →
  `$inDerivedPipeline: ['leads']` (drops the latent, currently-non-functional rehash half).
- **Dispatcher Meeting** = participation `{ via: 'self' }`, identical to the agent rule — exactly today's
  behavior (`meetingVisibility` ignores role). The leads+rehash upgrade lands later with the pipeline domain.

**Files:**
- Modify: `src/shared/domains/permissions/abilities.ts` (agent + dispatcher `read Meeting`; dispatcher `read Customer` tweak)
- Modify: `src/trpc/routers/meetings.router/procedures.ts`

**Interfaces:** Consumes `resolveActorScope`, `meetingServerSpec`.

- [ ] **Step 0: Tweak Task-6 dispatcher Customer rule (commit 1)**

In `abilities.ts` dispatcher block: `can('read', 'Customer', { $inDerivedPipeline: ['leads', 'rehash'] })` →
`can('read', 'Customer', { $inDerivedPipeline: ['leads'] })`. Re-gate: dispatcher Customer `resolveScope`
`.toSQL()` must equal `derivedPipelineWhere(['leads'])` (leads bucket = today's leadsPoolVisibility behavior).
Commit ONLY `abilities.ts` for this: `refactor(permissions): hold dispatcher Customer visibility at leads-only (defer rehash to pipeline domain)`.

- [ ] **Step 1: Replace the agent AND dispatcher Meeting rules (commit 2 with Steps 2-5)**

Agent block: `can('read', 'Meeting')` → `can('read', 'Meeting', { $participatesViaMeeting: { via: 'self' } })`.
Dispatcher block: `can('read', 'Meeting')` → `can('read', 'Meeting', { $participatesViaMeeting: { via: 'self' } })`
(same participation rule — interim, preserves today's behavior). Leave `can('create'|'update'|'own','Meeting')`
untouched (verbs, not row scope). Grep to confirm NO conditionless `can('read','Meeting')` remains in either block.

- [ ] **Step 2: Flip the meetings procedure(s)**

In `meetings.router/procedures.ts`, swap `resolveVisibilityScope(meetingServerSpec, …)` → `resolveActorScope(meetingServerSpec, …)` for the meeting-scoped procedure. Read the file first — if it defines multiple procedures, flip only the one(s) keyed on `meetingServerSpec`.

- [ ] **Step 3: Run tsc + lint** → green.

- [ ] **Step 4: Equivalence gate — agent, dispatcher, omni**

`<scratchpad>/gate-meeting.ts`: BOTH agent and dispatcher `resolveScope(meetingServerSpec, …)` must equal
`meetingVisibility({ userId })` = `userParticipatesInMeeting(uid, meetings.id)` (byte-verbatim `.toSQL()` — the
`via:'self'` operator emits `select "meeting_participants"."id"` matching the pre-change fn after the Task-6
engine-projection fix). omni → null. Record; delete.

- [ ] **Step 5: Commit (commit 2)**

```bash
git add src/shared/domains/permissions/abilities.ts src/trpc/routers/meetings.router/procedures.ts
git commit -m "refactor(permissions): compile Meeting row-visibility from CASL rules (agent + dispatcher participation)"
```

---

## Task 8: Cut **Proposal** over (agent participation via meetingId)

**Files:**
- Modify: `src/shared/domains/permissions/abilities.ts` (agent `read Proposal`)
- Modify: `src/trpc/routers/proposals.router/procedures.ts`

**Interfaces:** Consumes `resolveActorScope`, `proposalServerSpec`.

**⚠️ Homeowner note:** homeowner has a conditionless `can('read','Proposal')` (`abilities.ts:200`) but is served via the **token** path (never `user`), so its conditionless rule NEVER compiles to allow-all through `resolveScope` (a `token` actor short-circuits in `compileScope` before `rulesToAST`). Do NOT add a condition to the homeowner Proposal rule and do NOT route homeowner through `resolveActorScope`. Only the **agent** Proposal rule is migrated here. Verify `proposals.router/procedures.ts` uses an agent-guarded procedure for the migrated path.

- [ ] **Step 1: Replace the agent Proposal rule**

Agent block: `can('read', 'Proposal')` → `can('read', 'Proposal', { $participatesViaMeeting: { via: 'meetingId' } })`. This emits `EXISTS(… meeting_participants.meeting_id = proposals.meeting_id …)` correlating on the subject's OWN fk (spec §4.2 `meetingId` topology). Leave homeowner's conditionless `read Proposal` alone (token-served).

- [ ] **Step 2: Flip the proposals procedure(s)**

Read `proposals.router/procedures.ts`; swap the agent-scoped proposal procedure's `resolveVisibilityScope(proposalServerSpec, …)` → `resolveActorScope(proposalServerSpec, …)`. Leave any token/homeowner procedure untouched.

- [ ] **Step 3: Run tsc + lint** → green.

- [ ] **Step 4: Equivalence gate — agent, omni**

`<scratchpad>/gate-proposal.ts`: agent `resolveScope(proposalServerSpec, …)` must equal `proposalVisibility({ userId })` = `userParticipatesInMeeting(uid, proposals.meetingId)`. Confirm the emitted correlation is on `proposals.meeting_id` (NOT `ctx.pk`) — spec §4.2 honesty note. omni → null. Record; delete.

- [ ] **Step 5: Commit**

```bash
git add src/shared/domains/permissions/abilities.ts src/trpc/routers/proposals.router/procedures.ts
git commit -m "refactor(permissions): compile Proposal row-visibility from CASL rules"
```

---

## Task 9: Cut **Project** over (participation OR ownerId=me) + drop `isPublic` drift

**Ruling (user 2026-08-11):** Project row-security = `participation OR ownerId=me`. `isPublic` is **dropped** from authz — it stays a display/public-query filter only. The live drift at `get-customer-pipeline-items.ts` (`ownerId=me OR isPublic=true OR participation`) is deleted and re-expressed as two OR'd CASL rules. (This folds Phase 2 into Phase 1 per the epic.)

**Files:**
- Modify: `src/shared/domains/permissions/abilities.ts` (agent `read Project` — two rules)
- Modify: `src/trpc/routers/projects.router/procedures.ts`
- Modify: `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` (delete the drift branch)

**Interfaces:** Consumes `resolveActorScope`, `projectServerSpec`.

**Prerequisite read:** before editing, read `get-customer-pipeline-items.ts` around the `isPublic`/`ownerId`/participation branch (grep `isPublic` + `userParticipatesInMeeting` in that file) and `projects.router/crud.router.ts:56` (a **display** filter — public/draft toggle — that must be LEFT ALONE). Confirm which branch is row-security vs display before deleting anything. If the file's structure differs from "one OR'd predicate," STOP and reconcile before proceeding.

- [ ] **Step 1: Replace the agent Project rule with two OR'd rules**

Agent block: `can('read', 'Project')` → two rules:
```ts
can('read', 'Project', { $participatesViaMeeting: { via: 'projectId' } })
can('read', 'Project', { ownerId: user.id })
```
CASL OR-merges same-subject `can` rules → `participation OR ownerId=me`. `ownerId` is a scalar column condition (standard `eq`, no custom operator). Confirm `projects.ownerId` is the correct column name (read the schema). NO `isPublic` rule.

- [ ] **Step 2: Delete the drift branch in `get-customer-pipeline-items.ts`**

Replace the hand-written `ownerId=me OR isPublic=true OR participation` project predicate with the participation-or-owner predicate (or, better, route it through the compiled scope if the surrounding query already threads an actor/ability — read the file to decide). At minimum, DELETE the `isPublic=true` disjunct so the pipeline view no longer grants non-participating public projects. Keep `hasAssociatedMeeting()` (pure-portfolio exclusion) if present — that is a separate real-project filter, not authz.

- [ ] **Step 3: Flip the projects procedure(s)**

In `projects.router/procedures.ts`, swap the project-scoped procedure's `resolveVisibilityScope(projectServerSpec, …)` → `resolveActorScope(projectServerSpec, …)`.

- [ ] **Step 4: Run tsc + lint** → green.

- [ ] **Step 5: Equivalence gate — agent, omni + drift-removal check**

`<scratchpad>/gate-project.ts`: agent `resolveScope(projectServerSpec, …)` must equal `or(projectParticipationScope(uid), eq(projects.ownerId, uid))`. Note the **intended** delta vs the pre-change pipeline-view drift: the compiled predicate DROPS `isPublic=true` (non-participating public projects no longer visible to a non-owner agent in the pipeline view). Record the compiled SQL + the intended-drop note. omni → null. Delete scratch.

- [ ] **Step 6: Commit**

```bash
git add src/shared/domains/permissions/abilities.ts \
        src/trpc/routers/projects.router/procedures.ts \
        src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts
git commit -m "refactor(permissions): compile Project row-visibility; drop isPublic authz drift"
```

---

## Task 10: Phase-1 close-out verification

**Why:** confirm the four roots are all on the compiled path, no conditionless `read` rule lingers beside a conditional one, and the assert is live.

**Files:** none (verification only) — unless a gap is found.

- [ ] **Step 1: Grep for leftover conditionless root read rules**

`grep -n "can('read', 'Customer')\|can('read', 'Meeting')\|can('read', 'Proposal')\|can('read', 'Project')" src/shared/domains/permissions/abilities.ts` — the ONLY conditionless matches allowed are: homeowner `read Proposal` (token-served, documented), and any dispatcher/role read whose fork the user explicitly deferred (Task 7 Meeting). Every agent root read must now carry a condition. Record the grep output.

- [ ] **Step 2: Confirm each migrated `procedures.ts` uses `resolveActorScope`, un-migrated ones still use `resolveVisibilityScope`**

`grep -rn "resolveActorScope\|resolveVisibilityScope" src/trpc/routers` — expect the four roots on `resolveActorScope`, all other entities (applications, voip, etc.) still on `resolveVisibilityScope`. Record.

- [ ] **Step 3: Full green**

Run: `pnpm tsc && pnpm lint`. Expected: 0 errors, 0 warnings. Record in ledger.

- [ ] **Step 4: Update the epic tracker + docs**

Check the Phase 1 box in `docs/plans/2026-08-10-casl-scope-compiler-epic.md`, fill its **Plan:** pointer to this file, and note the two `⚠️` doc corrections this plan surfaced:
1. `buildMongoQueryMatcher` IS a `@casl/ability@6.8.0` export (epic `:49`,`:92` + memory said it wasn't).
2. The `$`-strip reconciliation (`operatorToConditionName: op => op`) — record so Phase 3+ operators follow it.
Also correct `memory/project-permissions-casl-compiler.md:33` (the `buildMongoQueryMatcher`-not-exported claim) and note the visibility-fn-deletion deferral to Phase 5. **Do not** delete any `visibility` fn or touch `buildUserContext`/`isVisible` — that's Phase 5.

- [ ] **Step 5: Commit the doc updates**

```bash
git add docs/plans/2026-08-10-casl-scope-compiler-epic.md docs/superpowers/plans/2026-08-11-casl-phase-1-per-entity-cutover.md
git commit -m "docs(permissions): mark Phase 1 complete; correct buildMongoQueryMatcher export note"
```

---

## Self-Review

**Spec coverage:**
- Parser wiring (epic carry-forward #1, spec §4.2) → Task 1. `AppAbility` conditions widening (carry-forward) → Task 1 Step 1. `not` support (carry-forward #2) → Task 1 Step 3.
- `$inDerivedPipeline` (dispatcher ruling B) → Task 2; consumed Task 6.
- Exhaustiveness assert (spec §11.4) → Task 3, wired Task 4.
- Per-entity atomic cutover Customer→Meeting→Proposal→Project (spec §7 Phase 1) → Tasks 6–9, each equivalence-gated.
- Project drift / `isPublic` drop (Fork C, ruling C, epic Phase 2 folded in) → Task 9.
- Homeowner-token invariant (spec §3) → Task 8 note (not violated; no homeowner actor built).
- Manager forthcoming → honored by construction (conditionless → allow-all); no rule authored.

**Deliberate deferrals (NOT gaps):** visibility-fn deletion + `buildUserContext`/`isVisible`/`resolveVisibilityScope` flip + `SYSTEM_CONTEXT`/omni-collapse removal → Phase 5 (shared across un-migrated entities; flipping now leaks). `canAccess`/point-probe vuln fixes → Phase 4. Owned-children `parent` cutover → Phase 3. Dispatcher Meeting fork → flagged in Task 7 Step 1 as a STOP-and-ask (un-ruled).

**Placeholder scan:** every code step carries real code or a real grep/command. The two "read the file first" steps (Task 7 Step 2, Task 9 prerequisite) are genuine structural unknowns in router/feature files not fully read at plan time — each says explicitly what to look for and when to STOP.

**Type consistency:** `AppConditions` operator keys (`$participatesViaMeeting`/`$hasNoMeeting`/`$inDerivedPipeline`) match the `defineScopeOperator` names (with `$`) and the registry lookup in `interpret()` (preserved via `operatorToConditionName: op => op`). `resolveActorScope(spec, {userId, ability})` signature matches `resolveVisibilityScope`'s so the procedures.ts swap is drop-in. `ScopeOperator.toSql` returns `SQL`; `$inDerivedPipeline` throws on the empty set rather than returning `undefined`.
