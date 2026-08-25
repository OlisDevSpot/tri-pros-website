# CASL Scope Compiler — Phase 0: Engine + `Actor` Scaffolding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the CASL→SQL scope compiler and its neighbours (`Actor`, operator registry, interpreter, `compileScope`, `resolveScope`, `canAccess`) as **additive, unwired** modules — nothing in production imports them, so behavior change is provably zero.

**Architecture:** A pure CASL→SQL layer lives in `src/shared/domains/permissions/scope/` (`Actor`, operator registry, AST interpreter, `compileScope`); the spec-aware resolution layer (`resolveScope`, `verbOnly`, `canAccess`) lives in `src/shared/dal/server/lib/` next to the existing `scope.ts` it will eventually replace. The compiler turns `rulesToAST(ability, action, subject)` (from `@casl/ability/extra`) into a Drizzle `SQL` fragment by hand-walking the ucast AST. Custom cross-table operators (`$participatesViaMeeting`, `$hasNoMeeting`) register their SQL emitters once via `defineScopeOperator`.

**Tech Stack:** TypeScript, `@casl/ability@6.8.0` (+ `/extra` for `rulesToAST`), `drizzle-orm@0.45`, pnpm. No test runner (see Global Constraints).

**Canonical design:** `docs/superpowers/specs/2026-08-10-casl-scope-compiler-design.md` §3–§6, §11. **Epic tracker:** `docs/plans/2026-08-10-casl-scope-compiler-epic.md`.

## Global Constraints

- **Package manager: pnpm.** Path alias `@/` → `src/`.
- **No test runner exists.** Verify every task with `pnpm tsc && pnpm lint` (both must be green) plus, where noted, manual `EXPLAIN`/SQL inspection via an **uncommitted scratch `tsx` script** in the scratchpad. Do **not** add vitest/jest or a committed test/verification script (user ruling). **Never run `pnpm build`.**
- **Phase 0 wires NOTHING into production.** No file outside the new module dir (+ its scratch verifier) may import the new code. The old `visibility` fns + `resolveEffectiveScope` still drive every query. Zero behavior change is an acceptance criterion, verified by `git grep`.
- **Do NOT modify** `src/shared/dal/server/types.ts` (`EntityServerSpec` already carries every field this phase reads: `entityName`, `caslSubject`, `table`, `primaryKey?`, `parent?{spec, fk}`, `visibility?`), `abilities.ts`, or any existing `visibility` fn. Those are Phase 1+.
- **Do NOT import `@ucast/core` / `@ucast/mongo2js`** — they are transitive deps of `@casl/ability`, not direct dependencies, and are not hoisted to the repo root (verified: only under `.pnpm`). Walk the AST by **structural inspection** of `operator`/`field`/`value`, as CASL's own `ruleToSequelize` guide does. This keeps the dependency surface at exactly `@casl/ability`.
- **The custom-operator CASL *parser* wiring is Phase 1, not Phase 0.** In Phase 0 no rule carries a custom condition, so `rulesToAST` never emits a custom node. Phase 0 registers only the **emit** side (`toSql`); the `parseValue` field is stored for Phase 1 but not wired into `createMongoAbility`. The interpreter is verified against **hand-built** custom nodes (Task 8).
- **Staging:** stage explicitly by path (`git add <path>`), never `git add -A`. Do not push. Do not auto-commit beyond the per-task commits below.
- **Lint note:** the operator registry is a module-level `Map` singleton. If the repo's "no file-level constants" lint rule flags it, follow the existing escape used elsewhere in `src/shared` (module-scoped singletons are used in the DAL); the `pnpm lint` gate is authoritative — resolve to green before committing.

---

### Task 1: The `Actor` seam

**Files:**
- Create: `src/shared/domains/permissions/scope/actor.ts`

**Interfaces:**
- Produces: `type Actor = { kind:'user'; userId:string; ability:AppAbility } | { kind:'token'; scope:SQL; subject:AppSubject } | { kind:'system'; reason:string }`; constructors `userActor(userId, ability): Actor`, `tokenActor(scope, subject): Actor`, `systemActor(reason): Actor`.

