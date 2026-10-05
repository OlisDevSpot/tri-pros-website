# 23 — Design D: ports & adapters around a pure permissions core (2026-09-16)

> One of four alternative interface designs for the #285 permissions module. Constraint for this one: **the core — rules → per-action row predicate + field set + probe — is a pure, fully testable module** with zero imports from tRPC, Next.js, better-auth or the live `db`. A cross-seam dependency becomes a port only where two adapters are justified ("one adapter means a hypothetical seam; two adapters means a real one"). Satisfies README §L1–§L13 and tracker §2 D-01…D-25. Read-only design; nothing here is implemented. Library facts re-checked against the installed packages today: `drizzle-orm/pg-core` exports a standalone `QueryBuilder` (`constructor(dialect?)`) and `PgDialect.sqlToQuery(sql)`; `Column.notNull: boolean`; `@casl/ability@6.8.0` `rulesFor(action, subjectType?, field?)`; `drizzle-orm/pg-proxy` `drizzle(callback)`.
>
> ⚠️ Stale-ref note — `17-sub-entity-as-field-example.md` §2 authors `$participatesViaMeeting` / `$inDerivedPipeline` on **`update`** rules (agent `can('update','Customer',['age','profile.*'],{ $participatesViaMeeting })`, dispatcher `can('update','Customer',['profile.*','pipelineStage'],{ $inDerivedPipeline })`). D-19 (locked 09-09) says operators appear only on field-less `read` rules. This design follows D-19: mutation rules carry scalar conditions or none, and the row restriction on a mutation comes from L8's `∧ read`. The emitted SQL in 17 §6 is unchanged by this (the read bridge supplies the same predicate).

## 0. The shape in one paragraph

The **module** is `src/shared/domains/permissions`. Its **interface** to the rest of the app is six functions on a `Compiler` plus three rule factories; its **depth** comes from the compiler owning every CASL/ucast/Drizzle detail (field-aware AST walk, parent bridge, L8, sentinels, `cannot` ordering) so a caller learns one call (`scopedWhere`) and gets the whole matrix — that is the **leverage**. **Locality** comes from the core having no seam to the framework at all: the five **ports** (identity, rule source, operator registry, executor, client transport) sit *around* it, each with a production **adapter** and a test adapter, and the core is constructed once per process with the operator registry bound (`createCompiler`). The one idea that makes the core testable: **it builds every subquery with Drizzle's standalone `QueryBuilder` and never executes anything** — the DAL attaches the returned fragment to an executor (`ctx.tx ?? db`) at its own seam, and tests compare `PgDialect().sqlToQuery(fragment)` strings. The three-way `null` disappears because the core returns a tagged `RowScope` (`all | none | where`) and nothing is ever stored on a context to be forgotten.

## 1. Interface of the pure core

### 1.1 Layout and the import rule

```
src/shared/domains/permissions/
  core/                    PURE — may import: @casl/ability (+/extra), drizzle-orm (and, eq, or, not, inArray, sql,
                           QueryBuilder, PgDialect types), db/schema tables (data only), zod types. Nothing else.
    types.ts               Actor · ScopedContext · RowScope · FieldVerdict · CoreSpec · PermissionsWiringError
    rules.ts               conditionsMatcher · buildAbility · hydrateAbility · bearerRules · systemRules · assertRuleInvariants   (client-safe)
    field-ast.ts           rulesToAstForField — the ~15-line mirror of @casl/ability/extra's rulesToQuery over rulesFor(action, subject, field)
    interpret.ts           ucast AST (structural ScopeNode, no @ucast dep — D-01) → SQL, over an INJECTED OperatorRegistry
    compile.ts             createCompiler({ operators, qb? }) → Compiler · whereOf · andScopes
    ports.ts               the five port interfaces (types only)
  adapters/
    identity.better-auth.ts ('server-only')     identity.fixed.ts
    rules.static.ts         (today's abilities.ts body)   rules.fixture.ts (test helper: can/cannot → RawRule[])
    operators.server.ts     ('server-only'; EXISTS bodies built on ctx.qb)   operators.fake.ts · operators.empty.ts
    transport.rsc.tsx       ('use client' AbilityBoundary, packed rules)   transport.direct.tsx (takes an ability)
  server/
    request-actor.ts        ('server-only') getRequestActor = cache(…) · bearerActor(spec, rowId) · systemContext(reason)
    compiler.ts             ('server-only') export const permissions = createCompiler({ operators: serverOperators })
src/shared/dal/server/lib/create-crud-dal.ts   consumes `permissions` and the Executor port
```

