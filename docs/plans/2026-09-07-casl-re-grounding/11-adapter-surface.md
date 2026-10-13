# 11 — Adapter surface: CASL ability → Drizzle, with NO `Actor`

**Tree:** `.worktrees/issue-285` @ `b40403b6` (`refactor/285-refactor-permissions-casl-scope-compiler`). Read-only; no tsc/lint/build.
**Reference:** `WebDevSimplified/casl-crash-course` (paths prefixed `ref:`).
**Inputs verified, not copied:** `02-engine-vs-reference.md` (§B, §C, §E, §F), `06-primitive-inventory.md` (§1–§2, S1–S3), `README.md` §C/§L. Where a prior report's line number drifted it is re-cited from the working tree.
**Empirical evidence:** two node probes against the installed `@casl/ability@6.8.0` (`node_modules/@casl/ability/dist/es6m/{index,extra/index}.mjs`), scripts at `<scratchpad>/casl-probe.mjs` (P1–P6) and `<scratchpad>/casl-probe2.mjs` (Q1–Q4). Outputs are quoted inline; they are the load-bearing facts of this report.

**Ruling this report designs under (README §L1–L6, 2026-09-08):** the principal IS the CASL ability (plus, for data stamping only, the session user id). No `user | token | system` union. Row scope is DERIVED from the ability by an adapter; `createCrudDal` calls that adapter per slot with the slot's own action.

---

## 0. Verified CASL facts this design rests on

| # | Fact | Evidence |
|---|---|---|
| F1 | `rulesToAST(ability, action, subjectType)` returns **`null`** when no rule grants the action; an **empty AND** (`{operator:'and', value:[]}`) when a conditionless rule grants it (incl. `manage all`); a `not(...)` node for `cannot` rules. | Installed `extra/index.mjs` fn `a` (`rulesToQuery`: `if(!n.conditions) if(n.inverted) break; else return o.length?{$and:o}:{}` … `if(!i.length) return null`) and fn `y` (`rulesToAST`: `if(!i.$and) return i.$or ? or(i.$or) : and([])`). Probes P4a (`manage all` → `and []`), P4c (conditional + `cannot` → `and [not(eq archived), eq ownerId]`), P4d (no rule → `null`). Docs: `docs-src/…/api/casl-ability-extra/en.md#rulesToAST` ("`null` if user is not allowed"). |
| F2 | **Fields do not participate in `rulesToAST`.** A conditionless rule that is field-restricted (`can('update','Customer',['age'])`) short-circuits the query to allow-all for that action, even if another rule for the same action is conditional. | fn `a` above ignores `rule.fields`; probe **Q3b**: `can('update','Customer',['name','phone'],{$participatesViaMeeting…})` + `can('update','Customer',['age'])` → `rulesToAST(update)` = `and []` (allow-all). |
| F3 | A conditional rule with a **custom document operator** (`$participatesViaMeeting`) is fine for `rulesToAST` (server) but **any instance check throws** unless a JS interpreter is registered: `can(action, subject(type,row))` and `permittedFieldsOf(ability, action, subject(type,row))` both call `Rule.matchesConditions(row)` → the compiled ucast matcher → `@ucast/core` `createInterpreter` throws `Unable to interpret "participatesViaMeeting" condition. Did you forget to register interpreter for it?`. A **type-level** check (`can(action,'Customer')`, `permittedFieldsOf(…,'Customer',…)`) does NOT throw — `matchesConditions` returns `!inverted` for a subject type. | Installed `index.mjs` class `N`: `matchesConditions(t){ if(!this.conditions) return true; if(!t||S(t)) return !this.inverted; … return i(t) }`; `extra/index.mjs` fn `f` (`permittedFieldsOf`) calls `t.matchesConditions(r)` per rule; `@ucast/core` es6m line `if("function"!=typeof r) throw new Error('Unable to interpret …')`. Probes **P1a** (type → `true`), **P1b/P1d** (instance → THROWS), **P1c** (type-level `permittedFieldsOf` → fields), **P2** (with `buildMongoQueryMatcher(instructions, { participatesViaMeeting: () => true })` → `true`). Our matcher passes NO interpreters (`src/shared/domains/permissions/scope/conditions-matcher.ts:37-39,48`). Docs: `docs-src/…/advanced/customize-ability/en.md` (`buildMongoQueryMatcher({ $nor }, { nor })` — 2nd arg = interpreters). |
| F4 | A bearer-style ability compiles like any other: `can('read','Proposal',{id:'P1'})` → `eq(id,'P1')`; `can('update','Proposal',['status','contractSignedAt'],{id:'P1'})` → same AST for `update`; `rulesToAST(delete)` → `null`; `permittedFieldsOf(update, subject('Proposal',{id:'P1'}))` → `['status','contractSignedAt']`, on `{id:'P2'}` → `[]`; `can('update', subject(…{id:'P1'}), 'label')` → `false`. Scalar conditions need no interpreter. | Probes **P3a–P3g**. Docs: `docs-src/…/guide/restricting-fields/en.md` (`permittedFieldsOf(ability,'update',ownArticle,options)` → own fields; `anotherArticle` → `[]`). |
| F5 | `rulesToFields(ability, action, subjectType)` returns the scalar condition values of the direct rules as a defaults object (`can('create','CustomerNote',{authorId:'u1'})` → `{ authorId: 'u1' }`); custom `$`-operators are skipped (`{}`). | Probe **Q1a/Q1b**; `extra/index.mjs` fn `h`. Docs: `rulesToFields.d.ts:3-6` ("Extracts rules condition values into an object of default values"). |
| F6 | `$in` compiles (`{ customerId: { $in: [...] } }` → `in` node) and matches instances; but the value must be a **literal array** — a subquery is not a JSON value. | Probe **P5a/P5b**. |
| F7 | `.because(reason)` survives on the rule; `ability.rules[i].reason` and `relevantRuleFor(action, subject)?.reason` return it. | Probe **P6**; `ForbiddenError.from(ability).throwUnlessCan(...)` produces `Cannot execute "delete" on "Customer"` with `.action`/`.subjectType` (**Q2**). |
| F8 | Hand-walking the AST is the sanctioned adapter shape. CASL's docs show `rulesToQuery` + a per-rule converter for Sequelize; the reference walks `rulesToAST` output by `instanceof` (`ref:src/lib/permissions/drizzleAdapter.ts:8-51`); CASL's own `@casl/prisma` builds a parser + interpreter pair over `@ucast/core` (`packages/casl-prisma/src/prisma/prismaQuery.ts`, `interpretPrismaQuery.ts` via `createJsInterpreter`). `@ucast/sql` is not resolvable through Context7 (only unrelated "SQL" libraries returned), so its walk could not be quoted; the Prisma interpreter is the closest first-party precedent and it is an AST walk keyed on `condition.operator` — exactly what `interpret.ts:28-73` does. | `docs-src/…/advanced/ability-to-database-query/en.md`; `02-engine-vs-reference.md` §C row "Adapter shape". |

