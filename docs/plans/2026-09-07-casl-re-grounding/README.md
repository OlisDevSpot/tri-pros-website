# CASL permissions epic (#285) — re-grounding audit + requirements (2026-09-07)

> **What this is.** A reality-rooted map of where the #285 worktree actually stands, the code etiquette we decided on but never implemented, and a requirements list for re-orienting the epic so it is CASL-centric with a proper CASL→Drizzle adapter (reference: `WebDevSimplified/casl-crash-course`).
> **How it was produced.** Five read-only audit agents (docs truth · engine-vs-reference · per-entity reality map · branch drift + tsc/lint baseline · convention audit) ran in parallel against this worktree at `b40403b6`; every security-relevant claim below was re-verified by hand in the code. The full reports live beside this file (`01`–`05`). All `file:line` cites are as of `b40403b6`.
> **Precedence.** This document supersedes the *sequencing* prose in `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (Phase 7 / 7.5 / 8 blocks). It does NOT restate the design spec; the engine design in `docs/superpowers/specs/2026-08-10-casl-scope-compiler-design.md` §2–§6 still holds except where §C below says otherwise.
> **Status of this doc:** proposal. Nothing here has been executed. Decisions the user must make are collected in §J (superseded where §L rules) and in §L "Still open".
> **Orientation 2026-09-16 (session `a078cbb8`):** reports 18–24 (decision map · branch API inventory · main drift rebaseline · entity topology · four design-it-twice interface alternatives · comparison + hybrid) — the hybrid in `24-design-comparison-and-hybrid.md` §4 is the proposed L13 close-out, pending the user's ruling.
> **Verification 2026-09-09 (session `a078cbb8`):** every library/framework claim under §L was checked against Context7 + the installed packages — `14-casl-api-verification.md` (CASL/ucast/@casl/react), `15-context-stack-verification.md` (tRPC 11.9 / Next 15.5 / React 19.2 `cache()` / better-auth 1.6.9); the merge picture was rebaselined against main `a4ff81bb` — `16-merge-rebaseline-2026-09-09.md`. **All §L decisions stand.** Mechanism corrections are edited INTO L7/L8/L10 and C8 below (no banners); the one new open decision is L11.

---

## §A. Where we actually are

### A.1 Branch + baseline
| Fact | Value |
|---|---|
| Branch | `refactor/285-refactor-permissions-casl-scope-compiler` @ `b40403b6`, worktree `.worktrees/issue-285` |
| vs `main` | **74 ahead / 46 behind** as of 2026-09-09 (merge-base `bd35a168`; was 36 behind at the 09-07 audit). Main advanced through the JSONB W3 prod cutover, JustCall migration, CRUD-DAL sub-plan D, projects-std Phases 2/3, and (09-07→09-09) the meeting-reschedule feature (10 commits, 35 net-new permission-relevant sites — report 16 §3). |
| `pnpm tsc` / `pnpm lint` | PASS / PASS (0 errors, 63 pre-existing warnings) |
| Uncommitted | `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (+51/−2, the "CASL-native re-orientation" section — **unsaved decision, at risk**); `.claude/agents/knowledge/convention-auditor-ledger.md` (agent ledger, this audit); untracked `CLAUDE.local.md` (dispatch file still describing **Phase 0** and instructing `pnpm build`, which contradicts the no-build rule) |
| Dry-run merge `main`→branch | **10 conflict entries / 9 paths** (rebaselined 2026-09-09, report 16 §2; was 9/8). Worst: `projects.router/media.router.ts`, `customer-notes/lib/server-spec.ts` (main relocated hooks into `dal/server/crud.ts`; branch's `canAccess` probe from `5a983124` must be ported or it regresses), **`create-crud-dal.ts`** and **`types.ts`** (the exact files the Phase-7 cutover edits), the epic doc (add/add). |
| GitHub | Issue #285 still titled/bodied as **Phase 0**, 0 comments. Open, unlinked permissions issues: **#210 (P0)** agent-scoped visibility leak, **#218** owner-delete via CASL conditions, **#220** participant-role permission model, **#217** participant role enum, **#226** activities → Entity Server System. |

### A.2 Phase ledger — documented vs real
| Phase | Docs say | Reality (code) |
|---|---|---|
| 0–3 engine, per-entity root cutover, robustness gate | DONE | ✅ Confirmed: 4 roots compile from CASL via `resolveTrpcActorScope` in their `procedures.ts`; `assertScopeWiring` live. |
| 4 actor-seam hardening | DONE | ✅ §8 drivers closed; `requireResolvedScope` at 26 sites. ⚠ `systemContext(reason)` has **1** call site, `SystemReason` has 2 variants; **30** bare `SYSTEM_CONTEXT` sites remain. |
| 5 customer-pipelines on `ctx.actor` | DONE | ✅ `ctx.actor` required on `ScopedContext`; profile/pipeline reads on actor scope. ⚠ Landed "defensively" (`maskFinancials`, `canReadProposals` threading) — self-critique in `docs/plans/2026-09-04-customer-pipelines-feature-boundary-refactor.md` (on this branch, not main). |
| 6 owned children | DONE | ✅ `parent` on customer-notes / applications / media-files / proposal-media-files; `customerNoteVisibility`+`applicationVisibility` deleted. ⚠ customer-notes + applications factory leaves still resolve through the **legacy** default (`create-crud-router.ts:98`). |
| A dead-code delete | DONE | ✅ 9 orphan `*Visibility` fns + `scopeMiddleware` gone. `isVisible` still exported with 0 callers. |
| Dispatcher corrections | DONE 09-06 | ✅ `['leads','rehash','dead','fresh']` + all-meetings + note grants shipped (`ad71a076`, `5fec560b`, `5a983124`). |
| **7** | "IN PROGRESS" | ⚠ Rests on `3e901178` + `b40403b6`, which the uncommitted re-orientation orders **reverted** (wrong layer). **No plan exists for the re-oriented Phase 7.** Grill C never grilled. |
| 7.5 / 8 / 9 | scheduled | Untouched. Phase-8 `blocked-by: Phase 4–7 (Track B only)` and the 7.5 block are stale after the re-orientation. |

### A.3 Which engine actually runs, per entity (from `03-entity-reality-map.md` §A)
| Entity | Reads | Mutations | Notes |
|---|---|---|---|
| Customer | CASL | CASL (router seam `3e901178`) | Reverts to legacy default on unwind → dispatcher edit regression (§B3). |
| Meeting | mixed | mixed | CASL except `meeting-flow.getPersonaProfile` (`buildUserContext`) and `projects.business.create` write; router seam `b40403b6`. |
| Proposal | mixed | **legacy** | `business.list`/contracts/delivery on CASL; **crud leaf + every shareable procedure on legacy** (`shareable-middleware.ts:45`). |
| Project | mixed | **none** | `list` on CASL `projectProcedure`; `getAll`/`getForEdit`/`create`/`update`/`delete` on bare `agentProcedure`, ctx-less DAL (`projects.router/crud.router.ts:14-65`). |
| CustomerNote | legacy (customer bridge) | create CASL probe; update/delete legacy + `assertNoteAuthorOrAdmin` hook | Dispatcher note update/delete on non-`leads` customer → NOT_FOUND (known). |
| Application | legacy (meeting bridge) | legacy | `applications.router/procedures.ts:21` still `resolveVisibilityScope`. |
| MediaFile / ProposalMedia | CASL | CASL (google-drive create unscoped) | Phase 6. |
| Activity, User, LeadSource, AppSetting, 7× VoIP | outside both engines | outside both | Hand-rolled owner checks / `superAdminProcedure` / `SYSTEM_CONTEXT`. |

**Live legacy footprint:** 19 reachable legacy-engine calls (`resolveEffectiveScope` 4 · `resolveVisibilityScope` 2 · `buildUserContext` 2 · `bridgeToParent` 1 · `isInScope` 1 · `userParticipatesInMeeting` 4 · one each of `customerVisibility`/`userCanSeeCustomer`/`meetingVisibility`/`proposalVisibility` · `spec.visibility` read 1). 3 specs still declare `visibility:` (customers, meetings, proposals).

### A.4 Why it derailed (root causes, so the fix is structural)
1. **The tracker grew by stacking, not replacing.** Three generations of Phase-7 prose in 17 days (mechanical sweep → Track B/C split → CASL-native), each adding a "read me FIRST, supersedes below" banner while leaving the header, phase table, dependency graph, Phase-8 `blocked-by` and 7.5 block untouched. A fresh session reading top-down gets three answers.
2. **A locked rule was superseded verbally and never retracted in writing.** Phase-5 plan L18 / epic L100 / `types.ts:39-45`: "the factory is permission-agnostic — MUST NOT read `ctx.actor`". Grill B (08-20) decided the opposite; the text stayed. A later session honored the written rule and built the router seam (`3e901178`) — exactly the layer the re-orientation calls wrong.
3. **Grill outcomes were recorded as narrative, not as a current-state decision table.** The spec v2 is frozen "as-authored"; nothing holds *today's* design in one place. (Example flip pair: Grill B #1 "`permittedFieldsOf` YAGNI'd" vs re-orientation "`permittedFieldsOf` replaces `assertCanUpdateFields`".)
4. **The equivalence gate is manual** (no test runner → hand `EXPLAIN` per role×entity), so flips got hand-waved or skipped.
5. **Scope accreted onto the branch mid-epic** (dispatcher corrections, financial wall, customer-pipelines refactor) while main moved 36 commits, and the merge policy says "merge once at Phase 9".

---

## §B. Unwind (before any new Phase-7 code)

- **B1.** Revert the router-seam *code* of `3e901178` + `b40403b6` in ONE hand-authored commit (`revert(permissions): unwind router-seam flips …`): `src/trpc/lib/create-crud-router.ts` (drop the `resolveScope?` option entirely — it re-mints the retired name `resolveScope`), `customers.router/crud.router.ts`, `meetings.router/crud.router.ts`. ~55 lines. `git merge-tree` dry-run: `b40403b6` clean; `3e901178` conflicts only on `customers/lib/visibility.ts` (comment block) + the epic doc. No later commit depends on the seam (`5fec560b` predates it; `b0d50234` is docs-only).
- **B2.** Keep two knowledge items from those commits in the tracker, not in code comments: (i) the **child-bridge death-timing rule** — a `*Visibility` fn dies only once its entity AND every child declaring `parent:<spec>` AND every `buildUserContext`/shareable caller are on CASL; (ii) the **Meeting parity analysis** (agent `via:'self'` ≡ `userParticipatesInMeeting`; omni→null both; dispatcher = intended widening) as the template for the per-entity equivalence gate.
- **B3. USER RULING.** The revert re-opens two dispatcher bugs until the DAL cutover: customer edit NOT_FOUND on `fresh|rehash|dead` (legacy `customerVisibility:33` = `['leads']` vs CASL 4-bucket), and getById/update on a dispatcher-booked meeting. Layer-neutral interim: widen the legacy fn's dispatcher branch to the 4-bucket set (one line) and inspect `meetingVisibility`'s dispatcher branch. Recommended if dispatchers are live.
- **B4.** For `customers/lib/visibility.ts` keep a *corrected* comment (paths do NOT agree: legacy `['leads']` vs CASL 4-bucket), not the original false one and not the "DEAD" tombstone.

---

## §C. Engine plumbing = the real Phase 7 ("CASL-native")

**Adapter verdict (from `02-engine-vs-reference.md` §F): the CASL→Drizzle core is sound and canonical — and stricter than the reference.** `compileScope` + `interpret` is the same `rulesToAST → AST walk → and/or/eq` pipeline as the reference's `drizzleWhere`, plus: `null`→``sql`false` `` (deny) distinct from empty-AND→`null` (allow) (the reference collapses deny into `undefined`), `not`/`in`, column-existence throw, custom document operators with boot asserts, `token`/`system` actors, fail-closed on every unknown shape. **Keep the adapter. Everything around it is the gap.**

| # | Requirement | Evidence today | Borrowed from reference? |
|---|---|---|---|
| **C1** | `resolveActorScope(spec, actor, action)` is action-aware; `canAccess`'s child branch honors `action`. | `'read'` hardcoded at `resolve-actor-scope.ts:25-26`; child probe ignores action `:62-66`. | `drizzleWhere(action, …)` at every call site. |
| **C2** | `createCrudDal` **self-scopes per slot off `ctx.actor`**: getById→`read`, update→`update`, delete→`delete`. Retire `requireResolvedScope(ctx.scope)` at `create-crud-dal.ts:117/213/264`. ONE resolution point serves tRPC, services, jobs, webhooks (they already stamp real actors: `SYSTEM_CONTEXT.actor`, `buildUserContext(...).actor`, tRPC `userActor`). **This formally supersedes Phase-5's "factory MUST NOT read `ctx.actor`" — record it in the decision table (§G1).** | Factory reads `ctx.scope` only. | Reference scopes at the DAL (`dal/todos/queries.ts`). |
| **C3** | **Child own-column conditions compile** (the OPEN grill). Recommend **shape (a)**: `childScope = compileScope(actor, action, childSubject)[own-column conditions] AND parentBridge('read')`. The spec-§5 "missing-FROM hazard" is about *parent*-column conditions on the child table; `interpret`'s `columnOf` existence check already throws on a non-own column, so (a) is safe by construction. Shape (b) (notes as roots + `$customerVisible` operator) discards the Phase-6 `parent` investment and needs one operator per parent. | `verbOnly` + bridge only; a `{authorId}` on CustomerNote would be **silently dropped** (`resolve-actor-scope.ts:24-26,42-48`). | Reference compiles every subject from its own rules. |
| **C4** | `create` slot gets a scope: children probe the parent FK (`canAccess(parent.spec, actor, fkValue, 'read')`), roots run `verbOnly(actor,'create')`. Closes the create-side IDOR class (§E1-4). | `create` applies no scope/probe (`create-crud-dal.ts:129-157`). | — |
| **C5** | Retire `ctx.scope` from `ScopedContext` → `{ session, ability, actor, tx? }` (open: whether `ability` survives separately from `actor.ability`; recommend keep for router verb checks, derived from the actor). Until then, stop stamping `scope: null` at `init.ts:60` — it makes `null` mean both "omni" and "nobody resolved this", neutering `requireResolvedScope` on every tRPC path. | `init.ts:60`; `helpers.ts:95-102`. | — |
| **C6** | Field-level via `permittedFieldsOf(ability, action, subject(spec.caslSubject, row), { fieldsFrom })` **post-load** in the update slot; retire `assertCanUpdateFields` (`create-crud-router.ts:214-230`). Must run on the **token path too** (see E1-3) — which forces decision §J2. | Type-level only, skipped when `ctx.ability` is null (`:147-149`). | `todos.ts:51-53` per-field instance check. |
| **C7** | Adopt `subject(type, row)` for post-load instance checks (`ability.can('update', subject('CustomerNote', row))`). The comments claiming CASL "can't express own record on plain-string subjects" (`abilities.ts:100-103,124-125,204-206`) are **false** and drove the auth-in-hooks anti-pattern. | 0 uses of `subject()`. | `todos.ts:17,31,48…` |
| **C8** | Type conditions per subject against real columns: `Pick<typeof customers.$inferSelect, 'ownerId' | …>` instead of the hand-maintained `AppConditions` union (`types.ts:51-56`). **Mechanism corrected 2026-09-09 (report 14 §1.10):** instance-typed subjects with CASL's default `MongoQuery` REJECT custom top-level operators (TS2769), and the repo's original TS2769 was caused by all-string subjects making `InstanceOf` = `never` (even `{ ownerId }` failed). Working 6.8.0 shape = hand-rolled `AppQuery<T>` + `hkt.Container` brand (report 14 §1.10 V6; per-call `can<WithOps<Row>>()` V8 as fallback). Uses only `@casl/ability` exports, so C12 holds. | Runtime-only `columnOf` catch. | `getUserPermissions.ts:5-10`. |
| **C9** | Fix `interpretCompound`: a `null` (allow-all) child inside an **OR** must make the whole OR allow-all; today it is filtered out and `or(allow, X)` degrades to `X` (`interpret.ts:49-56`). Over-restrictive, currently unreachable, semantically wrong. | verified | — |
| **C10** | Operators assert their subject binding: `$participatesViaMeeting{via:'meetingId'}` hardcodes `proposals.meetingId`, `$inDerivedPipeline` hardcodes `customers.id`; neither checks `ctx.table` (`scope/operators/meeting-participation.ts:59-63`; `scope/operators/derived-pipeline.ts:14` says "only makes sense on the Customer subject" but does not assert it; SQL at `entities/customers/lib/derived-pipeline-sql.ts:25,41`). | latent mis-authoring hazard | — |
| **C11** | `import 'server-only'` on `interpret.ts`, `compile-scope.ts`, `operators/*.ts`. Today the client-bundle boundary holds by import topology + comments only. | `operator-names.ts:4-12` | — |
| **C12** | Keep the structural AST (`scope/ast.ts`); do **not** add `@ucast/core` unless `instanceof` dispatch is adopted (it is a transitive dep under pnpm's no-hoist). | — | reference imports it undeclared |
| **C13** | Dead surface: decide `$hasNoMeeting` (recommend drop), delete `isVisible` (0 callers), `ScopeOperator.parseValue/toJS`, `registeredOperatorNames()`, `app-sidebar.tsx:74` duplicate ability build. | `02` §E-9, E-14 | — |

---

## §D. Rules authoring (HITL — business rulings, not code)

- **D1.** Produce a **role × action × subject matrix** (conditions + fields per cell) for every scoped subject — Customer, Meeting, Proposal, Project, CustomerNote, Application, MediaFile, Activity — reviewed by the user **before** `abilities.ts` is touched. Today conditions exist only on `read` rules and fields only on two `update` rules; **every mutation rule is conditionless** (`abilities.ts:113,126-129,132-133,137-138,142-143,151-152,156-158,236,253-256`).
- **D2.** Meeting `update`/`delete` conditions depend on the ownership model → sequence **#217 (role enum) → #220 (role permission matrix) → Meeting rules**. **#218** (owner delete `{ownerId}`) becomes a row in D1, not a separate feature. `meetings/DOCS.md#ownership-model` already claims "owner OR super-admin can delete" — the code grants delete to **no role but super-admin** (`03` §E-6): doc and code must meet at D1.
- **D3.** Migration invariant (epic "critical invariant" §2) extended to mutations: conditions **replace** the conditionless verb per action; audit that no conditionless `can(update|delete, X)` survives beside a conditional one (CASL OR-merges → allow-all leak).
- **D4.** Own-record rules into CASL and the imperative gates retired (Ledger 2): CustomerNote `can(['update','delete'],'CustomerNote',{authorId})` → delete `assert-note-author.ts` + spec hooks + client mirror `use-customer-note-action-configs.ts:63-64`; Activity `{ownerId}` (5 router procs, raw `db.*` — needs #226 or a bespoke DAL on `resolveActorScope`); participants dedup → reuse `$participatesViaMeeting`; contracts envelope gate (`ctx.ability == null` as role proxy) → field rule.
- **D5.** Client affordances read the **same ability** (`useAbility().can(action, subject(type,row))`) — no hand mirrors. Rules are already shared (`defineAbilitiesFor` on server `init.ts:7` + client `casl-provider.tsx:16`); coverage is the gap, not the mechanism.

---

## §E. Reality-rooted security findings + the wall

### E1. Fix now, engine-independent (they are bypasses of BOTH engines)
| # | Site | Who / what | Fix |
|---|---|---|---|
| E1-1 | `projects.router/crud.router.ts:14-65` | any agent **or dispatcher** can `getAll`, `getForEdit`, `update`, **`delete` any project + its R2 media** (agents hold no `delete Project` grant); ctx-less DAL calls | move the 5 slots onto `projectProcedure` + `canAccess` + `assertCan` (epic IDOR #2, Phase 7f) — pull forward |
| E1-2 | `ai.router/index.ts:7-22` → `ai/client.ts:96-113` | **unauthenticated `baseProcedure`** dispatches a job that raw-updates `proposals.projectJSON` for any `proposalId` | gate on agent/token + probe |
| E1-3 | `create-crud-router.ts:118-120,147-149` + `shareable-middleware.ts:67` | proposal **share-token bearer** reaches `crud.update` with `ability: null` → verb + field gates skipped → **any column** of the token's row is writable (row is contained; columns are not) | interim: deny `update` on the token branch unless an explicit allowlist; final: §J2 |
| E1-4 | create-side IDOR class: `meetings/dal/server/crud.ts:33-38,52` (create meeting on any `customerId`, creator becomes participant → **gains visibility of that customer**), `proposals/lib/server-spec.ts:53-58` (copies any meeting's `flowStateJSON` via `SYSTEM_CONTEXT`), applications create on any meeting, project-media create on any project (`media.router.ts:42-48`), `google-drive.router.ts:50-124` | agent / dispatcher | C4 (create-slot parent probe) |
| E1-5 | `customer-pipelines.router.ts:103-124` | after the CASL *meeting* probe, proposals (`:118-122`) + projects (`:111-115`) read **unscoped** — dispatcher has no Proposal/Project grant | route through owning DALs (Ledger 1) — this is the live residual of **#210** |
| E1-6 | `move-customer-pipeline-item.ts:61-71` raw `db.update(projects)`; `landing.router/index.tsx:137` raw `db.insert(customerNotes)` (skips hooks + author stamp); `schedule.router/sync.router.ts:43-57` pushes **all** unsynced meetings to GCal for any agent; `activities.router.ts:254` raw delete | various | through owning DAL / scope |

### E2. The wall (Grill B #5, still unbuilt)
- ESLint rule (`project/no-raw-scoped-table-outside-dal`): forbid a *separate-query* `db.select().from(<scoped table>)` / `db.query.<scopedTable>` outside `entities/<x>/dal/`, with explicit allowlist for `domains/permissions/scope/operators/*` (they must emit subqueries — also needs a written carve-out in `dal-conventions.md#only-dal-imports-db`) and tombstoned S8-owned files (`lead-sources.router.ts` ×13). ~45 sites today.
- The 6 Ledger-1 financial sites + the Grill-D customer-pipelines read API redesign (types make financial exclusion structural; kill `maskFinancials`) ride with it (Phase 7d).

---

## §F. Legacy retirement (Phase 8) — re-gated, not redesigned
- **F1.** `blocked-by` = the whole re-oriented Phase 7 (not "Track B only"); Phase 7.5 is **deleted** as a phase (folded into §C/§D).
- **F2.** `@deprecated` tags now on the registered-but-untagged shims: `SYSTEM_CONTEXT`, `resolveEffectiveScope`/`bridgeToParent`/`isVisible`, `resolveVisibilityScope`, `buildUserContext`, `meetingVisibility`, `proposalVisibility`.
- **F3.** `SYSTEM_CONTEXT` → `systemContext(reason)` classification: 30 sites (plus ~20 more arriving from main's sub-plan D), closed `SystemReason` union gains `webhook:* | sync:* | intake:* | admin:*` (today: 2 variants).
- **F4.** One `tokenActor` factory: `shareable-middleware.ts:62` must go through `validateShareToken`/`resolveShareTokenActor`; kill `intake/page.tsx:40` hand-rolled compare; `validate-share-token.ts:19` raw `db`.
- **F5.** `agentProcedure → staffProcedure` (0/23 files) stays LAST.
- **F6.** Delete engine + omni collapse; settle the count (3 sites per spec/epic vs 4 per catalog incl. `scope.ts:71`).

---

## §G. Tracker + docs hygiene (the anti-derailment work)
- **G1.** **Rewrite, don't stack.** Consolidate the epic tracker: one current Phase-7 definition (this doc's §B–§E as units), superseded prose moved to a dated *History* appendix; update header, phase table, dependency graph, Phase-8 `blocked-by`, delete the 7.5 block — in the same edit. Add a **"Current design decisions" table** (decision · date · LOCKED/SUPERSEDED-by) covering at least: factory-agnostic→DAL self-scopes; `permittedFieldsOf` YAGNI→adopt; Track B/C split→one design; verb-only child→§J1; `ctx.actor` optional→required; tokenActor abilityless→§J2. Rule going forward: **a supersession edits the superseded text.**
- **G2.** Commit the re-orientation now (it is the only record of the 09-06 decision).
- **G3.** 21 stale-ref pings (`05-convention-audit.md` §2). Fix **now** (no design dependency): 3 dead slug anchors (`scope-middleware.ts:1,17`; 4× `procedures.ts:5`; `meetings/dal/server/crud.ts:164`); false comments `abilities.ts:168-170,204-206,281-284`, `media-files/lib/server-spec.ts:26-31`, `resolve-actor-scope.ts:18,63,88`, `types.ts:7,23,174,183-191`, `create-crud-dal.ts:6`, `customers/dal/server/queries.ts:64-65`, `entities/customers/lib/phone-gating-sql.ts:9`. Fix **with C2**: per-entity `DOCS.md` visibility sections (customers/meetings/proposals/projects), `docs/how-to/add-an-entity.md` Step 3 (author `can('read',X,{cond})`, not `lib/visibility.ts`), `dal-conventions.md:46-58,178` (`ScopedContext` shape, `?? undefined` idiom), `src/trpc/DOCS.md:150-165,232-251,360-366` (add a "two engines coexist" note **now**; full rewrite at Phase 8). `visibility-rules-catalog.md` Parts 3/4: mark superseded with date. ADR-0002 amendment stays at Phase 8.
- **G4.** GitHub: retitle #285 to the epic, link the tracker; cross-link #210/#218/#220/#217/#226 with their landing unit (E1-5 / D2 / D2 / D2 / D4); verify #210's meetings/proposals leak is closed by Phase 5 and retitle it to the E1-5 residual.
- **G5.** Memory `project-permissions-casl-compiler.md` still says "6 phases 0–5" — refreshed 2026-09-07 to point here. `CLAUDE.local.md` (untracked dispatch file) is stale — regenerate via `pnpm dispatch` or delete.

---

## §H. Integration / merge
- **H1. Merge `main` → branch BEFORE Phase-7 code.** 36 behind; the 9 predicted conflicts include `create-crud-dal.ts` and `types.ts` — the files C2 rewrites. Writing C2 against the pre-merge factory guarantees a second, worse conflict.
- **H2.** During the merge: port `5a983124`'s `canAccess` probe into main's `customer-notes/dal/server/crud.ts`; re-classify (F3) the ~20 new `SYSTEM_CONTEXT` / `{...ctx, scope:null}` sites main added; note main's two new legacy `spec.visibility` consumers (`lead-sources`, `voip-contact-fields`) and `listImportableProjectMedia` (unscoped on main).
- **H3.** Reconcile the CRUD-DAL mutation-interface epic on main (its §3.2 "DAL is actor-agnostic" contradicts C2); the sub-plan A design doc it cites does not exist in this worktree — locate on main or drop the reference.
- **H4.** Merge policy amendment: keep "branch → main once, after E2E (Phase 9)", but **merge main → branch at every phase boundary** to cap drift.

---

## §I. Verification
- **I1.** Equivalence gate becomes **rerunnable**: a checked-in `scripts/permissions/explain-parity.ts` (tsx, `DRIZZLE_TARGET=dev`) that prints compiled SQL per role × entity × action next to the legacy fragment; recorded per unit. Better: adopt vitest for the *pure* compiler (`interpret`/`compileScope`/`resolveActorScope`) — the epic itself names these as the first real tests if a runner is adopted. **⚠ Conflicts with a prior user ruling** (memory `project-permissions-casl-compiler.md`, 2026-08-11: "repo has NO test runner — user ruling; don't add vitest/scripts"). Surfaced as §J7, not assumed. The manual-EXPLAIN gate is the documented reason flips got hand-waved (§A.4-4), so the ruling is worth revisiting on that evidence alone.
- **I2.** Phase-9 E2E matrix written now as a checklist (roles × entities × actions; false-ALLOW and over-deny; §8 closures; homeowner-always-token), driven through `/api/dev/playwright-session`.

---

## §J. Decisions needed from the user (HITL)
| # | Decision | Recommendation |
|---|---|---|
| J1 | Child own-column conditions: shape (a) compile own-column conditions + parent bridge, or (b) own-record entities as roots with a `$customerVisible`-style operator | **(a)** — keeps Phase-6 `parent`, safe via `columnOf` throw |
| J2 | tokenActor: (A) abilityless + one bearer-guard helper, or (B) `defineHomeownerAbilitiesFor(subject,rowId)` so verb/scope/`permittedFieldsOf` apply identically | **(B)**, scoped to the ~3 homeowner write endpoints — C6 needs field-level on the token path, and "one rules array everywhere" is the north star. E1-3 is the forcing bug. |
| J3 | Interim handling of the dispatcher regression the unwind re-opens (§B3) | one-line legacy parity widen if dispatchers are live |
| J4 | Merge main first (H1) vs Phase-7 code first | **merge first** |
| J5 | Rules matrix rulings (D1) — needs a sitting; Meeting rows gated on #217/#220 | schedule as a grill |
| J6 | Wall guard shape (E2) | ESLint rule + allowlist |
| J7 | Test runner for the pure compiler (I1) — **reverses the 2026-08-11 "no vitest/scripts" ruling** | minimal vitest, compiler-only; else at least the checked-in parity script |
| J8 | Tracker: rewrite (G1) vs keep appending | **rewrite** |
| J9 | `ScopedContext` end-state (C5): does `ability` stay beside `actor`? | keep, derived from actor |
| J10 | `$hasNoMeeting` keep/drop (C13) | drop |

## §K. Proposed Phase-7 unit order (once J1–J4 are ruled)
1. **7.0 Hygiene + unwind + P0** — G1–G5, B1–B4, E1-1/E1-2/E1-3(interim)/E1-5/E1-6. Engine-independent; ships green on its own.
2. **7.1 Merge main → branch** — H1–H3.
3. **7.2 Engine plumbing** — C1–C13 with the factory default flipped to `resolveActorScope(spec, ctx.actor, action)`; per-entity parity via I1 (the read scope is already ≡ legacy for the 4 roots; children are bridged; system actors → `null` unchanged; `buildUserContext` callers move to CASL — the intended dispatcher widening).
4. **7.3 Rules matrix + own-record retirement** — D1–D5 (HITL first, code second); #218 lands here.
5. **7.4 Wall + financial** — E2, Ledger 1, Grill-D read API.
6. **Phase 8** unchanged in content; **Phase 7.5 deleted**.

---

## §L. Decision log (grill of 2026-09-08 → 2026-09-09) — supersedes §C/§J where they conflict

> Every entry has the same shape so the trail of logic survives: **Context** (what was true), **Options** (what we weighed), **Decision**, **Reasoning** (why this one), **Consequences** (what it forces), **Sources**. Evidence base: `06-primitive-inventory.md` (111 primitives; "who is acting" has 7 shapes; `ctx.session.user.id` read 53×, `ctx.actor.userId` 0×), `07-flow-catalog.md` (16 token flows, all Proposal; authz decided in 47 handler bodies / 28 middlewares / 16 DAL hooks / 5 services / nowhere in 12 flows), and research reports 08–12.

### L1 — The `user | token | system` Actor union is dropped
- **Context.** The Phase-0 design introduced `Actor = user | token | system` so that "verb-checked but row-unscoped" was unrepresentable. In practice every factory returned the widened union, five call sites re-narrowed it by throwing, the engine branched on `kind` in three places, and the `token` member carried a raw `scope: SQL` that bypassed CASL entirely (`compile-scope.ts:25-26`). Meanwhile `ctx.actor.userId` was read nowhere; every identity read went through `ctx.session.user.id`.
- **Options.** (a) Keep the union and export narrow member types; (b) collapse `token` into `user` (nullable `userId`); (c) drop the union — the principal is the CASL ability.
- **Decision.** (c).
- **Reasoning.** Once a token bearer and a system caller are each expressible as an ability (L3, L7), the union has no remaining discriminating job: a "user actor" was only `userId` + `ability`, and the engine never needed `kind` if the ability itself carries the reach. Keeping a union invites branches; CASL's own model has none ("every principal is just a rule set", report 08 finding 1).
- **Consequences.** Delete `scope/actor.ts` union members, `tokenActor`/`systemActor`, the `kind` switches in `compile-scope.ts`/`resolve-actor-scope.ts`/`meeting-participation.ts`/`phone-gating-sql.ts`, `resolve-trpc-actor-scope.ts`. The word `Actor` survives with a new meaning (L7).
- **Sources.** 06 S3 #1, #14; 02 §F; 08 §1.

### L2 — Truthfulness check is `session`, not `userId`
- **Context.** The Q1 proposal offered `userId: string | null` as the bearer discriminator.
- **Options.** Discriminate on `userId` nullability vs on session presence.
- **Decision.** `protectedProcedure` requires a session. No session → only an entity's shareable procedure may admit a bearer, by validating its token.
- **Reasoning.** The session is the root fact the request carries; `userId` is derived from it. Checking the derivation invites the fabricated-session pattern (`helpers.ts:73`) and the `session: null` = "system" ambiguity (`meetings/dal/server/crud.ts:34`).
- **Consequences.** The ladder's rung 1 asserts `ctx.session` and narrows the type; bearer handling is confined to `<entity>ShareableProcedure`.
- **Sources.** 07 Part 2 rung table; 06 S3 #6.

### L3 — A token bearer is an anonymous principal with a per-row ability, not a kind
- **Context.** All 16 token flows are on Proposal; none is server-originated. The `token` actor existed only because the `homeowner` role's `read Proposal` rule is conditionless (spec §3 "homeowner is ALWAYS token" invariant) — a workaround, not a principle. The token branch stamped `ability: null`, which switched off the verb and field gates (`create-crud-router.ts:118,147`), so a bearer could update any column of its row.
- **Options.** (A) keep bearer abilityless + a bearer-guard helper; (B) build a real ability for the bearer.
- **Decision.** (B): `bearerActor(spec, rowId)` after `validateShareToken`, with rules `can('read', S, { id })`, `can('update', S, [allowlist], { id })`, `can('create','ProposalView',{ proposalId })`. The `homeowner` role's conditionless `read Proposal` rule is deleted in the same change.
- **Reasoning.** CASL's JWT cookbook is exactly this ("mint rules from the token", 08 finding 1). It compiles to the same `eq(id)` the token scope produced, and it makes the verb gate, the field gate and `permittedFieldsOf` work on the bearer path — closing the any-column bug structurally rather than with a guard. The same-change deletion is the migration invariant: a conditionless rule OR-merges with the bearer's conditioned rule into allow-all.
- **Consequences.** Two token→scope paths become one (validated). `ctx.ability == null` as a role proxy (4 sites) disappears; those checks become `ability.can(...)`. Bearer allowlist is a business ruling (§J, report 10 gap 2).
- **Sources.** 07 §1.2; 02 E-3; 08 §1, §5; 11 §1.3; spec §3.

### L4 — Compute the actor once per route
- **Context.** One dashboard page load builds the ability 7× across 3 separate session lookups (RSC guard, SSR provider, sidebar, each tRPC procedure, each prefetch), through two independent `cache()` memos.
- **Options.** (i) one `cache()`'d builder shared by tRPC `createContext`, RSC guards and `route.ts`, middlewares only narrow; (ii) tRPC-only context + separate RSC/route helpers; (iii) `.meta()`-driven auth middleware.
- **Decision.** (i).
- **Reasoning.** tRPC's docs already place identity in `createContext` (once per HTTP batch) and write middleware as `next({ ctx })` narrowing; React 19 `cache()` is the per-render memo across layout + page + prefetch. The two seams compose into exactly one build per surface. (ii) still yields two builds on prefetching pages — the one thing the ruling asked to eliminate. (iii) cannot narrow `ctx` types (documented) and does nothing for RSC/routes/jobs.
- **Consequences.** `getRequestActor()`; `get-cached-session.ts` and the RSC branch of `create-http-context.ts` fold into it; `defineAbilitiesFor` is called in one server place plus the bearer builder. Handoff: `13-handoff-trpc-context-unification.md`.
- **Sources.** 09 §A.5, §B.1–B.2, §C.

### L5 — The 5-rung tRPC ladder; per-entity scope procedures and `systemProcedure` are deleted
- **Context.** Seven `<entity>Procedure`s exist solely to stamp `ctx.scope`; none adds a gate. `systemProcedure` is an alias of `baseProcedure`. The shareable middleware duplicates `protectedProcedure`'s work on its session branch and resolves it through the legacy engine.
- **Options.** Keep per-entity rungs as early verb gates (friendlier FORBIDDEN) vs delete them and let the DAL self-scope.
- **Decision.** `base {session|null, actor}` → `protected {session, actor}` → `agent` (`access Dashboard`) → `superAdmin` (`manage all`); plus `<entity>ShareableProcedure = base.use(shareable(spec))`. Per-entity scope rungs, `systemProcedure`, `ctx.scope`, and a separate `ctx.ability` field go away. Verb gates live in the DAL slot (report 11 §3) and bespoke handlers.
- **Reasoning.** With the DAL deriving the WHERE from the ability per action (L7/L8), a cached scope on ctx is redundant and is what produced the three-way `null`. The UX change (NOT_FOUND from the DAL instead of FORBIDDEN from a middleware on 28 decision points) is the existence-non-leak behaviour the epic already mandates for client-supplied ids.
- **Consequences.** `recordView` moves from `systemProcedure` onto the proposal shareable procedure. 28 middleware decision points collapse into the DAL.
- **Sources.** 07 Part 2, Part 4; epic actor-seam conventions §2.

### L6 — (resolved by L7)

### L7 — `Actor` = `{ ability, userId }`, one builder per surface family, ids baked into conditions, reason on the rule
- **Context.** After L1 the DAL still needs an identity for data stamping (`authorId`, `ownerId`, notification exclusion — 7 sites, all `user.id`), custom operators needed `userId`, and system callers needed an audit reason.
- **Options.** DAL ctx: V1 flat `{ ability, userId, tx? }` · V2 `{ ability, session, tx? }` · V3 record `{ actor: { ability, userId }, tx? }`. Operator user id: bake into rule conditions at build time vs pass a compile-ctx param. Reason: wrapper type vs on the rule vs log only. Name: "Principal" vs "Actor".
- **Decision.** V3, named **`Actor`** (`{ ability: AppAbility; userId: string | null }` — a plain record, no `kind`). `ScopedContext = { actor, tx? }`; tRPC ctx `{ session, actor, req?, resHeaders }` is structurally a `ScopedContext`. Builders: `getRequestActor()` (cache'd), `bearerActor(spec, rowId)`, `systemContext(reason)`. User ids are **baked into rule conditions** (`{ ownerId: user.id }`, `{ $participatesViaMeeting: { via, userId } }`); `Actor.userId` is for stamping only; `OperatorCtx` shrinks to `{ table, pk }`. `systemAbility(reason) = can('manage','all').because(reason)` typed by `SystemReason`.
- **Reasoning.** "Compute once, pass as a unit" is the requirement; two loose fields at every rung is how seven identity shapes accumulated. V2 re-imports the fabricated session for jobs. Baking ids is the documented CASL idiom and is what makes the ability serializable (`packRules`) and SQL-convertible from nothing but `rulesToAST` (08 finding 2) — the whole justification for L4. A `manage all` rule set compiles to no WHERE, so the DAL never needs a system branch; `.because(reason)` stores the audit reason on the rule without a wrapper type (verified on 6.8.0: `RuleBuilder.because` sets `rule.reason`, survives `packRules`). **Corrected 2026-09-09 (report 14 §1.8):** `ForbiddenError` surfaces `reason` only for *inverted* rules, and a `manage all` ability never denies, so the retrieval path is `ability.relevantRuleFor(action, subject)?.reason` / `ability.rules[i].reason` (or `<Can>`'s render-prop `reason`), NOT `ForbiddenError`; log the reason at `systemContext(reason)` construction if an audit line is wanted. The user rejected "Principal" as a term; keeping `Actor` is a naming choice with a changed meaning, recorded here so nobody reads the old union back into it.
- **Consequences.** Handoff 13 for the upstream half. `requireResolvedScope`, `buildUserContext`, `SYSTEM_CONTEXT`-as-const retire; `systemContext(reason)` is one literal.
- **Sources.** 09 §C.1; 11 §1, §4; 08 findings 1–2.

### L8 — Mutation WHERE = `toWhere(action) AND toWhere('read')`, permanently
- **Context.** `rulesToAST(ability,'update',S)` returns unconditional-allow for a rule with `fields` but no conditions. Two such rules exist (agent `can('update','Customer',['age'])` `abilities.ts:113`; dispatcher `:236`). Today they are contained only because the factory reuses the read scope for mutations.
- **Options.** (A) AND the read scope into every mutation WHERE as an invariant; (B) `toWhere(action)` alone once every mutation rule carries conditions.
- **Decision.** (A), for `update`, `delete`, and `duplicate`'s source read.
- **Reasoning.** "You cannot mutate a row you cannot read" is a true business rule for every principal we have (the bearer's read and update conditions are the same `{ id }`). Under (A) a forgotten condition can only over-restrict; under (B) it is a leak, and the matrix has 129 rows. Cost is one AND that Postgres folds when both sides match.
- **Consequences.** The adapter's `scopedWhere` for mutation actions always composes both. **Added 2026-09-09 (report 14 §1.5):** 6.8.0's `rulesToAST` ANDs every conditioned `cannot` regardless of rule order (over-restrictive, fixed in CASL 7.0.0 #1193) — author `cannot` rules LAST per action/subject; `conditions: {}` counts as "conditioned" in `rulesToQuery` — the D3 audit treats `{}` as conditionless.
- **Sources.** 11 §3 (F2 probe); 14 §1.5.

### L9 — Parent bridge stays structural
- **Context.** Four children (customer-notes→Customer, applications→Meeting, media-files→Project, proposal-media-files→Proposal). A child may now carry own conditions (`{ authorId }`), which the Phase-5 `verbOnly` branch silently dropped.
- **Options.** (S) `spec.parent = { spec, fk, action? }` folded into `toWhere`; (R) a `$parentReachable` rule operator.
- **Decision.** (S), default bridge action `read`, own conditions compiled against the child table. **Same-subject rule:** a child whose `caslSubject` equals its parent's compiles own scope as verb-only + bridge.
- **Reasoning.** Same SQL either way; the difference is who guarantees the bridge. Under (R) a role's child rule authored without the operator silently spans every parent and the wiring assert cannot see it. Policy (who may read the parent) is in CASL; topology (this table hangs off that FK) is schema and belongs beside `table`/`primaryKey`. The same-subject rule exists because `columnOf` cannot catch same-named columns (`id`, `ownerId`) on both tables — compiling `can('read','Proposal',{id})` against `proposal_media_files` would mis-scope.
- **Consequences.** Follow-on: give `MediaFile`/`ProposalMedia` their own subjects so they can carry own conditions.
- **Sources.** 11 §2.1.

### L10 — UI reads the same ability (shipped rules + `@casl/react` + `subject()`), guarded by a boot assert on operators
- **Context.** The client never receives rules; it rebuilds from the session, so SSR first paint is deny-all (hidden by `hasMounted` guards), the bearer page has no ability, and 4 hand mirrors carry own-record/phone/pipeline logic. Zero `subject()` instance checks exist anywhere. The JS matcher cannot evaluate our custom operators: type-level `can` passes (conditions ignored); with the instruction registered but no JS interpreter (our shared matcher module) an instance check **throws**, for `can` and `cannot` alike; only a client hydrating on the *default* matcher (instruction absent) parses `$op` as a field name, where `can` is silently false and `cannot` fails **open** (report 14 §1.9 — two configurations, previously conflated).
- **Options.** Mechanism: (i) server builds → `packRules` → client hydrates with the shared conditions matcher; (ii) client rebuilds from session (today); (iii) hybrid. Guard: (a) boot assert restricting where custom operators may appear; (b) register JS interpreters that read pre-computed facts selected beside the row.
- **Decision.** (i) with `@casl/react` 7.0.1 (`AbilityProvider`, `useAbility<AppAbility>()`, `<Can>`), row-specific checks via **`subject(type, row)`** on both server (`permittedFields`, `assertCanOn`) and client (affordances), the four mirrors deleted; plus guard (a): **custom document operators may appear only on `read` rules without `fields`; never on rules with `fields`, never on `create`/`update`/`delete`.** (b) is the documented escape hatch if a mutation rule ever needs participation.
- **Reasoning.** (i) is the documented CASL pattern and the only one that yields a real bearer ability and a hydrated ability at SSR while shipping only the current principal's rules (subjects, fields, own id — never SQL bodies). `subject()` is what lets one ability answer "this note" instead of "notes in general", which is what the mirrors were hand-coding. The guard is free today (no rule violates it) and turns a runtime throw / fail-open into a boot failure; operator-bearing rules are then only ever compiled to SQL, and every instance check meets scalar conditions the matcher handles natively.
- **Consequences.** Add `@casl/react`; the dashboard layout and the proposal page RSC ship `packRules`; `casl-provider.tsx`/`app-sidebar.tsx:74` stop calling `defineAbilitiesFor`; `use-customer-note-action-configs.ts`, `can-see-phone.ts`, `get-accessible-pipelines.ts` mirrors retire; `subject()` tagging must be re-applied after JSON boundaries (it is lost across serialization — 08 finding 5).
  **Verified + corrected 2026-09-09 (reports 14 §1.1/1.2/1.9/1.12, 15 §2.7):** (i) `@casl/react` 7.0.1 exists — `AbilityProvider` takes `value=` (its README's `ability=` is stale), `useAbility<T>()`, `<Can I/do … a/an/this/on … field not passThrough>`; peer range accepts the installed `@casl/ability` 6.8.0 → **add `@casl/react` WITHOUT bumping `@casl/ability`** (its 7.0.1 is a breaking major: `PureAbility`→`Ability` rename, `rulesToQuery`→`rulesToCondition`; `rulesToAST` survives). (ii) The bundle has no `'use client'` directive and `useAbility` throws without a provider → import the package from exactly ONE `'use client'` wrapper. (iii) Under the shared matcher BOTH sides throw on operator-bearing *instance* checks, so guard (a) additionally forbids client instance `read` checks on operator-bearing subjects (type-level `can('read','Customer')` is fine), or escape hatch (b) registers JS interpreters in the shared module. (iv) `subject()` tags are also lost across superjson (the tRPC transformer) and `structuredClone`; an untagged POJO makes `permittedFieldsOf` return `[]` silently. (v) The "deny-all first paint hidden by `hasMounted`" premise was wrong for the dashboard — the only such guards are on the proposal-flow navbar (`navbar.tsx:24-32`, `navbar-menu.tsx:27-37`) and go only once the proposal page RSC also ships `packRules`. (vi) Rules-as-props are a per-request snapshot: an in-place session change requires `router.refresh()`.
- **Sources.** 12 §A–§C; 08 findings 4–6; 11 §2 (F3); 14 §1–§3; 15 §2.7.

### L11 — OPEN: the root `AbilityProvider` (surfaced 2026-09-09 by report 15 §4)
- **Context.** Nested rules-hydrated providers shadow the root provider only for their subtree. Consumers outside the dashboard + proposal trees (landing `notion-refresh-button.tsx:14`, shared components/entities rendered elsewhere) fall to the deny-all default if the root session-based provider is removed.
- **Options.** (a) keep the root provider as a session-derived fallback (a second `defineAbilitiesFor` call site); (b) ship `packRules` from the root layout too, from the same cached `getRequestActor()`; (c) accept deny-all outside the two trees.
- **Recommendation.** (b) — same single cached call, keeps "one ability per request" literal, no second builder.
- **Decision.** pending user (Q10).
- **Sources.** 15 §2.7, §4.

### L12 — Bearer contract (Q7, grill resumed 2026-09-13)
- **Context.** A valid share token reaches 6 shareable procedures + factory `getById`/`update` + `recordView` + the pdf/summary routes (07 §1.2). The homeowner client legitimately writes `financeOptionId` (generic `crud.update`), `cashInDealCents` (`setCashInDeal`), and its own `age` (`applyEnvelopeContext`). `applyEnvelopeContext` ALSO persists the server-reconciled `envelopeDocumentIds` on the token path (`contracts.router.ts:246-249`) — a fact the 09-09 framing missed. `getFullView` returns every proposal column incl. `projectJSON.sow[].financials.costLines`, `ownerId`, `contractEnvelopeId`, QuickBooks ids; only the client view mode hides margin/multiplier today.
- **7a — Decision (user 2026-09-13): YES.** Delete the `homeowner` role's conditionless `read Proposal` rule (`abilities.ts:208`) in the same change that introduces the bearer ability (D-02: a conditionless rule OR-merges to allow-all).
- **7b — Decision (user 2026-09-13): YES to the allowlist `['financeOptionId','cashInDealCents']` on `update Proposal {id}` + `read Proposal {id}`, with the reconcile refinement (the reconciled `envelopeDocumentIds` write and the `age` write both run as the server-derived transitive write `derived:contract-age-from-token-proposal`; the agent-only check on a client-supplied selection becomes a field `can` on the ability; `requestToMoveForward` needs no verb — its scoped read is the gate). **REJECTED: a separate `ProposalView` CASL subject.** User: "there has to be a better way than specifying these sub-entities" → resolved as L13 (sub-entity authorization model).
- **7c — DEFERRED (user 2026-09-13).** Server-side masking of cost-side data + agent-internal columns on bearer reads stays OPEN; recorded in the tracker §0.3 and §5.1 as an open security item (today's containment = client view mode + the PDF doc-definition never touching `costLines`). Not a Phase-7 blocker by ruling.
- **Sources.** 07 §1.2; 10 §3.4, §5 #1–3; `contracts.router.ts:178-266`; `proposals/dal/server/mutations.ts:55-83`; `queries.ts:88-140`.

### L13 — A sub-entity is a field of its parent's CASL subject (ratified 2026-10-05)
- **Context.** L12 rejected per-child subjects. Report 17 worked the alternative on real tables, report 22 surveyed all 50 tables, report 24 compared four interface designs.
- **Decision (user 2026-10-05): RATIFIED.** A child spec declares its parent, foreign key and collection name and has no subject. Child read ⇒ parent `read`; child create/update/delete ⇒ parent `update` on that collection; grandchildren are dotted paths. `CustomerNote` is the one child with its own subject (author-or-admin). Accepted consequence: a parent `update` rule without a field list covers every collection of that parent; narrowing is a field list or a `cannot`.
- **Sources.** 17; 22 §3, §6; 24 §1 C3–C5, §4.2.

### L14 — The specs are the single typed source (2026-10-05)
- **Context.** In `@casl/ability` 6.8.0 the builder types conditions and actions per subject but accepts any string as a rule field (`dist/types/AbilityBuilder.d.ts`, `AddRule`: `F extends string`). Under L13 collections are fields, so a typo in a `cannot` field list silently drops a restriction. Report 24 answered with boot asserts, but the rules module is client-safe and cannot see the server specs.
- **Probe (2026-10-05; real tables; tsc 5.9; throwaway, not committed).** With spec constructors that capture literal types and one type-only union of the specs, the compiler rejects: a foreign key from another table; a collection name that shadows a parent column; a rule field that is neither a column nor a declared collection path (in `can` and `cannot`, grandchildren included); a condition on an undeclared column or with a wrong value type; an operator on a mutation rule, with a field list, or on the wrong subject; an unknown subject or action; a typo in a checked field; a row handed to a client check without the columns rules may condition on. 17 negative cases, all compile errors; about 4.5 s of checking; the typed rules feed stock `createMongoAbility` unchanged. Trap found while writing it: a generic inferred through a conditional type fell back to `string` and silently disabled every field check.
- **Decision (user 2026-10-05).** The specs are the source. Rules are authored through a thin typed `can`/`cannot` wrapper that emits stock CASL rules. Each subject spec lists the columns rules may condition on. A checked-in file of wrong-on-purpose lines, verified by `pnpm tsc`, is part of the deliverable. Field existence, operator placement (D-19) and operator subject binding become compile errors instead of boot asserts.
- **Not decided.** Names (spec constructors, the wrapper, the condition-column list, the check helpers) and the folder layout.
- **Sources.** installed `@casl/ability@6.8.0` types; 14 §1.10; 24 §1 C6.

### L15 — Structure walk-through (2026-10-05): names, home of the compiler, verification
- **Decisions (user 2026-10-05, approved section by section).** Spec constructors `defineEntitySpec` (own subject; may have a parent) and `defineSubEntitySpec` (no subject); link `parent: { spec, fk, field }` — `field`, not `collection`; `subject` replaces `caslSubject`; `entityName` stays; `conditionColumns` on entity specs. Rules: one file per role through `defineRules`; `defineAbilitiesFor` stays the one loader. Enforcement: `permit(ctx, action, spec, fields?) → { sql, probe, test }`, living in the DAL library in place of `scope.ts`. Share links: `bearerContext(spec, token)` validates the token itself. Client: `@casl/react` 7.0.1 is added as decided (the owner declined dropping it); the provider is fed from the root layout (closes L11 / Q10 as option b).
- **Verification (user 2026-10-05): "No testing within our library. Tsc & lint + e2e browser tests."** Closes J7 with no runner. The SQL parity script of D-21 is dropped with it; the wrong-on-purpose type file stays because it is only `pnpm tsc`. Report 24's connection-free core is not built: it only served unit tests.
- **Written form.** `docs/superpowers/specs/2026-10-05-permissions-structure-design.md`, approved by the owner 2026-10-05.

### L16 — No backwards compatibility in the rollout (2026-10-05)
- **Decision (user 2026-10-05, at the start of unit 1): "we aren't coding defensively … built with scalability in mind; not with backwards compatibility in mind."** A unit removes what it replaces in the same change: no alias under an old name, no re-export or wrapper kept for old call sites, no unused type parameter, no old and new shape side by side.
- **Applied to unit 1.** `EntityServerSpec` is deleted, not kept as an alias: `ServerSpec<TTable>` is the union of `EntitySpec` and `SubEntitySpec`, and every consumer moves in the same change. The unused id type parameter and the `any` fallback of the first plan draft are gone.
- **What it does not change.** The order of work. A spec is still reclassified in the change that carries its family's rules (unit 3), because reclassifying changes which rule a request is checked against.

### Still open (asked next, in order)
- ~~**Q7**~~ → L12 (7a yes · 7b yes minus the `ProposalView` subject → L13 · 7c deferred).
- ~~**Q7b′**~~ → L13, L14, L15. The written spec awaits the owner's review.
- **M-R1 / M-R2** merge rulings from report 21 §5 (`recordView` under `SYSTEM_CONTEXT` on main vs the bearer path; main's new legacy `isVisible` caller in the proposal media service) — tracker §0.3.
- **Q8** The 25 business-rule rulings in `10-business-rules-matrix.md` §5 (Meeting ownership vs participation, dispatcher meeting update, Project read ruling, create-side parent requirements, …).
- **Q9** The document set to rewrite and its structure (epic tracker, spec v2, catalog, `src/trpc/DOCS.md`, per-entity DOCS, memory). *2026-09-09: the epic tracker was rewritten (G1/J8 — user asked for it explicitly on 09-07); the rest of the set is still Q9.*
- ~~**Q10**~~ → L15: rules are sent from the root layout (option b).
- **Q11** `outcome-pipeline-map.ts`: restoring the branch's map (`b40403b6`) flips prod `not_good`/`ftd` from `rehash` to `dead` (matches the 2026-08-19 ruling; the tree carries main's map) — confirm before 7.3.
- **Q12** Bearer READ surface: 7c masking (deferred) + `canSeeUngatedPhone` bearer gating under a per-row ability (report 19 §7) + public project reads under anonymous deny-all (09-14 item, report 18 §4). Recommended: grant `phone` on the bearer read rule now; the rest with 7.4.
- ~~**J3**~~ no longer exists: the seam commits left the tree with the 2026-10-05 supersede merge.