`core/**` never imports `adapters/`, `server/`, `@/trpc`, `next/*`, `@/shared/domains/auth`, or `@/shared/db` (the index). Enforced with an ESLint `no-restricted-imports` override on `core/**` — the same mechanism D-24's wall uses.

### 1.2 Types

```ts
// core/types.ts
export interface Actor { ability: AppAbility; userId: string | null }            // L7, unchanged
export interface ScopedContext { actor: Actor; tx?: Executor }                   // L7's literal shape; `tx` accepts a transaction, the live db, or a test executor (P4)

/** The ONLY row-scope shape the core returns. No null, no undefined, no SQL sentinel. */
export type RowScope =
  | { readonly kind: 'all' }                       // unconditional allow: empty AND (manage all, conditionless rule)
  | { readonly kind: 'none' }                      // deny: no rule for the action (F1), or not(allow-all)
  | { readonly kind: 'where'; readonly sql: SQL }  // predicate over the spec's OWN table; parent columns only inside subqueries

export type FieldVerdict = { ok: true } | { ok: false; field: string }

/** The slice of EntityServerSpec the core reads. A child declares ONLY `parent` (L13); its subject is inferred. */
export interface CoreSpec {
  table: PgTable
  primaryKey?: string                              // default 'id'
  caslSubject?: AppSubject                         // roots always; a child only when it has own-row rules (CustomerNote {authorId})
  parent?: { spec: CoreSpec; fk: PgColumn; collection: string }
}

export class PermissionsWiringError extends Error {}   // the core's only throw: configuration, never an authorization outcome
```

### 1.3 Functions, invariants, error modes

```ts
// core/rules.ts — client-safe (reads SCOPE_OPERATOR_NAMES, never an operator body)
export const conditionsMatcher: ConditionsMatcher<AppConditions>                  // ONE module, used by the server builder AND the client hydrator (L10)
export function buildAbility(rules: RawRuleOf<AppAbility>[]): AppAbility          // createMongoAbility(rules, { conditionsMatcher })
export function hydrateAbility(packed: PackRule<RawRuleOf<AppAbility>>[]): AppAbility
export function bearerRules(subject: AppSubject, rowId: string, allowlist: readonly string[]): RawRuleOf<AppAbility>[]
   // [ can('read', S, { id }), can('update', S, [...allowlist], { id }) ] — L3/L12; a collection (`views`) is just a field in the allowlist
export function systemRules(reason: SystemReason): RawRuleOf<AppAbility>[]       // [ can('manage','all').because(reason) ] — L7
export function assertRuleInvariants(abilities: AppAbility[]): void
   // throws PermissionsWiringError on: an operator on a non-read or fielded rule (D-19); a conditioned `cannot` not authored last
   // for its action/subject (D-20, caveat A); a conditionless `can` beside a conditioned `can` for a mutation action, `{}` counted
   // as conditionless (D-02); an operator key not in SCOPE_OPERATOR_NAMES; a `collection` name colliding with a parent column (L13-7).

// core/compile.ts
export interface CompilerPorts { operators: OperatorRegistry; qb?: QueryBuilder }   // qb defaults to `new QueryBuilder()` — pure, no connection
export function createCompiler(ports: CompilerPorts): Compiler

export interface Compiler {
  /** Row predicate for (ability, action, spec[, field]). Field-aware (L13): `field` is a column or a `collection[.path]`. */
  compile(ability: AppAbility, action: AppAction, spec: CoreSpec, field?: string): RowScope
  /** L8: read ⇒ compile(read); update | delete | duplicate-source ⇒ compile(action) ∧ compile(read). Returns SQL, never null. */
  scopedWhere(ability: AppAbility, action: AppAction, spec: CoreSpec): SQL
  /** Type-level verb gate, no row: ability.can(action', subjectOf(spec), collectionPath?) — a `forbidden` that leaks nothing. */
  verb(ability: AppAbility, action: AppAction, spec: CoreSpec): boolean
  /** Child create (D-07): the parent point-probe — `{ table: parent.table, where: parent.pk = parentId ∧ compile('update', parent, collection) }`. */
  childCreateProbe(ability: AppAbility, spec: CoreSpec, parentId: string | number): { table: PgTable; where: SQL }
  /** Post-load field gate on the row that carries the rules (own row; the PARENT row for a collection child). Per-column `can` (L13-6). */
  fieldGate(ability: AppAbility, action: 'create' | 'update', spec: CoreSpec, contextRow: object, patch: Record<string, unknown>): FieldVerdict
  /** permittedFieldsOf with fieldsFrom = rule.fields ?? all columns of the subject table (14 §1.6). Tags contextRow with subject() itself. */
  permittedFields(ability: AppAbility, action: AppAction, spec: CoreSpec, contextRow: object): string[]
}
export function whereOf(scope: RowScope): SQL                 // all → sql`true` · none → sql`false` · where → sql   (the single sentinel conversion)
export function andScopes(...scopes: RowScope[]): RowScope    // none absorbs; all is the identity; where ∧ where = and(a, b)
```

