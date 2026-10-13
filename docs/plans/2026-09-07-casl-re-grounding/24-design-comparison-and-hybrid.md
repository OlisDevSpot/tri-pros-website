# 24 — Design-it-twice: comparison of designs A–D and the recommended hybrid (2026-09-16)

> Inputs: `23-design-A-minimal.md`, `23-design-B-extensible.md`, `23-design-C-common-caller.md`, `23-design-D-ports-adapters.md`, `22-entity-topology-for-casl.md`, `17-sub-entity-as-field-example.md` (corrected 09-16 for D-19). Method: `codebase-design` skill, DESIGN-IT-TWICE — compare on **depth** (leverage per unit of interface learned), **locality** (where change concentrates), **seam placement**; then recommend. Status: proposal for the user's ruling (L13 close-out).

## 1. Where all four designs converge (treat as settled evidence, not opinion)

| # | Converged point | A | B | C | D |
|---|---|---|---|---|---|
| C1 | `Actor { ability, userId }` plain record; `ScopedContext = { actor, tx? }`; one cached `getRequestActor()`; `systemContext(reason)`; bearer ability minted only after token validation | ✓ | ✓ | ✓ | ✓ |
| C2 | **Row scope is a total value** — the three-way `null` cannot exist because nothing is cached on `ctx` and the compile result has no "unresolved" member | `SQL` (`true`/`false`/pred) | `Scope = all\|none\|where` + `whereOf` | `SQL` | `RowScope = all\|none\|where` + `whereOf` |
| C3 | Field-aware compile over `ability.rulesFor(action, subject, field)` (own ~15-line mirror of `rulesToQuery`); child = parent's subject + `collection` path; grandchild = dotted path; **action map read→read, create/update/delete→update**; own-row child keeps its subject; L8 `∧ read` INSIDE the seam | ✓ | ✓ | ✓ | ✓ |
| C4 | **Spec type splits**: `RootSpec` (subject) vs `ChildSpec` (`parent {spec, fk, collection}`; subject only for own-row children); `entityName`/`caslSubject` no longer required on every spec; `collection ⇔ ¬subject` enforced at boot | `defineSpec` xor | `defineRootSpec`/`defineChildSpec` | `defineRootSpec`/`defineChildSpec` (+`cardinality`) | `CoreSpec` |
| C5 | `collection` is an **explicit string on `parent`** (no derivation from table/entity names) — settles **L13-2** | ✓ | ✓ | ✓ | ✓ |
| C6 | Boot asserts replace runtime throws: D-19 operator placement; `cannot` last; `{}` = conditionless; collection ↔ parent-column collision; `parent.fk` on the child table; operator names ↔ registry; operator subject binding; every role has rules | ✓ | ✓ (I6–I9) | ✓ (#1–#8) | ✓ (`assertRuleInvariants`) |
| C7 | Client = ONE `'use client'` wrapper over `@casl/react` 7.0.1, hydrated from `packRules`, same `conditionsMatcher` module, `subject()` for row checks | ✓ | ✓ | ✓ | ✓ |
| C8 | Routers lose `assertCan`/`assertCanUpdateFields`/`resolveScope`; `createCrudRouter` = pure wiring; the CRUD factory derives action × subject × path × scope × field-gate from the slot | ✓ | ✓ | ✓ (the thesis) | ✓ |
| C9 | User ids baked into rules; system = `manage all` `.because(reason)`; no `kind` anywhere | ✓ | ✓ | ✓ | ✓ |

Unanimity on C2/C4/C5 is the strongest evidence this exploration produced: four independent designs under four different constraints all needed the same three structural moves.

## 2. Where they differ (the real choices)

| Axis | A (minimal) | B (extensible) | C (common caller) | D (ports & adapters) |
|---|---|---|---|---|
| Rare-caller handle | `permit(ctx, action, spec, fields?) → { sql, test, probe }` — ONE name, three renderings | 9 free functions (`toWhere`, `scopedWhere`, `whereOf`, `scopes.*`, `assertCan`, `assertCanOn`, `permittedFields`, `probe`, `assertReachable`) | `rowScope(ctx, spec, action) → SQL` + `probe(ctx, spec, id)` | `Compiler` object, 6 methods + `whereOf`/`andScopes` |
| Field gate | **compiled into SQL** per field (`rulesFor` per column, dedupe by rule-set identity) — no parent-row load; loses `forbidden{field}` naming | post-load instance check on the rule-carrying row | post-load per-column `can` on the parent row (one PK read per child mutation) | post-load `fieldGate` on the parent row |
| Rules layout | one `abilities.ts` body | `defineRole` registry, one file per role | `rules/<role>.ts` + `rules/bearer.ts` allowlists per subject + `rules/system.ts`; one loader | one static rule source (today's body) |
| Bearer | `shareableActor(spec, token?)` (session-first inside) | `defineBearerKind` registry + generic `bearer(kind, pick)` middleware; `spec.shareable.bearerRules` (policy on the spec) | `bearerContext(spec, token)` + `shareable(spec)` middleware; policy in `rules/bearer.ts` | `bearerRules(subject, rowId, allowlist)` factory |
| Ports / composition | none (module singletons) | `configurePermissions({ sessions, rules, target })`; `Target<P>` generic (2nd ORM) | none | five ports with two adapters each; **pure `core/` with a lint-enforced import rule**; operator bodies on `ctx.qb` (standalone `QueryBuilder`) ⇒ compiler is connection-free ⇒ tests = compiled-SQL string comparison |
| 1:1 facets | not addressed | composite pk only | `cardinality: 'one'` ⇒ `upsert` slot, no create/update | not addressed |
| Failure UX | every miss ⇒ `not-found` (incl. no-rule) | forbidden (verb) / not-found (row) / forbidden{field} | same as B, fixed by the factory | same |
| Largest fn (CC) | ≈6 (`interpret` 9 unchanged) | `updateImpl` ≈10 | `updateImpl` ≈11 | `compile` ≈8 |

## 3. Comparison on depth · locality · seam

**Depth.** For the 95% caller, C is deepest by construction: an entity author writes topology only, a handler writes `ctx` + one DAL call, a component writes one `<Can>`; A ties for bespoke callers with a single handle. B is shallowest — its extension registries are surface the common caller must at least know exist. D is deep at the DAL seam (six methods) but exposes a `Compiler` object where A exposes a function.
**Locality.** C and A concentrate mechanism in two files (`create-crud-dal.ts` + `permit.ts`/`scope`) and policy in `rules/`. D concentrates mechanism in `core/` with the strongest guarantee that nothing framework-shaped leaks in. B spreads registration across five folders — excellent for "add X" (zero engine edits), worse for "who may read Proposal?" (grep across roles; B admits it).
**Seam placement.** D's is the only design with an *enforced* seam (ESLint on `core/**`), and its "operators build on `ctx.qb`" move is what makes the compiler testable without a database — that is orthogonal to the caller-facing interface and can be adopted by any design. B's `Target<P>` and `RulesSource` ports fail the two-adapter test today (one ORM; static rules); D's P1/P5 are thin and D says so.
**Failure direction.** A's "everything is `not-found`" over-applies D-07 (a type-level verb miss should be `forbidden` — it leaks nothing). C's matrix (verb ⇒ 403, row ⇒ 404, field ⇒ 403 naming the field) is the most precise and matches the existing `dalToTrpc` contract.

## 4. Recommendation — the hybrid ("C-shaped interface, D-shaped core, A's handle for the rare caller")

1. **Interface = C's three seats.** `defineRootSpec({ subject, table, schemas, primaryKey?, shareable? })` · `defineChildSpec({ table, schemas, parent: { spec, fk, collection, cardinality? } })` · own-row variant `defineChildSpec({ …, parent: { spec, fk }, subject })`. Handler = `ctx` + one DAL call. Component = `<Can I a/this field>`. `createCrudDal(spec)` derives everything from the slot; `cardinality: 'one'` ⇒ `upsert` (customer profile, lead attribution, campaign enrolment).
2. **Rare-caller entry point = A's `permit(ctx, action, spec, fields?) → { sql, probe, test }`**, replacing C's `rowScope` + `probe` pair with one name; the factory is its first caller. `permit(...).sql` is total `SQL`; `probe(id)` ⇒ `not-found` (D-07); `test(row)` for scalar instance checks (throws on operator-bearing rule sets — the D-19 tripwire).
3. **Core = D's pure `core/`** (`rules.ts` client-safe · `field-ast.ts` · `interpret.ts` · `compile.ts`) with the import rule lint; **`RowScope = all | none | where` INSIDE** (bridge elision when the parent scope is `all` and the fk is `notNull`; `none` short-circuits) and **`SQL` OUTSIDE** via the single `whereOf` at `permit`. Operator bodies receive `{ table, pk, qb }` — no global `db` in the engine (also fixes `derivedPipelineWhere`'s global-`db` EXISTS).
4. **Field gate = post-load per-column `can` (D-17)** on the rule-carrying row (own row, or the parent row for a collection child), with `fieldPatternMatcher` semantics: `'views'` = row-touch only, `'views.*'` = columns, `'**'` = deeper paths. Reason: the update slot already loads the row for hooks; `forbidden{ field }` UX kept; A's SQL-per-field variant stays documented as the optimisation if the parent read ever matters.
5. **Rules layout = C's `rules/<role>.ts` + `rules/bearer.ts` (allowlist per shareable subject) + `rules/system.ts`**, one loader `buildAbility(principal)`, boot asserts from C6 in `rules/assert.ts`. Policy never lives on a spec (B's `shareable.bearerRules` rejected — SRP: spec = topology).
6. **Bearer = C's `bearerContext(spec, token)` + `shareable(spec)` middleware** (session-first). B's `defineBearerKind` registry is refused until a second bearer kind is actually built (lead-source intake / funnel `leadId`) — one adapter is a hypothetical seam; when the second arrives it is a second function beside the first, not a registry retrofit.
7. **Refused:** B's `Target<P>` (one ORM), `configurePermissions` composition root, `RulesSource` port (static rules; fixtures are plain arrays into `buildAbility`), `defineRole` registry (one `switch` in the loader + the enum↔file boot assert gives the same guarantee). D's P1/P5 ports stay as plain functions until J7 creates their second adapters.
8. **Tests / J7.** Adopt D's harness shape: vitest scoped to `domains/permissions/**` + `create-crud-dal.test.ts`, `server-only` aliased to its empty build, `PgDialect().sqlToQuery()` string comparison, D's T1–T8 + the two DAL-seam cases as the initial suite; if J7 stays "no runner", the identical cases run as the `explain-parity.ts` script. Either way the cases are written once.

