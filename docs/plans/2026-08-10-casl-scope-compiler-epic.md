# CASL Permissions Epic (#285) — tracker

> **Rewritten 2026-09-09** (re-grounding README §G1 / §J8; user asked for a from-scratch rewrite on 2026-09-07). This is the **roadmap + status + ledgers**. It does not restate designs: the *reasoning* behind every current decision is the decision log in `docs/plans/2026-09-07-casl-re-grounding/README.md` §L (L1–L11), the *evidence* is reports `01`–`16` beside it, and the *structure* (types, names, layers, order of work) is `docs/superpowers/specs/2026-10-05-permissions-structure-design.md`, awaiting the owner's review.
> **START HERE:** `docs/plans/2026-09-07-casl-re-grounding/DISTILLED-2026-10-01.md` — one page: decisions, business rules, live security holes, next steps. Since the supersede merge of 2026-10-05 the branch tree is main plus these docs; §0.1, §4 (7.2 onward) and §5 still cite files and lines as of `b40403b6` and are re-derived against the tree in each unit's plan.
> **Editing rule (the anti-derailment rule):** a supersession EDITS the superseded text in place. No "read me first / supersedes below" banners, ever again. Dated summaries of what changed go to Appendix A. The verbatim pre-rewrite tracker (three stacked generations of Phase-7 prose) is preserved read-only at `docs/plans/2026-09-07-casl-re-grounding/00-epic-tracker-snapshot-2026-09-09-pre-rewrite.md`.
> **Precedence when documents disagree:** §2 of this tracker (current design) → README §L (reasoning) → reports → spec v2 → per-phase plans (point-in-time execution records, left as authored) → `docs/permissions/visibility-rules-catalog.md` (Parts 3/4 are pre-CASL; see G3).

---

## 0. Status at a glance (2026-10-05)

| Fact | Value |
|---|---|
| Branch / worktree | `refactor/285-refactor-permissions-casl-scope-compiler`, `.worktrees/issue-285` — the long-lived home of the WHOLE epic (no per-phase PRs; one merge at Phase 9). On origin since 2026-10-05 |
| vs `main` | **0 behind**. Supersede merge `2b038591` (2026-10-05): tree = main `61d3e1e2` + the permissions docs. The dry-run merge had grown to 44 conflicted paths at 581 behind, and main had rewritten `create-crud-dal.ts`, `dal/server/types.ts` and `create-crud-router.ts` under the branch's seam, so main's tree was taken whole. The 76 branch commits stay ancestors (`b40403b6` = last code tip) |
| What the tree runs | main's legacy engine everywhere: `ScopedContext { session, ability, scope }`, `SYSTEM_CONTEXT`, `spec.visibility` + `resolveEffectiveScope` + `resolveVisibilityScope`, `shareableMiddleware` (token ⇒ `ability: null`), conditionless CASL rules. No file under `src/shared/domains/permissions/scope/` exists in the tree |
| `pnpm tsc` / `pnpm lint` | PASS / 2 errors, both formatting in `src/app/(frontend)/globals.css:491-492`, carried by main (62 warnings) — run 2026-10-05 on `2b038591` |
| Keep-primitives | restored from `b40403b6` per unit (report 19 §1: adapter core A5–A12, A16–A19, operators A20/A22, `SystemReason`, `MEETING_OUTCOME_CLASS` derivations, set-based media mutations) |
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

### 0.3 Open user decisions (HITL queue, in the order they will be asked)