- [ ] **Step 1: Write `actor.ts`**

```ts
import type { SQL } from 'drizzle-orm'

import type { AppAbility, AppSubject } from '@/shared/domains/permissions/types'

/**
 * Who is acting and how far their authority reaches. Replaces the ambient
 * `ScopedContext.scope: SQL | null` (spec §3), making "verb-checked but
 * row-unscoped" unrepresentable by accident.
 * - `user`   → role-based reach; scope is COMPILED from the ability's rules.
 * - `token`  → bearer (homeowner); reach is exactly its shared row(s), never null.
 * - `system` → the ONLY unrestricted actor, and it must say why (greppable/audited).
 */
export type Actor
  = | { kind: 'user', userId: string, ability: AppAbility }
    | { kind: 'token', scope: SQL, subject: AppSubject }
    | { kind: 'system', reason: string }

export function userActor(userId: string, ability: AppAbility): Actor {
  return { kind: 'user', userId, ability }
}

export function tokenActor(scope: SQL, subject: AppSubject): Actor {
  return { kind: 'token', scope, subject }
}

export function systemActor(reason: string): Actor {
  return { kind: 'system', reason }
}
```

- [ ] **Step 2: Verify green**

Run: `pnpm tsc && pnpm lint`
Expected: no errors introduced by `actor.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/shared/domains/permissions/scope/actor.ts
git commit -m "feat(permissions): add Actor seam (scope compiler phase 0)"
```

---

### Task 2: AST structural types + guards

**Files:**
- Create: `src/shared/domains/permissions/scope/ast.ts`

**Interfaces:**
- Produces: `interface CompoundNode { operator: string; value: ScopeNode[] }`, `interface FieldNode { operator: string; field: string; value: unknown }`, `type ScopeNode = CompoundNode | FieldNode`, `isCompound(node): node is CompoundNode`.

- [ ] **Step 1: Write `ast.ts`**

```ts
// Minimal structural view of the ucast AST that `rulesToAST` returns.
// We deliberately do NOT import @ucast/core (a transitive dep of @casl/ability,
// not a direct dependency, not hoisted): CASL's own ruleToSequelize guide walks
// the AST by structural inspection of `operator`/`field`/`value`. Node shapes
// verified against @ucast/core@1.10.2 Condition.d.ts:
//   CompoundCondition: { operator: 'and'|'or'; value: Condition[] }
//   FieldCondition:    { operator: string; field: string; value: unknown }

/** A compound node (`and` / `or`) whose `value` is its child conditions. */
export interface CompoundNode { operator: string, value: ScopeNode[] }

/** A field/leaf node — a standard operator (`eq`, `in`) or a custom one. */
export interface FieldNode { operator: string, field: string, value: unknown }

export type ScopeNode = CompoundNode | FieldNode

/** A node is compound iff it has no `field` (its `value` is a child array). */
export function isCompound(node: ScopeNode): node is CompoundNode {
  return !('field' in node)
}
```

- [ ] **Step 2: Verify green** — `pnpm tsc && pnpm lint`

- [ ] **Step 3: Commit**

```bash
git add src/shared/domains/permissions/scope/ast.ts
git commit -m "feat(permissions): add scope AST structural types (phase 0)"
```

---

### Task 3: The operator registry (`defineScopeOperator`)

**Files:**
- Create: `src/shared/domains/permissions/scope/operators.ts`

**Interfaces:**
- Consumes: `Actor` (Task 1), `FieldNode` (Task 2).
- Produces: `interface OperatorCtx { table: PgTable; pk: PgColumn; actor: Actor }`; `interface ScopeOperator { name: string; parseValue?: (v: unknown) => unknown; toSql: (node: FieldNode, ctx: OperatorCtx) => SQL; toJS?: (node: FieldNode, viewer: Actor) => boolean }`; `defineScopeOperator(op: ScopeOperator): void`; `getScopeOperator(name: string): ScopeOperator | undefined`; `registeredOperatorNames(): string[]`.

- [ ] **Step 1: Write `operators.ts`**

