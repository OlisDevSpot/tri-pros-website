# 02 — Engine vs Reference: CASL→Drizzle scope compiler audit

**Audited tree:** `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/issue-285` @ `b40403b6` (branch `refactor/285-refactor-permissions-casl-scope-compiler`, 2026-09-06).
**Reference:** `WebDevSimplified/casl-crash-course` @ `e113223d` (2025-10-01), cloned to `<scratchpad>/casl-crash-course` (clone succeeded on first attempt).
**Mode:** read-only; no tsc/lint/build run. All paths below are absolute unless prefixed `ref:` (relative to the clone root).

---

## 0. Versions

| Package | Reference (package.json → lockfile) | Ours (package.json → pnpm-lock) | Note |
|---|---|---|---|
| `@casl/ability` | `^6.7.3` → **6.7.3** (`ref:package.json:17`, `ref:package-lock.json:598`) | `^6.8.0` → **6.8.0** (`package.json:48`, `pnpm-lock.yaml:1325`) | Same major; `rulesToAST` semantics identical (verified below). |
| `@ucast/core` | **1.10.2**, transitive only — NOT in `ref:package.json` (grep: no `ucast` hit) but **imported directly** in `ref:src/lib/permissions/drizzleAdapter.ts:5` | **1.10.2** transitive (`pnpm-lock.yaml:4471`), NOT in `package.json`, **never imported** in `src/` (grep `@ucast` → comments only: `scope/ast.ts:2`, `compile-scope.ts:33`, `conditions-matcher.ts:25-29`) | Reference relies on hoisting (npm); we deliberately avoid the import (`scope/ast.ts:1-7`) because pnpm doesn't hoist. |
| `@ucast/mongo` / `mongo2js` / `js` | 2.4.3 / 1.4.0 / 3.0.4 | 2.4.3 / 1.4.1 / 3.1.0 | — |
| `drizzle-orm` | `^0.44.5` → 0.44.5 (`ref:package-lock.json:6085`) | `^0.45.1` → 0.45.1 (`package.json:115`) | — |

**Installed `rulesToAST` semantics (ours, 6.8.0)** — `node_modules/.pnpm/@casl+ability@6.8.0/node_modules/@casl/ability/dist/es6m/extra/index.mjs`, function `a` (=`rulesToQuery`) / `y` (=`rulesToAST`): iterates `rulesFor(action, subject)`; a non-inverted rule with **no conditions** returns `{}` (→ `buildAnd([])`, an **empty AND**); if **no conditional rule** exists at all it returns **`null`**; inverted rules become `CompoundCondition('not', [ast])`. This is exactly the `null` = deny-all / empty-AND = allow-all split our `compileScope` documents (`compile-scope.ts:16-20`).

---

## A. Module map of OUR engine

### `src/shared/domains/permissions/` (the CASL domain)

