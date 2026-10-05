# Permissions structure — design (2026-10-05)

**Status.** Approved by the owner on 2026-10-05: six sections in chat, then this written form. No code exists under it yet; each unit of §11 gets its own plan.

**What this is.** The structure of the permission system: types, names, layers, where each check happens, and the order of work. It is the written form of decisions D-01 to D-26 in `docs/plans/2026-08-10-casl-scope-compiler-epic.md` and of the decision log L1 to L14 in `docs/plans/2026-09-07-casl-re-grounding/README.md`, plus the rulings of the 2026-10-05 walk-through.

**What this is not.** It does not decide which role may do what (the 25 business rulings in report 10 §5), cost masking on share-link reads (deferred by the owner), or the security holes on main (they go through the hotfix path).

**The tree today.** Worktree `.worktrees/issue-285` is main plus the permissions docs. It runs main's legacy engine: `ScopedContext { session, ability, scope }`, `SYSTEM_CONTEXT`, `spec.visibility` with `resolveEffectiveScope`, and CASL rules that grant verbs without conditions. The code of the earlier attempt is read from `b40403b6`.

---

## 1. Goal

One permission system:

1. CASL rules are the only source of permission.
2. On the server the rules compile into Drizzle `where()` filters.
3. On the client the same rules are hydrated and checked with the same matcher.
4. TypeScript rejects a mismatch between a rule, a spec and a check. A mistake that would silently allow or silently deny is a compile error wherever the compiler can see it.

## 2. Agreed names

| Name | What it is |
|---|---|
| `defineEntitySpec` | Declares an entity: it has its own CASL subject. It may also have a parent (customer notes). |
| `defineSubEntitySpec` | Declares a sub-entity: it has no subject; it is a field of its parent's subject. |
| `parent: { spec, fk, field }` | The sub-entity's link. `field` is the name it takes inside its parent, and the string rules list as a field. An entity with a parent writes `parent: { spec, fk }`. |
| `subject` | On an entity spec; replaces `caslSubject`. |
| `conditionColumns` | On an entity spec: the columns a rule condition may name. A row checked on the client must carry them. |
| `defineRules` | Typed `can` / `cannot` that returns stock CASL rules. |
| `defineAbilitiesFor(user)` | Keeps its name; the one loader that turns a user into an ability. |
| `permit(ctx, action, spec, fields?)` | The one entry point for enforcement: returns `{ sql, probe(id), test(row) }`. |
| `Actor` | `{ ability, userId }`. `userId` is `null` for a share link or the system. |
| `getRequestActor()` | The actor for the current request, computed once. |
| `bearerContext(spec, token)` | Validates a share token and returns a context limited to that row, or nothing. |
| `systemContext(reason)` | An unrestricted context for jobs, webhooks and scripts, with a named reason. |

`entityName` stays on every spec. It is the name error messages use, and a sub-entity has no subject to be named by.

## 3. Layers

```
src/shared/domains/permissions/     client-safe unless marked
  specs.ts                          type-only list of every spec, and the types derived from it
  operators.ts                      operator names, payload types, the subjects each may sit on (no SQL)
  rules/define-rules.ts             typed can / cannot
  rules/<role>.ts                   one file per role that has rules
  rules/bearer.ts                   rules for a share-link holder, per shareable entity
  rules/system.ts                   manage all, with a reason
  abilities.ts                      defineAbilitiesFor(user), the conditions matcher, the startup checks
  actor.ts                          Actor
  server/get-request-actor.ts       server-only

src/shared/dal/server/              server-only
  types.ts                          ScopedContext, the two spec types
  lib/define-spec.ts                defineEntitySpec, defineSubEntitySpec
  lib/permit.ts                     permit(); replaces lib/scope.ts
  lib/permit/                       rule walk, interpreter, operator SQL bodies
  lib/contexts.ts                   systemContext, bearerContext
  lib/create-crud-dal.ts            scopes itself in every slot

src/trpc/                           context { session, actor }; the ladder only narrows
```

The compiler lives in the DAL library because it builds subqueries with `db`, and only the DAL may import `db`. Exact paths are confirmed against the tree in each unit's plan.

## 4. Specs

### 4.1 Shape