```ts
import type { SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'

import type { Actor } from './actor'
import type { FieldNode } from './ast'

/**
 * The interpreter threads this to every custom operator: the OUTER subject
 * table/pk being compiled (built by `resolveScope` from the spec in hand — NOT
 * a subject registry, spec §2 "ctx sourcing") plus the acting principal.
 */
export interface OperatorCtx { table: PgTable, pk: PgColumn, actor: Actor }

/**
 * A custom cross-table authorization operator, registered ONCE (spec §4.2).
 * - `toSql`      — emit the correlated SQL in the interpreter (Phase 0).
 * - `parseValue` — condition value → AST node payload; consumed by the CASL
 *   parser seam in **Phase 1** (stored, not wired, here).
 * - `toJS`       — client mirror matcher; added when the Client Mirror lands.
 */
export interface ScopeOperator {
  name: string
  parseValue?: (value: unknown) => unknown
  toSql: (node: FieldNode, ctx: OperatorCtx) => SQL
  toJS?: (node: FieldNode, viewer: Actor) => boolean
}

const REGISTRY = new Map<string, ScopeOperator>()

/** Register a custom operator into all sinks. Throws on duplicate name. */
export function defineScopeOperator(op: ScopeOperator): void {
  if (REGISTRY.has(op.name)) {
    throw new Error(`[scope] operator '${op.name}' is already registered`)
  }
  REGISTRY.set(op.name, op)
}

export function getScopeOperator(name: string): ScopeOperator | undefined {
  return REGISTRY.get(name)
}

/** All registered operator names — used by the Phase-1 exhaustiveness check. */
export function registeredOperatorNames(): string[] {
  return [...REGISTRY.keys()]
}
```

- [ ] **Step 2: Verify green** — `pnpm tsc && pnpm lint`

- [ ] **Step 3: Commit**

```bash
git add src/shared/domains/permissions/scope/operators.ts
git commit -m "feat(permissions): add scope operator registry (phase 0)"
```

---

### Task 4: The domain operators (`$participatesViaMeeting`, `$hasNoMeeting`)

**Files:**
- Create: `src/shared/domains/permissions/scope/operators/meeting-participation.ts`

**Interfaces:**
- Consumes: `defineScopeOperator`, `OperatorCtx` (Task 3).
- Produces: side-effecting registration of `$participatesViaMeeting` (four `via` topologies) and `$hasNoMeeting`. This file is **the only place `meetings`/`meeting_participants` are named for authz** (spec §4.2). The registration side-effect fires when this module is first imported (Task 5's interpreter import chain, and Task 8's verifier, import it).

- [ ] **Step 1: Write `meeting-participation.ts`**

```ts
import { and, eq, exists, not, sql } from 'drizzle-orm'

import { db } from '@/shared/db'
import { meetingParticipants, meetings, proposals } from '@/shared/db/schema'

import { defineScopeOperator } from '../operators'

type ParticipationVia = 'customerId' | 'meetingId' | 'projectId' | 'self'

/**
 * "The acting user participates in a meeting reachable from this row."
 * ONE named atom, but three distinct join topologies (spec §4.2) — the operator
 * body switches on `via`. Correlates to the outer subject via `ctx.pk`, except
 * `meetingId` (Proposal), which correlates on the subject's own FK column
 * `proposals.meeting_id`.
 */
defineScopeOperator({
  name: '$participatesViaMeeting',
  parseValue: value => value, // { via } — consumed by the CASL parser seam in Phase 1
  toSql: (node, ctx) => {
    if (ctx.actor.kind !== 'user') {
      // Custom operators only appear on `user` (role) rules; token/system never
      // reach the interpreter (compileScope short-circuits them).
      throw new Error(`[scope] $participatesViaMeeting reached with actor.kind='${ctx.actor.kind}'`)
    }
    const userId = ctx.actor.userId
    const { via } = (node.value ?? {}) as { via: ParticipationVia }

    switch (via) {
      case 'self': // Meeting subject: participants directly on the outer meeting row.
        return exists(
          db.select({ x: sql`1` }).from(meetingParticipants)
            .where(and(eq(meetingParticipants.meetingId, ctx.pk), eq(meetingParticipants.userId, userId))),
        )
      case 'customerId': // Customer subject: meetings.customer_id = customers.id.
        return exists(
          db.select({ x: sql`1` }).from(meetings)
            .innerJoin(meetingParticipants, eq(meetingParticipants.meetingId, meetings.id))
            .where(and(eq(meetings.customerId, ctx.pk), eq(meetingParticipants.userId, userId))),
        )
      case 'projectId': // Project subject: meetings.project_id = projects.id.
        return exists(
          db.select({ x: sql`1` }).from(meetings)
            .innerJoin(meetingParticipants, eq(meetingParticipants.meetingId, meetings.id))
            .where(and(eq(meetings.projectId, ctx.pk), eq(meetingParticipants.userId, userId))),
        )
      case 'meetingId': // Proposal subject: correlate on the subject's OWN fk column.
        return exists(
          db.select({ x: sql`1` }).from(meetingParticipants)
            .where(and(eq(meetingParticipants.meetingId, proposals.meetingId), eq(meetingParticipants.userId, userId))),
        )
      default:
        throw new Error(`[scope] $participatesViaMeeting: unknown via '${String(via)}'`)
    }
  },
})

/**
 * "This customer has no meeting yet" — the unclaimed-leads-pool predicate
 * (spec §4.3; mirrors `leadsPoolVisibility()` at
 * customers/dal/server/visibility.ts:22). Correlates on `ctx.pk` = customers.id.
 */
defineScopeOperator({
  name: '$hasNoMeeting',
  toSql: (_node, ctx) =>
    not(exists(db.select({ x: sql`1` }).from(meetings).where(eq(meetings.customerId, ctx.pk)))),
})
```