| # | Decision | Default / recommendation | Blocks |
|---|---|---|---|
| ~~Q7~~ | **RULED 2026-09-13 → README L12.** 7a YES; 7b YES (allowlist `['financeOptionId','cashInDealCents']` + collection `views`; reconciled `envelopeDocumentIds`/`age` = derived system writes; NO `ProposalView` subject → L13); 7c **DEFERRED** (open security item, §5.1 row 7c) | — | — |
| **Q12** | Bearer READ surface (folds the deferred 7c): (i) server-side masking of cost-side data + agent-internal columns on bearer reads; (ii) `canSeeUngatedPhone` today ungates bearers via `kind !== 'user'` — under a per-row bearer ability the homeowner's OWN phone becomes gated unless the bearer `read` rule grants the `phone` field (report 19 §7); (iii) public project reads under an anonymous deny-all ability (09-14 open item, report 18 §4) | grant `phone` on the bearer read rule now (own data); masking + public reads ruled with 7.4 | 7.3 (phone), 7.4 |
| **Q8** | The 25 business-rule rulings in report 10 §5 (⭐ #1–6, #8 first: Meeting update/delete conditions, dispatcher Meeting update, Project read/update, create-side parent requirements, …) | each row carries a default | 7.4 (`abilities.ts` authoring) — Meeting rows also wait on #217/#220 |
| **Q9** | Which other documents get rewritten and how (spec v2, catalog Parts 3/4, `src/trpc/DOCS.md`, per-entity DOCS, `add-an-entity.md`, memory) | tracker ✅ done; rest at 7.0-G3 (now) and Phase 8 (full rewrites) | 7.0 / 8 |
| ~~Q10~~ | **RULED 2026-10-05 → L15.** Rules are sent from the root layout through the cached `getRequestActor()` | — | — |
| **Q11** | `outcome-pipeline-map.ts`: restoring the branch's map (`b40403b6`) flips prod `not_good`/`ftd` from `rehash` to `dead` (matches the 2026-08-19 ruling; the tree carries main's copy) | restore the branch's map | 7.3 (the `$inDerivedPipeline` operator reads it) |
| M-R1 / M-R2 | **R1** `recordView` — main's `proposalService.views.record(SYSTEM_CONTEXT)` vs the bearer path (L12: the bearer records a view on its own row through the `views` collection field); **R2** proposal-media probes — main's service `assertParentVisible` calls the legacy `isVisible` | R1: keep main's service shape, drive it from the bearer actor (no `SYSTEM_CONTEXT`); R2: replace with the adapter's probe | 7.3 |
| J6 | Wall guard shape (E2) | ESLint rule + allowlist | 7.6 |
| ~~J7~~ | **RULED 2026-10-05 → L15.** No test runner and no unit tests in the library: `pnpm tsc` + `pnpm lint` + browser end-to-end tests | — | — |

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
| D-16 | DAL **self-scopes per slot** off `ctx.actor.ability` (getById→read, update→update, delete→delete, create→parent probe / verb) — ONE resolution point for tRPC, services, jobs, webhooks. `requireResolvedScope(ctx.scope)` retires with `ctx.scope` | 09-06 | LOCKED — **supersedes** D-S1 | README §C2, C4 |
| D-17 | Field-level via `permittedFieldsOf(ability, action, subject(type,row), { fieldsFrom })` post-load; retires `assertCanUpdateFields`; must run on the bearer path too | 09-06 | LOCKED — **supersedes** D-S4 | README §C6 |
| D-18 | UI reads the **same ability**: server ships `packRules(actor.ability.rules)` from the RSC that resolved the actor; a single `'use client'` wrapper hydrates `createMongoAbility(unpackRules(rules), { conditionsMatcher })` with the shared matcher module; `@casl/react` 7.0.1 (`AbilityProvider value=`, `useAbility<AppAbility>()`, `<Can>`); row-specific checks via `subject(type,row)` on both sides; the 4 hand mirrors are deleted | 09-09 | LOCKED (Q10 = root provider) | **L10**; 12; 14 §1.1 |
| D-19 | **Operator guard:** custom document operators may appear only on `read` rules without `fields`; never with `fields`, never on `create/update/delete`; no client *instance* `read` checks on operator-bearing subjects (or register JS interpreters in the shared module — the escape hatch). Enforced by a boot assert | 09-09 | LOCKED | **L10**; 14 §1.9 |
| D-20 | Stay on `@casl/ability` **6.8.0** (7.0.1 is a breaking major); add `@casl/react` 7.0.1 (peer range accepts 6.8.0). Typing = hand-rolled `AppQuery<T>` + `hkt.Container` brand (14 §1.10 V6). Author `cannot` rules LAST per action/subject (6.8.0 `rulesToAST` ANDs conditioned `cannot`s regardless of order); `conditions: {}` counts as conditionless in audits | 09-09 | LOCKED | 14 §1.5, §1.10, §3 |
| D-21 | Verification = `pnpm tsc && pnpm lint` every unit, the wrong-on-purpose type file under `pnpm tsc`, the startup checks on the rules, and browser end-to-end tests per role. No test runner, no unit tests in the library, no SQL parity script | 08-10 → 10-05 | LOCKED | **L15**; spec §10 |
| D-22 | Worktree = the whole epic; merge to main ONCE after the Phase-9 E2E pass; **merge main → branch at every phase boundary** (H4); merge main FIRST before any Phase-7 code (H1) | 08-11 / 09-07 | LOCKED | README §H |
| D-23 | `agentProcedure` → `staffProcedure` is a rename (not a shim), LAST; `superAdminProcedure` re-parents to it; interim gate stays `can('access','Dashboard')` | 08-18 | LOCKED | Appendix A 08-18 |
| D-24 | Wall: cross-entity code calls the owning DAL; a lint guard forbids separate-query `db.select().from(<scoped table>)` / `db.query.<scopedTable>` outside `entities/<x>/dal/` (allowlist: `domains/permissions/scope/operators/*`, tombstoned S8 files) | 08-20 / shape J6 | LOCKED (shape open) | Grill B #5; README §E2 |
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
| D-S11 | "The repo has NO test runner — don't add vitest/scripts" (08-11) | **open** J7 — the manual EXPLAIN gate is the documented reason flips got hand-waved (README §A.4-4) | reopened 09-07 |

