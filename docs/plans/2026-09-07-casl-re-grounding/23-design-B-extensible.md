# 23 — Design B: the extensible (Open/Closed) permissions interface

> One of four alternative interface designs for the #285 permissions module. **Constraint for this design:** maximise flexibility — every future need (manager role, new operators, junctions, grandchildren, DB-stored rules, a second bearer kind, bespoke two-table reads, jobs/webhooks, a second ORM target) lands as a *new file or a registration*, never as a branch inside an existing engine function.
> Satisfies every locked decision: L1–L5, L7–L10, L12–L13 (README §L, report 17), D-07, D-16–D-20 (tracker §2.1). Where a locked name exists (`Actor`, `ScopedContext`, `getRequestActor`, `bearerActor(spec, rowId)`, `systemContext(reason)`, `toWhere`, `scopedWhere`, `parent: { spec, fk, collection }`) this design keeps it verbatim. Read-only audit; nothing here is implemented. Code cites are the #285 worktree at HEAD (2026-09-16).

## 0. The one idea

**The engine is a closed pipeline of value objects; everything that varies is a registry.** Five things vary and each gets a registry or a port: *who acts* (bearer kinds), *what rules say* (role modules; rules source), *what a condition atom means* (operators, with one body per target), *how a table hangs off another* (specs), and *what language a predicate is emitted in* (targets). The engine functions (`compile`, `toWhere`, the five CRUD slots, the tRPC ladder) contain **no `switch` on kind, role, bearer, operator or target** — they iterate registries and combine `Scope` values. The single structural branch that survives is `spec.parent` (root vs child), which L9/L13 lock as structural and which lives in exactly one function.

The hazard the previous engine carried — three-way `null` (`null` allow / `sql\`false\`` deny / `undefined` unresolved) — is removed by making row scope a **closed union value** (`Scope`) with no "unresolved" member, and by having no cache of it on any context (`ctx.scope` is gone, L5): a query site either calls `scopedWhere(...)` inline or fails the raw-table lint (D-24). `undefined` appears only at the Drizzle boundary (`whereOf`), where it has Drizzle's meaning (drop the clause).

---

## 1. Interface

### 1.1 Value types (the vocabulary a caller learns once)

```ts
// src/shared/domains/permissions/actor.ts                                  (client-safe; types only)
export interface Actor { ability: AppAbility; userId: string | null }      // L7 — a plain record, no `kind`
export interface ScopedContext { actor: Actor; tx?: Tx }                    // L7 — tRPC ctx { session, actor, req?, resHeaders? } satisfies it structurally

// src/shared/domains/permissions/scope/value.ts                            (client-safe)
/** Row scope for (actor, action, spec). CLOSED union — there is no "unresolved" member. */
export type Scope<P = SQL> =
  | { readonly kind: 'all' }                       // no constraint: omni, or a conditionless grant   (was `null`)
  | { readonly kind: 'none' }                      // deny: no rule, or `cannot`-only               (was sql`false`)
  | { readonly kind: 'where'; readonly predicate: P }
export const Scope: { all: Scope<never>; none: Scope<never>; where<P>(p: P): Scope<P> }

// src/shared/domains/permissions/scope/target.ts                           (client-safe; the compiler-target port)
export interface Target<P, TTable = PgTable, TColumn = PgColumn> {
  readonly name: string                                                      // 'drizzle' | 'js' | …
  eq(col: TColumn, value: unknown): P;  in(col: TColumn, values: unknown[]): P
  and(ps: P[]): P;  or(ps: P[]): P;  not(p: P): P;  never(): P               // `never()` = the deny literal
  column(table: TTable, name: string): TColumn | undefined                   // existence check → boot assert, not runtime throw
  bridge(fk: TColumn, parent: { table: TTable; pk: TColumn }, parentWhere: P | undefined): P   // fk IN (SELECT pk FROM parent WHERE …)
}
export interface OperatorCtx<TTable = PgTable, TColumn = PgColumn> { table: TTable; pk: TColumn }   // L7 — principal-free

// src/shared/domains/permissions/spec/define.ts                             (server; Drizzle-typed topology)
export interface RootSpec<TTable extends PgTable = PgTable> {
  entityName: EntityName; caslSubject: AppSubject; table: TTable
  primaryKey?: string | readonly string[]                                    // composite allowed (junctions); default 'id'
  schemas: { insert; update; select }
  shareable?: { tokenColumn: string; bearerRules: (rowId: string, b: RuleBuilder) => void }   // L3/L12 allowlist lives on the entity
}
export interface ChildSpec<TTable extends PgTable = PgTable> {
  entityName: EntityName; table: TTable; primaryKey?: string | readonly string[]; schemas
  parent: {
    spec: EntityServerSpec; fk: PgColumn; collection: string               // L13 — the ONLY authorization declaration a child makes
    bridgeAction: (childAction: AppAction) => AppAction                    // filled by defineChildSpec; overridable (see 1.3)
  }
  caslSubject?: AppSubject                                                  // ONLY for own-row rules (L13-4: CustomerNote { authorId })
}
export type EntityServerSpec<TTable extends PgTable = PgTable> = RootSpec<TTable> | ChildSpec<TTable>
```

