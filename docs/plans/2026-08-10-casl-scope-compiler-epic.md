# CASL Permissions Epic (#285) — tracker

> This is the **roadmap + status + ledgers**. It does not restate designs. The *structure* (types, names, layers, where each mistake is caught, the order of work) is `docs/superpowers/specs/2026-10-05-permissions-structure-design.md`, approved 2026-10-05. The *reasoning* behind every decision is the log in `docs/plans/2026-09-07-casl-re-grounding/README.md` §L (L1–L15); the *evidence* is reports `01`–`24` beside it.
> **START HERE:** `docs/plans/2026-09-07-casl-re-grounding/DISTILLED-2026-10-01.md` — one page: decisions, business rules, security holes, next steps.
> **Editing rule (the anti-derailment rule):** a supersession EDITS the superseded text in place. No "read me first / supersedes below" banners. Dated summaries of what changed go to Appendix A.
> **Precedence when documents disagree:** the code → the structure spec → §2 of this tracker → README §L → reports.
> **Reading the reports:** reports `01`–`24` and README §A–§K describe the earlier attempt's code at `b40403b6`, which is not in the tree. Their paths and line numbers are history; each unit's plan re-verifies a finding against the tree before relying on it.

---

## 0. Status at a glance (2026-10-05)

| Fact | Value |
|---|---|
| Branch / worktree | `refactor/285-refactor-permissions-casl-scope-compiler`, `.worktrees/issue-285` — the long-lived home of the WHOLE epic (no per-phase PRs; one merge at Phase 9). On origin since 2026-10-05 |
| vs `main` | **0 behind**: main merged in again at the unit 1 boundary (`2818bf06`, 2026-10-05, no conflicts). Supersede merge `2b038591` (2026-10-05): tree = main `61d3e1e2` + the permissions docs. The dry-run merge had grown to 44 conflicted paths at 581 behind, and main had rewritten `create-crud-dal.ts`, `dal/server/types.ts` and `create-crud-router.ts` under the branch's seam, so main's tree was taken whole. The 76 branch commits stay ancestors (`b40403b6` = last code tip) |
| What the tree runs | Unit 1's typed foundation is in the tree and enforces nothing yet. Enforcement is main's legacy engine everywhere: `ScopedContext { session, ability, scope }`, `SYSTEM_CONTEXT`, `spec.visibility` + `resolveEffectiveScope` + `resolveVisibilityScope`, `shareableMiddleware` (token ⇒ `ability: null`), conditionless CASL rules. No file under `src/shared/domains/permissions/scope/` exists in the tree |
| `pnpm tsc` / `pnpm lint` | PASS / PASS — run 2026-10-05 on `2818bf06`, the unit 1 boundary merge (the two formatting errors in `globals.css` left with that merge) |
| Structure spec | `docs/superpowers/specs/2026-10-05-permissions-structure-design.md` — approved by the owner 2026-10-05 (six sections in chat, then the written form). Unit 1 landed 2026-10-05. Next: the plan for unit 2 |
| Keep-primitives | restored from `b40403b6` per unit (spec §6.6; report 19 §1: adapter core A5–A12, A16–A19, operators A20/A22, `SystemReason`, `MEETING_OUTCOME_CLASS` derivations, set-based media mutations) |
| Session lineage | `32493656` (08-10→08-19) → `63bbad6e` (08-19→09-07) → `e0066a5c` (09-07→09-09) → `a078cbb8` (09-09→10-01: verification, grill L12/L13, reports 17–24, distill) → `5ed2f09c` (10-05: docs banked, supersede merge) |
| GitHub | #285 still titled/bodied as "Phase 0" (G4). Open, unlinked: **#210 (P0)** agent-scoped leak (live residual = E1-5), #218 owner-delete (→ 7.4), #220 participant-role model + #217 role enum (→ 7.4 Meeting rows), #226 activities → Entity Server System (→ 7.4 D4) |

### 0.1 Phase ledger

Phases 0–6 below landed on the branch and are history: their code left the tree with the supersede merge and is read from `b40403b6`.

| Phase | Status | Landed as | Notes |
|---|---|---|---|
| 0 engine + Actor scaffolding | ✅ 2026-08-11 | `d28d8137`…`e3186a28` | additive, unwired; EXPLAIN-parity with `userCanSeeCustomer` / `leadsPoolVisibility` |
| 1 per-entity root cutover (Customer, Meeting, Proposal, Project) | ✅ 2026-08-12 | `88e6ff2b`…`e2a8fd12` | 4 roots' `procedures.ts` compile `read` from CASL via `resolveTrpcActorScope`; parser wiring; `assertScopeWiring` |
| 2 project drift ruling | ✅ folded into 1 | `e2a8fd12` | `participation OR ownerId=me`; `isPublic` = display filter only |
| 3 robustness gate | ✅ 2026-08-18 | `dbb9206c` | `parent.fk` mis-wire guardrail; bridge + principals EXPLAIN-proven |
| 4 actor-seam hardening (§8 drivers) | ✅ 2026-08-18 | `4b352564`…`ac614fcb` | `canAccess` point-probes, `systemContext(reason)`, `requireResolvedScope` at 26 sites, share-token → `tokenActor` |
| 5 customer-pipelines on `ctx.actor` | ✅ 2026-08-19 | `d6302917`…`3390aaff` | `actor` on `ScopedContext`; outcome-derived 5-bucket pipeline; single-bucket list; phone gate on actor |
| A dead-code delete | ✅ 2026-08-20 | `a8ec6c3f`, `21758862` | 9 orphan `*Visibility` fns + `scopeMiddleware`; dispatcher widened to rehash+dead |
| 6 owned sub-entities + homeowner precedence | ✅ 2026-08-24→09-03 | `4b705e81`, `c215c3d2`, `59676416`, `f286b3c6`, `07442fb8`, `ac8efe45`, `6c565a66` | `parent` on customer-notes/applications/media-files/proposal-media; media routers on CASL + `canAccess`; agent-first shareable precedence |
| dispatcher corrections | ✅ 2026-09-04→06 | `c62813d5`, `ad71a076`, `5fec560b`, `5a983124` | financial gate (defensive — Grill-D residual), fresh-wide + all-meetings, notes + discovery profile, note-create `canAccess` probe |
| **7 CASL-native plumbing** | 🔄 re-oriented 09-06, re-grounded 09-07, grilled 09-08/09, L12/L13 09-13, oriented 09-16 | — | **No code under the re-oriented definition yet.** Units in §4. The two router-seam commits (`3e901178`, `b40403b6`) left the tree with the supersede merge |
| 8 delete legacy engine | ⏳ blocked-by: all of Phase 7 | — | §4 |
| 9 pre-merge E2E gate + single merge | ⏳ | — | §4 |
| ~~7.5~~ | **deleted** as a phase 2026-09-06 | — | action-awareness + own-record conditions + field-level are ONE design inside Phase 7 (7.3/7.4) |