| File | Exports (signature) | Purpose | Lines |
|---|---|---|---|
| `abilities.ts` | `ENTITY_NAMES` (const tuple of 19 entity constants); `type EntityName`; `defineAbilitiesFor(user: {id, role} \| null): AppAbility` | THE rule builder. Per-role `can()` blocks; builds with `buildScopeConditionsMatcher()`; module-load `assertScopeWiring(...)` | `:49-70`, `:80-278`, `:88`/`:277` (build), `:285` (assert) |
| `types.ts` | `AppAction` = `'access'\|'assign'\|'create'\|'delete'\|'manage'\|'own'\|'read'\|'update'`; `AppSubject` = `EntityName \| 'all' \| 'Calendar' \| 'CustomerPipeline' \| 'Dashboard' \| 'LeadsPool' \| 'User'`; `AppConditions` = `MongoQuery \| {$participatesViaMeeting?} \| {$hasNoMeeting?} \| {$inDerivedPipeline?} \| {ownerId: string}`; `AppAbility = MongoAbility<[AppAction, AppSubject], AppConditions>` | Type surface | `:20`, `:31-38`, `:51-56`, `:61` |
| `context.ts` | `AbilityContext = createContext<AppAbility>(createMongoAbility())` | React context (deny-all default) | `:13` |
| `hooks.ts` | `useAbility(): AppAbility` | `use(AbilityContext)` | `:16-18` |
| `scope/actor.ts` | `type Actor = {kind:'user',userId,ability} \| {kind:'token',scope:SQL,subject} \| {kind:'system',reason}`; `userActor()`, `tokenActor()`, `systemActor()` | The principal seam replacing ambient `scope` | `:14-17`, `:19-29` |
| `scope/system-reasons.ts` | `type SystemReason = 'derived:contract-age-from-token-proposal' \| 'legacy:system-context'` | Audit catalog of unrestricted actors | `:8-15` |
| `scope/ast.ts` | `CompoundNode {operator, value: ScopeNode[]}`, `FieldNode {operator, field, value}`, `ScopeNode`, `isCompound(node)` | **Structural** stand-in for `@ucast/core` classes (no import) | `:10-20` |
| `scope/compile-scope.ts` | `compileScope(actor, action, subject, ctx: OperatorCtx): SQL \| null` | `rulesToAST` → `interpret`; system→`null`, token→`actor.scope`, no-rule→``sql`false` `` | `:22-35`; `rulesToAST` at `:28`; `null→sql\`false\`` `:29-30`; boundary cast `:34` |
| `scope/interpret.ts` | `interpret(node, ctx): SQL \| null` | Hand-walk AST → Drizzle: registry-first dispatch, `and/or/not`, `eq/in`, throws on unknown | `:28-36`; compound `:38-57`; field `:59-73`; `columnOf` `:76-81`; side-effect operator imports `:13-14`; boot assert `:20` |
| `scope/operators.ts` | `OperatorCtx {table, pk, actor}`; `ScopeOperator {name, parseValue?, toSql, toJS?}`; `defineScopeOperator()`, `getScopeOperator()`, `registeredOperatorNames()`, `assertRegistryMatchesContract()` | Custom-operator registry | `:12`, `:21-26`, `:31-36`, `:38-40`, `:43-45`, `:58-67` |
| `scope/operator-names.ts` | `SCOPE_OPERATOR_NAMES = ['participatesViaMeeting','hasNoMeeting','inDerivedPipeline']`; `ScopeOperatorName` | Client-safe static contract (no runtime imports) | `:24-26` |
| `scope/conditions-matcher.ts` | `buildScopeConditionsMatcher(): ConditionsMatcher<AppConditions>` | `buildMongoQueryMatcher({ '$op': {type:'document'} })` so `rulesToAST` emits our operators | `:41-49` |
| `scope/exhaustiveness.ts` | `assertScopeWiring(abilities: AppAbility[])` | Startup: every `$`-key in any rule ∈ contract | `:28-47` |
| `scope/operators/meeting-participation.ts` | registers `participatesViaMeeting` (via `self\|customerId\|projectId\|meetingId`) and `hasNoMeeting` | Correlated `EXISTS` bodies (closes over `db`) | `:29-68`, `:75-79` |
| `scope/operators/derived-pipeline.ts` | registers `inDerivedPipeline` | Delegates to `derivedPipelineWhere` (`entities/customers/lib/derived-pipeline-sql.ts:57-62`) | `:26-36` |
| `lib/protect-dashboard-page.ts` | `protectDashboardPage(): Promise<DashboardAuthState>` | RSC gate on `can('access','Dashboard')` | `:26-49` |
| `lib/share-token-actor.ts` | `resolveShareTokenActor(token, 'proposal'): Promise<Actor \| null>` | token → `tokenActor(eq(proposals.id, id), 'Proposal')` | `:21-29` |
| `lib/validate-share-token.ts` | `validateShareToken(token, type): Promise<TokenResult>` | DB lookup of `proposals.token` | `:28-50` |

### `src/shared/dal/server/` (where the engine meets queries)

| File | Exports | Purpose | Lines |
|---|---|---|---|
| `lib/resolve-actor-scope.ts` | `resolveActorScope(spec, actor): SQL \| null`; `verbOnly(actor, action, subject): SQL \| null`; `canAccess(spec, actor, id, action='read'): Promise<boolean>` | Spec-aware scope authority (ROOT compiles; CHILD = verb + parent bridge) | `:22-35`, `:42-48`, `:55-73`; private `combine` `:76-83`, `pkColumn` `:90-97`, `fkColumn` `:106-117` |
| `lib/scope.ts` (**LEGACY engine**) | `resolveEffectiveScope(spec, auth: VisibilityScope): SQL`; `isVisible(spec, ctx, id)`; `isInScope(spec, ctx, id)` (@deprecated) | `spec.visibility(auth)` AND parent bridge | `:37-48`, `:67-81`, `:90-97` |
| `lib/helpers.ts` | `dalDbOperation`, `buildUserContext(userId, role, spec): ScopedContext` (**legacy** scope + new actor), `requireResolvedScope(scope: SQL\|null\|undefined): SQL\|undefined`, `dalVerifySuccess` | Context builders + the undefined-vs-null guard | `:65-78`, `:95-102` |
| `lib/create-crud-dal.ts` | `createCrudDal(spec, configFactory?): CrudHandlers` | getById/create/update/delete/duplicate; **consumes `ctx.scope`** (never `ctx.actor`) | `requireResolvedScope(ctx.scope)` at `:117` (getById), `:213` (update), `:264` (delete); `createImpl` `:129-157` has **no scope**; duplicate via getById `:288` |
| `types.ts` | `ScopedContext {session, ability, scope: SQL\|null, actor: Actor}`; `SYSTEM_CONTEXT`; `systemContext(reason)`; `VisibilityScope`; `EntityServerSpec {entityName, caslSubject, visibility?, parent?, table, schemas, primaryKey?, shareable?, hooks?, duplicate?}` | Contracts | `:35-47`, `:53-58`, `:68-70`, `:75-78`, `:176-266` (`visibility` `:192`, `parent` `:200`) |

### `src/trpc/` (context production + verb/field gates)