**Invariants a caller may rely on**
1. Pure and synchronous: same inputs → same `RowScope`; no I/O, no globals, no module-level registry mutation, no `db`.
2. The predicate is over `spec.table`'s own columns; parent columns appear only inside `IN (SELECT pk FROM parent WHERE …)` subqueries built with the standalone `QueryBuilder`.
3. `compile` is total over `RowScope`. `none` covers both "no rule" (F1 `null`) and `not(allow-all)`. The DAL never sees `null` or `undefined`.
4. Child without own subject: `compile(action, child, field?)` = bridge of `compile(parentAction(action), parent, path)` with `path = field ? collection + '.' + field : collection` and `parentAction = read→read, else update` (L13-3); grandchildren recurse to dotted paths (L13-5). If the parent scope is `all` **and** `fk.notNull`, the bridge is elided (the FK guarantees a parent row); otherwise it is emitted. Child with own subject (`CustomerNote`): `own(action, field)` compiled against the child table `∧ compile('read', parent)` (L9/D-08 default bridge action).
5. `scopedWhere` for a mutation ANDs the read scope, always (L8). `whereOf` is the only sentinel conversion; `all` emits `sql\`true\`` (Postgres folds `id = $1 AND true`).
6. 6.8.0 ANDs every conditioned `cannot` regardless of authoring order (14 §1.5 caveat A); the core does not paper over it — `assertRuleInvariants` rejects mis-ordered rule sets at boot.
7. **Error modes.** Authorization outcomes are *values* (`none`, `false`, `[]`, `{ ok: false, field }`). Wiring mistakes *throw* `PermissionsWiringError`: unknown operator name at interpret time; a condition field that is not a column of the subject table; a compound operator other than `and|or|not`; `parent.fk` not on the child table; `primaryKey` not on the table; `collection` colliding with a parent column. Nothing else throws.
8. Performance: one `rulesFor` walk per (action, subject, field) — O(rules); one subquery per parent hop; no per-row work; the compiler object is built once per process.

### 1.4 The ports — production adapter, test adapter, and why each seam is real