### 4.1 The resulting surface (what a caller can learn in one sitting)

```
who     getRequestActor()            bearerContext(spec, token)         systemContext(reason)
what    permit(ctx, action, spec, fields?) → { sql, probe(id), test(row) }      ← rare callers; the CRUD factory uses it
topology defineRootSpec(...)         defineChildSpec(...)               createCrudDal(spec)
policy  rules/{agent,dispatcher,super-admin,bearer,system}.ts            buildAbility(principal)
client  <AbilityProvider rules>      <Can I a|this field>               useAbility()  subject()
ladder  base → protected → agent → superAdmin                            <entity>ShareableProcedure = base.use(shareable(spec))
```
Eleven names. Report 06 counted 111 primitives; every one of them maps onto this list or is deleted.

### 4.2 L13 sub-rulings the hybrid implies (for the user to confirm)
- **L13-2** `collection` is explicit on `parent` (all four designs).
- **L13-3** child read ⇒ parent `read`; child create/update/delete ⇒ parent `update` on the collection (all four; proved by the report-17 probe).
- **L13-4** own-row exception = `defineChildSpec` with `subject` and no `collection`; `CustomerNote` is the only one today (report 22); a role that needs "add but not remove" on a collection uses the same hatch.
- **L13-5** grandchildren = dotted paths (`applications.answers`, `applications.trades`), bridged per hop; `'**'` in rules for deep grants.
- **L13-6** field gate = post-load per-column `can` (§4.4); `'<c>'` vs `'<c>.*'` semantics documented in the rules file header.
- **L13-7** boot asserts = C6 union (8 asserts) in `rules/assert.ts` + `spec/assert.ts`.
- **1:1 facets** = `cardinality: 'one'`.
- **Report 22 special cases:** `proposal_media_files` = field `media` of Proposal now, bearer-side `visibility='homeowner'` filter stays a callsite rule in `getFullView` (own subject only if bearer media reads ever go generic); `meeting_participants` = field `participants` of Meeting with the boot invariant "operator bodies never call `permit`/`compile`" (no circularity — the operator emits raw EXISTS below the spec layer); `applications` under the dispatcher's unconditional Meeting rules ⇒ explicit `cannot` on `['applications', 'applications.**']` (a Q8 row).

## 5. What this does NOT decide
Q8's 25 business rulings (the matrix content), 7c bearer read masking, Q10 root provider, Q11 the merge conflict, J3 interim, J6 wall shape, J7 runner — all upstream of the core as rules, a projection, or process.