Derived, never declared: `subjectOf(spec)` = own `caslSubject` ?? `subjectOf(parent.spec)`; `fieldPathOf(spec, field?)` = `parent.collection[.field]`, composed upward while the parent is itself an inferred-subject child (`'applications.answers'`, L13-5).

### 1.2 Entry points, by caller kind

```ts
// ── principal builders (one per surface family, L7) ──────────────────────────────────────────── server/
export const getRequestActor: () => Promise<{ session: BetterAuthSession | null; actor: Actor }>   // cache()'d; L4. null session ⇒ deny-all ability
export function bearerActor(spec: RootSpec & { shareable }, rowId: string): Actor                  // L3 sugar over the row-share bearer kind
export function bearerActorFor<TIn>(kind: BearerKind<TIn>, input: TIn, exec?: Executor): Promise<Actor | null>   // any registered kind; null ⇒ UNAUTHORIZED at the caller
export function systemAbility(reason: SystemReason): AppAbility                                     // can('manage','all').because(reason)  (D-14)
export function systemContext(reason: SystemReason): ScopedContext                                  // { actor: { ability: systemAbility(reason), userId: null } }

// ── row scope (Drizzle-bound; 'server-only') ─────────────────────────────────────────────────── scope/drizzle.ts
export function toWhere(ability: AppAbility, action: AppAction, spec: EntityServerSpec, field?: string): Scope<SQL>   // pure, sync, no DB
export function scopedWhere(ability: AppAbility, action: AppAction, spec: EntityServerSpec, ...extra: (SQL | undefined)[]): SQL | undefined
//   = whereOf(scopes.all(toWhere(action), toWhere('read'))) ∧ extra      for update/delete/duplicate-source   (L8, permanent)
//   = whereOf(toWhere('read')) ∧ extra                                    for read
export function whereOf(scope: Scope<SQL>): SQL | undefined                 // the ONLY Scope→Drizzle exit: none ⇒ sql`false`, all ⇒ undefined
export const scopes: { all(...s: Scope<SQL>[]): Scope<SQL>; any(...s: Scope<SQL>[]): Scope<SQL> }   // none absorbs in all(); all absorbs in any() (fixes C9)

// ── gates (throw ThrowableDalError; 'server-only') ───────────────────────────────────────────── scope/gates.ts
export function assertCan(ability, action, spec, field?): void                        // type-level verb/field gate → { type: 'forbidden', field? }
export function assertCanOn(ability, action, spec, row): void                          // instance gate via subject(subjectOf(spec), row) — scalar conditions only (D-19)
export function permittedFields(ability, action, spec, row): string[]                  // permittedFieldsOf(..., subject(type,row), { fieldsFrom }) — roots + own-subject children (D-17)
export function probe(exec, ability, action, spec, id, field?): Promise<boolean>       // SELECT 1 … WHERE pk = id AND whereOf(toWhere(action, spec, field))
export function assertReachable(exec, ability, action, spec, id, field?): Promise<void> // probe → { type: 'not-found' }   (D-07: client id ⇒ NOT_FOUND)

// ── tRPC ladder (L5) ─────────────────────────────────────────────────────────────────────────── src/trpc/init.ts, procedures/bearer.ts
baseProcedure        // ctx: { session: S | null, actor }         actor.ability = deny-all when anonymous
protectedProcedure   // ctx: { session: S, actor }                asserts session (L2); builds NOTHING
agentProcedure       // + actor.ability.can('access','Dashboard')
superAdminProcedure  // + actor.ability.can('manage','all')
export function bearer<TIn>(kind: BearerKind<TIn>, pick: (raw: unknown) => TIn | undefined)   // middleware: session ⇒ reuse ctx.actor (agent-first); else validate → bearer actor; else UNAUTHORIZED
export const shareable = (spec) => bearer(rowShare(spec), raw => raw?.token ? { token: raw.token } : undefined)
//   <entity>ShareableProcedure = baseProcedure.use(shareable(spec))

// ── client ('use client' wrapper, L10) ───────────────────────────────────────────────────────── client/
<AbilityProvider rules={packRules(actor.ability.rules)}>   // hydrates createMongoAbility(unpackRules, { conditionsMatcher: sharedMatcher })
useAbility<AppAbility>(); <Can I do a this field>; subject(SUBJECT_CONST, row)   // re-tag after every JSON/superjson boundary
```

### 1.3 Extension points (registries and ports) — the Open side

