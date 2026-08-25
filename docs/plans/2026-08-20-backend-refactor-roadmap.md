# Backend Refactor — Master Roadmap & Index

> **What this is:** the single orienting index for the multi-thread backend refactoring effort. It does **not** restate the per-thread epics — each thread keeps its own authoritative doc (linked below). This doc owns the **cross-thread status, dependency order, load-bearing decisions, and "what's left."** Open this first to re-orient; drill into a thread's own doc for detail.
> **Created:** 2026-08-20, reconstructed from the epic docs + git history (HEAD `7aca28ca`).
> **How to keep it honest:** when a thread ships a phase, update its row here AND its own doc. If they disagree, the thread's own doc is authoritative for detail; this doc is authoritative for cross-thread sequencing.

---

## The arc (how one effort became five threads)

A small UI pattern — entity-action buttons gated by CASL (ADR-0001, Mar 2026) — generalized into the whole backend:

```
#207 Entity Server System (079079c7, May 19) ── builds the architecture
  │  L0 createCrudHandlers → L1 createCrudRouter → L2 createEntityRouter
  │  + service/provider split (ADR-0003) + createCrudDal + EntityServerSpec
  │
  ├─ T1  tRPC Standardization Epic (Aug 9) ── corrects the router shape
  │        S1–S7 ✅ deleted createEntityRouter + entity-registry (d348fd3d)
  │        S8 audit ─┬─ spawns T5 (projects) + lead-sources half
  │
  ├─ T5  Projects Standardization Epic (Aug 11) ── proves the adoption path
  │        Phase 1 ✅ · Phase 2 = T2 · Phase 3 🟡 · Follow-up ⛔ (blocked on T4 Wave 4)
  │
  ├─ T2  CRUD-DAL Mutation-Interface Extension (Aug 12) ── extends the write factory
  │        A ✅ · B ✅ · C ⏸️ deferred · D ✅ (2026-08-19)
  │
  ├─ T3  CASL Scope-Compiler #285 (Aug 11) ── cross-cutting: authorization
  │        Phases 0–5 ✅ but ENTIRELY IN WORKTREE — nothing on main
  │
  └─ T4  JSONB Decomposition #256 (Jul 9) ── cross-cutting: data layer
           Waves 0–3 ✅ (code+dev-DDL) · W3 prod cutover ⬚ · W4 ⬚
```

**One line:** #207 defined the architecture, **tRPC-standardization** fixed its router shape, **Projects** proved the adoption path, **CRUD-DAL** grew the write factory adoption exposed, and **CASL + JSONB** are the authorization and data concerns every entity migration has to satisfy.

## Thread registry (authoritative docs)