### 0.2 Which engine runs today

Every scoped entity runs main's legacy engine (see §0 "What the tree runs"). The per-entity CASL/legacy split that this section used to tabulate described `b40403b6`. The per-entity survey of main is taken in the 7.3 plan, against the tree.

### 0.3 Open user decisions

| # | Decision | Default / recommendation | Needed before |
|---|---|---|---|
| **Q11** | Restoring the outcome-derived pipeline map (`db87d28d`) flips prod `not_good`/`ftd` from `rehash` to `dead` (matches the 2026-08-19 ruling; the tree carries main's map) | restore it | unit 3, Customer family |
| **Q12** | Share-link READ surface: (i) the homeowner's OWN phone needs an explicit grant on the bearer `read` rule once the bearer is a rule set; (ii) server-side masking of cost data and agent-internal columns (deferred by the owner 2026-09-13); (iii) public project reads under an anonymous allow-nothing ability | grant `phone` on the bearer read rule; rule the rest with unit 4 | unit 3, Proposal family |
| **M-R1 / M-R2** | **R1** `recordView`: main's `proposalService.views.record(SYSTEM_CONTEXT)` vs the bearer recording a view on its own row through the `views` field; **R2** the proposal-media service's `assertParentVisible` calls the legacy `isVisible` | R1: keep the service shape, drive it from the bearer context; R2: replace with `permit(...).probe` | unit 3, Proposal family |
| **Q8** | The 25 business rulings in report 10 §5 (⭐ #1–6, #8 first: Meeting update/delete conditions, dispatcher Meeting update, Project read/update, create-side parent requirements, …), plus how `own Meeting` and `assign` map onto the model (report 22 §3.3) | each row carries a default | unit 4; Meeting rows also wait on #217/#220 |
| **J6** | Shape of the lint wall | ESLint rule + allowlist | unit 5 |
| **Q9** | Which documents describing the legacy engine are rewritten and which deleted (`docs/permissions/visibility-rules-catalog.md` Parts 3–4, `src/trpc/DOCS.md`, per-entity `DOCS.md` visibility sections, ADR-0002) | decide at unit 6, against what still cites them | unit 6 |
| **E2E data** | Which dev records the browser tests may change (standing rule: no data written for testing) | owner names the records | unit 7; earlier for a family whose turnover needs an allowed-change check |

---

## 1. Why this epic exists

Authorization was split across two hand-maintained artifacts that drift: **CASL** owned the verb (conditionless), **hand-written `EntityServerSpec.visibility` fns** owned the row predicate. That split produced the project `isPublic` drift, the un-expressible manager role, the `LeadsPool` magic flag, the `null`-scope overload leaks, and — on the write side — per-action/own-record rules living in imperative hooks hand-triplicated to the client.

**Thesis (unchanged since 2026-08-10):** CASL rules are the single source of truth for authorization on **server, database, and client**. The row predicate is *compiled* from the rules (`rulesToAST` → ucast AST → Drizzle `where()`), the way `@casl/prisma`'s `accessibleBy` does; the same rules ship to the client so UI gating cannot drift from enforcement.

---

## 2. Current design (LOCKED decisions — the single table; superseded rulings are listed as superseded, not deleted)

Full reasoning per row: README §L. Library/framework facts verified 2026-09-09 against Context7 + installed packages (reports 14, 15).

### 2.1 Decision table

| # | Decision | Ruled | Status | Source |
|---|---|---|---|---|
| D-01 | CASL rules = sole permission source; row predicate COMPILED from rules; **our adapter (`compileScope` + `interpret`, rulesToAST → structural AST → Drizzle) is canonical and STRICTER than the reference** — keep it, do not add `@ucast/sql` or a direct `@ucast/core` dep | 08-10 / re-verified 09-07 | LOCKED | spec §1; README §C, C12; 02 §F |
| D-02 | **Migration invariant:** predicate lives outside CASL today → risk is false-ALLOW; conditions **replace** a conditionless verb (CASL OR-merges), never sit beside it; no behaviour-neutral engine-only phase | 08-10 | LOCKED | spec §4.1 |
| D-03 | Meeting / Proposal / Project are **peer roots** (own `$participatesViaMeeting{via}`); the parent bridge is only for true sub-entities | 08-11 | LOCKED | README memory; spec §2 |
| D-04 | Project row rule = `participation OR ownerId=me`; `isPublic` is display-only | 08-11 | LOCKED (Q8 #8 confirms vs projects/DOCS.md) | Phase 2 |
| D-05 | Dispatcher Customer scope = operational pipeline `$inDerivedPipeline:['leads','rehash','dead','fresh']`, all meetings, notes + discovery profile; proposals/projects walled | 08-11 → widened 08-20, 09-04 | LOCKED | `ad71a076`, `5fec560b` |
| D-06 | Pipeline is DERIVED from meeting outcomes (`MEETING_OUTCOME_CLASS` single SoT; `not_good`/`ftd` terminal → dead) | 08-19 | LOCKED (Q11 = prod confirmation at merge) | Phase 5; memory `project-pipelines-domain-rethink` |
| D-07 | Client-supplied id → point-probe → `NOT_FOUND` (no existence leak); server-derived id → system rule with a reason; lists stay scope-threaded | 08-18 | LOCKED | actor-seam conventions |
| D-08 | **A sub-entity is a field of its parent's CASL subject.** The child spec declares `parent { spec, fk, collection }` and no subject; child read ⇒ parent `read`, child create/update/delete ⇒ parent `update` on the collection; grandchildren are dotted paths; `collection` is an explicit name. `CustomerNote` is the one child with its own subject (own-row rule). A parent `update` rule without a field list covers every collection | 08-10 → 09-09 → ratified 10-05 | LOCKED | **L9, L13**; 17; 22; 24 §4.2 |
| D-09 | **The `user|token|system` Actor union is DROPPED.** `Actor` = plain `{ ability: AppAbility; userId: string \| null }`; `ScopedContext = { actor, tx? }`; tRPC ctx `{ session, actor, req?, resHeaders? }` satisfies it structurally | 09-08/09 | LOCKED | **L1, L7**; 15 §4 (`resHeaders` optional) |
| D-10 | Truthfulness check = `session` (never `userId`); no session → only an entity's `<entity>ShareableProcedure` may admit a bearer after validating its token | 09-08 | LOCKED | **L2** |
| D-11 | Token bearer = anonymous principal with a **per-row ability** built after token validation (`bearerContext(spec, token)`): `can('read','Proposal',{id})`, `can('update','Proposal',['financeOptionId','cashInDealCents','views'],{id})` — `views` is a collection FIELD of Proposal, there is NO `ProposalView` subject (L12 rejected it → L13); the reconciled `envelopeDocumentIds` and the customer `age` writes in `applyEnvelopeContext` run as the derived system write; the `homeowner` role's conditionless `read Proposal` is deleted in the same change | 09-08 → 09-13 | LOCKED (**L12**) | **L3, L12** |
| D-12 | Compute the actor **once per route**: one `cache()`'d `getRequestActor()` shared by tRPC `createContext`, RSC guards/layouts/prefetch, and `route.ts`; middlewares only narrow | 09-08 | LOCKED (verified: tRPC 11.9, Next 15.5, React 19.2 — 15 §2) | **L4**; handoff 13 |
| D-13 | tRPC ladder = `base{session\|null, actor}` → `protected{session, actor}` → `agent` (`access Dashboard`) → `superAdmin` (`manage all`) + `<entity>ShareableProcedure`. Per-entity scope procedures, `systemProcedure`, `ctx.scope`, and a separate `ctx.ability` are **deleted** | 09-08 | LOCKED | **L5** |
| D-14 | User ids are **baked into rule conditions** at build time; `Actor.userId` exists only for data stamping; `OperatorCtx` shrinks to `{ table, pk }`; `systemAbility(reason) = can('manage','all').because(reason)` typed by `SystemReason` — reason read via `ability.relevantRuleFor(...)?.reason` (NOT `ForbiddenError`, which only reports inverted rules) | 09-09 | LOCKED (mechanism corrected 09-09) | **L7**; 14 §1.8 |
| D-15 | **Mutation WHERE = `toWhere(action) AND toWhere('read')`**, permanently (update, delete, duplicate's source read) | 09-09 | LOCKED | **L8**; 11 §3 |
| D-16 | DAL **self-scopes per slot** off `ctx.actor.ability` (getById→read, update→update, delete→delete, create→parent probe / verb) — ONE resolution point for tRPC, services, jobs, webhooks. `ctx.scope` retires | 09-06 | LOCKED — **supersedes** D-S1 | README §C2, C4 |
| D-17 | Field-level check after the row is loaded: each changed column must pass `can('update', row, column)` — for a sub-entity, on the parent row as `field.column`. Retires `assertCanUpdateFields`; runs on the share-link path too. A miss answers forbidden, naming the column | 09-06 → 10-05 | LOCKED — **supersedes** D-S4 | README §C6; spec §6.3–§6.4 |
| D-18 | UI reads the **same ability**: server ships `packRules(actor.ability.rules)` from the RSC that resolved the actor; a single `'use client'` wrapper hydrates `createMongoAbility(unpackRules(rules), { conditionsMatcher })` with the shared matcher module; `@casl/react` 7.0.1 (`AbilityProvider value=`, `useAbility<AppAbility>()`, `<Can>`); row-specific checks via `subject(type,row)` on both sides; the four client-side ability rebuilds and the three hand-written copies of server rules are deleted | 09-09 | LOCKED (rules sent from the root layout, L15) | **L10**; 12; 14 §1.1 |
| D-19 | **Operator guard:** custom document operators may appear only on `read` rules without `fields`; never with `fields`, never on `create/update/delete`; no client *instance* `read` checks on operator-bearing subjects (or register JS interpreters in the shared module — the escape hatch). Enforced by the types of `defineRules` (D-26) | 09-09 | LOCKED | **L10**; 14 §1.9 |
| D-20 | Stay on `@casl/ability` **6.8.0** (7.0.1 is a breaking major); add `@casl/react` 7.0.1 (peer range accepts 6.8.0). Typing comes from the specs through `defineRules` (D-26), not from CASL's builder. Author `cannot` rules LAST per action/subject (6.8.0 `rulesToAST` ANDs conditioned `cannot`s regardless of order); `conditions: {}` counts as conditionless in audits | 09-09 | LOCKED | 14 §1.5, §1.10, §3 |
| D-21 | Verification = `pnpm tsc && pnpm lint` every unit, the wrong-on-purpose type file under `pnpm tsc`, the startup checks on the rules, and browser end-to-end tests per role. No test runner, no unit tests in the library, no SQL parity script | 08-10 → 10-05 | LOCKED | **L15**; spec §10 |
| D-22 | Worktree = the whole epic; merge to main ONCE after the Phase-9 E2E pass; **merge main → branch at every phase boundary** (H4); merge main FIRST before any Phase-7 code (H1) | 08-11 / 09-07 | LOCKED | README §H |
| D-23 | `agentProcedure` → `staffProcedure` is a rename (not a shim), LAST; `superAdminProcedure` re-parents to it; interim gate stays `can('access','Dashboard')` | 08-18 | LOCKED | Appendix A 08-18 |
| D-24 | Wall: cross-entity code calls the owning DAL; a lint guard forbids separate-query `db.select().from(<scoped table>)` / `db.query.<scopedTable>` outside the owning entity's or module's `dal/` (allowlist: the compiler's operator SQL bodies) | 08-20 / shape J6 | LOCKED (shape open) | Grill B #5; README §E2 |
| D-25 | Manager role = designed-for, NOT authored until hired (conditionless `read` on the 4 roots + children); do not flag its absence as staleness | 08-10 / Q8 #20 | LOCKED | memory |
| D-26 | **The specs are the single typed source.** Spec constructors capture literal types; one type-only union of the specs types rule fields (columns + collection paths), conditions (declared condition columns only), operator placement and subject binding, and the client's field checks. Rules are authored through a thin typed `can`/`cannot` wrapper that emits stock CASL rules. A checked-in file of wrong-on-purpose lines is verified by `pnpm tsc`. Field existence, D-19 and operator subject binding are compile errors, not boot asserts | 10-05 | LOCKED | **L14, L15**; spec §4–§5 |

### 2.2 Superseded rulings (kept so nobody reads them back in)

| # | Old ruling | Superseded by | When |
|---|---|---|---|
| D-S1 | "The CRUD factory is permission-agnostic — MUST NOT read `ctx.actor`; it consumes a pre-resolved `ctx.scope`" (Phase-5 plan L18, old tracker L101, `types.ts:39-45`) | D-16 (Grill B decided it 08-20 verbally; never retracted in writing → caused the router-seam drift) | 09-06 |
| D-S2 | `tokenActor` = scope + subject, **no ability**; verb boundary = the endpoint | D-11 (bearer has a real per-row ability) | 09-08 |
| D-S3 | `Actor = user \| token \| system` tagged union; engine branches on `kind` | D-09 | 09-08 |
| D-S4 | `permittedFieldsOf` YAGNI'd; "row-scope only" (Grill B #1) | D-17 (row-scope-only still true for the *dispatcher-proposals* requirement; field-level is needed for the bearer + `assertCanUpdateFields` retirement) | 09-06 |
| D-S5 | Phase 7 = router seam `resolveScope: resolveTrpcActorScope` on `createCrudRouter`, Track B (reads) / Track C (action-aware) split, Phase 7.5 after Phase 8, 7a–7h ordering | D-16 + §4 unit order; Phase 7.5 deleted; commits `3e901178`/`b40403b6` reverted in 7.0 | 09-06 |
| D-S6 | Per-entity `<entity>Procedure`s stamp `ctx.scope`; `systemProcedure`; `requireResolvedScope` deny-safety helper on `ctx.scope` (`null` = omni, `undefined` = throw) | D-13 / D-16 (the three-way `null` disappears with `ctx.scope`) | 09-08 |
| D-S7 | `SystemReason` on a wrapper `systemActor(reason)`; `SYSTEM_CONTEXT` → `systemActor` classification per site | D-14 (`systemContext(reason)` builds `{ actor: { ability: systemAbility(reason), userId: null } }`; classification per site still required — F3) | 09-09 |
| D-S8 | "Phase 7 is a mechanical propagation sweep" | Structural finding 08-20 + D-16/D-17: Phase 7 carries the real design | 08-20 |
| D-S9 | Client rebuilds the ability from the session (`casl-provider.tsx`, `app-sidebar.tsx:74`) | D-18 | 09-09 |
| D-S10 | "`hasMounted` guards hide a deny-all first paint on the dashboard" | false premise — the only such guards are on the proposal-flow navbar; they go only when the proposal page RSC ships rules too (15 §4) | 09-09 |
| D-S11 | "The repo has NO test runner — don't add vitest/scripts" (08-11), reopened 09-07 as J7 | **confirmed** 2026-10-05: no runner, no unit tests in the library (D-21, L15) | 10-05 |
| D-S12 | Report 24's names and mechanisms: `defineRootSpec` / `defineChildSpec`, `collection`, `bearerActor(spec, rowId)`; boot asserts for field existence, operator placement and operator subject binding; a pure connection-free `core/` with an import lint; vitest for the compiler | D-26 + L15: `defineEntitySpec` / `defineSubEntitySpec`, `field`, `bearerContext(spec, token)`; compile errors; the compiler in the DAL library; no runner | 10-05 |
| D-S13 | EXPLAIN-parity gate and a rerunnable SQL parity script per role × entity × action (D-21 as written 09-07; README §I1) | D-21 as edited: browser checks per role | 10-05 |
| D-S14 | Typing rule conditions through CASL's builder with `AppQuery<T>` + the hkt brand (report 14 §1.10 V6) | D-26: the specs are the typed source; `defineRules` | 10-05 |
| D-S15 | A literal merge of main into the branch (reports 16 and 21, the 2026-09-13 sync plan, unit 7.1 as planned) | supersede merge `2b038591` | 10-05 |

### 2.3 Target shapes

The structure spec is normative: `docs/superpowers/specs/2026-10-05-permissions-structure-design.md` §4–§8.

### 2.4 Invariants every unit must hold

1. D-02 (false-ALLOW risk; conditions replace, never beside). Audit per action: no conditionless `can(action, X)` survives beside a conditioned one; `{}` = conditionless.
2. D-15: a row you cannot read cannot be mutated.
3. D-10: session is the truth; bearer only inside `<entity>ShareableProcedure`; agent-first precedence (a session wins over a URL token).
4. D-07: client id → probe → `NOT_FOUND`; server-derived id → system rule with reason; never `scope: null` / `?? undefined` omni-by-construction.
5. D-19: operators only on field-less `read` rules (a compile error otherwise); an operator's SQL body references tables, never a spec or `permit`; SQL bodies are `server-only`.
6. One `defineAbilitiesFor` call per request (inside `getRequestActor`), plus `bearerContext` and `systemContext`; nothing below `createContext` rebuilds.
7. `@casl/ability` pinned at 6.8.0 until the epic merges (D-20).
8. Every turnover of an entity family from the legacy engine to compiled rules is checked in the browser per role, and the result is recorded in the unit's plan (D-21).

---

## 3. Verification model

- Per unit: `pnpm tsc && pnpm lint` green (never `pnpm build`).
- The wrong-on-purpose type file (spec §10) and the three startup checks on the rules (spec §5.6).
- Browser end-to-end tests per role through `/api/dev/playwright-session`: per entity family at its turnover (unit 3), and the full pass at unit 7.
- No test runner, no unit tests in the library, no SQL parity script (L15).
- Behaviour-changing turnovers (dispatcher reach, the bearer allowlist, the rules-matrix rulings) are intended and named in the unit's plan. Everything else keeps today's behaviour, or the plan says why not.

---

## 4. Roadmap

The units and their order are the structure spec's §11. Each unit gets a plan written against the tree (`docs/superpowers/plans/YYYY-MM-DD-permissions-unit-N-<name>.md`), approved by the owner before any code. Legend: `AFK` = executable without live rulings · `HITL` = needs a ruling mid-unit.

**History.** Phases 0–6 of the earlier attempt landed on the branch between 2026-08-11 and 2026-09-06 (§0.1). Their code is read from `b40403b6`. What returns from it, and into which unit: spec §6.6 and report 19 §1.

- [ ] **P0 · Security holes on main · AFK · independent of the epic.** Through the hotfix path, on the owner's go. The list is §5.1.

- [x] **Sync · DONE 2026-10-05 (`2b038591`).** Supersede merge: main's tree taken whole, the permissions docs kept, the earlier attempt's code left to history at `b40403b6`.

- [x] **Unit 1 · Typed foundation · DONE 2026-10-05.** (spec §4, §5.1–§5.4, §10) `defineEntitySpec` / `defineSubEntitySpec`; the 19 specs converted, with today's readers of `caslSubject` moved to the new shape in the same change; the type-only list of specs and the types derived from it; `defineRules`; operator declarations; the wrong-on-purpose file. Today's rules and enforcement are untouched.
  - **Landed as:** fb7e6a39 (constructors, 19 specs, `ServerSpec`), 55f1537e (type-only list), 2ed3d7b4 and e84c07f0 (`defineRules`, operators), 269d5c61 (fixes from the whole-unit review: an absent or empty conditions argument, a widened sub-entity field name, a duplicate subject), 4b0a6c28 (the entity recipes).
  - **AC:** tsc + lint green; no behaviour change; every "compile" row of spec §9 whose types land in this unit has a line in `type-checks/must-not-compile.ts` (the two client-check rows land in unit 2).

- [ ] **Unit 2 · One actor per request · AFK · blocked-by: unit 1.** (spec §7, §8) `Actor`; the cached `getRequestActor()` shared by tRPC's context, server components, layout guards and route handlers; the ladder only narrows; `systemProcedure` deleted; the `@casl/react` 7.0.1 provider fed from the root layout, so the four client-side rebuilds go. The legacy engine still enforces (`ctx.scope` stays until unit 3). Starting inventory: `docs/plans/2026-09-07-casl-re-grounding/13-handoff-trpc-context-unification.md`, re-derived against the tree.
  - **Carried from unit 1's review:** derive `AppSubject`, `AppAction` and `AppAbility` from `EntitySubject` plus ONE map of the non-entity subjects, moved out of `rules/define-rules.ts`, and type `PermissionRule` as `RawRuleOf<AppAbility>` (today it needs a cast to feed the app's ability). Before `Actor.userId: string | null` exists, make a condition value that MAY be `null` a compile error (the literal `null` stays legal): six of the seven condition columns are nullable user ids.
  - **New from main at the unit 1 merge:** `rolesWithAbility` (`src/shared/domains/permissions/lib/roles-with-ability.ts`; used by `entities/meetings/constants/internal-user-roles.ts`) calls `defineAbilitiesFor({ id: '', role })` per role when the module loads. It is a third caller the AC below must account for.
  - **AC:** `defineAbilitiesFor` is called inside `getRequestActor` and the legacy shareable token branch only; the client never calls it; tsc + lint green.

- [ ] **Unit 3 · Compiler and DAL self-scoping · HITL per family · blocked-by: unit 2.** (spec §6, §7) One entity family at a time: Customer → Meeting → Proposal → Project → the rest. Restores from `b40403b6` the AST types, the interpreter, the operator registry and the two operator SQL bodies. Adds `permit`, `bearerContext`, `systemContext(reason)`; `createCrudDal` scopes itself in every slot; `createCrudRouter` becomes wiring. Per family, in ONE change: its rules gain their conditions, its DAL turns on compiled filters, its `SYSTEM_CONTEXT` / `{ ...ctx, scope: null }` / `ctx.scope ?? undefined` sites are classified, and the family is checked in the browser per role (D-02, invariant 8).
  - **Carried from unit 1's review:** `permit`'s `spec` parameter is typed as a member of `ServerSpecs`, so a spec missing from the list cannot be enforced at all (today a forgotten list entry is silent until someone writes a rule for it). Decide which actions may carry a field list and narrow `defineRules` to match (spec §12). A startup check walks every rule's conditions through the interpreter's shape validation, so an unknown key nested inside a condition value fails at boot, not on a request. The interpreter compiles `null` to `IS NULL` and an empty `$in` to false, as CASL's matcher does on the client. Add must-not-compile lines for a nested sub-entity path once a real one exists.
  - **Customer family:** restore the outcome-derived pipeline (`db87d28d`: `MEETING_OUTCOME_CLASS`, `outcome-pipeline-map.ts`, `derived-pipeline-sql.ts`) — **Q11** first.
  - **Proposal family:** bearer rules and the proposal shareable procedure; the `homeowner` role's bare `read Proposal` deleted in the same change (D-11); **Q12** phone grant; **M-R1 / M-R2**.
  - **Project family:** the project-only media mutations stay on the project media unit (`src/shared/modules/projects/media/dal/server/mutations.ts`; create and delete are `createCrudDal` hooks in its `crud.ts`). The set-based scoped update and the bounded unset from `59676416` are applied there, not on the shared media module.
  - **AC:** after the last family, `git grep` for `ctx.scope`, `SYSTEM_CONTEXT`, `resolveVisibilityScope`, `scopeMiddleware`, `systemProcedure` = 0 in `src/`; every CRUD slot self-scopes; the share-link path goes through verb, field and row checks; browser evidence recorded per family; tsc + lint green.

- [ ] **Unit 4 · Rules matrix · HITL first (Q8), then AFK · blocked-by: unit 3; Meeting rows also on #217/#220.** The 25 rulings of report 10 §5 become the rules; own-row rules retire the imperative gates (Ledger 2, §5.3); `own Meeting` and `assign` mapped; the three hand-written client copies deleted.
  - **AC:** rulings recorded as the rules; no bare mutation rule beside a conditioned one; Ledger 2 empty; tsc + lint green.

- [ ] **Unit 5 · Lint wall and financial reads · AFK after J6 · blocked-by: unit 3.** A lint rule forbidding raw queries on scoped tables outside the DAL; the Ledger-1 financial sites (§5.2) read through the owning DALs.
  - **AC:** the rule is green with a written allowlist; Ledger 1 empty.

- [ ] **Unit 6 · Delete the legacy engine · AFK · blocked-by: units 3–5.** `resolveEffectiveScope` / `bridgeToParent` / `isVisible` / `isInScope` / `resolveVisibilityScope` / `scope-middleware.ts` / every `spec.visibility` and the field on the type; the `agentProcedure → staffProcedure` rename (D-23); the documents that describe the legacy engine rewritten or deleted (Q9).
  - **AC:** `git grep` for every legacy name = 0; the retiring-seams register (§5.4) empty; tsc + lint green.

- [ ] **Unit 7 · Full browser pass, then the single merge · HITL.** Roles × entity families × actions; allowed too much and allowed too little; the share link; the dispatcher wall. Needs the owner's ruling on which dev records the tests may change. Then merge main once more and open ONE PR `Closes #285` (+ #210 / #218 / #220 / #217 / #226 as applicable).

---

## 5. Ledgers (living — edit rows, do not append duplicates)

### 5.1 Security holes in the tree (verified against the code 2026-10-05)

Found by a read-only pass over the whole tree. Rows marked ● were then re-read line by line; rows marked ○ are as that pass reported them. Every row is independent of the epic and can go through the hotfix path; the last column is where the epic closes it structurally. The fixes the earlier attempt made for several of these (Phases 4 and 6, the 2026-08-18 census) existed only at `b40403b6`. None is in the tree, and none was ever on main.

| # | Who can do it | Site | What | Epic unit |
|---|---|---|---|---|
| S1 ● | anyone, no login | `src/trpc/routers/ai.router/index.ts:7-22` → `services/providers/ai/client.ts:98-116` | starts an OpenAI call on caller-supplied text and writes the output into any proposal's `projectJSON` | 3 (Proposal) |
| S2 ● | share-link holder | `src/trpc/lib/create-crud-router.ts:50-51,89-91` + `db/schema/proposals.ts:119-141` | generic `proposals.crud.update` with a token: any column the update schema accepts — `status`, `ownerId`, `token`, `meetingId`, the price columns, `projectJSON`, contract timestamps and ids, `envelopeDocumentIds`. The lock ladder (`modules/proposals/core/dal/server/crud.ts:48-62`) covers content columns only, and only once an envelope exists | 3 (Proposal) |
| S3 ○ | share-link holder | `modules/proposals/core/dal/server/queries.ts:78-139`; generic `getById` | reads every proposal column, including cost lines inside `projectJSON`, internal ids, and the customer's contact data. Masking was deferred by the owner 2026-09-13 | Q12 |
| S4 ● | agent or dispatcher | `src/trpc/routers/projects.router/crud.router.ts:13-57` | reads, edits and deletes any project (`scope: null`, no verb check); `update` can set `isPublic` | 3 (Project) |
| S5 ● | agent or dispatcher | `src/trpc/routers/projects.router/media.router.ts:14-131`; `db/schema/project-media-files.ts:34-50`; `modules/media/core/lib/purge.ts:23-29` | uploads, edits and deletes media on any project. `create` takes a caller-supplied `bucket` and `pathKey`, and deleting the row deletes that object: any stored object the app's storage credentials reach can be deleted | 3 (Project) |
| S6 ● | agent or dispatcher | `src/trpc/routers/customer-pipelines.router.ts:65-88` | a one-hour download link for any customer's lead call recording, by customer id | 3 (Customer) |
| S7 ● | agent or dispatcher | `src/trpc/routers/customer-pipelines.router.ts:115-131` | marks any meeting converted and links it to any project (`scope: null`; neither side reach-checked) | 3 (Meeting) |
| S8 ● | agent or dispatcher | `src/trpc/routers/proposals.router/delivery.router.ts:37-55` | sends a company-branded proposal email to any address, with a caller-chosen link token and message, before the proposal's reach is checked | 3 (Proposal) |
| S9 ● | agent or dispatcher | `src/trpc/routers/schedule.router/activities.router.ts:18-32,117-131` | reads any activity and marks any activity complete by id. `update` and `delete` answer forbidden vs not found, revealing which ids exist | 4 (own-row rule; #226) |
| S10 ● | agent | `src/trpc/routers/meetings.router/crud.router.ts`; `db/schema/meetings.ts:64-75`; `entities/meetings/dal/server/crud.ts:27-45` | creates a meeting on any customer id and becomes its participant, which makes that customer visible: profile, notes, and every proposal on it. `update` accepts `customerId` and `projectId` the same way ○ | 3 (Meeting) |
| S11 ● | agent | `src/trpc/routers/meeting-flow.router.ts:26-52` (`SYSTEM_CONTEXT`); `entities/customers/dal/server/mutations.ts:36-45` | overwrites any customer's discovery profile by id; publishes on any meeting's realtime channel | 3 (Customer) |
| S12 ○ | agent | `entities/customers/dal/server/get-customer-profile.ts`; `pipeline-items.ts:296,475` | anyone who can see a customer receives every rep's proposals on it, with share tokens and values. With S10 this reaches any customer; with S2 a token is full control of that proposal | 5, Q8 |
| S13 ○ | agent or dispatcher | `src/trpc/routers/projects.router/business.router.ts:18-69` | creates a project on any customer id, owned by the caller, copying that customer's address; the projects pipeline then shows the caller that customer's name, email and address | 3 (Project) |
| S14 ○ | agent or dispatcher | `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts:65-81` | moves the pipeline stage of any customer's project | 3 (Project) |
| S15 ○ | agent | `entities/applications/dal/server/crud.ts:5`; `modules/proposals/core/dal/server/crud.ts:27-40` | creates an application or a proposal on any meeting id; the new proposal's token is returned | 3 (Meeting, Proposal) |
| S16 ○ | agent or dispatcher | `src/trpc/routers/projects.router/google-drive.router.ts:19-74` | imports a Drive file as media onto any project | 3 (Project) |
| S17 ○ | agent or dispatcher | `src/trpc/routers/customer-pipelines.router.ts:91-112`; `pipeline-items.ts:101-105,428` | a customer's projects are listed unscoped after a meeting-level check; the leads pipeline returns every lead's contact data; the projects pipeline returns customer contact data for every public project. Whether agents should see the leads pool is a business ruling | 3, Q8 |
| S18 ○ | agent or dispatcher | `src/trpc/routers/schedule.router/sync.router.ts:37-84` | forces a calendar push of every unsynced meeting (no data returned) | 3 (Meeting) |
| S19 ○ | share-link holder | `modules/proposals/views/service.ts:55-91`; `src/app/api/proposals/[proposalId]/{pdf,summary}/route.ts` | no rate limit on view recording (each call notifies the participants and raises the view count that drives lead ranking); the routes answer 404 vs 401, revealing which proposal ids exist | 3 (Proposal) |
| S20 ○ | anyone, no login | `src/trpc/routers/landing.router/index.tsx:20-86` | the two public landing forms have no rate limit; each sends a confirmation email to the supplied address and creates a customer | not the epic |

**The dispatcher wall.** Nothing asserts `read Proposal` or `read Project` on the raw `agentProcedure` routes. Dispatchers are kept from money today only because they are never meeting participants; S4 and S13 already give them projects.

**Checked and found guarded:** recording a view on another proposal; fetching another proposal's PDF or summary with a token; creating, editing or deleting a customer note without reach or authorship; proposal media (parent visibility is probed); the homeowner's age write (keyed off the token-validated proposal).

**Not reviewed:** webhook routes under `src/app/api/webhooks/**`, the Google Calendar webhook, the dev Playwright session route, and the voip-calls and lead-sources routers beyond their procedure types.

### 5.2 Ledger 1 — reads that return money, gated only by participation (→ unit 5)
`entities/customers/dal/server/get-customer-profile.ts` (every proposal of the customer, with value and token), `pipeline-items.ts:296,475` (token and value per pipeline item), `get-action-queue.ts`, `src/trpc/routers/customer-pipelines.router.ts:91-112`. No rule states that a dispatcher may not read them; they are unreachable for a dispatcher only while dispatchers hold no participant row.

### 5.3 Ledger 2 — permission decided in handlers and hooks (→ the unit named)
| Rule | Where it lives today | Becomes | Unit |
|---|---|---|---|
| Activity is its owner's | `schedule.router/activities.router.ts` — raw `db`, inline owner checks on `update`/`delete`, none on `getById`/`complete` | `{ ownerId }` rules on an Activity entity (#226) | 4 |
| Customer note: author or admin edits | `customer-notes/dal/server/crud.ts:58-72` + `lib/assert-note-author.ts`; client copy `customer-notes/hooks/use-customer-note-action-configs.ts` | `can(['update','delete'], 'CustomerNote', { authorId })` | 4 |
| Customer note: creator must reach the customer | `customer-notes/dal/server/crud.ts:40-53` (`buildUserContext`) | the parent probe in `create` | 3 (Customer) |
| Envelope document choice is staff-only | `proposals.router/contracts.router.ts:143-148` (`ctx.ability == null` as the test) | the bearer's field list | 3 (Proposal) |
| Customer profile edits | `customers.router/profile.router.ts:20`, `meeting-flow.router.ts:33`, client `customers/hooks/use-customer-edit-form.ts:30` (`'CustomerProfile'`) | `update Customer ['profile.*']` | 3 (Customer) |
| Proposal children follow the proposal | `proposals.router/media.router.ts:25`, `incentives.router.ts:27` (`cannot('update','Proposal')` by hand) | sub-entity fields `media`, `incentives` | 3 (Proposal) |
| Meeting participants list | `meetings.router/participants.router.ts` (`isParticipant` by hand) | the Meeting read rule | 3 (Meeting) |

### 5.4 Retiring-seams register (the tree, 2026-10-05)
| Seam | Replacement | Leaves in |
|---|---|---|
| `SYSTEM_CONTEXT` (106 sites / 43 files) | `systemContext(reason)` | 3 |
| `ctx.scope` (88 sites / 38 files), `{ ...ctx, scope: null }`, `ctx.scope ?? undefined` | `permit` inside the DAL | 3 |
| `resolveVisibilityScope` (24 sites / 9 files) and the per-entity `procedures.ts` scope stamps; `scopeMiddleware` (no caller) | — | 3, file deleted in 6 |
| `buildUserContext` (`dal/server/lib/helpers.ts:42`; callers: customer-notes crud, customer-pipelines router, meeting-flow router, projects business router, `move-customer-pipeline-item.ts` ×4) | `ctx.actor` + `permit(...).probe` | 3 |
| `isVisible` (one caller: proposal media service), `isInScope` (one caller: proposal views queries) | `permit(...).probe` | 3 |
| `assertCan` / `assertCanUpdateFields` in `create-crud-router.ts` | the DAL slots | 3 |
| `shareableMiddleware` (a token gives `ability: null`, and wins over a session) | `bearerContext` + the proposal shareable procedure | 3 (Proposal) |
| `systemProcedure`; a separate `ctx.ability`; the `scope: null` stamp in `protectedProcedure` | the ladder narrows | 2 |
| Client-side `defineAbilitiesFor` ×4 (`casl-provider.tsx`, `server-ability-provider.tsx`, `app-sidebar.tsx`, `mobile-dock.tsx`) | the provider fed from the root layout | 2 |
| Hand-written copies of server rules: `get-accessible-pipelines.ts`, `use-customer-note-action-configs.ts`, `can-see-phone.ts` | `ability.can` | 4 |
| Subjects that become fields of a parent: `CustomerProfile`, `CustomerLeadAttribution`, `Application`, `VoipCampaignContact` (rules at `abilities.ts:82-86,103-105,137-138,165`) | sub-entity fields | 3, per family |
| `resolveEffectiveScope` / `bridgeToParent` / `spec.visibility` (15 specs) | the compiler + `spec.parent` | 6 |
| interim staff gate `can('access','Dashboard')` | future is-staff reconception (marker only) | — |

### 5.5 Stale refs seen 2026-10-05 (fix when the file is touched)
Several `DOCS.md` files and job comments cite `customerServerSpec.hooks.*` / `meetingServerSpec.hooks.*`, which moved to the `dal/server/crud.ts` config factories. `modules/proposals/core/constants/actions.ts:43` declares `permission: ['assign', 'Proposal']`; no rule grants it. `modules/projects/media/service.ts:15-17` and `modules/proposals/core/server-spec.ts:11-14` defer their checks to "#285" by name. `docs/adr/0002-entity-server-system.md` still describes `EntityServerSpec` and a required `caslSubject` (lines 4, 17, 41, 43, 123, 151, 153, 155, 199, 207, 218), and `docs/permissions/visibility-rules-catalog.md:128` and `docs/ubiquitous-language.md:164` use the old names too; they are rewritten when the epic lands.

---

## 6. Dependency graph

```
P0 security holes on main (hotfix path)        [independent]
Sync ✓ (2b038591, 2026-10-05)
  └─→ Unit 1 typed foundation                  [AFK]
        └─→ Unit 2 one actor per request       [AFK]
              └─→ Unit 3 compiler + DAL self-scoping, per family   [HITL: Q11, Q12, M-R1/M-R2]
                    ├─→ Unit 4 rules matrix                         [HITL: Q8; #217/#220]
                    ├─→ Unit 5 lint wall + financial reads          [after J6]
                    └─→ Unit 6 delete the legacy engine (after 4 and 5)
                          └─→ Unit 7 full browser pass → single merge   [HITL: E2E data]
Merge main → branch at every unit boundary (D-22).
```

---

## 7. Tracking rules

- **This doc** is the tracker. Check a box when the unit lands green; fill its **Plan:** pointer when the JIT plan is written. A change of design edits §2 in place and adds one dated line to Appendix A; the old text moves to §2.2 as a superseded row, never stays as a struck-through paragraph.
- **README §L** is the decision *log* (append-only per decision; a reversal is a new L-entry that names the one it reverses). Reports `01`–`24` are evidence and are never edited.
- Memory: `project-permissions-casl-compiler.md` carries the pointer + the session lineage; refresh it at every unit boundary.
- Per-unit plans: `docs/superpowers/plans/YYYY-MM-DD-permissions-unit-N-<name>.md`. A plan is deleted when its unit ships.

---

## Appendix A — History (dated, one entry per turn of the design; details in the snapshot and the plans)

- **2026-08-10** — Spec v2 (`…casl-scope-compiler-design.md`): CASL-compiled row predicate, structural `parent` bridge, hand-walked interpreter (no `@ucast/sql`), `Actor = user|token|system`, 7 authorization axes, migration invariant. Catalog `docs/permissions/visibility-rules-catalog.md`.
- **2026-08-11/12** — Phase 0 (engine, unwired), Phase 1 (4 roots compile `read`; parser wiring: operators register UNPREFIXED, `operatorToConditionName` inert), Phase 2 (project = participation OR owner), Phase 3 (fk guardrail). Rulings: peer roots; dispatcher = derived pipeline; "robustness BEFORE propagation" (Phase P deferred).
- **2026-08-13** — rename: DAL authority `resolveActorScope` (was `resolveScope`), tRPC wrapper `resolveTrpcActorScope` (was `resolveActorScope`). Older docs keep the old names.
- **2026-08-18** — Phase 4–8 resequence grill: actor-seam conventions (A/B/C classification, point-probe vs system write, `tokenActor` abilityless [now D-S2], `SystemReason` union, `requireResolvedScope` [now D-S6]); `agentProcedure → staffProcedure` rename decision (D-23); first `main` merge `31181df0` (+ `96f5dcd3` kept projects on CASL — lesson: `resolveVisibilityScope`↔`resolveTrpcActorScope` swaps are semantic, not typed). Phase 4 shipped.
- **2026-08-19** — Phase 5: `actor` on `ScopedContext`; **"factory MUST NOT read `ctx.actor`"** written down (D-S1); outcome-derived 5-bucket pipeline; single-bucket list.
- **2026-08-20** — Structural finding: reads on CASL, mutations on legacy; `resolveActorScope` read-only → own-record authz inexpressible → auth-in-hooks. Grill B (financial chokepoint): `resolveActorScope(spec, ctx.actor)` as the single read authority, uniform full cutover, wall guard, Tier-2 children need `parent` first, `permittedFieldsOf` YAGNI [now D-S4]; verbally superseded D-S1 without retracting it. Phase A dead-code delete; dispatcher widened to rehash+dead; Ledgers 1–3.
- **2026-08-24 → 09-03** — Phase 6: bridges on customer-notes/applications; media routers on CASL + `canAccess`; proposal-media flipped; agent-first shareable precedence; Phase-6 spec + plan.
- **2026-09-04/06** — Dispatcher corrections (financial gate landed defensively → Grill-D residual; fresh-wide + all-meetings; notes + discovery profile; note-create `canAccess` probe after an E2E NOT_FOUND). **Phase 7 started on the wrong layer:** `createCrudRouter` gained `resolveScope?`, customer (`3e901178`) + meeting (`b40403b6`) flipped; Track B/C split with Phase 7.5 after Phase 8 (`b0d50234`). Same day the **CASL-native re-orientation** (Context7 + `WebDevSimplified/casl-crash-course`): DAL self-scopes off `ctx.actor` per action; 7.5 folds back; revert both commits — recorded only as an uncommitted tracker section.
- **2026-09-07** — Re-grounding audit (5 read-only agents → reports 01–05 + README §A–§K): root causes of the derailment (stacked banners; verbal supersession never written; grill outcomes as narrative; manual gate; scope accretion while main moved).
- **2026-09-08/09** — Grill (reports 06–12): primitive inventory (111 primitives, 7 shapes of "who is acting", `ctx.actor.userId` read 0×), flow catalog (16 token flows, all Proposal), CASL playbook, ability-per-surface (7 builds / 3 lookups per page), business-rules matrix (129 rows, 25 open), adapter surface, client gating. Decisions **L1–L10**: union dropped; session = truth; bearer = per-row ability; once-per-route actor; 5-rung ladder; `Actor` record (user rejected "Principal"); mutation WHERE ∧ read; structural bridge; `@casl/react` + `subject()` + operator guard. Handoff 13 written. Session ended mid-grill at **Q7**.
- **2026-09-13** — Grill resumed (session `a078cbb8`): Q7 → **L12** (7a yes; 7b yes minus a `ProposalView` subject; 7c deferred). **L13 opened:** sub-entities as FIELDS of the parent CASL subject; report 17 (worked example + probe SQL on real tables); the probe exposed the action map (child writes ⇒ parent `update`).
- **2026-09-16** — Orientation pass (8 subagents): report 18 (decision + progress map: 41 LOCKED / 25 SUPERSEDED / 1 in grill / 22 open), 19 (branch API inventory: 93 primitives → 33 keep / 3 rename / 35 rewrite / 22 delete; one decision drives ~30 rewrites), 21 (main drift: 117 behind, 18/17 conflicts, proposals in `modules/`, `createCrudDal` generic), 22 (topology: 50 tables; subject union 25 → 20; `CustomerNote` the only own-row child), 23-A…D (design-it-twice interface alternatives), 24 (comparison + **hybrid recommendation**, awaiting the user's ruling). Edited in place: report 17 §2 (D-19: no operators on mutation rules), D-11 (no `ProposalView` subject), J3 (no legacy widening; seam revert moves to 7.3), D-08 (pending L13), Q12 + M-R1/M-R2 added.
- **2026-09-09 (evening)** — Recovery session: lineage located; Context7 + installed-package verification of every §L claim (14: all decisions stand; mechanism corrections to L7/L8/L10/C8; `@casl/react` 7.0.1 real; stay on `@casl/ability` 6.8.0), tRPC/Next/React/better-auth verification (15: all stand; `resHeaders?`; `hasMounted` premise false; root provider = new Q10), merge rebaseline (16: 10/9 conflicts, 35 new sites, tsc+lint green). **This tracker rewritten** (G1/J8); pre-rewrite copy snapshotted as report 00.
- **2026-10-05** — Docs banked (`c19eddce`). **Supersede merge `2b038591`** (owner's choice over a literal merge and over a fresh branch): tree = main `61d3e1e2` + the permissions docs; 76 branch commits kept as ancestors; branch pushed to origin. 7.1 closed; 7.0 reduced to the P0 fixes on main; Q11 and M-R1/M-R2 move to 7.3; J3 and conflict #10 no longer exist. Same day: **L13 ratified** (D-08) and **L14** (D-26: specs as the single typed source, after a type probe on the real tables). Structure walk-through approved in six sections → **L15** (names, `permit` in the DAL library, `bearerContext`, `@casl/react` kept, rules sent from the root layout, no test runner) and the structure spec `docs/superpowers/specs/2026-10-05-permissions-structure-design.md`. Later the same day the owner approved the written spec; the stale documents were updated (this tracker's roadmap, verification, graph and ledgers rewritten in place; the 2026-09-13 sync plan, the 2026-08-10 engine spec and the phase-0 plan deleted from the tree); the security ledger §5.1 was rebuilt from a fresh read of the tree (20 rows; the earlier attempt's fixes are not in it).
- **2026-10-05** — Unit 1 landed: specs are built by `defineEntitySpec` / `defineSubEntitySpec`; `permissions/specs.ts` derives subjects, rows and fields; `defineRules` and the operator declarations exist unwired; `type-checks/must-not-compile.ts` guards the types.

## Appendix B — Pointers
- Structure: `docs/superpowers/specs/2026-10-05-permissions-structure-design.md`.
- Decision log + audit: `docs/plans/2026-09-07-casl-re-grounding/README.md` (§L) and reports `00`–`24`.
- The earlier attempt: code at `b40403b6`. Its engine spec (`2026-08-10-casl-scope-compiler-design.md`), its per-phase plans, the customer-pipelines boundary refactor plan and the 2026-09-13 sync plan are in git history; the last commit that carries all of them is `b40403b6` for the branch's own and `81df90f9` for the three that were still in the tree.
- Business rules: `docs/permissions/visibility-rules-catalog.md` (Parts 1–2 current; 3–4 describe the legacy engine), per-entity `DOCS.md`, `docs/ubiquitous-language.md`, report 10 (matrix).
- Reference implementation: `WebDevSimplified/casl-crash-course` — borrowed: `subject()` tagging, per-field checks, a fail-closed interpreter; not borrowed: a direct `@ucast/core` import, `undefined`-for-deny.
- Memory: `project-permissions-casl-compiler.md`.
- Issues: #285 (epic), #210, #218, #220, #217, #226.