| # | Port (the interface at the seam) | Production adapter | Test adapter | Why two adapters exist |
|---|---|---|---|---|
| P1 | `Identity { getSession(): Promise<BetterAuthSession \| null> }` | `betterAuthIdentity` — `auth.api.getSession({ headers: await headers() })`, `server-only` | `fixedIdentity(session)` | `getRequestActor` runs in tRPC `createContext`, RSC layouts and `route.ts` (L4) **and** in a `createCallerFactory` test / the I1 parity script with no HTTP request. |
| P2 | `RuleSource { rulesFor(principal: { id, role } \| null): RawRuleOf<AppAbility>[] }` | `staticRuleSource` — today's `abilities.ts` body returning `build().rules` | inline fixture arrays (`can('read','Proposal',{ ownerId: 'u1' })`) | Tests need 2–4 rules, not the 19-entity matrix; a DB-stored rule set (the named future) plugs in here with zero core change. `bearerRules` / `systemRules` are core *factories*, not sources. |
| P3 | `OperatorRegistry { get(name): ScopeOperator \| undefined; names(): readonly string[] }`, `ScopeOperator.toSql(node, ctx: { table, pk, qb })` | `serverOperators` — `participatesViaMeeting`, `inDerivedPipeline` (`hasNoMeeting` per J10), EXISTS bodies built on `ctx.qb`; `server-only` by policy (D-19) | `fakeOperators` — scalar stand-ins (`participatesViaMeeting` → `eq(table.ownerId, userId)`); `emptyOperators` for the throw path | The interpreter's dispatch is tested without joins; the boot assert compares `registry.names()` against `SCOPE_OPERATOR_NAMES` in both directions; no side-effect imports and no global `Map`; the client bundle cannot reach a body because `core/` never imports `adapters/`. |
| P4 | `Executor = PgDatabase<any, typeof schema>` (`select / insert / update / delete`) | `db` (node-postgres Pool → Neon) or a `tx` from `db.transaction` | `drizzle(pg-proxy, capture)`: `drizzle(async (sql, params) => { seen.push({ sql, params }); return { rows: [] } })`; PGLite if a real-execution test is ever wanted | The **core never executes**; the DAL does. `createCrudDal`'s composition (probe → `not-found`, `∧ read`, field gate → `forbidden`) is tested by captured SQL with no connection. Injection: `ScopedContext.tx?` per call, `createCrudDal(spec, cfg, { executor })` for the default (production `db`). |
| P5 | `AbilityBoundary` props `{ rules: PackRule[] } \| { ability: AppAbility }` — the ONE `'use client'` wrapper around `@casl/react` 7.0.1 | packed rules from the RSC that called `getRequestActor()` (dashboard layout, proposal page, root — L11 (b)) | `{ ability: buildAbility(fixtureRules) }` | Component tests / stories render `<Can>` consumers with no RSC; both adapters hydrate through the same `conditionsMatcher` module, so they cannot drift (L10). |

**Refused ports** (one implementation ⇒ hypothetical seam): the subquery builder (`QueryBuilder` is pure and identical in prod and test — a plain dependency); the SQL dialect (`PgDialect`, same); CASL itself; a spec registry (static data); `subjectOf(spec)` (a function); a `$parentReachable` operator (the R-shape L9 rejected); a clock or logger (nothing here needs one).

### 1.5 The six caller kinds

```ts
// (1) CRUD factory slot — update; root or child, one shape
const exec = ctx.tx ?? executor
if (!permissions.verb(ab, 'update', spec)) throw new ThrowableDalError({ type: 'forbidden' })
const where = and(eq(pk, id), permissions.scopedWhere(ab, 'update', spec))           // = compile(update) ∧ compile(read)
const [row] = await exec.select().from(spec.table).where(where).limit(1)             // doubles as meta.previousRow
if (!row) throw new ThrowableDalError({ type: 'not-found' })
const ctxRow = spec.parent && !spec.caslSubject ? await loadParent(exec, spec, row) : row  // collection child: the parent row carries the rules
const v = permissions.fieldGate(ab, 'update', spec, ctxRow, validated)
if (!v.ok) throw new ThrowableDalError({ type: 'forbidden', field: v.field })
const [updated] = await exec.update(spec.table).set(validated).where(where).returning()   // same WHERE → race-safe

// (2) bespoke DAL read joining two scoped tables — an agent's proposals with their incentives
export async function listProposalsWithIncentives(ctx: ScopedContext) {
  const ab = ctx.actor.ability, exec = ctx.tx ?? db
  return exec.select().from(proposals)
    .leftJoin(proposalIncentives, and(eq(proposalIncentives.proposalId, proposals.id),
      permissions.scopedWhere(ab, 'read', proposalIncentiveSpec)))                     // child scope lives in ON, not WHERE — keeps the LEFT JOIN left
    .where(permissions.scopedWhere(ab, 'read', proposalServerSpec))
}

// (3) tRPC handler with a client-supplied id — no hand check; the DAL probes (D-07)
upsert: agentProcedure.input(z.object({ id: z.uuid(), data: customerProfilePatchSchema }))
  .mutation(({ ctx, input }) => dalToTrpc(customerProfileCrud.upsert(ctx, { customerId: input.id, patch: input.data })))

// (4) RSC guard + rules shipping (dashboard layout)
const { session, actor } = await getRequestActor()            // cache()'d — the same call tRPC createContext and prefetch make (L4)
if (!session) return <SignIn />
if (actor.ability.cannot('access', 'Dashboard')) redirect('/')
return <AbilityBoundary rules={packRules(actor.ability.rules)}>{children}</AbilityBoundary>

// (5) route.ts (pdf) — bearer path; route handlers get no React memo: call once, pass down
const validated = await validateShareToken(token, 'proposal')                       // runs on P4's production executor
if (!validated.valid) return new Response(null, { status: 401 })
const ctx = { actor: bearerActor(proposalServerSpec, validated.resourceId) }        // rules from spec.shareable.allowlist
const proposal = await getFullView(ctx, { id: proposalId })                          // WHERE id = $1 AND id = <token row> → 404 on mismatch, no leak

// (6) client component — the same rules, instance checks via subject()
const ability = useAbility<AppAbility>()
<Can I="update" this={subject('Customer', customer)} field="profile.hoa">…</Can>
ability.can('update', subject('Proposal', proposal), 'views')
```