- [ ] **Step 2: Verify green** — `pnpm tsc && pnpm lint`

Note: confirm `meetings.customerId`, `meetings.projectId`, `meetingParticipants.meetingId`, `meetingParticipants.userId`, `proposals.meetingId` resolve (they are used verbatim in existing `visibility.ts` files). If `not`/`exists` import names differ in this drizzle version, the type-check catches it; both are standard `drizzle-orm` exports.

- [ ] **Step 3: Commit**

```bash
git add src/shared/domains/permissions/scope/operators/meeting-participation.ts
git commit -m "feat(permissions): add meeting-participation scope operators (phase 0)"
```

---

### Task 5: The interpreter (hand-walk AST → SQL)

**Files:**
- Create: `src/shared/domains/permissions/scope/interpret.ts`

**Interfaces:**
- Consumes: `ScopeNode`/`CompoundNode`/`FieldNode`/`isCompound` (Task 2), `OperatorCtx`/`getScopeOperator` (Task 3). Imports `./operators/meeting-participation` for its registration side-effect.
- Produces: `interpret(node: ScopeNode, ctx: OperatorCtx): SQL | null` — returns `null` for an empty AND (unconditional allow).

- [ ] **Step 1: Write `interpret.ts`**

```ts
import type { SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'

import type { CompoundNode, FieldNode, ScopeNode } from './ast'
import type { OperatorCtx } from './operators'

import { and, eq, inArray, or } from 'drizzle-orm'

import { isCompound } from './ast'
import { getScopeOperator } from './operators'

import './operators/meeting-participation' // registers the domain operators

/**
 * Hand-walk the ucast AST → Drizzle SQL (spec §4). Standard field/compound
 * operators are handled inline; any other operator is a registered custom one.
 * Returns `null` for an empty AND (`buildAnd([])` = unconditional allow), which
 * the caller maps to "no WHERE".
 */
export function interpret(node: ScopeNode, ctx: OperatorCtx): SQL | null {
  return isCompound(node) ? interpretCompound(node, ctx) : interpretField(node, ctx)
}

function interpretCompound(node: CompoundNode, ctx: OperatorCtx): SQL | null {
  const parts = node.value
    .map(child => interpret(child, ctx))
    .filter((p): p is SQL => p != null)
  if (parts.length === 0)
    return null // empty AND → unconditional allow
  if (parts.length === 1)
    return parts[0]
  return node.operator === 'or' ? or(...parts)! : and(...parts)!
}

function interpretField(node: FieldNode, ctx: OperatorCtx): SQL {
  const custom = getScopeOperator(node.operator)
  if (custom)
    return custom.toSql(node, ctx)

  const column = columnOf(ctx, node.field)
  switch (node.operator) {
    case 'eq':
      return eq(column, node.value as never)
    case 'in':
      return inArray(column, node.value as never[])
    default:
      throw new Error(`[scope] unsupported field operator '${node.operator}' on '${node.field}'`)
  }
}

/** Look up a column on the subject table by name (same pattern as pkColumn). */
function columnOf(ctx: OperatorCtx, field: string): PgColumn {
  const col = (ctx.table as unknown as Record<string, PgColumn | undefined>)[field]
  if (!col)
    throw new Error(`[scope] '${field}' is not a column on the subject table`)
  return col
}
```