```ts
// entity: has its own subject
export const proposalServerSpec = defineEntitySpec({
  entityName: PROPOSAL,
  subject: 'Proposal',
  table: proposals,
  schemas: { insert, update, select },
  conditionColumns: ['id', 'ownerId', 'status'],
  shareable: { tokenColumn: 'token' },
})

// sub-entity: the field `views` of Proposal
export const proposalViewServerSpec = defineSubEntitySpec({
  entityName: PROPOSAL_VIEW,
  table: proposalViews,
  schemas: { insert, update, select },
  parent: { spec: proposalServerSpec, fk: proposalViews.proposalId, field: 'views' },
})

// entity with a parent: reach through the customer, its own rules on its own rows
export const customerNoteServerSpec = defineEntitySpec({
  entityName: CUSTOMER_NOTE,
  subject: 'CustomerNote',
  table: customerNotes,
  schemas: { insert, update, select },
  conditionColumns: ['authorId'],
  parent: { spec: customerServerSpec, fk: customerNotes.customerId },
})
```

- `primaryKey` and `shareable` keep their meaning.
- `visibility` stays on the type until the legacy engine is deleted (unit 6).
- A sub-entity of a sub-entity is allowed (application answers under applications under Meeting). Its field path is dotted: `applications.answers`.
- A sub-entity whose primary key is its foreign key (customer profile, lead attribution) is a one-to-one part. Its write slot is an upsert, built on the existing `upsert-one-to-one.ts`.

### 4.2 Why constructors

Specs are object literals with `satisfies` today. `satisfies` widens `field: 'views'` to `string`, and the types below need the literal. The constructors capture literals with `const` type parameters and check across properties.

```ts
type ColumnOf<T extends PgTable> = T['_']['columns'][keyof T['_']['columns']]
type ColumnKey<T extends PgTable> = keyof T['$inferSelect'] & string
type FreeName<P, F extends string> = F extends ColumnKey<TableOfSpec<P>> ? never : F

function defineSubEntitySpec<T extends PgTable, P, const F extends string>(o: {
  table: T
  parent: { spec: P, fk: ColumnOf<T>, field: F } & { field: FreeName<P, F> }
  // entityName, schemas, primaryKey
}): SubEntitySpec<T, P, F>
```

**Trap, found by the probe.** `F` must be inferred from a plain `field: F` and validated in an intersection. Written as `field: FreeName<P, F>` alone, TypeScript cannot infer through the conditional type, `F` falls back to `string`, and every field check in the system silently accepts anything.

### 4.3 The list and what derives from it

```ts
// permissions/specs.ts — type-only imports, so client-safe files may import it
export type Specs = typeof customerServerSpec | typeof customerProfileServerSpec | typeof proposalServerSpec | /* every spec */

export type EntitySubject                       // 'Customer' | 'Proposal' | 'CustomerNote' | …
export type RowOf<S extends EntitySubject>      // the Drizzle row of that entity's table
export type ConditionColumnOf<S>                // that entity's conditionColumns
export type FieldOf<S>                          // its columns, plus every sub-entity path under it:
                                                //   'views' | 'views.*' | 'views.**' | 'views.viewedAt' | 'applications.answers.value' | …
```

CASL subjects derive from this list instead of from `ENTITY_NAMES`; `EntityName` remains the identity type behind `entityName`. Subjects that are not entities (`Dashboard`, `Calendar`, `CustomerPipeline`, `LeadsPool`, `User`, `all`) are declared in one small map from subject to its legal actions.

### 4.4 Compile errors at the spec

- `fk` is not a column of the sub-entity's own table.
- `field` shadows a real column of the parent.
- A `conditionColumns` entry is not a column of the table.
- Two sub-entities claim the same `field` under one parent (a type-level assertion beside the list).

## 5. Rules

### 5.1 Shape

```ts
// rules/agent.ts — shape only; the grants are the pending business rulings
export const agentRules = (userId: string) => defineRules((can, cannot) => {
  can('access', 'Dashboard')

  can('read', 'Customer', { $participatesViaMeeting: { via: 'customerId', userId } })
  can('update', 'Customer', ['age', 'profile.*'])

  can('read', 'CustomerNote')
  can('create', 'CustomerNote')
  can(['update', 'delete'], 'CustomerNote', { authorId: userId })
})

// rules/bearer.ts — per proposal row
export const proposalBearerRules = (proposalId: string) => defineRules((can) => {
  can('read', 'Proposal', { id: proposalId })
  can('update', 'Proposal', ['financeOptionId', 'cashInDealCents', 'views'], { id: proposalId })
})
```

