# Projects tRPC Standardization Epic

> **Status (updated 2026-08-20):** Phase 1 ✅ SHIPPED · Phase 2 ✅ SHIPPED (widened into the cross-entity CRUD-DAL epic — sub-plans A/B shipped, C deferred, **D shipped 2026-08-19**, commits `0e66b7b6..7aca28ca`) · Phase 3 ✅ SHIPPED (CORE via D-e + residuals 2026-08-20, `c33adb9c..01144ab1` — accounting/business/media/gdrive all `db`-free; only the #285 scope-tightening tail remains, NOT this epic). **Master index:** `docs/plans/2026-08-20-backend-refactor-roadmap.md`.
> **Canonical requirements:** this doc (target + requirements + locked decisions) + the business rules in `src/shared/entities/projects/DOCS.md` (the behavior spec) + the retiring-seams register in `memory/project-projects-standardization-epic.md`.
> **Parent:** `docs/plans/2026-08-09-trpc-standardization-epic.md` — this is S8's **projects half**, spun out (lead-sources is the other half, grilling paused, deferred to after projects).
> **Coordinates with:** `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (#285 — **OWNS** projects visibility; do not build on the retiring seams) · `memory/project-crud-mutation-standardization.md` (the `createCrudDal` mutation-interface extension this epic's case study drives).
> **Related:** ADR-0002 (Entity Server System), ADR-0003 (backend layers), `docs/codebase-conventions/dal-conventions.md`, `src/trpc/DOCS.md`.

## Why this epic exists

Two goals, one entity:

1. **Migrate `projects` onto the standardized tRPC/DAL/entity structure** established in S1–S7 (per-entity `procedures.ts`, `createCrudRouter`, spec-driven `createCrudDal`, DAL under `entities/`, never-inline-`db`, reads bespoke). Projects is the last of the "big four" (Proposal → Customer → Meeting → **Project**) and today the most drifted: split-brain DAL, bare-`agentProcedure` router, inline `db` across five sub-routers, a foreign-table write (`account`), and a service that writes `projects` directly.

2. **Use projects as the case study to extend the `createCrudDal` mutation interface** so that *all* mutations can route through CRUD. Projects is deliberately chosen because it will grow proposal-sized — getting its mutation architecture right now is foundation-setting.

## The core thesis — mutations must not bypass CRUD

`createCrudDal` is where an entity's **server-spec hooks** (`create`/`update`/`delete`, before/after) fire. **Any mutation that does not go through `createCrudDal` silently skips those hooks** — the entity's invariants, derived-field enrichment, and side-effects (notifications, realtime, cache/media cleanup) are bypassed. Projects today mutates through *four* non-CRUD channels, each bypassing hooks: bespoke feature DAL (`manage-project.ts`), inline router `db` (`business.create`, `media.*`, `googleDrive.*`), and a service (`accounting.service.ts`).

The strict target: **every project mutation routes through `createCrudDal`.** But projects' mutation set is rich enough that some can't route through the CRUD interface *as it exists today* — a proposal-gated create, a portfolio hard-set-scopes create, cross-entity writes, multi-step media ops. Those bypass points are **gaps in the CRUD mutation interface**, not projects-specific accidents. This epic catalogs them and turns them into the requirements for extending `createCrudDal`/`createCrudRouter` — so that extension is designed against a real, complete case study rather than speculation.

**Framing (why this is epic work, not a standalone cleanup):** the current tRPC entity setup (`createCrudRouter` + spec-driven `createCrudDal`, as on `proposals`/`meetings`) is deliberately being **grown** as new entities surface needs it can't yet express. Projects is the sharpest example: its mutations lack a home in the current interface, so it overrides basic CRUD with bespoke procedures — the anti-pattern this whole standardization line is meant to retire. Phase 1's factory-free shape (see `docs/superpowers/plans/2026-08-11-projects-standardization-phase-1.md`, Decision 1) is therefore an explicitly **provisional** waypoint — a clean, de-inlined baseline — **not** the final form. The final form is projects on `createCrudRouter` with every mutation through `createCrudDal`, reached only after Phase 2/3 widen the interface surface.

## Target (definition of done)

- Projects fully on the standardized structure: `procedures.ts`, `createCrudRouter`, all persistence under `entities/projects/dal/server/`, `features/project-management/dal/` retired, zero inline `db` in any projects router/service, reads bespoke and `ctx.scope`-driven.
- **Every projects mutation routes through `createCrudDal`** (hooks fire) — achieved by extending the CRUD mutation interface where projects proves the need.
- A **`createCrudDal` mutation-interface extension requirements** deliverable (the case study), handed to `memory/project-crud-mutation-standardization.md`'s session.
- `pnpm tsc && pnpm lint` green per slice; behavior preserved except explicitly-flagged tightenings (which are #285's, not this epic's).

## Requirements & constraints

**Functional**
- **F1.** Consolidate all project persistence into `entities/projects/dal/server/`; retire `features/project-management/dal/` (`dal-conventions.md#dal-lives-under-entities-never-features`).
- **F2.** `procedures.ts` + `createCrudRouter` for projects; the CRUD slots that fit today route through `createCrudDal` with hooks (e.g. R2-cleanup-on-delete as `delete.before`); `list` + portfolio reads are bespoke leaves.
- **F3.** `x_project_scopes` writes live in the projects DAL; two derivation modes per `projects/DOCS.md#scope-extraction-from-proposals` (operational = proposal-derived via a `lib/` helper; portfolio = hard-set).
- **F4.** `googleDrive` de-inlined: `account` read/write → account DAL + a google-drive token service; `uploadFromFile` → app-wide `media.service.ingestFromDrive(store, …)` (store-agnostic, reusable by proposals-media); `getAccessToken` stays under `projects.googleDrive`, flagged for the users/account epic.
- **F5.** `media.router` inline `db` → media-files DAL + `media.service`; kill manual `updatedAt` (`.$onUpdate()`).
- **F6.** **Case study:** catalog every projects mutation that bypasses `createCrudDal`, the reason it must, and the interface capability that would let it route through. Output = the mutation-interface extension requirements.
- **F7.** Route the catalogued bypassing mutations through the extended `createCrudDal` (hooks fire) once the extension lands.

**Constraints**
- **C1. Never inline `db`** outside DAL. Mutations through `createCrudDal`; reads through bespoke DAL queries.
- **C2. Do not touch #285-owned visibility seams** — `projectVisibility`/`projectParticipationScope`, `resolveVisibilityScope`/`resolveEffectiveScope`, `EntityServerSpec.visibility`, the `get-customer-pipeline-items.ts:367` drift, and the media parent-bridge scope flip. See the retiring-seams register. The canonical visibility derivation (`projects/DOCS.md#project-visibility-scope`) is implemented **by #285** — hand its owner the pointer, don't build it here.
- **C3.** Reads consume `ctx.scope`; never hand-roll `isOmni ? … : participationScope`.
- **C4.** Behavior-preserving per slice except tightenings explicitly owned by #285. `pnpm tsc && pnpm lint` green; manual review.
- **C5.** The projects `DOCS.md` business rules are the behavior spec. Any code/doc divergence found → ping + reconcile.

## Verification model

No test runner in this repo. Each slice gates on `pnpm tsc && pnpm lint` green + manual review; for mutation-routing, a hand-authored uncommitted `tsx` scratch confirms the expected hooks fire. Same gate as the parent tRPC epic and the CASL epic.

## Phase breakdown

Legend: `AFK` = mergeable without live user decisions · `HITL` = needs a user ruling mid-phase. Each phase's detailed executable plan is written **just-in-time** when it unblocks (matching the sibling epics' cadence).