Note: Phase 0 supports the standard operators the four core roles need — `eq`, `in`, `and`, `or`. Additional standard operators (`ne`, `gt`, …) are added when a real rule needs one (YAGNI); the `default` throw makes an unsupported operator loud, not silent.

- [ ] **Step 2: Verify green** — `pnpm tsc && pnpm lint`

- [ ] **Step 3: Commit**

```bash
git add src/shared/domains/permissions/scope/interpret.ts
git commit -m "feat(permissions): add scope AST interpreter (phase 0)"
```

---

### Task 6: `compileScope` (the deep module)

**Files:**
- Create: `src/shared/domains/permissions/scope/compile-scope.ts`

**Interfaces:**
- Consumes: `Actor` (Task 1), `ScopeNode` (Task 2), `OperatorCtx` (Task 3), `interpret` (Task 5), `rulesToAST` (`@casl/ability/extra`), `AppAction`/`AppSubject`.
- Produces: `compileScope(actor: Actor, action: AppAction, subject: AppSubject, ctx: OperatorCtx): SQL | null`.

- [ ] **Step 1: Write `compile-scope.ts`**

```ts
import type { SQL } from 'drizzle-orm'

import type { AppAction, AppSubject } from '@/shared/domains/permissions/types'

import type { Actor } from './actor'
import type { ScopeNode } from './ast'
import type { OperatorCtx } from './operators'

import { rulesToAST } from '@casl/ability/extra'
import { sql } from 'drizzle-orm'

import { interpret } from './interpret'

/**
 * Compile an (actor, action, subject) triple into a WHERE fragment (spec §4).
 * Sentinel semantics VERIFIED against @casl/ability@6.8.0 (spec §4.1):
 *   - null       → no constraint (allow-all): system, or a conditionless/omni user rule
 *   - sql`false` → DENY-ALL: the role has NO rule for this subject
 *   - SQL        → the compiled predicate
 * The DAL's `and(eq(pk,id), scope ?? undefined)` then fails SAFE on deny.
 */
export function compileScope(actor: Actor, action: AppAction, subject: AppSubject, ctx: OperatorCtx): SQL | null {
  if (actor.kind === 'system')
    return null // trusted → no constraint
  if (actor.kind === 'token')
    return actor.scope // bearer → exactly its shared row(s)

  const ast = rulesToAST(actor.ability, action, subject)
  if (ast === null)
    return sql`false` // DENY-ALL: no rule for this subject

  // Single boundary cast: CASL's ucast `Condition` → our structural `ScopeNode`
  // (we intentionally don't import @ucast types — see ast.ts). empty-AND → null.
  return interpret(ast as unknown as ScopeNode, ctx) ?? null
}
```

- [ ] **Step 2: Verify green** — `pnpm tsc && pnpm lint`

Note: if `@casl/ability/extra` fails to resolve under this bundler config, confirm the subpath export exists (`node_modules/@casl/ability/dist/es5m/extra/index.js` is present — verified). Do not fall back to importing from a deep dist path.

- [ ] **Step 3: Commit**

```bash
git add src/shared/domains/permissions/scope/compile-scope.ts
git commit -m "feat(permissions): add compileScope (phase 0)"
```

---

### Task 7: `resolveScope` + `verbOnly` + `canAccess` (the spec-aware layer)

**Files:**
- Create: `src/shared/dal/server/lib/resolve-scope.ts`

