# 17 — L13 worked example: a sub-entity as a FIELD of its parent subject (2026-09-13)

> Grill artefact for README §L13 (Q7b′). Shows what shape (F)+(SQL) looks like in practice on real tables (`proposal_views`, `proposal_incentives`, `customer_profiles`) with the emitted Drizzle SQL from a scratch probe against the installed `@casl/ability@6.8.0` + `drizzle-orm@0.45.1` (query builder only, no connection). Custom operators (`$participatesViaMeeting`, `$inDerivedPipeline`) are replaced by scalar stand-ins in the probe; their EXISTS/CASE emission is unchanged by this design.

## 1. What the child entity declares (the ONE declaration)

```ts
// src/shared/entities/proposal-views/lib/server-spec.ts   (new — today proposal_views has no spec at all)
export const proposalViewServerSpec = defineChildSpec({
  table: proposalViews,
  parent: { spec: proposalServerSpec, fk: proposalViews.proposalId, collection: 'views' },   // naming of `collection` = L13-2
  schemas: { insert: insertProposalViewSchema, update: …, select: selectProposalViewSchema },
})
// NO caslSubject, NOT in ENTITY_NAMES. Subject is INFERRED = parent's ('Proposal'); the collection is a FIELD of it.

// src/shared/entities/customers/…/customer-profile server-spec (customer_profiles is 1:1, pk = customerId)
parent: { spec: customerServerSpec, fk: customerProfiles.customerId, collection: 'profile' }
```

## 2. What abilities.ts declares

```ts
// bearer — built per row by bearerActor(proposalServerSpec, rowId)
can('read',   'Proposal', { id })                                                     // read field list = 7c (deferred)
can('update', 'Proposal', ['financeOptionId', 'cashInDealCents', 'views'], { id })   // `views` = the collection

// agent — CORRECTED 2026-09-16 (design-D review): custom operators live ONLY on field-less `read` rules (D-19);
// mutation rules carry verb + fields + SCALAR conditions; row reach for a mutation comes from L8 (`toWhere(action) ∧ toWhere('read')`).
can('read',   'Proposal', { $participatesViaMeeting: { via: 'meetingId', userId } })   // the ONLY place the operator appears
can('update', 'Proposal')                                                               // no field list ⇒ every column AND every collection; rows = read scope via L8
cannot('update', 'Proposal', ['incentives', 'media'], { status: 'signed' })              // per-collection restriction, scalar condition; `cannot` LAST (D-20)
can('read',   'Customer', { $participatesViaMeeting: { via: 'customerId', userId } })
can('update', 'Customer', ['age', 'profile.*'])                                          // rows = read scope via L8

// dispatcher
can('read',   'Customer', { $inDerivedPipeline: DISPATCHER_PIPELINES })
can('update', 'Customer', ['profile.*', 'pipelineStage'])                                // rows = read scope via L8
```
> **Consequence for the child bridge:** for a mutation the update-bridge is usually allow-all on rows (`fk IN (SELECT pk FROM parent WHERE true)`) and the READ-bridge carries the reach; a scalar `cannot` on the update rule (e.g. `status = 'signed'`) still lands in the update-bridge. When a mutation must be NARROWER than read, use a scalar condition (`{ ownerId }`); an operator on a mutation rule needs escape hatch (b) of L10 (JS interpreters registered in the shared matcher). The probe in §6 used scalar stand-ins throughout, so its SQL is unaffected.
`CustomerProfile`, `CustomerLeadAttribution`, `ProposalMediaFile`, `MediaFile` (and the never-created `ProposalView`, `ProposalIncentive`) are NOT subjects. Subject union = roots + children with own-row rules (`CustomerNote`; `Application` TBD in Q8) + feature gates.

## 3. The adapter