Consequence of F2 that the rest of this report must respect: **a mutation's row-scope from `rulesToAST` is only as tight as the loosest rule for that action.** Today every agent/dispatcher `update` rule is conditionless (`src/shared/domains/permissions/abilities.ts:113,117,128,133,138,143,152,157,189,236,242,255,263`), so a naive "compile `update` per slot" would widen every update WHERE to allow-all the day the factory flips. This is README §D3's "migration invariant" seen from the engine side; §3 below proposes the structural guard.

---

## 1. What the engine needs from the principal, exactly

### 1.1 Every actor read today and its replacement

`grep -n actor src/shared/domains/permissions src/shared/dal/server/lib` (plus the DAL/feature consumers of `ctx.actor`, `06` S1):

| Site | Reads | Purpose | Becomes (ability-only world) |
|---|---|---|---|
| `scope/compile-scope.ts:23-24` | `actor.kind === 'system'` → `null` | allow-all short-circuit | **Deleted.** A system caller holds `manage all` → F1 empty AND → allow-all, emergent (`resolve-trpc-actor-scope.ts:10-12` already documents omni as emergent). |
| `scope/compile-scope.ts:25-26` | `actor.kind === 'token'` → `actor.scope` | bearer row predicate, action-agnostic | **Deleted.** Bearer ability compiles per action (F4, §1.3). |
| `scope/compile-scope.ts:28` | `actor.ability` | `rulesToAST` input | parameter `ability: AppAbility`. |
| `scope/operators.ts:12` | `OperatorCtx.actor` | threaded to custom operators | `OperatorCtx = { table, pk }` (option A, §1.2) or `{ table, pk, principalId }` (option B). |
| `scope/operators/meeting-participation.ts:33-38` | `ctx.actor.kind !== 'user'` (throw), `ctx.actor.userId` | user id for `meeting_participants.user_id = ?` | option A: `node.value.userId` (the rule carries it, probe Q1e); option B: `ctx.principalId`. The kind-guard is deleted. |
| `dal/server/lib/resolve-actor-scope.ts:23,61` | builds `OperatorCtx` with `actor` | — | builds `{ table, pk }`. |
| `dal/server/lib/resolve-actor-scope.ts:25-26` | `actor` → `verbOnly` / `compileScope`, action pinned `'read'` | spec-aware resolution | `toWhere(ability, action, spec)` (§2). |
| `dal/server/lib/resolve-actor-scope.ts:43-47` | `verbOnly`: system→null, token→null, else `ability.can` | child verb | `ability.can(action, spec.caslSubject) ? undefined : sql\`false\``. System/bearer need no special case: `manage all` → true; bearer has the parent subject's verb (child reuses it, `proposal-media-files/lib/server-spec.ts:40`) or not. |
| `dal/server/lib/resolve-actor-scope.ts:55-73` | `canAccess(spec, actor, id, action)` | point probe | `canReach(ability, action, spec, id)` (§2). |
| `dal/server/lib/helpers.ts:70-77` | builds `userActor(userId, ability)` in `buildUserContext` | service/job context | `buildUserContext` deleted; callers already hold `ctx` (`meeting-flow.router.ts:71`, `projects.router/business.router.ts:67-71`) and pass it through. |
| `dal/server/types.ts:46,57,69` | `ScopedContext.actor`; `systemActor(...)` in `SYSTEM_CONTEXT`/`systemContext` | — | §4. |
| `entities/customers/lib/phone-gating-sql.ts:42-46` | `actor.kind !== 'user'` → ungated; else `can('manage','all') \|\| can('read','LeadsPool')` | "trusted" short-circuit | **Trust becomes a grant.** `canSeeUngatedPhone(ability)` = `ability.can('read', 'UngatedPhone')` (new gate subject; super-admin via `manage all`, dispatcher explicitly, system via `manage all`, bearer explicitly on its one-row ability). Callers: `customers/dal/server/queries.ts:51`, `meetings/dal/server/queries.ts:165,279`, `voip-campaign-contacts/dal/server/queries.ts:282`, `customers.router/business.router.ts:124`, `dashboard.router.ts:10`. |
| `features/customer-pipelines/dal/server/get-customer-profile.ts:31-36` | `actor`, `actor.kind !== 'user' \|\| actor.ability.can('read','Proposal')` | financial wall | `ctx.principal.ability.can('read','Proposal')` — system (`manage all`) and a bearer (`can('read','Proposal',{id})`, type-level true) both pass without a kind switch. |
| `…/get-customer-pipeline-items.ts:42-52,61,69,175` | same pattern; `actor` threaded into 4 builders | — | thread `ability` (or the pre-compiled `SQL | undefined` per spec, which the builders already do at `:51`). |
| `…/move-customer-pipeline-item.ts:37` | `scopedFor(spec) = { ...ctx, scope: resolveActorScope(spec, ctx.actor) }` | re-scope per entity | disappears — `createCrudDal` self-scopes per slot (§3); the helper's callers just pass `ctx`. |
| `entities/customer-notes/lib/server-spec.ts:58` | `canAccess(customerServerSpec, ctx.actor, input.customerId)` | create-side parent probe | moves into the factory's create slot (§3.2, C4). |
| `trpc/routers/{projects,proposals}.router/media.router.ts:27,29,53,104,111,164`, `customer-pipelines.router.ts:77,106,136` | `canAccess(spec, ctx.actor, id)` / `resolveActorScope(spec, ctx.actor)` | handler-level probes | `canReach(ctx.principal.ability, 'read'\|'update', spec, id)`; most become unnecessary once the DAL slot scopes itself. |
| `share-token-actor.ts:21-29`, `shareable-middleware.ts:46-50,62-67`, `api/proposals/[proposalId]/{pdf,summary}/route.ts:21-27/24-31`, `views.router.ts:41-50` | build `tokenActor` / `userActor` | principal construction | build an **ability** (§1.3). |

Net: after the change the engine reads exactly **one** thing from the principal — the `AppAbility` — plus, in option B only, a `principalId` for operators. Nothing else in `src/shared/domains/permissions` or `src/shared/dal/server/lib` touches identity.

### 1.2 (a) The user id inside custom operators

Today `$participatesViaMeeting` reads `ctx.actor.userId` (`meeting-participation.ts:38`) and the rule is authored without it (`abilities.ts:108,131,136,150`).

**Option A — bake `userId` into the condition at build time** (reference style: `allow('read','Todo',{ userId: user.id })`, `ref:src/lib/permissions/getUserPermissions.ts:20-25`):

```ts
// abilities.ts (agent)
can('read', 'Customer', { $participatesViaMeeting: { via: 'customerId', userId: user.id } })
// operators/meeting-participation.ts
toSql: (node, ctx) => {
  const { via, userId } = node.value as { via: ParticipationVia, userId: string }
  …eq(meetingParticipants.userId, userId)…
}
// OperatorCtx = { table: PgTable, pk: PgColumn }   // pure: no principal at all
```

**Option B — pass `principalId` in the compile ctx** (`OperatorCtx = { table, pk, principalId: string | null }`; rule stays `{ via }`; `toSql` reads `ctx.principalId`; throws when `null`).