- [x] **Phase 1 · AFK · SHIPPED 2026-08-12 (commits `187df9e2..f6e848a8`, on `main`) — Structure migration (collision-free).**
  Executed via SDD from `docs/superpowers/plans/2026-08-11-projects-standardization-phase-1.md` (7 tasks + final-review fix). Behavior-preserving; tsc+lint green. Landed: `procedures.ts` (`projectProcedure`), all reads → `entities/projects/dal/server/queries.ts` (+ canonical `listProjects` on `ctx.scope`), mutations → `mutations.ts` (+ `setProjectScopes`, `lib/derive-scope-ids.ts`), manual `updatedAt` dropped (guarded for empty `.set()`), `business.create` de-inlined, `features/project-management/dal/` retired, docs fixed, `media`/`google-drive` tagged `TODO(1f)`. Deliberately NOT on `createCrudRouter`/`createCrudDal` (Decision 1 — Phase 3). **Behavior nuance:** scopes-only `updateProject` no longer bumps `projects.updatedAt`. **Follow-ups:** dead slots `crud.getAll`/`showroomDisplay.getDetail` (0 callers) left per GC1. See `.superpowers/sdd/2026-08-11-projects-standardization-phase-1/progress.md` for the full ledger + Phase 2 case-study inputs.
- [ ] ~~**Phase 1 · AFK · blocked-by: none — Structure migration (collision-free).**~~ (done — see above)
  DAL consolidation (retire `features/project-management/dal/`); reads relocation → `entities/projects/dal/server/queries.ts` (consume `ctx.scope`); `x_project_scopes` into the projects DAL (two derivation modes, `lib/` helper for the operational derivation); `googleDrive` de-inline + `media.service.ingestFromDrive`; `media.router` de-inline → media-files DAL + `media.service`; kill manual `updatedAt`; `procedures.ts` + `createCrudRouter` wiring the slots that fit today (with hooks). Mutations that can't yet route through CRUD are **left in place but tagged** `// BYPASS(crud): <reason>` for Phase 2. DOCS fix: `dal-conventions.md:46` stale `scopeMiddleware` ref.
  - **Plan:** _(JIT — write when the epic starts)_
  - **AC:** zero inline `db` in projects routers except the tagged bypasses; `features/project-management/dal/` gone; reads use `ctx.scope`; tsc+lint green; behavior preserved.

