# Projects Standardization — Phase 1 (Structure Migration) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate all `projects` persistence into `entities/projects/dal/server/`, de-inline the projects tRPC router, add the per-entity scoped procedure, and switch `list` to `ctx.scope` — **without changing a single client tRPC path**.

**Architecture:** Pure de-inline + relocate. The projects router keeps its exact leaf/procedure shape (`crud`/`business`/`showroomDisplay`/`media`/`googleDrive`); only the *bodies* change — inline `db` moves into DAL functions under `entities/projects/dal/server/`, and a new `procedures.ts` supplies the scoped `projectProcedure` that `list` consumes. **No `createCrudRouter` adoption** — see Decision 1.

**Tech Stack:** Next.js 15 · tRPC v11 · Drizzle/Neon · Zod · pnpm. Lint = `@antfu/eslint-config`. **No test runner** — every task gates on `pnpm tsc && pnpm lint` green + manual review.

> **⚠️ This is NOT the final form of the projects router/DAL.** Phase 1 deliberately does *not* adopt `createCrudRouter`/`createCrudDal` (Decision 1) — but that is a **provisional** state, not the target. The target (per the epic) is that projects looks like `proposals`/`meetings`: spec-driven `createCrudRouter`, mutations routed through `createCrudDal` so server-spec hooks fire. The only reason we can't do that today is that the current CRUD interface **lacks the flexibility** to carry projects' mutations (the `scopeIds` side-channel, proposal-gating, cross-entity orchestration) — which is *why* projects currently overrides basic CRUD with bespoke tRPC procedures. This epic (Phase 2 case study → Phase 3 apply) exists to **grow the CRUD router/DAL interface surface** so those overrides disappear. Phase 1 just relocates + de-inlines to a clean, reviewable baseline first. Parent epic: `docs/plans/2026-08-11-projects-standardization-epic.md`.

## Global Constraints