Construction sites (the only places an `Actor` is born): `getRequestActor()` (tRPC `createContext`, RSC, `route.ts`), `bearerActor(spec, rowId)` (inside `<entity>ShareableProcedure` and token routes, after `validateShareToken`), `systemContext(reason)` (jobs, webhooks, scripts). `bearerActor` reads the allowlist from `spec.shareable = { tokenColumn, allowlist }` so the entity, not the router, declares what a bearer may write (L12: `['financeOptionId','cashInDealCents','views']`).

## 2. Usage examples

### 2.1 `recordView` — a bearer creates a proposal view
```ts
// spec (new): proposalViewSpec = { table: proposalViews, parent: { spec: proposalServerSpec, fk: proposalViews.proposalId, collection: 'views' } }
recordView: proposalShareableProcedure.input(recordViewSchema)
  .mutation(({ ctx, input }) => dalToTrpc(proposalViewCrud.create(ctx, input)))     // ctx.actor = bearerActor; no systemProcedure, no SYSTEM_CONTEXT
// inside create (child branch):
//   verb  : ability.can('update', 'Proposal', 'views')  → true for the bearer, false for a dispatcher → forbidden
//   probe : permissions.childCreateProbe(ab, proposalViewSpec, input.proposalId)
//           → { table: proposals, where: "proposals"."id" = $1 and "proposals"."id" = $2 }   params [p1, p1]   (17 §6 #1)
//           exec.select({ ok: sql`1` }).from(probe.table).where(probe.where).limit(1) → miss ⇒ not-found (D-07)
//   insert → after-hook dispatches sendViewNotificationJob (unchanged)
```
A bearer for `p1` posting `proposalId: p2` → `id = p2 AND id = p1` → 0 rows → NOT_FOUND. A bearer touching `incentives` → `compile('update', Proposal, 'incentives')` = `none` → `… and false` → NOT_FOUND. No hand check anywhere.

### 2.2 `profile.upsert` — a dispatcher updates a customer's profile facet
```ts
// rules : can('read','Customer',{ $inDerivedPipeline: ['leads','rehash','dead','fresh'] })   ← operator on read only (D-19)
//         can('update','Customer',['profile.*','pipelineStage', ...leadContactFields])          ← conditionless; row reach comes from L8
// spec  : customerProfileSpec = { table: customerProfiles, primaryKey: 'customerId',
//                                 parent: { spec: customerServerSpec, fk: customerProfiles.customerId, collection: 'profile' } }
// upsert: probe parent ('update' Customer.profile on customerId) → not-found on miss → insert-or-update with
//   WHERE "customer_profiles"."customer_id" = $1
//     and ( compile(update, profile) = all, fk notNull ⇒ bridge elided
//         ∧ compile(read, profile)   = "customer_profiles"."customer_id" in (select "id" from "customers" where <derived pipeline ∈ ($2…)>) )
//   fieldGate(ab, 'update', spec, parentRow, patch): can('update', subject('Customer', parentRow), 'profile.hoa') → true (fieldPatternMatcher expands profile.*)
```
The `cannot('update','CustomerProfile')` hand-check in `profile.router.ts:20` is deleted; `CustomerProfile` stops being a subject.

