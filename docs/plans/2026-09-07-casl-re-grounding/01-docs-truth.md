# 01 — Documented-truth map: CASL scope-compiler epic (#285)

**Scope of this report:** what the DOCS say (not the code). Worktree `.worktrees/issue-285`, branch `refactor/285-refactor-permissions-casl-scope-compiler`, HEAD `b40403b6`. Read date 2026-09-06.

**Abbreviations used for citations**

| Key | Path |
|---|---|
| `EPIC` | `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (working-tree line numbers; **lines 11–57 and the edits at 307–309 are UNCOMMITTED** — `git diff` shows +51/−2) |
| `SPEC` | `docs/superpowers/specs/2026-08-10-casl-scope-compiler-design.md` (v2, 2026-08-11) |
| `PS3` | `docs/superpowers/specs/2026-08-12-casl-phase-3-children-and-actors-problem-statement.md` |
| `D6` | `docs/superpowers/specs/2026-08-20-casl-phase-6-owned-children-design.md` |
| `CAT` | `docs/permissions/visibility-rules-catalog.md` |
| `P4` | `docs/superpowers/plans/2026-08-18-casl-phase-4-actor-seam-hardening.md` |
| `P5` | `docs/superpowers/plans/2026-08-19-casl-phase-5-customer-pipelines-adoption.md` |
| `P6` | `docs/superpowers/plans/2026-08-20-casl-phase-6-owned-children.md` |
| `DISP` | `docs/superpowers/plans/2026-08-20-dispatcher-visibility-corrections.md` |
| `M-CASL` | memory `project-permissions-casl-compiler.md` (modified 2026-08-13) |
| `M-P5` | memory `project-casl-phase-5-customer-pipelines.md` (2026-08-19) |
| `M-SPLIT` | memory `project-casl-mutation-legacy-split.md` (modified **2026-09-06T23:33** — already carries the re-orientation at its L42–47) |
| `M-VIS` | memory `pattern-visibility-scoping.md` (pre-epic, 2026-05) |
| `M-DISP` | memory `project-dispatcher-role.md` (2026-07) |
| `DOCS` | `src/trpc/DOCS.md` |

**Precedence the docs assert for themselves:** EPIC L11 "CURRENT NORTH STAR … read '## CASL-native re-orientation' FIRST … supersedes the Phase-7 `resolveScope` router-seam approach AND the Track-B/Track-C(Phase-7.5) split"; EPIC L15 "Where it conflicts with earlier Phase-7 prose, THIS wins"; EPIC L8 "This tracker does NOT restate the design — read the spec for the *why*"; EPIC L59 the completed phase-plan docs (0/1/3) + the design spec are "point-in-time execution records left as-authored" (old names); EPIC L67–69 spec §2 forks are locked — "Do not re-litigate here"; EPIC L365 ADR/`src/trpc/DOCS.md` updates land **with Phase 8, never before** (so DOCS is knowingly behind).

---

## A. Phase ledger as documented

| Phase / unit | Documented status (source) | Claims shipped | Claims deferred / residual | Plan doc |
|---|---|---|---|---|
| **Phase 0** — Engine + Actor scaffolding, no cutover | DONE, verified 2026-08-11 (EPIC L230–234; M-CASL L39) | `Actor` union; `defineScopeOperator` + `$participatesViaMeeting`/`$hasNoMeeting` (emit side only); AST interpreter; `compileScope`; `resolveActorScope` (+`verbOnly` child branch); `canAccess`; `pk`/`fk` helpers. Zero production wiring; EXPLAIN parity vs `userCanSeeCustomer` and `leadsPoolVisibility()` (L234) | CASL parser wiring → Phase 1 (L231). Branch inherited a red tsc baseline (M-CASL L39) | `docs/superpowers/plans/2026-08-10-casl-phase-0-engine-scaffolding.md` |
| **Phase 1** — Per-entity atomic cutover (Customer→Meeting→Proposal→Project) | DONE 2026-08-12 (EPIC L236–244; M-CASL L41) | 4 roots compiled + equivalence-gated; parser wiring (`buildMongoQueryMatcher`, UNPREFIXED operator names — L242); `not` support (L243); `$inDerivedPipeline:['leads']` for dispatcher (L238); EXISTS projection aligned to `meeting_participants.id` (L236) | Did NOT drop `visibility` fns nor flip `buildUserContext`/`isVisible`/`resolveVisibilityScope` → Phase 8 (L236) — i.e. the original AC L240 ("buildUserContext/middleware route through resolveActorScope") was scope-refined, not met; dispatcher rehash DEFERRED (L236/238); `$hasNoMeeting` ORPHANED keep-or-drop TBD (L238); action-threading through `canAccess` child path → Phase 6 (L244) | `docs/superpowers/plans/2026-08-11-casl-phase-1-per-entity-cutover.md`; ledger `.superpowers/sdd/2026-08-11-casl-phase-1-per-entity-cutover/progress.md` |
| **Phase 2** — Project drift ruling | DONE 2026-08-12, folded into Phase 1, doc-only (EPIC L246–250; M-CASL L29) | Ruling `participation OR ownerId=me`, `isPublic` dropped from authz; rules at `abilities.ts:149-150`; `get-customer-pipeline-items.ts` `isPublic` disjunct dropped | ACCEPTED residual: `getProjectsPipelineItems` hand-mirrors `ownerId OR participation` in raw SQL → Phase 7 (L249; now 7f at L317) | none (no code) |
| **Phase P** — Propagation | DISSOLVED 2026-08-18 into Phase 5 + Phase 7 (EPIC L252; PS3 L88 was its charter) | — | Its "robustness BEFORE propagation" ruling survives as the phase ordering (L252, L357) | — |
| **Phase 3** — Robustness/proof gate ("was: cut owned children over") | DONE 2026-08-12 (EPIC L254–262; M-CASL L31) | fk mis-wiring guardrail (`fkColumn` throws on mis-pointed `parent.fk`); bridge + all 4 principals EXPLAIN-proven on `proposal_media_files → Proposal` (L261) | NO child cutovers, NO bespoke-scoping deletion, NO actor-seam wiring (L260) → Phase 4/6 (L262) | `docs/superpowers/plans/2026-08-12-casl-phase-3-robustness-gate.md`; problem statement PS3 |
| **Phase 4** — Actor-seam hardening (§8 drivers) | DONE 2026-08-18, 8 task commits `4b352564..ac614fcb` (EPIC L264–277) | §8-1 meeting-flow `canAccess` probe + scoped write; §8-2 `systemActor('derived:contract-age-from-token-proposal')`; §8-3 canonical `validate-share-token → tokenActor` (`resolveShareTokenActor`); §8-4 `requireResolvedScope` at **26** DAL sites; #4/#6/#7 IDORs; `SystemReason` union + `systemContext(reason)` (L271, L276) | `canSeeUngatedPhone(Actor)` → Phase 5 (L272); `isVisible` `!ctx.session` bypass + `isInScope` → Phase 8 (L271); projects IDORs #1/#2/#3/#5 → Phase 6/7 (L273); activities `FORBIDDEN` existence-leak + T3 DRY nit → Phase 9 (L277, L339–340); `ctx.actor` → Phase 5 (L273) | `docs/superpowers/plans/2026-08-18-casl-phase-4-actor-seam-hardening.md`; ledger `.superpowers/sdd/2026-08-18-casl-phase-4-actor-seam-hardening/progress.md` |
| **Phase 5** — Customer-pipelines adoption (first `ctx.actor` cutover) | DONE 2026-08-19, commits `d6302917→3390aaff` (EPIC L279–292; M-P5 L13) | `actor: Actor` **required** on `ScopedContext`; outcome-derived 5-bucket pipeline (`MEETING_OUTCOME_CLASS`); leads collapse; single-bucket list rewrite (blessed behavior change); by-id via `resolveActorScope` row-miss = NOT_FOUND; pipeline-access guard; `canSeeUngatedPhone(actor)` at 8 sites (L281–287) | Dispatcher rehash widening still NOT done at P5 close (L281) — later shipped (see Phase A); `move-customer-to-pipeline.ts` write-side follow-up (M-P5 L49) | `docs/superpowers/plans/2026-08-19-casl-phase-5-customer-pipelines-adoption.md` (EPIC L291 still reads "Plan: _(JIT)_" — stale) |
| **Phase A** — Dead-code pull-forward (subset of Phase 8) | SHIPPED on-branch 2026-08-20 (EPIC L5, L219–222; M-SPLIT L17) | 9 orphaned `*Visibility` fns + `projectParticipationScope` + `scopeMiddleware` fn deleted; `visibility:` dropped from 9 specs; dispatcher rehash+dead widening (`$inDerivedPipeline:['leads','rehash','dead']`) | Kept live `resolveVisibilityScope` / `hasAssociatedMeeting` | none (Ledger 3 at EPIC L219–222) |
| **Phase 6** — Owned sub-entity cutovers + homeowner invariant | DONE 2026-08/2026-09 (EPIC L294–305; commits `c215c3d2..ac8efe45` per git log) | `parent` on `customer-notes`→Customer + `applications`→Meeting; `customerNoteVisibility`/`applicationVisibility` deleted; dispatcher `read`+`create CustomerNote`; `projectMediaProcedure`; `movePhase`/`toggleHero` de-inlined to `media-ops.ts`; proposal-media on CASL; `shareableMiddleware` agent-first + actor-kind guard (L305; D6 §7) | Tier-2 **factory** CASL flip → Phase 7; `listImportableProposalMedia` read shape → Phase 7; tokenActor-authorization redesign → Grill C; `action`-threading through child path → Grill C/Phase 7 (L300, L305; D6 §3) | Design D6; plan `docs/superpowers/plans/2026-08-20-casl-phase-6-owned-children.md` (EPIC L304 still reads "Plan: _(JIT)_" — stale) |
| **Dispatcher visibility corrections** (rode on Phase 6) | DONE 2026-09-06 (EPIC L3, L5; M-SPLIT L23–25) | Task 1 financial gate `c62813d5`; Task 2 fresh-wide + unconditional `read Meeting` `ad71a076`; Task 3 notes + discovery profile (`ad71a076`/`5fec560b`); note-create `canAccess` fix `5a983124` | Grill-D residual: defensive `maskFinancials`/`canReadProposals` — MUST be redesigned before merge (EPIC L341; `docs/plans/2026-09-04-customer-pipelines-feature-boundary-refactor.md`); "unconditional Meeting read" consequence (DISP L297); dispatcher note UPDATE/DELETE on non-leads customer still hits legacy `['leads']` bridge until 7b (M-SPLIT L37) | `docs/superpowers/plans/2026-08-20-dispatcher-visibility-corrections.md` |
| **Grill B** — Financial read chokepoint | GRILLED 2026-08-20, design LOCKED, execution → Phases 6–8 (EPIC L173, L178–192; M-SPLIT L18) | Tier-2 completion = Phase 6 (done). | Uniform read cutover = Phase 7; delete = Phase 8; wall/guard shape TBD in Phase-7 JIT plan (L186). **Partially superseded** by re-orientation: "read-side" cutover becomes read+mutation-together, `ctx.scope` retires entirely (L23–24) | none (outcome inline at EPIC L178–192) |
| **Grill C** — Action-aware mutation scope + retire auth-in-hooks | **NOT YET GRILLED** (EPIC L174, L330; M-SPLIT L19). Sequencing: "Phase-7 precursor" (L174, committed 08-20) → split to **Phase 7.5 after Phase 8** (L6, L169, L329; committed `b0d50234` 09-06) → **folds back into Phase 7** (L19, L308; UNCOMMITTED 09-06) | — | Opening frame tokenActor A-vs-B undecided (L175); Ledger 2 inventory (L209–217); OPEN pre-merge vs post-merge (L332) | none |
| **Work-unit D** — Legacy-engine retirement | Consequential, folds into Phases 7–8 (EPIC L176) | — | Proof = `git grep` for legacy names returns zero | none |
| **Phase 7** — (committed name) "Track B: uniform scope cutover" / (uncommitted name) "DAL self-scopes off `ctx.actor` (CASL-native, action-aware)" | **IN PROGRESS** (EPIC L307). Committed state (L6–7, L310–322; M-SPLIT L33–39): `createCrudRouter` gained optional `resolveScope`; customer flipped `3e901178`; 7a meeting flipped `b40403b6`; remaining 7b–7g. **Uncommitted re-orientation (L11–57, L307–308; M-SPLIT L42–47): both commits are WRONG LAYER → revert; real work = 7 items at L39–46** | (committed) customer + meeting CRUD leaves on `resolveTrpcActorScope` | (uncommitted) the 7a–7h order, the router seam, and Phase 7.5 are all superseded; open grill question at L48–51 must be decided FIRST | none — "per-unit JIT" (L320); **no plan exists for the re-oriented Phase 7** |
| **Phase 7.5** — Track C | Committed: "AFK · runs AFTER Phase 8 (despite the number)", NOT YET GRILLED (EPIC L329–334; M-SPLIT L40). Uncommitted: "Phase 7.5 folds back into Phase 7" (L19, L308) | — | OPEN: pre-Phase-9-merge vs follow-up epic (L332) — mooted only if the fold-back is accepted | none |
| **Phase 8** — Delete dead engine + omni collapse | NOT STARTED; "AFK · blocked-by: Phase 4–7 (Track B only)" (EPIC L324–327 — the "(Track B only)" qualifier is stale under the re-orientation) | — | Delete `resolveEffectiveScope`/`bridgeToParent`/`isInScope`/`isVisible`/`SYSTEM_CONTEXT`; remove omni branch from all 3 collapse sites; clear Retiring-Seams Register; ADR/DOCS updates land here (L365) | JIT |
| **Phase 9** — Pre-merge gate (HITL E2E, then single merge) | NOT STARTED (EPIC L336–343) | — | Must-land residuals: activities existence-leak; T3 DRY nit; Grill-D customer-pipelines API rethink (L339–341); E2E matrix role × entity (L343) | — |

---

## B. Decided conventions & etiquette register

Legend: **LIVE** = no later doc statement retracts it · **SUPERSEDED** = a later doc statement overrides it (both cited) · **CONTESTED** = docs disagree with no explicit precedence.

### B.1 Design-level (spec §2 forks — "locked, do not re-litigate" EPIC L67–69)

| # | Rule (verbatim-ish) | Source | Date | Status |
|---|---|---|---|---|
| B1 | **CASL rules are the single source of truth; the row predicate is compiled** (`rulesToAST` → ucast AST → Drizzle interpreter), the way `accessibleBy` does | SPEC L28, L65; CAT L16–27; EPIC L65 | 2026-08-10 | LIVE — re-affirmed EPIC L33–34 "Our engine is CANONICAL — keep it" |
| B2 | **Child inheritance = split**: owned children inherit via structural `parent` bridge; Meeting/Proposal/Project are PEER-ROOTS with own participation scope. Litmus: "must you go through the main entity to reach it?" | SPEC L38 (Fork A); EPIC L238 ruling (A); M-CASL L23; PS3 L27 | 2026-08-11 | LIVE |
| B3 | **Child own-scope is VERB-ONLY (`verbOnly`) — never a compiled row condition on the shared subject** ("missing-FROM hazard"); rows governed entirely by the unconditional bridge | SPEC L42, L201, L210–218; PS3 L25; D6 L15–20 | 2026-08-10/11 | **CONTESTED by the uncommitted OPEN question** EPIC L48–51: shape (a) would compile the child's *own-column* conditions — a reopen of this locked fork (per EPIC L69 a reopen must be noted in the phase plan + pinged) |
| B4 | **Project row-security = `participation OR ownerId=me`; `isPublic` is a display filter, not authz** | EPIC L247 (ruling 2026-08-11), L238 (C); M-CASL L23 | 2026-08-11 | LIVE — CAT L122 still says "UNRESOLVED" (stale) |
| B5 | **Canonical dispatcher Customer rule = derived-pipeline membership**, `$inDerivedPipeline` emitting `derivedPipelineWhere`; MUST use derived buckets, never raw `customers.pipeline` | EPIC L238 (B); CAT L100; M-CASL L23 | 2026-08-11 | LIVE as mechanism; the **set** moved: `['leads']` (Phase 1, EPIC L238) → `['leads','rehash','dead']` (Phase A, EPIC L195) → `['leads','rehash','dead','fresh']` (DISP Task 2, EPIC L7; DISP L205 "user ruling 2026-08-20"). SPEC L165 `{pipeline:'active',$hasNoMeeting}` and CAT L100 `{leads,rehash}` are point-in-time |
| B6 | **`LeadsPool` stays ONE named CASL capability** (not a 3-rule split); phone-ungate + pipeline-set key off it | SPEC L171–173 (Fork B preferred); EPIC L238 | 2026-08-11 | LIVE — CAT L162/L187 "make 3 explicit rules" is the older, rejected option (stale) |
| B7 | **Interpreter = hand-walked ucast AST with drizzle-orm; do NOT adopt `@ucast/sql`** | SPEC L43 | 2026-08-10 | LIVE (EPIC L34 re-affirms) |
| B8 | **Single `defineScopeOperator({name, parseValue, toSql, toJS?})` registration** — never two-place | SPEC L44, L128, L305 | 2026-08-10 | LIVE; refinement: operators registered **UNPREFIXED** (`participatesViaMeeting`…) because `MongoQueryParser` strips `$` (EPIC L242, L370) |
| B9 | **Operator parameters live in the rule (AST node), not the spec**; `ctx = {table, pk, actor}` built from the spec in hand — **no `caslSubject → spec` registry** | SPEC L45, L92, L145, L297 | 2026-08-10 | LIVE |
| B10 | **Sentinels (verified vs `@casl/ability@6.8.0`)**: `rulesToAST` `null` → `sql\`false\`` (deny-all); empty AND → `null` (allow-all); system → `null`; token → `actor.scope` | SPEC L98–122; EPIC L233; P4 L19 | 2026-08-10 | LIVE; re-affirmed EPIC L28 "don't conflate" |
| B11 | **Migration invariant: risk surface is false-ALLOW; conditions REPLACE the conditionless verb, never sit beside it; no behavior-neutral engine-only phase** | SPEC L106–110; EPIC L71–76; PS3 L41–42 | 2026-08-10 | LIVE |
| B12 | **Omni is emergent** (`manage all` → empty AND → null) — all THREE collapse sites (`resolveVisibilityScope`, `buildUserContext`, `shareableMiddleware`) must be ported/deleted | SPEC L60, L175–177, L264; EPIC L325 | 2026-08-10 | LIVE (Phase 8). DOCS L163 "Omni stays a procedure/context concern — never inside an entity predicate" is the legacy statement being replaced |
| B13 | **Homeowner is ALWAYS `token`, never `user`** (load-bearing leak invariant) | SPEC L64; PS3 L36; D6 §2.4 | 2026-08-10 | LIVE; strengthened by **agent-first precedence** (session ⇒ user; token ignored) D6 L112–128 (user req 2026-08-20), DOCS L169–175 |
| B14 | **Precursor probes use the parent's READ scope, not a `create` verb** (`canAccess(customerSpec, actor, id, 'read')`) | SPEC L242–249; PS3 L39; EPIC L373 | 2026-08-10 | LIVE |
| B15 | **`compileScope(actor, action, subject, ctx)` takes the full `AppAction`, not hard-coded `'read'`** | SPEC L80 | 2026-08-10 | LIVE for the compiler; but `resolveScope` (SPEC L201–202) and the shipped `resolveActorScope` hard-code `'read'` (EPIC L167, L217, L300; P6 L20) — the re-orientation L24/L41 now mandates the resolver become action-aware |
| B16 | **Spec ergonomics**: derive+validate `parent.fk` (Phase 3 ✓); exhaustiveness startup assert (Phase 1 ✓); optional `defineEntity`; REJECT full-stack `defineEntity`, type-derived `AppSubject`, derived PK generic | SPEC L301–311 | 2026-08-10 | LIVE (the rejections stand) |
| B17 | **7 authorization axes — never force into one mechanism**; axis 5 (state transitions) is a verb gate + imperative, NOT a WHERE | CAT L54–70, L91; M-CASL L19 | 2026-08-10 | LIVE |
| B18 | **Phone threshold stays a SQL `CASE`; bypass is CASL** (`canSeeUngatedPhone`); dynamic Field Mask + Client Mirror deferred to follow-up spec | CAT L103; SPEC L41, L283 | 2026-08-10 | LIVE as of the spec — **CONTESTED** by re-orientation L30/L45 ("client reads the same ability… kills triplication") which pulls Client-Mirror-like work into Phase 7 without naming the deferred spec |