- [x] **Phase 2 · HITL · SHIPPED — `createCrudDal` mutation-interface extension. (ARCHITECTURE LOCKED 2026-08-12; decomposed into 4 sub-plans; A/B/D shipped, C deferred.)**
  **Widened by user directive from projects-only to CROSS-ENTITY.** Now an **epic index** — `docs/plans/2026-08-12-crud-dal-mutation-interface-extension.md` was re-cut (2026-08-12) from a chronological brainstorm into a forward-only guide: §1–§5 = settled foundation (problems, layering model, gap catalog G1–G8, final decisions); §6 = the four sub-plans; §7 = deps/retiring seams; §8 = deferred. **Locked model:** hooks OFF `EntityServerSpec` onto the `createCrudDal` `(crud, tx)` factory builder; two-layer additive hooks (factory=invariant + call-site=additive, onion-ordered w/ payload threading); prohibit-by-inversion; CRUD-based abstractions; **no `crud.raw`** (plain `db` for convergence/bulk, future `crud.bulk` deferred); **two-schema split** `@deprecated RETIRING(#285)`; recompute = abstraction enforced sole-door → `finalTcpCents` staleness structurally impossible; `afterCommit` phase; `tx` on `ctx`; permissions = orchestrator + #285.
  **The 4 sub-plans (spine `A → {B,C} → D`):** **A** · factory-builder hook relocation + update-impl hardening (G7/G4) — *INFRA, own grill (owns the typing story)*; **B** · transaction threading (`tx` on `ctx`, G1) — *INFRA, own grill*; **C** · `afterCommit` phase (QStash/Ably relocation) — *INFRA, own grill*; **D** · adopt the new factory (two-schema split, abstractions, per-entity hook migration, bypass-register elimination, route projects+lead-sources through CRUD) — *mechanical, one plan*. A/B/C each produce their own spec+plan; D feeds Phase 3.
  - **AC:** every projects mutation bypass catalogued with its interface-gap rationale (✅); cross-entity requirements deliverable exists and is linked from `project-crud-mutation-standardization` (✅); architecture locked + decomposed into sub-plans (✅); each infra sub-plan grilled + all planned (✅ — A/B grilled+shipped, C grilled+deferred 2026-08-19, D grilled+shipped 2026-08-19).

