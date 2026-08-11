# CASL Scope Compiler — Design

**Date:** 2026-08-10 (v2 — revised 2026-08-11 after battle-test against `docs/permissions/visibility-rules-catalog.md` + live code)
**Status:** Approved design (pre-implementation)
**Scope:** Server-side row-visibility for the four core entities (Customer, Meeting, Proposal, Project) and their owned children, driven by a CASL-compiled SQL predicate.
**Related:** ADR-0002 (Entity Server System), `docs/permissions/visibility-rules-catalog.md`, `memory/project-permissions-casl-compiler.md`, `[[project-trpc-standardization-epic]]`, `[[project-dispatcher-role]]`.

---

## 1. Problem

Authorization today is split across two hand-maintained artifacts that silently drift:

- **CASL** (`defineAbilitiesFor`) governs the **verb** ("can this role update a CustomerProfile?") but carries **zero row conditions** — every read rule is conditionless (verified: `abilities.ts:105,128,133,142` — `can('read','Customer'|'Meeting'|'Proposal'|'Project')` all bare).
- **Hand-written `EntityServerSpec.visibility: (scope) => SQL`** functions carry the **row predicate** ("which customers can this agent see?"). This is where the entire row scope lives today.

Because the two are separate, they diverge. Concrete failures this causes:

1. **Drift.** `get-customer-pipeline-items.ts:367` hand-writes `ownerId=me OR isPublic=true OR participation` for projects, while the canonical `projectVisibility` (`projects/lib/visibility.ts:31`) is **participation only**. The CASL policy knows about neither branch.
2. **Roles the model can't express.** A **manager** should see *all* meetings (not omni, not a participant). A single `visibility(scope)` fn keyed on `userId` cannot produce different predicates for different roles on the same subject. This is the motivating gap.
3. **The `LeadsPool` magic flag.** The dispatcher's "unclaimed leads" visibility is a bespoke boolean short-circuit, not a rule. `can('read','LeadsPool')` (`abilities.ts:219`) drives **three** behaviors at once — row-visibility, phone-ungating, pipeline-set access.
4. **A `null`-overload vuln class.** `ScopedContext.scope: SQL | null` uses `null` for *both* "omni, see everything" and "SYSTEM, unrestricted." Every leak below is that overload:
   - `meeting-flow.router.ts:40` — an agentProcedure verb-checks `update CustomerProfile`, then writes via `SYSTEM_CONTEXT` using a **client-supplied `customerId`**, with no check that the agent participates in that customer's meetings. An agent can write **any** customer's profile by id.
   - `contracts.router.ts:218` — homeowner path writes `customer.age` via `SYSTEM_CONTEXT`.
   - `proposal-views/queries.ts:36` — `isInScope` probes the ambient `ctx.scope`, which leaks when null.
   - `scope.ts` — `isVisible` returns `true` when `!ctx.session` (SYSTEM unrestricted); DAL call sites use `ctx.scope ?? undefined`, dropping the predicate on null.

**Thesis:** Make **CASL rules the single source of truth.** An entity's row-visibility SQL predicate is *compiled* from its rules, not hand-written. This is CASL's own first-party DB-integration pattern (`rulesToAST` → ucast AST → SQL interpreter), the same pattern `@casl/prisma`'s `accessibleBy` productizes.

**Critical framing (see §4.1, §7):** because the row predicate lives *outside* CASL today, this is **not** a behavior-neutral engine swap. Moving a predicate into a rule and compiling it is a real behavior change per entity, and the migration must be structured so the predicate never *disappears* mid-flight (which would compile to allow-all). There is no safe "engine-only, zero behavior change" intermediate.

---

## 2. Approach decisions (locked)