```ts
// src/shared/domains/permissions/scope/to-where.ts  ('server-only')
/** null = allow-all · sql`false` = deny · SQL = predicate */
export function toWhere(ability: AppAbility, action: AppAction, spec: EntityServerSpec, field?: string): SQL | null {
  if (!spec.parent) {                                                   // ROOT: compile the subject's rules (for the field, if any)
    const ast = rulesToASTForField(ability, action, spec.caslSubject, field)   // ~15 lines over ability.rulesFor(action, subject, field); mirrors @casl/ability/extra
    return ast === null ? sql`false` : interpret(ast, { table: spec.table, pk: pk(spec) })
  }
  const { spec: parent, fk, collection } = spec.parent                  // CHILD: bridge through the parent's rules for THIS collection
  const path = field ? `${collection}.${field}` : collection            // grandchild: 'applications.answers'
  return inArray(fk, db.select({ pk: pk(parent) }).from(parent.table).where(toWhere(ability, parentAction(action), parent, path) ?? undefined))
}
const parentAction = (a: AppAction) => (a === 'read' ? 'read' : 'update')   // child create/update/delete = "touch the parent's collection"  (L13-3)
export const scopedWhere = (ability, action, spec) =>                         // L8
  action === 'read' ? toWhere(ability, 'read', spec) : and(toWhere(ability, action, spec), toWhere(ability, 'read', spec))
```

## 4. The DAL slots (createCrudDal, child branch)

```ts
getById / list : .where(and(eq(pk, id), scopedWhere(ctx.actor.ability, 'read', spec)))
create         : parent point-probe  select 1 from parent where parent.pk = input[fk] and toWhere(ability, 'update', parent.spec, collection)
                 → NOT_FOUND on miss (D-07) → insert                                           // closes the create-side IDOR class (E1-4)
update / delete: .where(and(eq(pk, id), scopedWhere(ctx.actor.ability, action, spec)))     // = parent update-bridge ∧ read-bridge
field gate     : for each patched column c: ability.can('update', subject(parentSubject, parentRow), `${collection}.${c}`)   // fieldPatternMatcher expands 'profile.*'
```

## 5. Routers and client

```ts
// proposals.router/views.router.ts
recordView: proposalShareableProcedure.input(recordViewSchema)
  .mutation(({ ctx, input }) => proposalViewCrud.create(ctx, input))   // ctx.actor = bearerActor; no resolveShareTokenActor, no systemProcedure, no SYSTEM_CONTEXT

// customers.router/profile.router.ts
upsert: agentProcedure.input(…)
  .mutation(({ ctx, input }) => customerProfileCrud.upsert(ctx, { customerId: input.id, patch: input.data }))   // the `cannot('update','CustomerProfile')` hand-check is gone

// client (same rules, hydrated via packRules)
<Can I="update" this={subject('Customer', customer)} field="profile.hoa">…</Can>
ability.can('update', subject('Proposal', proposal), 'views')
```

## 6. Emitted SQL (probe output, verbatim)

```

# 1. bearer recordView: parent probe for create (update Proposal.views on the token row)
select 1 from "proposals" where ("proposals"."id" = $1 and "proposals"."id" = $2)
  params: ["p1","p1"]

# 2. bearer touching incentives (no rule names that field)
select 1 from "proposals" where ("proposals"."id" = $1 and false)
  params: ["p1"]

# 3. agent list proposal_views (read bridge)
select "id", "proposal_id", "viewed_at", "ip_address", "user_agent", "source", "referer" from "proposal_views" where "proposal_views"."proposal_id" in (select "id" from "proposals" where "proposals"."owner_id" = $1)
  params: ["u1"]

# 4. agent delete incentive row (update bridge ∧ read bridge)
delete from "proposal_incentives" where ("proposal_incentives"."id" = $1 and ("proposal_incentives"."proposal_id" in (select "id" from "proposals" where (not "proposals"."status" = $2 and "proposals"."owner_id" = $3)) and "proposal_incentives"."proposal_id" in (select "id" from "proposals" where "proposals"."owner_id" = $4)))
  params: ["inc1","signed","u1","u1"]

# 5. dispatcher update customer_profiles (update bridge ∧ read bridge)
update "customer_profiles" set "hoa" = $1, "updated_at" = $2 where ("customer_profiles"."customer_id" = $3 and ("customer_profiles"."customer_id" in (select "id" from "customers" where "customers"."lead_type" = $4) and "customer_profiles"."customer_id" in (select "id" from "customers" where "customers"."lead_type" = $5)))
  params: [true,"2026-09-13T14:32:39.021Z","c1","lead","lead"]

# 6. dispatcher list proposal_views (no Proposal rule)
select "id", "proposal_id", "viewed_at", "ip_address", "user_agent", "source", "referer" from "proposal_views" where "proposal_views"."proposal_id" in (select "id" from "proposals" where false)
  params: []

# instance checks the UI makes with the SAME rules
  agent  can update Customer.profile.hoa on own customer : true
  agent  can update Customer.profile.hoa on other        : false
  dispatcher can update Customer.age (not granted)      : false
  dispatcher can update Customer.profile.hoa            : true
  bearer can update Proposal.views on p1                : true
```