```ts
// roles/  — one file per role; roles/index.ts is the barrel (a registration = one import line)
export type RoleRules = (user: { id: string }, b: RuleBuilder) => void
export function defineRole(role: UserRole, rules: RoleRules): void                     // throws on duplicate

// scope/operators/  — one file per operator; bodies keyed by TARGET name
export interface ScopeOperator {
  name: ScopeOperatorName                                                              // unprefixed (CASL strips `$`)
  on: readonly AppSubject[]                                                            // subject binding, asserted at boot (C10)
  bodies: { drizzle: (node: FieldNode, ctx: OperatorCtx) => SQL; js?: (node: FieldNode, row: Record<string, unknown>) => boolean; [target: string]: unknown }
}
export function defineScopeOperator(op: ScopeOperator): void
//   operators/manifest.ts (client-safe): SCOPE_OPERATOR_NAMES + the js bodies only; operators/index.ts (server-only): drizzle bodies

// bearers/  — one file per bearer kind
export interface BearerKind<TIn> {
  name: string
  validate: (input: TIn, exec: Executor) => Promise<BearerGrant | null>                 // ONE query; null ⇒ invalid
  rules: (grant: BearerGrant, b: RuleBuilder) => void                                   // ids baked in (L7); conditions scalar only (D-19)
}
export function defineBearerKind<TIn>(kind: BearerKind<TIn>): BearerKind<TIn>
export function rowShare(spec: RootSpec & { shareable }): BearerKind<{ token: string }>   // built-in: validate = SELECT pk WHERE tokenColumn = token; rules = spec.shareable.bearerRules

// spec/  — one file per entity
export function defineRootSpec<T>(input: RootSpec<T>): RootSpec<T>                        // registers for boot asserts
export function defineChildSpec<T>(input: Omit<ChildSpec<T>, 'parent'> & { parent: { spec; fk; collection; bridgeAction?: (a: AppAction) => AppAction } }): ChildSpec<T>
//   default bridgeAction: inferred-subject child ⇒ read→'read', create|update|delete→'update'  (L13-3); own-subject child ⇒ always 'read' (L9)

// server/ports.ts  — ports at the two local-substitutable seams + the rules seam
export interface SessionSource { get(headers: Headers): Promise<BetterAuthSession | null> }
export interface RulesSource  { for(user: { id: string; role: UserRole } | null): MaybePromise<RawRuleOf<AppAbility>[]> }
export type Executor = DbOrTx                                                             // `ctx.tx ?? db`
export function configurePermissions(p: Partial<{ sessions: SessionSource; rules: RulesSource; target: Target<SQL> }>): void   // composition root; tests override

// scope/targets/  — one file per emission language
export const drizzleTarget: Target<SQL, PgTable, PgColumn>
export function compile<P>(target: Target<P>, ability, action, subject, field: string | undefined, ctx: OperatorCtx): Scope<P>   // generic core
```

### 1.4 Invariants (what every adapter and every caller may rely on)

| # | Invariant | Enforced where |
|---|---|---|
| I1 | One session lookup + one ability build per request; nothing below `createContext`/the RSC layout rebuilds (L4) | `getRequestActor` is the only `defineAbilitiesFor`-equivalent call; lint forbids importing `buildAbility` outside `server/` + `bearers/` |
| I2 | `Actor` has no kind; bearer, system, omni, agent all flow through the same `compile` (L1/L7) | type |
| I3 | Mutation WHERE = `toWhere(action) ∧ toWhere('read')` (L8) | `scopedWhere` |
| I4 | No unresolved scope exists: `Scope` is closed; `undefined` only leaves `whereOf` | type + D-24 lint (`.from(<scoped table>)` needs `scopedWhere|toWhere|probe` in the enclosing fn) |
| I5 | A child's authorization is a field of its parent's subject (L13); a child with no `caslSubject` contributes no own predicate | `toWhere` |
| I6 | Custom operators only on field-less `read` rules; `cannot` last per action/subject; `{}` counts as conditionless (D-19/D-20/D-02) | `rules/audit.ts` boot assert over every role × every bearer kind's rules built with sentinel ids |
| I7 | Every operator declared in the manifest has a `drizzle` body and vice-versa; every operator is used only on subjects in `on` | `operators/index.ts` boot assert |
| I8 | `collection` never collides with a real parent column; `parent.fk` is a column of the child table; composite pks name real columns (L13-7) | `spec/assert.ts` boot assert over the spec registry |
| I9 | Every `UserRole` enum member has a `defineRole` | `roles/index.ts` boot assert |
| I10 | SQL-emitting modules are `server-only`; the client bundle sees manifest + js bodies + matcher only (C11) | `import 'server-only'` |
| I11 | Client-supplied id ⇒ point-probe ⇒ `not-found`; type-level denial ⇒ `forbidden` (D-07) | gates + factory slots |

### 1.5 Ordering constraints
1. Registration before use: `roles/index.ts`, `operators/index.ts`, `bearers/index.ts` and every `defineRootSpec/defineChildSpec` module are imported by `permissions/server/index.ts`, which runs the boot asserts at module init — before the first request. A spec module must import its parent's spec module (as today).
2. `getRequestActor()` (or a bearer/system builder) precedes every DAL call; a `route.ts` handler calls it once and passes `{ actor }` down (no memo there, L4).
3. `bearer(kind, pick)` middleware: session first (agent-first precedence, D-10), then token, then `UNAUTHORIZED`.
4. Inside the update slot: `assertCan` → before-hooks → validate → scoped load (`update ∧ read`) → field gate → write with the same WHERE → after-hooks. Delete: `assertCan` → scoped load → before → delete same WHERE → after. Create: `assertCan` → before → validate → root: `assertCanOn(validated)` / child: `assertReachable(parent, bridgeAction('create'), input[fk], collection)` → insert → after. Duplicate: `getById('read')` → create.
5. Rule authoring order inside a role: `can` rules, then `cannot` rules for the same action/subject (D-20) — the audit fails the boot otherwise.