| Fork | Decision | Rationale |
|---|---|---|
| **A — child inheritance** | **Split.** Owned children (`customer_profiles`, `customer_notes`, `customer_lead_attribution`, `customer_enrichment`) inherit the customer gate structurally via a parent bridge. Meeting/Proposal/Project are **peer roots**, each carrying its own participation scope. | The customer-profile page currently over-trusts the three roots (a bug this fixes). |
| **C — project predicate** | **Business ruling required, not neutral cleanup** (see §7). Canonical `projectVisibility` is participation-only; the live drift at `get-customer-pipeline-items.ts:367` also grants `ownerId=me OR isPublic`. Deleting the drift removes agent visibility of owner-created/public non-participating projects from the pipeline view. | Must confirm no operational agent view relies on that branch before deleting; if it does, it becomes an OR of explicit `can` rules, not a deletion. |
| **Sequencing** | **Compiler-first, but Phase 0 and Phase 1 are ONE atomic step per entity** — engine + authored conditions land together, equivalence-gated. | Today's predicate lives outside CASL, so there is no behavior-neutral engine-only phase (see §4.1). |
| **Spec scope** | **Server core now:** the `Actor` seam + Policy + Scope Compiler + Point-Probe + the phone-gating `Actor` cutover. **Defer:** the dynamic phone `CASE` Field Mask + Client Mirror. | Keep the first spec to row-visibility, but the `Actor` refactor forces the phone-gating *signature* change now (§9). |
| **Child inheritance mechanism** | **Structural `parent` on the spec (enforced invariant)**, not a `$childOf` CASL operator. Child `own`-scope is **verb-only** (never a compiled row condition — see §5). | "A note is never visible when its customer isn't" becomes structurally impossible to violate — no rule can bypass it. `parent` (FK containment) is generic, not a domain leak. |
| **Interpreter** | **Hand-walk the ucast AST** with `drizzle-orm` (~60-line walker + custom operators). Do **not** adopt `@ucast/sql`. | `@ucast/sql` targets Knex/Sequelize/TypeORM/MikroORM — not Drizzle. Adopting it means porting an adapter to save walking a small AST. CASL blesses the hand-rolled path (their `ruleToSequelize` guide). |
| **Operator registration** | **Single `defineScopeOperator({ name, parseValue, toSql, toJS? })`** — one call registers the parse-instruction, the SQL emitter, and (later) the client matcher into their respective sinks. | Two-place registration (parse + emit under the same name) reintroduces exactly the two-artifact drift this spec exists to kill (see §4.2). |
| **`ctx` sourcing** | The interpreter `ctx = { table, pk, actor }` is built from the **spec already in hand** at `resolveScope(spec, actor)`, using the subject **only** for `rulesToAST`. **No `caslSubject → spec` registry** (`caslSubject` is many-to-one — `Proposal` ← proposals + media-files + views). | A subject-keyed registry overwrites on collision → wrong table/pk. The spec is already the caller's argument; thread it. |

---

## 3. The `Actor` seam

Replace the ambient `ScopedContext.scope` with an **`Actor`** — a tagged union naming *who is acting and how far their authority reaches*. It makes "verb-checked but row-unscoped" unrepresentable by accident.

```ts
type Actor =
  | { kind: 'user';   userId: string; ability: AppAbility }   // role-based reach
  | { kind: 'token';  scope: SQL;      subject: AppSubject }   // bearer (homeowner); reach = one shared row, never null
  | { kind: 'system'; reason: string }                        // trusted; the ONLY unrestricted actor, and it must say why
```

- **Omni is no longer `null`.** A super-admin is `kind:'user'` whose compiled scope happens to be "no constraint" *because the compiler said so* (see §4 sentinels) — not a hand-maintained special case in three files.
- **`system` is the one intentional bypass, and it is loud.** It carries a `reason` string, so every privileged write self-documents and is greppable/auditable. `SYSTEM_CONTEXT` (a null-session sentinel) is replaced by `{ kind:'system', reason }`.
- **`token` carries `scope: SQL`** (`proposal.token = :token`), never null. The homeowner path is *scoped*, not unrestricted.

**Load-bearing invariant — homeowner is ALWAYS `token`, never `user`.** `can('read','Proposal')` is conditionless (`abilities.ts:200`); today the homeowner *session* path is scoped to participation (→ 0 rows) by the hand-written `proposalVisibility`. If a homeowner ever resolved as `kind:'user'`, `read Proposal` would compile to allow-all → **every proposal leaks**. The actor-construction seam (the code that turns a request into an `Actor`) MUST route the homeowner/bearer path to `kind:'token'` unconditionally. This is asserted by test (§7 Phase 3).