### 2.3 Target shapes (normative; verified snippets in 14 §2 and 15 §3)

```ts
// src/shared/domains/permissions/actor.ts            (replaces scope/actor.ts)
export interface Actor { ability: AppAbility; userId: string | null }      // userId null ⇒ bearer or system

// src/shared/domains/permissions/server/get-request-actor.ts   ('server-only')
export const getRequestActor = cache(async () => {                          // ONE session lookup, ONE ability build per request
  const session = await auth.api.getSession({ headers: await headers() })
  const ability = defineAbilitiesFor(session?.user ?? null)                 // null ⇒ deny-all
  return { session, actor: { ability, userId: session?.user.id ?? null } }
})                                                                          // route.ts gets no memo: call once, pass down
bearerActor(spec, rowId)        // inside <entity>ShareableProcedure + the pdf route, after validateShareToken (rules per D-11)
systemContext(reason)           // jobs/webhooks/scripts: { actor: { ability: systemAbility(reason), userId: null } }

// src/shared/dal/server/types.ts
export interface ScopedContext { actor: Actor; tx?: Tx }
// src/trpc: root ctx { session, actor, req?, resHeaders? }; rungs narrow only (D-13)

// adapter (src/shared/domains/permissions/scope/*): per slot
toWhere(ability, action, spec)               // rulesToAST → interpret; null AST ⇒ sql`false`; empty AND ⇒ no WHERE
scopedWhere(ability, 'read', spec)           // reads
scopedWhere(ability, action, spec) = and(toWhere(action), toWhere('read'))   // update / delete / duplicate-source (D-15)
// + parent bridge folded in from spec.parent (D-08); own-column conditions compiled against the child table
permittedFieldsOf(ability, action, subject(spec.caslSubject, row), { fieldsFrom })   // update slot, post-load (D-17)

// rules (abilities.ts): one rule = action + subject + fields? + conditions?; ids baked in; cannot LAST
can('read', 'Customer', { $participatesViaMeeting: { via: 'customerId', userId } })
can('update', 'Customer', ['age'], { ownerId: userId })                     // example only — matrix rulings pending (Q8)
can('manage', 'all').because(reason)                                         // system

// client: one 'use client' wrapper
<AbilityProvider value={createMongoAbility(unpackRules(rules), { conditionsMatcher: buildScopeConditionsMatcher() })}>
useAbility<AppAbility>().can('update', subject('CustomerNote', note))        // re-tag after superjson/JSON boundaries
```

### 2.4 Invariants every unit must hold

1. D-02 (false-ALLOW risk; conditions replace, never beside). Audit per action: no conditionless `can(action, X)` survives beside a conditioned one; `{}` = conditionless.
2. D-15: a row you cannot read cannot be mutated.
3. D-10: session is the truth; bearer only inside `<entity>ShareableProcedure`; agent-first precedence (a session wins over a URL token).
4. D-07: client id → probe → `NOT_FOUND`; server-derived id → system rule with reason; never `scope: null` / `?? undefined` omni-by-construction.
5. D-19: operators only on field-less `read` rules; operators assert their subject binding (`ctx.table`); SQL bodies are `server-only`.
6. One server `defineAbilitiesFor` call site (`getRequestActor`) + `bearerActor` + `systemAbility`; nothing below `createContext` rebuilds.
7. `@casl/ability` pinned at 6.8.0 until the epic merges (D-20).
8. Every flip is EXPLAIN-parity-gated per role × entity × action and the evidence is recorded (D-21).

---

## 3. Verification model

- Per unit: `pnpm tsc && pnpm lint` green (never `pnpm build`).
- **Parity gate (I1):** a checked-in `scripts/permissions/explain-parity.ts` (tsx, `DRIZZLE_TARGET=dev`) prints the compiled SQL per role × entity × action beside the legacy fragment; recorded per unit. Whether the pure compiler also gets vitest is **J7**.
- **Phase 9 E2E matrix (I2):** roles × entities × actions; false-ALLOW and over-deny; the §8 closures; agent-first precedence; bearer allowlist + mask; driven through `/api/dev/playwright-session`.
- Behaviour-changing flips (dispatcher widenings, single-bucket list, bearer allowlist) are *intended* and named in the unit; everything else is byte-equivalent or the unit says why not.

---

## 4. Roadmap