### 1.6 Error modes
| Situation | Result | Surfaced as |
|---|---|---|
| Wiring: unknown operator, non-column field, mis-pointed fk, collection/column collision, missing role, `cannot` before `can`, operator on a field/mutation rule | throw at boot (module init) | deploy fails; never per-request |
| No session on `protectedProcedure` | `UNAUTHORIZED` | tRPC |
| Bearer token invalid / kind returns `null` | `UNAUTHORIZED` (no row info leaked) | tRPC / `route.ts` 401 |
| No rule for `action` on the subject (type-level) | `{ type: 'forbidden' }` | `dalToTrpc` → `FORBIDDEN` |
| Row/parent unreachable for a client-supplied id | `{ type: 'not-found' }` | `NOT_FOUND` (D-07) |
| Patched column outside permitted fields | `{ type: 'forbidden', field }` | `FORBIDDEN` naming the field |
| `toWhere`/`compile` at runtime | never throws for registered specs/operators (totality is what the boot asserts buy) | — |

### 1.7 Required configuration (composition root)
`server/index.ts` wires: `configurePermissions({ sessions: betterAuthSessions, rules: codeRulesSource, target: drizzleTarget })`; imports the three barrels + all spec modules; runs `assertRules()`, `assertOperators()`, `assertSpecs()`. The client wrapper receives `rules` from the RSC that resolved the actor (dashboard layout, proposal page, root layout per L11-(b)). No env vars.

### 1.8 Performance notes
- `toWhere` is pure and synchronous (no DB): bridges are nested `IN (SELECT …)` subqueries, depth = ancestry depth; Postgres plans them as semi-joins. A grandchild costs two nested subselects — exactly what report 17 §6 shows for one level.
- `manage all` compiles to `Scope.all` ⇒ **no bridge is emitted** for a child (the parent scope is `all`, so the subquery is skipped, not emitted as `IN (SELECT every parent)`); a `none` parent scope short-circuits to `none` without compiling the child.
- One ability per request (I1); rules carry the user id so there is no per-role cache — a deliberate non-goal (report 11 §1.2).
- `probe` = one round-trip; the update/delete slots do one scoped load + one scoped write (the load doubles as `previousRow`).
- Boot asserts are O(roles × rules × specs × operators) once per process.
- `packRules` payload = the current principal's rule count (bearer: 3 rules; agent: ~45).

### 1.9 The six caller kinds

```ts
// 1 · CRUD factory slot (src/shared/dal/server/lib/create-crud-dal.ts) — self-scopes per slot (D-16)
async function updateImpl(spec, cfg, ctx, { id, data }, callsite) {
  const { ability } = ctx.actor; const exec = ctx.tx ?? db
  assertCan(ability, 'update', spec)                                           // forbidden (type-level)
  const validated = spec.schemas.update.parse(await runBefore(cfg, callsite, data, ctx, { id }))
  const where = and(pkEq(spec, id), scopedWhere(ability, 'update', spec))    // update ∧ read (L8)
  const [row] = await exec.select().from(spec.table).where(where).limit(1)
  if (!row) throw new ThrowableDalError({ type: 'not-found' })                // D-07
  for (const col of definedKeys(validated))                                    // field gate — L13-6
    if (!fieldAllowed(ability, spec, row, col)) throw new ThrowableDalError({ type: 'forbidden', field: col })
  const [updated] = await exec.update(spec.table).set(validated).where(where).returning()   // race-safe: same WHERE
  if (!updated) throw new ThrowableDalError({ type: 'not-found' })
  return runAfter(cfg, callsite, updated, ctx, { previousRow: row, input: data })
}
// fieldAllowed: root / own-subject child → permittedFields(ability,'update',spec,row).includes(col)      (instance, D-17)
//               inferred-subject child   → ability.can('update', subjectOf(spec), `${fieldPathOf(spec)}.${col}`)   (type-level; the row-level part is already in `where`)

// 2 · bespoke DAL read joining two scoped tables (src/shared/modules/proposals/core/dal/server/queries.ts)
export function listProposalsWithIncentives(ctx: ScopedContext) {
  const { ability } = ctx.actor
  return dalDbOperation(() => (ctx.tx ?? db).select({ proposal: proposals, incentive: proposalIncentives })
    .from(proposals).leftJoin(proposalIncentives, eq(proposalIncentives.proposalId, proposals.id))
    .where(whereOf(scopes.all(toWhere(ability, 'read', proposalServerSpec),                 // rows of the outer table
                              toWhere(ability, 'read', proposalIncentiveServerSpec)))))    // incentives = Proposal.incentives field (L13)
}

// 3 · tRPC handler with a client-supplied id
getById: proposalShareableProcedure.input(z.object({ id: z.string().uuid(), token: z.string().optional() }))
  .query(async ({ ctx, input }) => {
    const row = dalToTrpc(await proposalCrud.getById(ctx, { id: input.id }))   // slot: pk = id ∧ scopedWhere('read')
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' })                        // bearer on the wrong row, agent outside participation — same answer
    return row
  })

// 4 · RSC guard (src/app/(frontend)/dashboard/layout.tsx)
const { session, actor } = await getRequestActor()                                    // the one build (L4)
if (!session) return <SignIn />
if (actor.ability.cannot('access', 'Dashboard')) redirect('/')
return <AbilityProvider rules={packRules(actor.ability.rules)}>{children}</AbilityProvider>   // L10

// 5 · route.ts (src/app/api/proposals/[proposalId]/pdf/route.ts)
export async function GET(req: Request, { params }) {
  const token = new URL(req.url).searchParams.get('token')
  const actor = token ? await bearerActorFor(rowShare(proposalServerSpec), { token }) : (await getRequestActor()).actor
  if (!actor) return new Response(null, { status: 401 })
  const result = await getFullView({ actor }, { id: params.proposalId })            // scoped read; miss ⇒ not-found ⇒ 404
  return result.success && result.data ? pdf(result.data) : new Response(null, { status: 404 })
}                                                                                       // no SYSTEM_CONTEXT re-read (README S12 class A)

// 6 · client component
const ability = useAbility<AppAbility>()
<Can I="update" this={subject(CUSTOMER, customer)} field="profile.hoa" ability={ability}>…</Can>
ability.can('update', subject(PROPOSAL, proposal), 'views')                             // same rules the server compiled
```