**Interfaces:**
- Consumes: `EntityServerSpec` (`@/shared/dal/server/types`), `Actor` (Task 1), `compileScope` (Task 6), `AppAction`/`AppSubject`.
- Produces: `resolveScope(spec: EntityServerSpec, actor: Actor): SQL | null`; `verbOnly(actor: Actor, action: AppAction, subject: AppSubject): SQL | null`; `canAccess(spec: EntityServerSpec, actor: Actor, id: string | number, action?: AppAction): Promise<boolean>`.

- [ ] **Step 1: Write `resolve-scope.ts`**

```ts
import type { SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'

import type { EntityServerSpec } from '@/shared/dal/server/types'
import type { Actor } from '@/shared/domains/permissions/scope/actor'
import type { AppAction, AppSubject } from '@/shared/domains/permissions/types'

import { and, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/shared/db'
import { compileScope } from '@/shared/domains/permissions/scope/compile-scope'

/**
 * The spec-aware scope authority (spec §5). Roots compile their conditions;
 * children resolve `own` as verb-only and inherit rows via the structural parent
 * bridge. Replaces `resolveEffectiveScope` once every entity migrates (Phase 5).
 *   null       → no constraint (allow)
 *   sql`false` → deny (own-verb denied)
 */
export function resolveScope(spec: EntityServerSpec, actor: Actor): SQL | null {
  const ctx = { table: spec.table, pk: pkColumn(spec), actor }
  const own = spec.parent
    ? verbOnly(actor, 'read', spec.caslSubject) // CHILD: verb-only (spec §5)
    : compileScope(actor, 'read', spec.caslSubject, ctx) // ROOT: full conditional compile
  const bridge = spec.parent
    ? inArray(
        fkColumn(spec),
        db.select({ pk: pkColumn(spec.parent.spec) }).from(spec.parent.spec.table)
          .where(resolveScope(spec.parent.spec, actor) ?? sql`true`),
      )
    : null
  return combine(own, bridge)
}

/**
 * Child own-scope is the VERB only — never the parent's row condition compiled
 * against the child table (spec §5, the "missing FROM-clause" hazard).
 * allow → null, deny → sql`false`. Token reach is handled by the bridge.
 */
export function verbOnly(actor: Actor, action: AppAction, subject: AppSubject): SQL | null {
  if (actor.kind === 'system')
    return null
  if (actor.kind === 'token')
    return null
  return actor.ability.can(action, subject) ? null : sql`false`
}

/**
 * Point form (spec §6) — "is a row with `id` reachable by this actor?" — for the
 * create/precursor and standalone probe paths that have no host query. Roots
 * probe with `action` (precursor uses 'read'); children fold through the bridge.
 */
export async function canAccess(
  spec: EntityServerSpec,
  actor: Actor,
  id: string | number,
  action: AppAction = 'read',
): Promise<boolean> {
  const ctx = { table: spec.table, pk: pkColumn(spec), actor }
  const scope = spec.parent
    ? resolveScope(spec, actor)
    : compileScope(actor, action, spec.caslSubject, ctx)
  const [row] = await db
    .select({ ok: sql`1` })
    .from(spec.table)
    .where(and(eq(pkColumn(spec), id), scope ?? undefined))
    .limit(1)
  return !!row
}

/** AND the non-null fragments; both null → null (allow); own=sql`false` → deny. */
function combine(own: SQL | null, bridge: SQL | null): SQL | null {
  const parts = [own, bridge].filter((p): p is SQL => p != null)
  if (parts.length === 0)
    return null
  if (parts.length === 1)
    return parts[0]
  return and(...parts)!
}

/**
 * Local copy of `scope.ts`'s pkColumn (kept private there). Duplicated rather
 * than exported so Phase 0 does not touch the file the old engine lives in;
 * both die together in Phase 5.
 */
function pkColumn(spec: EntityServerSpec): PgColumn {
  const table = spec.table as unknown as Record<string, PgColumn | undefined>
  const pkName = spec.primaryKey ?? 'id'
  const pk = table[pkName]
  if (!pk)
    throw new Error(`[scope] '${pkName}' is not a column on ${spec.entityName}'s table.`)
  return pk
}