### 2.3 `customer-notes` — an own-row child
```ts
// spec : { table: customerNotes, caslSubject: 'CustomerNote', parent: { spec: customerServerSpec, fk: customerNotes.customerId, collection: 'notes' } }
// rules: can('read','CustomerNote'); can('create'|'update'|'delete','CustomerNote',{ authorId: userId })   // ids baked in (L7)
// delete: scopedWhere(ab, 'delete', noteSpec) = own(delete) ∧ bridge(read Customer) ∧ own(read) ∧ bridge(read Customer)
//   → "customer_notes"."author_id" = $1 and "customer_notes"."customer_id" in (select "id" from "customers" where exists(…participation…))
//     and "customer_notes"."customer_id" in (select "id" from "customers" where exists(…))      ← duplicate semi-join; Postgres folds it
// create: stamp authorId = ctx.actor.userId (before-hook) → fieldGate/instance can('create', subject('CustomerNote', stamped)) → parent probe (read Customer on input.customerId)
```
`assertNoteAuthorOrAdmin` and the two lazy-import hooks in `customer-notes/lib/server-spec.ts` are deleted; super-admin passes through `manage all`.

### 2.4 An agent lists proposals with their incentives — §1.5 (2). Emitted (agent stand-in `ownerId`):
```
… from "proposals" left join "proposal_incentives"
  on ("proposal_incentives"."proposal_id" = "proposals"."id"
      and "proposal_incentives"."proposal_id" in (select "id" from "proposals" where "proposals"."owner_id" = $1))
  where "proposals"."owner_id" = $2
```

## 3. Test strategy

**Runner — the J7 ruling this design asks for:** vitest, scoped to `src/shared/domains/permissions/**/*.test.ts` and `src/shared/dal/server/lib/create-crud-dal.test.ts`; `resolve.alias['server-only'] = 'server-only/empty'` (the package ships `empty.js`) so production operator bodies are importable; no env, no `@/shared/db` index, no network, no Next. If J7 is ruled "no runner", the same harness runs as `scripts/permissions/explain-parity.ts` under `tsx` and prints instead of asserting — the tests below are the parity script's rows.

```ts
const dialect = new PgDialect()
const render = (s: SQL) => dialect.sqlToQuery(s)                  // { sql, params } — compiled-SQL string comparison, no DB
const ab = (...rules: RawRuleOf<AppAbility>[]) => buildAbility(rules)                  // P2 fixture
const c = createCompiler({ operators: fakeOperators })            // P3 fake: participatesViaMeeting → eq(table.ownerId, node.value.userId)
```
Specs under test are the real ones (`proposalServerSpec`, `proposalViewSpec`, `proposalIncentiveSpec`, `customerProfileSpec`, `customerNoteSpec`); they import schema tables only. T6 defines a scratch `pgTable('application_answers', …)` fixture — no such table exists today; the case pins the recursion.