- **GC1. Preserve every client tRPC path.** `crud.list`, `crud.getForEdit`, `crud.getAll`, `crud.create/update/delete`, `business.create`, `showroomDisplay.getAll` stay at their exact paths. Zero client call-site edits. (Blast-radius: 17 client call-sites depend on these — enumerated below.)
- **GC2. Do NOT adopt `createCrudRouter`/`createCrudDal` in this phase.** The `scopeIds` side-channel on create/update means the factory doesn't fit yet; that's a Phase 2 finding, resolved in Phase 3.
- **GC3. Do NOT touch `media.router` or `googleDrive.router`.** They stay inline-`db` for now — tagged `// TODO(1f)`. They're the media.service brainstorm slice.
- **GC4. Do NOT touch #285-owned visibility seams.** Do not modify `projectVisibility`/`projectParticipationScope`, `resolveVisibilityScope`, or `EntityServerSpec.visibility`. `list` *consumes* `ctx.scope` (the stable interface) — it does not reimplement scoping.
- **GC5. Behavior-preserving.** `list` scoping stays participation-only (identical to today's hand-rolled `projectParticipationScope`, because `resolveVisibilityScope` resolves the same fragment pre-#285). Writes stay unscoped exactly as today. No auth tightening in this phase.
- **GC6. Residual inline `db` gets tagged, not left silent.** Anything not de-inlined this phase (`business.create`'s cross-entity reads, `media`/`googleDrive`) carries a `// BYPASS(crud): <reason> — Phase 3` or `// TODO(1f)` marker.
- **GC7. Never introduce NEW inline `db` in a router.** New extraction targets land as DAL functions.

---

## Blast radius

### Files MOVED (delete from `features/`, recreate under `entities/`)
All four in `src/features/project-management/dal/server/` → `src/shared/entities/projects/dal/server/`:
| Source | Symbols | New home |
|---|---|---|
| `manage-project.ts` | `createProject`, `updateProject`, `deleteProject`, `getAllProjects` | `mutations.ts` (CUD) + `queries.ts` (`getAllProjects`) |
| `get-portfolio-projects.ts` | `getPortfolioProjects` | `queries.ts` |
| `get-portfolio-project-detail.ts` | `getPortfolioProjectDetail` | `queries.ts` |
| `get-project-for-edit.ts` | `getProjectForEdit`, `ProjectForEdit` (type) | `queries.ts` |

### Importers to REPOINT (path change only — 5 files)
- `src/trpc/routers/projects.router/crud.router.ts:3-4` (`getProjectForEdit`; `createProject,deleteProject,getAllProjects,updateProject`)
- `src/trpc/routers/projects.router/showroom-display.router.ts:2-3` (`getPortfolioProjectDetail`, `getPortfolioProjects`)
- `src/app/(frontend)/(site)/portfolio/projects/[projectAccessor]/page.tsx:3-4` (`getPortfolioProjectDetail`, `getPortfolioProjects`)
- `src/app/sitemap.ts:4` (`getPortfolioProjects`)
- Doc/comment refs (non-code, fix opportunistically): `projects/DOCS.md:7`, `server-spec.ts:35`, `dal/server/crud.ts:10`

### Files NEW
- `src/shared/entities/projects/dal/server/queries.ts` — relocated reads + new `listProjects(ctx, input)` (canonical `ScopedContext`+`DalReturn`, consumes `ctx.scope`) + `getProjectScopeCountsByScopeIds(scopeNotionIds)` (for `get-trade-images` — encapsulates the two `x_projectScopes` grouped-count reads; **corrected 2026-08-12** from the plan's original mis-specified `getProjectIdsByScope(scopeId)` after reading the actual code).
- `src/shared/entities/projects/dal/server/mutations.ts` — relocated `createProject`/`updateProject`/`deleteProject` (+ `setProjectScopes`).
- `src/trpc/routers/projects.router/procedures.ts` — `projectProcedure` (agent + `resolveVisibilityScope`) + `projectPublicProcedure` (base).
- `src/shared/entities/projects/lib/derive-scope-ids.ts` — pure `extractScopeIdsFromProposals(proposals)` helper (operational scope derivation).

### Files EDITED (bodies de-inlined, paths unchanged)
- `crud.router.ts` — `list` → `projectProcedure` + `listProjects` DAL call; `getAll`/`getForEdit`/`create`/`update`/`delete` → repointed DAL calls; remove `db` import.
- `business.router.ts` — project insert + `x_projectScopes` insert → DAL (`createProject`/`setProjectScopes`); cross-entity reads (proposals/customer) **tagged `BYPASS(crud)`** (de-inlined in Phase 3).
- `src/features/landing/lib/get-trade-images.ts:22-37` — inline `x_projectScopes` reads → `getProjectIdsByScope` DAL.
- `src/shared/db/schema/schema-helpers.ts` — none (already `$onUpdate`); the manual stamp is dropped in `mutations.ts` (see Task 4).
- `docs/codebase-conventions/dal-conventions.md:46` — stale `scopeMiddleware` ref.

### x_project_scopes write/read inventory (must all route through DAL by phase end, except tagged)
- Writes: `manage-project.ts:17,42-43,47` (→ moved), `business.router.ts:96` (→ `setProjectScopes`), `db-reset.ts:36` (reset util — leave).
- Reads: moved-file internals (→ moved), `crud.router.ts:99-103` (→ folded into `listProjects`), `get-trade-images.ts:21-37` (the two grouped-count reads → `getProjectScopeCountsByScopeIds`). The third read in that file — the `mediaFiles ⋈ projects` hero-image join (`:48-56`) — is a **media** read, left inline and tagged `// TODO(1f)` (media.service slice); `db` stays imported there this phase.

### VERIFY-then-decide (possibly dead)
- `crud.getAll` — **0 client call-sites**. Verify zero server callers; if dead, drop `getAllProjects` + the slot (YAGNI/R7) in Task 6. If any caller, keep.
- `showroomDisplay.getDetail` — **0 client call-sites**. Same check.

### UNTOUCHED (confirm no incidental edits)
`media.router.ts`, `google-drive.router.ts`, all `features/project-management/{hooks,lib,ui,constants}/`, every client component (GC1).

---

## Key decisions

**Decision 1 — No `createCrudRouter` in Phase 1.** The factory emits a fixed 5-slot shape and takes `insertProjectSchema` (no `scopeIds`); projects' create/update carry a `scopeIds` side-channel that isn't a column, and `crud.list`/`crud.getForEdit` have no factory slot. Forcing the factory now would relocate `crud.list`→`business.list` and break 6+3 client paths. Phase 1 instead de-inlines in place; the factory adoption + `scopeIds` resolution is exactly the Phase 2/3 mutation-interface work.

**Decision 2 — Relocated reads keep their plain signatures.** `getPortfolioProjects`/`Detail`/`getProjectForEdit`/`getAllProjects` move as-is (no `ScopedContext`/`DalReturn` conversion) — they're public/edit reads with no scope, and converting them would touch RSC/sitemap/showroom call sites for no Phase-1 benefit. Only genuinely-new query fns (`listProjects`, `getProjectIdsByScope`) are written canonical. Full DAL-contract canonicalization rides with Phase 3.

**Decision 3 — `list` adopts `ctx.scope`, behavior-preserving.** Today `list` hand-rolls `isOmni ? undefined : projectParticipationScope(userId)`. `projectProcedure` resolves the identical fragment via `resolveVisibilityScope` (omni→null, else participation). Same SQL today; post-#285 it inherits the negative-outcome filter for free.

---

## Tasks

### Task 1: Add `procedures.ts` (scoped projectProcedure)

**Files:** Create `src/trpc/routers/projects.router/procedures.ts`
**Interfaces:** Produces `projectProcedure` (agent + `ctx.scope`), `projectPublicProcedure` (base). Consumed by `crud.router.ts` (Task 3).

- [ ] **Step 1:** Write `procedures.ts` mirroring `customers.router/procedures.ts:25-31`:
```ts
import { agentProcedure, baseProcedure } from '../../init'
import { resolveVisibilityScope } from '../../lib/middleware/scope-middleware'
import { projectServerSpec } from '@/shared/entities/projects/lib/server-spec'

/** Agent-scoped: injects ctx.scope = project participation fragment (null for omni). */
export const projectProcedure = agentProcedure.use(async ({ ctx, next }) =>
  next({ ctx: { ...ctx, scope: resolveVisibilityScope(projectServerSpec, { userId: ctx.session.user.id, ability: ctx.ability }) } }))

/** Public pass-through for showroom/portfolio reads. */
export const projectPublicProcedure = baseProcedure
```
- [ ] **Step 2:** `pnpm tsc && pnpm lint`. Expected: green (unused-export warning acceptable until Task 3 consumes it).
- [ ] **Step 3:** Commit.

### Task 2: Consolidate reads into `queries.ts`

**Files:** Create `src/shared/entities/projects/dal/server/queries.ts`; edit 4 importers.
**Interfaces:** Produces `getPortfolioProjects`, `getPortfolioProjectDetail`, `getProjectForEdit` (+`ProjectForEdit`), `getAllProjects` — signatures identical to today.

- [ ] **Step 1:** Move the 4 read bodies verbatim from the `features/` files into `queries.ts` (adjust relative imports). Keep plain signatures (Decision 2).
- [ ] **Step 2:** Repoint the 4 importers to `@/shared/entities/projects/dal/server/queries`: `crud.router.ts:3`, `showroom-display.router.ts:2-3`, `portfolio/.../page.tsx:3-4`, `sitemap.ts:4`.
- [ ] **Step 3:** `pnpm tsc && pnpm lint`. Expected: green. Manual: grep `features/project-management/dal` → only `crud.router.ts:4` (the mutations import, moved in Task 4) remains.
- [ ] **Step 4:** Commit.

### Task 3: Extract `list` into a canonical `listProjects` DAL fn

**Files:** Edit `queries.ts` (add `listProjects` + `getProjectScopeCountsByScopeIds`), `crud.router.ts`, `get-trade-images.ts`.
**Interfaces:** `listProjects(ctx: ScopedContext, input: <list input>): Promise<DalReturn<{ rows, total }>>` consuming `ctx.scope`. `getProjectScopeCountsByScopeIds(scopeNotionIds: string[]): Promise<{ matchingRows: { projectId: string, matchCount: number }[], totalRows: { projectId: string, totalCount: number }[] }>` (encapsulates the two `x_projectScopes` grouped-count reads; the `totalRows` read is filtered by the `projectId`s derived from `matchingRows`, done sequentially inside the fn).

- [ ] **Step 1:** Move the `crud.list` body (`crud.router.ts:37-125`) into `listProjects`, replacing `const isOmni…/scopeWhere` with `ctx.scope ?? undefined` in the `and(...)`; keep `paginatedQueryInput`/`buildFilterWhere`/`buildOrderBy`/`hasAssociatedMeeting`/`stagesForBuckets` usage identical. Wrap the `{ rows, total }` payload in a canonical ok-`DalReturn` (mirror `listProposals`).
- [ ] **Step 2:** Rewrite the `crud.list` procedure onto `projectProcedure`, calling `dalToTrpc(await listProjects(ctx, input))`. Keep the `.input(paginatedQueryInput({...}))` on the procedure (input schema + its `projectStatusBuckets`/`projectVisibilities`/`dateRangeSchema` imports stay in `crud.router.ts`). Path stays `crud.list` (GC1).
- [ ] **Step 3:** Add `getProjectScopeCountsByScopeIds` (the two `x_projectScopes` grouped-count reads, verbatim). Repoint `get-trade-images.ts`: replace its two `db.select(...).from(x_projectScopes)...` blocks with one call to the DAL fn, keep the single/multi-trade set-derivation in the feature lib. Tag the residual `mediaFiles ⋈ projects` read (`:48-56`) `// TODO(1f): media read via media.service/media-files DAL`; `db` stays imported there for it.
- [ ] **Step 4:** Remove imports from `crud.router.ts` that are now unused after `list` moved out (`db`, `projectParticipationScope`, `x_projectScopes`, `hasAssociatedMeeting`, `stagesForBuckets`, and the list-only `drizzle-orm` helpers). KEEP anything other procedures still use: `createProject`/`updateProject`/`deleteProject`, `getAllProjects`/`getProjectForEdit`, `projectStatusBuckets`/`projectVisibilities`, `paginatedQueryInput`/`dateRangeSchema`, `projectFormSchema`, `z`. Lint (`unused-imports`) is the arbiter — get it green.
- [ ] **Step 5:** `pnpm tsc && pnpm lint`. Manual: confirm `list` output shape (`{ rows: […, scopeIds], total }`) byte-identical to before, and `getTradeImages` behavior unchanged.
- [ ] **Step 6:** Commit.

### Task 4: Consolidate mutations into `mutations.ts` (+ drop manual `updatedAt`)

**Files:** Create `src/shared/entities/projects/dal/server/mutations.ts`; create `lib/derive-scope-ids.ts`; edit `crud.router.ts`.
**Interfaces:** `createProject`, `updateProject`, `deleteProject` (signatures identical to `manage-project.ts`), `setProjectScopes(projectId, scopeIds)`, `extractScopeIdsFromProposals(proposals)`.

- [ ] **Step 1:** Move `createProject`/`updateProject`/`deleteProject` from `manage-project.ts` into `mutations.ts`. In `updateProject`, **drop `updatedAt: new Date().toISOString()`** from `.set({...})` (schema `$onUpdate` handles it — `schema-helpers.ts:16-21`). Keep `deleteProject`'s R2 cleanup verbatim. Extract the `x_projectScopes` delete-then-insert into `setProjectScopes`.
- [ ] **Step 2:** Write `lib/derive-scope-ids.ts` — pure `extractScopeIdsFromProposals(proposals)` returning de-duped scope ids from `projectJSON.data.sow` (lift the loop from `business.router.ts:80-93`, no `db`).
- [ ] **Step 3:** Repoint `crud.router.ts:4` create/update/delete imports to `@/shared/entities/projects/dal/server/mutations`.
- [ ] **Step 4:** `pnpm tsc && pnpm lint`. Manual: verify `updateProject` no longer sets `updatedAt`.
- [ ] **Step 5:** Commit.

### Task 5: De-inline `business.create` writes (tag residual)

**Files:** Edit `business.router.ts`.

- [ ] **Step 1:** Replace the inline `db.insert(projects)` (`:46-62`) with `createProject(...)`, and the inline `db.insert(x_projectScopes)` (`:96-101`) with `setProjectScopes(project.id, extractScopeIdsFromProposals(meetingProposals))`. Keep the `meetingCrud.update` call as-is.
- [ ] **Step 2:** **Tag** the residual cross-entity reads (`db.select` proposals `:19-22`, customer `:32-35`) with `// BYPASS(crud): cross-entity reads for operational create — de-inline + route through createCrudDal in Phase 3`. Leave them inline this phase (GC6).
- [ ] **Step 3:** `pnpm tsc && pnpm lint`. Manual: confirm no `db.insert` remains in `business.router.ts`; the two tagged selects are the only `db` left.
- [ ] **Step 4:** Commit.

### Task 6: Retire `features/project-management/dal/` + dead-slot check

**Files:** Delete 4 files + empty `dal/` dir; possibly `crud.router.ts`.

- [ ] **Step 1:** `git rm` the 4 `features/project-management/dal/server/*.ts` files (now fully moved — verified: `git grep "project-management/dal" -- src ':!*.md'` shows only 2 stale *comment* refs, zero imports) and the empty `dal/` dir.
- [ ] **Step 2:** Fix the 2 stale comment refs to the deleted `manage-project.ts`: `src/shared/entities/projects/dal/server/crud.ts:10` and `src/shared/entities/projects/lib/server-spec.ts:35` — update them to point at the new `entities/projects/dal/server/{mutations,queries}.ts` reality (server-spec.ts:35 currently claims manage-project.ts "remains the" source — now false).
- [ ] **Step 3 (REVISED — dead-slot removal DEFERRED, not done here):** `crud.getAll` and `showroomDisplay.getDetail` are confirmed dead (0 callers each). **But GC1 lists `crud.getAll` among paths to preserve**, contradicting removal — so per Task 6's own "if uncertain, leave and flag," LEAVE both procedures in place (they import live DAL fns — `getAllProjects` alive via the slot; `getPortfolioProjectDetail` alive via the portfolio RSC page — so no dead imports result). **Do NOT remove any procedure or DAL fn.** Flag both as confirmed-dead candidates for a follow-up cleanup (or Phase 3). This keeps Phase 1 purely structural + GC1-clean.
- [ ] **Step 4:** `pnpm tsc && pnpm lint`. Commit.

### Task 7: DOCS fix + residual tags

**Files:** Edit `docs/codebase-conventions/dal-conventions.md`, `media.router.ts`, `google-drive.router.ts`.

- [ ] **Step 1:** Fix the stale `scopeMiddleware` reference in `docs/codebase-conventions/dal-conventions.md` (in the `### two-entry-points-into-dal` section — `git grep -n scopeMiddleware docs/codebase-conventions/dal-conventions.md` for the exact line) — replace it with `resolveVisibilityScope` + per-entity `procedures.ts` inline `.use()` (the pattern Task 1 shipped).
- [ ] **Step 2:** Fix the two now-stale refs in `src/shared/entities/projects/DOCS.md` (`:7`, `:167 #migration-status`) to reflect Phase 1's ACTUAL partial end-state — **without overclaiming**:
  - Projects DAL now lives in `src/shared/entities/projects/dal/server/` (`queries.ts` reads, `mutations.ts` writes) — moved out of the legacy `features/project-management/dal/` by this epic's Phase 1.
  - The tRPC router (`src/trpc/routers/projects.router/`) now uses per-entity scoped procedures (`procedures.ts` `projectProcedure`) and calls the DAL — but is **NOT** on `createCrudRouter`, and mutations do **NOT** yet route through `createCrudDal` (server-spec hooks do not fire yet). Residual inline `db`: `business.create`'s two cross-entity reads (tagged `BYPASS(crud)`) and the `media`/`google-drive` sub-routers (tagged `TODO(1f)`).
  - Full migration onto `createCrudRouter`/`createCrudDal` is projects-standardization **Phase 3** (`docs/plans/2026-08-11-projects-standardization-epic.md`). Do NOT state or imply projects is fully migrated or that hooks fire. Soften the "don't extrapolate proposals structure onto projects" note (projects now DOES have `dal/server/queries+mutations`, but not the factory wiring).
- [ ] **Step 3:** Add a top-of-file `// TODO(1f): inline db — de-inline via media.service + account DAL (media.service brainstorm slice)` to `media.router.ts` and `google-drive.router.ts` (GC3/GC6 — visibility marker only, no logic change).
- [ ] **Step 4:** `pnpm tsc && pnpm lint`. Commit.

---

## Self-review

- **Spec coverage:** F1 (T2,T4,T6) · F2-partial (procedures.ts T1; factory deferred per Decision 1) · F3 (T4 setProjectScopes + derive-scope-ids) · F5-partial (`updatedAt` T4; media/gdrive deferred GC3) · DOCS ping (T7). F4/F6/F7 are out of Phase 1 by design.
- **Path preservation (GC1):** no task edits a client component; `list`/`getForEdit`/`getAll`/`create`/`update`/`delete`/`business.create`/`showroomDisplay.*` all keep their leaf+name.
- **Type consistency:** `listProjects` returns `DalReturn<{rows,total}>` → `crud.list` unwraps via `dalToTrpc`; relocated reads keep plain signatures → callers unchanged.
- **Sequencing:** T1→T3 (procedures before list); T4 before T3-step-4 import cleanup (both edit `crud.router.ts` imports) — do T4 then finalize T3-step-4, OR fold T3-step-4 into T5. Reviewer: keep the `crud.router.ts` import edits coherent across T3/T4/T5.

## Execution handoff

Two options:
1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.
2. **Inline Execution** — batch with checkpoints.

Residual after Phase 1 (by design): `business.create` cross-entity reads (tagged, → Phase 3), `media`/`googleDrive` inline `db` (tagged, → 1f), no factory adoption (→ Phase 3).
