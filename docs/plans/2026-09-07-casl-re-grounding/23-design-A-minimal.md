# 23 — Design A: the minimal interface (`permit`)

> **Constraint this design optimises:** the smallest interface a caller can learn — three entry points — with every decision (root vs child vs grandchild, read vs mutation, field vs row, probe vs list, bearer vs user vs system, allow vs deny sentinel) pushed behind the seam.
> **Satisfies** README §L1–L13 and tracker D-01…D-25 as locked (2026-09-16). Where it *tightens* a locked shape it says so; where it *deviates* it says so and why (§6).
> **Evidence base.** Code read in `.worktrees/issue-285` (`abilities.ts`, `types.ts`, `scope/*`, `dal/server/lib/*`, `trpc/{init,types}.ts`, `trpc/lib/*`, customer + customer-note specs, main's `create-crud-dal.ts`), reports 06/11/12/14/17, and one fresh probe against the installed `@casl/ability@6.8.0` (§3.2). Report 17's emitted SQL is reused where the design emits the same bytes.
> Vocabulary: module · interface · implementation · seam · adapter · depth · leverage · locality (design); entity · sub-entity · Actor · spec · DAL · CRUD factory · procedure/rung · bearer · system · omni · agent/dispatcher · participation · derived pipeline · collection field (domain).

---

## 0. The one idea

**A `Permit` is one authorization decision — `(actor, action, subject-path)` — computed once and rendered three ways:** as a Drizzle predicate that is *never null* (`.sql`), as a JS test on an in-memory row (`.test`), and as a point-probe that resolves or rejects `not-found` (`.probe`).

A sub-entity is not a second model. A collection child (`proposal_views`) is a **path** on its parent's subject (`Proposal.views`, `Proposal.views.source`, `Meeting.applications.answers`), so root/child/grandchild dispatch, the create-side parent probe, the field gate and L8's mutation∧read all fall out of one operation: *compile the rules for this path*. An own-row child (`CustomerNote {authorId}`) keeps its own subject and is the only other branch.

Callers never see `rulesToAST`, `interpret`, `subject()` tagging on the server, ``sql`false` ``, `null`, `?? undefined`, `requireResolvedScope`, `canAccess`, `resolveActorScope`, `verbOnly`, `assertCan`, `assertCanUpdateFields`, `SLOT_ACTIONS`, or the parent→child action map. The 111 primitives of report 06 collapse to the three entry points below plus CASL's own `ability.can` for type-level gates.

---

## 1. Interface

### 1.1 Entry points

| # | Entry point | Where | Purpose | Pure? |
|---|---|---|---|---|
| 1 | **Principal builders** — `getRequestActor()` · `shareableActor(spec, token?)` · `systemContext(reason)` | `domains/permissions/server/actors.ts` (`server-only`) | *who* is acting, one call per surface family; every result is a plain `Actor` | `getRequestActor` cached per request; `shareableActor` = 1 token query when no session |
| 2 | **`permit(ctx, action, spec, fields?)`** → `Permit { sql, test, probe }` | `domains/permissions/permit.ts` (`server-only`) | *what* they may do to *which rows/fields*, rendered as SQL / JS / probe | `sql`+`test` sync & pure; only `probe` executes (1 query) |
| 3 | **Client** — `useAbility<AppAbility>()` · `<Can I a/this field>` · `subject(type,row)` | `@casl/react` 7.0.1 via one `'use client'` wrapper | the same rules, hydrated from `packRules` shipped by the RSC that called #1 | — |

Type-level gates (`access Dashboard`, `manage all`, `can('read','Proposal')`) use CASL's native `actor.ability.can(action, subject[, field])` on every surface. That is not a new entry point; it is the library's own interface and it is the *only* thing an RSC guard or a feature gate ever calls.

### 1.2 Types and signatures

```ts
// ── domains/permissions/actor.ts  (client-safe; L7)
export interface Actor { ability: AppAbility; userId: string | null }      // userId null ⇒ bearer or system. NO kind.
// ── dal/server/types.ts  (L7)
export interface ScopedContext { actor: Actor; tx?: Tx }                    // tRPC ctx { session, actor, req?, resHeaders? } satisfies it structurally

// ── domains/permissions/server/actors.ts  ('server-only')            ENTRY POINT 1
export const getRequestActor: () => Promise<{ session: BetterAuthSession | null; actor: Actor }>   // React cache(); ONE session read, ONE defineAbilitiesFor
export function shareableActor(spec: EntityServerSpec, token?: string | null): Promise<Actor>
//   session present → the request actor (agent-first, D-10);  else valid token → bearerActor(spec, rowId);  else deny-all actor
export function systemContext(reason: SystemReason): ScopedContext        // { actor: { ability: systemAbility(reason), userId: null } }
export function bearerActor(spec: EntityServerSpec, rowId: string): Actor  // locked L3 builder; called by shareableActor after validateShareToken

// ── domains/permissions/permit.ts  ('server-only')                    ENTRY POINT 2
export type PermitAction = 'read' | 'create' | 'update' | 'delete'         // slot verbs only; 'access'/'manage'/'own' stay type-level
export interface Permit<TId = string | number> {
  /** Row predicate over spec.table. NEVER null/undefined: allow-all ⇒ sql`true`, deny ⇒ sql`false`.
   *  Mutations already include L8 (∧ read). Children already include the parent bridge. */
  readonly sql: SQL
  /** Instance check on an in-memory row/payload (roots + own-subject children; type-level on collection children).
   *  Throws if a relevant rule carries a custom operator (D-19 tripwire). */
  test(row: Record<string, unknown>): boolean
  /** Point-probe. read/update/delete: `target` = the row id. create: `target` = the validated payload
   *  (child ⇒ probes the PARENT row named by the payload's fk; root ⇒ resolves, nothing to reach).
   *  Rejects ThrowableDalError({ type: 'not-found' }) on a miss (D-07). Uses ctx.tx ?? db. */
  probe(target: TId | Record<string, unknown>): Promise<void>
}
export function permit(ctx: ScopedContext, action: PermitAction, spec: EntityServerSpec, fields?: readonly string[]): Permit

// ── dal/server/types.ts — the ONLY configuration a caller writes (L9/L13)
export interface EntityServerSpec<TTable extends PgTable = PgTable, TId extends string | number = string> {
  entityName: string
  table: TTable
  primaryKey?: string                                                       // default 'id'
  caslSubject?: AppSubject                                                  // roots + own-row children ONLY
  parent?: { spec: EntityServerSpec; fk: PgColumn; collection?: string }   // collection ⇔ NO caslSubject (L13); own-row child omits it (L9)
  schemas: { insert: ZodObject; update: ZodObject; select: ZodObject }
  shareable?: { tokenColumn: string }                                       // roots only; bearer field allowlist lives in abilities.ts (policy, not topology)
}
export function defineSpec<T extends EntityServerSpec>(spec: T): T          // identity + boot asserts (§1.3 "Configuration")

// ── @casl/react (client)                                              ENTRY POINT 3 (locked L10)
<AbilityProvider value={ability}> · useAbility<AppAbility>() · <Can I="update" this={subject('Customer', row)} field="profile.hoa"/>
```

### 1.3 Invariants, ordering, errors, configuration, performance

**Invariants the seam guarantees (a caller may rely on them without reading the implementation):**
1. `permit(...).sql` is a `SQL` value — there is no null/undefined/unresolved state; `and(eq(pk,id), p.sql)` is always a complete predicate. Deny is ``sql`false` ``, allow-all is ``sql`true` `` (Postgres folds both).
2. A mutation predicate implies the read predicate (L8): `permit(ctx,'update'|'delete',spec).sql ⇒ permit(ctx,'read',spec).sql`.
3. A child predicate implies reach of its parent: for collection children via the parent's `update` (mutations) / `read` (reads) on the collection path; for own-row children via the parent's `read` (L9 default).
4. `fields` narrows, never widens: `permit(ctx,a,spec,[f]).sql ⇒ permit(ctx,a,spec).sql`... **except** that the field-less form can be *looser* than any field-specific form for `update` (CASL F2: a field-restricted conditionless rule makes the field-less AST `and []`). Hence the factory always passes the patch keys for `update`; the field-less `update` form exists only for `probe` on ids. (§3.2.)
5. Bearer, user, omni and system are indistinguishable to the seam — each is a rule set. `manage all` ⇒ `true` without a branch; a bearer's `{ id }` ⇒ `eq(id, $1)`; a subject with no rule ⇒ `false`.
6. `probe` never leaks existence: a miss (out of scope *or* non-existent) is `not-found`; it is never `forbidden`.
7. `test(row)` on a collection child is type-level (conditions live on the parent row, which `test` cannot see) — row reach on children is `.sql`/`.probe`'s job, not `test`'s.

**Ordering constraints.**
- `ctx.actor` comes from entry point 1 — never hand-built (`{ session: null, ability: null, … }` literals are gone).
- In a create: hooks stamp (`authorId`, `ownerId`) → Zod validate → `test(validated)` → `await probe(validated)` → INSERT. Stamp before test because `{ authorId: userId }` rules are evaluated against the payload.
- In an update: load with `permit(ctx,'read',spec).sql` (miss ⇒ `not-found`) → hooks → validate → UPDATE with `permit(ctx,'update',spec,keys).sql` (0 rows ⇒ `forbidden`, we already know it is readable).
- `cannot` rules are authored LAST per action/subject (D-20); operators registered by module import before the first `permit` (unchanged `interpret.ts` side-effect imports).

**Error modes.** `permit()` itself throws only on programming errors and only in ways the boot asserts already catch (unknown column in a condition, unregistered operator, `test` on an operator-bearing rule set). `probe` rejects `ThrowableDalError({ type: 'not-found' })`. `test` returns `boolean`; the factory maps `false` → `ThrowableDalError({ type: 'forbidden', field? })` (add optional `field` to `DalError.forbidden`). `shareableActor` never throws — no session + no/invalid token ⇒ the deny-all actor, so every downstream read is `not-found` and the tRPC rung returns `UNAUTHORIZED` only where a procedure asserts a session.

**Required configuration.** Per entity: one `defineSpec({...})` and rules in `abilities.ts`. `defineSpec` asserts at boot: (a) exactly one of `caslSubject` | `parent.collection`; (b) `parent.fk` is a column of `table`; (c) no `collection` name collides with a real column of the parent table (L13-7); (d) `primaryKey` exists. `abilities.ts` asserts (existing `assertScopeWiring` extended): (e) D-19 — custom operators only on field-less `read` rules; (f) `cannot` last per action/subject; (g) `conditions: {}` treated as conditionless in the D-02 audit. Bearer policy: `BEARER_GRANTS[subject] = { update: [...fields/collections] }` beside `defineAbilitiesFor` — the L12 allowlist (`['financeOptionId','cashInDealCents','views']`).

**Performance.** `sql`/`test` are sync and allocation-light (`rulesFor` is an index lookup; the AST walk is per rule). Per-field compile emits one predicate per *distinct rule set* the fields resolve to (the seam dedupes `rulesFor` results by identity before compiling), so a 20-column profile patch under `['profile.*']` compiles once. Child predicates are `fk IN (SELECT pk FROM parent WHERE …)` semi-joins, one per bridge level. `probe` is `SELECT 1 … LIMIT 1`. `getRequestActor` is one session read + one ability build per request (L4). Nothing here is cached beyond that; `permit` is cheap enough to call per query.

### 1.4 The six caller kinds

```ts
// (a) CRUD factory slot — createCrudDal never branches on root/child, never names an action map, never tags subject()
getById:   and(eq(pk, id), permit(ctx, 'read', spec).sql)
create:    if (!p.test(validated)) throw forbidden;  await p.probe(validated);  INSERT             // p = permit(ctx,'create',spec, keys(validated))
update:    load(read)  →  UPDATE … WHERE and(eq(pk,id), permit(ctx,'update',spec, keys(validated)).sql)  → 0 rows ⇒ forbidden
delete:    load(read)  →  DELETE … WHERE and(eq(pk,id), permit(ctx,'delete',spec).sql)               → 0 rows ⇒ forbidden
duplicate: getById → create

// (b) bespoke DAL read joining two scoped tables — one .sql per scoped table, placed by the author
db.select({ ...getTableColumns(meetings), customerName: customers.name })
  .from(meetings)
  .leftJoin(customers, and(eq(customers.id, meetings.customerId), permit(ctx, 'read', customerServerSpec).sql))
  .where(and(permit(ctx, 'read', meetingServerSpec).sql, filters))

// (c) tRPC handler with a client-supplied id (D-07) — probe first, then the bespoke write
setHero: agentProcedure.input(z.object({ projectId, mediaId })).mutation(async ({ ctx, input }) => {
  await permit(ctx, 'update', projectServerSpec, ['heroMediaId']).probe(input.projectId)      // not-found on miss
  return dalToTrpc(await setHeroImage(ctx, input))
})

// (d) RSC guard — type-level only; no permit
const { session, actor } = await getRequestActor()
if (!session) return { status: 'unauthenticated' }
if (actor.ability.cannot('access', 'Dashboard')) redirect('/')
return <AbilityProvider rules={packRules(actor.ability.rules)}>{children}</AbilityProvider>   // L10 hydration

// (e) route.ts — token-or-session, one call; DAL read is scoped by the same permit the tRPC path uses
const actor = await shareableActor(proposalServerSpec, url.searchParams.get('token'))
const result = await getFullView({ actor }, { id: proposalId })                               // getFullView uses permit(ctx,'read',proposalServerSpec).sql
if (!result.success || !result.data) return Response.json({ error: 'Not found' }, { status: 404 })

// (f) client component — same rules, instance checks via subject()
const ability = useAbility<AppAbility>()
<Can I="delete" this={subject('CustomerNote', note)}>…</Can>
ability.can('update', subject('Proposal', proposal), 'incentives')
```

---

## 2. Usage examples, end to end

### 2.1 `recordView` — a bearer creates a proposal view

```ts
// entities/proposal-views/lib/server-spec.ts  (new — today the table has no spec)
export const proposalViewSpec = defineSpec({
  entityName: 'proposal-view', table: proposalViews,
  parent: { spec: proposalServerSpec, fk: proposalViews.proposalId, collection: 'views' },
  schemas: { insert: insertProposalViewSchema, update: updateProposalViewSchema, select: selectProposalViewSchema },
})
// abilities.ts
export const BEARER_GRANTS = { Proposal: { update: ['financeOptionId', 'cashInDealCents', 'views'] } } as const     // L12 7b
export function defineBearerAbilityFor(subject: 'Proposal', rowId: string): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility)
  can('read', subject, { id: rowId })
  can('update', subject, [...BEARER_GRANTS[subject].update], { id: rowId })
  return build({ conditionsMatcher: buildScopeConditionsMatcher() })
}
// agent (unchanged shape):  can('read','Proposal',{ $participatesViaMeeting:{ via:'meetingId', userId } });  can('update','Proposal')
// entities/proposal-views/dal/server/crud.ts
export const proposalViewCrud = createCrudDal(proposalViewSpec, () => ({
  hooks: { create: { after: async (view, ctx) => {                       // notification needs owner + customer name
    const proposal = dalVerifySuccess(await getFullView(ctx, { id: view.proposalId }))   // bearer can read its own row
    await sendViewNotificationJob.dispatch({ proposalOwnerId: proposal!.ownerId, customerName: proposal!.customer?.name ?? 'Customer', viewedAt: view.viewedAt, … })
  } } },
}))
// trpc/routers/proposals.router/views.router.ts
recordView: proposalShareableProcedure.input(recordViewSchema)
  .mutation(({ ctx, input }) => dalToTrpc(proposalViewCrud.create(ctx, input)))      // no resolveShareTokenActor, no systemProcedure, no SYSTEM_CONTEXT
// client (proposal page RSC shipped packRules(bearer.rules))
useAbility().can('update', subject('Proposal', proposal), 'views')   // true on the token row
```
What runs inside `proposalViewCrud.create`: `p = permit(ctx,'create',proposalViewSpec,['proposalId','source',…])`; `p.test(data)` = type-level `can('update','Proposal','views')` → true; `p.probe(data)` emits `select 1 from "proposals" where ("proposals"."id" = $1 and ("proposals"."id" = $2 and "proposals"."id" = $3))` (update-on-`views` ∧ read on the token row — report 17 #1 plus the L8 read term) → hit → `insert`. A bearer whose token names another proposal: `id = p2 and id = p1` → miss → `not-found`.

### 2.2 `profile.upsert` — a dispatcher updates a customer's profile facet

```ts
// entities/customers/lib/profile-spec.ts   (customer_profiles is 1:1, pk = customerId)
export const customerProfileSpec = defineSpec({
  entityName: 'customer-profile', table: customerProfiles, primaryKey: 'customerId',
  parent: { spec: customerServerSpec, fk: customerProfiles.customerId, collection: 'profile' },
  schemas: { insert: customerProfilePatchSchema, update: customerProfilePatchSchema, select: selectCustomerProfileSchema },
})
// abilities.ts — dispatcher (D-19: no operator on the mutation rule; rows come from ∧ read, L8)
can('read',   'Customer', { $inDerivedPipeline: ['leads', 'rehash', 'dead', 'fresh'] })
can('update', 'Customer', ['name', 'phone', 'email', 'address', 'city', 'state', 'zip', 'pipelineStage', 'age', 'profile.*'])
// entities/customers/dal/server/mutations.ts — a bespoke slot (upsert is not one of the five)
export async function upsertCustomerProfile(ctx: ScopedContext, input: { customerId: string; patch: CustomerProfilePatch }) {
  return dalDbOperation(async () => {
    const validated = customerProfilePatchSchema.parse(input.patch)
    await permit(ctx, 'create', customerProfileSpec, Object.keys(validated)).probe({ customerId: input.customerId })  // parent probe on Customer.profile.<k>
    return dalVerifySuccess(await upsertOneToOne(ctx.tx ?? db, customerProfiles, customerProfiles.customerId, input.customerId, validated))
  })
}
// trpc/routers/customers.router/profile.router.ts
upsert: agentProcedure.input(z.object({ id: z.string().uuid(), data: customerProfilePatchSchema }))
  .mutation(({ ctx, input }) => dalToTrpc(await upsertCustomerProfile(ctx, { customerId: input.id, patch: input.data })))   // the cannot('update','CustomerProfile') hand-check is gone
// client
<Can I="update" this={subject('Customer', customer)} field="profile.hoa">…</Can>     // dispatcher: true on a lead; agent: true on a participant's customer
```
Probe emitted (dispatcher, patch `{ hoa }`): `select 1 from "customers" where ("customers"."id" = $1 and (true and <derivedPipelineWhere(['leads','rehash','dead','fresh'])>))` — the `true` is the conditionless field-restricted update rule; the pipeline predicate is the L8 read term. An agent gets `true and EXISTS(meeting_participants …)`. A row outside the pipeline → `not-found`. A dispatcher patching `{ creditScore }` when the rule says `profile.*` → still `profile.creditScore` matches → allowed; patching a column the rule does not name (e.g. if `profile.secret` were `cannot`-ed for `{ vip: true }`) → the `cannot` lands in the SAME predicate (`not vip = true and …`).

### 2.3 `customer-notes` — own-row child

```ts
// entities/customer-notes/lib/server-spec.ts
export const customerNoteSpec = defineSpec({
  entityName: CUSTOMER_NOTE, caslSubject: CUSTOMER_NOTE, table: customerNotes,
  parent: { spec: customerServerSpec, fk: customerNotes.customerId },          // no collection ⇒ own-row child (L9/L13-4)
  schemas: { insert: insertCustomerNoteSchemaBounded, update: updateCustomerNoteSchema, select: selectCustomerNoteSchema },
})
// abilities.ts — agent AND dispatcher (identical grant)
can('read', 'CustomerNote')
can('create', 'CustomerNote', { authorId: userId })
can(['update', 'delete'], 'CustomerNote', { authorId: userId })               // scalar ⇒ evaluable by test() and by the client matcher
// entities/customer-notes/dal/server/crud.ts
export const customerNoteCrud = createCrudDal(customerNoteSpec, () => ({
  hooks: { create: { before: (input, ctx) => ({ ...input, authorId: ctx.actor.userId ?? input.authorId ?? null }) } },   // stamp; no canAccess, no assertNoteAuthorOrAdmin
}))
// router: createCrudRouter({ spec: customerNoteSpec, schemas: customerNoteSchemas, crud: customerNoteCrud })   — nothing else
// client
<Can I="delete" this={subject('CustomerNote', note)}>…</Can>                   // use-customer-note-action-configs.ts mirror deleted
```
Emitted: **create** — `test({…, authorId: me})` = `can('create', subject('CustomerNote',{authorId:me}))` → true; `probe(data)` → `select 1 from "customers" where ("customers"."id" = $1 and <read Customer>)` (own-row child ⇒ parent `read`, L9). **delete** — load: `… where ("customer_notes"."id" = $1 and (true and "customer_notes"."customer_id" in (select "id" from "customers" where <read Customer>)))`; then `delete … where ("customer_notes"."id" = $1 and ("customer_notes"."author_id" = $2 and "customer_notes"."customer_id" in (select …)))` — 0 rows for another author's note ⇒ `forbidden`. Super-admin: `manage all` ⇒ `true` everywhere.

### 2.4 An agent lists proposals with their incentives

```ts
// entities/proposal-incentives/lib/server-spec.ts
export const proposalIncentiveSpec = defineSpec({ entityName: 'proposal-incentive', table: proposalIncentives,
  parent: { spec: proposalServerSpec, fk: proposalIncentives.proposalId, collection: 'incentives' }, schemas: { … } })
// abilities.ts — agent
can('read', 'Proposal', { $participatesViaMeeting: { via: 'meetingId', userId } })
can('update', 'Proposal')
cannot('update', 'Proposal', ['incentives', 'media'], { status: 'signed' })     // LAST (D-20)
// entities/proposals/dal/server/queries.ts
export async function listProposalsWithIncentives(ctx: ScopedContext, input: ProposalListInput) {
  return dalDbOperation(async () => {
    const rows = await db
      .select({ ...getTableColumns(proposals), customerName: customers.name, incentive: getTableColumns(proposalIncentives) })
      .from(proposals)
      .leftJoin(meetings, eq(meetings.id, proposals.meetingId))
      .leftJoin(customers, and(eq(customers.id, meetings.customerId), permit(ctx, 'read', customerServerSpec).sql))        // scoped table #2
      .leftJoin(proposalIncentives, and(eq(proposalIncentives.proposalId, proposals.id), isNull(proposalIncentives.sowItemId),
        permit(ctx, 'read', proposalIncentiveSpec).sql))                                                                  // child: read bridge on 'incentives'
      .where(and(permit(ctx, 'read', proposalServerSpec).sql, buildFilters(input)))                                       // scoped table #1
      .orderBy(desc(proposals.createdAt), asc(proposalIncentives.position))
    return groupIncentives(rows)
  })
}
// router:  list: agentProcedure.input(proposalListInputSchema).query(({ ctx, input }) => dalToTrpc(await listProposalsWithIncentives(ctx, input)))
// client (delete-incentive affordance): ability.can('update', subject('Proposal', proposal), 'incentives')   // false when status === 'signed'
```
Emitted for the child term (report 17 #3, byte-identical): `"proposal_incentives"."proposal_id" in (select "id" from "proposals" where EXISTS(… meeting_participants … user_id = $1))`. A later `proposalIncentiveCrud.delete(ctx,{id})` emits report 17 #4: `… in (select "id" from "proposals" where (not "proposals"."status" = $2 and EXISTS(…))) and … in (select "id" from "proposals" where EXISTS(…))` — the `cannot` lands in the child's mutation WHERE without anyone naming it. A dispatcher (no `Proposal` rule) gets `… in (select "id" from "proposals" where false)` (report 17 #6).

---

## 3. What the implementation hides

### 3.1 Shape (≈120 new lines; `interpret.ts`, `ast.ts`, `operators*.ts`, `conditions-matcher.ts` kept as-is)

```ts
// permit.ts ('server-only')
export function permit(ctx, action, spec, fields) {
  const { ability } = ctx.actor
  const row = compile(ability, action, spec, fields)
  const sql = action === 'read' ? row : dedupeAnd(row, compile(ability, 'read', spec))      // L8
  return { sql, test: r => testRow(ability, action, spec, fields, r), probe: t => probe(ctx, ability, action, spec, fields, sql, t) }
}
function compile(ability, action, spec, fields): SQL {
  if (!spec.parent)      return root(ability, action, spec.caslSubject!, spec, fields)                                // ROOT
  if (spec.caslSubject)  return dedupeAnd(root(ability, action, spec.caslSubject, spec, fields), bridge(ability, 'read', spec))   // OWN-ROW CHILD (L9)
  return bridge(ability, action === 'read' ? 'read' : 'update', spec, fields)                                          // COLLECTION CHILD (L13-3)
}
function bridge(ability, parentAction, spec, fields): SQL {                                                            // grandchildren recurse: 'applications.answers'
  const { spec: parent, fk, collection } = spec.parent!
  const paths = collection ? (fields?.length ? fields.map(f => `${collection}.${f}`) : [collection]) : undefined
  return inArray(fk, qb.select({ pk: pkOf(parent) }).from(parent.table).where(compile(ability, parentAction, parent, paths)))
}
function root(ability, action, subjectType, spec, fields): SQL {                                                       // FIELD-AWARE compile
  const ruleSets = uniqBy((fields?.length ? fields : [undefined]).map(f => ability.rulesFor(action, subjectType, f)), sameRules)
  return dedupeAnd(...ruleSets.map(rules => { const ast = rulesToASTFrom(rules); return ast === null ? sql`false` : (interpret(ast, { table: spec.table, pk: pkOf(spec) }) ?? sql`true`) }))
}
```
`rulesToASTFrom(rules)` is report 17's 9-line `rulesToASTForField` body over an explicit rule list (mirrors `@casl/ability/extra`'s `rulesToQuery`: direct+conditions → OR; inverted+conditions → AND NOT; direct conditionless → short-circuit; inverted conditionless → break; empty OR → `null`).

### 3.2 Decisions hidden, with the evidence

| Hidden decision | Mechanism | Evidence |
|---|---|---|
| Root vs child vs grandchild | `compile` dispatches on `spec.parent` + `caslSubject`; `bridge` recurses with dotted paths | report 17 §3; SQL #3/#4/#5 |
| Child action map (create/update/delete ⇒ parent `update`; read ⇒ `read`; own-row child ⇒ parent `read`) | one ternary in `compile`; L9 default in the own-row branch | L13-3 (probe proved `delete` passed straight through collapses to `false`) |
| Field vs row | `fields` → paths → `ability.rulesFor(action, subject, path)` per field, deduped; **per-field compile closes CASL F2**: fresh probe on 6.8.0 — `rulesFor('update','Customer')` with a conditionless `['age','profile.*']` rule and a conditioned `['name']` rule → both rules, AST `and []` (allow-all); `rulesFor('update','Customer','name')` → only the conditioned rule; `'profile.hoa'` → the wildcard rule; `'phone'` → `[]` (⇒ `false`); an inverted `['profile.secret']` rule is dropped from the field-less call and included for `'profile.secret'` | probe run 2026-09-16 (this design); report 14 §1.5–1.7 |
| Mutation ∧ read | `permit` ANDs `compile(read)` for every non-read action; identical fragments deduped by rendered SQL | L8; report 17 SQL #4/#5 |
| Probe vs list | `.sql` composes into any query; `.probe` is `select 1 … limit 1` with `not-found`; `create` probes the *parent* via the payload's fk | D-07; report 11 §3.2 step 5 |
| Bearer / user / omni / system | all are `Actor { ability }`; `manage all` ⇒ empty AND ⇒ `true`; bearer `{ id }` ⇒ `eq`; no rule ⇒ `false`. Zero `kind`/`userId === null` branches anywhere in `permit.ts` | report 11 §1.1, F1/F4; L1/L3/L7 |
| Sentinels | return type `SQL`; `interpret`'s `null` (empty AND) mapped to ``sql`true` `` at exactly one line; deny is ``sql`false` ``. The three-way `null` cannot be expressed — `requireResolvedScope`, `?? undefined`, ``?? sql`true` `` all delete | report 06 S3 #4; report 11 §2 note |
| Instance checks without hand-tagging | `test` tags with `subject(subjectTypeOf(spec), row)` itself (untagged POJO silently → `[]`, report 14 §1.6) and refuses operator-bearing rule sets (D-19 tripwire) | report 14 §1.6, §1.9 |
| Operator registry | unchanged `defineScopeOperator` / `SCOPE_OPERATOR_NAMES` / boot asserts; `OperatorCtx` shrinks to `{ table, pk }` (ids are baked into conditions, L7) | report 11 §1.2 option A |
| Executor | `ctx.tx ?? db` chosen inside `probe` and the factory; `permit.sql` needs no connection (query-builder-only Drizzle for tests) | report 17 appendix |

---

## 4. Dependency strategy and adapters

| Seam | Interface at the seam | Adapter(s) | Real or hypothetical |
|---|---|---|---|
| **Rules source** → `AppAbility` | `defineAbilitiesFor(user)`, `defineBearerAbilityFor(subject,rowId)`, `systemAbility(reason)` | (1) `abilities.ts` role blocks; (2) ad-hoc `AbilityBuilder` rule sets in tests and the boot assert (`'__assert__'` sentinel id) | **Real ×2** — `permit` takes `ctx.actor.ability`, so any rule set is a valid adapter; report 17's probe already exercised (2) |
| **Principal source** → `Actor` | entry point 1 | (1) session via better-auth (`getRequestActor`); (2) share token (`shareableActor` → `validateShareToken` → `bearerActor`); (3) `systemContext(reason)` | **Real ×3** — three surface families exist today (07 flow catalog: 16 token flows, 30 `SYSTEM_CONTEXT` sites) |
| **Decision renderer** ← `Permit` | `sql` / `test` / `probe` | (1) Drizzle SQL via `interpret` (server); (2) CASL JS matcher via `subject()` (server `test`, client `<Can>`) | **Real ×2** — the same rule compiles to `EXISTS(…)` on the server and evaluates `{ authorId }` in the browser. `@ucast/sql` is the hypothetical third, rejected by D-01 |
| **Operator body** | `ScopeOperator { toSql, toJS? }` | (1) `toSql` bodies (`server-only`); (2) `toJS` client interpreters — the D-19(b) escape hatch | (1) real; (2) **hypothetical** until a mutation rule needs participation |
| **Session lookup** | `auth.api.getSession(headers)` inside `getRequestActor` | better-auth | one real adapter; **local-substitutable** (fake session object) — no second provider planned |
| **Query execution** | `Executor = Tx \| typeof db` | (1) `db`; (2) `ctx.tx` inside transactions; (3) query-builder-only `drizzle(async () => ({ rows: [] }))` in tests | **Real ×2** + test substitute |
| **Transport to client** | `packRules(actor.ability.rules)` prop → `unpackRules` in the one `'use client'` wrapper | RSC props | one real adapter; the C.iii "client rebuilds from session" hybrid is hypothetical and rejected by L10 |

Dependency categories per the brief: CASL evaluation + Drizzle query building are **in-process pure** — `permit(...).sql.toSQL()` is a string, so the whole decision surface is tested by compiled-SQL comparison per role × entity × action (the D-21 parity script becomes a table of expected strings). Session lookup and query execution are **local-substitutable** and touched only by entry point 1 and `probe`.

---

## 5. SOLID + complexity audit

- **SRP.** `permit.ts` decides *rows/fields for an action*; `actors.ts` decides *who*; `abilities.ts` holds *policy*; `define-spec.ts` holds *topology*; `create-crud-dal.ts` holds *slot orchestration* (hooks, validation, write). Evidence: `permit.ts` imports no auth, no session, no `EntityServerSpec` hooks; `abilities.ts` imports no Drizzle; `create-crud-dal.ts` imports `permit` and nothing else from `domains/permissions`.
- **OCP.** A new child, entity, operator or role adds files without editing `permit.ts` (table below). The only edit that opens `permit.ts` is a new *bridge kind* (a third child model) — none is known.
- **LSP.** Every `Actor` — request, bearer, system, test — is the same plain record and is accepted by every `ScopedContext` parameter; `manage all` and `{ id }` produce correct SQL through the same code path. Evidence: no `kind` field exists to branch on; report 11 §1.1's 14 `actor.kind` reads are all deleted.
- **ISP.** A bespoke read learns one member (`.sql`); the factory learns three; an RSC learns none of them (`ability.can`); the client learns `@casl/react`. No caller is handed `rulesFor`, `interpret`, the registry or `subject()`-tagging on the server. The `Permit` handle's three members are three views of one value, not three responsibilities.
- **DIP.** `permit` depends on `AppAbility` (an interface any rule set satisfies), `EntityServerSpec` (data), and Drizzle's SQL builders; execution depends on the injected `ctx.tx ?? db`. The rules source and the session are *upstream* of the seam and never imported by it.

**Cyclomatic complexity (estimated).** `root()` 6 (fields loop, dedupe, null-AST, empty-AND, and-fold); `compile()` 3; `bridge()` 4; `rulesToASTFrom()` 6; `probe()` 5 (create/root/child/miss); `testRow()` 5; `shareableActor()` 4. Largest new function ≈ 6. `interpret()` stays the largest in the module at ≈ 9 (unchanged). The CRUD factory's `updateImpl` drops from ≈ 12 to ≈ 8 (the prefetch-if-hooks branch and the empty-update `getById` retry collapse into "always load first").

**Change footprint.**

| Change | Files touched | Engine touched? |
|---|---|---|
| New root entity | `entities/<x>/lib/server-spec.ts` (+ `dal/server/crud.ts`), `abilities.ts` (rules + `ENTITY_NAMES`), `types.ts` only if it is a non-entity gate | no |
| New collection child | `entities/<child>/lib/server-spec.ts` (one `parent:` line), `abilities.ts` (name the collection in the parent's field lists where restricted) | no |
| New own-row child | as above + `caslSubject` + rules on its own subject | no |
| New operator | `scope/operators/<op>.ts` (`toSql`, optional `toJS`), `scope/operator-names.ts`, `types.ts` (`AppConditions` key) | registry only (existing shape) |
| New role | `abilities.ts` case block, `constants/enums` `UserRole` | no |
| New shareable root | `spec.shareable.tokenColumn`, `BEARER_GRANTS[subject]`, one `<entity>ShareableProcedure = baseProcedure.use(shareable(spec))` | no |

---

## 6. Trade-offs

**Where leverage is high.**
- One call per DAL slot, per bespoke read, per route: the factory has no root/child branch, no action map, no verb gate, no field gate — those five report-11 helpers (`toWhere`, `canReach`, `permittedFields`, `assertCan`, `assertCanOn`, `scopedWhere`) are one handle.
- The field gate is *SQL*, not a post-load JS check: no parent-row load for child mutations, no `subject()` tagging hazard on the server, and the F2 allow-all class is closed by construction (per-field `rulesFor`) rather than only contained by L8.
- Sentinels are gone by type: `SQL`, never `SQL | null | undefined`. The 41 `requireResolvedScope` sites, the ``?? sql`true` `` bridge, and the `null`-means-omni convention all delete.
- Bearer and system need no engine branch; a test can hand `permit` any `AbilityBuilder` output and compare strings.

**Where it is thin.**
- `test(row)` covers roots and own-row children with scalar conditions only. It is type-level on collection children and *throws* on operator-bearing rule sets (a deliberate tripwire; D-19 makes the mutation path safe, the read path must use `.sql`). Read-side masking of columns (L12 7c, deferred) is not expressible through `permit` — it would need a fourth rendering (`fields(row)` returning the permitted list); until then that use goes straight to `permittedFieldsOf` on the ability.
- `probe(target)` overloads its parameter (id for existing rows, payload for `create`). It removes the factory's last root/child branch, at the cost of a union type a reader must learn once.
- Failure UX: `probe` and bespoke reads answer `not-found` for every miss, including type-level "no rule at all" (report 11 preferred `forbidden` there). The factory recovers `forbidden` for update/delete only because it loads the row first; a bespoke handler that skips the load gets `not-found`. Chosen deliberately for D-07's no-leak rule.
- Per-field compile can emit up to *k* predicates for a *k*-column patch spanning *k* distinct rule sets; the dedupe by rule-set identity makes the common cases (one wildcard rule, one field-less rule) a single predicate, but a patch that touches columns owned by several conditioned rules pays one `EXISTS`/`IN` each. Postgres handles this fine at our row counts; the parity script should record it.
- `WHERE (… AND true)` appears in omni queries. Cosmetic; the planner folds it.
- The bespoke-read author still decides *where* each scoped table's `.sql` goes (ON vs WHERE) — the seam cannot know a query's join topology. A lint heuristic (report 11 §5.3) is still the guard against a forgotten `.sql`.

**What was sacrificed to hit the constraint.**
- A vocabulary of named checks (`assertCan`, `canReach`, `scopedWhere`) that read well at call sites; readers now learn `permit(...).probe` / `.sql` instead.
- A separate "which fields may I touch" query — folded into the input side (`fields?`) because every present caller *knows* the keys it is about to write.
- Freedom for children to carry conditions on their own columns while also being collection fields — a child is one or the other (`caslSubject` xor `parent.collection`), enforced at boot.
- `bearerActor(spec, rowId)` stays exported with its locked signature but is no longer a caller-facing builder: callers use `shareableActor(spec, token)` (session-first, validates, mints). This is a *tightening* of L3/L7, not a deviation — `validateShareToken` still runs before `bearerActor`, in one place instead of three.

---

## 7. Stale-reference pings surfaced while designing

- ⚠️ **Stale ref — `17-sub-entity-as-field-example.md` §2 authors `can('update','Proposal',{ $participatesViaMeeting })`, `can('update','Customer',['age','profile.*'],{ $participatesViaMeeting })` and `can('update','Customer',['profile.*','pipelineStage'],{ $inDerivedPipeline })`, but README §L10 / tracker D-19 (locked 09-09) forbid custom operators on any rule with `fields` or on `create/update/delete`.** Under D-19 those mutation rules must be operator-free (row reach comes from L8's ∧ read), which is how §2.2 here authors them; the emitted SQL differs from report 17 #5 only in a `true` where the update-side pipeline predicate was. Proposed fix: amend report 17 §2 to the D-19-compliant form, or record the D-19(b) escape hatch as the chosen exception for those three rules.
- ⚠️ **Stale ref — `docs/plans/2026-09-07-casl-re-grounding/README.md` §L13 / report 17 §1 show `defineChildSpec(...)` with no `caslSubject`, while `dal/server/types.ts:181-182` still types `entityName: EntityName` and `caslSubject: AppSubject` as required.** Collection children are not `EntityName`s (they are not subjects). This design makes both optional under `defineSpec` (§1.2) and moves the xor to a boot assert; the `ENTITY_NAMES` union should shrink to roots + own-row children when the specs land (`CUSTOMER_PROFILE`, `CUSTOMER_LEAD_ATTRIBUTION`, `PROPOSAL_MEDIA_FILE`, `MEDIA_FILE` leave it per L13 §2).