### 5.2 The three rule forms

| Form | May carry | Why |
|---|---|---|
| `read` rule | an operator and plain column conditions; no field list | Operators are SQL-only. The client cannot evaluate them on a row. |
| mutation rule | fields and plain column conditions | Its row reach comes from the read rule (§6.2). |
| `cannot` rule | the same as a mutation rule | — |

Plain conditions name `conditionColumns` only, with the column's own value type, as equality or `$in`. Those are the two forms the interpreter compiles.

User ids are written into the conditions when the rules are built. Nothing looks up "the current user" later.

### 5.3 Field meaning

- `'views'` is the sub-entity's rows: creating or deleting one touches this field.
- `'views.*'` and `'views.viewedAt'` are its columns.
- `'applications.**'` reaches every level under it.
- A parent `update` rule with no field list covers every column and every sub-entity of that parent. Narrow it with a field list or a `cannot`.

### 5.4 Operators

Each operator is declared once in `operators.ts` with its payload type and the subjects it may sit on.

```ts
interface ReadOperators {
  Customer: { $participatesViaMeeting?: { via: 'customerId', userId: string }, $inDerivedPipeline?: readonly Pipeline[] }
  Meeting: { $participatesViaMeeting?: { via: 'self', userId: string } }
  Proposal: { $participatesViaMeeting?: { via: 'meetingId', userId: string } }
  Project: { $participatesViaMeeting?: { via: 'projectId', userId: string } }
}
```

The SQL body of each operator is server-only and lives with the compiler. An operator body references tables, never a spec or `permit`.

### 5.5 Loading

`defineAbilitiesFor(user)` picks the role's rules and builds a stock ability with the shared conditions matcher. No user means an ability with no rules, never `null`. Rules are plain data, so the server can send them to the client unchanged.

### 5.6 Startup checks

Three facts the types cannot see are asserted when the rules module loads, on both server and client:

1. For an action and subject, every `cannot` comes after every `can`.
2. No rule without conditions sits beside a rule with conditions for the same action and subject. CASL combines them with OR, so the bare rule would allow every row. `{}` counts as no conditions.
3. Every role has rules.

## 6. Compiler and DAL

### 6.1 Entry point

```ts
permit(ctx, 'read', proposalServerSpec).sql               // AND this into any query
permit(ctx, 'update', proposalServerSpec).probe(id)       // reachable? no → not found
permit(ctx, 'update', customerNoteServerSpec).test(row)   // check a loaded row
permit(ctx, 'update', customerServerSpec, ['profile.hoa']).sql   // narrowed to fields
```

`sql` is always a real SQL value: true, false, or a predicate. It is never `null` or `undefined`. `test` is for mutation rules, which carry plain conditions only; it throws on a rule set that uses an operator.

### 6.2 How a filter is built

| Spec | Read | Write (create, update, delete) |
|---|---|---|
| Entity | its own `read` rules | its own rules for that action AND its read filter |
| Entity with a parent | own `read` rules AND the parent row is readable | own rules for that action AND the read filter |
| Sub-entity | the parent's `read` rules that cover this field, applied through `fk IN (SELECT pk FROM parent WHERE …)` | the parent's `update` rules that cover this field AND the read filter |

- The rules are walked per field with `ability.rulesFor(action, subject, field)`. The stock `rulesToAST` ignores fields.
- A sub-entity's create, update and delete all map to the parent's `update`. Passing the child's own verb to the parent collapses to deny.
- "Write AND read" is permanent: a row that cannot be read cannot be changed.
- The interpreter compiles `and`, `or`, `not`, equality, `$in`, and the registered operators. Anything else throws at compile time of the filter. It never guesses.

### 6.3 `createCrudDal` slots

| Slot | Behaviour |
|---|---|
| `getById` | primary key AND the read filter |
| `create` | the verb must be granted. With a parent, the parent is probed first: readable for an entity with a parent, updatable on this field for a sub-entity. A miss is not found. |
| `update` | primary key AND the update filter. Each changed column is checked against the loaded row; for a sub-entity, against the parent row as `field.column`. |
| `delete` | primary key AND the delete filter |
| `duplicate` | the source is read through the read filter, then `create` |