| Criterion | A (bake in) | B (ctx param) |
|---|---|---|
| Purity of the operator | pure function of `(node, table)` | depends on out-of-band ctx |
| CASL-idiomatic | **yes** — every CASL doc/reference example puts the user's id in the condition; `rulesToFields` (F5) and `subject()` instance checks only work when the value is IN the rule | no — CASL has no channel to pass a principal into `matchesConditions`; a client/JS interpreter (`toJS`) for the operator could never learn the user id |
| Serializability to the client | rules are plain JSON incl. the user's own id (probe Q1d `packRules`) — harmless: the client already builds the same ability from `{userId, role}` (`casl-provider.tsx:27-30`) and never serializes for other users | rules are user-agnostic JSON |
| Rule count / cacheability | one ability **per user** (already the case: `init.ts:54-57`) | one ability **per role** could be cached — a real perf win nobody has asked for |
| Boot assert | `assertScopeWiring` builds with a sentinel id `'__assert__'` (`abilities.ts:285`) — unchanged | unchanged |
| Bearer / system | N/A (no custom operators on those abilities) | must tolerate `principalId: null` (throw if an operator needs it) |
| Blast radius | rule text at 4 sites + operator body + `OperatorCtx` | operator body + `OperatorCtx` + every `compileScope`/`toWhere` caller must know the id |

**Recommendation: A.** It is what CASL is designed around (F5 falls out for free: `rulesToFields(ability,'create','CustomerNote')` → `{ authorId }` becomes the sanctioned stamping source, §4), it makes `OperatorCtx` principal-free, and it is the only shape under which a future `toJS` mirror is even possible (F3). B's sole advantage (per-role ability caching) is not a stated goal.

### 1.3 (b) The token bearer

A bearer is an anonymous principal whose ability is built for one row inside the shareable procedure (README §L3). Two equivalent condition shapes:

```ts
// share-token-ability.ts — ONE canonical path (replaces share-token-actor.ts:21-29 AND shareable-middleware.ts:59-68)
export async function resolveShareTokenAbility(token: string, resourceType: 'proposal'): Promise<AppAbility | null> {
  const result = await validateShareToken(token, resourceType)          // validate-share-token.ts:28-50 (1 query)
  if (!result.valid) return null
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility)
  can('read', 'Proposal', { id: result.resourceId })
  can('update', 'Proposal', HOMEOWNER_WRITABLE_FIELDS, { id: result.resourceId })   // the ~3 homeowner write endpoints (README §J2)
  can('read', 'UngatedPhone')                                             // replaces actor.kind!=='user' at phone-gating-sql.ts:43-44
  return build({ conditionsMatcher: buildScopeConditionsMatcher() })
}
```