- [x] **Phase 3 · HITL · SHIPPED — CORE via D-e (2026-08-19) + RESIDUALS via `2026-08-20-projects-phase-3-residuals` plan (commits `c33adb9c..01144ab1`, on `main`).**
  **Shipped (D-e, commit `7aca28ca`):** `crud.router` create/update/delete + `business.create`'s project-row write route through `projectCrud` via `create/updateProjectWithScopes` (scopeIds as call-site closure) + R2 cleanup as `delete.before` (G4); the hand-rolled `hasFields` guard is gone.
  **Shipped (residuals, 2026-08-20 — all four files now `db`-free):**
  - `accounting.service.ts` — full R13: all six `db` sites route through `customerCrud`/`projectCrud`/`getById`/`update` + new `getProposalsByIds`/`getProposalsByInvoiceIds`/`getProposalByInvoiceId` queries (incl. the QB payment/invoice sync reads the original plan missed). `db` import gone.
  - `media.router` — `movePhase`/`toggleHero` → new `media-files/dal/server/mutations.ts` (`moveMediaPhase`/`setHeroImage`, naked-writer, hero-exclusivity); importable-media reads → new `listImportableProjectMedia`. `db` import + `TODO(1f)` gone. Hero-exclusivity + phase-move proven by dev-DB smoke.
  - `google-drive.router` — token refresh → new `googleDriveTokenService.getValidAccessToken` + `updateAccountTokens` on the accounts DAL. `db` import + `TODO(1f)` gone. **One accepted behavior nuance:** the upload path's no-account error unifies from `PRECONDITION_FAILED` → `NOT_FOUND` (matches `getAccessToken`; both are re-auth error paths).
  - `business.create` cross-entity READS → `getProposalsByMeetingId` + `customerCrud.getById` (unscoped `scope:null`; project-row WRITE was already routed).
  - **#285 tail (NOT this epic):** projects routers keep bare `agentProcedure` (unscoped) — swap to `projectProcedure` + gate `delete` on `can('delete','Project')`. This is the ONLY remaining projects item.
  - **AC met:** no projects mutation bypasses `createCrudDal`/sanctioned DAL; all four files import no `db`; hero/phase writes proven by smoke; tsc+lint green.

- [ ] **Follow-up phase(s) · HITL · blocked-by: Phase 3 + JSONB Wave 4 (SOW normalization) — Proposal Financials Consolidation.** *(Separate brainstorm — business logic, not architecture.)*
  Surfaced during the Phase 2 grill (2026-08-12): the finalTcp calculation is implemented **twice** — SQL (`recomputeProposalFinancials`, persisted `finalTcpCents`) and TypeScript (`computeProposalFinancials`, live editor) — which can drift; and the recompute *trigger* is scattered across 4 call sites. Consolidate onto ONE calculation + single-source trigger. **Driving realization (directional, verify to 100% in the follow-up):** eliminate `startingTcp` (meaningless now); project price = Σ individual SOW section prices; each SOW carries its own price/incentives/costs; proposal has global incentives; **finalTcp = Σ(SOWᵢ price − SOWᵢ discounts) − Σ(global incentives)** with `max(0,…)` floor; margin = finalTcp − Σ(SOW costs); `pricingDisplayMode` = the single lever for per-section-breakdown vs project-total display. **Driver:** JSONB decomposition waves (`projectJSON` decomposes at Wave 4 → SOW price/incentives/costs become first-class structured inputs, collapsing SQL rollup + TS façade). Full context: `docs/plans/2026-08-12-crud-dal-mutation-interface-extension.md` §12.4–12.5.

- **Coordinated externally (NOT this epic's slices):**
  - Projects **visibility** (participation + non-negative-outcome, `projects/DOCS.md#project-visibility-scope`) → #285 Phase 1–2 (its `meeting-participation` operator gains the negative-outcome clause).
  - Project-**media scope flip** (unscoped bare `agentProcedure` → child-scoped) → with #285 (parent bridge under the new compiler).

## Handoff — how a fresh session starts

1. Read this doc + `memory/project-projects-standardization-epic.md` (retiring-seams register) + `src/shared/entities/projects/DOCS.md` (behavior spec).
2. Confirm #285's state (Phase 0 shipped; visibility not yet cut over) so Phase 1 avoids the retiring seams.
3. Write the Phase 1 executable plan JIT via `superpowers:writing-plans`, then execute.

## Open pings (carry into the epic)

- `dal-conventions.md:46` — stale `scopeMiddleware` ref → fix in Phase 1.
- `projectParticipationScope` missing the negative-outcome filter → **#285 code gap** (implemented by #285, not this epic).