At every DAL/probe call site: `resolveScope(spec, actor)` / `canAccess(spec, actor, id)`. `null` (no constraint) is reachable only by `system`, or a genuinely allow-all `user` (omni / a conditionless-by-design role like manager) — never by "forgot to set scope."

---

## 4. The Scope Compiler (the deep module)

The module that turns **rules into a WHERE clause**. It is the single scope authority, replacing `resolveEffectiveScope` + `resolveVisibilityScope`.

**Interface (small):**

```ts
compileScope(actor: Actor, action: AppAction, subject: AppSubject, ctx: OperatorCtx): SQL | null
```

`action` is the full `AppAction` (not hard-coded `'read'`) so the same compiler serves the create/precursor and future state-transition axes without a later signature break. `ctx` (`{ table, pk, actor }`) is supplied by the caller (`resolveScope`), which already holds the spec.

**Pipeline behind it:**

```
actor ──→ ability (actor.ability)
      ──→ rulesToAST(ability, action, subject)     // @casl/ability/extra
      ──→ ucast Condition tree
      ──→ interpret(node, ctx)                       // ~60-line hand-walker (drizzle-orm)
      ──→ SQL   (and / or / eq / exists)
```

The interpreter's `ctx` carries `{ table, pk, actor }` — the outer table/pk of the subject being compiled, taken **from the spec the caller already has** (not a subject registry; see §2 "`ctx` sourcing"). Operator *parameters* ride in the AST node (from the rule). The spec carries no binding data (see §5).

### 4.1 The sentinel semantics (VERIFIED against `@casl/ability@6.8.0`) — and why the flip is a LEAK risk, not "strictly safer"

Read from `dist/es5m/extra/index.js` (functions `rulesToQuery` / `rulesToAST`). **This is the single most dangerous detail in the design** — getting it backwards inverts the security model.

