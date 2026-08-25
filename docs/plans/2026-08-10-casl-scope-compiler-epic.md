# CASL Scope Compiler Epic

> **⚠️ STALE DRAFT (flagged 2026-08-20) — this copy on `main` is UNTRACKED and frozen at the original draft.** The LIVE, authoritative tracker is the committed copy on branch `refactor/285-refactor-permissions-casl-scope-compiler` (`.worktrees/issue-285`), which records **Phases 0–5 DONE (in-worktree, NOT on main)** and Phases 6→9 remaining, plus a 2026-08-20 structural finding (reads migrated to CASL; mutations still on the legacy engine). Nothing from #285 is on `main` yet — merge is a single integration pass after the overhaul. See `docs/plans/2026-08-20-backend-refactor-roadmap.md` for the cross-thread view. **Do not treat the status line below as current.**
> **Status (original draft):** Design approved (2026-08-11, battle-tested). Phase 0 planned. Not yet implemented.
> **Canonical design:** `docs/superpowers/specs/2026-08-10-casl-scope-compiler-design.md` (v2). This tracker does NOT restate the design — read the spec for the *why* and the module interfaces. This doc is the **roadmap + status**: which phase is where, what blocks what, and where each phase's detailed executable plan lives.
> **Builds on:** the shipped scope engine from [[project-trpc-standardization-epic]] "Increment A" (`resolveEffectiveScope` / `bridgeToParent` / `isVisible` in `src/shared/dal/server/lib/scope.ts`). This epic **replaces** that hand-written-`visibility(scope)` engine with a CASL-compiled predicate; the two coexist until Phase 5 deletes the old one.
> **Related:** ADR-0002 (Entity Server System), `docs/permissions/visibility-rules-catalog.md`, `memory/project-permissions-casl-compiler.md`, [[project-dispatcher-role]].

## Why this epic exists

Authorization is split across two hand-maintained artifacts that silently drift (spec §1): **CASL** owns the verb (conditionless today), **hand-written `EntityServerSpec.visibility` fns** own the row predicate. Because they're separate, they diverge — producing the live `:367` project drift, the un-expressible manager role, the `LeadsPool` magic flag, and a class of `null`-overload leaks (`meeting-flow.router.ts:40` et al.).

**Thesis:** make CASL rules the single source of truth; **compile** the row-visibility SQL predicate from the rules (`rulesToAST` → ucast AST → Drizzle interpreter), the way `@casl/prisma`'s `accessibleBy` does. See spec §1.

## Design decisions (locked — see spec §2)

The eight approach forks are settled in the spec's §2 table (child inheritance = split; project drift = business ruling; sequencing = per-entity atomic; scope = server core + phone signature; child mechanism = structural `parent`; interpreter = hand-walk, no `@ucast/sql`; operator registration = single `defineScopeOperator`; `ctx` sourcing = spec-threaded, no subject registry). **Do not re-litigate here.** If a phase's implementation surfaces a reason to reopen one, note it in that phase's plan and ping.

## The critical migration invariant (spec §4.1)

**The row predicate lives OUTSIDE CASL today, so this is NOT a behavior-neutral engine swap.** Every current `read` rule is conditionless → compiles to allow-all. The entire risk surface is **false-ALLOW (leak)**, not false-deny. Two rules bind every phase:

1. **No behavior-neutral "engine-only" phase exists.** The engine and the migrated conditions land **together, per entity** (that's why Phase 0 wires *nothing* into production, and Phase 1 is per-entity atomic).
2. **Conditions REPLACE the conditionless verb — never sit beside it.** CASL OR-merges rules; a leftover conditionless `can('read', X)` dominates → allow-all → leak.

## Verification model (no test runner in this repo)

This repo has **no test framework** (no vitest/jest, 4 stray `.test.ts` files, no `test` script). Per the shipped tRPC epic, every slice gates on **`pnpm tsc && pnpm lint` green + manual `EXPLAIN`/equivalence review** — not automated unit tests. This epic follows the same gate. Where the spec says "unit-test the compiler," read: **construct the input by hand in a scratch `tsx` (uncommitted, in the scratchpad), print the compiled SQL / `EXPLAIN` it, and record the evidence in the phase plan's verification log.** The compiler is pure and deterministic, so hand-authored-input → hand-authored-expected-SQL comparison is the equivalence gate.

> If a test runner is later adopted, the compiler + the Phase-1 equivalence assertions + the §11.4 exhaustiveness check are the first things that should become real tests. Tracked as a follow-on, not a blocker.

## Phase breakdown (the roadmap)

Each phase ships **green** (`pnpm tsc && pnpm lint`) and is independently reviewable. Phases are **sequential** (later phases consume earlier modules), but each is planned and executed as its own unit. A phase's detailed executable plan is written **just-in-time** when it unblocks (matching the tRPC epic's per-slice plan cadence) — so a plan reflects the real code state at execution, not a speculative guess made now.