/** The child→parent FK column. `parent.fk` is required in the current spec type. */
function fkColumn(spec: EntityServerSpec): PgColumn {
  if (!spec.parent)
    throw new Error(`[scope] ${spec.entityName} has no parent fk`)
  return spec.parent.fk
}
```

- [ ] **Step 2: Verify green** — `pnpm tsc && pnpm lint`

- [ ] **Step 3: Commit**

```bash
git add src/shared/dal/server/lib/resolve-scope.ts
git commit -m "feat(dal): add resolveScope + verbOnly + canAccess (phase 0)"
```

---

### Task 8: Isolation verification (EXPLAIN) + zero-wiring confirmation

This task produces **no committed code** — it proves the compiler behaves and that Phase 0 changed nothing in production. Evidence is recorded inline in the checklist below.

**Files:**
- Create (scratchpad, **uncommitted**): `<scratchpad>/verify-scope-compiler.ts`

- [ ] **Step 1: Confirm zero production wiring**

Run:
```bash
git grep -l -e 'domains/permissions/scope' -e 'dal/server/lib/resolve-scope' -- 'src/**' \
  | grep -v -e '^src/shared/domains/permissions/scope/' -e '^src/shared/dal/server/lib/resolve-scope.ts'
```
Expected: **no output** (nothing outside the new modules imports them). If any line prints, a production file was wired — revert that wiring; Phase 0 is additive only.

- [ ] **Step 2: Write the scratch verifier**

Write to the scratchpad dir (NOT under `src/`, NOT committed). It builds test abilities with **standard** operators and hand-builds custom nodes, then prints `.toSQL()`.

```ts
// <scratchpad>/verify-scope-compiler.ts — run with: pnpm tsx <path>
import { AbilityBuilder, createMongoAbility } from '@casl/ability'
import { customers } from '@/shared/db/schema'
import { db } from '@/shared/db'
import type { AppAbility } from '@/shared/domains/permissions/types'
import { userActor, systemActor, tokenActor } from '@/shared/domains/permissions/scope/actor'
import { compileScope } from '@/shared/domains/permissions/scope/compile-scope'
import { interpret } from '@/shared/domains/permissions/scope/interpret'
import { sql } from 'drizzle-orm'

const ctx = { table: customers, pk: customers.id, actor: userActor('U1', {} as AppAbility) }
const show = (label: string, scope: unknown) => {
  if (scope == null) { console.log(label, '→ NULL (no WHERE / allow-all)'); return }
  console.log(label, '→', db.select({ x: sql`1` }).from(customers).where(scope as never).toSQL())
}

// (a) standard eq → customers.pipeline = 'active'
{
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility)
  can('read', 'Customer', { pipeline: 'active' })
  const ability = build()
  show('eq(pipeline)', compileScope(userActor('U1', ability), 'read', 'Customer', { ...ctx, actor: userActor('U1', ability) }))
}
// (b) conditionless → NULL (allow-all) — today's rule shape
{
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility)
  can('read', 'Customer')
  const ability = build()
  show('conditionless', compileScope(userActor('U1', ability), 'read', 'Customer', { ...ctx, actor: userActor('U1', ability) }))
}
// (c) no rule → sql`false` (DENY-ALL)
{
  const { build } = new AbilityBuilder<AppAbility>(createMongoAbility)
  const ability = build()
  show('no-rule', compileScope(userActor('U1', ability), 'read', 'Customer', { ...ctx, actor: userActor('U1', ability) }))
}
// (d) system → NULL, token → its scope
show('system', compileScope(systemActor('why'), 'read', 'Customer', ctx))
show('token', compileScope(tokenActor(sql`customers.id = 42`, 'Customer'), 'read', 'Customer', ctx))