| # | Case | Input (rules · spec · action) | Expected |
|---|---|---|---|
| T1 | deny-by-no-rule | `ab()` · `proposalViewSpec` · `read` | `compile` → `{ kind: 'none' }`; `render(scopedWhere)` = `false`, params `[]` (17 §6 #6 collapses to this) |
| T2 | omni elides the bridge | `ab(can('manage','all'))` · `proposalViewSpec` · `read` | `compile` → `{ kind: 'all' }` (fk notNull); `render(scopedWhere)` = `true` |
| T3 | L13 child read bridge | `ab(can('read','Proposal',{ ownerId: 'u1' }))` · `proposalViewSpec` · `read` | `"proposal_views"."proposal_id" in (select "id" from "proposals" where "proposals"."owner_id" = $1)` · `['u1']` |
| T4 | L8 mutation ∧ read, `cannot` on a collection | `ab(can('read','Proposal',{ownerId:'u1'}), can('update','Proposal',{ownerId:'u1'}), cannot('update','Proposal',['incentives'],{status:'signed'}))` · `proposalIncentiveSpec` · `delete` | `("proposal_incentives"."proposal_id" in (select "id" from "proposals" where (not "proposals"."status" = $1 and "proposals"."owner_id" = $2)) and "proposal_incentives"."proposal_id" in (select "id" from "proposals" where "proposals"."owner_id" = $3))` · `['signed','u1','u1']` (17 §6 #4 verbatim) |
| T5 | bearer: create probe (D-07), denied collection, no delete, permitted fields | `ab(...bearerRules('Proposal','p1',['financeOptionId','cashInDealCents','views']))` · `proposalViewSpec` | `childCreateProbe(…,'p1').where` → `"proposals"."id" = $1 and "proposals"."id" = $2` · `['p1','p1']`; `compile('update', proposalServerSpec, 'incentives')` → `none`; `compile('delete', proposalServerSpec)` → `none`; `permittedFields(ab,'update',proposalServerSpec,{id:'p1'})` → `['financeOptionId','cashInDealCents','views']`, on `{id:'p2'}` → `[]` (F4) |
| T6 | grandchild dotted path (L13-5) | `ab(can('read','Meeting',{ownerId:'u1'}), can('update','Meeting',['applications.answers'],{ownerId:'u1'}))` · `applicationAnswerSpec` (answers → applications → meetings) · `update` | `"application_answers"."application_id" in (select "id" from "applications" where "applications"."meeting_id" in (select "id" from "meetings" where "meetings"."owner_id" = $1)) and <same shape for read, $2>` · `['u1','u1']`; `compile('update', applicationSpec, 'notes')` → `none` |
| T7 | own-row child + fieldGate | `ab(can('read','CustomerNote'), can('update','CustomerNote',{authorId:'u1'}), can('read','Customer',{ownerId:'u1'}))` · `customerNoteSpec` · `update` | WHERE = `"customer_notes"."author_id" = $1 and "customer_notes"."customer_id" in (select "id" from "customers" where "customers"."owner_id" = $2) and "customer_notes"."customer_id" in (select … = $3)` · `['u1','u1','u1']`; `fieldGate(ab,'update',spec,{authorId:'u2'},{content:'x'})` → `{ ok:false, field:'content' }`; `{authorId:'u1'}` → `{ ok:true }` |
| T8 | wiring errors + rule invariants | `createCompiler({ operators: emptyOperators }).compile(ab(can('read','Customer',{ $participatesViaMeeting:{via:'customerId',userId:'u1'} })), 'read', customerServerSpec)`; `assertRuleInvariants([ab(can('update','Customer',{ $participatesViaMeeting: … }))])`; a spec with `parent.fk = proposals.id` | throws `PermissionsWiringError` (unknown operator); throws (D-19: operator on update); throws (fk not on the child table) |

Two more at the DAL seam (P4): `createCrudDal(proposalViewSpec, undefined, { executor: captureDb })` with T5's bearer, `create({ proposalId: 'p2' })` → captured `select 1 … where "proposals"."id" = $1 and "proposals"."id" = $2` with `['p2','p1']`, result `{ success:false, error:{ type:'not-found' } }`, **no `insert` captured**; and `update` on `proposalIncentiveSpec` under T4's agent → the captured `update … where` string equals T4's WHERE (the slot did not drop `∧ read`). One parity case runs T3 and T4 against `serverOperators` (EXISTS bodies) instead of `fakeOperators` and asserts only shape, pinning LSP for P3.

## 4. What the implementation hides · dependency strategy

**Hidden behind `Compiler`:** `rulesToAST`'s field-blindness (F2) and the field-aware mirror; the `$`-stripping of operator names; the ucast AST shape (structural `ScopeNode`, no `@ucast/*` dep); the parent-action map; grandchild path building; the `all`/`none` algebra and the FK elision; `permittedFieldsOf`'s "untagged POJO → `[]`" trap (the core calls `subject()` itself, from `spec`); the 6.8.0 `cannot` ordering caveat (turned into a boot assert). **Hidden behind `getRequestActor`:** better-auth, `headers()`, React `cache()`, the single `defineAbilitiesFor` site. **Hidden behind the DAL slot:** which executor runs the fragment, probe → `not-found`, the parent-row load for collection children.

**Opened seams:** five, each with two live adapters (§1.4). **Not ports:** `QueryBuilder` / `PgDialect` (pure, one implementation), CASL (in-process pure), `subject()` tagging, the spec set. **Deleted, not adapted:** the global operator `Map` and its side-effect imports (`interpret.ts:15-16`, `operators.ts`); `compileScope`'s `kind` switch; `resolveActorScope` / `verbOnly` / `canAccess` (folded into `compile` / `childCreateProbe`); `requireResolvedScope` (there is no stored scope to require); `resolveShareTokenActor` (→ `validateShareToken` + `bearerActor`); `buildUserContext`; `SYSTEM_CONTEXT` (→ `systemContext(reason)`); per-entity scope procedures and `ctx.scope` / `ctx.ability` (L5).

**Dependency categories respected:** CASL evaluation and Drizzle query building stay in-process pure (the core); session lookup and query execution are local-substitutable (P1, P4); nothing in this module is a true external, so no port wraps a network.

## 5. SOLID + complexity audit of this design

- **SRP** — `rules.ts` builds and validates rule sets; `field-ast.ts` walks rules; `interpret.ts` walks the AST; `compile.ts` composes bridges and L8; the DAL executes. Evidence: only `compile.ts` both builds SQL and decides an outcome, and its single reason to change is "rules → RowScope".
- **OCP** — a new operator is one registry entry + one name in `SCOPE_OPERATOR_NAMES`; a new child is a spec with `parent`; a new principal kind (bearer, system, DB-stored rules) is a rule factory or a `RuleSource` adapter. The core's `switch`es are over the closed sets `and | or | not` and `read | else`.
- **LSP** — every adapter of P1–P5 is substitutable by construction; the parity case in §3 pins that `serverOperators` and `fakeOperators` yield the same predicate shape, and both P5 adapters hydrate through the same `conditionsMatcher`.
- **ISP** — the client imports `core/rules` only (6 exports); the DAL sees `Compiler` (6 methods) + `whereOf`; RSC sees `getRequestActor` + `packRules`. No caller sees the AST, the registry, or the dialect.
- **DIP** — `createCompiler(ports)` and `createCrudDal(spec, cfg, { executor })` receive their dependencies; `core/**` imports no adapter (lint-enforced). The concrete bindings live in exactly two files: `server/compiler.ts`, `server/request-actor.ts`.

**Largest function:** `compile` — branches: root / own-subject child / collection child (3) × field present (2), plus the parent-`all` elision and the `none` short-circuit ⇒ cyclomatic ≈ 8. `interpretCompound` ≈ 6; `fieldGate` ≈ 4; `assertRuleInvariants` ≈ 7 (one branch per invariant). Nothing above 10.

**Change cost:** new root entity — a spec + rules in `staticRuleSource` (0 core lines). New child — a spec with `parent` (0 core; 0 rules unless the parent's field lists change). New operator — one adapter file + one contract name (+ an optional JS interpreter for client instance checks) (0 core). New role — one `case` in `staticRuleSource` (0 core). New principal shape — a rule factory (0 core).

## 6. Trade-offs

- **Indirection the common caller pays:** `permissions.scopedWhere(ctx.actor.ability, action, spec)` instead of reading `ctx.scope` — one call, no ctx field to forget. A bespoke DAL author must put a joined child's scope in `ON`, not `WHERE` (lint-able, not enforced here).
- **`sql\`true\`` for omni** changes EXPLAIN-parity *text* for super-admin queries (`AND true` appears; plans are identical). Accepted so that `RowScope` is total; `kind` is exposed for a list query that wants to skip the WHERE.
- **Collection-child field gate loads the parent row** (one PK read) before `update` / `delete`. The pure-SQL alternative — `compile('update', parent, collection + '.' + col)` per patched column inside the WHERE — trades FORBIDDEN-naming-the-field for NOT_FOUND and one subquery per column; not chosen.
- **Where the ports could be premature:** P1 is the thinnest — its test adapter earns its keep only once tRPC-caller or RSC-guard tests exist; if J7 lands as "compiler-only", `getRequestActor` can call better-auth directly with zero loss to the core (the core never sees it). P5's `{ ability }` overload is only needed by component tests / stories. P3's fake registry is justified today by the throw-path test (T8) and shorter strings in T3–T7, but once operator bodies take `ctx.qb` the production registry is itself connection-free, so the fake is a convenience, not a necessity.
- **Migration drift to flag:** `derivedPipelineWhere(values)` (`customers/lib/derived-pipeline-sql.ts:8`) and the participation bodies build their EXISTS on the global `db`; each must accept `ctx.qb` for P3's production adapter to be connection-free — a signature change, no behaviour change.
- **`tx?: Executor`** widens L7's `tx?` from "a transaction" to "any Drizzle executor" to keep L7's literal shape; if that reads as dishonest, rename to `exec?` in the same change (0 semantic difference).
- **What this design does not buy:** it does not shrink the rule matrix (Q8 still needs its 25 rulings) and it does not decide 7c (bearer read masking); both sit above the core as rules and a projection, respectively.