Legend: `AFK` = mergeable without live user decisions · `HITL` = needs a user ruling mid-phase.

- [ ] **Phase 0 · AFK · blocked-by: none — Engine + `Actor` scaffolding, NO cutover.**
  Build the compiler and its neighbours as **additive, unwired** modules: the `Actor` union; the operator registry (`defineScopeOperator`) + the two domain operators (`$participatesViaMeeting`, `$hasNoMeeting`) — **emit side only** (CASL parser wiring is Phase 1); the AST interpreter; `compileScope`; `resolveScope` (+ `verbOnly` child branch); `canAccess`; `pk`/`fk` helpers. **Nothing in production imports them** — the old `visibility` fns still drive every query, so behavior change is provably zero. Verify the interpreter/compiler in isolation against **hand-authored nodes → hand-authored expected SQL** (standard operators exercise the sentinels; the custom operators' EXISTS SQL is `EXPLAIN`ed from hand-built nodes).
  - **Plan:** `docs/superpowers/plans/2026-08-10-casl-phase-0-engine-scaffolding.md` (written).
  - **AC:** new modules compile & lint; **no production file imports them**; `git grep` shows zero new call sites in `src/**` outside the new dir + its scratch verification; the four sentinel behaviours (system→null, token→scope, no-rule→`sql\`false\``, conditionless→null) and the four `via` EXISTS topologies are `EXPLAIN`-recorded in the plan's verification log.

- [ ] **Phase 1 · HITL · blocked-by: Phase 0 — Per-entity atomic cutover (Customer → Meeting → Proposal → Project).**
  For **each root, in ONE change**: (a) **replace** the conditionless `can('read', X)` with the conditional rule (agent participation `via`; dispatcher `{ pipeline:'active', $hasNoMeeting:true }`; manager conditionless); (b) wire the CASL **custom-operator parser** so `rulesToAST` emits the custom nodes (the Phase-0-deferred `buildScopeConditionsMatcher`, resolved against `@casl/ability@6.8.0` here); (c) point that entity's middleware/DAL at `resolveScope(spec, actor)`; (d) drop its `visibility` fn. **Equivalence gate per role × entity:** compiled predicate `EXPLAIN`-equivalent to the pre-change hand-written fragment. Ship the §11.4 **exhaustiveness check** (every `EntityName` has a spec; every rule-referenced operator is registered) as a startup assert. **HITL:** confirm the agent/dispatcher/manager rule set per entity before cutover.
  - **Plan:** _(JIT — write when Phase 0 lands)_
  - **AC:** per entity, compiled == pre-change fragment for every role; no conditionless `read` rule remains beside a conditional one; `buildUserContext`/middleware route through `resolveScope`; tsc+lint green.

- [ ] **Phase 2 · HITL · blocked-by: Phase 1 (Project) — Resolve the project drift (Fork C) as a business ruling.**
  Confirm whether any operational agent view relies on `ownerId=me OR isPublic` beyond pure-portfolio rows (already excluded by `hasAssociatedMeeting()`; public showroom served by dedicated `isPublic=true` queries). **If participation-only is correct →** delete `get-customer-pipeline-items.ts:367`'s branch. **If not →** author it as an OR of explicit `can('read','Project', …)` rules so the compiler carries it. Leave `crud.router.ts:56`'s display-filter key alone (it's a public/draft toggle, not row-security).
  - **Plan:** _(JIT)_ · **HITL:** the ruling itself.
  - **AC:** the drift is either deleted or expressed as compiled rules; no hand-written project predicate remains outside CASL; documented ruling in the plan.

- [ ] **Phase 3 · AFK · blocked-by: Phase 1 — Cut owned children over.**
  Declare `parent: { spec, fk? }` on `customer_profiles / customer_notes / customer_lead_attribution / customer_enrichment`, `proposal_media_files`, `proposal_views`; delete bespoke child scoping (`customer-notes/lib/visibility.ts` inline re-derivation, `mutations.ts:37` inline probe). Children resolve `own` as **verb-only** (spec §5) — rows governed entirely by the structural bridge. Assert the **homeowner-is-always-`token`** invariant (spec §3) here. Ship the §11.2 **`parent.fk` derive-and-validate** (Drizzle FK metadata → load-time throw on mis-pointed FK).
  - **Plan:** _(JIT)_
  - **AC:** each child declares `parent`; no child-specific row SQL remains; homeowner-token invariant asserted; mis-pointed FK throws at startup; tsc+lint green.

- [ ] **Phase 4 · AFK · blocked-by: Phase 1, Phase 3 — Point-probe + vuln fixes.**
  Migrate `media.router` / `proposal-views` to `canAccess`; delete `isVisible`'s `if (!ctx.session) return true` and the deprecated `isInScope`. Fix the four SYSTEM_CONTEXT/token sites (spec §8): meeting-flow precursor **read**-probe, contracts age-capture reclassified `{kind:'system', reason}`, proposal-views token actor, DAL-wide `?? undefined` deny-safety. Cut `canSeeUngatedPhone` to take `Actor` (spec §9 — signature only; the `CASE` masking logic is unchanged).
  - **Plan:** _(JIT)_
  - **AC:** the four vulns closed & greppable; `canSeeUngatedPhone(actor)` typed; no `isInScope`/`!ctx.session→true` left; tsc+lint green.

- [ ] **Phase 5 · AFK · blocked-by: Phase 1–4 — Delete dead code + finish the omni collapse.**
  Delete `resolveEffectiveScope`, `bridgeToParent`, `isInScope`, `SYSTEM_CONTEXT` (→ `{kind:'system', reason}`); remove the omni branch from **all three** collapse sites — `resolveVisibilityScope` (`scope-middleware.ts:26`), `buildUserContext` (`helpers.ts:71`), `shareableMiddleware` (`shareable-middleware.ts:64`). Omni becomes emergent (`manage all` → empty-AND → null).
  - **Plan:** _(JIT)_
  - **AC:** the old engine + `SYSTEM_CONTEXT` gone; omni special-cased in zero files; `git grep SYSTEM_CONTEXT` clean; tsc+lint green.

## Dependency graph

```
Phase 0 (engine, unwired)
  └─→ Phase 1 (per-entity atomic cutover)  ──┬─→ Phase 2 (project ruling)   [after Project cutover]
                                             ├─→ Phase 3 (children)
                                             └─→ Phase 4 (point-probe/vulns) [also needs Phase 3]
                                                    └─→ Phase 5 (delete + omni collapse)
```

## Tracking

- **This doc** is the tracker (roadmap + status + plan pointers). Kept in-repo, not on GitHub. Check a phase's box when its plan lands green; fill in its **Plan:** pointer when written JIT.
- **Per-phase executable plans** live in `docs/superpowers/plans/2026-08-10-casl-phase-N-*.md`, written just-in-time.
- **ADR + DOCS updates** (ADR-0002 amendment for the compiled-scope model; `src/trpc/DOCS.md` scope-middleware section; per-entity `DOCS.md` row-rule notes) land with **Phase 5**, when the code matches — never before.
- `memory/project-permissions-casl-compiler.md` + `MEMORY.md` carry the pointer under Active Backlog.

## Open risks / to-verify at implementation

- **Phase 1 — CASL custom-operator parser API against `@casl/ability@6.8.0`.** `buildMongoQueryMatcher` is **not** a top-level export in this version (verified); the custom `$participatesViaMeeting` / `$hasNoMeeting` parsing seam must be built via the ucast `MongoQueryParser` + custom parsing instructions (or a thin wrapper) and confirmed to make `rulesToAST` emit the custom node. This is the single load-bearing integration unknown; Phase 0 sidesteps it entirely (hand-built nodes), Phase 1 must resolve it first.
- **Phase 1 — equivalence gate is manual.** With no test runner, "compiled == pre-change fragment" is an `EXPLAIN`-diff done by hand per role × entity. Budget for it; record evidence in the plan.
- **Phase 3 — the `via:'meetingId'` topology** correlates on `proposals.meeting_id` (the subject's own FK column), not `ctx.pk` — the operator body special-cases it (spec §4.2 honesty note). Confirm the emitted correlation under `EXPLAIN` when Proposal children cut over.
- **Phase 4 — meeting-flow precursor uses a `read` probe, not `create`** (spec §6 ⚠️). A `create` probe would deny every legitimate profile upsert. This closure is **contingent on Phase 1** having authored the `read Customer` condition — until then the probe is allow-all.