| File | Exports | Purpose | Lines |
|---|---|---|---|
| `init.ts` | `protectedProcedure` (builds ability, stamps `scope: null`, `actor: userActor`), `agentProcedure` (`can('access','Dashboard')`), `superAdminProcedure` (`can('manage','all')`), `systemProcedure = baseProcedure` | Per-request ability build | `:54-61` (**`scope: null` at :60**), `:72-81`, `:94-103`, `:39` |
| `lib/create-http-context.ts` | `createHTTPTRPCContext` | `ability/scope/actor` all `null` initially | `:19-26` |
| `lib/middleware/resolve-trpc-actor-scope.ts` | `resolveTrpcActorScope(spec, {userId, ability}): SQL\|null` | tRPC wrapper → `resolveActorScope(spec, userActor(...))` | `:18-23` |
| `lib/middleware/scope-middleware.ts` (**LEGACY**) | `resolveVisibilityScope(spec, auth): SQL\|null` | omni→null else `resolveEffectiveScope` | `:19-25` |
| `lib/middleware/shareable-middleware.ts` | `shareableMiddleware(spec)` | session path → **legacy** `resolveEffectiveScope` (`:45`) + `userActor`; token path → `tokenActor(eq(tokenColumn, token))` with `ability: null` (`:59-68`) | `:31-75` |
| `lib/create-crud-router.ts` | `createCrudRouter(config)`; private `assertCan(ability, slot, spec)`, `assertCanUpdateFields(ability, spec, data)` | 5 slots; `resolveScope` option (default **legacy** `resolveVisibilityScope` `:98`); verb gate `:185-197`; field gate `:214-230` | `:30-36` (slot→action), `:80` (option), `:99-101` (procedures) |

---

## B. Pipeline trace (rule → SQL)

### B.1 Rule authoring → ability
- Rules live only in `abilities.ts:80-278`. Conditions present today: `$participatesViaMeeting` (`:108` Customer, `:131` Meeting, `:136` Proposal, `:150` Project), `{ ownerId: user.id }` (`:149` Project), `$inDerivedPipeline` (`:233` dispatcher Customer). Field restrictions: `can('update','Customer',['age'])` (`:113`), dispatcher `can('update','Customer',[...9 fields])` (`:236`). **No rule combines fields AND conditions; no `update`/`delete` rule carries conditions; no `cannot()` anywhere.**
- `defineAbilitiesFor` is rebuilt **per actor**: server per request in `init.ts:54-57`, `shareable-middleware.ts:40-43`, `protect-dashboard-page.ts:36-39`, `helpers.ts:70` (`buildUserContext`); client once per `{userId, role}` in `casl-provider.tsx:27-30`; a **second, redundant** client build in `app-sidebar.tsx:74` (bypasses the provider).
- Ability is built with `buildScopeConditionsMatcher()` (`abilities.ts:88,277`) so every rule gets a `.ast` (required by `rulesToAST`, which throws otherwise — installed source, fn `p`).

### B.2 Ability → AST → SQL (`compileScope`, `compile-scope.ts:22-35`)
1. `actor.kind==='system'` → `null` (allow-all) `:23-24`. `actor.kind==='token'` → `actor.scope` **regardless of `action`** `:25-26`.
2. `rulesToAST(actor.ability, action, subject)` `:28`.
3. `ast === null` → ``sql`false` `` (deny-all) `:29-30`.
4. `interpret(ast as ScopeNode, ctx) ?? null` `:34` — empty-AND → `null` (allow-all).

`interpret` (`interpret.ts:28-36`): registry lookup by `node.operator` **first** (custom document conditions have no `field`, so `isCompound` would misfile them — `:29-34`), then compound vs field. Compound (`:38-57`): `not` → `not(inner)` or ``sql`false` `` when inner is allow-all (`:39-43`); anything other than `and`/`or` **throws** (`:47-48`); null children filtered (`:49-51`); zero parts → `null` (`:52-53`); one part passthrough; else `or(...)`/`and(...)` (`:56`). Field (`:59-73`): `eq`→`eq(column, v)`, `in`→`inArray(column, v)`, anything else **throws** (`:70-71`); `columnOf` **throws if the field is not a column on `ctx.table`** (`:76-81`).

**Fail-closed verdict:** unknown compound → throw; unknown field operator → throw; unknown column → throw; missing rule → ``sql`false` ``; `not(allow-all)` → ``sql`false` ``. Fail-closed throughout (stronger than the reference, which has no column-existence check).

**Null vs conditionless distinction:** `null` AST (no rule) and empty-AND (conditionless rule) are distinguished at `compile-scope.ts:29-34`. Downstream, `requireResolvedScope` (`helpers.ts:95-102`) further distinguishes `null` (resolved allow-all) from `undefined` (never resolved → throw). See D/E for why that guard is neutered on the tRPC path.