Jobs/webhooks use `systemContext('job:sync-zoho-sign-status')` — `manage all` ⇒ `Scope.all` ⇒ no WHERE, no branch (D-14).

---

## 2. Usage examples

### 2.1 `recordView` — a bearer creates a proposal view
```ts
// entities/proposals/lib/server-spec.ts
export const proposalServerSpec = defineRootSpec({ …, shareable: { tokenColumn: 'token',
  bearerRules: (id, { can }) => { can('read', 'Proposal', { id }); can('update', 'Proposal', ['financeOptionId', 'cashInDealCents', 'views'], { id }) } } })   // L12-7b
// entities/proposal-views/lib/server-spec.ts   (new; NOT in ENTITY_NAMES; subject inferred = 'Proposal')
export const proposalViewServerSpec = defineChildSpec({ entityName: PROPOSAL_VIEW, table: proposalViews, schemas,
  parent: { spec: proposalServerSpec, fk: proposalViews.proposalId, collection: 'views' } })
// trpc/routers/proposals.router/views.router.ts
recordView: proposalShareableProcedure.input(recordViewSchema)
  .mutation(({ ctx, input }) => dalToTrpc(proposalViewCrud.create(ctx, input)))   // ctx.actor = bearerActor(proposalServerSpec, rowId)
```
Create slot: `assertReachable(exec, ability, bridgeAction('create') = 'update', proposalServerSpec, input.proposalId, 'views')` → `SELECT 1 FROM proposals WHERE id = $1 AND id = $rowId` (report 17 §6 #1). A token for another proposal ⇒ `not-found`. `systemProcedure`, `resolveShareTokenActor`, the hand-built ctx literal and `SYSTEM_CONTEXT` all disappear.

### 2.2 `profile.upsert` — dispatcher updates a customer's profile facet
```ts
// roles/dispatcher.ts
can('read', 'Customer', { $inDerivedPipeline: DISPATCHER_PIPELINES })                 // operator: field-less read rule only (D-19)
can('update', 'Customer', ['name', 'phone', 'email', 'address', 'city', 'state', 'zip', 'pipelineStage', 'age', 'profile.*'])   // field-only; row reach = L8's ∧ read
```
(Report 17 §2 authored the update rule with `$inDerivedPipeline` on it; D-19 forbids that, and L8 is exactly what makes the field-only form safe: `toWhere('update')` is `all` for this rule, `∧ toWhere('read')` supplies the pipeline predicate. D-02's audit passes — no conditioned `update Customer` sibling exists for the dispatcher.)
```ts
// customers.router/profile.router.ts
upsert: agentProcedure.input(…).mutation(({ ctx, input }) => dalToTrpc(customerProfileCrud.upsert(ctx, { customerId: input.id, patch: input.data })))
```
No hand `cannot('update','CustomerProfile')` check; `CustomerProfile` is not a subject. Emitted: `UPDATE customer_profiles … WHERE customer_id = $1 AND customer_id IN (SELECT id FROM customers WHERE <read scope>)` (report 17 §6 #5), field gate `ability.can('update','Customer','profile.hoa')` per patched column.

### 2.3 `customer-notes` — own-row child
```ts
export const customerNoteServerSpec = defineChildSpec({ entityName: CUSTOMER_NOTE, table: customerNotes, schemas,
  caslSubject: CUSTOMER_NOTE,                                                  // keeps its subject: own-row rule below
  parent: { spec: customerServerSpec, fk: customerNotes.customerId, collection: 'notes' } })   // bridgeAction ⇒ always 'read' (own-subject default)
// roles/agent.ts (and dispatcher)
can('read', 'CustomerNote'); can('create', 'CustomerNote', { authorId: user.id })
can(['update', 'delete'], 'CustomerNote', { authorId: user.id })
```
Update WHERE: `id = $1 AND author_id = $me AND customer_id IN (SELECT id FROM customers WHERE <read scope for field 'notes'>)`. Create: `assertCanOn(ability,'create',spec,{ …input, authorId: ctx.actor.userId })` + `assertReachable(parent,'read', customerId, 'notes')`. `assertNoteAuthorOrAdmin`, both lazy-import hooks and the client mirror retire; `<Can I="delete" this={subject(CUSTOMER_NOTE, note)}>` answers per row.

### 2.4 Agent lists proposals with their incentives
§1.9 #2. Emitted: `… WHERE EXISTS(participation on proposals.meeting_id) AND proposal_incentives.proposal_id IN (SELECT id FROM proposals WHERE EXISTS(participation) [AND NOT status = 'signed' if a cannot names 'incentives'])`. A dispatcher (no `read Proposal`) gets `WHERE false` for both — one query, no hand wall.

### 2.5 Extension walkthroughs (each = new file(s) + one barrel line; engine untouched)

**New operator `$hasOpenProposal`** — `scope/operators/has-open-proposal.ts`:
```ts
defineScopeOperator({ name: 'hasOpenProposal', on: ['Customer'],
  bodies: { drizzle: (_n, ctx) => exists(db.select({ x: sql`1` }).from(proposals).innerJoin(meetings, …).where(and(eq(meetings.customerId, ctx.pk), isNull(proposals.contractSignedAt)))),
            js: (_n, row) => row.__facts?.hasOpenProposal === true } })       // js body optional; D-19 escape hatch (b)
```
+ add `'hasOpenProposal'` to `operators/manifest.ts` (client-safe list) + one import in `operators/index.ts`. Boot: manifest↔registry parity, `on` binding, "read-only, field-less" rule audit.

**Grandchild `application_answers`** — `entities/application-answers/lib/server-spec.ts`:
```ts
defineChildSpec({ entityName: APPLICATION_ANSWER, table: applicationAnswers, schemas,
  parent: { spec: applicationServerSpec, fk: applicationAnswers.applicationId, collection: 'answers' } })
// applicationServerSpec itself: defineChildSpec({ …, parent: { spec: meetingServerSpec, fk: applications.meetingId, collection: 'applications' } }) — subject inferred = 'Meeting' (Q8 pending)
```
`toWhere` recurses: field path `'applications.answers'`; WHERE = `application_id IN (SELECT id FROM applications WHERE meeting_id IN (SELECT id FROM meetings WHERE <Meeting read for field applications.answers>))`. Rule: `can('update','Meeting',['applications.*'], …)` covers answers and trades. Junction `x_application_trades`: same shape, `collection: 'trades'`, `primaryKey: 'id'`. Junction `x_project_media_files`: `primaryKey: ['projectId','mediaFileId']`, `collection: 'media'`; its link/unlink DAL is bespoke and adds the callsite rule `assertReachable(mediaFileSpec,'read', mediaFileId)` for the second side (callsite rule, not a spec invariant).

**Second bearer kind — lead-source intake `{ slug, token }`** — `bearers/lead-source-intake.ts`:
```ts
export const leadSourceIntake = defineBearerKind<{ slug: string; token: string }>({ name: 'lead-source-intake',
  validate: async ({ slug, token }, exec) => { const [row] = await exec.select({ id: leadSourcesTable.id, token: leadSourcesTable.token, isActive: … }).from(leadSourcesTable).where(eq(leadSourcesTable.slug, slug)).limit(1)
    return row && row.isActive && timingSafeEqual(row.token, token) ? { leadSourceId: row.id } : null },
  rules: ({ leadSourceId }, { can }) => { can('read', 'LeadSource', { id: leadSourceId }); can('create', 'Customer', { leadSourceId }) } })
// router: intakeProcedure = baseProcedure.use(bearer(leadSourceIntake, raw => raw?.slug && raw?.token ? { slug: raw.slug, token: raw.token } : undefined))
```
The intake page's raw `row.token !== token` compare (`intake/page.tsx:40`) becomes `bearerActorFor(leadSourceIntake, params)` — same builder in RSC and tRPC. A funnel bearer is the same shape: `validate` resolves `leadId` (+ whatever proves possession), `rules` = `can('update','Customer',[funnel-writable fields],{ id: leadId })`. `ctx.session == null` stays the truthfulness discriminator (L2); no engine file changes.

**Manager role** — `roles/manager.ts` + the enum member:
```ts
defineRole('manager', (_user, { can }) => { can('access', 'Dashboard'); can('read', ['Customer', 'Meeting', 'Proposal', 'Project']) })   // conditionless read on the 4 roots
```
Under L13 every child comes free: `rulesFor('read','Customer','notes')` matches the field-less rule, so notes, profile, views, incentives, media, applications and their answers are readable through the bridge without naming them. D-25 (not authored until hired) is honoured — this is the file that will be added.

---

## 3. What the implementation hides vs. what it exposes

**Hidden (closed):** `rulesToAST` + the ucast AST shape (C12); `rulesToASTForField`'s field-aware walk; the `IN (SELECT …)` bridge emission and the `all`/`none` short-circuits; `subject()` tagging inside gates; the `SLOT_ACTIONS` map (now a private constant of the factory); `permittedFieldsOf` + `fieldsFrom`; the `$`-stripping convention between manifest and matcher; `cache()`; `validateShareToken`'s query (now generic over `spec.shareable.tokenColumn`, so the `switch (resourceType)` in `validate-share-token.ts:32` disappears); the L8 `∧ read`.

**Exposed as extension points, with the OCP argument for each:**
| Extension point | Why it must be open | What would otherwise be edited |
|---|---|---|
| `defineRole` registry | roles are business rulings that arrive independently (manager, Q8's 25 rulings) | a `switch (user.role)` in `abilities.ts:91` |
| `defineScopeOperator` with per-target `bodies` | new atoms need SQL now and JS later (D-19 escape hatch); a second target needs a body without touching the atom's contract | `interpretField`'s switch / a second registry |
| `defineBearerKind` + `bearer(kind, pick)` | bearers differ in what proves possession and what they may do, not in how the engine treats them | the token branch of `shareable-middleware.ts:59-68` + `resourceType` switch |
| `RulesSource` port | code today, DB later (README §L "rules source swapped") | `getRequestActor`'s body |
| `Target` port | Drizzle now; the AST walk is target-agnostic; `compile<P>` is the only generic function | `interpret.ts` |
| `defineChildSpec.parent.bridgeAction` | L13-3 proved the default mapping empirically; a junction or a review-workflow child may need another | a branch in `toWhere` |
| `RootSpec.shareable.bearerRules` | the bearer allowlist is per entity (L12-7b) and a business ruling | a constant inside the bearer builder |
| `SystemReason` union members | additive audit surface (D-14) | — (already the design) |
| `Scope` combinators (`scopes.all/any`) | bespoke reads compose N specs without a helper per arity | `scopedWhere` growing variadic spec params |

---

## 4. Dependency strategy and adapters

Dependency categories (task brief): CASL evaluation and Drizzle query *building* are in-process pure → **no port**, called directly. Session lookup and query *execution* are local-substitutable → **ports**.

| Seam | Port | Production adapter | Second adapter (real, not hypothetical) |
|---|---|---|---|
| Session | `SessionSource` | `betterAuthSessions` (`auth.api.getSession({ headers })`) | `fakeSessions(session)` for the parity script / Playwright-session route (`/api/dev/playwright-session` already mints sessions by role — the test adapter formalises it) |
| Execution | `Executor` (= `DbOrTx`) | `db` / `ctx.tx` | a rolled-back `db.transaction` in tests (D-21 parity runner); already how `withTx` threads |
| Rules | `RulesSource` | `codeRulesSource` (roles registry) | `staticRulesSource(rules)` in tests today; `dbRulesSource` when rules move to a table |
| Operator bodies | `Target` name → body | `drizzle` | `js` (client matcher / instance checks) — a second consumer that exists now |
| Emission | `Target<P>` | `drizzleTarget` | `jsTarget` for `assertCanOn`-style instance evaluation of operator-bearing rules, if D-19 (b) is ever taken; a second ORM is the same shape |

**Seams deliberately NOT opened (one adapter only):** the ucast AST (one producer, `rulesToAST`); `AppAbility` (one library — no `AbilityLike`); the bridge strategy (`IN (SELECT)` vs `EXISTS` is a `Target` detail, not a policy); the CRUD factory's hook onion (not a permissions seam); the spec registry (a module-level list, not injectable); `packRules`/`unpackRules` transport; the tRPC ladder rungs (four fixed rungs, L5). Opening any of these would add an interface with exactly one implementation.

Precedent: `@casl/prisma`'s `accessibleBy(ability, action).Model` returns a `Prisma.ModelWhereInput` that composes with business conditions under `AND` and — because relation filters accept the same `WhereInput` — scopes child rows through parent rules as `{ post: { is: accessibleBy(ability).Post } }`. Our `Target.bridge(fk, parent, parentWhere)` is that composition for SQL, which is why bridging is a target primitive rather than an operator (README §L9 (R) rejected).

---

## 5. SOLID + complexity audit

- **SRP** — `value.ts` (Scope algebra), `compile.ts` (AST→target), `bridge.ts`/`toWhere` (topology), `gates.ts` (verb/field/probe), `bearers/*` (identity), `roles/*` (policy), `create-crud-dal.ts` (slot orchestration): each changes for one reason. Evidence: today `resolve-actor-scope.ts` mixes compile + bridge + probe + `kind` switches (`:22-73`).
- **OCP** — the touch map below: no engine file appears in any "add X" row. Evidence: the only structural branch is `spec.parent` in `toWhere`.
- **LSP** — every `Actor` (session, bearer, system, omni) is the same record and substitutes in every gate and slot; every `Scope<P>` from any target composes under `scopes.all/any`; every `BearerKind<TIn>` substitutes in `bearer(kind, pick)`. Evidence: no `actor.kind` reads remain (today 5 re-narrowing sites, 06 S3 #14).
- **ISP** — DAL imports `{ scopedWhere, toWhere, whereOf, scopes, assertCan, permittedFields, assertReachable }`; RSC imports `getRequestActor`; jobs import `systemContext`; the client imports the provider + `subject`; operators receive `OperatorCtx = { table, pk }` only. Nobody receives `session`, `role`, or a `scope` cache.
- **DIP** — `compile` depends on `Target<P>`, `getRequestActor` on `SessionSource` + `RulesSource`; concrete Drizzle/better-auth adapters are wired in `server/index.ts`. Drizzle *types* (`PgTable`, `PgColumn`) remain in the spec by design (in-process pure).
- **Cyclomatic complexity (estimated):** `toWhere` ≈ 6 (root/child, field?, parent none, parent all, own subject, bridge); `compile`'s interpreter ≈ 8 (custom op, and/or/not, eq/in, allow-all-in-or); `updateImpl` ≈ 10 (two before-hooks, empty-update, load miss, field loop + miss, write miss, two after-hooks) — the largest, unchanged from today's `:161-228` minus the `requireResolvedScope` path.
- **Touch map:**

| Add… | Files touched | Engine files |
|---|---|---|
| root entity | `entities/<x>/lib/{constants,server-spec}.ts`; one line in `ENTITY_NAMES` (subject union); rules in the role files that get access | 0 |
| child / grandchild / junction | `entities/<x>/lib/server-spec.ts` (`defineChildSpec`); rules name the collection field where restricted | 0 |
| operator | `scope/operators/<name>.ts`; one line each in `operators/manifest.ts` + `operators/index.ts` | 0 |
| role | `roles/<role>.ts`; enum member; one line in `roles/index.ts` | 0 |
| bearer kind | `bearers/<kind>.ts`; the procedure that uses it; one line in `bearers/index.ts` | 0 |
| rules source | `rules/sources/<db>.ts`; one line in `server/index.ts` | 0 |
| target | `scope/targets/<orm>.ts`; a body per operator (N operator files) | 0 |

---

## 6. Trade-offs (what flexibility cost)

- **Depth vs. surface.** Callers of the common path learn one call (`scopedWhere`) — same depth as the other designs. But the module's *total* surface is larger: `Scope`, `whereOf`, `scopes.*`, `Target`, `BearerKind`, `RulesSource`, `defineRole`, `bridgeAction`. Leverage for maintainers (add-by-file) is bought with a longer map for newcomers.
- **Locality lost for rules.** A role's rules are one file each instead of one `switch` — a reviewer auditing "who can read Proposal" greps across `roles/*` (mitigated by the boot audit and the D-21 parity script, which print the per-role matrix).
- **Two-file operators.** Manifest (client-safe) + body (server) is forced by the bundle boundary (`operator-names.ts:4-12`); a registration is therefore two one-line edits, not one.
- **`Scope` at bespoke sites.** Where today's code writes `?? undefined`, a bespoke multi-spec read writes `whereOf(scopes.all(...))` — one more concept, in exchange for the impossibility of `undefined`-as-unresolved.
- **A registry for one bearer kind.** `defineBearerKind` carries mechanism for a second kind that exists only in the roadmap (intake, funnel); until then `rowShare(spec)` is its sole registration.
- **`Target<P>` generics leak** into `compile`/`toWhere<P>` signatures; the Drizzle-bound exports (`scope/drizzle.ts`) hide them from every DAL caller, but the engine's own types are heavier than a Drizzle-only walk.
- **Type-level field gate on inferred-subject children.** Roots and own-subject children get D-17's instance `permittedFieldsOf`; an inferred-subject child's field gate is type-level against the parent subject (the parent row is not loaded) with the row-level part enforced by the field-aware SQL bridge. Complete under D-19, but a reader must know the split.
- **Boot cost and startup coupling.** Every registry is validated at module init; a broken registration fails the deploy, never a request — but adding an entity now requires importing it into `server/index.ts` (or it is invisible to the asserts).
- **What a caller must now know that they did not:** (1) call `whereOf`/`scopedWhere` inline at the query site — nothing on `ctx` scopes for you; (2) the action per slot is fixed and L8 ANDs `read` into mutations; (3) collections are *field names* of the parent subject when authoring rules (`'profile.*'`, `'views'`, `'applications.answers'`); (4) `subject()` must be re-applied after any JSON/superjson hop; (5) a bearer is built by kind, not by resource-type string.