### B.2 Actor-seam conventions (EPIC L106–117, "locked — grill 2026-08-18")

| # | Rule | Source | Status |
|---|---|---|---|
| B19 | **A/B/C classification precedes every SYSTEM_CONTEXT/token fix** (A = mis-scoped user write; B = genuinely privileged `systemActor(reason)`; C = bearer single-row `tokenActor`) | EPIC L110; P4 L7 | LIVE |
| B20 | **Client-supplied id → point-probe `canAccess(...)` → throw `NOT_FOUND` on miss (never FORBIDDEN — don't leak existence)**, scoped write retained underneath; lists stay pure scope-threaded; **server-derived id → named `systemActor(reason)` transitive write**, sound only because the preceding read is scope-enforced | EPIC L112–114 (Q6/Q9); P4 L341–343 | LIVE. Known exception: activities returns `FORBIDDEN` (Phase 9 residual, EPIC L339) |
| B21 | **`tokenActor` = scope + subject, NO ability**; verb-boundary = the endpoint; row-boundary = the scope; **one canonical `validate-share-token → tokenActor` path**; funnel `leadId` is a tokenActor; **id-as-capability only on random-UUID pks, never `unsafeId` serial** | EPIC L115; P4 L184–220; CAT axis 7 L67 | LIVE — but **CONTESTED** by Grill-C opening frame EPIC L175 (fork B: give tokenActor a purpose-built ability; "Lean was B") — undecided |
| B22 | **`systemActor(reason)` takes a closed namespaced `SystemReason` union** (`webhook:* \| sync:* \| intake:* \| admin:*`) with a per-variant "why safe" comment; `SYSTEM_CONTEXT→systemActor` is classification per site, not find-replace | EPIC L116; P4 L38–60 | LIVE. Implemented variants add `derived:*` and `legacy:system-context` (P5 L79–88; retired Phase 8) |
| B23 | **Deny-safety: one standalone `requireResolvedScope`; `null` = sole deliberate allow-all; `undefined`/absent → throw; `ctx.scope` typed non-optional `SQL \| null`; helper stays standalone to avoid deepening the `create-crud-dal.ts` merge seam** | EPIC L117 (Q10); P4 L110–145 | LIVE — but the re-orientation L41 retires `requireResolvedScope(ctx.scope)` at the 3 CRUD-DAL sites (getById/update/delete) in favour of `resolveActorScope(spec, ctx.actor, action)` |
| B24 | **`isInScope` (`scope.ts:94`) knowingly keeps `?? undefined`** — do-not-churn-dead-code; dies Phase 8 | EPIC L136; P4 L120 | LIVE |
| B25 | **Actor construction at tRPC boundaries: build `userActor(ctx.session.user.id, ctx.ability)` inline** (Phase 4, pre-`ctx.actor`) | P4 L20 | SUPERSEDED by Phase 5 `ctx.actor` (EPIC L280; P5 L7; M-P5 L21 "Actor built in `protectedProcedure`, NOT `createHTTPTRPCContext`") |
| B26 | **`canSeeUngatedPhone` takes an `Actor`** (non-user → true; user → `manage all \|\| read LeadsPool`) | SPEC L281 ("NOW"); EPIC L272 (deferred P5, "premise FALSE"); EPIC L287 (shipped P5); P4 L512–550 | LIVE (shipped P5); SPEC's "now" timing superseded |
| B27 | **Activities owner-guard is a temporary, NON-canonical IDOR patch — must NOT be generalized or cited** | P4 L446 | LIVE |

### B.3 Context / layering conventions

| # | Rule | Source | Status |
|---|---|---|---|
| B28 | **The generic CRUD factory stays permission-agnostic: `create-crud-dal.ts` MUST NOT read `ctx.actor` — it reads `ctx.scope` only**; only bespoke feature/entity DALs read `ctx.actor` | P5 L18, L866; M-P5 L23; EPIC L100 (CRUD-DAL contract §3.2 "DAL is permission-agnostic") | **SUPERSEDED (uncommitted)** by EPIC L23 "The DAL/CRUD layer SELF-SCOPES off `ctx.actor` via `resolveActorScope(spec, ctx.actor, action)` — Phase 5's rule is SUPERSEDED by Grill B (never retracted in writing — that unreconciled seam caused the drift)"; Grill B #3 EPIC L184 already said "the owning DAL derives its own subject's scope from `ctx.actor`" |
| B29 | **`ctx.actor: Actor` is REQUIRED (non-null) on `ScopedContext`; every construction site stamps a real actor** (`protectedProcedure`/`buildUserContext` → userActor; `SYSTEM_CONTEXT`/`systemContext` → systemActor; shareable → tokenActor/userActor) | EPIC L280; P5 L74–118; M-P5 L20–22 | LIVE. EPIC L101/L286 "`ctx.actor?: Actor` additively" (optional) is the older design text — superseded by the required form |
| B30 | **Scope stays derived, never duplicated — `ctx.scope = resolveActorScope(spec, ctx.actor)` per entity; `scope` is the pre-resolved cache the factory consumes** | M-P5 L23 | SUPERSEDED — re-orientation EPIC L24/L44 "`ctx.scope` + `spec.visibility` retire"; Grill B #3 L184 "`ctx.scope` retires from reads" |
| B31 | **`resolveActorScope(spec, ctx.actor)` is the SINGLE read-scope authority; no new helpers (`scopedFor`/`crossScope` REJECTED)**; uniform FULL read-side cutover incl. the factory read path (user ruling option B); no half-states | EPIC L182–185 (Grill B #1, #3, #4) | LIVE, extended by re-orientation to read+mutation together (EPIC L23–24) |
| B32 | **Field-level CASL (`permittedFieldsOf`) is YAGNI'd — Grill B ruling is row-scope only; dispatcher sees NO proposal rows (not "row with money blanked")** | EPIC L182–183 | Row-deny part LIVE (shipped DISP Task 1). **YAGNI part SUPERSEDED** by re-orientation EPIC L29, L42 "`permittedFieldsOf` … Replaces hand-rolled `assertCanUpdateFields`" |
| B33 | **Wall = ownership seam + guard**: cross-entity code stops writing raw `db.select().from(<scoped table>)` and calls the owning DAL; lint/CI guard forbids raw `.from(<scoped table>)` outside `entities/<x>/dal/`; shape TBD in Phase-7 JIT plan | EPIC L186 (Grill B #5); re-orientation L46 | LIVE (unbuilt) |
| B34 | **EXPLAIN-parity / equivalence gate has teeth** — every entity flip proves compiled == pre-change fragment per role; Tier-1 vs Tier-2 split (Tier-2 must have `parent` first or the flip WIDENS) | EPIC L187–189 (Grill B #6); L310; SPEC L260; P6 L19 | LIVE. Re-orientation L46 "per-entity equivalence gate" |
| B35 | **Verification = `pnpm tsc && pnpm lint` + hand EXPLAIN; no test runner; never `pnpm build`; scratch probes uncommitted (`scripts/tmp-*.ts` starting `import './lib/load-env'`)** | EPIC L78–82; P4 L13–16; P5 L15; P6 L15–16; DISP L3 | LIVE |
| B36 | **Two engines coexist until Phase 8; they share the identical `(spec, {userId, ability})` signature, so `resolveVisibilityScope`↔`resolveTrpcActorScope` swaps are semantic, not typed — grep-audit every `*Procedure` wiring by hand** | EPIC L104 (merge lesson); P6 L19 | LIVE |
| B37 | **`parent` is engine-agnostic** — declaring it is safe under either resolver | D6 L22, L47; P6 L7 | LIVE |
| B38 | **Own-record (author-or-admin) rules → CASL conditions (`can(['update','delete'],'CustomerNote',{authorId})`), retiring `assertNoteAuthorOrAdmin` + client mirror** | EPIC L174, L213, L331, L43 | LIVE as target; **timing flip-flopped** (Phase 7 → 7.5 → Phase 7). DISP L237 "CASL can't express it on string subjects" describes the current gap |
| B39 | **Client reads UI affordances off the same ability (kill the hook/client "triplication")**; `ability.rules` shipped via `packRules`/`unpackRules` | EPIC L30, L45; L174 | LIVE (uncommitted; unimplemented) |
| B40 | **Author `(conditions + fields)` on EVERY action's rule** in `abilities.ts` — mutation rules get row conditions, not just fields; each CRUD slot passes its verb (`getById`→read, `update`→update, `delete`→delete) | EPIC L24, L27, L40 | LIVE (uncommitted; unimplemented) |
| B41 | **Fail-closed interpreter** (throw on unknown operator); Phase 0 already throws on compound ops other than `and`/`or` (`not` added Phase 1) | EPIC L37 ("Adopt"); L243 | LIVE |
| B42 | **Adopt `subject()` tagging + `Pick<$inferSelect>` condition types (condition keys typechecked against real columns)** | EPIC L37 | LIVE (uncommitted; unimplemented; no plan) |
| B43 | **CASL precedence = last-match-wins; put `cannot` AFTER `can`** | EPIC L54 | LIVE (etiquette; CAT L145 notes zero `cannot()` rules today) |
| B44 | **`@ucast/core` must be added as an explicit dependency if its condition classes are imported** | EPIC L37 | LIVE (etiquette; pending) |
| B45 | **User-referencing conditions (`{authorId:id}`) are literal at build time → ability rebuilt per actor** (already true via `userActor(userId, ability)`) | EPIC L31 | LIVE |
| B46 | **Mutations are additionally WHERE-scoped (defense-in-depth), stronger than the reference impl's load-then-check** | EPIC L37 | LIVE |

### B.4 Procedure / router conventions

| # | Rule | Source | Status |
|---|---|---|---|
| B47 | **`agentProcedure` → `staffProcedure` is a RENAME, not supersede — no `@deprecated`, no alias, no coexistence; one inert commit sweeping all 23 files; `superAdminProcedure` keeps its name, re-parents** | EPIC L119–126, L140 | LIVE; scheduled 7g LAST (L318) — 7a–7h ordering itself is superseded, the rename ruling is not |
| B48 | **Interim staff gate = `can('access','Dashboard')`, marked `// INTERIM`; YAGNI on a bare `userProcedure`** | EPIC L126, L138 | LIVE |
| B49 | **Authorization moves into the body + service layer; procedure answers "who + scope/ability"** | EPIC L127 | LIVE (consistent with DAL self-scoping) |
| B50 | **Retiring-Seams Register: every backwards-compat shim carries `@deprecated` → replacement AND a register entry; renames are NOT shims** | EPIC L129–140 | LIVE. Entries: `SYSTEM_CONTEXT` (P8), `scope.ts` engine (P8), `resolveVisibilityScope`/`scopeMiddleware` (P7/8; `scopeMiddleware` already deleted in Phase A), interim staff gate (marker only). **NOTE**: the `createCrudRouter` `resolveScope?` option added by `3e901178` is a compat shim with no register entry — and is slated for revert |
| B51 | **Entity sub-routers never call `agentProcedure` directly — import `<entity>Procedure`** (scope baked at definition); bare `agentProcedure` leaves `ctx.scope` null | DOCS L56–60, L362; M-VIS L14–16 | LIVE as a legacy-era rule; its mechanism (`ctx.scope`) is scheduled to retire |
| B52 | **Token path: no CASL check — `ctx.ability` is null; gating must be inside `if (ctx.ability)`** | DOCS L179, L366 | LIVE in DOCS — but EPIC L175 names exactly this `ability==null` gate as "the same auth-in-hooks anti-pattern C exists to kill" |
| B53 | **`update` slot checks per-field `ability.can('update', subject, field)` (`assertCanUpdateFields`)** | DOCS L232–251 | LIVE in DOCS — superseded by B32/re-orientation target (`permittedFieldsOf`) |
| B54 | **`createCrudRouter` = exactly 5 slots (getById/create/update/delete/duplicate) mapped to CASL actions; list is NOT CRUD** | DOCS L212–230 | LIVE (the re-orientation's per-slot verb mapping at EPIC L24 relies on it) |

### B.5 Process / sequencing rulings

| # | Rule | Source | Status |
|---|---|---|---|
| B55 | **Whole epic in ONE worktree; single merge after a full E2E pass (Phase 9) — never phase-by-phase; no PR, no push** | EPIC L3, L337; P5 L19; P6 L18; DISP L18; M-CASL L37 | LIVE |
| B56 | **Robustness BEFORE propagation** — don't sprinkle `resolveActorScope`/`canAccess` piecemeal; business-hardening drives design, propagation is the last sweep | EPIC L86, L252, L357; M-CASL L29 | LIVE as ordering principle; the "propagation is a mechanical sweep" corollary is SUPERSEDED (EPIC L4, L169 "Phase 7 is NOT a purely mechanical sweep") |
| B57 | **Phase plans are written just-in-time; each phase ships green and independently reviewable** | EPIC L226 | LIVE |
| B58 | **Do NOT widen the legacy engine to track CASL — do the proper engine migration; leave dead fns for Phase 8** | M-SPLIT L34 (user ruling 2026-09-06) | LIVE |
| B59 | **A `*Visibility` fn dies only when (its leaf flipped) AND (all child-bridge entities flipped) AND (`buildUserContext`/shareable consumers retired)** | EPIC L7 (correction), L312, L315; M-SPLIT L37 | LIVE (death timing 7b/7e is superseded with the 7x ordering, the rule is not) |
| B60 | **Dispatcher Task 1 (financial gate) MUST land before Task 2 (widening) — no commit in history may contain the proposal-value leak** | DISP L17 | LIVE (executed) |
| B61 | **Dispatcher gets NO `read Proposal` / `read Project` — that absence IS the financial wall** | DISP L19; EPIC L183 | LIVE |
| B62 | **Grill B / Phase 7 is built after the rest of the infra (Phases 6–7) — do NOT pull Phase 7 forward into B** | EPIC L173 (user ruling 2026-08-20) | LIVE (executed) |
| B63 | **Merge policy for the CRUD-DAL epic on main: `ctx.actor` integrates additively (Q1 forced by sub-plan A's locked grill); rebase seam only, no blocking dep** | EPIC L96–104 | **CONTESTED**: re-orientation's DAL self-scoping edits `create-crud-dal.ts` (EPIC L41), which P5 L18 declared "byte-stable" for the sub-plan A rebase seam; no doc reconciles this |
| B64 | **`ADR-0002` amendment + `src/trpc/DOCS.md` + per-entity `DOCS.md` updates land with Phase 8, never before** | EPIC L365 | LIVE — explains why DOCS still describes the legacy engine |

---

## C. Contradictions & stale statements

Format: `A says X` vs `B says Y` → which wins per the docs' own precedence notes.

### C.1 The uncommitted re-orientation vs committed Phase-7 prose (highest impact)

| # | Doc A | Doc B | Winner |
|---|---|---|---|
| C1 | EPIC L3 (header, committed): "Now in **Phase 7 Track B** (uniform scope cutover; customer flipped 2026-09-06 `3e901178`) — Grill C split to **Phase 7.5** (deferred past Phase 8)"; L5 "Next up: Phase 7"; L173 "→ Now Phase 7 Track B, executing: customer flipped … sequencing locked (proposal = 7d, last)" | EPIC L11 (uncommitted): re-orientation "supersedes the Phase-7 `resolveScope` router-seam approach AND the Track-B/Track-C(Phase-7.5) split. Two commits (`3e901178`, `b40403b6`) took the WRONG layer and must be reverted" | B wins (L11, L15). **The header L3 and L173 were NOT updated** — a fresh reader of the header is told Track B is executing |
| C2 | EPIC L6–7 (committed): `createCrudRouter` optional `resolveScope` (default legacy) is "the per-entity lever that flips a factory leaf onto the CASL compiler"; L310 "The seam: each factory entity flips by passing `resolveScope: resolveTrpcActorScope`" ; L322 AC "factory leaves on `resolveScope: resolveTrpcActorScope`" | EPIC L18: computing `ctx.scope` at the tRPC procedure "(a) keeps `ctx.scope` alive (it must RETIRE), and (b) touches only the tRPC caller — `createCrudDal`'s functions are also called by services/jobs/webhooks … **Revert both**; do the DAL-layer cutover instead"; L307–308 "the stale Track-B prose below is kept only for history" | B wins. Note the committed AC (L322) still lists the seam |
| C3 | EPIC L6, L169, L174, L329–334 (committed 09-06): Grill C "**NOT** a prerequisite for Phase 8's engine deletion — split into Phase 7.5 (scheduled after Phase 8)"; L324 Phase 8 "blocked-by: Phase 4–7 (Track B only)"; M-SPLIT L38 same | EPIC L19: "the Track B vs Track C / Phase 7.5 split was a wrong cut … action-aware scope + own-record conditions + field-level are ONE design. **Phase 7.5 folds back into Phase 7**"; M-SPLIT L44 same | B wins. Consequence not written anywhere: Phase 8's `blocked-by` and the 7.5 block (L329–334) are stale; the OPEN at L332 (7.5 pre/post-merge) is mooted |
| C4 | EPIC L174 (committed 08-20): Grill C = "**Phase-7 precursor**" | EPIC L169/L174 (committed 09-06): "Superseded … NOT a prerequisite" | then EPIC L19 (uncommitted 09-06): back inside Phase 7 | Three-way flip within 17 days; the uncommitted text wins. The middle position's *argument* ("mutation WHERE stays the read scope, hooks keep enforcing" L169) is not refuted anywhere — it is simply overridden by "one design" |
| C5 | EPIC L7 (committed): customer flip "fixes the dispatcher customer-edit 'Failed to update profile'"; M-SPLIT L33–35 same | EPIC L18: revert `3e901178` | B wins — but no doc says what happens to the dispatcher customer-edit bug during the unwind window (see D-15) |
| C6 | EPIC L88–94 table: "7 \| Mechanical propagation sweep"; L354 dependency graph "Phase 7 (mechanical sweep — staffProcedure rename, projects IDORs)" | EPIC L4, L163–169 "**corrects the 'Phase 7 = mechanical sweep' premise**"; L307 Phase 7 = "DAL self-scopes off `ctx.actor` (CASL-native, action-aware)" | B wins; table + graph are stale (never updated) |

### C.2 Factory-agnostic vs DAL-self-scoping

| # | Doc A | Doc B | Winner |
|---|---|---|---|
| C7 | P5 L18 "`create-crud-dal.ts` **MUST NOT** be edited and **MUST NOT** read `ctx.actor`"; P5 L866 verification "factory still agnostic"; M-P5 L23 "the factory reads `ctx.scope` ONLY, NEVER `ctx.actor`"; EPIC L100 "the DAL is permission-agnostic (§3.2)"; P5 L110–118 `ScopedContext.actor` doc-comment "`scope` remains the pre-resolved cache the permission-agnostic CRUD factory consumes" | EPIC L23 "The DAL/CRUD layer SELF-SCOPES off `ctx.actor` … Phase 5's rule is SUPERSEDED by Grill B (never retracted in writing)"; EPIC L41 "point `createCrudDal`'s impls at `resolveActorScope(spec, ctx.actor, <slot action>)` (retire `requireResolvedScope(ctx.scope)` at `create-crud-dal.ts:117/:213/:264`)"; Grill B #3 EPIC L184 | B wins by explicit supersession — but P5, M-P5 and EPIC L100 still carry the old rule verbatim, and P5's doc-comment is presumably in the code |
| C8 | EPIC L100 "Target CRUD contract stays `ScopedContext` (`{session, ability, scope, tx?}`)"; L103 rebase seam "sub-plan A strips `hooks`/`duplicate` from `EntityServerSpec`, #285 strips `visibility`" | EPIC L44 retire `ctx.scope`; L41 edit `create-crud-dal.ts` | No doc reconciles the main-side CRUD-DAL epic with DAL self-scoping. The referenced sub-plan A design doc `docs/superpowers/specs/2026-08-13-crud-dal-sub-plan-a-factory-config-hooks-design.md` **does not exist in this worktree** (nor does `docs/plans/2026-08-20-backend-refactor-roadmap.md`) |

### C.3 `ctx.scope` / legacy engine described as current convention

| # | Doc A | Doc B | Winner |
|---|---|---|---|
| C9 | DOCS L150–165 "scope-resolution-is-the-core-superpower": `resolveVisibilityScope` → `ctx.scope`; DALs apply `.where(and(..., ctx.scope ?? undefined))`; L56–60, L362 bare `agentProcedure` leaves `ctx.scope` null; M-VIS L10–18 same | EPIC L117 (`?? undefined` replaced by `requireResolvedScope`, 26 sites); EPIC L24/L44/L184 `ctx.scope` retires; Retiring register L137 `resolveVisibilityScope` → `resolveActorScope` | EPIC wins; DOCS knowingly deferred to Phase 8 (EPIC L365). But DOCS L159 `?? undefined` idiom is already false post-Phase-4 |
| C10 | DOCS L365 "Manual `isOmni` … That's what `scopeMiddleware` exists for"; M-VIS L15–16 "explicitly `.use(scopeMiddleware(spec))`"; DOCS L102 mentions `scopeMiddleware` as the standalone form | EPIC L222 + M-SPLIT L17: `scopeMiddleware` fn **deleted** in Phase A (2026-08-20); DOCS L102 itself says the inline form is used, NOT `.use(scopeMiddleware(spec))` | EPIC/M-SPLIT win; DOCS L365 and M-VIS reference a deleted function |
| C11 | M-VIS L21 anchor `src/trpc/DOCS.md#scope-middleware-is-the-core-superpower` | DOCS L150 actual heading `### scope-resolution-is-the-core-superpower` | Anchor is stale |
| C12 | DOCS L171 shareable session path "resolves scope from `spec.visibility({ userId, ability })`" | EPIC L192, L331; D6 L128: that is the "shareable-SESSION legacy remnant (`shareable-middleware.ts:70` `resolveEffectiveScope`)" to be retired in Grill C / 7e | Consistent in fact; DOCS presents a known remnant as the rule |
| C13 | DOCS L179/L366 "CASL gating in handler bodies checks `if (ctx.ability)` — null means token path, CASL is intentionally bypassed" (a rule) | EPIC L175 the `ability == null` field-gate at `contracts.router.ts:191` "is the root of the imperative field-gating — the same auth-in-hooks anti-pattern C exists to kill" | EPIC wins as direction; DOCS states as convention what the epic calls an anti-pattern |
| C14 | DOCS L232–251 `assertCanUpdateFields` as the field-authz mechanism; EPIC L182 Grill B "`permittedFieldsOf` is YAGNI'd" | EPIC L29, L42 "`permittedFieldsOf` … Replaces hand-rolled `assertCanUpdateFields`"; CAT L101 anticipated `permittedFieldsOf` | Re-orientation wins over Grill B's YAGNI (both in EPIC; the later dated one wins) |

### C.4 Spec (v2, point-in-time) vs executed roadmap

| # | Doc A | Doc B | Winner |
|---|---|---|---|
| C15 | SPEC L255–264 phases: 3 = "Cut owned children over", 4 = "Point-probe + vuln fixes … delete `isVisible` bypass + `isInScope` … cut `canSeeUngatedPhone` to Actor", 5 = "Delete dead code + omni collapse" | EPIC L84–94 resequence: 3 = robustness gate; 4 = actor-seam (did NOT delete `isVisible`/`isInScope`, deferred phone → P5; L271–272); 5 = customer-pipelines; 6 = children; 7 = cutover; 8 = delete | EPIC wins (SPEC left as-authored per L59). M-CASL L35/L37 "6 phases 0–5" is stale |
| C16 | SPEC L38 (Fork A) owned children = `customer_profiles, customer_notes, customer_lead_attribution, customer_enrichment`; SPEC L221 + PS3 L63–72 "6 owned sub-entities … 4 missing specs"; M-SPLIT L20 "child bridge on 6 children + 4 missing specs"; EPIC L262 same | D6 L24–35 "the 2026-08-12 '6 children / 4 missing specs' count is **STALE** … Only 2 specs lack `parent` … **Zero new specs needed**"; EPIC L295 | D6 wins (newer, "re-grounded from code") — but it silently drops `customer_profiles`, `customer_lead_attribution`, `customer_enrichment`, `proposal_views` from the child roster with no ruling that they need no spec (see D-10). `applications`→Meeting is a child the SPEC never listed |
| C17 | SPEC L262; PS3 L69, L99; EPIC L262: delete the `mutations.ts:37` inline probe | D6 L35; EPIC L295, L301: "`mutations.ts:37` is now the live Phase-5 `scopedFor` closure, NOT a dead probe — nothing to delete" | D6 wins |
| C18 | SPEC L281 (§9) `canSeeUngatedPhone` "must be re-typed to take an `Actor` **now**" | EPIC L272 (controller ruling 2026-08-18) "Premise … is FALSE in boundary-only P4 … DEFERRED to Phase 5"; shipped P5 (L287) | EPIC wins |
| C19 | SPEC L165 dispatcher = `{ pipeline:'active', $hasNoMeeting:true }`; SPEC L140 `$hasNoMeeting` defined | EPIC L238, CAT L100, M-CASL L23: `$hasNoMeeting` ORPHANED ("would wrongly exclude rehash"); dispatcher = `$inDerivedPipeline` | EPIC wins; keep-or-drop still TBD |
| C20 | SPEC L201–202 `resolveScope` hard-codes `'read'`; PS3 L25 "`verbOnly(actor,'read',spec.caslSubject)`" | SPEC L80 `compileScope` takes full `AppAction` "so the same compiler serves … without a later signature break" | Internal tension in the spec itself; re-orientation L24/L41 resolves toward action-aware resolver |
| C21 | EPIC L101 "Q1 (forced): `ctx.actor?: Actor` added *additively*"; L286 "Introduce `ctx.actor?: Actor` additively" | EPIC L280 "`actor: Actor` added … **required (non-null)**, not `?:`"; P5 L74 | L280/P5 win (execution record); L101/L286 are stale design text |

### C.5 Catalog (2026-08-10, "living") vs later rulings

| # | Doc A (CAT) | Doc B | Winner |
|---|---|---|---|
| C22 | CAT L122 projects predicate "**UNRESOLVED** — see Fork/Open Q"; L190–194 "One is wrong… Business question" | EPIC L247 ruling 2026-08-11 `participation OR ownerId=me`, `isPublic` dropped | EPIC wins; CAT never updated despite L4–6 "living catalog… add to it" |
| C23 | CAT L178–185 Fork A "Decision needed" | EPIC L238 (A) peer-roots ruling 2026-08-11 | EPIC wins |
| C24 | CAT L159–162, L187 Fork B "→ make **3 explicit rules**" | SPEC L171–173 "Preferred: keep `LeadsPool` as a named CASL capability"; EPIC L238 "LeadsPool stays ONE named capability (not a 3-rule split)" | SPEC/EPIC win |
| C25 | CAT L100 dispatcher canonical `{leads, rehash}`; "Phase 1 shipped `['leads']`"; M-CASL L23 same; D6 L160 (risk register) "CASL dispatcher Customer read is `['leads','rehash','dead']`" | EPIC L7, DISP L165/L205, M-SPLIT L24: `['leads','rehash','dead','fresh']` (user ruling 2026-08-20; shipped `ad71a076`) | DISP/EPIC L7 win; CAT, M-CASL, D6 L160 stale |
| C26 | CAT L86 dispatcher/agent Meeting = participation; CAT L153–155 dispatcher "Meeting read/create/update" (implicitly scoped) | DISP L165 "dispatcher Meeting scope = null (allow-all)" — unconditional `can('read','Meeting')` shipped `ad71a076`; EPIC L312 | DISP wins; CAT stale |
| C27 | CAT L126–139: "None declare `parent`… `proposal_media_files` No spec… `media-files` **No spec at all**" | D6 L28–33: both media children have specs AND `parent` (built by media/projects-std epics); Phase 6 adds `parent` to notes + applications | D6 wins; CAT Part 3 sub-entity table stale |
| C28 | CAT L145–147 "Zero `cannot()` rules; zero object-conditions today" | EPIC L238/L247: conditional rules live at `abilities.ts` since Phase 1 | EPIC wins; CAT Part 4 stale (still zero `cannot()` per B43 etiquette) |
| C29 | CAT L221 Point-Probe named `isVisible(spec, principal, id)`; L217 compiler named `resolveActorScope(spec, principal)`; L80 operator `$participatesViaMeetingPath{through}` | SPEC/EPIC: `canAccess`, `resolveActorScope`/`compileScope`, `$participatesViaMeeting{via}` | SPEC/EPIC win; CAT vocabulary is pre-design |

### C.6 Phase-6 design vs what dispatcher corrections shipped on top

| # | Doc A | Doc B | Winner |
|---|---|---|---|
| C30 | D6 L68 "no `update`/`delete` CustomerNote grant is added in Phase 6 … stays on `assertNoteAuthorOrAdmin` until Grill C"; EPIC L297 same | DISP Task 3 (L229–240) + M-SPLIT L25 + EPIC L5: dispatcher `update/delete CustomerNote` granted 2026-09-06 (conditionless, hook-enforced) | DISP wins (later); D6 statement is a superseded boundary, not wrong |
| C31 | D6 L70 "the note create-hook's `buildUserContext(userId, role, customerServerSpec)` probe still resolves" (left on legacy) | M-SPLIT L28–29, EPIC L5: it did NOT track the CASL widening → NOT_FOUND → converted to `canAccess` (`5a983124`, "single CASL engine") | M-SPLIT wins; D6 L70's "untouched" is superseded |
| C32 | EPIC L173 "**Dispatcher Task 2 now blocks on Phase 7**"; L195 "Task 2 … lands *after* the Phase-7 read cutover … else it activates the financial leak" | EPIC L3 "Dispatcher-visibility corrections DONE 2026-09-06 … didn't wait for Phase 7"; M-SPLIT L24 "Executed WITHOUT waiting for Phase-7 Grill B because Task-1's local gate makes it safe standalone" | L3/M-SPLIT win; L173/L195 stale |
| C33 | EPIC L195 "Task 3: the note grant becomes a CASL `{authorId}` condition under Grill C, not a hook" | DISP L237 shipped hook-enforced (interim) | Not contradictory (interim vs target) but L195 reads as if Task 3 waits for Grill C |
| C34 | D6 L47 "Declaring `parent` now is what makes that Phase-7 flip safe" (Tier-2 on the verbOnly+bridge shape) | EPIC L48–51 (uncommitted): under that same shape the child branch "would **silently ignore** `{authorId}`" — i.e. the Phase-6 shape is safe for *read* but structurally cannot carry own-record mutation conditions | Newer wins; D6 was reasoning about reads only (D6 L137 flagged action-threading as deferred) |

### C.7 Memory-file staleness

| # | Statement | Newer truth |
|---|---|---|
| C35 | M-CASL L35 "epic tracker … (6 phases 0–5)"; L37 "(all phases 0–5)" | EPIC has Phases 0–9 + 7.5 + A |
| C36 | M-CASL L31 "Phase 4 (point-probe/vulns) and Phase 5 (delete old engine + omni collapse) remain" | Phase 5 = customer-pipelines; delete = Phase 8 (EPIC L84–94) |
| C37 | M-CASL L23 dispatcher `{leads, rehash}` "ADDS rehash to dispatcher visibility"; M-CASL L21 `$hasNoMeeting` "would wrongly exclude rehash" | Now `['leads','rehash','dead','fresh']` (C25) |
| C38 | M-SPLIT L18 "Dispatcher Task 2 now blocks on Phase 7"; L20 "NEXT WORKLOAD = Phase 6 … 6 children + 4 missing specs" | M-SPLIT L24 Task 2 shipped; D6 zero new specs (C16) — the memory file contradicts itself across dated sections (it is an append-log; latest section wins) |
| C39 | M-DISP L14 "`read LeadsPool` is the single selector used in 3 places: customer visibility …" | Customer visibility selector dissolved into `$inDerivedPipeline` (Phase 1/A); phone + pipeline-set still key off `LeadsPool` (B6) |
| C40 | M-DISP L16 "`EntityServerSpec.visibility: … (scope: {userId, ability}) => SQL`. All 11 `*/lib/visibility.ts` adapted" | 9 deleted in Phase A; 2 more in Phase 6; `visibility` field itself slated to retire (EPIC L24) |

### C.8 Tracker bookkeeping staleness (minor)

| # | Statement | Issue |
|---|---|---|
| C41 | EPIC L291 Phase 5 "Plan: _(JIT)_"; L304 Phase 6 "Plan: _(JIT)_" | Both plans exist (P5, P6); L280 already cites P5 |
| C42 | EPIC L363 "Check a phase's box when its plan lands green" | Phase 7 box unchecked correctly; but the "IN PROGRESS" claim rests on commits slated for revert |
| C43 | EPIC L59 says completed plan docs 0/1/3 + spec use old names — but CAT L217 uses `resolveActorScope(spec, principal)` (pre-rename, by coincidence the current DAL name) and PS3 L49 uses `resolveActorScope` to mean today's `resolveTrpcActorScope` | Reader must apply the L59 mapping per doc |
| C44 | EPIC L129 register policy "every shim annotated + ledgered" | `createCrudRouter.resolveScope?` (default legacy) is a shim with no entry (moot if reverted) |

---

## D. Open questions the docs leave unresolved

Ordered by the docs' own urgency markers.

1. **⚠️ OPEN grill question — CHILD branch and own-column conditions (EPIC L48–51; M-SPLIT L47; "decide FIRST next session — hook-retirement depends on it").** `resolveActorScope`'s child branch = `verbOnly` + parent bridge (`read`), so a CustomerNote `{authorId}` (child's OWN column `customer_notes.author_id`) would be **silently ignored**. Shapes: **(a)** child branch compiles own-column conditions AND `parentBridge('read')`; **(b)** model own-record entities (notes) as ROOTS (no `parent`), folding parent-customer visibility into an operator (e.g. `$customerVisible`). Either reopens SPEC §2 "Child inheritance mechanism"/§5 (B3), which EPIC L69 says requires noting in the phase plan + a ping. Not decided. Sub-questions the docs do not address: does (a) apply the child's *own* conditions per action while the bridge stays `read`? does (b) require a `$customerVisible` operator per parent type (Customer/Meeting/Proposal/Project)? what happens to `applications`→Meeting (no own-record rule) and the media children under (b)?

2. **tokenActor authorization fork A vs B (EPIC L175, Grill-C opening frame; D6 L136).** A = keep tokenActor ability-less + one bearer-guard helper (capability ≠ identity); B = `defineHomeownerAbilitiesFor(subject,rowId)` so `verbOnly`/`compileScope`/`permittedFieldsOf` apply to homeowners. "Lean was B … held loosely." The re-orientation says nothing explicit; its "one rules array client+server+DAL" and `permittedFieldsOf` adoption implicitly favour B, but B21 (locked 2026-08-18 "NO ability") still stands unretracted.

3. **Phase 7.5 pre-merge vs post-merge (EPIC L332, "decide at grill time").** Mooted only if the fold-back (C3) is accepted; the docs never say "L329–334 is deleted."

4. **What exactly is the unwind of `3e901178`/`b40403b6`?** EPIC L18 "Revert both" — literal `git revert` (removing the `resolveScope?` option too) vs. keeping the option until the DAL cutover? And the dispatcher customer-edit "Failed to update profile" (EPIC L7) + meeting getById/update fix (L312) re-open in the window between revert and DAL cutover — no doc states the interim behaviour or ordering (C5).

5. **Grill C is still "owed its grill" (EPIC L174, L330), and the re-oriented Phase 7 has NO plan** (L320 "per-unit JIT" refers to the superseded 7a–7h units). The re-orientation gives a 7-item work list (L39–46) but no order, no equivalence gates per item, no HITL points.

6. **CRUD-DAL mutation-interface epic coordination (C8).** P5 L18 froze `create-crud-dal.ts` for the sub-plan A rebase seam; the re-orientation edits it (L41). Sub-plan D field-authz slices "gate on #285" (EPIC L103). Two referenced docs are absent from the worktree (`…sub-plan-a-factory-config-hooks-design.md`, `…backend-refactor-roadmap.md`). Unaddressed.

7. **Wall/guard shape** (EPIC L186, L46): "can't naively ban legitimate joins — the enforceable invariant is a *separate-query* cross-entity read of a scoped table applies `resolveActorScope`". Lint rule vs CI grep vs runtime assert — TBD in the Phase-7 JIT plan.

8. **`$hasNoMeeting` keep-or-drop** (EPIC L238; CAT L100; M-CASL L23). TBD since 2026-08-12.

9. **Pipeline drift #5 (`customer-pipelines:367`)** — "gated on Phase-2 rehash ruling" (EPIC L158); 7f/7h "resolve #5 *if* the rehash `domains/pipelines` ruling has landed" (L317). Phase 5 shipped the outcome-derived classification (L281) — is #5 now unblocked? Not stated.

10. **The four spec-less children** (`customer_profiles`, `customer_lead_attribution`, `customer_enrichment`, `proposal_views`): SPEC L221/PS3 L63–72 require specs + `parent`; D6 L35 "zero new specs needed" without ruling them out of scope. CAT L133–137 lists their unscoped writes. Phase 4 §8-1/§8-3 covered the meeting-flow profile write and proposal-views token path; `customer_enrichment`/`customer_lead_attribution` writes (PS3 L70–71: "→ `systemActor`"/"`token`/`system`") have no documented landing phase.

11. **`ScopedContext` end-state shape** after `ctx.scope` retires — `{session, ability, actor, tx?}`? Does `ability` survive when `actor.kind==='user'` already carries it? Not stated.

12. **Client Mirror / Field Mask deferred specs (SPEC L283)** vs re-orientation L30/L45 pulling "client reads the same ability" into Phase 7 — is the deferred Client Mirror spec now in-scope, and does the dynamic phone `CASE` Field Mask ride along? Not stated.

13. **`subject()` tagging + `Pick<$inferSelect>` condition typing, `@ucast/core` explicit dep** (EPIC L37) — "Adopt" with no owner/phase.

14. **Grill-D customer-pipelines API rethink** (EPIC L341; `docs/plans/2026-09-04-customer-pipelines-feature-boundary-refactor.md`) — MUST land before merge; not scheduled to a phase.

15. **Interim staff gate reconception** (`can('access','Dashboard')` INTERIM, EPIC L126, L138) — "future"; no trigger.

16. **`manager` role** — motivating case (SPEC L20; CAT L88) but "FORTHCOMING — NOT in `userRoles` enum… Do NOT flag as staleness" (M-CASL L21). No phase.

17. **Homeowner-always-token future guard** — holds "only because `homeowner`/`user` roles are unused stubs" (M-P5 L22); the structural guard is on the shareable seam only (D6 L122). What guards `protectedProcedure` if those roles activate? Not stated.

18. **Activities `FORBIDDEN`→`NOT_FOUND` whole-file flip** (EPIC L339) — "when activities is standardized (or in the Phase-7 sweep if touched)"; the re-orientation's item 4 touches Activity ownership (Ledger 2) — so does it land in Phase 7? Not stated.

19. **HITL points**: Phase 1's "confirm rule set per entity before cutover" was the last explicit HITL; Phase 9 is HITL. The re-oriented Phase 7 (authoring `(conditions+fields)` per action for every scoped entity, L40) is by nature HITL (business rulings per role×action×entity) but is not marked so.

20. **Phase 8 omni collapse count** — SPEC L177/EPIC L325 say three sites; CAT L163–164 says four copies (`scope.ts:71` too) plus ~15 `isOmni` call sites. Which count is the AC (`"omni special-cased in zero files"` L327)?

---

## E. Vocabulary map (canonical name → old names → one-line definition as the docs define it)

| Canonical (current) | Old / aliases | Definition per docs | Fate |
|---|---|---|---|
| `resolveActorScope(spec, actor)` — `src/shared/dal/server/lib/resolve-actor-scope.ts` | `resolveScope` / `resolve-scope.ts` (renamed 2026-08-13, EPIC L59; M-CASL L13). CAT L217 "Scope Compiler `resolveActorScope(spec, principal)`" | The DAL scope authority. Root → `compileScope`; child → `verbOnly AND fk IN (SELECT parent.pk WHERE resolveActorScope(parent))`; system → `null`; token → `actor.scope` (SPEC L198–208; D6 L15–20). **Hard-codes `'read'`** today (EPIC L167, L217) | Becomes `resolveActorScope(spec, actor, action)` — action-aware; the single read+mutation authority (EPIC L23–24, L41) |
| `resolveTrpcActorScope(spec, {userId, ability})` — `resolve-trpc-actor-scope.ts` | `resolveActorScope` at *router* call sites in Phase 0/1/3 docs (EPIC L59) | tRPC request wrapper, always a `userActor`; `≡ resolveActorScope(spec, userActor(userId, ability))` (EPIC L184) | Presumably retires with `ctx.scope` (not stated explicitly) |
| `compileScope(actor, action, subject, ctx)` | — | The compiler: `rulesToAST` → ucast → `interpret` → SQL; sentinels per B10 (SPEC L113–119) | Keep — "CANONICAL" (EPIC L33–34) |
| `verbOnly(actor, action, subject)` | — | Child own-term: system/token → `null`; user → `can ? null : sql\`false\`` (SPEC L211–215) | Subject of open question D-1 |
| `canAccess(spec, actor, id, action='read')` | CAT L221 `isVisible(spec, principal, id)` (target-facade name, pre-design) | Async point-probe: `SELECT 1 WHERE pk=id AND scope` (SPEC L231–236); precursor probes use parent READ (B14); "the single CASL point-probe" (M-SPLIT L29) | Keep |
| `resolveEffectiveScope(spec, {userId, ability})` — `src/shared/dal/server/lib/scope.ts` | "Increment A" engine (EPIC L9) | LEGACY engine: reads `spec.visibility` or bridges via `bridgeToParent`; throws if neither (EPIC L191) | Delete Phase 8 (register L136) |
| `bridgeToParent` — `scope.ts:51` | — | Legacy child bridge using the parent's legacy `visibility` fn (D6 L22) | Delete Phase 8 |
| `isVisible(spec, ctx, id)` — `scope.ts:68` | — | Legacy point-probe; `if (!ctx.session) return true` bypass (SPEC L26) | Delete Phase 8 |
| `isInScope` — `scope.ts:90/94` | `@deprecated` | Legacy probe on ambient `ctx.scope`; residual `?? undefined` knowingly left (EPIC L136) | Delete Phase 8 |
| `resolveVisibilityScope(spec, {userId, ability})` — `src/trpc/lib/middleware/scope-middleware.ts` | — | Legacy tRPC request scope: `isOmni ? null : resolveEffectiveScope(...)` (DOCS L152–157); used by `createCrudRouter` `authedProcedure` (`create-crud-router.ts:85`), applications/projects procedures (M-SPLIT L30) | Register L137 → `resolveActorScope`; Phase 7/8 |
| `scopeMiddleware(spec)` | — | Legacy standalone `.use()` middleware | **Deleted Phase A** (EPIC L222); still cited by DOCS L365, M-VIS L16 |
| `buildUserContext(userId, role, spec)` — `helpers.ts:71` | — | Legacy context builder for services/jobs; one of 3 omni-collapse sites (SPEC L177); stamps `userActor` since P5 | Retire 7e (EPIC L316) / re-orientation L44; consumers: `meeting-flow.router`, projects `business.router` |
| `shareableMiddleware(spec)` — `src/trpc/lib/middleware/shareable-middleware.ts` | — | Dual-credential; **session-first** (agent-first): session → `userActor` (legacy `resolveEffectiveScope` remnant at `:70`); token → `tokenActor`, `ctx.scope = eq(tokenColumn, token)`, `ability = null`; else UNAUTHORIZED; actor-kind guard per branch (DOCS L169–175; D6 §2.4) | Legacy remnant → Grill C/Phase 7; omni branch → Phase 8 |
| `resolveShareTokenActor(token, 'proposal')` — `src/shared/domains/permissions/lib/share-token-actor.ts` | the 4 hand-rolled `proposal.token !==` checks | THE canonical bearer-token → `tokenActor` path (P4 L184–220; EPIC L115) | Keep |
| `Actor` = `userActor(userId, ability)` \| `tokenActor(scope, subject)` (scope-first) \| `systemActor(reason: SystemReason)` — `src/shared/domains/permissions/scope/actor.ts` | CAT "Principal" (L206, L225) | Tagged union "who is acting and how far their authority reaches"; omni no longer `null`; system is the one loud bypass; token carries `scope: SQL` never null (SPEC L49–66) | Keep |
| `SystemReason` — `scope/system-reasons.ts` | — | Closed namespaced union = auditable bypass catalog (EPIC L116; P4 L38–60); implemented variants incl. `derived:contract-age-from-token-proposal`, `legacy:system-context` (P5 L79–88) | `legacy:*` retired Phase 8 |
| `systemContext(reason)` / `SYSTEM_CONTEXT` | null-session sentinel `{session:null, ability:null, scope:null}` (+ `actor: systemActor('legacy:system-context')` since P5) | Named unrestricted context factory vs the bare legacy default (P4 Task 1; P5 L88) | `SYSTEM_CONTEXT` gone Phase 8 (register L135) |
| `requireResolvedScope(scope)` — `dal/server/lib/helpers.ts` | `ctx.scope ?? undefined` (26 sites) | `undefined` → throw; `null` → `undefined` (allow-all); SQL → SQL (P4 L110–145; EPIC L117) | Retired at the 3 CRUD-DAL sites by re-orientation L41; remains elsewhere |
| `ScopedContext` — `src/shared/dal/server/types.ts` | `BaseTRPCContext` is the same shape (M-P5 L20) | `{ session, ability, scope: SQL\|null, actor: Actor }` — `actor` required since P5 (EPIC L280) | `scope` retires (EPIC L24) |
| `ctx.scope` | — | Per-entity pre-resolved visibility predicate consumed by the factory (`create-crud-dal.ts:117/213/264`) | **RETIRE** (EPIC L24, L44) |
| `ctx.actor` | — | "WHO is invoking this — the source of truth from which scope is derived" (P5 L110–118) | The seam the DAL self-scopes off (EPIC L23) |
| `spec.visibility(scope: {userId, ability}) => SQL` | `(userId) => SQL` pre-dispatcher (M-DISP L16) | Legacy hand-written row predicate on `EntityServerSpec`; sole reader = `resolveEffectiveScope` (EPIC L220) | **RETIRE** (EPIC L24, L44); 9 dropped Phase A, 2 Phase 6; Tier-1 four remain |
| `spec.parent: { spec, fk }` | — | Engine-agnostic structural FK containment; `fkColumn` throws if `fk` isn't on the child's own table (Phase 3) | Keep (subject to D-1 shape (b)) |
| `EntityServerSpec` | — | `{ entityName, caslSubject, table, primaryKey?, parent?, shareable?, hooks?, duplicate? … }` — target shrinks to a near-pure registry entry (SPEC L186–192) | `visibility` stripped |
| `defineScopeOperator({name, parseValue, toSql, toJS?})` | — | Single-registration operator seam; operators `$participatesViaMeeting{via:'self'\|'customerId'\|'projectId'\|'meetingId'}`, `$hasNoMeeting` (orphaned), `$inDerivedPipeline:[…]` — registered UNPREFIXED (EPIC L242) | Keep |
| `$participatesViaMeeting` | CAT `$participatesIn` / `$participatesViaMeetingPath{through}` (L86, L99, L121) | The participation atom `userParticipatesInMeeting` viewed through a FK; three join topologies (SPEC L147–156) | Keep |
| `$inDerivedPipeline:[…]` | `leadsPoolVisibility()` (`pipeline='active' AND NOT EXISTS meeting`), `LeadsPool` visibility branch | Emits `derivedPipelineWhere(values)` = `derivedPipelineSql() IN (…)`; 5 outcome-derived buckets `projects\|fresh\|leads\|rehash\|dead` (M-P5 L33–40) | Keep; dispatcher set = `['leads','rehash','dead','fresh']` |
| `LeadsPool` | — | Named CASL capability with 3 consumers (row-visibility → dissolved into `$inDerivedPipeline`; phone ungate; pipeline-set) (SPEC L171; M-DISP L14) | Keep as ONE capability (B6) |
| `canSeeUngatedPhone(actor)` | `(ability: AppAbility\|null)`; `gatedPhoneSql(isSuperAdmin)` (M-DISP L15) | non-user → `true`; user → `manage all \|\| read LeadsPool` (P4 L520–525) | Keep |
| `getAccessiblePipelines(ability)` / `DISPATCHER_PIPELINES` | — | Pipeline-set guard; router rejects out-of-set tabs → FORBIDDEN (EPIC L283; DISP L165) | Keep |
| `assertCanUpdateFields` — `create-crud-router.ts` | — | Per-field `ability.can('update', subject, field)` in the update slot (DOCS L232–251) | → `permittedFieldsOf` (EPIC L29, L42) |
| `assertNoteAuthorOrAdmin` — `assert-note-author.ts` (+ client mirror `use-customer-note-action-configs.ts`) | — | Imperative own-record gate, hand-triplicated (EPIC L213) | → CASL `{authorId}` condition (EPIC L43) |
| `agentProcedure` → `staffProcedure` | — | Gate `can('access','Dashboard')` = "is Tri-Pros staff" (real security boundary, EPIC L121–123); rename only | Rename in Phase 7 (7g) |
| `<entity>Procedure`, `<entity>ShareableProcedure`, `projectProcedure`, `projectMediaProcedure`, `proposalMediaProcedure`, `systemProcedure`, `superAdminProcedure` | — | Per-entity pre-scoped procedures defined once (DOCS L83–108); `projectMediaProcedure` = CASL child-scoped (D6 L76–83) | Scope-injection role retires with `ctx.scope` |
| `createCrudRouter({spec, schemas, handlers?, resolveScope?})` — `src/trpc/lib/create-crud-router.ts` | — | 5-slot factory; `resolveScope?` (default legacy) added `3e901178` (EPIC L7) | `resolveScope?` = wrong layer, revert (EPIC L18) |
| `createCrudDal(spec)` — `src/shared/dal/server/lib/create-crud-dal.ts` | "generic CRUD factory", "permission-agnostic DAL" | `getById`/`update`/`delete` apply `requireResolvedScope(ctx.scope)` at `:117/:213/:264`; `createImpl` uses no scope (EPIC L41) | Self-scopes via `resolveActorScope(spec, ctx.actor, <slot action>)` |
| `derivedPipelineSql()` / `derivedPipelineWhere([...])` — `customers/lib/derived-pipeline-sql.ts` | `customers.pipeline` stored column (write-orphaned) | Outcome-derived, priority-ordered, first-match classification from `MEETING_OUTCOME_CLASS` (M-P5 L25–40) | Keep |
| Tier 1 / Tier 2 | — | Tier 1 = Customer/Meeting/Proposal/Project (own conditional CASL rules; flip provably equivalent); Tier 2 = CustomerNote/Application (conditionless verb + parent bridge; flipping without `parent` WIDENS) (EPIC L187–189) | — |
| Class A / B / C | — | A = mis-scoped user write; B = genuinely privileged `systemActor`; C = bearer single-row `tokenActor` (EPIC L110) | — |
| Phase A / Phase P / Grill B / Grill C / Grill D / Track B / Track C / Phase 7.5 / Phase 9 | — | A = dead-code pull-forward (shipped); P = Propagation (dissolved into 5+7); B = financial read chokepoint (locked); C = action-aware mutations + hook retirement (not grilled); D = legacy retirement tail (consequential) / also "Grill-D residual" = customer-pipelines API rethink (EPIC L341); Track B/C + 7.5 = the superseded split; 9 = pre-merge E2E gate | Track B/C/7.5 superseded (uncommitted) |
| `maskFinancials` / `canReadProposals` | — | Defensive dispatcher financial-wall plumbing in `get-customer-profile.ts`/`get-customer-pipeline-items.ts` — "knowingly *not good code*" (EPIC L341) | Redesign before merge (Phase 9) |
| `hasAssociatedMeeting()` | — | "real vs portfolio" project business filter — NOT authorization (CAT L123); kept live in Phase A | Keep beside scope |
| `MEETING_OUTCOME_CLASS`, `MEETING_OUTCOME_SENTIMENT`, `OUTCOME_PIPELINE_MAP` | — | Single outcome-class SoT (`unset\|neutral\|positive\|negative-recallable\|negative-terminal`) everything derives from (M-P5 L14) | Keep |

---

## F. Referenced code symbols / paths (for existence verification by another agent)

Grouped; each item is cited by at least one doc read above. `(?)` = line number quoted by a doc and likely drifted.

**Permissions domain — `src/shared/domains/permissions/`**
- `abilities.ts` (`defineAbilitiesFor`; project rules at `:149-150` (?); dispatcher block; `:105,128,133,142,200,219` (?) historic)
- `types.ts` (`AppAbility = MongoAbility<[AppAction, AppSubject]>`, `AppConditions`, `AppSubject`, `AppAction`)
- `scope/actor.ts` (`Actor`, `userActor`, `tokenActor`, `systemActor`)
- `scope/system-reasons.ts` (`SystemReason`)
- `scope/ast.ts`, `scope/operators.ts` (`defineScopeOperator`, `registeredOperatorNames()`), `scope/interpret.ts` (`interpretCompound`), `scope/compile-scope.ts` (`compileScope`)
- `scope/conditions-matcher.ts` (`buildScopeConditionsMatcher`)
- `scope/operators/meeting-participation.ts` (`$participatesViaMeeting`, `$hasNoMeeting`), `scope/operators/derived-pipeline.ts` (`$inDerivedPipeline`)
- `lib/share-token-actor.ts` (`resolveShareTokenActor`), `lib/validate-share-token.ts` (`validateShareToken`)

**DAL infra — `src/shared/dal/server/`**
- `types.ts` (`EntityServerSpec` `:71`, `parent` `:95`, `ScopedContext` `:32-59`, `SYSTEM_CONTEXT`, `systemContext`, `VisibilityScope`)
- `lib/resolve-actor-scope.ts` (`resolveActorScope`, `verbOnly`, `canAccess`, `fkColumn`; `:68` (?)) — formerly `lib/resolve-scope.ts`
- `lib/resolve-trpc-actor-scope.ts` (`resolveTrpcActorScope`, `:22`)
- `lib/scope.ts` (`resolveEffectiveScope` `:37`, `bridgeToParent` `:51/52`, `isVisible` `:68`, omni `:71`, `isInScope` `:90/94`)
- `lib/helpers.ts` (`buildUserContext` `:64-76/:71`, `requireResolvedScope`)
- `lib/create-crud-dal.ts` (`:117` getById, `:213` update, `:264` delete, `createImpl`)

**tRPC — `src/trpc/`**
- `init.ts` (`baseProcedure`/`protectedProcedure`/`agentProcedure`/`superAdminProcedure`, `:45-61`), `types.ts` (`BaseTRPCContext`, `AuthedContext`), `lib/create-http-context.ts` (`createHTTPTRPCContext`, `createRSCTRPCContext`)
- `lib/create-crud-router.ts` (`createCrudRouter`, `:80`, `:85` `resolveVisibilityScope`, `:195` field check, `assertCanUpdateFields`, `resolveScope?` option)
- `lib/middleware/scope-middleware.ts` (`resolveVisibilityScope` `:26`; `scopeMiddleware` `:31` — deleted Phase A)
- `lib/middleware/shareable-middleware.ts` (`:39`, `:44`, `:64` omni, `:70` `resolveEffectiveScope` remnant)
- `routers/customers.router/crud.router.ts` (`resolveScope: resolveTrpcActorScope` — `3e901178`), `routers/customers.router/business.router.ts` (`:123/124` phone)
- `routers/meetings.router/crud.router.ts` (`b40403b6`), `routers/meetings.router/participants.router.ts` (`:37-44`, `:62-215`), `routers/meetings.router/reads.router.ts` (`:35`)
- `routers/proposals.router/procedures.ts` (`proposalProcedure`, `proposalShareableProcedure`, `proposalMediaProcedure` `:41` (?)), `routers/proposals.router/media.router.ts` (`:18`, `:64`), `routers/proposals.router/views.router.ts` (`:38-45/:44/:50`), `routers/proposals.router/contracts.router.ts` (`:189-196/:191`, `:213`, `:218`)
- `routers/projects.router/procedures.ts` (`projectProcedure`, `projectMediaProcedure`), `routers/projects.router/crud.router.ts` (`:39`, `:56`), `routers/projects.router/media.router.ts`, `routers/projects.router/business.router.ts`
- `routers/applications.router/procedures.ts`
- `routers/customer-pipelines.router.ts` (`:32/36`, `:68/72`, `:118-123`, `:147`), `routers/meeting-flow.router.ts` (`:40`, `:52`), `routers/dashboard.router.ts` (`:10`), `routers/schedule.router/activities.router.ts` (`:92-106`, `:191-205`), `routers/funnels.router`, `routers/voip-campaigns.router`, `routers/landing.router`, `routers/lead-sources.router`
- `server.ts`

**Entities — `src/shared/entities/`**
- `customers/lib/server-spec.ts` (`customerServerSpec`, `visibility: customerVisibility`), `customers/lib/visibility.ts` (`customerVisibility`, `:8/:11`), `customers/dal/server/visibility.ts` (`userCanSeeCustomer` `:9`, `leadsPoolVisibility` `:22` — deleted P5), `customers/lib/derived-pipeline-sql.ts` (`derivedPipelineSql`, `derivedPipelineWhere`), `customers/lib/phone-gating-sql.ts` (`gatedPhoneSql` `:51`, `canSeeUngatedPhone` `:37/41-45`), `customers/dal/server/queries.ts` (`:51`), `customers/DOCS.md` (`#derived-5-bucket-pipeline`, `#note-authorship`, `#three-jsonb-profiles`, `:26`)
- `meetings/lib/server-spec.ts` (`meetingServerSpec`), `meetings/lib/visibility.ts` (`meetingVisibility` `:9`), `meetings/dal/server/participants.ts` (`userParticipatesInMeeting` `:9`), `meetings/dal/server/queries.ts` (`:151`, `:165`, `:279`, `:294`), `meetings/lib/resolve-owner.ts` (`resolveMeetingOwnerId` `:14`), `meetings/DOCS.md`
- `proposals/lib/server-spec.ts` (`proposalServerSpec`, `shareable.tokenColumn`), `proposals/lib/visibility.ts` (`proposalVisibility` `:9`), `proposals/dal/server/{queries,mutations}.ts` (`:70`, `:122`, `:226`, `:323`), `proposal-media-files/lib/server-spec.ts` (`proposalMediaServerSpec`), `proposal-media-files/dal/server/authz.ts` (`:12`, `:23`), `proposal-media-files/dal/server/queries.ts` (`listHomeownerProposalMedia` `:56`), `proposal-views/dal/server/{queries,mutations}.ts` (`:36`, `:18`, `recordProposalView`), `proposal-incentives/dal/server/mutations.ts` (`:45/47`)
- `projects/lib/server-spec.ts` (`projectServerSpec`), `projects/lib/visibility.ts` (`projectVisibility` `:31`, `projectParticipationScope` `:11` — deleted P A, `hasAssociatedMeeting` `:44`), `projects/dal/server/queries.ts` (`:202`, `listProjects`)
- `media-files/lib/server-spec.ts` (`mediaFileServerSpec`), `media-files/dal/server/media-ops.ts` (`listMediaByOwner`, `reorderMedia`, `moveMediaPhase`, `setHeroImage`, `mediaPhases`, `:34`, `:55`), `media-files/services/media.service.ts`
- `customer-notes/lib/server-spec.ts` (`customerNoteServerSpec`, `:48`, `:61`, create hook), `customer-notes/lib/visibility.ts` (`customerNoteVisibility` — deleted P6), `customer-notes/lib/assert-note-author.ts` (`assertNoteAuthorOrAdmin`), `customerNoteCrud`
- `applications/lib/server-spec.ts` (`applicationServerSpec`), `applications/lib/visibility.ts` (`applicationVisibility` — deleted P6), `applications/dal/server/{mutations,queries}.ts` (`:34`, `:74`, `:163`, `:31`, `:57`)
- `app-settings/` (`appSettingServerSpec` — orphaned), `voip-*/` (7 specs), `voip-campaign-contacts/dal/server/queries.ts` (`:282`), `voip-messages`
- `customer-profiles`, `customer-lead-attribution`, `customer-enrichment` (no specs; `mutations.ts:37/59/87/105` (?))

**Features / domains / other**
- `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` (`:44-64`, `:206-221`, `:256-272`, `:367`, `:428-442`, `getProjectsPipelineItems`, `getLeadsPipelineItems`, `getRehashOrDeadPipelineItems`, `getFreshPipelineItems`), `get-customer-profile.ts` (`:51`, `:54-56`, `:90-116`), `get-action-queue.ts` (`:120-142`), `move-customer-pipeline-item.ts` (`:127`, `scopedFor`), `move-customer-to-pipeline.ts`, `mutations.ts:37`; `maskFinancials`, `canReadProposals`
- `src/features/customer-pipelines/.../customer-profile-modal.tsx` (`:72-91`), `use-customer-note-action-configs.ts`, `use-view-mode.ts` (`:15`), `proposal/index.tsx` (`:74`), `use-progressive-enrichment.ts`
- `src/shared/domains/pipelines/lib/get-accessible-pipelines.ts` (`getAccessiblePipelines` `:19`, `DISPATCHER_PIPELINES`), `domains/pipelines/lib/outcome-pipeline-map.ts` (`OUTCOME_PIPELINE_MAP`, `deriveMeetingPipeline`, `deriveCustomerPipelines`)
- `src/shared/constants/enums/meetings.ts` (`MEETING_OUTCOME_CLASS`, `MEETING_OUTCOME_SENTIMENT`, `RECALLABLE/TERMINAL/POSITIVE_OUTCOMES`, `NON_NEGATIVE_MEETING`)
- `src/shared/db/schema/{customer-notes,customer-profiles,customer-lead-attribution,customer-enrichment,proposal-views,proposal-media-files}.ts` (`:10`, `:38`, `:18`, `:14`, `:10`, `:16`)
- `src/app/api/proposals/[proposalId]/pdf/route.ts` (`:18-25`, `:27`), `.../summary/route.ts` (`:23-34`, `:31`)
- `src/shared/entities/meetings/...` DB indexes `meeting_one_owner_idx`, `meeting_one_co_owner_idx`
- Services: `accounting.service`, `customer-intake.service`, `contracts.service`, delete-cascade (EPIC L18)
- Deleted in Phase A: `projectVisibility`, `appSettingVisibility`, `voip{Call,Did,Message,LinkToken,Campaign,CampaignContact,ContactAttribute}Visibility`, `scopeMiddleware`, `projectParticipationScope`

**Docs referenced (existence checked in this worktree)**
- OK: `docs/superpowers/plans/2026-08-10-casl-phase-0-engine-scaffolding.md`, `2026-08-11-casl-phase-1-per-entity-cutover.md`, `2026-08-12-casl-phase-3-robustness-gate.md`, `docs/plans/2026-09-04-customer-pipelines-feature-boundary-refactor.md`, `docs/superpowers/specs/2026-08-12-customer-pipeline-classification-facade-design.md`, `docs/plans/2026-08-12-crud-dal-mutation-interface-extension.md`, `docs/adr/0002-entity-server-system.md`, `docs/plans/2026-07-09-dispatcher-role-implementation-plan.md`, `.superpowers/sdd/2026-08-11-casl-phase-1-per-entity-cutover/progress.md`, `.superpowers/sdd/2026-08-18-casl-phase-4-actor-seam-hardening/progress.md`
- **MISSING in worktree**: `docs/superpowers/specs/2026-08-13-crud-dal-sub-plan-a-factory-config-hooks-design.md` (EPIC L100), `docs/plans/2026-08-20-backend-refactor-roadmap.md` (MEMORY.md) — likely main-only
- External: `WebDevSimplified/casl-crash-course` at `<session scratchpad>/casl-crash-course` (EPIC L37 — session-specific path, may not exist)
- Package facts asserted: `@casl/ability@6.8.0` (`buildMongoQueryMatcher` export, `dist/es6c/index.js`, `dist/es5m/extra/index.js`), `@ucast/core`, `@ucast/mongo2js` (`createFactory`, `MongoQueryParser` `e.slice(1)`), `@ucast/mongo`, `@ucast/js`; `@ucast/sql` NOT installed
- Commits cited: `3e901178`, `b40403b6`, `b0d50234`, `5fec560b`, `b37695ca`, `5a983124`, `ad71a076`, `2243a2d0`, `c62813d5`, `6c565a66`, `ac8efe45`, `07442fb8`, `f286b3c6`, `59676416`, `c215c3d2`, `e136cd58`, `31181df0`, `96f5dcd3`, `4b352564..ac614fcb`, `2167e65c`, `e012eeab`, `d6302917→3390aaff`, `88e6ff2b`, `dd6d4a2d`, `ce76fc04`, `4e30a4ef`, `523a31cc`, `2cb7c451`, `9dca3d72`, `cf776d9e`, `ead96d15`, `603a4c1d`, `e2a8fd12`, `4a140784`
