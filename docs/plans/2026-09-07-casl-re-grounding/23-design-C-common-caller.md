# 23 — Design C: optimise for the most common caller (2026-09-16)

> **Constraint this design serves.** Make the default case trivial for, in order: (1) an entity author declaring a root or sub-entity and getting CRUD for free; (2) a tRPC handler that calls one DAL function with `ctx`; (3) a React component gating an affordance. Target: 95% of entities write **zero** permission code; a handler never mentions permissions; a component writes one `<Can>`. Rules live in **one file per role** and nowhere else. Metric: "permission-aware lines an author writes" and "things a handler author can get wrong".
> **Satisfies** README §L1–L13, tracker §2 D-01…D-25 (L8, L13, D-07, D-19, D-20 are load-bearing below). Read-only design; nothing here is implemented.
> **Evidence used.** Current seam: `domains/permissions/{abilities,types}.ts`, `scope/{compile-scope,interpret,conditions-matcher,operators}.ts`, `dal/server/lib/{resolve-actor-scope,scope,helpers,create-crud-dal}.ts`, `trpc/{init,types}.ts`, `trpc/lib/{create-crud-router,middleware/shareable-middleware}.ts`, `customers/lib/server-spec.ts`, `customer-notes/lib/server-spec.ts`, main's `create-crud-dal.ts` (`SpecCrudHandlers` inference), reports 06/07/11/12/14/17. Library facts re-probed 2026-09-16 against installed `@casl/ability@6.8.0` (`node -e`, no file written): `'profile.*'` matches the bare field `profile` and `profile.hoa`, not `profile.a.b`; a bare `'views'` grant matches `views` only, not `views.source`; conditioned `cannot` LAST denies on the matching instance; `permittedFieldsOf` returns patterns (`["profile.*"]`), not expansions.

---

## 0. The one idea: **the slot is the policy question**

Every permission decision an entity ever needs is a function of three things the system already knows: **which CRUD slot** is running (`getById`/`create`/`update`/`delete`/`duplicate`/`children`/`upsert`), **the spec's topology** (root, or child hanging off `parent.fk` as `collection`), and **the request's ability** (computed once, L4). So `createCrudDal(spec)` derives *action × subject × field-path × row-scope × field-gate* mechanically, and the adapter compiles the ability into SQL on demand. Nobody in the middle carries a permission primitive: no `ctx.scope`, no `ctx.ability`, no `assertCan`, no probe helper, no context literal.

Consequences that fall out, not features bolted on:
- **Permission code exists in exactly three modules**: `rules/<role>.ts` (policy), `scope/` (compiler), `create-crud-dal.ts` (slot → policy question). Everything else is topology + `ctx` pass-through.
- **`AppAbility` instances are produced by three server builders only** (`getRequestActor`, `bearerContext`, `systemContext`) and one client hydrator. `defineAbilitiesFor` becomes `server-only` (the client receives `packRules`, L10). A handler *cannot* hand-build an actor because no literal type-checks.
- **The three-way `null` is gone by construction**: `rowScope()` always returns `SQL` (`TRUE` / `FALSE` / predicate). There is nothing to "forget to resolve" because nothing is cached on `ctx`.

---

## 1. Interface

### 1.1 Seat 1 — entity author (the 95%)

```ts
// src/shared/entities/proposals/lib/server-spec.ts            ROOT
export const proposalServerSpec = defineRootSpec({
  subject: PROPOSAL,                                            // RootSubject; replaces entityName + caslSubject (always equal for roots)
  table: proposals,
  schemas: { insert: insertProposalSchema, update: updateProposalSchema, select: selectProposalSchema },
  shareable: { tokenColumn: 'token' },                          // optional; REQUIRES rules/bearer.ts[PROPOSAL] (boot assert)
})

// src/shared/entities/proposal-views/lib/server-spec.ts       COLLECTION CHILD (no subject of its own)
export const proposalViewServerSpec = defineChildSpec({
  table: proposalViews,
  schemas: { insert: insertProposalViewSchema, update: updateProposalViewSchema, select: selectProposalViewSchema },
  parent: { spec: proposalServerSpec, fk: proposalViews.proposalId, collection: 'views' },
})

// src/shared/entities/customers/lib/customer-profile-spec.ts  1:1 CHILD (pk = fk)
parent: { spec: customerServerSpec, fk: customerProfiles.customerId, collection: 'profile', cardinality: 'one' }

// src/shared/entities/customer-notes/lib/server-spec.ts       OWN-ROW CHILD (the L13-4 exception)
export const customerNoteServerSpec = defineChildSpec({
  table: customerNotes, schemas: { … },
  parent: { spec: customerServerSpec, fk: customerNotes.customerId },   // no collection: own rules govern the verb, parent `read` is topology
  subject: CUSTOMER_NOTE,                                               // the ONLY case a child names a subject
})

// src/shared/entities/<e>/dal/server/crud.ts   (unchanged line)
export const proposalViewCrud = createCrudDal(proposalViewServerSpec)
```