| `rulesToAST` returns | Meaning | Compiler must emit |
|---|---|---|
| **`null`** | Role has **no** read rule for the subject → **DENY-ALL** | `sql\`false\`` (match nothing) |
| **`buildAnd([])`** (empty AND) | An **unconditional allow** (super-admin `manage all`; manager's conditionless `read Meeting`) → **allow-all** | no constraint (`undefined`/`null`) |
| **non-empty AST** | conditional rules | compiled WHERE |

The compiler maps `rulesToAST`'s `null` → `sql\`false\``. A role with no rule for an entity is **denied**, not granted see-all.

**⚠️ The real hazard is the opposite of "no rule → deny."** Today the row predicate lives *outside* CASL, so **every current read rule is conditionless** → compiles to `buildAnd([])` → **allow-all**. The danger is a **conditionless verb rule compiling to no-WHERE and dropping the participation scope that today lives in `visibility.ts`.** If any call site cuts to `compileScope` *before* its rule carries the migrated condition, agents see **all** meetings/customers/proposals/projects and dispatchers see all customers. The flip newly-denies *nobody* who currently works (no-read-verb roles were already verb-denied upstream) — so **the entire risk surface is false-ALLOW (leak), not false-deny.**

Two consequences bind the migration (§7):
1. **No behavior-neutral engine-only phase exists.** Compiling today's conditionless rules = allow-all ≠ today's participation fragment. The engine and the authored conditions must land **together, per entity**.
2. **Conditions REPLACE the conditionless verb; they never sit beside it.** CASL OR-merges all matching `can` rules — a leftover conditionless `can('read','Customer')` dominates a new conditional one → `buildAnd([])` → allow-all → leak. Phase 1 edits the existing rule; it does not add a second.

```ts
function compileScope(actor: Actor, action: AppAction, subject: AppSubject, ctx: OperatorCtx): SQL | null {
  if (actor.kind === 'system') return null            // trusted → no constraint
  if (actor.kind === 'token')  return actor.scope      // bearer → exactly its shared row(s)
  const ast = rulesToAST(actor.ability, action, subject)
  if (ast === null) return sql`false`                  // DENY-ALL: role can't read this subject
  return interpret(ast, ctx) ?? null                   // empty-AND → undefined → null (allow-all)
}
```

`null` out = "no WHERE"; `sql\`false\`` = "match nothing." The DAL's `and(eq(pk,id), scope ?? undefined)` then fails **safe** on deny — deny yields empty results, never a leak. The false-ALLOW risk is contained entirely by the atomic-cutover discipline above, not by the sentinel map.

### 4.2 Custom operators (the domain seam)

ucast gives field-condition nodes (`eq`, `in`, `and`, `or`, `not`) for free. The domain lives in a small set of **custom operators**, registered **once** via `defineScopeOperator` in a domain module — the only place the `meetings`/`meeting_participants` tables are named for authz.

**One registration, all sinks.** A custom operator needs to (1) *parse* into an AST node at ability construction and (2) *emit* SQL in the interpreter — and later (3) *match* in the client mirror. Registering the same name in two (soon three) places is the exact two-artifact drift this spec kills, re-created one layer down. `defineScopeOperator` takes all sides in one call and wires each into its sink:

```ts
// src/shared/domains/permissions/operators/meeting-participation.ts  ← the ONLY file that knows "meetings" for authz
defineScopeOperator({
  name: '$participatesViaMeeting',
  parseValue: (v) => v,                        // condition value → AST node payload ({ via })
  toSql: (node, ctx) => exists(/* correlated EXISTS from ctx.table + ctx.pk + node.via */),
  // toJS?: (node, viewer) => boolean          // added when Client Mirror lands; no second file
})

defineScopeOperator({
  name: '$hasNoMeeting',
  toSql: (node, ctx) => notExists(/* NOT EXISTS a meeting for this customer */),
})
```

**Operator parameters live in the rule, not the spec.** The per-entity parameterization rides inside the CASL condition value and lands in the AST node; the interpreter reads it off the node. The generic spec never names a domain mechanism.

**Honesty note — `$participatesViaMeeting{via}` collapses four call-sites, not four join *shapes*.** The `via` values map to three structurally distinct correlations (verified against `db/schema`), so the operator body is a switch on direction, not a single templated join:

| Entity | Rule condition | Emitted EXISTS correlate | Topology |
|---|---|---|---|
| Meeting | `{ $participatesViaMeeting: { via: 'self' } }` | `meeting_participants.meeting_id = meetings.id` | direct to participants (no meetings hop) |
| Customer | `{ $participatesViaMeeting: { via: 'customerId' } }` | `meetings.customer_id = customers.id` | reverse FK **on meetings** |
| Project | `{ $participatesViaMeeting: { via: 'projectId' } }` | `meetings.project_id = projects.id` | reverse FK **on meetings** |
| Proposal | `{ $participatesViaMeeting: { via: 'meetingId' } }` | `proposals.meeting_id = meetings.id` | forward FK **on the subject table** |

The elegance is a single *named atom* and one registration site — worth having — but the interpreter still encodes the three topologies. The spec claims no more than that.

### 4.3 Role polymorphism (the payoff, incl. Fork B)

Different roles, **same subject**, different compiled predicates — what the single hand-written `visibility(scope)` fn cannot do:

```ts
// Customer subject (conditions REPLACE the conditionless can('read','Customer')):
// agent      → can('read','Customer', { $participatesViaMeeting: { via: 'customerId' } })
// dispatcher → can('read','Customer', { pipeline: 'active', $hasNoMeeting: true })   // NOTE: column is `pipeline`, not `pipelineStage`
// manager    → can('read','Customer')                            // conditionless → allow-all
```

Agent gets the participation EXISTS; dispatcher gets `pipeline='active' AND NOT EXISTS(meeting)` (matching `leadsPoolVisibility()` at `customers/dal/server/visibility.ts:22`); manager gets no WHERE.

**Fork B (LeadsPool) — migrate all THREE consumers together, or the fact fractures.** `can('read','LeadsPool')` today drives (a) row-visibility, (b) phone-ungating (`phone-gating-sql.ts:44`), (c) pipeline-set access (`get-accessible-pipelines.ts:19`). Dissolving *only* row-visibility into `{pipeline, $hasNoMeeting}` while leaving (b)/(c) on the `LeadsPool` flag means the single business fact "dispatcher works the unclaimed-leads pool" is edited in two vocabularies. Options:
- **Preferred:** keep `LeadsPool` as a named CASL capability, define the pool predicate **once**, and have the row rule, phone grant, and pipeline-set all reference it. Row-visibility compiles here; phone `CASE` + pipeline-set land in the deferred Field-Mask spec but read the *same* named capability.
- Do **not** half-migrate: never a `$hasNoMeeting` row rule alongside a still-live `LeadsPool`-flag phone check.

### 4.4 Where omni goes

`rulesToAST` on a conditionless `manage all` → `buildAnd([])` → interpreter → `undefined` → `null` → no WHERE. Omni stops being a hand-maintained short-circuit — it is an emergent property of the rules. **Three sites carry the omni collapse today and ALL must be ported** (not just middleware): `resolveVisibilityScope` (`scope-middleware.ts:26`), `buildUserContext` (`helpers.ts:71` — the context builder for every service/job, the hardest to grep), and `shareableMiddleware` (`shareable-middleware.ts:64`). Missing `buildUserContext` leaves the collapse alive in the worst place. Deleting all three special-cases is the locality win.

---

## 5. The `EntityServerSpec` shrinks

Delete the hand-written `visibility` function. The spec becomes a near-pure registry entry:

```ts
interface EntityServerSpec {
  entityName: EntityName                               // 1:1 identity (registry key, if any)
  caslSubject: AppSubject                              // ties rows to their policy (MANY specs may share one subject)
  table: PgTable
  primaryKey?: string                                  // default 'id'
  parent?: { spec: EntityServerSpec; fk?: PgColumn }   // generic FK containment; fk derivable from Drizzle relations (§11)
}
```

Two entity shapes, one unifying interface. `resolveScope(spec, actor)` is what the DAL composes into a host query's `.where()`; it hides whether scope came from compiled conditions (roots) or structural inheritance (children):

```ts
function resolveScope(spec: EntityServerSpec, actor: Actor): SQL | null {
  const ctx = { table: spec.table, pk: pk(spec), actor }          // built from the spec in hand — NOT a subject registry
  const own = spec.parent
    ? verbOnly(actor, 'read', spec.caslSubject)                   // CHILD: verb-only — null if allowed, sql`false` if denied
    : compileScope(actor, 'read', spec.caslSubject, ctx)          // ROOT: full conditional compile
  const bridge = spec.parent
    ? inArray(fkOf(spec), db.select({ pk: pk(spec.parent.spec) }).from(spec.parent.spec.table)
        .where(resolveScope(spec.parent.spec, actor) ?? undefined))
    : null
  return combine(own, bridge)   // AND non-null fragments; both null → null (allow); own=sql`false` → deny
}

// CHILD own-scope is the VERB only — never the parent's row condition compiled against the child table.
function verbOnly(actor: Actor, action: AppAction, subject: AppSubject): SQL | null {
  if (actor.kind === 'system') return null
  if (actor.kind === 'token')  return null            // token reach handled by the bridge + host token predicate
  return actor.ability.can(action, subject) ? null : sql`false`
}
```

**Why `verbOnly` for children (the §5 correctness fix).** Owned children reuse the parent's `caslSubject` (epic D7): `proposal_media_files` → subject `Proposal`. After migration `read Proposal` carries `{ $participatesViaMeeting: { via: 'meetingId' } }`, which compiles to `EXISTS(… proposals.meeting_id = meetings.id …)` — SQL over **`proposals`/`meetings`, not `proposal_media_files`**. ANDing that into a query on the child table is a "missing FROM-clause entry" error (the exact hazard `customerNoteServerSpec.before` already documents at `customer-notes/lib/server-spec.ts:48`). So a `parent`-bearing child NEVER runs the conditional `compileScope` on its shared subject — its `own` term is the boolean verb (allow → `null`, deny → `sql\`false\``), and **rows are governed entirely by the structural bridge**. The bridge is unconditional, so "child ⊆ parent" cannot be violated by any rule.

- **Roots** (`Customer`, `Meeting`, `Proposal`, `Project`) — `caslSubject` + rules carrying operator params; no `parent`. Scope = compiled conditions.
- **Owned children** (`customer_profiles`, `customer_notes`, `customer_lead_attribution`, `customer_enrichment`, plus `proposal_media_files`, `proposal_views`) — declare `parent`. Scope = **verb** (`own`) AND the **structural bridge** to the parent's resolved scope.
- The bridge recurses cleanly for grandchildren (verified in the shipped `resolveEffectiveScope`/`bridgeToParent` at `scope.ts:52`) — each level ANDs `own ∧ (fk IN SELECT parent.pk WHERE <parent scope>)`, one semijoin per hop, all in the leaf's own table.

---

## 6. The Point-Probe (create/precursor path)

Two paths have no host row to compose into: **precursor authorization** ("can this actor create a child under parent X?", before the child exists) and standalone **point checks**. One function serves both, and two vulns die here:

```ts
async function canAccess(spec: EntityServerSpec, actor: Actor, id: string | number, action: AppAction = 'read'): Promise<boolean> {
  const scope = resolveScope(spec, actor)              // null = allow-all (system/omni), sql`false` = deny
  const [row] = await db.select({ x: sql`1` }).from(spec.table)
    .where(and(eq(pk(spec), id), scope ?? undefined)).limit(1)
  return !!row
}
```

- **The `if (!ctx.session) return true` bypass is gone.** A `system` actor resolves to `null` scope *by its declared kind* → the probe degrades to a pure existence check — unrestricted, but because someone explicitly passed `{kind:'system', reason}`, not because a field was null.
- **The `ctx.scope ?? undefined` deny-leak is gone.** No-rule yields `sql\`false\`` → `false` (deny), never see-all. The deprecated `isInScope` is deleted; callers re-resolve from spec + actor.

**⚠️ Precursor semantics are load-bearing — spell out the action.** "Can this actor create a child under parent X?" is a probe against the **parent's READ scope**, *not* a `create` verb on the parent:

```ts
// Precursor for "agent upserts a profile under customer C":
//   canAccess(customerSpec, actor, customerId, 'read')   ← parent READ visibility gates the write
```

Probing with `action: 'create'` would be wrong here — an agent has **no** `create Customer` rule, so `rulesToAST` returns `null` → `sql\`false\`` → it would deny every legitimate profile upsert. The precursor asks "is the parent visible to this actor?", which is a `read` probe. (A distinct `create`-gated precursor is available for cases where a genuine create-capability on the parent is the gate — but the customer-profile write is a read-visibility gate.) See §8 for how this closes the meeting-flow vuln.

`canAccess` and `resolveScope` are the same authority in point vs composable shapes — today's `isVisible`/`resolveEffectiveScope` pairing, fed by `Actor` + the compiler instead of an ambient scope.

---

## 7. Migration order (compiler-first, per-entity atomic, equivalence-gated)

Each phase ships green (`pnpm tsc && pnpm lint`). **There is no engine-only "zero behavior change" phase** (§4.1): the engine and the migrated conditions land together, one entity at a time.

- **Phase 0 — Engine + Actor scaffolding, no cutover yet.** `Actor`; the operator registry (`defineScopeOperator` for `$participatesViaMeeting`, `$hasNoMeeting`); `compileScope`; `resolveScope` (with `verbOnly` child branch); `canAccess`; the `pk`/`fk` helpers. Nothing calls them yet — old `visibility` fns still drive production. Unit-test the compiler in isolation against **hand-authored expected SQL** (not against today's rules, which are conditionless and would compile to allow-all).
- **Phase 1 — Per-entity atomic cutover (Customer, then Meeting, Proposal, Project).** For each root, in ONE change: (a) **replace** the conditionless `can('read', X)` with the conditional rule (agent participation `via`, dispatcher `{pipeline, $hasNoMeeting}`, manager's conditionless `read Meeting`); (b) point that entity's middleware/DAL at `resolveScope(spec, actor)`; (c) drop its `visibility` fn. **Equivalence gate:** before merge, assert the compiled predicate is SQL-equivalent to the *pre-change* hand-written fragment for every role × that entity. Because condition and cutover ship together, the entity is never in an allow-all window.
- **Phase 2 — Resolve the project drift (Fork C) as a business ruling.** Confirm whether any operational agent view relies on `ownerId=me OR isPublic` beyond pure-portfolio rows (already excluded by `hasAssociatedMeeting()`); the public showroom is safe (dedicated `isPublic=true` queries). If participation-only is correct → delete `:367`'s branch. If not → author it as an OR of explicit `can('read','Project', …)` rules so the compiler carries it. Note: `crud.router.ts:56`'s `visibility` filter key is a **display filter** (public/draft toggle), not row-security — leave it.
- **Phase 3 — Cut owned children over.** Declare `parent: {spec, fk?}` on `customer_profiles/notes/lead_attribution/enrichment`, `proposal_media_files`, `proposal_views`; delete bespoke child scoping (`customer-notes/lib/visibility.ts` inline re-derivation, `mutations.ts:37` inline probe). Assert the homeowner-is-always-`token` invariant (§3) by test here.
- **Phase 4 — Point-probe + vuln fixes.** Migrate `media.router`/`proposal-views` to `canAccess`; delete `isVisible`'s `if (!ctx.session) return true` and the deprecated `isInScope`. Fix the four SYSTEM_CONTEXT/token sites (§8). Cut `canSeeUngatedPhone` to take `Actor` (§9).
- **Phase 5 — Delete dead code + finish the omni collapse.** `resolveEffectiveScope`, `bridgeToParent`, `isInScope`, `SYSTEM_CONTEXT` (→ `{kind:'system', reason}`), and the omni branch in **all three** collapse sites — `resolveVisibilityScope`, `buildUserContext`, `shareableMiddleware`.

---

## 8. Vuln closure

| Site | Today | Closed by |
|---|---|---|
| `meeting-flow.router.ts:40` | agentProcedure verb-checks `update CustomerProfile`, then writes via `SYSTEM_CONTEXT` with **client-supplied `customerId`** — no row check | **Precursor read-probe + abandon SYSTEM_CONTEXT.** Before the profile upsert, `canAccess(customerSpec, actor, customerId, 'read')` — the agent's participation-scoped `read Customer` (authored in Phase 1) forces `customerId ∈ agent's visible customers`; then write as the **agent `user` actor** through the CustomerProfile child spec (bridge re-enforces it). Cross-customer write → probe denies. **Contingent on Phase 1** (the `read Customer` condition must exist) — until then the probe is allow-all and the vuln is open. |
| `contracts.router.ts:218` | homeowner path writes `customer.age` via `SYSTEM_CONTEXT` | Reclassify as **`{kind:'system', reason:'homeowner age capture; gated by proposal-token visibility at getFullView'}`** — named, greppable, audited (or a token `update` rule). |
| `proposal-views/queries.ts:36` | `isInScope` probes ambient `ctx.scope` (leaks on null) | `canAccess(proposalSpec, actor, id)` re-resolves from spec+actor; write path (`recordProposalView`) runs as a **`token` actor** scoped `proposal.token = :token`. |
| `ctx.scope ?? undefined` (DAL-wide) | null silently drops the predicate → see-all | Compiler sentinel: no-rule → `sql\`false\`` (deny). Fails **safe**. The residual false-ALLOW risk is the conditionless-verb window, closed by Phase-1 atomic cutover (§4.1/§7), not by the sentinel. |

---

## 9. Scope & deferrals

**In this spec:** the `Actor` seam + facades **Policy (1)**, **Scope Compiler (2)**, **Point-Probe (3)** — row-visibility for the four core roots + owned children — plus the **`canSeeUngatedPhone` signature cutover**. That function keys on `ability === null` to mean token/system (`phone-gating-sql.ts:41`); the `Actor` refactor removes the null-ability it reads, so it must be re-typed to take an `Actor` **now** (its dynamic phone `CASE` masking logic is unchanged, just re-sourced). Deferring Field Mask does not remove this coupling.

**Deferred to a follow-up spec:** the dynamic phone-number `CASE` **Field Mask** (+ static CASL field grants, incl. the dispatcher's phone-ungating grant, which must reference the same named `LeadsPool` capability per §4.3) and **Client Mirror** (the browser-side ability; adds a `toJS` to existing operators via the *same* `defineScopeOperator` call — no new registration site). The other legitimate `SYSTEM_CONTEXT` callers (`funnels.router`, `voip-campaigns.router`, `landing.router`, `customers.router/business`) get only the `{kind:'system', reason}` rename — they are correctly unrestricted and out of row-visibility scope.

---

## 10. Modules & their interfaces (deletion-test summary)

| Module | Interface | Depth (delete it → what reappears?) |
|---|---|---|
| **Scope Compiler** (`compileScope`) | `(actor, action, subject, ctx) → SQL \| null` | 4 hand-written `visibility` fns, each free to drift from its policy; the `:367` drift copy; the omni collapse. |
| **Scope Resolver** (`resolveScope`) | `(spec, actor) → SQL \| null` | Root/child branching (incl. the `verbOnly` child guard) + null/`false` sentinel handling + parent recursion smeared across 20+ DAL call sites. |
| **Point-Probe** (`canAccess`) | `(spec, actor, id, action) → boolean` | 4 re-implemented existence probes (`isVisible`, leaky `isInScope`, inline `mutations.ts:37`, `server-spec.ts:48`) + the `!ctx.session → true` bypass. |
| **Operator registry** | `defineScopeOperator({name, parseValue, toSql, toJS?})` | Cross-table EXISTS inlined + duplicated per entity — **and** the two-place (parse/emit) drift, plus a future third (client). One call, all sinks. |
| **Actor** | tagged union `user\|token\|system` | The `null`-overload vuln class (omni ≡ SYSTEM ≡ "forgot to scope"). |

The `caslSubject → spec` registry is intentionally **absent** — `resolveScope` threads the spec it already holds; a subject-keyed map would collide (many children share one subject) and resurrect the epic's dead `entity-registry`.

---

## 11. New-entity ergonomics (make setup trivial)

Under this design, the row policy a developer authors for a new entity is: **conditions on the `can()` rules in `abilities.ts` + (for children) one `parent` line.** These are the improvements that keep it there and turn the remaining silent-failure classes loud. They are **in scope for the implementation plan** unless noted.

1. **`defineScopeOperator` — single registration** (§4.2). One call wires parse + emit (+ later client). Kills the asymmetric silent(parse)/loud(emit) drift. *Ship with the engine (Phase 0).*
2. **Derive & validate `parent.fk` from Drizzle FK metadata.** `parent` takes just the parent spec; the child's single `.references()` FK to the parent table supplies `fk`. A load-time assert `fk.table === childSpec.table ∧ fk.references === parentSpec.table.pk` turns a mis-pointed FK (today: any `PgColumn` type-checks → silent wrong-join) into a **loud startup throw**. Keep explicit `fk` as an override for the rare double-FK case. *Ship in Phase 3.*
3. **A data-layer `defineEntity({...})`** that returns the `EntityServerSpec`, self-registers it into the `entityName → spec` map (reviving the epic's otherwise-dead `entityRegistry` slot rather than adding surface), and runs the fk-validation. The one obvious place; makes "subject in the union but no spec" a load-time throw. **Reject** folding tRPC procedures/routers into it — the standardization epic deliberately keeps `server-spec.ts` free of `@/trpc/*` (no `initTRPC`/`superjson` in the DAL/client bundle). *Optional, low-risk; Phase 3+.*
4. **An exhaustiveness test** (not a type-level `AppSubject`↔spec link — ADR-0002 rejected auto-derived `EntityName` as "too magical"): assert every `EntityName` has a registered spec, every `parent` passes fk-validation, and every operator referenced in any rule is registered. One test file, zero production surface — the right net for a deliberately hand-maintained union + many-to-one subjects. *Ship in Phase 1.*
5. **Rejected (fight decisions made on purpose):** full-stack `defineEntity` (re-couples tRPC), type-derived `AppSubject` (ADR-0002), derived PK-type generic (ADR-0002 abandoned `PkField<TTable>` as unresolvable under `PgTable` bounds — the explicit `<…, number>` is the chosen escape).

**Net:** adding a root drops to ~8 touch-points, a child to ~7, and the parent/child relationship becomes `parent: widgetSpec` (fk derived + validated). The three silent-failure classes — wrong-table child compile (§5), subject→spec collision (§2), wrong `fk` join — become structurally impossible or loud throws.