| Thread | Owns | Authoritative doc |
|---|---|---|
| **T1 · tRPC Standardization** | router shape (`procedures.ts`, `createCrudRouter`; killed `createEntityRouter`) | `docs/plans/2026-08-09-trpc-standardization-epic.md` |
| **T2 · CRUD-DAL Mutation Interface** | the write factory (`createCrudDal`, hooks, tx) | `docs/plans/2026-08-12-crud-dal-mutation-interface-extension.md` |
| **T3 · CASL Scope-Compiler (#285)** | authorization / row-visibility compiled from CASL | `.worktrees/issue-285` branch copy (LIVE); the `main` copy `docs/plans/2026-08-10-casl-scope-compiler-epic.md` is a stale draft |
| **T4 · JSONB Decomposition (#256)** | data layer: blobs → columns/child tables | `docs/plans/2026-07-09-jsonb-research-findings-and-relational-decomposition.md` + `docs/plans/jsonb-decomposition-deprecation-ledger.md` |
| **T5 · Projects Standardization** | projects entity onto the standardized stack | `docs/plans/2026-08-11-projects-standardization-epic.md` |

## Status snapshot (on `main` unless noted)

| Thread | Shipped | Remaining |
|---|---|---|
| **T1** | S1–S7 ✅ (`createEntityRouter` gone) | projects routers still bare `agentProcedure` + inline `db` (media/gdrive/business); lead-sources router shape |
| **T2** | A, B ✅ · **D ✅ (2026-08-19)** | C deferred · D-c: accounting `db.update(projects)` bypass ✅ closed (2026-08-20); voip/link-token D-c sites fold into VOIP overhaul · crux-2 tx-atomicity deferred |
| **T3** | Phases 0–5 ✅ **in `.worktrees/issue-285` only** | Phases 6→7→8→9 + **single integration merge to `main`** |
| **T4** | Waves 0–3 ✅ code+dev-DDL | **W3 prod cutover** · **W4 SOW normalization** |
| **T5** | Phase 1 ✅ · Phase 2 ✅ · Phase 3 ✅ (core D-e + residuals 2026-08-20, `c33adb9c..01144ab1`) | #285 scope-tightening tail (T3) · Follow-up ⛔ (gated on T4 W4) |

---

## Load-bearing decisions & constraints (read before touching anything)

1. **🔒 NO prod DB pushes / migrations until the refactor epic + #285 are mostly/fully done** *(user decision, 2026-08-20)*. This gates the entire T4 shipping side: **do NOT run `pnpm db:push:prod`, JSONB Wave-3 prod cutover, or any Wave cutover** until the backend refactor and #285 land. Dev DDL / `db:push:dev` continues as normal. JSONB code work (Wave 4 decomposition) may proceed; only the *prod application* is deferred.
2. **Sub-plan C (`afterCommit`) is deferred, not cancelled.** The CRUD engine stays **naked + sequential**. Load-bearing caveat: a hooked mutation's external side-effects (QStash/Ably) live in `after` = pre-commit under a threaded tx, **not rolled back on abort** → any orchestrator threading a tx must own its hooks at the call site (canonical: `withTx` JSDoc in `helpers.ts`; markers in `meetings/dal/server/crud.ts`). Revival trigger = a recurring multi-write-atomic invariant.
3. **#285 integration risk is the biggest strategic hazard.** #285 is ~58 commits ahead / ~17 behind `main`, entirely in a worktree, and this session widened the exact conflict surface (`src/shared/dal/server/types.ts`): `ScopedContext` gained `tx?` (B) on main vs required `actor` (Phase 5) in worktree → must union to `{…, tx?, actor}`; `EntityServerSpec` was purged of `hooks`/`duplicate` (D-b) on main vs still-declared in worktree. **`tsc` cannot catch the dangerous conflicts** (`resolveVisibilityScope ↔ resolveTrpcActorScope` are type-identical, semantically different) → the merge needs a hand audit of every `*Procedure` wiring. Every day `main` moves, this gets harder → either merge #285 soon or freeze the `types.ts`/spec surface on `main`.
4. **Behavior-preserving default.** Routing-through-CRUD did NOT tighten security; projects stay unscoped (`agentProcedure`). Scope-tightening is the named **#285 tail**, never folded into T1/T2/T5 work.

---

## What's left — dependency-ordered roadmap

### ① Projects Phase 3 residuals ✅ SHIPPED (2026-08-20, `c33adb9c..01144ab1`)
Executed inline via `docs/superpowers/plans/2026-08-20-projects-phase-3-residuals.md`. All four files are now `db`-free:
- **accounting write (full R13)** ✅ — all six `db` sites (incl. the QB payment/invoice sync reads the plan first missed) route through `customerCrud`/`projectCrud` + new `getProposalsByIds`/`getProposalsByInvoiceIds`/`getProposalByInvoiceId`.
- **`media.router`** ✅ — `movePhase`/`toggleHero` → new `media-files/dal/server/mutations.ts` (`moveMediaPhase`/`setHeroImage`); importable reads → `listImportableProjectMedia`. Hero-exclusivity + phase-move proven by dev-DB smoke.
- **`google-drive.router`** ✅ — token refresh → new `googleDriveTokenService.getValidAccessToken` + `updateAccountTokens`. One accepted nuance: upload no-account error `PRECONDITION_FAILED → NOT_FOUND` (matches `getAccessToken`). **⚠️ Known debt:** the token service is a convention break (an orchestrator living in the `providers/` leaf dir) — deliberately parked; the proper fix is §⑥ below.
- **`business.create` reads** ✅ — proposal-gate + customer-address via `getProposalsByMeetingId` + `customerCrud.getById`.
- *(voip compliance / link-token D-c sites fold into the VOIP overhaul, not here; `ai/client` projectJSON write is paused-by-design.)*
- **Remaining projects work = the #285 scope-tightening tail only** (§② below): swap bare `agentProcedure` → `projectProcedure`, gate `delete` on CASL. NOT part of T5.

### ② #285 CASL integration *(T3 — the biggest remaining chunk; sequential)*
Reads are migrated onto CASL but **mutations still resolve scope via the legacy engine** (`resolveActorScope` compiles `read` only — 2026-08-20 finding). Remaining phases (all in-worktree, then merge):
- **Phase 6** — owned sub-entity cutovers (declare `parent` on the 6 children, create 4 missing specs) + homeowner-always-token invariant + thread `action` through the child path.
- **Grill B (~5.5)** — structural financial-read chokepoint (can't `SELECT finalTcpCents`/`projectJSON` without `resolveActorScope`); blocks dispatcher widening.
- **Phase 7 / Grill C** — action-aware scope (compile update/delete/create), move own-record auth into CASL conditions, retire imperative auth-in-hooks; + `agentProcedure→staffProcedure` rename.
- **Phase 8** — delete dead engine (`resolveEffectiveScope`/`bridgeToParent`/`isVisible`/`isInScope`/`SYSTEM_CONTEXT`); **this is where `visibility?` finally leaves `EntityServerSpec`**; collapse omni branches (3 sites).
- **Phase 9** — manual permissions E2E gate → **single integration merge to `main`** (with the hand audit from Decision 3).

### ③ JSONB Wave 4 — SOW normalization *(T4 — code may proceed; prod deferred per Decision 1)*
Decompose `projectJSON.data.sow[]` → `proposal_sow_items` (per-SOW price/incentives/costs first-class); kill the recompute jsonb residue in `recomputeProposalFinancials`; `calc_version → 2`. **Dev DDL only until Decision 1 lifts.**

### ④ Proposal Financials Consolidation *(T5 follow-up — gated on ③ and ①)*
Collapse the two `finalTcp` implementations — SQL `recomputeProposalFinancials` (persisted) + TS `computeProposalFinancials` (live editor) — onto one calculation. Eliminate `startingTcp`; `finalTcp = Σ(SOWᵢ price − SOWᵢ discounts) − Σ(global incentives)` floored at 0; `pricingDisplayMode` = the single display lever. Own brainstorm (business logic, not architecture).

### ⑤ Deferred prod-application backlog *(gated on Decision 1 — do NOT run yet)*
- **JSONB Wave 3 PROD cutover** — backfill → DDL → deploy per the Wave-3 cutover runbook (drops W1/W2 columns on prod, freezes `fundingJSON`/`formMetaJSON`). Prod currently runs pre-Wave-3 blob code; this is the standing exposure, held intentionally.
- Any accumulated `db:push:prod` for enum/schema pushes noted across memory (meeting-outcome enum, media bucket, etc.).

### ⑥ Google OAuth service consolidation *(cleanup — epic tail; unblocked, low-risk)*
**Debt introduced by ① (accepted deliberately):** `src/shared/services/providers/google-drive/token.service.ts` is a convention break — an internal-service orchestrator (reads the accounts DAL, throws `TRPCError`) physically living inside the `providers/` leaf directory (ADR-0003: providers are app-unaware leaves, no DAL, no TRPCError). It could NOT go on `client.ts` (a provider) for the same reason, and `token.service.ts` invented a pattern with zero precedent.
**The real problem it exposes:** Google OAuth account+token handling is duplicated and mis-homed. `scheduling.service.ts` ALSO does `getGoogleAccountForUser` → `googleDriveClient.refreshAccessToken` → `updateAccountGCalFields` inline (lines ~46–62) — a scheduling service concerning itself with auth/account retrieval.
**The fix:** extract a centralized **`src/shared/services/google-oauth.service.ts`** (internal service) that owns ALL Google OAuth account + token concerns for BOTH google-drive AND google-calendar — account lookup, refresh-if-expiring, persist, and a single `getValidAccessToken(userId)` (+ any account-resolution helpers). Then:
- delete `providers/google-drive/token.service.ts`; the gdrive router consumes the oauth service.
- `scheduling.service.ts` STOPS retrieving google accounts / touching auth — it only SCHEDULES, consuming the oauth service for a valid token.
- the accounts DAL (`getGoogleAccountForUser`/`updateAccountTokens`/`updateAccountGCalFields`) stays as the persistence layer the oauth service orchestrates.
Behavior-preserving; no DB schema change; verify with `tsc`+`lint` + the existing gcal sync path. Owner call (2026-08-20): park now, do this at the epic tail.

---

## Immediate next actions (session handoffs)

- **`abilities.ts`** — the `LEAD_SOURCE` addition (import + `ENTITY_NAMES`) from D-d is uncommitted, entangled with the in-flight `VOIP_CONTACT_ATTRIBUTE→FIELD` rename. Land with the VOIP commit, or extract the LEAD_SOURCE lines into their own commit.
- **Project edit-form scopes-desync bug** — pre-existing (NOT from this epic), documented at the root-cause site (`src/features/project-management/ui/components/form/index.tsx`), left unfixed per owner. Fix = hydrate-once ref guard (or `useForm({ values, resetOptions: { keepDirtyValues: true } })`).

## Sequencing recommendation

**① Projects Phase 3 residuals** is the natural next build (unblocked, closes T5). **② #285** should be scheduled deliberately soon — its merge cost grows with every `main` commit. **③/④** are data-layer work that can proceed in code but stay off prod until the refactor + #285 land (Decision 1).