What the author gets without writing anything else:

| Spec kind | Slots returned by `createCrudDal` | Subject | Verb question the factory asks | Row scope | Field gate |
|---|---|---|---|---|---|
| root | `getById create update delete duplicate` | own | `can(a, S)` | `rowScope(S, a)` | `can(a, subject(S,row), col)` |
| collection child, `many` | + `children(ctx,{ parentId })` | **inferred = parent's** | `can(P(a), Parent, collection)` | bridge through parent for `(P(a), collection)` | `can('update', subject(Parent,parentRow), \`${collection}.${col}\`)` |
| collection child, `one` | `getById upsert delete` (pk is the parent id) | inferred | same | same | same |
| own-row child | root slots + `children` | declared | `can(a, Own)` | own rules on child table ∧ parent `read` bridge | `can(a, subject(Own,row), col)` |

`P(a)` = action map (L13-3): `read → read`, `create | update | delete → update`. Grandchildren compose dotted paths (`applications.answers`), bridged twice (L13-5).

**When an entity author touches rules (the 5%).** Only if the entity needs *non-default* policy: a root needs any rule at all to be reachable (adding a root = one `can` line per role that may see it, in `rules/<role>.ts`); a collection child needs nothing (it is reachable through the parent's field grants); an own-row child needs its scalar own-row rule (`can(['update','delete'], 'CustomerNote', { authorId })`). Collection grants are authored as **`'<collection>.*'`** (covers row-touch AND column writes — probed); a bare `'<collection>'` is the narrower "add/remove rows, edit no column" grant.

### 1.2 Seat 2 — handler author

```ts
recordView: proposalShareableProcedure.input(recordViewSchema)
  .mutation(({ ctx, input }) => dalToTrpc(await proposalViewCrud.create(ctx, input)))
```
That is the whole contract: **pass `ctx`, call one DAL function, unwrap.** The tRPC context `{ session, actor, req?, resHeaders }` *is* a `ScopedContext` structurally (D-09), on every rung. The handler never reads `ctx.actor` except to stamp data (`authorId: ctx.actor.userId` — and even that belongs in a `before` hook, see the notes example). Error mapping is `dalToTrpc`: `not-found → NOT_FOUND`, `forbidden → FORBIDDEN` (message names `action`/`field` when present).

Ladder (L5), narrowing only, never building:

| Rung | `ctx` type | Gate |
|---|---|---|
| `baseProcedure` | `{ session: Session \| null; actor: Actor; req?; resHeaders }` | none (anonymous ⇒ deny-all ability, still non-null) |
| `protectedProcedure` | `& { session: Session }` | `UNAUTHORIZED` if no session (L2) |
| `agentProcedure` / `superAdminProcedure` | same type | `FORBIDDEN` unless `can('access','Dashboard')` / `can('manage','all')` |
| `<entity>ShareableProcedure = baseProcedure.use(shareable(spec))` | `{ session: Session \| null; actor }` | session wins → pass-through; else `bearerContext(spec, rawInput.token)` → else `UNAUTHORIZED` |

`createCrudRouter({ spec, schemas, crud })` becomes pure wiring (five procedures, Zod in, `dalToTrpc` out); `assertCan` / `assertCanUpdateFields` / `SLOT_ACTIONS` leave the router (they are the factory's job now — report 11 §3).

### 1.3 Seat 3 — component author

```tsx
<Can I="update" this={subject('Customer', customer)} field="profile.hoa">…</Can>     // row-specific
<Can I="create" a="Meeting">…</Can>                                                   // type-level
const ability = useAbility(); ability.can('delete', subject('CustomerNote', note))    // own-row
```
`@casl/react` 7.0.1 re-exported from **one** `'use client'` module (`permissions/client.tsx`) that also hosts `AbilityProvider rules={…}` (hydrates `createMongoAbility(unpackRules(rules), { conditionsMatcher })` with the shared matcher). Entity action tuples grow one optional slot: `permission: [action, subject, field?]`; `EntityActionMenu` tags the row with `subject()` before evaluating. The four hand mirrors (`use-customer-note-action-configs.ts:63-64`, `can-see-phone.ts`, `get-accessible-pipelines.ts`, `proposal-steps.ts` roles) are deleted (L10).

### 1.4 Rare seats

```ts
// Bespoke DAL read joining two scoped tables (list proposals + their customers)
.from(proposals).innerJoin(meetings, …).innerJoin(customers, …)
.where(and(rowScope(ctx, proposalServerSpec), rowScope(ctx, customerServerSpec), searchWhere, filterWhere))
// Invariant: rowScope(ctx, S) references only S.table's columns (unaliased) + correlated subqueries ⇒ valid wherever S.table is in FROM/JOIN.

// route.ts (pdf)
const ctx = await bearerContext(proposalServerSpec, token); if (!ctx) return 401
const view = await getFullView(ctx, { id: proposalId })           // no SYSTEM re-read: the bearer's own ability reads its row
// RSC guard + provider
const { session, actor } = await getRequestActor()               // cache()'d; protectDashboardPage() is this + redirect
<AbilityProvider rules={packRules(actor.ability.rules)}>
// Job / webhook
const ctx = systemContext('job:propagate-customer-change')       // SystemReason union member; .because(reason) on the rule
// Point probe on a client-supplied parent id inside a bespoke write
if (!(await probe(ctx, meetingServerSpec, input.meetingId))) throw new ThrowableDalError({ type: 'not-found' })
```

### 1.5 The full TypeScript surface

```ts
// ── rules — ONE file per role, nothing else may call `can` ─── src/shared/domains/permissions/rules/*.ts   'server-only'
type RuleWriter = (can: AppAbilityBuilder['can'], cannot: AppAbilityBuilder['cannot']) => void
export const agent:      (p: { userId: string }) => RuleWriter          // rules/agent.ts      (ids baked in, D-14)
export const dispatcher: (p: { userId: string }) => RuleWriter          // rules/dispatcher.ts
export const superAdmin: RuleWriter                                     // rules/super-admin.ts  can('manage','all')
export const homeowner:  RuleWriter;  export const user: RuleWriter     // rules/homeowner.ts, rules/user.ts
export const bearer:     Partial<Record<RootSubject, (rowId: string) => RuleWriter>>   // rules/bearer.ts  (D-11 allowlists per subject)
export const system:     (reason: SystemReason) => RuleWriter           // rules/system.ts   can('manage','all').because(reason)

// ── actors — the ONLY producers of an AppAbility ────────────── src/shared/domains/permissions/server/*.ts   'server-only'
export interface Actor { readonly ability: AppAbility; readonly userId: string | null }      // D-09; userId for stamping only
export interface ScopedContext { readonly actor: Actor; readonly tx?: Tx }                    // dal/server/types.ts
export const getRequestActor: () => Promise<{ session: BetterAuthSession | null; actor: Actor }>   // React cache(); one lookup, one build
export function bearerContext(spec: ShareableRootSpec, token: string): Promise<ScopedContext | null> // validates token → rules.bearer[spec.subject](rowId)
export function systemContext(reason: SystemReason): ScopedContext

// ── specs — topology only ────────────────────────────────────── src/shared/dal/server/types.ts
export function defineRootSpec<T extends PgTable, S extends RootSubject>(s: {
  subject: S; table: T; schemas: Schemas; primaryKey?: keyof T['_']['columns']; shareable?: { tokenColumn: keyof T['_']['columns'] }
}): RootSpec<T, S>
export function defineChildSpec<T extends PgTable, P extends AnySpec>(s:
  | { table: T; schemas: Schemas; primaryKey?; parent: { spec: P; fk: PgColumn; collection: string; cardinality?: 'one' | 'many' } }   // collection child
  | { table: T; schemas: Schemas; primaryKey?; parent: { spec: P; fk: PgColumn }; subject: OwnRowSubject }                              // own-row child
): ChildSpec<T, P>
// Hooks/duplicate config stay on createCrudDal(spec, configFactory) (main's shape); the spec has no functions.

// ── CRUD factory ────────────────────────────────────────────── src/shared/dal/server/lib/create-crud-dal.ts
export function createCrudDal<S extends AnySpec>(spec: S, config?: CrudConfigFactory<S>): CrudFor<S>
// CrudFor<Root> = { getById, create, update, delete, duplicate };  Child<'many'> adds children(ctx,{ parentId });  Child<'one'> = { getById, upsert, delete }
// every slot: (ctx: ScopedContext, input, options?) => Promise<DalReturn<…>>   (main's SpecInsert/SpecUpdate/SpecId inference kept)

// ── tRPC ladder ─────────────────────────────────────────────── src/trpc/init.ts
export const baseProcedure, protectedProcedure, agentProcedure, superAdminProcedure                 // §1.2 table
export function shareable(spec: ShareableRootSpec): Middleware                                       // used ONLY by <entity>ShareableProcedure
export function createCrudRouter<S>(c: { spec: S; schemas: { id, insert, update }; crud: CrudFor<S> }): Router   // no assertCan, no resolveScope

// ── rare-caller adapter ─────────────────────────────────────── src/shared/domains/permissions/scope/*.ts   'server-only'
export function rowScope(ctx: ScopedContext, spec: AnySpec, action: 'read' | 'update' | 'delete' = 'read'): SQL   // NEVER null/undefined
export function probe(ctx: ScopedContext, spec: AnySpec, id: PkOf<typeof spec>, action = 'read'): Promise<boolean>
export function subjectOf<S extends RootSpec | OwnRowSpec>(spec: S, row: Row<S['table']>): SubjectInstance<S>       // subject(spec.subject, row)
export type DalError = … | { type: 'forbidden'; action?: AppAction; subject?: string; field?: string }

// ── client ──────────────────────────────────────────────────── src/shared/domains/permissions/client.tsx   'use client'
export function AbilityProvider(p: { rules: PackedRules; children }): JSX.Element
export { Can, useAbility, subject }                                                                   // typed to AppAbility
```

Row-scope semantics (what `rowScope` compiles; `∧` = SQL AND; `bridge(action, path)` = `fk IN (SELECT p.pk FROM p WHERE rowScope'(p, action, path))`):

```
root,  read      : compile(rulesFor(read, S))                                 → TRUE | FALSE | predicate
root,  mutation m: compile(rulesFor(m, S)) ∧ compile(rulesFor(read, S))       (L8)
coll,  read      : bridge(read, collection)
coll,  mutation  : bridge(update, collection) ∧ bridge(read, collection)      (L8 + L13-3)
own,   read      : compile(rulesFor(read, Own)) ∧ bridge(read)                (L9; bridge carries no field path)
own,   mutation  : compile(rulesFor(m, Own)) ∧ compile(rulesFor(read, Own)) ∧ bridge(read)
grandchild       : path = 'applications.answers' — the parent's own bridge prepends its collection (L13-5)
```
`compile` = field-aware `rulesToAST` variant over `ability.rulesFor(action, subject, field)` → `interpret` (C9 fixed: an allow-all child inside OR makes the OR allow-all) → `null AST → FALSE`, `empty AND → TRUE`.

### 1.6 Invariants · ordering · errors · configuration · performance

| Kind | Rule | Enforced by |
|---|---|---|
| Invariant | A mutation never reaches a row the principal cannot read (L8). | `rowScope` composes both; no caller can pass `action` without the read AND |
| Invariant | Mutation rules carry **scalar** conditions only; operators only on field-less `read` rules (D-19). Reach for mutations is bounded by the read rule. | boot assert #2 |
| Invariant | `cannot` last per (action, subject) (D-20). | boot assert #3 |
| Invariant | Every `fields` entry on a rule is a column of the subject's table or a declared `collection` form (`c`, `c.*`, `c.<childCol>`, `c.**`). | boot assert #4 (new — catches rule typos at boot instead of `FALSE` at runtime) |
| Invariant | No `collection` name collides with a parent column; `parent.fk` is a column of the child's own table; a shareable spec has bearer rules. | boot asserts #5–#7 |
| Invariant | No conditionless `can` beside a conditioned `can` for the same (action, subject) with overlapping fields (D-02). | boot assert #8 |
| Invariant | `AppAbility` never null on any `ctx`; anonymous = empty ability. `ctx.session === null` is the only bearer test, and only inside shareable procedures. | types |
| Ordering | `bearerContext` validates the token *inside*; a caller cannot obtain bearer rules for an unvalidated row. `getRequestActor` must run in a Next request scope (`headers()`); jobs use `systemContext`. Middlewares narrow only — `next({ ctx })` never builds. | function shape |
| Ordering | Slot pipeline: verb (type-level) → before-hooks → validate → scoped load → field gate → write with scoped WHERE → after-hooks. `previousRow` is the scoped load (always taken, no longer conditional on hooks). | factory |
| Error | No rule for (action, subject[, collection]) → `forbidden` (reveals nothing). Client-supplied id misses the scoped WHERE → `not-found` (D-07). Column denied on a reachable row → `forbidden{ field }`. Parent id on a child create unreachable → `not-found`. | factory; `dalToTrpc` maps |
| Config | Entity author: none. App: `@casl/react@7.0.1` added, `@casl/ability` stays 6.8.0 (D-20); `AbilityProvider` mounted where `getRequestActor()` already runs (dashboard + proposal layouts; root = Q10). Rules loader runs asserts on first server import. | package.json, layouts |
| Perf | One session lookup + one ability build per request (L4). `rowScope` is pure and µs-scale; memoised per `(ability, spec, action)` in a `WeakMap<AppAbility, Map<string, SQL>>` (Drizzle `SQL` chunks are immutable and reusable). A child mutation costs one extra point read of the parent (for instance field checks) and two folded `IN (SELECT …)` bridges. Omni compiles to `WHERE TRUE` — Postgres folds it; the parity script normalises it. | measurement per D-21 |

---

## 2. Usage examples — counted in permission-aware lines the author writes

Counting rule: a line counts if it names an ability, rule, scope, actor, subject, probe or verb. Topology lines (`parent:`) and stamping lines (`authorId: ctx.actor.userId`) are listed but not counted — they would exist under any design.

**2.1 `recordView` — bearer creates a proposal view.** Today: `views.router.ts:36-74` — `systemProcedure`, `resolveShareTokenActor`, a hand-built ctx literal, an unscoped insert (P1-3).
```ts
// rules/bearer.ts  (ONE-TIME per shareable root; D-11 + L12 7b)                              ← 2 lines, written once for Proposal
[PROPOSAL]: rowId => (can) => { can('read', 'Proposal', { id: rowId })
                              can('update', 'Proposal', ['financeOptionId', 'cashInDealCents', 'views.*'], { id: rowId }) }
// proposal-views/lib/server-spec.ts — topology only (§1.1)                                    ← 0
// proposal-views/dal/server/crud.ts   createCrudDal(proposalViewServerSpec, () => ({ hooks: { create: { after: dispatchViewNotification } } }))   ← 0
// proposals.router/views.router.ts
recordView: proposalShareableProcedure.input(recordViewSchema)
  .mutation(({ ctx, input }) => dalToTrpc(await proposalViewCrud.create(ctx, input)))          ← 0
```
Factory does: `can('update','Proposal','views')` → parent point-read `proposals WHERE id = input.proposalId ∧ rowScope(Proposal, read)` (= `id = rowId`) → `can('update', subject('Proposal', row), 'views')` → insert → after-hook. A bearer posting another proposal's id gets `NOT_FOUND`. **Handler: 0. Entity: 0. Rules: 2 (once per shareable subject).**

**2.2 `profile.upsert` — dispatcher updates a customer's profile facet.** Today: `profile.router.ts:20-25` hand `cannot('update','CustomerProfile')` + `upsertCustomerProfile` re-implements the parent probe off `ctx.scope` (`mutations.ts:37-46`).
```ts
// rules/dispatcher.ts                                                                          ← 1 line (already exists in another shape)
can('update', 'Customer', ['name','phone','email','address','city','state','zip','pipelineStage','age','profile.*'])
// customers/lib/customer-profile-spec.ts — parent: { …, collection: 'profile', cardinality: 'one' }   ← 0
// customers.router/profile.router.ts
upsert: agentProcedure.input(z.object({ id: z.string().uuid(), data: customerProfilePatchSchema }))
  .mutation(({ ctx, input }) => dalToTrpc(await customerProfileCrud.upsert(ctx, input)))        ← 0
```
Factory does: `can('update','Customer','profile')` → parent point-read `customers WHERE id ∧ rowScope(Customer, read)` (dispatcher: `$inDerivedPipeline` EXISTS/CASE) → per patched column `can('update', subject('Customer', row), 'profile.<col>')` → `INSERT … ON CONFLICT (customer_id) DO UPDATE … WHERE rowScope(profile, update)`. The `CustomerProfile` subject, its `ENTITY_NAMES` entry and the hand check are deleted. **Handler: 0. Entity: 0. Rules: 1.**

**2.3 `customer-notes` — own-row child.** Today: `server-spec.ts:42-97` — three hooks, a lazy self-import, `canAccess`, `assertNoteAuthorOrAdmin`, plus the client mirror.
```ts
// rules/agent.ts and rules/dispatcher.ts                                                       ← 3 lines each
can('read', 'CustomerNote');  can('create', 'CustomerNote', { authorId: userId });  can(['update','delete'], 'CustomerNote', { authorId: userId })
// customer-notes/lib/server-spec.ts — parent: { spec: customerServerSpec, fk }, subject: CUSTOMER_NOTE            ← 0
// customer-notes/dal/server/crud.ts
export const customerNoteCrud = createCrudDal(customerNoteServerSpec, () => ({
  hooks: { create: { before: (input, ctx) => ({ ...input, authorId: ctx.actor.userId }) } } }))   // stamping, not permission ← 0
// client
<Can I="delete" this={subject('CustomerNote', note)}>…</Can>                                     ← 1
```
Factory does: create → `can('create','CustomerNote')` → parent probe `customers WHERE id = input.customerId ∧ rowScope(Customer, read)` → `can('create', subject('CustomerNote', validated))` (checks `authorId === userId` on the stamped payload — a client cannot forge `authorId`) → insert. update/delete → `WHERE id ∧ compile(update|delete, Note) ∧ compile(read, Note) ∧ bridge(read)` → `NOT_FOUND` for a non-author. `assert-note-author.ts`, the three hooks and the client mirror are deleted. **Handler: 0. Entity: 0. Rules: 3 per role. Component: 1.**

**2.4 Agent lists proposals with their incentives.** Today: `listProposals` uses `ctx.scope`; `listProposalIncentives(proposalId)` is unscoped (P1-2).
```ts
// proposals/dal/server/queries.ts  (bespoke — the one rare seat in this list)
.where(and(rowScope(ctx, proposalServerSpec), searchWhere, filterWhere))                          ← 1
// proposal-incentives: collection child of Proposal (`collection: 'incentives'`) — no bespoke DAL needed
const incentives = await proposalIncentiveCrud.children(ctx, { parentId: proposal.id })           ← 0   (WHERE proposal_id = $1 ∧ bridge(read,'incentives'))
// proposals.router/business.router.ts
list: agentProcedure.input(listSchema).query(({ ctx, input }) => dalToTrpc(await listProposals(ctx, input)))   ← 0
```
Dispatcher (no Proposal rule) gets `[]` from both, never `FORBIDDEN` on a list (D-07: lists stay scope-threaded). **Bespoke DAL: 1. Handler: 0. Child entity: 0.**

Totals: four flows, **1 permission-aware line in application code** (the bespoke join), 0 in handlers, 0 in specs; rules-file lines are the policy itself (one place per role).

---

## 3. What the implementation hides

| Hidden behind | Depth (behaviour per unit learned) |
|---|---|
| `createCrudDal(spec)` | slot → `(action, subject, field-path)` mapping incl. the child action map; verb gate; scoped load doubling as `previousRow`; parent point-read for children; instance field gate via `subject()` + `fieldPatternMatcher` (patterns expand per column, L13-6); L8 composition; race-safe re-scoped write; `duplicate` = scoped read + `create` pipeline; `children`/`upsert` for children; hook onion (unchanged from main) |
| `rowScope(ctx, spec, action)` | field-aware `rulesToAST` over `rulesFor(action, subject, field)`; `interpret` with C9 fix; custom-operator registry + `OperatorCtx { table, pk }` (no actor: ids are baked into conditions, D-14); parent bridge recursion + dotted paths; same-subject rule; `null/undefined` never escape (`TRUE`/`FALSE`) |
| `getRequestActor` / `bearerContext` / `systemContext` | one session lookup, `cache()`; token validation generalised off `spec.shareable.tokenColumn` (replaces `validateShareToken`'s switch and the unvalidated `SM:62` branch); `.because(reason)` on the system rule; `packRules` for the client |
| rules loader (`rules/index.ts`) | builds one ability per role; runs boot asserts #1–#8; exports `defineAbilitiesFor(user)` for the three builders only |
| `permissions/client.tsx` | `unpackRules` + shared matcher; `subject()` re-tagging helper for rows that crossed superjson (tags are lost — 14 §1.12) |

**Mistakes by a handler author — impossible (types) or loud (throws), never silent:**

| Mistake | Today | Under C |
|---|---|---|
| Forgets to scope | `ctx.scope` stamped `null` at `init.ts:60` ⇒ omni by accident | Impossible — nothing to forget; the DAL derives from `ctx.actor.ability` |
| Hand-builds a context literal (`{ session: null, ability: null, scope: … }` at `views.router.ts:50`, `pdf/route.ts:27`) | compiles | Does not type-check: `ScopedContext` has only `actor`/`tx`, and `AppAbility` values come only from the three builders |
| Uses `SYSTEM_CONTEXT` for convenience (33 sites) | compiles | Deleted; `systemContext(reason)` requires a `SystemReason` member — adding one is a reviewable diff |
| Uses `ctx.ability == null` as "is homeowner" (4 sites) | works by accident | Impossible — `ability` is never null; bearer ⇔ `ctx.session === null` inside a shareable procedure only |
| Creates a child on a parent it cannot see (E1-4 class) | silent IDOR | `NOT_FOUND` from the parent point-read, every origin (tRPC, service, job) |
| Updates a column its role lacks on the bearer path (E1-3) | field gate skipped | `forbidden{ field }` — the gate lives in the DAL slot and runs for every principal |
| Calls `agentProcedure` directly in an entity router | loses scope middleware | No such middleware exists to lose; any rung is safe |
| Bespoke DAL author writes `.from(scopedTable)` without `rowScope` | silent | Loud via the D-24 lint wall extended inside `entities/*/dal/`: a `db.select/update/delete` on a spec table in a statement that lacks `rowScope(` or a `crud.` call is a lint error (heuristic, allowlisted per file with a reason) |
| Rule author typos a field/collection (`'proflie.*'`) | rule silently never matches ⇒ `FALSE` | boot assert #4 throws naming the rule |
| Rule author puts an operator on an `update` rule | client instance check throws at runtime (14 §1.9) | boot assert #2 throws at server start |

---

## 4. Dependency strategy and adapters (real seams only)

| Seam | Interface | Adapter(s) | Category |
|---|---|---|---|
| **Session** | `getSession(headers) → Session \| null` inside `getRequestActor` | better-auth (`auth.api.getSession`); tests/scripts pass `{ headers }` or use `systemContext` | local-substitutable |
| **Token → row** | `bearerContext(spec, token)` | Drizzle point read on `spec.shareable.tokenColumn`; substitutable with a fake `db` | local-substitutable |
| **Rule set** | `rules/<role>.ts` `RuleWriter` | one module per role; the loader is the only importer | in-process pure |
| **Ability evaluation** | `AppAbility` (`MongoAbility<[AppAction, AppSubject], AppConditions>`, D-20 V6 typing) | `@casl/ability@6.8.0`; the interface is CASL's own — no wrapper | in-process pure |
| **Rules → SQL** | `rowScope(ctx, spec, action): SQL` | `scope/{compile,interpret,operators}` (structural AST, no `@ucast` import — C12) | in-process pure |
| **Custom operators** | `defineScopeOperator({ name, toSql(node, { table, pk }) })` + `SCOPE_OPERATOR_NAMES` contract | `participatesViaMeeting`, `inDerivedPipeline` (`hasNoMeeting` dropped, C13); each asserts `ctx.table` (C10) | in-process pure; bodies `server-only` (C11) |
| **Query execution** | `ctx.tx ?? db` | Drizzle/Neon; the factory and bespoke DALs are the only importers of `db` | local-substitutable |
| **Client ability** | `AbilityProvider rules` / `useAbility` / `<Can>` | `@casl/react@7.0.1` + `unpackRules`; one `'use client'` wrapper | in-process pure |

No new dependency beyond `@casl/react`. The parity script (D-21) targets `rowScope` directly: for each role × spec × action it prints `toSQL()` — the same function the factory calls, so parity on the adapter is parity on every slot.

---

## 5. SOLID + complexity audit of this design

- **SRP** — `rules/<role>.ts` = policy only; `scope/` = compilation only; `create-crud-dal.ts` = slot semantics only; `init.ts` = narrowing only. Evidence: today `create-crud-router.ts:185-230` does verb + field gating *and* tRPC wiring, and `server-spec.ts` files carry auth hooks; both collapse to one job each.
- **OCP** — a new entity, child, operator or role is added by *adding* a file/line (spec, rule, `defineScopeOperator`, `rules/<role>.ts`), never by editing the factory or adapter. The only closed switch is the action map `P(a)` (three cases, locked by L13-3).
- **LSP** — every `CrudFor<S>` slot has the same `(ctx, input, options?) => Promise<DalReturn>` shape; a tRPC ctx, a bearer ctx and a system ctx are all plain `ScopedContext`s with no `kind` to branch on (L1) — any caller works with any producer. The one non-substitutable point is deliberate and typed: a `cardinality:'one'` child has `upsert` and no `create/update` (its pk is the parent id).
- **ISP** — the entity author sees `defineRootSpec`/`defineChildSpec` + `createCrudDal`; the handler sees `ctx` + one DAL function; the component sees `<Can>`; only the bespoke author sees `rowScope`/`probe`. Nobody imports `rulesToAST`, `interpret`, or the operator registry.
- **DIP** — the factory depends on the `rowScope`/`AppAbility` interfaces, not on rule files; rule files depend on subject constants owned by entities (existing "entity owns its identity" rule); the client depends on packed rules, not on `defineAbilitiesFor`.

Estimated cyclomatic complexity of the largest function: **`updateImpl` ≈ 11** (2 before-hooks, empty-update short-circuit, child/root branch for the instance row, field loop + deny, write miss, 2 after-hooks, `tx ?? db`) — same order as today's `:161-228` (≈ 9) with the gating moved in. `rowScope` ≈ 6 (root/coll/own × read/mutation + grandchild recursion); `interpret` ≈ 8 (unchanged shape + C9). Nothing else exceeds 5.

How changes touch the code: **new root** — one spec file + one `can` line per role that may see it (+ bearer rules if shareable); **new collection child** — one spec file, zero rule changes unless a role needs a per-collection restriction (`cannot('update','Proposal',['media.*'],{ status:'signed' })`); **new own-row child** — spec + one scalar rule per role; **new operator** — one `operators/<name>.ts` + one contract entry (boot assert closes the loop); **new role** — one `rules/<role>.ts` + one `switch` case in the loader. No change ever touches `create-crud-dal.ts`, `init.ts` or `create-crud-router.ts`.

---

## 6. Trade-offs — what the rare caller pays, and where inference can surprise

**Paid by the rare caller**
- **Joins with aliases are unsupported.** `rowScope` emits column references of the canonical table; an `aliasedTable(...)` self-join needs a hand-written scope. Today no DAL aliases a scoped table; the lint wall flags the file for a documented allowlist entry if one ever does.
- **Instance checks on a collection child need the parent row.** `ability.can('update', subject('Proposal', proposal), 'views')` — a `proposal_views` row alone carries no subject. Bespoke code that has only the child row calls `probe(ctx, childSpec, id, 'update')` (one SQL round trip) instead.
- **A child mutation costs a parent point-read** so the field gate can be instance-aware (§1.6 Perf). For the common CRUD path this is one extra pk lookup; a bulk bespoke write should load parents once and use `rowScope` on the batch.
- **`WHERE TRUE` appears in omni EXPLAIN output.** Cosmetic; the parity tool strips it. The alternative (keeping `null` as allow-all at the seam) is the three-way sentinel this design exists to remove.
- **Forbidden vs not-found is fixed by the factory** (verb ⇒ 403, row ⇒ 404, field ⇒ 403). A handler that wants a different UX (e.g. 404 for a verb miss) wraps `dalToTrpc`; it cannot change the DAL's answer.

**Where "magic" (inference) could surprise**
- **Subject inference for collection children.** A child's rows are governed by the *parent's* rules for a *field name the spec invents* (`'views'`). A rule author grepping for `ProposalView` finds nothing; the mental model is "collections are fields of the parent". Mitigated by boot assert #4 (a rule naming an unknown collection fails at boot) and by the spec table in §1.1.
- **The action map collapses child verbs.** `create`, `update` and `delete` on a collection child all mean parent `update` on the collection — a role that may edit a proposal may also delete its incentive rows. There is no way to grant "add but not remove" on a collection child without giving it its own subject. That is the documented escape hatch (own-row child), and it is the same hatch L13-4 already uses for `CustomerNote`.
- **`'<collection>'` vs `'<collection>.*'`.** Probed: the bare form grants row-touch only; the starred form grants row-touch and one level of columns; `**` grants deeper paths (grandchild columns). A rule author who writes `['views']` and expects column updates gets `forbidden{ field }` — loud, but a convention to learn. Boot assert #4 accepts both forms, so it cannot flag the intent.
- **Anonymous is an ability, not `null`.** `baseProcedure` handlers get a deny-all ability instead of `ability: null`. Code that treated `null` as "trusted/system" (`meetings/dal/server/crud.ts:34`, `scope.ts:68`) would silently deny — but those sites are deleted in the same change (L1/L7 consequences), and a deny is the safe failure direction.
- **L8 can over-restrict.** A future role granted `update` but not `read` on a subject can never mutate it. By ruling (L8) this is the intended failure direction; the boot loader can warn on such a rule set.

---

## 7. Staleness pings raised while designing

- ⚠️ **`17-sub-entity-as-field-example.md` §2 vs D-19.** The example authors `can('update', 'Proposal', { $participatesViaMeeting: … })` and `can('update', 'Customer', ['age','profile.*'], { $participatesViaMeeting: … })` — custom operators on `update` rules, which D-19 (locked 09-09) forbids ("only on `read` rules without `fields`; never on `create/update/delete`"). Its probe replaced the operators with scalar stand-ins, so the SQL shown is unaffected, but the *rules as written* would fail the D-19 boot assert. This design follows D-19 + L8: mutation rules are conditionless-with-fields or scalar-conditioned; row reach comes from the ANDed read scope. Proposed fix: rewrite §2's agent block as `can('update','Proposal')` / `can('update','Customer',['age','profile.*'])` with the participation only on the two `read` rules.
- ℹ️ `docs/how-to/add-an-entity.md` Steps 2–4 and 6 (visibility predicate, `ENTITY_NAMES`, `createEntityRouter` toolkit) describe the legacy engine and a factory that was deleted in S7 (`src/trpc/DOCS.md#entity-registry-removed`). Under this design Steps 2–4 collapse to §1.1 above; the how-to is part of Q9's document set.