Hand-written queries (lists, pipelines, reports) AND `permit(ctx, 'read', spec).sql` into their own `where`.

### 6.4 Failure answers

| Situation | Answer |
|---|---|
| The actor has no rule at all for this action on this subject | forbidden |
| The row is outside the actor's reach | not found (existence is not revealed) |
| A changed column is not permitted | forbidden, naming the column |

### 6.5 What leaves

- `createCrudRouter`'s verb check, field check and scope middleware. The router becomes wiring, so no path can skip the checks.
- `ctx.scope`, `SYSTEM_CONTEXT`, `resolveEffectiveScope`, `resolveVisibilityScope`, `isVisible`, `isInScope`, `scopeMiddleware`, `spec.visibility`.

### 6.6 What comes back from `b40403b6`

The structural AST types, the interpreter, the operator registry with its two-sided name check, and the SQL bodies of the meeting-participation and derived-pipeline operators (report 19 §1, rows A5 to A12, A16 to A22). They return without the old actor union: operator context is `{ table, pk }`.

Report 24's "connection-free core" is not built. Its purpose was comparing SQL strings in unit tests, which the owner has ruled out.

## 7. Who is acting

```ts
interface Actor { ability: AppAbility, userId: string | null }
interface ScopedContext { actor: Actor, tx?: Tx }
```