### B.3 Custom operators
| Name (registry, no `$`) | Authored as | SQL body | Correlation |
|---|---|---|---|
| `participatesViaMeeting` | `{ $participatesViaMeeting: { via } }` | `meeting-participation.ts:29-68` — `EXISTS` over `meeting_participants` (+`meetings` for `customerId`/`projectId`) | `self`/`customerId`/`projectId` correlate on **`ctx.pk`** (`:45,51,57`); `meetingId` correlates on the **static** `proposals.meetingId` column (`:62`) — subject-bound, not table-generic. Throws if `actor.kind!=='user'` (`:33-37`) or unknown `via` (`:64-65`). |
| `hasNoMeeting` | `{ $hasNoMeeting: true }` | `meeting-participation.ts:75-79` — `NOT EXISTS meetings WHERE customer_id = ctx.pk` | `ctx.pk`. **Dead: no rule references it** (grep `hasNoMeeting` outside engine files → none). |
| `inDerivedPipeline` | `{ $inDerivedPipeline: [...] }` | `derived-pipeline.ts:26-36` → `derivedPipelineWhere()` (`derived-pipeline-sql.ts:57-62`) | Correlates on the **static** `customers.id` (`derived-pipeline-sql.ts:25,41`), ignores `ctx.table`/`ctx.pk`; throws on empty set (`:32-33`). |

`ScopeOperator.parseValue` and `.toJS` (`operators.ts:23,25`) are declared but have **no consumers** (grep → none); `registeredOperatorNames()` (`operators.ts:43-45`) has **no callers**.

**Client-bundle guard:** names come from the runtime-free `operator-names.ts` (`:4-12` rationale); `conditions-matcher.ts` and `exhaustiveness.ts` (both reachable from client-imported `abilities.ts`) read only that contract; the `db`-closing `toSql` bodies are loaded solely by `interpret.ts:13-14` side-effect imports, and `assertRegistryMatchesContract` (`interpret.ts:20`) closes the loop server-side. The guard is **by convention only** — no `import 'server-only'` on `interpret.ts`, `compile-scope.ts`, or `operators/*` (repo has 7 `server-only` imports, none in `src/shared/domains/permissions/` or `dal/server/lib/`).

### B.4 Spec-aware resolution (`resolveActorScope`, `resolve-actor-scope.ts:22-35`)
```
own    = spec.parent ? verbOnly(actor, 'read', spec.caslSubject)          // CHILD  (:25)
                     : compileScope(actor, 'read', spec.caslSubject, ctx) // ROOT   (:26)
bridge = spec.parent ? inArray(fk, select parent.pk where resolveActorScope(parent) ?? sql`true`) : null  // :27-33
return combine(own, bridge)                                                // :34
```
- **Action is hardcoded to `'read'` at `:25` and `:26`.** `canAccess` accepts an `action` (`:59`) but the CHILD branch ignores it (`:62-66`, comment admits "resolveActorScope is read-only today").
- **CHILD branch compiles NOTHING from the child's own rules except the verb boolean** (`verbOnly` `:42-48`: `ability.can(action, subject) ? null : sql\`false\``). Any condition authored on a child subject (e.g. `{ authorId }` on `CustomerNote`) would be **silently dropped**. `verbOnly` also returns `null` (allow) for `token` actors (`:45-46`), relying on the bridge.
- Children today: `applications` (parent meeting, `applications/lib/server-spec.ts:24`), `customer-notes` (parent customer, `:35`), `media-files` (parent project, reuses `PROJECT` subject, `media-files/lib/server-spec.ts:39-40`), `proposal-media-files` (parent proposal, reuses `PROPOSAL`, `:40-41`).
- Roots on CASL: `customers` (`customers.router/crud.router.ts:50`), `meetings` (`meetings.router/crud.router.ts:35`, `meetings.router/procedures.ts:21`), `projects` + project media (`projects.router/procedures.ts:16,28`), bespoke feature DALs under `src/features/customer-pipelines/dal/server/*` (15 `requireResolvedScope(resolveActorScope(...))` sites). Roots/children still on legacy: `proposals` (`proposals.router/crud.router.ts:20`, no `resolveScope`), `applications` (`applications.router/procedures.ts:21`), `customer-notes` (`customer-notes.router/index.ts:10`, no `resolveScope`), plus `shareable-middleware.ts:45` (used by proposals/voip-link-tokens) and `buildUserContext` (`helpers.ts:75`).

### B.5 Where WHERE meets the query
`createCrudDal` never touches `ctx.actor`; it consumes the pre-resolved `ctx.scope` via `requireResolvedScope` at `create-crud-dal.ts:117/213/264`. Producers of `ctx.scope`: `init.ts:60` (`null`), `create-crud-router.ts:100` (legacy default or CASL opt-in), entity `procedures.ts` files, `shareable-middleware.ts:45/62`, `helpers.ts:75`, plus 6 hand-built `ScopedContext` literals (`meeting-flow.router.ts:52`, `customer-pipelines.router.ts:106,144`, `proposals.router/views.router.ts:50`, `app/api/proposals/[proposalId]/{pdf,summary}/route.ts:27/31`).

---

## C. Side-by-side vs the reference