(Alternative with zero extra query: `can('read','Proposal',{ token })` — compiles to `eq(proposals.token, $1)`, exactly `shareable-middleware.ts:62`'s predicate. Rejected only because README §F4 wants ONE validating path and a 401-vs-404 split; if that is dropped, `{ token }` is fine.)

Emitted SQL through the ordinary adapter (F4):

| Slot / query | `rulesToAST` | WHERE emitted |
|---|---|---|
| `getById` (read) | `eq(id,'P1')` | `SELECT … FROM proposals WHERE proposals.id = $1 AND proposals.id = 'P1'` |
| `update` (fields `[status, contractSignedAt]`) | `eq(id,'P1')` | row: `UPDATE proposals SET … WHERE proposals.id = $1 AND proposals.id = 'P1' RETURNING *`; fields: `permittedFieldsOf(ability,'update',subject('Proposal',row))` → `['status','contractSignedAt']` (P3d) — any other key → `forbidden`. This closes `02` E-3 (today `assertCanUpdateFields` is skipped when `ability` is null, `create-crud-router.ts:147-149`). |
| `delete` | `null` | `sql\`false\`` → `WHERE proposals.id = $1 AND false` → 0 rows → `not-found` (or `forbidden` from the early verb check, §3). |
| proposal-media child `list` (`media-ops.ts:26-39`) | own = verb-only (child reuses `Proposal`, `proposal-media-files/lib/server-spec.ts:40`) → `undefined`; bridge = parent `read` | `SELECT … FROM proposal_media_files WHERE proposal_id = $1 AND proposal_id IN (SELECT proposals.id FROM proposals WHERE proposals.id = 'P1')` |
| `getFullView` (`proposals/dal/server/queries.ts:122`) | as read | `… WHERE proposals.id = $1 AND proposals.id = 'P1'` |

**Does anything still need a raw `scope: SQL` path? No.** Every consumer of `tokenActor.scope` (`compile-scope.ts:26`, `shareable-middleware.ts:62-67`, `views.router.ts:50`, `pdf/route.ts:27`, `summary/route.ts:31`) obtains the identical predicate from `toWhere(bearerAbility,'read',proposalServerSpec)`. The one thing that MUST accompany this change: delete the `homeowner` role's conditionless `can('read','Proposal')` (`abilities.ts:208`) — an authenticated homeowner session would otherwise OR-merge to allow-all (F1/F2; README §L3 already says so).

### 1.4 (c) The system caller and the audit `reason`

`can('manage','all')` → `rulesToAST` = empty AND → `toWhere` = `undefined` (P4a). Verb checks: `can(anything)` true. Field checks: `permittedFieldsOf` with `fieldsFrom: r => r.fields ?? allColumns` → all columns. So a system ability behaves exactly like today's `actor.kind === 'system'` short-circuits (`compile-scope.ts:23-24`, `resolve-actor-scope.ts:43-44`, `verbOnly`) and like `SYSTEM_CONTEXT.scope === null` — with no branch in the engine.

Where the reason lives — options:

| Option | Shape | Greppable at construction | Recoverable at runtime | Cost |
|---|---|---|---|---|
| R1 **rule `reason`** (CASL-native) | `systemAbility(reason: SystemReason)` = `can('manage','all').because(reason)`; `systemContext(reason) = { principal: { ability: systemAbility(reason), userId: null } }` | yes — the typed `SystemReason` union (`scope/system-reasons.ts:8-15`) stays the parameter type | yes — `ability.rules[0].reason` / `relevantRuleFor(...)?.reason` (F7) for logging/`track()` | trivial |
| R2 wrapper type | `type SystemAbility = AppAbility & { readonly __systemReason: SystemReason }` (branded) | yes | yes | a brand to maintain; nothing consumes it |
| R3 log at construction | `systemContext(reason)` logs/`track()`s and forgets | yes | no | noise per job |

**Recommendation: R1** (optionally + R2's brand later if a guard ever needs to *refuse* a system ability, e.g. a route handler that must never run as system). `SYSTEM_CONTEXT` stays as `systemContext('legacy:system-context')` until README §F3 classifies the ~54 live sites (grep count in this tree: 54 non-definition `SYSTEM_CONTEXT` references; `systemContext(` has 1 caller, `contracts.router.ts:224`).

### 1.5 (d) Omni

Emergent: `manage all` (`abilities.ts:96`) → empty AND → `undefined`; `can()` true everywhere; `permittedFieldsOf` → all columns. No `isOmni` pre-checks remain in the engine (`resolve-trpc-actor-scope.ts:10-12` was already right). The 12 handler-level `can('manage','all')` reads (`06` T16) are business branches (phone column, super-admin text search at `business.router.ts:107`), not engine plumbing, and should each become a named gate subject (`'UngatedPhone'`, `'CustomerPhoneSearch'`) or stay as-is — outside this report.

---

## 2. The adapter surface (proposal, with signatures)

One module, `src/shared/dal/server/lib/casl-drizzle.ts` (rename of `resolve-actor-scope.ts`), the ONLY place that reads `spec.parent`/`spec.table` for authorization:

```ts
import type { SQL } from 'drizzle-orm'
import type { AppAbility, AppAction, AppSubject } from '@/shared/domains/permissions/types'
import type { EntityServerSpec } from '../types'

/**
 * Row predicate for `action` on `spec`, DERIVED from the ability.
 *   undefined  → no constraint (omni / conditionless grant)   — Drizzle's own idiom: and(x, undefined) drops it
 *   sql`false` → deny (no rule for this action+subject)
 *   SQL        → compiled predicate (own conditions ∧ parent bridge for children)
 * Pure & sync: no db round-trip; subqueries are correlated fragments.
 */
export function toWhere(ability: AppAbility, action: AppAction, spec: EntityServerSpec): SQL | undefined

/** Point probe: is a row with `id` reachable for `action`? For create-side parent checks and standalone handlers. */
export function canReach(ability: AppAbility, action: AppAction, spec: EntityServerSpec, id: string | number): Promise<boolean>

/** Fields `action` may touch on THIS row (instance-aware; F4). `fieldsFrom` defaults to rule.fields ?? all table columns. */
export function permittedFields(ability: AppAbility, action: AppAction, spec: EntityServerSpec, row: Record<string, unknown>): string[]

/** Type-level verb gate (never leaks existence). Throws ThrowableDalError({ type: 'forbidden' }). */
export function assertCan(ability: AppAbility, action: AppAction, subject: AppSubject, field?: string): void

/** Instance gate on an in-memory row/input via subject(spec.caslSubject, row) — scalar conditions only (F3). Throws 'forbidden'. */
export function assertCanOn(ability: AppAbility, action: AppAction, spec: EntityServerSpec, row: Record<string, unknown>): void

/** Sugar for bespoke reads: and(toWhere(ctx.principal.ability, action, spec), ...extra). */
export function scopedWhere(ctx: ScopedContext, action: AppAction, spec: EntityServerSpec, ...extra: (SQL | undefined)[]): SQL | undefined
```

Design notes:

- **`undefined` not `null` for "unconditional."** Today three encodings coexist (`null` engine / `undefined` Drizzle / `sql\`true\`` bridge at `resolve-actor-scope.ts:31`, `06` S3 #4) and `requireResolvedScope` (`helpers.ts:95-102`) exists only to tell `null` from "never resolved". With the adapter called **inline at the query site** the "never resolved" state cannot exist — either `toWhere` is in the `and()` or it is not, and that is the wall guard's job (§5.3), not a runtime sentinel's. So `toWhere` returns Drizzle-native `SQL | undefined`, `requireResolvedScope` dies, and `?? sql\`true\`` dies. (If the user prefers the task's `null` sentinel, the only change is `?? undefined` at every call site — the encoding question is cosmetic; the removal of the runtime guard is the substantive point.)
- **Deny stays `sql\`false\``** (never `undefined`), so a deny composes fail-safe into any `and()` (`compile-scope.ts:16-20` rationale kept).
- **`toWhere` is sync and pure** — it must stay so for `db.$count(customers, where)` (`business.router.ts:94`) and for composing into transactions. Only `canReach` hits the DB.
- **Child bridging is folded into `toWhere`** (no `toWhereForChild`) — see 2.1.
- Fields: `permittedFields` wraps `permittedFieldsOf(ability, action, subject(spec.caslSubject, row), { fieldsFrom: r => r.fields ?? Object.keys(getTableColumns(spec.table)) })` (`ref:src/lib/permissions/todos.ts:51-53` does the per-field loop; `permittedFieldsOf` is the docs' server idiom, `docs-src/…/api/casl-ability-extra/en.md#permittedFieldsOf`).
- **F3 constraint on `permittedFields`/`assertCanOn`:** they invoke the JS matcher on an instance. Any rule for that action whose conditions contain a custom document operator will throw. Two ways out, both engine-level (user to rule): **(i)** boot assert "a rule with `fields` or on a mutation action may not carry a custom operator" (keeps the JS matcher scalar-only; today no rule violates it), or **(ii)** register server-side interpreters that read pre-computed facts the adapter selects alongside the row (e.g. `toSelectAuthFacts(ability, action, spec)` adds `__participates: EXISTS(...)` columns and `toJS: (node, row) => row.__auth?.[node.operator] === true`). (i) now, (ii) only if D1's matrix demands custom-op conditions on field-restricted or mutation rules. Note the same throw hits the **client** today for any `useAbility().can('read', subject('Customer', row))` — report 12's problem, flagged here because it is the same F3.

### 2.1 Parent bridging: structural (spec-declared) vs rule operator

Children today: `customer-notes` (`customer-notes/lib/server-spec.ts:35`), `applications` (`applications/lib/server-spec.ts:24`), `media-files` (`media-files/lib/server-spec.ts:40`, **reuses `Project` subject** `:39`), `proposal-media-files` (`proposal-media-files/lib/server-spec.ts:41`, **reuses `Proposal`** `:40`).

**Shape S — structural (keep `spec.parent`, add an optional bridge action):**

```ts
parent?: { spec: EntityServerSpec, fk: PgColumn, action?: AppAction /* default 'read' */ }

function toWhere(ability, action, spec) {
  const own = spec.parent && spec.caslSubject === spec.parent.spec.caslSubject
    ? verbWhere(ability, action, spec.caslSubject)                 // SAME-SUBJECT child: verb only (see hazard below)
    : compile(ability, action, spec.caslSubject, { table: spec.table, pk: pkColumn(spec) })
  const bridge = spec.parent
    ? inArray(fkColumn(spec), db.select({ pk: pkColumn(spec.parent.spec) }).from(spec.parent.spec.table)
        .where(toWhere(ability, spec.parent.action ?? 'read', spec.parent.spec)))
    : undefined
  return combine(own, bridge)   // both undefined → undefined; own = sql`false` → deny
}
```

**Shape R — rule operator (`$parentReachable`):** every child rule carries `{ $parentReachable: 'read' }`; the operator's `toSql` needs `ctx.spec.parent` + `ctx.ability` (so `OperatorCtx` grows to `{ table, pk, spec, ability }`), and emits the same `IN (SELECT …)`.

**Emitted SQL, CustomerNote, with the D4 rules** (`can('read','CustomerNote')`, `can(['update','delete'],'CustomerNote',{ authorId: user.id })`, `can('create','CustomerNote',{ authorId: user.id })`; Customer read: agent `{$participatesViaMeeting:{via:'customerId',userId}}`, dispatcher `{$inDerivedPipeline:['leads','rehash','dead','fresh']}` `abilities.ts:233`):

| Principal · slot | own (from `rulesToAST(action,'CustomerNote')`) | bridge (`toWhere(read, Customer)`) | WHERE |
|---|---|---|---|
| agent · read | conditionless → `undefined` | `customer_notes.customer_id IN (SELECT customers.id FROM customers WHERE EXISTS (SELECT mp.id FROM meetings m JOIN meeting_participants mp ON mp.meeting_id = m.id WHERE m.customer_id = customers.id AND mp.user_id = $uid))` | `id = $id AND <bridge>` |
| agent · update/delete | `customer_notes.author_id = $uid` | same | `id = $id AND author_id = $uid AND <bridge>` |
| dispatcher · read | `undefined` | `customer_id IN (SELECT customers.id FROM customers WHERE <derivedPipelineWhere(['leads','rehash','dead','fresh'])>)` (`derived-pipeline.ts:29-35` → `derived-pipeline-sql.ts`) | `id = $id AND <bridge>` |
| dispatcher · update/delete | `author_id = $uid` | same | `id = $id AND author_id = $uid AND <bridge>` |
| super-admin · any | empty AND → `undefined` | parent `manage all` → `undefined` | `id = $id` |
| bearer · any | no rule → `sql\`false\`` | — | `id = $id AND false` |

Shape R emits byte-identical SQL for the four user rows; the difference is who guarantees the bridge exists.

| Criterion | S structural | R operator |
|---|---|---|
| Forgetting it | impossible — `spec.parent` is declared once (`fkColumn` also guards the mis-pointed-FK wrong-join, `resolve-actor-scope.ts:106-117`) | a role's child rule without `$parentReachable` silently reads/writes across every parent (a false-ALLOW class; `assertScopeWiring` cannot know which subjects are children) |
| "CASL single source of truth" | the *policy* (who may read the parent) IS in CASL; the *topology* (this table hangs off that FK) is schema, and lives beside `table`/`primaryKey` in the spec | policy and topology both in rules; the operator still needs `spec.parent` for the fk → no real gain |
| Client mirror | nothing to mirror (client never filters by parent) | needs a `toJS` returning `true` |
| Per-child bridge action | `parent.action` (e.g. `CustomerProfile` upsert bridges on parent `read` — `meeting-flow.router.ts:43-49` explains why not `create`) | the operator's value |
| `manage all` | bridge compiles to `undefined` automatically | no rule → no operator → same |

**Recommendation: S**, with `parent.action?` (default `'read'`). README §C3's shape (a) is confirmed **with one hazard it did not name:** a child that **reuses its parent's `caslSubject`** (both media specs) must NOT compile the parent's conditions against its own table — `columnOf` (`interpret.ts:76-81`) only throws for a *missing* column, and `id`/`ownerId`/`customerId` exist on both tables, so `can('read','Proposal',{id:'P1'})` compiled against `proposal_media_files` would emit `proposal_media_files.id = 'P1'` (integer vs uuid → a Postgres type error by luck, or a silent mis-scope for a same-typed column). Hence the `same-subject child → verb-only` branch above; the cleaner end state is to give `MediaFile`/`ProposalMediaFile` (already in `ENTITY_NAMES`, `abilities.ts:56,58`) their own verb-only rules and drop the reuse.

---

## 3. `createCrudDal` per-slot contract (proposal)

The factory reads `ctx.principal.ability` and calls the adapter with the slot's action (README §C2 supersedes Phase-5's "factory MUST NOT read the actor"). `SLOT_ACTIONS` (`create-crud-router.ts:30-36`) moves into the DAL; the router keeps only tRPC concerns. Error mapping stays `dalToTrpc` (`dal-to-trpc.ts:14-17`: `not-found`→404, `forbidden`→403).

**Existence-non-leak rule:** a **type-level** denial (no rule at all for `action` on the subject) is `forbidden` — it reveals nothing about any row and matches the router's current `assertCan` (`create-crud-router.ts:119,131,158,165`). A **row-level** miss on a client-supplied id (out of scope OR non-existent) is `not-found`. A **field-level** denial on a row the caller can already reach is `forbidden` naming the field (`create-crud-router.ts:224-227` semantics, now instance-aware).

**F2 guard (structural, user to ratify — open question #1):** for mutation slots the row WHERE is `and(toWhere(ability, <slot action>, spec), toWhere(ability, 'read', spec))`. Rationale: today's update/delete WHERE is the read scope (`create-crud-dal.ts:213,264` via `resolve-actor-scope.ts:25-26`), every mutation rule is conditionless, and F2 shows a single conditionless field-restricted `update` rule makes `rulesToAST(update)` allow-all — so "`update` alone" would let an agent `update Customer.age` on any customer by id the day the factory flips. "You must be able to read a row to mutate it" costs one extra AND and closes the class; pure-CASL purists can drop it once D1's matrix guarantees every mutation rule carries conditions (README §D3).

### 3.1 `getById(ctx, { id })`
1. `assertCan(ability, 'read', spec.caslSubject)` → `forbidden` (type-level).
2. `SELECT … WHERE and(eq(pk, id), toWhere(ability, 'read', spec)) LIMIT 1` → `undefined` → caller maps to `not-found` (unchanged contract, `create-crud-dal.ts:110-125`).

### 3.2 `create(ctx, input)`
1. `assertCan(ability, 'create', spec.caslSubject)` → `forbidden`.
2. before-hooks (factory outer → callsite inner, `:138-141`) — stamping happens here (§4; optionally `{ ...rulesToFields(ability,'create',spec.caslSubject), ...input }` as the default stamp, F5).
3. `validated = spec.schemas.insert.parse(data)`.
4. **Instance gate on the input** (reference: `canCreateTodo({ user, todo: newTodoData })` → `can('create', subject('Todo', todo))`, `ref:src/dal/todos/mutations.ts:19-22`, `ref:src/lib/permissions/todos.ts:31`): `assertCanOn(ability, 'create', spec, validated)` — evaluates scalar conditions such as `{ ownerId: userId }` / `{ authorId: userId }` against the stamped payload → `forbidden`. (F3: create rules must not carry custom operators, or (ii) applies.)
5. **Child: parent probe.** `if (spec.parent) { ok = await canReach(ability, spec.parent.action ?? 'read', spec.parent.spec, validated[fkName]) ; if (!ok) throw not-found }` — the parent id is client-supplied → `not-found`. This is README §C4 and closes `02`/README E1-4 (meeting create on any `customerId` at `meetings/dal/server/crud.ts:33-38`; note create at `customer-notes/lib/server-spec.ts:58` moves here). **What "may create" means for a child:** *reach the parent for `parent.action`* — expressed structurally, because the CASL-native alternative `can('create','Meeting',{ customerId: { $in: <my customer ids> } })` needs a literal array (F6) and cannot carry a subquery; a `$parentReachable` operator is the R-shape rejected in §2.1. **For a root:** verb + instance gate on the input (steps 1 & 4) — nothing else exists to scope.
6. `INSERT … RETURNING`; after-hooks (`:151-154`).

### 3.3 `update(ctx, { id, data })`
1. `assertCan(ability, 'update', spec.caslSubject)` → `forbidden`.
2. before-hooks → `validated`; empty-update short-circuit (`:182-192`) now goes through 3.1.
3. **Load current row** with `where = and(eq(pk,id), toWhere(ability,'update',spec) [, toWhere(ability,'read',spec)])` → miss → `not-found`. (Replaces the after-hook-conditional `previousRow` prefetch `:194-209` — the row is now always loaded once, and doubles as `meta.previousRow`.)
4. **Field gate, post-load:** `allowed = permittedFields(ability, 'update', spec, row)`; for every key of `validated` with a defined value not in `allowed` → `forbidden` (`{ type:'forbidden' }` — extend `DalError` with an optional `field`/`reason` so the router message can name it as `create-crud-router.ts:226` does). Runs on **every** principal incl. bearers (fixes E-3).
5. `UPDATE … SET validated WHERE <same where> RETURNING` — re-applying the predicate keeps the write race-safe (a row that left scope between 3 and 5 yields 0 rows → `not-found`).
6. after-hooks with `meta = { previousRow: row, input: data }` (`:219-226`).

### 3.4 `delete(ctx, { id })`
1. `assertCan(ability,'delete',…)` → `forbidden`. 2. Load row with `toWhere(ability,'delete',spec) [∧ read]` → `not-found` (always, not only when hooks exist — `:241-257`). 3. before-hooks. 4. `DELETE … WHERE <same where> RETURNING pk` → 0 → `not-found`. 5. after-hooks.

### 3.5 `duplicate(ctx, { id })`
1. Source via 3.1 (`read`) → `not-found` (`:288-295`). 2. Build the insert (`:297-310`). 3. `createImpl` (3.2 — verb, instance gate, parent probe, hooks). The router's `SLOT_ACTIONS.duplicate = 'create'` (`create-crud-router.ts:35`) is thereby honored in the DAL.

Where the checks live vs today: `assertCan`/`assertCanUpdateFields` leave `create-crud-router.ts:185-230` (tRPC-only, `ability`-null-skipped) and become the DAL's own steps, so services/jobs/webhooks/route handlers get identical enforcement through the same handlers (README §C2 "ONE resolution point").

---

## 4. Context type for the DAL

`ctx.session` reads under `src/shared` (all of them):

| Site | Read | Need |
|---|---|---|
| `entities/meetings/dal/server/crud.ts:34` | `if (!ctx.session) return input` | "is this a system caller?" (owner passthrough) |
| `entities/meetings/dal/server/crud.ts:125` | `excludeUserId: ctx.session?.user.id` | user id (notification exclusion) |
| `entities/meetings/dal/server/crud.ts:185` | `ownerId: ctx.session?.user.id ?? source.ownerId` | user id (duplicate override) |
| `entities/meetings/lib/resolve-owner.ts:14-15` | `ctx.ability?.can('own','Meeting')` → `ctx.session!.user.id` | capability + user id |
| `entities/customer-notes/lib/server-spec.ts:61` | `authorId: ctx.session?.user.id` | user id (stamp) |
| `entities/customer-notes/lib/assert-note-author.ts:8-9` | `ctx.session?.user.id`, `ctx.ability?.can('manage','all')` | dies with D4 (`{ authorId }` rule + §3.3) |
| `entities/proposals/lib/server-spec.ts:119` | `ownerId: ctx.session!.user.id` | user id (duplicate override) |
| `dal/server/lib/scope.ts:68,74` | session as system discriminator; `ctx.ability!` | legacy engine — deleted |
| `dal/server/lib/helpers.ts:73` | **fabricates** `{ user: { id, role } } as ScopedContext['session']` | the smell the redesign removes |

Every live read reduces to `user.id` or "is there a user?". Nothing in the DAL needs `role`, `email`, `name` (`delivery.router.ts:48-49` reads those in the router, where `ctx.session` remains).

| Candidate | Shape | Pros | Cons |
|---|---|---|---|
| **V1** | `{ ability: AppAbility, userId: string \| null, tx?: Tx }` | flattest; hooks read `ctx.userId` | tRPC ctx must also carry `userId` next to `session` for handlers to keep passing `ctx` straight into DAL fns (today they do, because tRPC ctx ⊇ `ScopedContext`); two identity fields to keep in sync per rung |
| **V2** | `{ ability, session: BetterAuthSession \| null, tx? }` | zero new concepts; `session.user.id` reads unchanged | re-imports the "fabricated session" pattern (`helpers.ts:73`) for jobs acting as a user; DAL depends on the auth provider's type for one field; bearer ≡ system ≡ `null` (already the ambiguity `crud.ts:34` leans on) |
| **V3** | `{ principal: Principal, tx? }` with `interface Principal { ability: AppAbility, userId: string \| null }` | matches README §L4 ("compute the principal ONCE per route") — one object built at the rung/RSC/route-handler/job boundary and passed as a unit; tRPC ctx = `{ session, principal }` and is structurally a `ScopedContext` again; `userId` and `ability` cannot drift; `systemContext(reason)` is one literal | one extra property hop (`ctx.principal.ability`) |

**Recommendation: V3.** `Principal` is the thing report 09 needs to hand to RSC helpers and route handlers unchanged, and it is what the adapter functions take apart (`toWhere(ctx.principal.ability, …)`). V1 is acceptable if the user prefers flat; V2 is not recommended.

```ts
export interface Principal { ability: AppAbility, userId: string | null }   // userId: null ⇒ system or bearer
export interface ScopedContext { principal: Principal, tx?: PgTransaction /* sub-plan C */ }

export function systemContext(reason: SystemReason): ScopedContext {
  return { principal: { ability: systemAbility(reason), userId: null } }
}
/** @deprecated until README §F3 classifies its ~54 sites */
export const SYSTEM_CONTEXT = systemContext('legacy:system-context')
```

Stamping under V3 + option A: `authorId: ctx.principal.userId ?? input.authorId` (customer-notes), `ownerId: await resolveMeetingOwnerId(ctx)` reads `ctx.principal.ability.can('own','Meeting') ? ctx.principal.userId : getSystemOwnerId()`; the system passthrough at `crud.ts:34` becomes `if (ctx.principal.userId === null) return input` (a bearer has no `create Meeting` verb, so the branch is unreachable for it). Optional CASL-native default: `{ ...rulesToFields(ability,'create',spec.caslSubject), ...input }` (F5) when the create rule carries `{ authorId: user.id }` — makes the stamp and the instance gate (§3.2 step 4) the same fact.

Construction sites after the change (replacing `06` S2's 9 actor + 22 ctx sites): `protectedProcedure` (session → `principal`), `<entity>ShareableProcedure` (token → bearer `principal`), `protectDashboardPage` (RSC), `resolveShareTokenAbility` callers in `route.ts`, `systemContext(reason)` in jobs/webhooks/scripts. Five kinds of site, one shape.

---

## 5. Bespoke reads and cross-entity reads

### 5.1 The four heaviest consumers

| Site | Today | With the adapter |
|---|---|---|
| `customers.router/business.router.ts:64` (`list`) | `and(requireResolvedScope(ctx.scope), searchWhere, filterWhere)`; `ctx.scope` from `customerProcedure` (`customers.router/procedures.ts:26-29`) | `scopedWhere(ctx, 'read', customerServerSpec, searchWhere, filterWhere)`; `customerProcedure` loses its scope step (or is deleted — README §L5). `db.$count(customers, where)` `:94` unchanged (sync predicate). |
| `business.router.ts:124,129` (`search`) | `gatedPhoneSql(canSeeUngatedPhone(ctx.actor))`, `and(textWhere, requireResolvedScope(ctx.scope))` | `gatedPhoneSql(canSeeUngatedPhone(ctx.principal.ability))`, `scopedWhere(ctx,'read',customerServerSpec, textWhere)`; the `isOmni` text-search branch `:107` stays a business gate. |
| `features/customer-pipelines/dal/server/get-customer-profile.ts:54,97,126,236` | `requireResolvedScope(resolveActorScope(<spec>, actor))` ×4 (customer, meeting, proposal, project) | `toWhere(ability,'read',<spec>)` ×4 — the cross-entity "financial wall" (`:125-126`) is unchanged in mechanism: a dispatcher has no `read Proposal` → `sql\`false\``. `canReadProposals` `:36` → `ability.can('read','Proposal')`. The unscoped note read `:190-204` and proposal-views read `:206-222` are Ledger-1 items (README E1-5 class) and should take `toWhere(ability,'read',customerNoteServerSpec)` / a proposal-views spec. |
| `…/get-customer-pipeline-items.ts:51,199,225-226,248,277-278,397,430` | `requireResolvedScope(resolveActorScope(spec, actor))`; builders receive `actor` | `toWhere(ability,'read',spec)`; builders receive `ability` (or the compiled fragments they already take at `:78,127`). `maskFinancials(…, ability.can('read','Proposal'))`. |
| `entities/media-files/dal/server/media-ops.ts:36,57,90,112,121` | table-parameterised; `requireResolvedScope(ctx.scope)` where `ctx.scope` = the parent bridge stamped by `projectMediaProcedure`/`proposalMediaProcedure` (`proposals.router/procedures.ts:39-42`) | the ops must know the **spec** (not just the table) to compile: `listMediaByOwner(spec, ownerColumn, ctx, ownerId)` → `scopedWhere(ctx,'read',spec, eq(ownerColumn, ownerId))`; `reorderMedia(spec, ctx, updates)` → per-row `and(eq(id), toWhere(ability,'update',spec))` inside the tx; `moveMediaPhase` → `'update'`; `setHeroImage` → probe with `'read'` `:109-113` then `'update'` `:121`. Signature change is mechanical (`MediaTable` already narrows the table; `spec.table` supplies it). |

`scopedWhere` is the only helper warranted: it is `and(toWhere(...), ...extra)` and its value is *recognisability* (§5.3). A `scopedSelect(ctx, action, spec)` returning a pre-`where`d builder was considered and rejected — every bespoke read here selects custom columns and joins (`get-customer-profile.ts:40-49`, `business.router.ts:78-89`), so a builder wrapper would be fought at each site.

### 5.2 Services / jobs / route handlers
They already pass a `ScopedContext` first (`dal-conventions.md#scoped-context-first-arg`); with V3 they pass `systemContext(reason)` or the `principal` handed down from the route. `buildUserContext` (`helpers.ts:65-78`, 2 callers) is deleted — both callers hold `ctx` (`meeting-flow.router.ts:71`, `projects.router/business.router.ts:67-71`) and were only re-deriving what `ctx` had.

### 5.3 How a raw-table wall guard recognises adapter-scoped queries
`dal-conventions.md#only-dal-imports-db` (`:9-15`) is "enforced by convention". The repo already ships two custom flat-config rules (`eslint.config.js:33` `project/no-raw-nav-paths`, `:73` `project/no-inline-table-config`), so a third is the same shape:

1. **File wall** (README §E2, mechanical): `db.select()/db.query.<t>/db.update/db.delete` on a *scoped* table (tables of specs that declare `caslSubject`) only under `src/shared/entities/<x>/dal/server/**`, `src/features/**/dal/server/**`, and the allowlist `src/shared/domains/permissions/scope/operators/**` (they emit correlated subqueries) + tombstoned S8 files. Everything else must call a DAL fn.
2. **Predicate heuristic** (inside the allowed files): for each `.from(<scopedTable>)` / `.update(<scopedTable>)` / `.delete(<scopedTable>)` call, require that the **enclosing function body** contains a call to `toWhere(` or `scopedWhere(` or `canReach(`, or the file-level pragma `/* scope: system */` for SYSTEM-only readers (`customers/dal/server/queries.ts:107-177` — attribution/phone/enrollment lookups — are the honest examples). This is a heuristic, not a proof — it catches the *forgotten* scope (today's `get-customer-profile.ts:190-204` notes read would be flagged), not a wrong action.
3. Operators' subqueries pass (1) by allowlist and (2) trivially (no principal, `toSql` bodies are the scope).

---

## 6. Migration diff sketch (engine + DAL seams; not a plan)

| File | Today | After |
|---|---|---|
| `src/shared/domains/permissions/scope/actor.ts` | `type Actor = user \| token \| system`; `userActor/tokenActor/systemActor` | **DELETE** |
| `scope/system-reasons.ts` | `type SystemReason` (2 variants) | KEEP; becomes the parameter type of `systemAbility(reason)`; grows per README §F3 |
| `scope/compile-scope.ts:22-35` | `compileScope(actor, action, subject, ctx)` with system/token branches `:23-26` | `compileScope(ability: AppAbility, action, subject, ctx: OperatorCtx): SQL \| undefined` — `rulesToAST` → `interpret`; `null` → `sql\`false\``; empty AND → `undefined` |
| `scope/interpret.ts:38-57` | filters `null` children before `or()` `:49-56` — `or(allow-all, X)` degrades to `X` (`02` E-11; unreachable via `rulesToAST` because a conditionless rule short-circuits at the top, F1/Q3b, but wrong for nested compounds and for any future operator returning "no constraint") | `if (node.operator === 'or' && node.value.some(c => interpret(c, ctx) === undefined)) return undefined` before filtering; `and` unchanged |
| `scope/operators.ts:12,21-26` | `OperatorCtx { table, pk, actor }`; `toJS?: (node, viewer: Actor)` | `OperatorCtx { table, pk }` (option A) — or `{ table, pk, principalId: string \| null }` (B); `toJS?: (node, row) => boolean` |
| `scope/operators/meeting-participation.ts:33-38` | `ctx.actor.kind` guard + `ctx.actor.userId` | `const { via, userId } = node.value`; add `assertOperatorTable(ctx, ...)` for the `meetingId` branch (`:59-63` hardcodes `proposals.meetingId`; README §C10) |
| `scope/operators/derived-pipeline.ts:29-35` | ignores `ctx` | `assertOperatorTable(ctx, customers)` (README §C10) |
| `scope/conditions-matcher.ts:41-49` | instructions only | unchanged under §2 option (i); under (ii) passes server interpreters |
| `src/shared/domains/permissions/lib/share-token-actor.ts:21-29` | `resolveShareTokenActor(token,'proposal'): Actor \| null` | `resolveShareTokenAbility(token,'proposal'): AppAbility \| null` (§1.3) — the ONE bearer path (README §F4) |
| `src/shared/dal/server/lib/resolve-actor-scope.ts` | `resolveActorScope(spec, actor)`, `verbOnly(actor, action, subject)`, `canAccess(spec, actor, id, action='read')` | **RENAME** `casl-drizzle.ts`: `toWhere(ability, action, spec)`, private `verbWhere`, `canReach(ability, action, spec, id)`, `permittedFields`, `assertCan`, `assertCanOn`, `scopedWhere` (§2) |
| `src/shared/dal/server/lib/scope.ts` | legacy `resolveEffectiveScope`/`bridgeToParent`/`isVisible`/`isInScope` | **DELETE** (README §F) — its 1 live `isInScope` caller `proposal-views/dal/server/queries.ts:36` → `toWhere` |
| `src/shared/dal/server/lib/helpers.ts:65-78,95-102` | `buildUserContext(userId, role, spec)`, `requireResolvedScope(scope)` | **DELETE both**; `dalDbOperation`, `dalVerifySuccess` stay |
| `src/shared/dal/server/lib/create-crud-dal.ts:117,213,264; 129-157` | consumes `ctx.scope`; create unscoped | §3: per-slot `toWhere(ctx.principal.ability, SLOT_ACTION, spec)`, instance gate, parent probe, `permittedFields` |
| `src/shared/dal/server/types.ts:35-47,53-58,68-70,75-78,192,200,209` | `ScopedContext { session, ability, scope, actor }`; `SYSTEM_CONTEXT`; `systemContext`; `VisibilityScope`; `spec.visibility?`; `spec.parent { spec, fk }`; `shareable` | `ScopedContext { principal, tx? }` (V3); `systemContext(reason)` via `systemAbility`; `VisibilityScope` **DELETE**; `visibility` **DELETE**; `parent { spec, fk, action? }`; `shareable` KEEP (the bearer procedure needs `tokenColumn` only if the `{ token }` shape is chosen) |
| `src/shared/entities/customers/lib/phone-gating-sql.ts:42-46` | `canSeeUngatedPhone(actor)` | `canSeeUngatedPhone(ability) = ability.can('read','UngatedPhone')` |
| `src/trpc/lib/middleware/resolve-trpc-actor-scope.ts` | `resolveTrpcActorScope(spec, {userId, ability})` | **DELETE** |
| `src/trpc/lib/middleware/scope-middleware.ts` | `resolveVisibilityScope` | **DELETE** |
| `src/trpc/lib/middleware/shareable-middleware.ts:31-75` | session → legacy scope + `userActor`; token → `tokenActor(eq(tokenColumn, token))`, `ability: null` | session → `principal` from `ctx`; token → `principal = { ability: await resolveShareTokenAbility(...), userId: null }` (UNAUTHORIZED on `null`) |
| `src/trpc/lib/create-crud-router.ts:80,98-105,118-120,147-149,185-230` | `resolveScope` option; `assertCan`/`assertCanUpdateFields` (skipped when `ability` null) | drop `resolveScope`, `SLOT_ACTIONS`, both asserts (now DAL, §3); the router only maps `DalError` |
| `src/trpc/init.ts:46-62` | stamps `ability`, `scope: null`, `actor` | stamps `principal: { ability, userId: session.user.id }`; `agentProcedure`/`superAdminProcedure` read `ctx.principal.ability` |
| `src/trpc/types.ts:44-57` | `BaseTRPCContext { session, ability, scope, actor }` | `{ session: BetterAuthSession \| null, principal: Principal \| null }` |
| `src/trpc/routers/*/procedures.ts` (customers `:26-29`, meetings, proposals `:28-42`, projects, applications `:21-22`) | per-entity scope-stamping procedures | **DELETE** the scope step (README §L5); keep only where a non-scope narrowing exists |
| `src/app/api/proposals/[proposalId]/{pdf,summary}/route.ts:21-27 / :24-31`, `proposals.router/views.router.ts:41-50` | hand-built `{ session:null, ability:null, scope: resolveActorScope(...), actor }` | `{ principal: { ability, userId: null } }` from `resolveShareTokenAbility`; `pdf/route.ts:36`'s `SYSTEM_CONTEXT` re-read becomes the same bearer ctx (README S12 class A) |
| `src/shared/entities/customer-notes/lib/{server-spec.ts:42-97, assert-note-author.ts}` | create probe + author-or-admin hooks | hooks shrink to the `authorId` stamp; rules `{ authorId: user.id }` (README §D4) |
| `features/customer-pipelines/dal/server/{get-customer-profile,get-customer-pipeline-items,move-customer-pipeline-item}.ts` | `actor` + `resolveActorScope` + `scopedFor` | `ability` + `toWhere`; `scopedFor` deleted |

Line-count sense-check: deletions ≈ `actor.ts` (29) + `scope.ts` (110) + `resolve-trpc-actor-scope.ts` (23) + `scope-middleware.ts` (25) + `buildUserContext`/`requireResolvedScope` (~45) + router asserts (~50); additions ≈ `casl-drizzle.ts` (~120) + DAL slot logic (~60) + bearer builder (~25).

---

## 7. Decisions the user must rule on (ranked)

1. **Mutation row-scope invariant (§3, F2):** `toWhere(action)` alone (pure CASL; requires D1/D3 to guarantee conditions on every mutation rule before the factory flips) vs `toWhere(action) ∧ toWhere('read')` (engine invariant; recommended — deny-safe, mirrors today's behaviour, removable later).
2. **`ScopedContext` v2 shape (§4):** V3 `{ principal: { ability, userId }, tx? }` (recommended) vs V1 flat `{ ability, userId, tx? }`.
3. **Parent bridge (§2.1):** structural `spec.parent { spec, fk, action? }` with the *same-subject child → verb-only* rule (recommended) vs `$parentReachable` rule operator; and whether the two media children get their own subjects now.
4. **Custom operators in instance checks (F3, §2):** boot-assert "no custom operator on field-restricted or mutation rules" now (recommended) vs server interpreters over adapter-selected auth facts.
5. **User id in operators (§1.2):** option A bake-in (recommended) vs B ctx param.
6. **Bearer condition shape (§1.3):** `{ id }` after `validateShareToken` (recommended, one path) vs `{ token }` (zero extra query).
7. **"Unconditional" encoding (§2):** `undefined` (recommended; kills `requireResolvedScope` and `?? sql\`true\``) vs `null`.