- **`Actor.userId`** exists only to stamp data (author, owner). Reach never reads it; user ids are already inside the rule conditions.
- **`getRequestActor()`** is cached per request: one session lookup, one ability build. tRPC's context, server components, layout guards and route handlers all use it.
- **The ladder only narrows:** base → protected (a session is required) → agent (`access Dashboard`) → superAdmin (`manage all`). `systemProcedure`, `ctx.scope`, a separate `ctx.ability` and per-entity scope procedures are deleted.
- **Share links.** One shareable procedure per shareable entity (Proposal today). The order is fixed: a session wins and the caller acts as staff; otherwise `bearerContext(spec, token)` validates the token and returns a context holding the bearer rules for that one row; otherwise unauthorized. The PDF and summary routes follow the same order.
- **Server-derived writes** on the share-link path (the homeowner's age, the document reconciliation it triggers) run under `systemContext` with their own reason, keyed off the token-validated proposal and never a client-supplied id.
- **`systemContext(reason)`** is `manage all` carrying the reason. `SystemReason` is a closed list (`webhook:…`, `sync:…`, `intake:…`, `derived:…`). Each of today's `SYSTEM_CONTEXT` sites is classified into it.

## 8. Client

```tsx
// server: the root layout
const { actor } = await getRequestActor()
<AbilityProvider rules={packRules(actor.ability.rules)}>…</AbilityProvider>

// client
const ability = useAbility()
ability.can('create', 'Proposal')
ability.can('update', subject('CustomerNote', note))
ability.can('update', subject('Customer', customer), 'profile.hoa')
```

- `@casl/react` 7.0.1 is added (decision 11 stands); `@casl/ability` stays at 6.8.0. It is imported in exactly one `'use client'` module. That module exports our `AbilityProvider` (it takes the packed `rules` and wraps the package's provider) and the typed `useAbility()`, `subject()` and `<Can>`.
- The provider is fed from the root layout, so no component renders outside it.
- The typed layer rejects: a field that is not in `FieldOf<S>`; a row passed to `subject()` without that entity's `conditionColumns`; a row-level `read` check on a subject whose read rule uses an operator.
- `subject()` is applied where the row is used, not before it crosses the wire: the tag does not survive serialization.
- The four client-side ability rebuilds and the three hand-written copies of server rules (`get-accessible-pipelines.ts`, `use-customer-note-action-configs.ts`, `can-see-phone.ts`) are deleted.
- After a sign-in or role change in place, the page calls `router.refresh()`.

## 9. Where each mistake is caught

| Mistake | Caught |
|---|---|
| Foreign key from another table; field shadowing a parent column; unknown condition column; duplicate field under one parent | compile |
| Rule field that is not a column or declared path, in `can` or `cannot` | compile |
| Condition on an undeclared column, or of the wrong type | compile |
| Operator on a mutation rule, with a field list, or on the wrong subject | compile |
| Unknown subject or action | compile |
| Client check with a mistyped field, or a row lacking condition columns | compile |
| `cannot` before `can`; bare rule beside a conditioned one; role without rules | startup |
| Operator name with no SQL body, or the reverse | startup (server) |
| A condition operator the interpreter does not know | when the filter is built: it throws |
| Row out of reach; column not permitted | request: not found / forbidden |

## 10. Verification

Owner's ruling: no test runner and no unit tests in the library.

- Every unit: `pnpm tsc` and `pnpm lint` pass.
- **The wrong-on-purpose file.** One `// @ts-expect-error` line per row of the "compile" rows in §9. If an edit loosens the types, a line stops erroring and `pnpm tsc` fails. It lands in unit 1 and grows with the types.
- The startup checks of §5.6.
- Browser end-to-end tests per role through `/api/dev/playwright-session`: what each role sees, cannot open, cannot change; the share-link path.

Two accepted consequences:

1. Turning an entity over from the legacy engine to compiled rules is checked in the browser, not by comparing SQL. The risk on each turnover is a rule that allows too much.
2. Browser tests of allowed changes write to the dev database. Which records they may touch is the owner's ruling, needed before unit 7 is planned.

## 11. Order of work

Each unit ends with `pnpm tsc` and `pnpm lint` passing. Main is merged into the branch at each boundary. Each unit gets its own plan, written against the tree.

| # | Unit | Changes for users |
|---|---|---|
| 1 | **Typed foundation.** Spec constructors; the 19 specs converted, with today's readers of `caslSubject` moved to the new shape in the same change; the type-only list and derived types; `defineRules`; operator declarations; the wrong-on-purpose file. Today's rules and enforcement are untouched. | none |
| 2 | **One actor per request.** `getRequestActor()`; the ladder narrows; the `@casl/react` provider fed from the root layout. | none |
| 3 | **Compiler and DAL self-scoping**, one entity family at a time: Customer, Meeting, Proposal, Project, then the rest. `permit`, `bearerContext`, `systemContext(reason)`, router becomes wiring. | share-link holes close; reach is rule-driven |
| 4 | **The rules matrix.** The 25 business rulings; own-row rules for customer notes and activities; the hand-written client copies deleted. | intended permission changes, each named |
| 5 | **Lint wall and financial reads.** No raw query on a scoped table outside the DAL; financial reads through the owning DALs. | dispatcher financial leak closed structurally |
| 6 | **Delete the legacy engine.** | none |
| 7 | **Full browser pass per role**, then the single merge to main. | — |

**The rule for unit 3.** The row filter lives outside CASL today, so every current rule is a bare verb. A family's rules gain their conditions in the same change that turns on its compiled filters. A bare rule left beside the new conditioned one would allow every row; startup check 2 exists to catch exactly that.

## 12. Open items

| Item | Needed before |
|---|---|
| The 25 business rulings (report 10 §5) | unit 4; the Meeting rows also wait on #217 and #220 |
| How `own Meeting` and `assign` map onto the model (report 22 §3.3 proposes `update Meeting ['participants', 'ownerId']` for `assign`) | unit 4 |
| The homeowner's own phone on a share link (an explicit grant) | unit 3, Proposal family |
| Restoring the branch's outcome-to-pipeline map, which moves `not_good` and `ftd` from rehash to dead in production | unit 3, Customer family |
| `recordView` driven by the bearer instead of `SYSTEM_CONTEXT`; the proposal-media probe that calls legacy `isVisible` | unit 3, Proposal family |
| Whether share-link media reads need `proposal_media_files` as its own entity (report 22 §3.4) | when share-link reads are masked |
| Shape of the lint wall | unit 5 |
| Which dev records browser tests may change | unit 7 |
| Cost masking on share-link reads | deferred by the owner |

## 13. What this changes in earlier documents

- **Report 24 §4** (the hybrid): superseded on names (`defineEntitySpec` / `defineSubEntitySpec`, `field`, `bearerContext`), on boot asserts that are now compile errors, on the connection-free core (not built), and on vitest (not used).
- **Tracker D-21** (a rerunnable SQL parity script): superseded by §10.
- **The earlier engine spec and phase-0 plan** (`2026-08-10-casl-scope-compiler-design.md`, `2026-08-10-casl-phase-0-engine-scaffolding.md`) and the 2026-09-13 sync plan were deleted from the tree on 2026-10-05; git history keeps them. Their actor union and interfaces had already been superseded by D-09, D-11 and D-14.