| Axis | Reference does | We do | Gap / parity | Recommended action (fact-level, no plan) |
|---|---|---|---|---|
| **Rule authoring: conditions + fields per action** | One builder; `allow('update','Todo',['complete'],{public:true})` — fields AND conditions on the same rule, and conditions on `update`/`delete` (`ref:getUserPermissions.ts:19-31`) | Conditions only on `read` rules (`abilities.ts:108,131,136,149-150,233`); fields only on `update` rules (`:113,:236`); never both; `delete`/`update` carry no row conditions | **Gap** — mutation row-scope cannot be expressed in rules today | Author `(fields, conditions)` on mutation rules; engine must then compile per-action (see next rows) |
| **Ability build/rebuild per user** | `getUserPermissions(user)` rebuilt on every call, no caching (`ref:getUserPermissions.ts:12-35`) | Per request (`init.ts:54`), per token/session branch (`shareable-middleware.ts:40`), per user memo on client (`casl-provider.tsx:27-30`) | **Parity** (ours is cheaper) | None; drop the duplicate build at `app-sidebar.tsx:74` |
| **Adapter shape** | `drizzleWhere(action, subject, user, table)` → `rulesToAST` → recursive visitor over `@ucast/core` `CompoundCondition`/`FieldCondition` via `instanceof` (`ref:drizzleAdapter.ts:8-51`); only `and`/`or`/`eq`; `eq(table[field], value)` with no column check (`:53-58`) | `compileScope(actor, action, subject, ctx)` → `rulesToAST` → structural `interpret` (`interpret.ts`) with `and`/`or`/`not`, `eq`/`in`, registry of document operators, `columnOf` existence check | **Parity-plus** on the core; **structural typing instead of `instanceof`** (`scope/ast.ts:1-7`) is the one shape difference | Sound as-is. If `@ucast/core` classes are wanted for fidelity, it must become an explicit dependency (pnpm doesn't hoist) |
| **`null` vs conditionless** | `ast == null → return undefined` — **deny-all collapses into "no WHERE"** and the caller compensates with a separate `can(...)` type-check (`ref:drizzleAdapter.ts:16`, `ref:dal/todos/queries.ts:24-31`); conditionless → `and()` of nothing → `undefined` | `null → sql\`false\`` (deny), empty-AND → `null` (allow) (`compile-scope.ts:29-34`) | **We are stricter/more correct** (reference's `undefined` is ambiguous) | Keep |
| **Fail-closed on unknown operator** | Throws on unknown compound/field operator (`ref:drizzleAdapter.ts:32-34,45-47`) | Throws on unknown compound (`interpret.ts:47-48`), unknown field op (`:70-71`), unknown column (`:79`); unknown `via` (`meeting-participation.ts:64-65`); empty pipeline set (`derived-pipeline.ts:32-33`) | **Parity-plus** | Keep |
| **`subject()` tagging** | Instance checks everywhere: `can('update', subject('Todo', todo), field)` (`ref:todos.ts:17,31,48,52,67,84`; `ref:dal/users/queries.ts:30`) | **Never used** (grep `subject(` from `@casl/ability` → 0). All `can()` calls are type-level (`create-crud-router.ts:191,223`, `assert-note-author.ts:9`, etc.). Comments claim CASL "can't express own record on plain-string subjects" (`abilities.ts:100-103,124-125,204-206`) — that claim is **incorrect** as a CASL statement (the reference does exactly this) | **Gap** | Adopt `subject(spec.caslSubject, row)` for post-load instance checks, or rely solely on per-action WHERE compile |
| **Condition typing vs `$inferSelect`** | `TodoSubject = Pick<typeof todo.$inferSelect,'public'\|'userId'> \| 'Todo'` — condition keys typecheck against real columns (`ref:getUserPermissions.ts:5-10`) | `AppConditions` is a hand-maintained union with a bare `{ ownerId: string }` member (`types.ts:51-56`); no link to any table type; column existence caught only at runtime by `columnOf` | **Gap** | Type conditions per subject from `$inferSelect` (or per-spec) |
| **Field enforcement on update** | `Object.keys(data).every(f => can('update', subject('Todo', todo), f))` — per-field, **instance-aware** (`ref:todos.ts:51-53`) | `assertCanUpdateFields` per-field, **type-level only** (`create-crud-router.ts:214-230`), executed **only when `ctx.ability` is non-null** (`:147-149`); `permittedFieldsOf` unused (grep → 0) | **Partial parity; gap on instance-awareness and on the token path** | See E-5 |
| **Read = WHERE-scoped** | `findMany({ where: drizzleWhere('read',…) })` (`ref:dal/todos/queries.ts:16,30`) | Yes: `requireResolvedScope(ctx.scope)` in factory getById (`create-crud-dal.ts:117`) and 40+ bespoke sites; lists are bespoke per entity | **Parity** | — |
| **Mutation: load-then-check vs WHERE-scoped** | Load row → `can('update', subject(...))` per field → **unscoped** `update … where id` (`ref:dal/todos/mutations.ts:36-53,61-75`) | WHERE-scoped update/delete (`create-crud-dal.ts:213,264`) — but the WHERE is the **`read`** scope (`resolve-actor-scope.ts:25-26`), so the mutation's own conditions are never applied; `create` has no scope at all (`:129-157`) | **We are stronger on row containment (defense-in-depth) but weaker on action-specific conditions** | Make `resolveActorScope` action-aware and let each slot pass its verb |
| **Client/server rule sharing** | Same `getUserPermissions()` imported by RSC pages and by a `"use client"` component (`ref:header.tsx:1,7,33`) | Same `defineAbilitiesFor` on server (`init.ts:7`) and client (`casl-provider.tsx:16`); 28 files consume `useAbility()`; **but** own-record rules are NOT in CASL, so the client mirrors them by hand (`use-customer-note-action-configs.ts:42,63-64`) | **Parity on mechanism; gap on coverage** | Move own-record rules into CASL so the client stops mirroring |
| **Explicit `@ucast/core` dep** | Imported directly but **not declared** (works via npm hoisting) | Not imported, not declared; structural AST instead | **Parity (both undeclared); ours is the safer choice under pnpm** | Only add if `instanceof` dispatch is adopted |
| Custom cross-table operators | None (only `eq`) | 3 document operators with registry + boot asserts | **We exceed the reference** | — |
| Non-user principals | None (user \| undefined) | `token` and `system` actors (`scope/actor.ts`) | **We exceed the reference** | — |
| Per-action WHERE | `drizzleWhere(action, …)` is action-parameterised at every call (`ref:drizzleAdapter.ts:9`) | `compileScope` is action-parameterised, but its only spec-level caller pins `'read'` | **Gap** | — |

---

## D. Where the engine is bypassed or duplicated

### D.1 Two engines are live simultaneously
| Legacy symbol | Live callers (file:line) | Count |
|---|---|---|
| `resolveVisibilityScope` (`scope-middleware.ts:19`) | `create-crud-router.ts:98` (**default** for every leaf that doesn't opt in), `applications.router/procedures.ts:21` | 6 files mention, 2 executing call sites |
| `resolveEffectiveScope` (`scope.ts:37`) | `scope-middleware.ts:24`, `shareable-middleware.ts:45`, `helpers.ts:75` (`buildUserContext`), `scope.ts:52,74` (self/isVisible) | 9 files mention, 5 executing call sites |
| `buildUserContext` (`helpers.ts:65`) | `meeting-flow.router.ts:71`, `projects.router/business.router.ts:67` | 2 executing call sites |
| `spec.visibility` | consumed only by `scope.ts:38`; declared on `customers/lib/server-spec.ts:41`, `meetings/lib/server-spec.ts:22`, `proposals/lib/server-spec.ts:32` | 3 specs |
| `isInScope` (@deprecated, `ctx.scope ?? undefined` at `scope.ts:94`) | `proposal-views/dal/server/queries.ts:36` | 1 |

Leaves still on the legacy default: `proposals.router/crud.router.ts:20`, `customer-notes.router/index.ts:10`, `applications.router/crud.router.ts:13`. Divergence consequence is documented in-code: `customers/lib/visibility.ts:19-27` (dispatcher `['leads']` legacy vs CASL 4-bucket) still governs customer-note update/delete via the legacy bridge.

### D.2 `ctx.scope` production sites (14)
`init.ts:60` (**`null` for every protected request**), `create-http-context.ts:22` (`null`), `create-crud-router.ts:100`, `meetings.router/procedures.ts:21-22`, `projects.router/procedures.ts:16,28`, `applications.router/procedures.ts:21-22`, `shareable-middleware.ts:45,62`, `helpers.ts:75`, `types.ts:56,69` (system), `meeting-flow.router.ts:52`, `customer-pipelines.router.ts:106,144`, `proposals.router/views.router.ts:50`, `app/api/proposals/[proposalId]/pdf/route.ts:27`, `…/summary/route.ts:31`, `features/customer-pipelines/dal/server/move-customer-pipeline-item.ts:37`.

### D.3 Hand-rolled scoping/field checks outside the engine
- `schedule.router/activities.router.ts:37-39` (and `:109,:166,:204,:237`): `isOmni ? undefined : eq(activities.ownerId, userId)` — Activity has a CASL subject but **no `EntityServerSpec`** (no `server-spec.ts` under `entities/activities/`), so it can't use either engine.
- `dashboard.router.ts:9-10` → `getActionQueue(userId, isOmni, …)` (`features/agent-dashboard/dal/server/get-action-queue.ts:118`) — omni flag threaded manually.
- `customers.router/business.router.ts:107`, `meetings.router/participants.router.ts:37` — inline `isOmni`.
- Phone gate: `customers/lib/phone-gating-sql.ts:42-46` (`canSeeUngatedPhone(actor)`) — a column-level rule expressed as an ad-hoc ability probe, consumed at `customers/dal/server/queries.ts:51`, `meetings/dal/server/queries.ts:165,279`, `customers.router/business.router.ts:124`, `voip-campaign-contacts/dal/server/queries.ts:282`, `dashboard.router.ts:10`.
- `customer-pipelines.router.ts:111-123`: after resolving a **meeting** scope (`:106`), issues raw `db.select … from(projects)` (`:111-115`) and `from(proposals)` (`:118-122`) with **no scope** — an `agentProcedure` caller with no `read Proposal` grant (dispatcher) receives proposal `label/status`.
- `customers/dal/server/mutations.ts:37-46`: parent probe runs only `if (ctx.scope)` — a `null` scope (omni **or** the `init.ts:60` default) skips it.
- Bespoke DALs that accept `ScopedContext` but never read scope/actor: `meetings/dal/server/mutations.ts`, `proposal-views/dal/server/queries.ts` (uses deprecated `isInScope`), `proposals/dal/server/duplicate.ts` (delegates to `proposalCrud.duplicate`, fine).

### D.4 Auth living in DAL hooks + client mirrors
- `customer-notes/lib/assert-note-author.ts:7-16` (`assertNoteAuthorOrAdmin`) called from `customer-notes/lib/server-spec.ts:82` (update.before) and `:94` (delete.before), each after a **lazy-import** `customerNoteCrud.getById` (`:77-78`, `:89-90`) — i.e. load-then-check re-implemented per hook, with a **stale/incorrect** rationale in `abilities.ts:124-125,250-252`.
- Client mirror: `customer-notes/hooks/use-customer-note-action-configs.ts:42,63-64` (`isAdmin || note.authorId === currentUserId`).
- Create-side probe via the new engine: `customer-notes/lib/server-spec.ts:58` (`canAccess(customerServerSpec, ctx.actor, …)`), so notes are half-migrated.
- Other hook-level auth: `proposals/lib/server-spec.ts:76-85` (lock ladder — business rule, not authz, but it is the only thing standing between a token-bearer and field writes; see E-5).

### D.5 Unrestricted contexts
`SYSTEM_CONTEXT` referenced at **77** sites (non-definition); `systemContext(reason)` at **2**. `SYSTEM_CONTEXT.actor` is `systemActor('legacy:system-context')` (`types.ts:57`).

---

## E. Concrete defect / risk list

| # | Severity | Finding | Evidence |
|---|---|---|---|
| E-1 | **High** (design) | `resolveActorScope` hardcodes `'read'`; update/delete WHERE = read visibility; `create` never scoped; `canAccess` child branch ignores `action`. Mutation rules with conditions are **unrepresentable** in today's engine. | `resolve-actor-scope.ts:25-26`, `:62-66`; `create-crud-dal.ts:129-157` (no scope), `:213`, `:264` |
| E-2 | **High** (latent leak) | CHILD branch compiles only `verbOnly` + parent bridge; any own-column condition on a child subject is **silently dropped** (no throw). Today no child rule has conditions, so it's latent — but the epic's next step is to add `{authorId}` on `CustomerNote`, which this branch would ignore. | `resolve-actor-scope.ts:24-26`, `:42-48` |
| E-3 | **High** (fail-open on token path) | For `spec.shareable` entities (`proposals/lib/server-spec.ts:39`, `voip-link-tokens/lib/server-spec.ts:25`), `getById` and `update` run on `shareableProcedure` (`create-crud-router.ts:104-105`). On the token branch `ability` is `null` (`shareable-middleware.ts:67`), and both `assertCan` (`:118-120`) and `assertCanUpdateFields` (`:147-149`) are **skipped when `ctx.ability` is null**. A bearer of a proposal share token can therefore call `proposals.crud.update` with any field of `updateProposalSchema` (`insertProposalSchema.partial()`, `proposals/lib/server-spec.ts:21`) on its own row; only the lock-ladder hook (`:76-85`) and the row scope constrain it. `compileScope` also returns `actor.scope` for tokens regardless of `action` (`compile-scope.ts:25-26`) and `verbOnly` allows tokens (`resolve-actor-scope.ts:45-46`). | `create-crud-router.ts:104-105,118,147`; `shareable-middleware.ts:59-68`; `compile-scope.ts:25-26` |
| E-4 | **High** (guard neutered) | `requireResolvedScope` exists to make an unresolved scope throw (`undefined`), but every protected tRPC ctx is stamped **`scope: null`** at `init.ts:60`, so on the tRPC path the guard can never fire and `null` means both "omni" and "nobody resolved this". Any bare `agentProcedure` handler that calls a CRUD handler or a `ctx.scope`-guarded DAL runs unscoped. Documented as intended in `src/trpc/DOCS.md:51-52`. | `init.ts:60`; `helpers.ts:95-102`; consequence at `customers/dal/server/mutations.ts:37`; unscoped raw reads at `customer-pipelines.router.ts:111-123` |
| E-5 | **Medium** | Field gate is type-level only (`ability.can('update', subjectString, field)`), so once update rules gain conditions CASL will answer `true` for the type regardless of the row. `permittedFieldsOf` (ships with 6.8.0) is unused. | `create-crud-router.ts:214-230`; grep `permittedFieldsOf` → 0 |
| E-6 | **Medium** | Two engines live; default in the factory is the **legacy** one; known dispatcher divergence persists on the legacy bridge for customer-notes update/delete. | `create-crud-router.ts:98`; `customers/lib/visibility.ts:19-27`; `shareable-middleware.ts:45`; `helpers.ts:75` |
| E-7 | **Medium** | Own-record authz lives in DAL hooks + a client mirror, driven by an **incorrect** premise ("CASL can't express own record on plain-string subjects"). | `abilities.ts:100-103,124-125,204-206,250-252`; `assert-note-author.ts:7-16`; `use-customer-note-action-configs.ts:63-64` |
| E-8 | **Medium** | Operators are subject-bound but not asserted: `participatesViaMeeting` `meetingId` uses static `proposals.meetingId`; `inDerivedPipeline` uses static `customers.id`; neither checks `ctx.table`. Authoring either on the wrong subject would emit an uncorrelated reference (runtime SQL error at best; wrong-join if the table is in `FROM`). | `meeting-participation.ts:59-63`; `derived-pipeline-sql.ts:25,41`; `derived-pipeline.ts:29-35` |
| E-9 | Low | Dead surface: `hasNoMeeting` operator + `$hasNoMeeting` in `AppConditions`; `ScopeOperator.parseValue`/`toJS`; `registeredOperatorNames()`; `isInScope` (1 caller). | `meeting-participation.ts:75-79`; `types.ts:54`; `operators.ts:23,25,43-45`; `scope.ts:90-97` |
| E-10 | Low | Stale comments: `abilities.ts:281-284` ("every rule above still conditionless… dormant") is false — 6 rules carry conditions, so `assertScopeWiring` is live; `types.ts:7,23` says "5 business entities" (ENTITY_NAMES has 19); `abilities.ts:168-170,268` attribute VoIP row-scoping to "entity visibility predicates" that **do not exist** (voip-* specs declare neither `visibility` nor `parent`) — agent `can('read','VoipCall')` etc. compile to allow-all; any scoping is per-query and should be verified. | cited inline |
| E-11 | Low | `interpretCompound` filters `null` (allow-all) children before `or(...)`: `or(allow, X)` degrades to `X` (over-restrictive, not a leak). Unreachable from `rulesToAST` today (a conditionless rule short-circuits at the top level) but semantically wrong for nested compounds. | `interpret.ts:49-56` |
| E-12 | Low | Client-bundle safety of `db`-bound operator bodies is by convention/comment only; no `import 'server-only'` on `interpret.ts`/`compile-scope.ts`/`operators/*`. | `operator-names.ts:4-12`; `interpret.ts:13-14` |
| E-13 | Low | No tests exercise `interpret`/`compileScope`/`resolveActorScope` (no test files reference them; epic notes "no test runner in this repo", `docs/plans/2026-08-10-casl-scope-compiler-epic.md:78`). | grep → 0 |
| E-14 | Low | `app-sidebar.tsx:74` rebuilds an ability with `defineAbilitiesFor` instead of `useAbility()`. | cited |

---

## F. Adapter-fidelity verdict

**The CASL→Drizzle adapter core is sound and canonical — and in several respects stricter than the reference.** `compileScope` + `interpret` is the same pipeline as the reference's `drizzleWhere` + `getConditionSql` (`rulesToAST` → walk `CompoundCondition`/`FieldCondition` → Drizzle `and/or/eq`), with these deliberate, defensible differences:
- Structural AST typing (`scope/ast.ts`) instead of `@ucast/core` `instanceof` — correct under pnpm's no-hoist and matches CASL's own "ability to database query" guide; verified against `@ucast/core@1.10.2` shapes.
- `null` → ``sql`false` `` (deny) vs empty-AND → `null` (allow) — the reference collapses deny into `undefined` and compensates with a separate `can()`; ours is more correct.
- `not`, `in`, column-existence check, registry of custom document operators with two boot-time contract asserts, `token`/`system` actors — all beyond the reference.
- Fail-closed on every unknown shape (parity with the reference's throws, plus more).

**What is NOT proper relative to the reference is everything around the adapter — how it is invoked and what rules feed it:**
1. **Not action-aware in practice.** `compileScope(actor, action, …)` is correctly parameterised, but its only spec-level caller (`resolveActorScope`) pins `'read'` (`resolve-actor-scope.ts:25-26`), and `createCrudDal` consumes a pre-baked `ctx.scope` rather than compiling per slot. The reference calls `drizzleWhere(action, …)` at each site.
2. **Child subjects never get their own conditions compiled** (`verbOnly` + bridge only). The reference has no children, but its model — every subject compiled from its own rules — is what ours must match before own-record conditions can move into CASL.
3. **Rules don't carry `(fields, conditions)` per action** (`abilities.ts`), so there is nothing for an action-aware compile to consume yet; and `AppConditions` isn't typed against `$inferSelect`.
4. **No `subject()` instance checks and no `permittedFieldsOf`** — field enforcement is a hand-rolled, type-level, tRPC-only gate that is silently skipped on the token path (E-3).
5. **`ctx.scope` + `null`-stamping + a live legacy engine** mean the engine's correctness is not the system's correctness: `requireResolvedScope` cannot catch an unresolved scope on tRPC (E-4), and three leaves plus `buildUserContext`/`shareable-middleware` still run `spec.visibility`.

Net: **keep the adapter; fix the plumbing** — per-action compile at the DAL (roots and children), rules with conditions on mutations, typed conditions, instance-aware field checks, a single engine, and no ambiguous `null` scope.
