# CASL Scope Compiler — Phase 3 Problem Statement & Gap Analysis (Children + Actor Principals)

> **Type:** Problem statement / gap analysis (NOT an executable plan). Scopes the boundary of Phase 3 before any code.
> **Parent design:** `docs/superpowers/specs/2026-08-10-casl-scope-compiler-design.md` (v2) — §3 Actor seam, §4.1 migration invariant, §5 sub-entity model, §6 point-probe, §11.2 fk-validate.
> **Epic tracker:** `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (Phase 3; Phase P — Propagation).
> **Memory:** `memory/project-permissions-casl-compiler.md`.
> **Date:** 2026-08-12. **Author decision context:** user grill — "lay out the problem/requirements clearly, distinguish built machinery from what propagation to call sites means; robustness BEFORE propagation."

---

## 1. Purpose

Phase 3 was written as "cut owned children over to the `parent` bridge + delete bespoke child scoping." The Phase-1 surface map (2026-08-12) showed that framing understates the work and collides with a newer ruling. This doc restates the **locked decisions**, inventories **what machinery is already built vs. dead**, enumerates **what propagating to the individual call sites actually means** (per site), and fixes **the boundary** between what belongs to Phase 3 now (a robustness/proof gate) and what defers to Phase P (Propagation).

This doc does not decide implementation mechanics. It establishes shared understanding of the problem.

## 2. Locked decisions (restated, not re-litigated)

### 2.1 One spec; sub-entities populate `parent` (spec §2 Fork A, §5)
There is a single `EntityServerSpec` (`src/shared/dal/server/types.ts:71`). Its `parent?: { spec, fk }` field (`:95`) is what distinguishes the two shapes:

- **Root** (`Customer`, `Meeting`, `Proposal`, `Project`) — no `parent`; row-scope = **CASL-compiled conditions** (`compileScope`).
- **Sub-entity** (owned child) — populates `parent`; row-scope = **`verbOnly(own)` AND the structural bridge** `fk IN (SELECT parent.pk FROM parent WHERE <parent's resolved scope>)`.

The bridge is **unconditional**, so *"a child is never visible when its parent isn't"* is structurally unbreakable — no CASL rule can bypass it. A sub-entity keeps its **own `caslSubject` for the verb gate** (`verbOnly(actor,'read',spec.caslSubject)`), but **never runs a compiled row-condition on that subject** — doing so emits SQL over the *parent's* table (`EXISTS(… proposals.meeting_id …)`) against the *child's* query → the "missing FROM-clause" hazard (spec §5, documented at `customer-notes/lib/server-spec.ts:48`). `resolveScope(spec, actor)` (`src/shared/dal/server/lib/resolve-scope.ts:20`) hides root-vs-child from every caller. The bridge recurses for grandchildren (one semijoin per hop).

**Litmus (memory):** "must you go through the main entity to reach it?" yes → sub-entity (inherit via bridge); no → peer-root (own scope). Meeting/Proposal/Project are **peer-roots**, not Customer children.

### 2.2 The Actor seam — three fundamental principals (spec §3)
`Actor` (`src/shared/domains/permissions/scope/actor.ts:13`) replaces the ambient `ScopedContext.scope: SQL | null`, making "verb-checked but row-unscoped" unrepresentable by accident:

- **`user`** `{ kind, userId, ability }` → authenticated; row-scope COMPILED from the CASL ability. Omni is emergent (super-admin `manage all` → empty AST → null), not a special case.
- **`token`** `{ kind, scope: SQL, subject }` → unauthenticated **bearer** (homeowner viewing a proposal by share token); scope = the token predicate (`proposal.token = :token`), **never null**.
- **`system`** `{ kind, reason }` → the **one** trusted unrestricted actor; scope = null (allow-all) but it must carry a greppable/audited `reason`. Replaces the `SYSTEM_CONTEXT` null-session sentinel.

**Load-bearing invariant (spec §3):** homeowner is **ALWAYS `token`, never `user`**. `can('read','Proposal')` is conditionless; if a homeowner ever resolved as `kind:'user'` it would compile to allow-all → **every proposal leaks**. The actor-construction seam MUST route the homeowner/bearer path to `token` unconditionally.

### 2.3 Point-probe (spec §6)
`canAccess(spec, actor, id, action='read')` (`resolve-scope.ts:53`) — for create/precursor paths with no host row. "Can this actor create a child under parent X?" is a **`read` probe against the parent's scope**, NOT a `create` verb (an agent has no `create Customer` rule → `create` probe would deny every legitimate upsert).

### 2.4 Migration invariant (spec §4.1)
The row predicate lives OUTSIDE CASL today → the entire risk surface is **false-ALLOW (leak)**, not false-deny. Conditions REPLACE the conditionless verb; never sit beside it. No behavior-neutral engine-only phase exists.

## 3. What machinery is BUILT — and what is dead

| Machinery | File | Built? | Exercised in prod? |
|---|---|---|---|
| `resolveScope` **root** branch (compiled) | `resolve-scope.ts:20` | ✅ | ✅ 4 roots |
| `resolveScope` **child/parent bridge** + `verbOnly` | `resolve-scope.ts:25,40` | ✅ | ❌ **dead** — `resolveActorScope` only ever called with root specs (`resolve-actor-scope.ts:19`; callers = customers/meetings/proposals/projects procedures, none declares `parent`) |
| `Actor` union + `userActor` | `actor.ts:13,18` | ✅ | ✅ (`userActor` only) |
| **`tokenActor` / `systemActor`** | `actor.ts:22,26` | ✅ | ❌ **never called anywhere** |
| `canAccess` point-probe | `resolve-scope.ts:53` | ✅ | ❌ never called |
| `EntityServerSpec.parent` type | `types.ts:95` | ✅ (pre-dates epic) | ✅ but only via the **OLD** engine (`resolveEffectiveScope`/`bridgeToParent`, `scope.ts:37,51`) |
| §11.2 fk derive-and-validate | — | ❌ absent | — |
| §3 homeowner-always-token assert | — | ❌ absent | — |

**Crux:** the child-inheritance path and the `token`/`system` principals are **built but never run**. The machinery exists; nothing has proven it against a real query. The one sub-entity that IS wired (`proposal_media_files`) rides the **OLD** engine, not `resolveScope`.

## 4. The propagation gap — what "wire the call sites" means, per site

Two fronts.

### Front A — the 6 owned sub-entities (route rows through the parent bridge on the NEW engine)

| Sub-entity | Spec? | `parent`? | FK → parent | Current row scope | Propagation entails |
|---|---|---|---|---|---|
| `proposal_media_files` | ✅ | ✅ (OLD engine) | `proposal_id`→`proposals.id` (`schema/proposal-media-files.ts:16`) | OLD `bridgeToParent` via `procedures.ts:41` | Re-point to `resolveScope`; homeowner read `listHomeownerProposalMedia` (unscoped, `queries.ts:56`) → **`tokenActor`** |
| `customer_notes` | ✅ | ❌ own `visibility` | `customer_id`→`customers.id` (`schema/customer-notes.ts:10`) | `customerNoteVisibility` (`visibility.ts:16`) | Add `parent: Customer`; delete `customerNoteVisibility`; create-hook parent probe (`server-spec.ts:61`) → `canAccess`; keep own `CustomerNote` verb + `assertNoteAuthorOrAdmin` |
| `customer_profiles` | ❌ | ❌ | `customer_id`→`customers.id`, PK-as-FK (`schema/customer-profiles.ts:38`) | inline probe `mutations.ts:37`; read via customer join gate | Create spec + `parent`; inline probe → `canAccess` precursor; intake write → **`systemActor`** |
| `customer_lead_attribution` | ❌ | ❌ | `customer_id`→`customers.id`, PK-as-FK (`schema/customer-lead-attribution.ts:18`) | **none** (unscoped system upsert `mutations.ts:59`) | Create spec + `parent`; system upsert → **`systemActor`** |
| `customer_enrichment` | ❌ | ❌ | `customer_id`→`customers.id` (`schema/customer-enrichment.ts:14`) | **none** (unscoped `mutations.ts:87,105`; funnel-kind gate only) | Create spec + `parent`; unauthenticated funnel write (`use-progressive-enrichment.ts`) → **`token`/`system`** |
| `proposal_views` | ❌ | ❌ | `proposal_id`→`proposals.id` (`schema/proposal-views.ts:10`) | read `isInScope` (`@deprecated`, `queries.ts:36`); write **unscoped** (`mutations.ts:18`) + manual token check (`views.router.ts:44`) | Create spec + `parent`; write via **`tokenActor`**; read via `canAccess` |

### Front B — the actor-construction seam (the part easy to miss)
Today **every** request becomes a `userActor`. The homeowner path is the `shareableMiddleware` hack (`ability:null` + `ctx.scope = eq(tokenColumn, token)`, `shareable-middleware.ts:39`) plus manual token checks; system writes are `SYSTEM_CONTEXT`. Propagation means **constructing `tokenActor(scope, subject)` at homeowner/bearer entrypoints and `systemActor(reason)` at system writes**, then asserting homeowner-always-token. This is where the `token`/`system` machinery finally goes live — it touches **middleware**, not just child specs, and it is security-critical (the leak invariant, §2.2).

## 5. The boundary — Phase 3 (now) vs Phase P (Propagation)

Under the ruling **robustness BEFORE propagation** (user, 2026-08-12): **both fronts above are propagation.** Front B in particular puts the `token`/`system` principals into production — a security-critical change that deserves its own careful, equivalence-gated slice, not a side-effect of a child-spec sweep.

Therefore:

- **Phase 3 (in-bounds NOW) = the robustness / proof gate** that makes fronts A and B *safe to wire later*:
  1. **Prove the dead `resolveScope` bridge branch correct** — construct a `parent`-bearing child spec, run `resolveScope`, `EXPLAIN` the emitted `fk IN (SELECT parent.pk WHERE <parentScope>)` + the `verbOnly` own-term (allow → `null`, deny → `sql\`false\``), against hand-authored expected SQL. (No test runner → scratch `tsx`, logged in the verification log, per the epic's verification model.)
  2. **Prove the unexercised `tokenActor` / `systemActor` resolve correctly** through `resolveScope` / `canAccess` — `token` → its `scope`; `system` → `null`; and that a child bridge under each principal composes as designed.
  3. **fk mis-wiring guardrail (§11.2)** — turn a mis-pointed `parent.fk` from a silent wrong-join into a loud throw. (Mechanism TBD in the Phase 3 plan — options include derive-from-Drizzle-metadata vs validate-explicit; registry-free because there is no spec registry, §10.)

- **Phase P (Propagation, DEFERRED, gated on the above)** = both fronts, per site: the 6 sub-entity cutovers + the actor-construction seam wiring + deleting bespoke child scoping + the homeowner-always-token assert. First target remains the `customer-pipelines` feature (list + profile) per the Phase-2 grill.

## 6. Open questions to resolve in the Phase 3 (robustness-gate) plan

1. **fk-validation mechanism** — derive-from-Drizzle-metadata (novel here; `getTableConfig` unused in repo) vs validate-explicit-only; and where it fires (registry-free per-spec at module-eval vs lazy at bridge-use). Must throw loud.
2. **Proof coverage** — which child topology(ies) to EXPLAIN-prove: the real `proposal_media_files → Proposal` (agent participation) is the highest-value; a synthetic `customer_profiles → Customer` would also prove the customer-child topology. Include the deny (`verbOnly → sql\`false\``) and the `token`/`system` principal cases.
3. **Does the guardrail need any real `parent` declaration to validate against now**, or is proving it on `proposal_media_files` (already declares `parent`) sufficient without touching the other 5 specs? (Leaning: prove on `proposal_media_files` only; declaring `parent` on the other 5 is Front A = propagation.)

## 7. Non-goals of Phase 3 (explicit)

- No child cutovers (no new specs for the 4 spec-less children; no `parent` added to `customer_notes`).
- No deletion of bespoke child scoping (`customerNoteVisibility`, `mutations.ts:37` probe, unscoped writes).
- No actor-construction-seam wiring (no `tokenActor`/`systemActor` call sites; no `shareableMiddleware` replacement).
- No homeowner-always-token *enforcement* (nothing constructs a homeowner actor yet). Proving the invariant's *machinery* (that a `token` actor resolves correctly) is in-bounds; wiring the seam that guarantees homeowners get one is Phase P.
