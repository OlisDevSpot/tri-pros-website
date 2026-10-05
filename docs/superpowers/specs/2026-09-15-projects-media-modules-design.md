# Projects and Media Modules Restructure — Design (Epic Spec A)

> **Epic:** `docs/plans/2026-09-14-upgrading-meeting-flow-epic.md` — the tracker is canonical for decisions (C-ids) and requirement items (M/MD/K/R/U/L/B/S/V ids). This spec designs **spec A** only; §9 lists what the other three specs own, so a later session can grill them without re-deriving the list.
> **Owns:** M1–M8 · MD1–MD11, MD13 · K2, K6, K7, K10 · C31.
> **Baseline:** `main` at `dd2ba19d`. Blocked by nothing; blocks specs B and D.
> **Constraint:** no DDL this round (C26), no scope/authorization tightening (that is #285's), no behavior change except the four named in §5.
> **Status:** design approved in chat 2026-09-15, amended the same day (owner: media row-lifecycle side effects belong in CRUD hooks, not service overrides — D5, D6, C32). Plan not written.

---

## 1. Why this exists

Three structures share one job today and none of them owns it cleanly:

- `src/shared/entities/projects/` — the projects entity, with a `delete.before` hook that reaches into `media_files` with inline `db` and deletes R2 objects itself.
- `src/shared/entities/media-files/` — named as though it were the generic media entity, but it is **project** media: `mutations.ts` writes `mediaFiles` by name (`moveMediaPhase`, `setHeroImage`), while `media-ops.ts`, `optimization.ts` and `image-variants.ts` sitting beside it are table-generic and serve proposal media too.
- `src/shared/services/media/` — the media service plus `stores.ts`, which imports **both** owners' tables and CRUD, and `optimization-target.ts`, which imports `db` directly (the last raw `db` import in the service layer).

The costs, all visible in code at `dd2ba19d`:

1. **A closed owner union.** `MediaOwnerKind = 'project' | 'proposal'` forces every new media owner to edit the media layer. Dependency runs media → owners, the wrong way round (C24).
2. **An orphan bug.** `r2/client.ts:63` hard-codes `VARIANT_SUFFIXES = ['sm','md','lg']`, but `VARIANT_REGISTRY.proposal` writes `xs` as well, so deleting proposal media leaves `-xs.webp` objects behind forever (MD8).
3. **Orchestration in routers.** `projects.router/media.router.ts` hard-codes the `projects/<id>/uncategorized/` path key, calls `r2Client.copyObject` directly, and holds `importFromProposal` — logic with no home in a service.
4. **No projects service.** Proposals got one (`modules/proposals/service.ts`, 2026-09-14); projects has no server API at all, so spec B has nothing to build its read model on.

## 2. Scope

**In:** the module relocation (M1–M8), the media module and project media unit (MD1–MD11, MD13), the four behavior fixes in §5, and the docs those changes invalidate (K2, K6, K7, K10).

**Out:** the read model, public projection and consumer consolidation (spec B); presentation config and critique fixes (spec C); the hook background (spec D); any DDL, including renaming the `media_files` table and dropping `x_project_media_files` (C26); turning on the project-media parent scope bridge (#285).

## 3. Target structure

```
src/shared/modules/projects/
├── service.ts                     { ...projectCrud, get media() } — verbs arrive in spec B
├── core/                          today's entities/projects
│   ├── DOCS.md · types.ts · server-spec.ts   (spec moves from lib/ to the unit root)
│   ├── constants/actions.ts · hooks/* · schemas/index.ts
│   ├── lib/{columns-registry.tsx,constants.ts,derive-scope-ids.ts,portfolio.ts,visibility.ts}
│   └── dal/server/{crud,mutations,queries}.ts
└── media/                         today's entities/media-files, project half
    ├── service.ts                 spread CRUD (unwrapped) + store-bound verbs + project-only verbs
    ├── store.ts                   projectMediaStore (table, ownerColumn, bucket, getter crud, buildPathKey, variants)
    ├── server-spec.ts             projectMediaServerSpec (parent: projectServerSpec)
    ├── lib/constants.ts           PROJECT_MEDIA_FILE + PROJECT_MEDIA (ownerKind, variants) — leaf, read by store AND hooks
    └── dal/server/{crud,mutations}.ts   crud carries the create.after / delete.before hooks (§4.4)

src/shared/modules/media/          generic capability, owns no table
├── service.ts                     THE media service (from services/media/media.service.ts)
├── DOCS.md                        rewritten (K10)
└── core/
    ├── types.ts                   MediaStore — open owner descriptor, no owner imports
    ├── dal/server/{media-ops,optimization}.ts    table-generic
    └── lib/{image-variants,process-image-variants,optimize-media,purge}.ts

src/shared/modules/proposals/media/store.ts   proposalMediaStore (from services/media/stores.ts)
```

Deleted, with no shims (non-defensive): `entities/projects/`, `entities/media-files/`, `services/media/{stores,optimization-target}.ts`, `services/media/` itself, `shared/hooks/use-media-upload.ts`, `shared/components/portfolio/*` (MD13).

## 4. Contracts

### 4.1 `MediaStore` — the open owner descriptor

```ts
// modules/media/core/types.ts
export interface MediaStore {
  /** free-form owner label; the job payload carries it, the media module never branches on it */
  ownerKind: string
  table: any                 // a base-media table; contained generic, as today
  ownerColumn: PgColumn      // table.projectId | table.proposalId
  bucket: R2BucketName
  /** the owner unit's scoped CRUD DAL — declared as a GETTER on each store (D6) */
  readonly crud: CrudHandlers<any, number>
  buildPathKey: (ownerId: string, fileId: string, ext: string, extra?: Record<string, string>) => string
  /** which variants THIS owner's optimizer writes — drives both write and delete */
  variants: readonly VariantSuffix[]
}
```

`VARIANT_REGISTRY.project` / `.proposal` move onto the owner stores as `variants`; the media module keeps only `VARIANT_OPTIONS`, `VARIANT_WIDTH` and the frozen `fallback` list (MD3).

### 4.2 Media service — cross-owner concerns only

`buildUploadTarget · list · reorder · retryOptimization · optimizeNow`, every one taking the owner's store first.

Three of today's verbs are gone. `rename` (MD5): renaming is a plain field update, so callers use the owner service's spread `update` slot. `createRecord` and `removeRecord` (D5): the optimize dispatch and the R2 purge are row-lifecycle side effects, so they become CRUD hooks on each media unit and the media service stops wrapping the owner's CRUD at all. What is left is what no single owner can own — the presigned upload target, the table-generic list/reorder, and the two optimization entry points (`retryOptimization` and `optimizeNow` are explicit operator actions, not row lifecycle, so they stay service verbs).

### 4.3 R2 purge helper

`r2Client.deleteMediaWithVariants(bucket, pathKey, suffixes)` gains the third argument; `VARIANT_SUFFIXES` in the provider is deleted. The provider stays a leaf that imports no app variant list (MD8).

One owner-agnostic helper sits in front of it and is THE single purge path (MD7):

```ts
// modules/media/core/lib/purge.ts — a leaf: imports r2Client and nothing else
export async function purgeMediaObject(
  row: { bucket: string | null, pathKey: string | null, optimizationVariants?: string[] | null },
  variants: readonly VariantSuffix[],
): Promise<void>
```

It skips rows with null coordinates (a Stream row, Plan 1b) and passes `variants ∪ row.optimizationVariants` (§5, D3). Its three callers are the two media units' `delete.before` hooks and the project `delete.before` hook (C31) — none of them a service, so a DAL never has to import one.

### 4.4 Media unit CRUD hooks (D5)

Both media units carry the same two factory hooks — entity-invariant, firing on every call and every origin, which is the contract `CrudHooks` already states:

```ts
// modules/projects/media/dal/server/crud.ts   (proposal twin is identical but for its own constants)
export const projectMediaCrud = createCrudDal(projectMediaServerSpec, () => ({
  hooks: {
    create: {
      after(row) {
        if (isOptimizable(row.mimeType))
          void optimizeMediaJob.dispatch({ ownerKind: PROJECT_MEDIA.ownerKind, mediaId: row.id })
      },
    },
    delete: {
      async before(row) { await purgeMediaObject(row, PROJECT_MEDIA.variants) }, // §4.3
    },
  },
}))
```

`PROJECT_MEDIA` is the unit's leaf constants module (`ownerKind`, `variants`) that the store also reads, so the hook never imports the store. This is the shape `meetingCrud` already uses — five job dispatches out of `create.after` / `update.after` (`entities/meetings/dal/server/crud.ts:21-142`), with the same pre-commit caveat recorded there and repeated in the media unit's DOCS.

### 4.5 Project media service

```
...projectMediaCrud     the five engine slots — create and delete included, unwrapped (D5)
buildUploadTarget · list · reorder · retryOptimization    bound to projectMediaStore
moveMediaPhase · setHeroImage · importFromProposal        project-only (MD6)
```

No `create` or `delete` override: the hooks above carry both side effects, so they also fire for a bare `projectMediaCrud.create`, for scripts, and for #285's own call sites. The service holds only what the DAL cannot see — the store binding and the project-only verbs.

Its proposal twin keeps exactly one override, `create`, and only for the parent-visibility probe, which is authorization and belongs in a service (§5, D4 — project media has no probe to run). Its `delete` override goes away with `removeRecord`.

`importFromProposal` keeps reading proposal media through the proposals side at call time, and keeps both round-2 rush rules unchanged (C30/MD12): no visibility check, and proposal delete still does not purge R2.

### 4.6 Root projects service

`{ ...projectCrud, get media() { return projectMediaService } } satisfies SpecCrudHandlers<typeof projectServerSpec>`. The getter is required, not stylistic: child services reach the root, so a top-level property value would read a binding still in its temporal dead zone (`modules/proposals/service.ts:1-36`). Spec B adds the read verbs.

### 4.7 Optimization job — the composition root (C27)

```ts
// providers/upstash/jobs/optimize-media.ts
const STORES: Record<string, MediaStore> = { project: projectMediaStore, proposal: proposalMediaStore }
```

Payload `{ ownerKind, mediaId }` is unchanged, so jobs already queued at deploy still run. The job resolves the store and hands it to the media module; the owner-kind union lives here and nowhere else.

## 5. Decisions taken in this spec

- **D1 · The project-delete purge stays in the DAL hook (C31).** `projectCrud.delete.before` keeps firing on every delete path, including a bare `projectCrud.delete` — which is what `crud.router.ts:67` calls today. It drops its inline `db` for the media module's table-generic `listMediaByOwner`, and purges through the §4.3 helper, passing the same union of suffixes as every other caller (D3). A DAL must not import a service, so this hook does **not** route through the media service; MD7 is amended to match.
- **D2 · The media service and the media units keep importing the optimization job.** The graph is media service → job → owner stores → owner DAL for `retryOptimization`, and owner DAL → job → owner stores → owner DAL for the create hook (D5) — the second one a real cycle, made safe by the getter in D6 rather than by a new job pattern. Splitting dispatch from handler registration would buy cleaner arrows at the cost of a pattern the repo does not have, and the repo already dispatches jobs straight out of DAL hooks (`entities/meetings/dal/server/crud.ts`). Recorded in the media module's DOCS.md so neither edge reads as an accident.
- **D3 · Deletes union the store's variants with the row's recorded ones.** `store.variants` alone fixes the `xs` orphan for new rows; the union also covers rows written when a variant list was longer. Cost is one extra delete call per legacy row, and a missing key is already caught and ignored.
- **D4 · No parent-visibility probe on project media.** Its proposal twin probes the parent, but the project media router still runs on a bare `agentProcedure` with `ctx.scope = null`, so a probe would be a live authorization tightening. That flip is #285's, and its spec/DAL are already shaped for it (`entities/media-files/lib/server-spec.ts:26-31`).
- **D5 · The media row-lifecycle side effects are CRUD hooks, not service overrides (C32).** Optimize-on-create and purge-on-delete are entity-invariant and must fire on every origin — the same argument that keeps the project delete purge in a hook (D1/C31). Today they sit in `mediaService.createRecord` / `removeRecord`, so only a caller that goes through the service gets them — every router call does, which is why nothing is broken today, but nothing enforces it and #285 adds call sites on the other side of the merge. The two scripts that insert media rows with raw `db.insert` (`add-during-media.ts:62`, `portfolio-scraper/import-project.ts:319`) show what that costs: their rows are never optimized. A hook does not reach them either while they bypass the DAL, so A4 moves them onto the unit's CRUD, and then it does. Moving the two side effects into `create.after` / `delete.before` also deletes the only reason project media needed a `create` override at all (it has no parent probe, D4). Read count is unchanged: the engine prefetches the row for a delete hook, which is the read `removeRecord` was doing by hand.
- **D6 · `MediaStore.crud` is declared as a getter.** D5 makes the media unit's CRUD import the optimize job, and §4.7 makes that job import the owner stores, which import the CRUD: a module-eval cycle where `store.crud` is read while `crud.ts` is still initializing, i.e. a TDZ `ReferenceError` on whichever module is entered first. A getter defers that read to call time and the cycle is safe — the same mechanism §4.6 already depends on for the root service. (`meetingCrud` does not hit this: `schedulingService` imports the meetings `google-calendar.ts` DAL, not `crud.ts`, so its hook→job→service edge has no back-edge.) The alternative — splitting job dispatch from handler registration — is still rejected for the reason in D2.

Behavior changes in this spec, in full: the `xs` orphan fix (D3/MD8), path keys built from the store instead of hard-coded strings (MD7), `mediaService.rename` removed in favor of the CRUD slot (MD5), `importFromProposal` moving from router to service (MD6), and one consequence of D5 — **deleting a media row that is already gone now returns `not-found` instead of succeeding silently**, because `removeRecord`'s idempotent no-op was a local invention and the engine's delete is not idempotent. Single delete surfacing a 404 on a double-click is the correct contract; `bulkDelete` (`projects.router/media.router.ts:71-77`) must therefore tolerate `not-found` per id explicitly instead of throwing mid-loop and leaving the rest of the selection undeleted. Everything else is structure.

## 6. Commit sequence

| # | Commit | Contents | Gate |
|---|---|---|---|
| **A1** | `refactor(projects): move projects + project media into modules/` | `entities/projects/**` → `modules/projects/core/**` (`lib/server-spec.ts` → unit root); project media CRUD/mutations/spec/constants → `modules/projects/media/**`; table-generic `media-ops.ts`, `optimization.ts`, `image-variants.ts`, `process-image-variants.ts` → `modules/media/core/**`; every importer in `src/` and `scripts/` repointed (M5) | path-normalized diff against parent is empty (M6); `pnpm tsc && pnpm lint` |
| **A2** | `refactor(projects): rename the project media entity in code` | MD9 symbol renames + `db/schema/media-files.ts` → `project-media-files.ts`; table name unchanged (C26); tRPC paths unchanged | tsc + lint; grep shows no `mediaFileCrud` / `MEDIA_FILE` survivors |
| **A3** | `refactor(media): generalize media into modules/media` | `services/media/*` → `modules/media/*`; stores split onto owner units with `variants` and a getter `crud` (D6); `stores.ts`, `optimization-target.ts` and `MediaOwnerKind` deleted; optimizer fetches through `store.crud.getById(SYSTEM_CONTEXT, …)`; job becomes composition root | tsc + lint; `optimizeNow` smoke on a dev row |
| **A4** | `fix(media): owner-aware variant cleanup and store-built path keys` | §4.3 signature + union + the `purgeMediaObject` helper; `media.router.ts:141` and the google-drive router build keys from the store; `add-during-media.ts` and `portfolio-scraper/import-project.ts` build keys from the store AND insert through `projectMediaCrud.create` instead of raw `db.insert`; `mediaService.rename` removed | tsc + lint; delete smoke leaves no `-xs.webp` |
| **A5** | `feat(projects): project media service, root projects service, lifecycle hooks` | §4.4 hooks on both media units; `mediaService.createRecord` / `removeRecord` deleted along with the project media overrides and the proposal `delete` override (the proposal `create` probe stays); `modules/projects/media/service.ts`, `modules/projects/service.ts`; project media + google-drive routers become adapters; `moveMediaPhase`, `setHeroImage`, `importFromProposal` move out of the router; `bulkDelete` tolerates `not-found`; the pre-commit caveat recorded in each unit's DOCS; MD13 dead code deleted | tsc + lint; §7 manual pass + items 6-8 |
| **A6** | `docs(modules): define modules/, refresh media and layering docs` | K2 (what a module and a unit are, root vs unit `service.ts`, the `db` allowlist, entities-vs-modules, plus the C17 amendment to `#the-deciding-question`), K6, K7, K10, M8 path references, M7 entry in the sync plan | lint on touched code refs |

Services and hooks land in one commit (A5) on purpose: splitting them would either write service overrides that the next commit deletes, or point the routers at the CRUD and then at the service — churn either way, since the hooks are what make the overrides unnecessary. A1 alone must be provably path-only — that is what lets the main ↔ #285 sync replay it mechanically (C20, M7).

## 7. Verification

No test runner in this repo (V1 is `pnpm tsc` + `pnpm lint`, never `pnpm build`). Per commit as tabled above, plus, before A6:

1. **Path-only proof for A1** — normalize paths in `git diff` against the parent and confirm it is empty, the recipe in memory `project-proposals-module-move-audit`.
2. **Hook smoke** (`scripts/tmp-*.ts`, uncommitted, dev DB): create a throwaway project with two media rows, delete it, confirm `delete.before` purged the objects and their variants.
3. **Media round trip on dev**: upload → optimize (`optimizeNow`, no QStash tunnel needed) → reorder → rename → delete for project media, then the same for proposal media, confirming `-xs.webp` is gone after a proposal delete.
4. **Import paths**: `importFromProposal` writes under the store-built key; the google-drive import lands in the requested phase folder.
6. **Hooks fire off the naked path** (after A6): a bare `projectMediaCrud.create(SYSTEM_CONTEXT, …)` in a scratch script dispatches optimize, and a bare `projectMediaCrud.delete` purges the object and its variants — neither call touching a service.
7. **Cycle proof** (D6): one scratch script importing `modules/projects/media/dal/server/crud` first and another importing `app/api/qstash-jobs/route` first, both evaluating with no `ReferenceError`. This is the check that the getter is actually doing its job; a plain property passes tsc and fails here.
8. **Delete semantics**: deleting the same media id twice returns `not-found` the second time, and `bulkDelete` over a selection containing one stale id still deletes the rest.
9. **Grep gates**: no `@/shared/entities/projects`, `@/shared/entities/media-files` or `@/shared/services/media` importers remain anywhere in `src/` or `scripts/`; no `db` import outside a `dal/` directory in the media or projects modules.

## 8. Coordination

- **#285** (`.worktrees/issue-285`): record in `docs/plans/2026-09-13-main-285-sync-plan.md` that A1 moved the four files it edits (`media-ops.ts`, projects `queries.ts`, `server-spec.ts`, `visibility.ts`), that #285's table-generic `movePhase`/`setHero` lose to main's project media unit while its scoping is ported into `modules/projects/media/dal` (MD11, conflict #10), and that `mediaFileServerSpec` is renamed (MD9).
- **Construction catalog design** (`docs/plans/2026-09-14-construction-catalog-centralization-design.md`) is another session's document: report path references, do not edit it.
- **`docs/codebase-conventions/service-architecture.md` has uncommitted edits from another session** (provider-boundary/translator rules, epic #248, plus pointers to `docs/plans/2026-09-15-construction-data-standardization-epic.md`). K2 amends `#the-deciding-question` in the same file, so the docs commit must re-read it at the time and write onto whatever is there — and the modules definition K2 adds has to describe the provider-only module that session is building, not just ours.
- **Specialties plan** `docs/superpowers/plans/2026-09-14-specialties-stage-and-rail.md:824` cites the epic tracker under its pre-rename name. Another session owns that file; tell its owner rather than editing it.

## 9. Follow-ups — not in this spec

Everything below is tracked in the epic; listed here so a session reading only this spec can grill it.

### 9.1 Spec B — projects read model and public API (blocked by A)

R1 entity owns every project read, feature DAL deleted · R2 one `listProjects` with an exported filter schema · R3 generic `scopeIds` filter · R4 exclusive-first ordering as SQL, not JS · R5 query-toolkit list mode without the count query · R6 `listMediaByProjectIds` with a per-project cap · R7 one cover-image rule (C21) and one `groupMediaByPhase` · R8 the projects service verbs · R9 duplicate and dead reads retired · R10 one public procedure leaf · R11 RSC callers onto the service, caching decided there · R12 one trade-matching rule · R13 project primitives out of `features/` · R14 ctx-first + `DalReturn` · R15 portfolio URLs through `ROOTS` (`portfolio-proof.tsx` 404s today) · **S1 🚨 public procedures leak `address`, `zip`, `customerId`, `ownerId`, `qbSubCustomerId`** · S2 public reads on `SYSTEM_CONTEXT` + explicit `visibility: 'public'` (C28) · K3–K5 docs. Open at spec time: projection columns, cache tags and TTL, the public leaf's name, the list-mode option name.

### 9.2 Spec C — the Who We Are corrections (independent of A; must land before D)

Critique snapshot scored 16/32; these are its corrections plus the config rework.

- **U1** one headline per beat, owned by the pinned column (C1) · **U2** one progress indicator, lining figures · **U3** closing beat per C3, CTA ≥40px clear of the capsule · **U4** comparison beats per C2, rows revealed pair by pair · **U5** six-role type scale with rem floors, no weight 500 · **U6** spacing tokens, media bottom-anchored · **U7** container queries, not viewport `lg:` · **U8** brand blue accent, one shared scrim variable · **U9** hook headline on three lines, no serif-italic accent word · **U10** nothing unfinished reaches the homeowner (placeholder text, letter avatar, empty team slot) · **U11** touch affordances, ≥44px close target · **U12** performance beat at true proportions — **its images are gitignored and broken in production** · **U13** sentence-case stat labels, no orphaned Yelp mark, no blurred rotated text · **U14** `PRESENTATION_EASE` becomes `--ease-brand` with a shared JS constant (C29).
- **L1–L9** section config: `{ id, frame, pinned?, background?, content }`, `frame` defaulting in one place, the index-matched pinned array deleted, `background` as a discriminated union, `SnapPresentation` freed of its hard-coded grid, the pinned column as a sticky overlay (C23), snap invariants kept, `SectionImage` sizing documented, the primitive staying feature-local for Program and Portfolio.
- **K8** a `features/meeting-flow/DOCS.md`; **V4** screenshots at five sizes plus present mode; **V7** re-run the critique against 16/32.

### 9.3 Spec D — hook background (blocked by B and C)

B1 trades from `useTradeSelection()` · B2 trade → scope ids through the catalog, never in projects code (C22) · B3 equal-parts two-trade mix in a pure lib (C18) · B4 phases from config (C10) · B5 static fallback until photos load · B11 padding with other public work (C25) · B6 one-time staggered reveal, reduced motion respected (C11) · B7 the grid generalized out of `portfolio-hero.tsx`, portfolio page recomposed on it · B8 `OptimizedImage`, no hardcoded R2 domain · B9 scrim for AA contrast · B10 photos carry the project accessor. Open at spec time: cell count, per-project photo cap, padding order, component name.

### 9.4 Adjacent, owned elsewhere

Media business rules ruled in a hurry and worth revisiting (C30: proposal delete leaves R2 objects; `importFromProposal` ignores visibility) · the five `--ease-brand` literal copies that should move onto U14's constant · inline `db` outside a DAL in customer pipelines, lead-source analytics and the QB job · #285's public-read stance (C28) and the unscoped `crud.getForEdit` · portfolio data gaps: two test projects public with no scopes, and most-picked trades holding 1–3 public projects · owner tasks: sample scope PDF to R2, team photo, headshot paths · round 1 follow-ups: the global `scroll-margin-top` rule, header crowding ≤1024px.