// (e) custom operators via hand-built nodes → EXISTS topologies
const u = userActor('U1', {} as AppAbility)
show('via:customerId', interpret({ operator: '$participatesViaMeeting', field: '', value: { via: 'customerId' } }, { table: customers, pk: customers.id, actor: u }))
show('$hasNoMeeting', interpret({ operator: '$hasNoMeeting', field: '', value: true }, { table: customers, pk: customers.id, actor: u }))
// dispatcher combo (hand-built and-node)
show('dispatcher', interpret(
  { operator: 'and', value: [
    { operator: 'eq', field: 'pipeline', value: 'active' },
    { operator: '$hasNoMeeting', field: '', value: true },
  ] },
  { table: customers, pk: customers.id, actor: u },
))
```

- [ ] **Step 3: Run it and record the observed SQL**

Run: `pnpm tsx <scratchpad>/verify-scope-compiler.ts`

Confirm each line matches the expected shape (exact quoting/params may vary; the **structure** must match):

| Case | Expected SQL shape |
|---|---|
| (a) `eq(pipeline)` | `... where "customers"."pipeline" = $1` (param `active`) |
| (b) `conditionless` | `NULL (no WHERE / allow-all)` |
| (c) `no-rule` | `... where false` |
| (d) `system` | `NULL` · `token` → `... where customers.id = 42` |
| (e) `via:customerId` | `... where exists (select 1 from "meetings" inner join "meeting_participants" on "meeting_participants"."meeting_id" = "meetings"."id" where "meetings"."customer_id" = "customers"."id" and "meeting_participants"."user_id" = $1)` |
| (e) `$hasNoMeeting` | `... where not exists (select 1 from "meetings" where "meetings"."customer_id" = "customers"."id")` |
| (e) `dispatcher` | `... where ("customers"."pipeline" = $1 and not exists (select 1 from "meetings" where "meetings"."customer_id" = "customers"."id"))` — equivalent to `leadsPoolVisibility()` |

If any case diverges, fix the responsible module (Tasks 4–7) and re-run. The `via:customerId` and `$hasNoMeeting` shapes must match `userCanSeeCustomer` / `leadsPoolVisibility` in `customers/dal/server/visibility.ts` — that equivalence is the whole point.

- [ ] **Step 4: Final green + delete the scratch file**

Run: `pnpm tsc && pnpm lint`
Expected: green. Then delete the scratch verifier (it is not part of the deliverable): `rm <scratchpad>/verify-scope-compiler.ts`.

- [ ] **Step 5: Mark Phase 0 complete in the epic tracker**

Edit `docs/plans/2026-08-10-casl-scope-compiler-epic.md`: check Phase 0's box and note the verification evidence (paste the observed `via:customerId` + `dispatcher` SQL into a one-line "Phase 0 verified:" note under its bullet). Commit:

```bash
git add docs/plans/2026-08-10-casl-scope-compiler-epic.md
git commit -m "docs(casl-epic): mark phase 0 complete with EXPLAIN evidence"
```

---

## Self-Review

**Spec coverage (spec §7 Phase 0 line):** `Actor` (Task 1) ✓; operator registry `defineScopeOperator` (Task 3) ✓; the two operators (Task 4) ✓; `compileScope` (Task 6) ✓; `resolveScope` + `verbOnly` child branch (Task 7) ✓; `canAccess` (Task 7) ✓; `pk`/`fk` helpers (Task 7) ✓; "nothing calls them yet" (Task 8 Step 1 grep) ✓; "unit-test against hand-authored expected SQL" reframed as EXPLAIN verification (Task 8) ✓. §11.1 single `defineScopeOperator` (Task 3) ✓. Deferred correctly: §11.2 fk-derive (Phase 3), §11.4 exhaustiveness test (Phase 1), CASL parser wiring (Phase 1).

**Placeholder scan:** no TBD/TODO; every code step shows full source; the one boundary cast (`as unknown as ScopeNode`) and the one local `pkColumn` duplication are documented with rationale, not hand-waves.

**Type consistency:** `Actor` shape identical across Tasks 1/3/6/7; `OperatorCtx { table, pk, actor }` identical in Tasks 3/5/7; `compileScope(actor, action, subject, ctx)` signature identical in Tasks 6/7; `interpret(node, ctx): SQL | null` identical in Tasks 5/6; `ScopeNode`/`FieldNode`/`CompoundNode` identical in Tasks 2/5. `getScopeOperator`/`registeredOperatorNames` defined in Task 3, consumed in Task 5 (and Phase 1). No name drift.
