# Permissions structure — design (2026-10-05)

**Status.** Approved by the owner on 2026-10-05: six sections in chat, then this written form. Units 1 and 2 of §11, and part 1 of unit 3, are built (2026-10-05, 2026-10-06, 2026-10-07; part 1's owner checks passed 2026-10-08); each further unit gets its own plan.

**What this is.** The structure of the permission system: types, names, layers, where each check happens, and the order of work. It is the written form of decisions D-01 to D-26 in `docs/plans/2026-08-10-casl-scope-compiler-epic.md` and of the decision log L1 to L14 in `docs/plans/2026-09-07-casl-re-grounding/README.md`, plus the rulings of the 2026-10-05 walk-through.

**What this is not.** It does not decide which role may do what (the 25 business rulings in report 10 §5), cost masking on share-link reads (deferred by the owner), or the security holes on main (they go through the hotfix path).

**The tree today.** Worktree `.worktrees/issue-285` is main plus the permissions docs and unit 1's typed foundation, which enforces nothing yet. It runs main's legacy engine: `ScopedContext { session, ability, scope }`, `SYSTEM_CONTEXT`, `spec.visibility` with `resolveEffectiveScope`, and CASL rules that grant verbs without conditions. The code of the earlier attempt is read from `b40403b6`.

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
| `abilityFromRules(rules)` | The one place an ability is built from rules. The server and the browser both use it, so they match rules the same way. |
| `subject(type, row)` | Tags a row with its subject for a row-level check. A plain module: the server may call it too. |
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
  types.ts                          subjects without a spec, and the ability types derived from the list
  operators.ts                      operator names, payload types, the subjects each may sit on (no SQL)
  rules/define-rules.ts             typed can / cannot
  rules/<role>.ts                   one file per role that has rules
  rules/bearer.ts                   rules for a share-link holder, per shareable entity
  rules/system.ts                   manage all, with a reason
  abilities.ts                      defineAbilitiesFor(user); runs the startup checks when it loads; server-only
  ability-from-rules.ts             abilityFromRules(rules) and the conditions matcher; client-safe
  rules/check-rules.ts              the startup checks on the rules
  subject.ts                        typed subject(type, row)
  actor.ts                          Actor
  client.tsx                        'use client': AbilityProvider, useAbility()
  server/get-request-actor.ts       server-only

src/shared/dal/server/              server-only
  types.ts                          ScopedContext, EntitySpec, SubEntitySpec, their erased union (named with the unit 3 plan)
  lib/define-spec.ts                defineEntitySpec, defineSubEntitySpec
  lib/permissions/permit.ts         permit()
  lib/permissions/check-rules.ts    assertRulesCompile(): every rule's conditions walk through the interpreter at boot
  lib/scope.ts                      COMPILED_SUBJECTS: the families that run on compiled rules; deleted with the legacy engine in unit 6
  lib/permissions/                  rule walk, interpreter, operator SQL bodies
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
- An entity's `entityName` equals its `subject`. A spec that reuses another entity's subject is a sub-entity. `subject` stays on the entity spec: it tells an entity from a sub-entity, and it is the name a rule is read under.
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
export type ServerSpec = typeof customerServerSpec | typeof customerProfileServerSpec | typeof proposalServerSpec | /* every spec */

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
| `read` rule | plain column conditions with either an operator or a field list, never both | Operators are SQL-only, so the client cannot evaluate them on a row. A field list narrows what the read returns (§5.3). |
| `update` rule | fields and plain column conditions | Its row reach comes from the read rule (§6.2). |
| `create` and `delete` rules | plain column conditions only | Nothing reads a field list on them. |
| `cannot` rule | fields and plain column conditions | — |

Plain conditions name `conditionColumns` only, with the column's own value type, as equality or `$in`. Those are the two forms the interpreter compiles.

User ids are written into the conditions when the rules are built. Nothing looks up "the current user" later.

### 5.3 Field meaning

- `'views'` is the sub-entity's rows: creating or deleting one touches this field.
- `'views.*'` is its columns, and the rows with them: CASL's field matcher answers a check on `'views'` from a rule that lists `'views.*'` (D-33). A rule meant for columns only names them, as in `'views.viewedAt'`.
- `'applications.**'` reaches every level under it.
- A parent `update` rule with no field list covers every column and every sub-entity of that parent. Narrow it with a field list or a `cannot`.
- A `read` rule with a field list limits what the actor receives: the row leaves the DAL with those columns only, and a sub-entity path admits that collection. Reading a proposal is not seeing its financial internals: the bearer's list leaves the money columns out. The cost lines inside `projectJSON` are a sub-column mask, which is unit 5's financial-reads work.

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
2. No rule without conditions sits beside a rule with conditions for the same action and subject. CASL combines them with OR, so the bare rule would allow every row. An empty conditions object does not compile (§9), so a rule without conditions is always written without the argument.
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
| `getById` | primary key AND the read filter; the row is projected to the field list of the `read` rule that covers it, when there is one |
| `create` | the verb must be granted. With a parent, the parent is probed first: readable for an entity with a parent, updatable on this field for a sub-entity. A miss is not found. A peer root whose create or update takes another entity's id from the client probes that row's read reach in its own hook (a meeting's `customerId`); a miss is not found. |
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
// server: a boundary that has already read the session
const { session, actor } = await getRequestActor()
<AbilityProvider
  user={session ? { id: session.user.id, role: session.user.role } : null}
  rules={packRules(actor.ability.rules)}
>…</AbilityProvider>

// client
const ability = useAbility()
ability.can('create', 'Proposal')
ability.can('update', subject('CustomerNote', note))
ability.can('update', subject('Customer', customer), 'profile.hoa')
```

- `@casl/react` 7.0.1 is added (decision 11 stands); `@casl/ability` stays at 6.8.0. It is imported in exactly one `'use client'` module, `permissions/client.tsx`, which exports our `AbilityProvider` and the typed `useAbility()`.
- **Where the rules come from.** The root layout reads nothing per request, so public pages keep their static rendering and the dashboard shell streams before the session is read. The root `AbilityProvider` starts with no rules. Each server boundary that reads the session (the dashboard's three session slots, the proposal-flow layout) feeds a nested provider the packed rules, so gated UI is in the first paint there. Anywhere else (public pages, dialogs mounted above those boundaries) the provider follows the browser's session read and asks the server for that user's rules through `permissionsRouter.rules`. The browser never builds rules from a role.
- A provider keeps following the browser's session read after the first paint: a sign-out, a role change or an expired session shows without a reload.
- `ability.can` and `ability.cannot` are typed from the specs on the server and the client alike. They reject: an action its subject does not have; an unknown subject; a field that is not in `FieldOf<S>`; a row-level `read` check on a subject whose read rule may carry an operator.
- `subject(type, row)` lives in `permissions/subject.ts`, a plain module. It rejects a row without that entity's `conditionColumns`. It is applied where the row is used, not before it crosses the wire: the tag does not survive serialization.
- `<Can>` is added with its first call site.
- The client-side ability rebuilds are deleted in unit 2. The three hand-written copies of server rules (`get-accessible-pipelines.ts`, `use-customer-note-action-configs.ts`, `can-see-phone.ts`) are deleted in unit 4.

## 9. Where each mistake is caught

| Mistake | Caught |
|---|---|
| Foreign key from another table; field shadowing a parent column; unknown condition column; duplicate field under one parent | compile |
| Sub-entity field name that is widened to `string`, empty, or contains `.` or `*`; entity `subject` that differs from its `entityName`; two entity specs with one subject | compile |
| Rule field that is not a column or declared path, in `can` or `cannot` | compile |
| Condition on an undeclared column, or of the wrong type | compile |
| Condition, operator or whole conditions argument that may be `undefined`; empty conditions object; empty field list | compile |
| Condition value that may be `null` (the literal `null` is legal); a check that asks an action its subject does not have | compile |
| Operator on a mutation rule, with a field list, or on the wrong subject | compile |
| Field list on a `create` or `delete` rule | compile |
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

**No backwards compatibility (owner, 2026-10-05).** A unit removes what it replaces in the same change: no alias under an old name, no re-export or wrapper kept for old call sites, no old and new shape side by side. The legacy engine keeps running only where a later unit has not yet replaced it, and nothing new is written to keep it alive.

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
| The 25 business rulings (report 10 §5); #13 ruled 2026-10-08 (a meeting's client-supplied `customerId` must be readable to the creator), landing in unit 3 part 2 | unit 4; the Meeting rows also wait on #217 and #220 |
| `Application`'s parent: Meeting today, Proposal per main's applications work; it stays on the legacy engine until that work lands | the rest of unit 3 |
| How `own Meeting` and `assign` map onto the model (report 22 §3.3 proposes `update Meeting ['participants', 'ownerId']` for `assign`) | unit 4 |
| The homeowner's own phone on a share link (an explicit grant) | unit 3, Proposal family |
| ~~Restoring the branch's outcome-to-pipeline map~~ — moved out of the epic 2026-10-07: outcome and pipeline derivation belongs to the sales lifecycle work on main (its rules map R34–R36; handoff `docs/plans/2026-10-07-pipeline-derivation-handoff-to-lifecycle.md` there); the branch consumes `derivedPipelineWhere` as an operator and receives main's model by merge | not this epic |
| `recordView` driven by the bearer instead of `SYSTEM_CONTEXT`; the proposal-media probe that calls legacy `isVisible` | unit 3, Proposal family |
| Whether share-link media reads need `proposal_media_files` as its own entity (report 22 §3.4) | when share-link reads are masked |
| Shape of the lint wall | unit 5 |
| Which dev records browser tests may change | unit 7 |
| Cost masking on share-link reads: the bearer's `read` field list drops the money columns (unit 3, Proposal family); the cost lines inside `projectJSON` | unit 5, financial reads |
| ~~The name of the erased spec union~~ — `AnyServerSpec`, landed in unit 3 part 1 (D-28) | done |

## 13. What this changes in earlier documents

- **Report 24 §4** (the hybrid): superseded on names (`defineEntitySpec` / `defineSubEntitySpec`, `field`, `bearerContext`), on boot asserts that are now compile errors, on the connection-free core (not built), and on vitest (not used).
- **Tracker D-21** (a rerunnable SQL parity script): superseded by §10.
- **The earlier engine spec and phase-0 plan** (`2026-08-10-casl-scope-compiler-design.md`, `2026-08-10-casl-phase-0-engine-scaffolding.md`) and the 2026-09-13 sync plan were deleted from the tree on 2026-10-05; git history keeps them. Their actor union and interfaces had already been superseded by D-09, D-11 and D-14.