Legend: `AFK` = executable without live rulings · `HITL` = needs a ruling mid-unit. Each unit gets a JIT plan (`docs/superpowers/plans/2026-MM-DD-casl-phase-7-<unit>.md`) written against the real code at execution time, then either inline or subagent-driven execution with a review.

### Phases 0–6 + A + dispatcher corrections — DONE (see §0.1 for commits; per-phase plans in `docs/superpowers/plans/2026-08-1*-casl-phase-*.md`, `2026-08-19-…-phase-5-…`, `2026-08-20-dispatcher-visibility-corrections.md`, Phase-6 spec+plan `6c565a66`)

Residual facts a Phase-7 implementer must know: `$hasNoMeeting` is orphaned (drop, C13); `isVisible` has 0 callers; `systemContext(reason)` has 1 call site and `SystemReason` 2 variants while **30** bare `SYSTEM_CONTEXT` sites remain on the branch (+9 net-new on main); customer-notes + applications factory leaves still resolve through the legacy default; the customer-pipelines financial gate landed defensively (Grill-D residual, Phase 9 list).

### Phase 7 — CASL-native plumbing (re-oriented; the real design)

- [ ] **7.0 · P0 fixes · AFK · blocked-by: nothing.** Engine-independent; lands on main through the hotfix path, then reaches the branch by the next main merge.
  - **P0 bypasses (current paths: DISTILLED §6):** `ai.router/index.ts` unauthenticated `baseProcedure` → staff or bearer gate + reach check; `projects.router/crud.router.ts` `getAll/getForEdit/create/update/delete` on bare `agentProcedure` → scoped, delete admin-only; `create-crud-router.ts` skips verb + field gates when `ctx.ability` is null → deny `update` on the token path except an explicit allowlist (final = D-11 in 7.3); `customer-pipelines.router.ts` proposals/projects reads → through the owning DALs (the live #210 residual); meeting create on any customer → probe the customer first.
  - Retitle #285 to the epic; link this tracker; cross-link #210/#218/#220/#217/#226 to their units (G4). Delete the stale `CLAUDE.local.md` dispatch file (G5).
  - **AC:** P0 rows closed and greppable on main; #285 retitled; tsc+lint green.

- [x] **7.1 · Bring the branch in line with `main` · DONE 2026-10-05 (`2b038591`).** Supersede merge: main's tree taken whole, docs kept, the pre-re-grounding code left to history at `b40403b6`. Reports 16 and 21 and `docs/plans/2026-09-13-main-285-sync-plan.md` planned a literal merge and are history. Carried forward into 7.3: the Q11 map, rulings M-R1/M-R2, and the classification of every `SYSTEM_CONTEXT` / `{ ...ctx, scope: null }` / `ctx.scope ?? undefined` site in the tree.

- [ ] **7.2 · Context unification (upstream of the DAL) · AFK · blocked-by: 7.1.** Executes `docs/plans/2026-09-07-casl-re-grounding/13-handoff-trpc-context-unification.md` inside this worktree (option A), with the 15 §4 corrections: `resHeaders?` optional; the `hasMounted` sentence reworded; step-9 "after" floor = per server request. Introduces `Actor` record + `getRequestActor()`; folds `get-cached-session.ts` and the RSC branch of `create-http-context.ts` into it; rewrites `init.ts` rungs to narrow only; deletes `systemProcedure` and the `scope: null` stamp at `init.ts:60`; migrates `ctx.ability` readers to `ctx.actor.ability`; RSC guards call `getRequestActor()`; route handlers that should be session-gated call it once. The old union's engine consumers are left alone (7.3 owns them); per-entity `<entity>Procedure`s keep stamping `scope` until 7.3.
  - **AC:** `defineAbilitiesFor` called in exactly `getRequestActor` + the shareable token branch (+ scripts); `/dashboard/pipeline/[pipeline]` traces to 1 session lookup / 1 ability build per server request (from 3 / 7); `google-calendar/webhook/route.ts` + `quickbooks/callback/route.ts` reported as no-auth; tsc+lint green.

- [ ] **7.3 · Engine plumbing — DAL self-scopes per action · AFK (parity-gated) · blocked-by: 7.2; J7 decides the gate tooling.** README §C1–C13 under D-08/D-09/D-11/D-14/D-15/D-16/D-19/D-20:
  - Restore the adapter core from `b40403b6` (report 19 §1 KEEP rows) without the union: no `scope/actor.ts`, no `kind` switches, no `resolve-actor-scope.ts` / `resolve-trpc-actor-scope.ts` / `requireResolvedScope`; `SYSTEM_CONTEXT`-as-const → `systemContext(reason)` (F3 classification per site: `SystemReason` gains `webhook:* | sync:* | intake:* | admin:*`; ~39 sites).
  - Adapter: `toWhere(ability, action, spec)` action-aware (C1); C9 OR-with-allow-all fix; C10 operator subject-binding asserts; C11 `server-only`; C8 typing V6; `OperatorCtx = { table, pk }` with user ids baked into rules (D-14).
  - `createCrudDal` slots: getById `read`; update/delete `and(toWhere(action), toWhere('read'))` (D-15); `duplicate` source read likewise; `create` = parent FK probe for children / `verbOnly('create')` for roots (C4 — closes the create-side IDOR class E1-4); parent bridge + own-column child conditions (D-08); `permittedFieldsOf` post-load in update, `assertCanUpdateFields` retired (C6/C7).
  - `bearerActor(spec, rowId)` + `<entity>ShareableProcedure` (proposal only today); `recordView` moves off `systemProcedure`; delete the 4 `ctx.ability == null` role proxies; the homeowner conditionless `read Proposal` deleted in the same commit as the bearer ability (D-02).
  - Delete per-entity scope procedures + `ctx.scope` from `ScopedContext` (D-13); bespoke DAL reads (`customer-pipelines`, `get-customer-profile`, projects `getProjectsPipelineItems`, `meeting-flow`) call `scopedWhere(ctx.actor.ability, 'read', spec)` directly — the Phase-2 accepted mirror finally compiles.
  - **Gate:** parity script per role × entity × action vs the legacy fragment (Tier-1 roots ≡; children via bridge; system → no WHERE; the intended widenings named). `$hasNoMeeting` dropped; `isVisible` deleted.
  - **AC:** `git grep` for `ctx.scope`, `resolveTrpcActorScope`, `tokenActor`, `systemActor`, `requireResolvedScope`, `buildUserContext`, `SYSTEM_CONTEXT` = 0 in `src/`; every CRUD slot self-scopes; bearer path goes through verb + field + row gates; parity evidence recorded; tsc+lint green.

- [ ] **7.4 · Rules matrix + own-record retirement · HITL FIRST (Q7, Q8), then AFK · blocked-by: 7.3; Meeting rows also on #217/#220.** Ratify report 10's matrix (25 rulings, §0.3) → author `abilities.ts` per D-02/D-20 (conditions + fields per action; `cannot` last; ids baked in) → retire the imperative gates (Ledger 2): CustomerNote `assertNoteAuthorOrAdmin` + spec hooks → `can(['update','delete'],'CustomerNote',{authorId})`; Activity `{ownerId}` (5 procs, raw `db` — needs #226 or a bespoke DAL on the adapter); participants dedup → reuse `$participatesViaMeeting`; contracts envelope gate → field rule; #218 owner-delete lands as a row. Bearer allowlist + `getFullView` mask per Q7 (mask = CASL field list on the bearer's `read` rule for flat columns + a typed homeowner projection for nested JSONB cost lines).
  - **AC:** matrix ratified + committed as the rules source; no conditionless mutation rule beside a conditioned one; Ledger 2 empty; `git grep assertNoteAuthorOrAdmin` = 0; tsc+lint green; E2E rows for each ruling added to the Phase-9 matrix.

- [ ] **7.5 · Client — one ability everywhere · AFK after Q10 · blocked-by: 7.2 (rules available in RSC), 7.4 (rules final).** Add `@casl/react` 7.0.1 (do NOT bump `@casl/ability`); one `'use client'` `ClientAbilityProvider`; dashboard layout + proposal page RSC (+ root layout per Q10 (b)) ship `packRules`; `casl-provider.tsx` / `app-sidebar.tsx:74` stop calling `defineAbilitiesFor`; affordances use `useAbility().can(action, subject(type,row))` (`getDisabledReason` from `4c00f0c0` is a ready seam); delete the 4 mirrors (`use-customer-note-action-configs.ts`, `can-see-phone.ts`, `get-accessible-pipelines.ts`, + the phone/pipeline hand copies); delete the proposal-flow `hasMounted` guards only once the proposal page ships rules; document `router.refresh()` on in-place session change; boot assert for D-19 (incl. the client instance-read restriction).
  - **AC:** client never calls `defineAbilitiesFor`; SSR first paint is the real ability; 0 hand mirrors; tsc+lint green.

- [ ] **7.6 · Wall + financial · AFK after J6 · blocked-by: 7.3.** ESLint `project/no-raw-scoped-table-outside-dal` + allowlist (~45 sites today); the 6 Ledger-1 financial sites through owning DALs; the Grill-D customer-pipelines read API redesign (types make financial exclusion structural; `maskFinancials` + `canReadProposals` threading deleted; `shared/trpc ← features` inversion fixed) per `docs/plans/2026-09-04-customer-pipelines-feature-boundary-refactor.md`.
  - **AC:** guard green with a written carve-out in `dal-conventions.md#only-dal-imports-db`; Ledger 1 empty; dispatcher financial-leak E2E re-run.

### Phase 8 — delete the legacy engine · AFK · blocked-by: ALL of Phase 7 (F1)
Delete `resolveEffectiveScope` / `bridgeToParent` / `isInScope` / `resolveVisibilityScope` / `scope-middleware.ts` / the 3 remaining `spec.visibility` fns (+ the 2 main adds), the `visibility` field on `EntityServerSpec`, the omni special-cases (emergent: `manage all` → empty AND → no WHERE); `agentProcedure → staffProcedure` rename (all files, one inert commit, D-23); `@deprecated` tags were placed at 7.0 (F2); full rewrites of `src/trpc/DOCS.md`, per-entity `DOCS.md` visibility sections, `add-an-entity.md` Step 3, `dal-conventions.md`, `trpc-procedures.md`, catalog Parts 3/4 → superseded, ADR-0002 amendment.
- **AC:** `git grep` for every legacy name = 0; Retiring-seams register (§5.4) empty; docs match code; tsc+lint green.

### Phase 9 — pre-merge gate + the single merge · HITL
- The I2 E2E matrix passes (roles × entities × actions; false-ALLOW + over-deny; §8 closures; agent-first; bearer allowlist/mask; dispatcher operational pipeline; customer-in-exactly-one-tab).
- Residuals that MUST land before merge: activities `getById`/`complete` existence-leak → `NOT_FOUND` (whole-file flip with #226); the repeated `{session:null, ability:null, scope:…}` proposal-view literal (dies with `ctx.scope` in 7.3 — verify); Grill-D read API (7.6); `move-customer-to-pipeline.ts` manual override superseded by outcome-derivation (flag → `domains/pipelines` follow-up); GCal-sync-all-unsynced for any agent (E1-6).
- Merge policy: merge `main` → branch once more, then ONE PR `Closes #285` (+ #210/#218/#220/#217/#226 as applicable) after `pnpm lint && pnpm tsc`.

---

## 5. Ledgers (living — edit rows, do not append duplicates)

### 5.1 Security findings still open (engine-independent bypasses; README §E1 + report 16 §3)
| # | Site | Who / what | Unit |
|---|---|---|---|
| E1-1 | `projects.router/crud.router.ts:14-65` (+ main's 3 `{...ctx, scope:null}` spreads there) | any agent/dispatcher `getAll/getForEdit/update/delete` any project + R2 media | 7.0 |
| E1-2 | `ai.router/index.ts:7-22` → `ai/client.ts:96-113` | unauthenticated `baseProcedure` raw-updates `proposals.projectJSON` for any id | 7.0 |
| E1-3 | `create-crud-router.ts:118-120,147-149` + `shareable-middleware.ts:67` | share-token bearer updates ANY column of its row (ability null → verb + field gates skipped) | 7.0 interim → 7.3 final |
| E1-4 | `meetings/dal/server/crud.ts:33-38,52`; `proposals/lib/server-spec.ts:53-58` (now `proposals/dal/server/crud.ts:35`); applications create; `media.router.ts:42-48`; `google-drive.router.ts:50-124` | create-side IDOR class (creator gains visibility of any customer) | 7.3 (C4) |
| E1-5 | `customer-pipelines.router.ts:103-124` | proposals/projects read unscoped after the meeting probe — live #210 residual | 7.0 |
| E1-6 | `move-customer-pipeline-item.ts:61-71`, `landing.router/index.tsx:137`, `schedule.router/sync.router.ts:43-57`, `activities.router.ts:254` | raw writers / GCal sync for any agent | 7.0 |
| 7c | `proposals/dal/server/queries.ts:88-140` `getFullView` (all columns incl. `projectJSON.sow[].financials.costLines`, `ownerId`, `contractEnvelopeId`, QuickBooks ids) + `summary/route.ts` plaintext dump | bearer reads are masked only by the client view mode (PDF is safe by construction) — **DEFERRED by user ruling 2026-09-13 (L12)**, folded into Q12 | Q12 / 7.4 |
| M-A | `accounting.service.ts` ×7, `lead-sources/dal/server/crud.ts:66`, `meetings.router/business.router.ts:118` (`rescheduleMeeting` creates under `SYSTEM_CONTEXT`) | net-new `SYSTEM_CONTEXT` bypasses from main | 7.3 (F3) |
| M-C | `lead-sources.router.ts` ×4, `projects.router/business.router.ts` ×3, `projects.router/crud.router.ts` ×3 | `{ ...ctx, scope: null }` omni-by-construction | 7.3 |
| M-D | `proposals/dal/server/queries.ts:322,335,351,364`; `media-files/dal/server/mutations.ts` ×3 | `ctx.scope ?? undefined` silent-omni reads | 7.3 |
| M-E/G | `voip-campaigns.router.ts:52` `listContactFields` ctx-less; `participants.ts:36,168`, `google-calendar.ts:110-114` ctx-less DAL calls on the reschedule path | authz decided nowhere | 7.3 |
| M-F | `lead-sources/lib/server-spec.ts:27`, `voip-contact-fields/lib/server-spec.ts:17` | new legacy `spec.visibility` consumers | 7.1 strip → 8 |

### 5.2 Ledger 1 — financial-read leak sites (→ 7.6)
`get-customer-profile.ts:90-116` (CONFIRMED dispatcher-reachable; gated defensively by `c62813d5`), `get-customer-pipeline-items.ts:256-272`, `:206-221`, `:428-442` (weakest), `get-action-queue.ts:120-142`, `customer-pipelines.router.ts:118-123`. Correct in-repo pattern: `move-customer-pipeline-item.ts:127`, `proposal-incentives/mutations.ts:47`.

### 5.3 Ledger 2 — auth-in-hooks retirement (→ 7.4)
| Rule | Imperative today | Becomes |
|---|---|---|
| Activity own-record | `schedule.router/activities.router.ts` (5 procs, raw `db.*`, mixed silent-scope/FORBIDDEN) | CASL `{ ownerId }` + bespoke DAL on the adapter (#226) |
| CustomerNote author-or-admin | `assert-note-author.ts` + spec hooks + client mirror `use-customer-note-action-configs.ts:63-64` | `can(['update','delete'],'CustomerNote',{ authorId })` |
| Meeting participation gate | `meetings.router/participants.router.ts:37-44` | reuse `$participatesViaMeeting` |
| Envelope-field agent-only | `proposals.router/contracts.router.ts:189-196` (`ctx.ability == null` as role proxy) | CASL field rule on the bearer ability |
| Meeting cancel → GCal hook | `meetings/dal/server/crud.ts:150-160` `update.after` (main) | not an auth hook; list it so the hook inventory is complete |

### 5.4 Retiring-seams register (every shim carries `@deprecated` → its replacement; renames are not shims)
| Seam | Replacement | Dies in |
|---|---|---|
| `SYSTEM_CONTEXT` (30 + 9 sites) | `systemContext(reason)` | 7.3 |
| `Actor` union (`user\|token\|system`), `userActor`/`tokenActor`/`systemActor`, `resolve-trpc-actor-scope.ts` | `Actor` record, `getRequestActor` / `bearerActor` / `systemContext` | 7.3 |
| `ctx.scope`, `requireResolvedScope`, per-entity `<entity>Procedure`, `systemProcedure`, `ctx.ability` | DAL self-scope (D-16) + D-13 ladder | 7.2 / 7.3 |
| `buildUserContext`, `isInScope` (`scope.ts:94` residual `?? undefined`), `isVisible` (0 callers) | `scopedWhere` / `canAccess` | 7.3 |
| `resolveEffectiveScope` / `bridgeToParent` / `resolveVisibilityScope` / `scope-middleware.ts` / `spec.visibility` | adapter + `spec.parent` | 8 |
| `assertCanUpdateFields`, `assertNoteAuthorOrAdmin`, 4 client mirrors | `permittedFieldsOf`, CASL conditions, `useAbility` + `subject()` | 7.3 / 7.4 / 7.5 |
| interim staff gate `can('access','Dashboard')` | future is-staff reconception (marker only) | — |

### 5.5 IDOR ledger (2026-08-18 census) — status
§8-1 meeting-flow ✅ P4 · §8-2 contracts.age ✅ P4 · §8-3 proposal-views token ✅ P4 · §8-4 `?? undefined` ✅ P4 (26 sites) · #4 `assignToProject` ✅ P4 · #6 `getRecordingUrl` ✅ P4 · #7 activities owner check ✅ P4 (returns FORBIDDEN — Phase 9 residual) · #1 projects `media.router` ✅ P6 · **#2 projects `crud.router` → E1-1 (7.0)** · **#3 projects `business.router` → M-C (7.3)** · #5 pipeline drift ✅ superseded by outcome-derivation (P5) · watch: `push.sendTestToSelf` throttle on demotion.

### 5.6 Stale-ref pings not yet fixed
README §G3 list (21 pings from report 05 §2) → 7.0 for the no-design-dependency set; the DOCS/convention rewrites → 8. New from the merge: `reference-meeting-outcome-abbreviations.md:22` vs main's `outcome-pipeline-map.ts:12,15` (Q11); `proposals/DOCS.md:345` (homeowner drives envelope writes — stale, code wins; Q7 7b); `meetings/DOCS.md#ownership-model` vs code (no role but super-admin may delete — meets at Q8 #5); main's `meetings/DOCS.md` names `can('own','Meeting')` as the write gate (citable for Q8 #4).

---

## 6. Dependency graph

```
Phases 0–6 + A + dispatcher corrections ✓ (history at b40403b6)
  ├─→ 7.0 P0 fixes on main (hotfix path)   [AFK; independent]
  └─→ 7.1 supersede merge ✓ (2b038591, 2026-10-05)
              └─→ 7.2 context unification [AFK]  (handoff 13)
                    └─→ 7.3 engine plumbing — adapter restored, DAL self-scope, bearer   [AFK; parity gate — J7]
                          ├─→ 7.4 rules matrix + own-record retirement   [HITL: Q7, Q8; #217/#220 for Meeting rows]
                          │      └─→ 7.5 client (one ability)            [AFK after Q10]
                          └─→ 7.6 wall + financial                       [AFK after J6]
                                 └─→ Phase 8 delete legacy engine + docs rewrite   [AFK]
                                        └─→ Phase 9 E2E gate → single merge        [HITL]
Merge main → branch again at every phase boundary (D-22).
```

---

## 7. Tracking rules

- **This doc** is the tracker. Check a box when the unit lands green; fill its **Plan:** pointer when the JIT plan is written. A change of design edits §2 in place and adds one dated line to Appendix A; the old text moves to §2.2 as a superseded row, never stays as a struck-through paragraph.
- **README §L** is the decision *log* (append-only per decision; a reversal is a new L-entry that names the one it reverses). Reports `01`–`16` are evidence and are never edited.
- Memory: `project-permissions-casl-compiler.md` carries the pointer + the session lineage; refresh it at every unit boundary.
- Per-unit plans: `docs/superpowers/plans/2026-MM-DD-casl-phase-7-<unit>.md`.

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
- **2026-10-05** — Docs banked (`c19eddce`). **Supersede merge `2b038591`** (owner's choice over a literal merge and over a fresh branch): tree = main `61d3e1e2` + the permissions docs; 76 branch commits kept as ancestors; branch pushed to origin. 7.1 closed; 7.0 reduced to the P0 fixes on main; Q11 and M-R1/M-R2 move to 7.3; J3 and conflict #10 no longer exist. Same day: **L13 ratified** (D-08) and **L14** (D-26: specs as the single typed source, after a type probe on the real tables). Structure walk-through approved in six sections → **L15** (names, `permit` in the DAL library, `bearerContext`, `@casl/react` kept, rules sent from the root layout, no test runner) and the structure spec `docs/superpowers/specs/2026-10-05-permissions-structure-design.md`.

## Appendix B — Pointers
- Decision log + audit: `docs/plans/2026-09-07-casl-re-grounding/README.md` (§L) and reports `00`–`16`.
- Engine design: `docs/superpowers/specs/2026-08-10-casl-scope-compiler-design.md` (v2; §3 actor union and §6/§8 actor interfaces are superseded by D-09/D-11/D-14).
- Per-phase plans: `docs/superpowers/plans/2026-08-10-casl-phase-0-engine-scaffolding.md`, `2026-08-11-casl-phase-1-per-entity-cutover.md`, `2026-08-12-casl-phase-3-robustness-gate.md`, `2026-08-18-casl-phase-4-actor-seam-hardening.md`, `2026-08-19-casl-phase-5-customer-pipelines-adoption.md`, `2026-08-20-dispatcher-visibility-corrections.md`, Phase-6 spec/plan (`6c565a66`).
- Business rules: `docs/permissions/visibility-rules-catalog.md` (Parts 1–2 current; 3–4 pre-CASL), per-entity `DOCS.md`, `docs/ubiquitous-language.md`, report 10 (matrix).
- Residual redesign: `docs/plans/2026-09-04-customer-pipelines-feature-boundary-refactor.md`.
- Reference implementation: `WebDevSimplified/casl-crash-course` (`getUserPermissions.ts`, `drizzleAdapter.ts`, `todos.ts`) — borrowed: `subject()` tagging, per-field checks, fail-closed interpreter; NOT borrowed: `@ucast/core` direct import, `undefined`-for-deny.
- Memory: `project-permissions-casl-compiler.md`, `project-casl-phase-5-customer-pipelines.md`, `project-casl-mutation-legacy-split.md`, `project-backend-refactor-roadmap.md`.
- Issues: #285 (epic), #210, #218, #220, #217, #226.