Reading: (1) the bearer's `recordView` probe is `id = token row` twice (probe pk ∧ bridge) — Postgres folds it; (2) a collection no rule names is `false` by construction — no hand check anywhere; (3) child lists inherit the parent's row scope through the collection; (4) a field-restricted `cannot` on the parent lands in the child's mutation WHERE; (5) mutations AND the read bridge (L8); (6) a principal with no rule on the root cannot see the root's children.

## 7. Sub-decisions this example surfaces (asked next, in order)
- **L13-2** where `collection` comes from: explicit on `parent` (as shown) vs derived from the child's `entityName`/table.
- **L13-3** action map — the probe PROVED the need: passing the child's `delete` straight to the parent collapsed to `false` (agents hold no `delete Proposal`); child create/update/delete ⇒ parent `update`, child read ⇒ parent `read`.
- **L13-4** the own-row exception: `CustomerNote` keeps its subject (its `{ authorId }` is a condition on the CHILD row, which a parent field cannot express); is it the only one? (`Application` → Q8.)
- **L13-5** grandchildren compose as dotted paths (`applications.answers`), bridged twice.
- **L13-6** `permittedFieldsOf` returns patterns, not expansions → SET-column gate is a per-column `can(...)` (the reference impl's `.every()`), and read-side projections use `fieldPatternMatcher`.
- **L13-7** boot assert: no `collection` name may collide with a real column of the parent table; every `parent.fk` must be a column of the child (existing guardrail).

## Appendix — probe source (`__probe_l13.ts`, run with `pnpm tsx` from the worktree root; deleted after)

```ts
// Scratch probe for L13 (sub-entity as a FIELD of its parent subject). Uncommitted; deleted after.
import { AbilityBuilder, createMongoAbility, subject } from '@casl/ability'
import { and, eq, inArray, not, or, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/pg-proxy'
import { customers } from '@/shared/db/schema/customers'
import { customerProfiles } from '@/shared/db/schema/customer-profiles'
import { proposals } from '@/shared/db/schema/proposals'
import { proposalViews } from '@/shared/db/schema/proposal-views'
import { proposalIncentives } from '@/shared/db/schema/proposal-incentives'

const qb = drizzle(async () => ({ rows: [] }))   // query builder only — never connects

// ---- the adapter, minimal ------------------------------------------------
type Spec = { table: PgTable, primaryKey: string, caslSubject?: string, parent?: { spec: Spec, fk: PgColumn, collection: string } }
const col = (t: PgTable, name: string) => (t as unknown as Record<string, PgColumn>)[name]
const subjectOf = (s: Spec): string => s.caslSubject ?? subjectOf(s.parent!.spec)   // INFERRED for children

function rulesToASTForField(ability: any, action: string, subjectType: string, field?: string) {
  const orB: any[] = [], andB: any[] = []
  for (const rule of ability.rulesFor(action, subjectType, field)) {
    const b = rule.inverted ? andB : orB
    if (!rule.conditions) { if (rule.inverted) break; return { operator: 'and', value: andB } }
    b.push(rule.inverted ? { operator: 'not', value: [rule.ast] } : rule.ast)
  }
  if (!orB.length) return null
  if (!andB.length) return { operator: 'or', value: orB }
  andB.push({ operator: 'or', value: orB }); return { operator: 'and', value: andB }
}
function interpret(node: any, table: PgTable): SQL | null {          // eq/and/or/not only (custom operators omitted here)
  if ('field' in node) { if (node.operator !== 'eq') throw new Error(node.operator); return eq(col(table, node.field), node.value) }
  const kids = node.value.map((n: any) => interpret(n, table)).filter((x: SQL | null): x is SQL => x != null)
  if (node.operator === 'not') return not(kids[0]!)
  if (node.operator === 'and') return kids.length ? and(...kids)! : null   // empty AND = allow-all
  return or(...kids)!
}
/** Row scope of a ROOT for (action[, field]); null = allow-all, sql`false` = deny. */
function rootWhere(ability: any, action: string, spec: Spec, field?: string): SQL | null {
  const ast = rulesToASTForField(ability, action, subjectOf(spec), field)
  return ast === null ? sql`false` : interpret(ast, spec.table)
}
/** Row scope of any spec for one action: roots compile; children bridge through the parent's rules for THEIR collection field. */
/** A child's create/update/delete all mean "touch this collection of the parent" ⇒ parent `update`; child read ⇒ parent `read`. */
const parentAction = (action: string) => (action === 'read' ? 'read' : 'update')
function toWhere(ability: any, action: string, spec: Spec): SQL | null {
  if (!spec.parent) return rootWhere(ability, action, spec)
  const { spec: parent, fk, collection } = spec.parent
  const parentWhere = toWhereWithField(ability, parentAction(action), parent, collection)
  return inArray(fk, qb.select({ pk: col(parent.table, parent.primaryKey) }).from(parent.table).where(parentWhere ?? undefined))
}
function toWhereWithField(ability: any, action: string, spec: Spec, field: string): SQL | null {
  if (!spec.parent) return rootWhere(ability, action, spec, field)
  const { spec: parent, fk, collection } = spec.parent                     // grandchild: path = parent.collection + '.' + field
  const parentWhere = toWhereWithField(ability, action, parent, `${collection}.${field}`)
  return inArray(fk, qb.select({ pk: col(parent.table, parent.primaryKey) }).from(parent.table).where(parentWhere ?? undefined))
}
/** L8: mutations AND the read scope. */
const scopedWhere = (ability: any, action: string, spec: Spec): SQL | null =>
  action === 'read' ? toWhere(ability, 'read', spec) : and(toWhere(ability, action, spec) ?? undefined, toWhere(ability, 'read', spec) ?? undefined) ?? null

// ---- specs (what the entity declares) -------------------------------------
const proposalSpec: Spec = { table: proposals, primaryKey: 'id', caslSubject: 'Proposal' }
const customerSpec: Spec = { table: customers, primaryKey: 'id', caslSubject: 'Customer' }
const proposalViewSpec: Spec = { table: proposalViews, primaryKey: 'id', parent: { spec: proposalSpec, fk: proposalViews.proposalId, collection: 'views' } }
const proposalIncentiveSpec: Spec = { table: proposalIncentives, primaryKey: 'id', parent: { spec: proposalSpec, fk: proposalIncentives.proposalId, collection: 'incentives' } }
const customerProfileSpec: Spec = { table: customerProfiles, primaryKey: 'customerId', parent: { spec: customerSpec, fk: customerProfiles.customerId, collection: 'profile' } }

// ---- abilities (what abilities.ts declares) --------------------------------
const bearerFor = (proposalId: string) => { const b = new AbilityBuilder(createMongoAbility)
  b.can('read', 'Proposal', { id: proposalId })
  b.can('update', 'Proposal', ['financeOptionId', 'cashInDealCents', 'views'], { id: proposalId })
  return b.build() }
const agentFor = (userId: string) => { const b = new AbilityBuilder(createMongoAbility)
  b.can('read', 'Proposal', { ownerId: userId })            // stand-in for { $participatesViaMeeting } (operator omitted from this probe)
  b.can('update', 'Proposal', { ownerId: userId })          // no field list ⇒ every column AND every collection
  b.cannot('update', 'Proposal', ['incentives'], { status: 'signed' })
  b.can('read', 'Customer', { ownerId: userId })
  b.can('update', 'Customer', ['age', 'profile.*'], { ownerId: userId })
  return b.build() }
const dispatcherFor = () => { const b = new AbilityBuilder(createMongoAbility)
  b.can('read', 'Customer', { leadType: 'lead' })           // stand-in for { $inDerivedPipeline: [...] }
  b.can('update', 'Customer', ['profile.*', 'pipelineStage'], { leadType: 'lead' })
  return b.build() }

const bearer = bearerFor('p1'), agent = agentFor('u1'), dispatcher = dispatcherFor()
const print = (label: string, q: { toSQL(): { sql: string, params: unknown[] } }) => { const { sql: s, params } = q.toSQL(); console.log(`\n# ${label}\n${s}\n  params: ${JSON.stringify(params)}`) }

// 1. bearer recordView → CREATE on proposal_views = parent point-probe for (update, 'views'), then insert
print('1. bearer recordView: parent probe for create (update Proposal.views on the token row)',
  qb.select({ ok: sql`1` }).from(proposals).where(and(eq(proposals.id, 'p1'), rootWhere(bearer, 'update', proposalSpec, 'views') ?? undefined)))
// 2. bearer tries the incentives collection → deny by construction
print('2. bearer touching incentives (no rule names that field)',
  qb.select({ ok: sql`1` }).from(proposals).where(and(eq(proposals.id, 'p1'), rootWhere(bearer, 'update', proposalSpec, 'incentives') ?? undefined)))
// 3. agent lists proposal_views → child read bridge through the agent's read rule for 'views'
print('3. agent list proposal_views (read bridge)', qb.select().from(proposalViews).where(toWhere(agent, 'read', proposalViewSpec) ?? undefined))
// 4. agent deletes an incentive row → update bridge (with the signed cannot) AND read bridge (L8)
print('4. agent delete incentive row (update bridge ∧ read bridge)',
  qb.delete(proposalIncentives).where(and(eq(proposalIncentives.id, 'inc1'), scopedWhere(agent, 'delete', proposalIncentiveSpec) ?? undefined)))
// 5. dispatcher upserts a customer profile → profile is a FIELD of Customer
print('5. dispatcher update customer_profiles (update bridge ∧ read bridge)',
  qb.update(customerProfiles).set({ hoa: true }).where(and(eq(customerProfiles.customerId, 'c1'), scopedWhere(dispatcher, 'update', customerProfileSpec) ?? undefined)))
// 6. dispatcher lists proposal_views → no Proposal rule at all → deny
print('6. dispatcher list proposal_views (no Proposal rule)', qb.select().from(proposalViews).where(toWhere(dispatcher, 'read', proposalViewSpec) ?? undefined))

console.log('\n# instance checks the UI makes with the SAME rules')
console.log('  agent  can update Customer.profile.hoa on own customer :', agent.can('update', subject('Customer', { ownerId: 'u1' }), 'profile.hoa'))
console.log('  agent  can update Customer.profile.hoa on other        :', agent.can('update', subject('Customer', { ownerId: 'u2' }), 'profile.hoa'))
console.log('  dispatcher can update Customer.age (not granted)      :', dispatcher.can('update', subject('Customer', { leadType: 'lead' }), 'age'))
console.log('  dispatcher can update Customer.profile.hoa            :', dispatcher.can('update', subject('Customer', { leadType: 'lead' }), 'profile.hoa'))
console.log('  bearer can update Proposal.views on p1                :', bearer.can('update', subject('Proposal', { id: 'p1' }), 'views'))
```
