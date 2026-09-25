# Projects and Media Modules Restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the projects entity and its media into `src/shared/modules/projects/`, turn the media plumbing into an owner-agnostic `src/shared/modules/media/`, and give both media units their row-lifecycle side effects as CRUD hooks — so a new media owner is a new store, not an edit to the media layer.

**Architecture:** Owner → media, never the reverse. Each owner unit (`modules/projects/media`, `modules/proposals/media`) exports a `MediaStore` descriptor (table, owner column, bucket, path-key builder, variant list, scoped CRUD). The media module owns only cross-owner concerns (presigned upload targets, table-generic list/reorder, optimization). The optimize job is the single composition root that maps `ownerKind` → store. Optimize-on-create and purge-on-delete live in each unit's `createCrudDal` hooks, so they fire on every origin.

**Tech Stack:** Next.js 15 (App Router), TypeScript, tRPC v11, Drizzle ORM + Neon Postgres, Cloudflare R2 (S3 API), Upstash QStash, pnpm, `tsx` for scripts.

**Spec:** `docs/superpowers/specs/2026-09-15-projects-media-modules-design.md` — read it before Task 1. Decisions are cited below as D1–D6; requirement ids (M/MD/K) and owner decisions (C…) live in the epic tracker `docs/plans/2026-09-14-upgrading-meeting-flow-epic.md`.

---

## Global Constraints

Copied verbatim from the repo's rules and the spec. Every task inherits these.

- **NEVER run `pnpm build`.** Type-checking is `pnpm tsc` (= `tsc --noEmit`). Linting is `pnpm lint` (= `next lint`, scope `src/` only — it does not lint `scripts/`).
- **There is no unit-test runner in this repo.** "Tests" in this plan are: `pnpm tsc`, `pnpm lint`, targeted `grep` gates, and throwaway `scripts/tmp-*.ts` smoke scripts run against the **dev** database. Do not add vitest/jest.
- **Smoke scripts** start with `import './lib/load-env'` as the first import and are run as:
  `DRIZZLE_TARGET=dev QSTASH_TOKEN= NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-<name>.ts`
  (`--conditions=react-server` neutralises `server-only`; empty `QSTASH_TOKEN` makes job dispatch a swallowed no-op.) Model them on `scripts/tmp-smoke-proposals-module.ts`. They are throwaway and are **not** committed.
- **Never touch the production database.** Scripts target prod ONLY via `DRIZZLE_TARGET=prod`, never `NODE_ENV`. No task in this plan runs against prod.
- **No DDL in this plan (C26).** The table stays named `media_files`; `x_project_media_files` stays. `pgTable('media_files', …)` — the string literal — must not change.
- **No authorization changes (D4).** The project-media router stays on `agentProcedure` with `ctx.scope = null`. Do not add a parent-visibility probe to project media; that flip belongs to issue #285.
- **Git:** work on `main`. **Stage by path — never `git add -A`.** Never use bare `git stash`. Commit only the paths a task names.
- **Non-defensive migrations:** move every consumer and delete the old thing in the same commit. No re-export shims, aliases, deprecation stubs, or dual paths.
- **Ping on staleness:** if a file, symbol or line reference in this plan does not match what you find, STOP and report it as
  `⚠️ Stale ref — <doc>:<line> says X, but code at <path> does Y.` Do not silently work around it.
- **Path alias:** `@/` → `src/`.
- **Baseline:** `main` at `dd2ba19d`. The working tree already contains unrelated uncommitted work from other sessions — stage only your own paths.

---

## File Structure

**Final layout this plan produces:**

```
src/shared/modules/projects/
├── service.ts                          NEW  { ...projectCrud, get media() }
├── core/                               MOVED from src/shared/entities/projects/
│   ├── DOCS.md · types.ts · server-spec.ts        (server-spec.ts leaves lib/)
│   ├── constants/actions.ts · hooks/* · schemas/index.ts
│   ├── lib/{columns-registry.tsx,constants.ts,derive-scope-ids.ts,portfolio.ts,visibility.ts}
│   └── dal/server/{crud,mutations,queries}.ts     crud gains the purge rewrite (Task 4)
└── media/                              MOVED from src/shared/entities/media-files/ (project half)
    ├── service.ts                      NEW  project media service
    ├── store.ts                        NEW  projectMediaStore
    ├── server-spec.ts                  MOVED from media-files/lib/server-spec.ts
    ├── lib/constants.ts                MOVED + extended with PROJECT_MEDIA
    └── dal/server/{crud,mutations}.ts  crud gains create.after / delete.before hooks

src/shared/modules/media/               NEW capability module, owns no table
├── service.ts                          MOVED from services/media/media.service.ts
├── DOCS.md                             MOVED + rewritten
└── core/
    ├── types.ts                        NEW  MediaStore
    ├── dal/server/{media-ops,optimization}.ts     MOVED from media-files/dal/server/
    └── lib/{image-variants,process-image-variants,optimize-media,purge,optimizable}.ts

src/shared/modules/proposals/media/
├── store.ts                            NEW  proposalMediaStore
├── lib/constants.ts                    extended with PROPOSAL_MEDIA
├── dal/server/crud.ts                  gains the same two hooks
└── service.ts                          loses its `delete` override

src/shared/db/schema/project-media-files.ts   RENAMED from media-files.ts (table name unchanged)
src/shared/services/providers/upstash/jobs/optimize-media.ts   becomes the composition root
src/shared/services/providers/r2/client.ts    deleteMediaWithVariants takes a suffix list
```

**Deleted (no shims):** `src/shared/entities/projects/`, `src/shared/entities/media-files/`, `src/shared/services/media/` (all five files), `src/shared/hooks/use-media-upload.ts`, `src/shared/components/portfolio/` (4 files).

**Commit sequence:** one commit per task, in order. Task 1 must be provably path-only — that is what lets the main ↔ #285 sync replay it mechanically (C20, M7).

---

## Task 1: Move projects + project media into `modules/` (path-only)

Mechanical relocation. **Zero behavior change** — the diff must contain renames plus import-specifier lines and nothing else.

**Files:**
- Move: `src/shared/entities/projects/**` (15 files) → `src/shared/modules/projects/core/**`
- Move: `src/shared/entities/media-files/**` (8 files) → split across `src/shared/modules/projects/media/**` and `src/shared/modules/media/core/**`
- Modify: every importer — 52 files under `src/`, plus `scripts/migrate-optimize-images.ts`
- Test: none (no runner) — gates are `pnpm tsc`, `pnpm lint`, and the path-only diff proof

**Interfaces:**
- Consumes: nothing.
- Produces: the new import specifiers every later task uses —
  `@/shared/modules/projects/core/server-spec` (`projectServerSpec`),
  `@/shared/modules/projects/core/dal/server/crud` (`projectCrud`, `createProjectWithScopes`, `updateProjectWithScopes`),
  `@/shared/modules/projects/media/server-spec` (`mediaFileServerSpec` — renamed in Task 2),
  `@/shared/modules/projects/media/dal/server/crud` (`mediaFileCrud` — renamed in Task 2),
  `@/shared/modules/projects/media/dal/server/mutations` (`moveMediaPhase`, `setHeroImage`),
  `@/shared/modules/projects/media/lib/constants` (`MEDIA_FILE` — renamed in Task 2),
  `@/shared/modules/media/core/dal/server/media-ops` (`listMediaByOwner`, `reorderMedia`),
  `@/shared/modules/media/core/dal/server/optimization` (`setMediaOptimizationProcessing`, `setMediaOptimizationComplete`, `setMediaOptimizationFailed`, `resetMediaOptimizationStatus`),
  `@/shared/modules/media/core/lib/image-variants` (`VARIANT_OPTIONS`, `VARIANT_REGISTRY`, `VARIANT_WIDTH`, `VariantSuffix`, `VariantOption`),
  `@/shared/modules/media/core/lib/process-image-variants` (`processImageVariants`, `ImageVariant`).

- [ ] **Step 1: Confirm the baseline is clean for these paths**

```bash
cd /home/olis-solutions/olis-v3/nextjs/tri-pros-website
git status --porcelain src/shared/entities/projects src/shared/entities/media-files src/shared/services/media
```

Expected: **no output**. If any of these paths has uncommitted changes from another session, STOP and report it — the path-only proof in Step 6 cannot work over someone else's edits.

- [ ] **Step 2: Move the projects tree**

```bash
mkdir -p src/shared/modules/projects/core/{constants,dal/server,hooks,lib,schemas}
git mv src/shared/entities/projects/DOCS.md                      src/shared/modules/projects/core/DOCS.md
git mv src/shared/entities/projects/types.ts                     src/shared/modules/projects/core/types.ts
git mv src/shared/entities/projects/lib/server-spec.ts           src/shared/modules/projects/core/server-spec.ts
git mv src/shared/entities/projects/constants/actions.ts         src/shared/modules/projects/core/constants/actions.ts
git mv src/shared/entities/projects/dal/server/crud.ts           src/shared/modules/projects/core/dal/server/crud.ts
git mv src/shared/entities/projects/dal/server/mutations.ts      src/shared/modules/projects/core/dal/server/mutations.ts
git mv src/shared/entities/projects/dal/server/queries.ts        src/shared/modules/projects/core/dal/server/queries.ts
git mv src/shared/entities/projects/hooks/use-project-action-configs.ts src/shared/modules/projects/core/hooks/use-project-action-configs.ts
git mv src/shared/entities/projects/hooks/use-project-actions.ts src/shared/modules/projects/core/hooks/use-project-actions.ts
git mv src/shared/entities/projects/lib/columns-registry.tsx     src/shared/modules/projects/core/lib/columns-registry.tsx
git mv src/shared/entities/projects/lib/constants.ts             src/shared/modules/projects/core/lib/constants.ts
git mv src/shared/entities/projects/lib/derive-scope-ids.ts      src/shared/modules/projects/core/lib/derive-scope-ids.ts
git mv src/shared/entities/projects/lib/portfolio.ts             src/shared/modules/projects/core/lib/portfolio.ts
git mv src/shared/entities/projects/lib/visibility.ts            src/shared/modules/projects/core/lib/visibility.ts
git mv src/shared/entities/projects/schemas/index.ts             src/shared/modules/projects/core/schemas/index.ts
rmdir -p src/shared/entities/projects/{constants,dal/server,hooks,lib,schemas} 2>/dev/null; true
```

`server-spec.ts` deliberately lands at the unit root, not in `lib/` — that is the proposals-module shape (M1).

- [ ] **Step 3: Move the media-files tree, splitting project-specific from table-generic**

```bash
mkdir -p src/shared/modules/projects/media/{dal/server,lib}
mkdir -p src/shared/modules/media/core/{dal/server,lib}
# project-specific half
git mv src/shared/entities/media-files/lib/server-spec.ts            src/shared/modules/projects/media/server-spec.ts
git mv src/shared/entities/media-files/lib/constants.ts              src/shared/modules/projects/media/lib/constants.ts
git mv src/shared/entities/media-files/dal/server/crud.ts            src/shared/modules/projects/media/dal/server/crud.ts
git mv src/shared/entities/media-files/dal/server/mutations.ts       src/shared/modules/projects/media/dal/server/mutations.ts
# table-generic half
git mv src/shared/entities/media-files/dal/server/media-ops.ts       src/shared/modules/media/core/dal/server/media-ops.ts
git mv src/shared/entities/media-files/dal/server/optimization.ts    src/shared/modules/media/core/dal/server/optimization.ts
git mv src/shared/entities/media-files/lib/image-variants.ts         src/shared/modules/media/core/lib/image-variants.ts
git mv src/shared/entities/media-files/lib/process-image-variants.ts src/shared/modules/media/core/lib/process-image-variants.ts
rmdir -p src/shared/entities/media-files/{dal/server,lib} 2>/dev/null; true
```

`process-image-variants.ts` imports `'./image-variants'` relatively and both land in the same directory — that import needs no edit.

- [ ] **Step 4: Rewrite every import specifier**

Order matters: the two `server-spec` rules must run before the directory-prefix rule that would otherwise swallow them.

```bash
FILES=$(grep -rl "shared/entities/projects\|shared/entities/media-files" src/ scripts/ --include=*.ts --include=*.tsx)
for f in $FILES; do
  sed -i \
    -e 's#shared/entities/projects/lib/server-spec#shared/modules/projects/core/server-spec#g' \
    -e 's#shared/entities/projects/#shared/modules/projects/core/#g' \
    -e 's#shared/entities/media-files/lib/server-spec#shared/modules/projects/media/server-spec#g' \
    -e 's#shared/entities/media-files/lib/constants#shared/modules/projects/media/lib/constants#g' \
    -e 's#shared/entities/media-files/dal/server/crud#shared/modules/projects/media/dal/server/crud#g' \
    -e 's#shared/entities/media-files/dal/server/mutations#shared/modules/projects/media/dal/server/mutations#g' \
    -e 's#shared/entities/media-files/dal/server/media-ops#shared/modules/media/core/dal/server/media-ops#g' \
    -e 's#shared/entities/media-files/dal/server/optimization#shared/modules/media/core/dal/server/optimization#g' \
    -e 's#shared/entities/media-files/lib/process-image-variants#shared/modules/media/core/lib/process-image-variants#g' \
    -e 's#shared/entities/media-files/lib/image-variants#shared/modules/media/core/lib/image-variants#g' \
    "$f"
done
```

The patterns omit the leading `@/` on purpose: `scripts/migrate-optimize-images.ts` reaches the same file through a relative `../src/shared/entities/...` path, and this catches both spellings.

- [ ] **Step 5: Verify nothing points at the old paths and it compiles**

```bash
grep -rn "shared/entities/projects\|shared/entities/media-files" src/ scripts/ --include=*.ts --include=*.tsx
```
Expected: **no output**.

```bash
pnpm tsc && pnpm lint
```
Expected: both exit 0. If `tsc` reports a module-not-found, a specifier was missed — fix it and re-run; do not proceed with errors.

- [ ] **Step 6: Prove the change is path-only**

```bash
git add src/shared/entities src/shared/modules src/features src/app src/trpc src/shared scripts
git diff --cached -M --stat | tail -5
```
Expected: the file list is renames (`R###`) plus modified importers; **no additions or deletions of whole files**.

```bash
# In every MODIFIED (non-renamed) file, the only changed lines must be import-specifier lines.
git diff --cached -M --diff-filter=M -U0 \
  | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' \
  | grep -vE 'shared/(entities|modules)/(projects|media|media-files)'
```
Expected: **no output**. Any line printed here is a content change riding along in a move commit — remove it and land it in a later task instead.

- [ ] **Step 7: Commit**

```bash
git commit -m "refactor(projects): move projects + project media into modules/

Path-only relocation (M1, M2, M5, M6). entities/projects -> modules/projects/core
(server-spec.ts to the unit root), the project half of entities/media-files ->
modules/projects/media, the table-generic half -> modules/media/core. No behavior
change; every importer repointed in the same commit, no shims.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Rename the project media entity in code

The table is named `media_files` but holds **project** media. Rename every code symbol so the next reader is not misled. The SQL table name does not change (C26) — no migration, no `db:push`.

**Files:**
- Rename: `src/shared/db/schema/media-files.ts` → `src/shared/db/schema/project-media-files.ts`
- Modify: `src/shared/db/schema/index.ts:19`, plus every file referencing the renamed symbols (server-side dirs listed in Step 2)
- Test: gates are `pnpm tsc`, `pnpm lint`, and the survivor greps in Step 5

**Interfaces:**
- Consumes: Task 1's new paths.
- Produces: `projectMediaFiles` (Drizzle table), `ProjectMediaFile` (row type), `insertProjectMediaFilesSchema`, `InsertProjectMediaFilesSchema`, `selectProjectMediaFilesSchema`, `projectMediaFilesRelations`, `projectMediaCrud`, `projectMediaServerSpec`, `projectMediaSchemas`, `PROJECT_MEDIA_FILE = 'ProjectMediaFile'`.

- [ ] **Step 1: Rename the schema file and its export**

```bash
git mv src/shared/db/schema/media-files.ts src/shared/db/schema/project-media-files.ts
sed -i "s#export \* from './media-files'#export * from './project-media-files'#" src/shared/db/schema/index.ts
grep -rn "schema/media-files" src/ scripts/ --include=*.ts --include=*.tsx
```
The last grep lists the files still importing the old module path — Step 3's sed fixes them.

- [ ] **Step 2: Rename the Drizzle table symbol (server-side files only)**

`mediaFiles` is also the name of several React **props** (`mediaFiles?: MediaFile[]`). Those are not the table and must keep their name, so scope this sed to the directories that import the table.

```bash
TABLE_DIRS="src/shared/db src/shared/modules src/shared/services src/features/landing/dal src/features/landing/lib src/features/meeting-flow/constants scripts"
grep -rl "\bmediaFiles\b" $TABLE_DIRS --include=*.ts --include=*.tsx \
  | xargs sed -i -e 's#\bmediaFilesRelations\b#projectMediaFilesRelations#g' -e 's#\bmediaFiles\b#projectMediaFiles#g'
```
`mediaFilesRelations` is replaced first — otherwise the shorter pattern would rewrite its prefix and leave `projectMediaFilesRelations` half-renamed.

- [ ] **Step 3: Rename the remaining symbols repo-wide**

These are unambiguous, so they run over all of `src/` and `scripts/`.

```bash
grep -rl "MediaFile\|mediaFileCrud\|mediaFileServerSpec\|mediaFileSchemas\|MEDIA_FILE\|schema/media-files" src/ scripts/ --include=*.ts --include=*.tsx \
  | xargs sed -i \
    -e 's#schema/media-files#schema/project-media-files#g' \
    -e 's#\binsertMediaFilesSchema\b#insertProjectMediaFilesSchema#g' \
    -e 's#\bInsertMediaFilesSchema\b#InsertProjectMediaFilesSchema#g' \
    -e 's#\bselectMediaFilesSchema\b#selectProjectMediaFilesSchema#g' \
    -e 's#\bmediaFileSchemas\b#projectMediaSchemas#g' \
    -e 's#\bmediaFileCrud\b#projectMediaCrud#g' \
    -e 's#\bmediaFileServerSpec\b#projectMediaServerSpec#g' \
    -e 's#\bMEDIA_FILE\b#PROJECT_MEDIA_FILE#g' \
    -e "s#'MediaFile'#'ProjectMediaFile'#g" \
    -e 's#\bMediaFile\b#ProjectMediaFile#g'
```

Word boundaries make these safe against the proposal twins: `\bMediaFile\b` does not match inside `ProposalMediaFile`, and `\bMEDIA_FILE\b` does not match inside `PROPOSAL_MEDIA_FILE` (`_` is a word character).

- [ ] **Step 4: Fix the two comment-level leftovers by hand**

```bash
sed -n '1,6p' src/shared/modules/projects/media/lib/constants.ts
```
Make the comment read: `// Canonical entity-name constant for the ProjectMediaFile entity.` and keep the `@migration:` line. Then check the spec's doc comment still describes reality:

```bash
grep -n "media_files\|project media" src/shared/modules/projects/media/server-spec.ts | head
```
The `pgTable('media_files', …)` literal in `src/shared/db/schema/project-media-files.ts` and any prose naming the **SQL table** stay as `media_files` — only code symbols were renamed.

- [ ] **Step 5: Verify**

```bash
pnpm tsc && pnpm lint
grep -rn "\bmediaFileCrud\b\|\bmediaFileServerSpec\b\|\bMEDIA_FILE\b\|\bmediaFilesRelations\b" src/ scripts/ --include=*.ts --include=*.tsx
grep -rn "pgTable('media_files'" src/shared/db/schema/project-media-files.ts
```
Expected: `tsc`/`lint` exit 0; the survivor grep prints **nothing**; the last grep prints the one `pgTable('media_files', {` line (proof the table name is untouched).

- [ ] **Step 6: Commit**

```bash
git add src/shared/db src/shared/modules src/shared/services src/shared/domains src/features src/trpc scripts
git commit -m "refactor(projects): rename the project media entity in code

MD9: mediaFiles -> projectMediaFiles, MediaFile -> ProjectMediaFile, schemas,
crud, server spec and entity-name constant renamed; schema file media-files.ts ->
project-media-files.ts. SQL table name media_files is unchanged (C26) and no CASL
grant references the entity name. tRPC paths unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Generalize media into `modules/media`

Today `services/media/stores.ts` imports **both** owners' tables and CRUD, and `optimization-target.ts` imports `db` directly. Both die here. The owner union `MediaOwnerKind` is replaced by a free-form `ownerKind: string` resolved in exactly one place: the optimize job (D2, C27).

**Files:**
- Move: `src/shared/services/media/media.service.ts` → `src/shared/modules/media/service.ts`
- Move: `src/shared/services/media/optimize-media.ts` → `src/shared/modules/media/core/lib/optimize-media.ts`
- Move: `src/shared/services/media/DOCS.md` → `src/shared/modules/media/DOCS.md` (rewritten in Task 6)
- Create: `src/shared/modules/media/core/types.ts`, `src/shared/modules/projects/media/store.ts`, `src/shared/modules/proposals/media/store.ts`
- Modify: `src/shared/modules/projects/media/lib/constants.ts`, `src/shared/modules/proposals/media/lib/constants.ts`, `src/shared/modules/media/core/lib/image-variants.ts`, `src/shared/lib/get-optimized-urls.ts`, `src/shared/services/providers/upstash/jobs/optimize-media.ts`, `src/trpc/routers/projects.router/{media,google-drive}.router.ts`, `src/shared/modules/proposals/media/service.ts`
- Delete: `src/shared/services/media/stores.ts`, `src/shared/services/media/optimization-target.ts`
- Test: gates are `pnpm tsc`, `pnpm lint`, plus an `optimizeNow` smoke on a dev row

**Interfaces:**
- Consumes: Task 2's renamed symbols.
- Produces:
  - `MediaStore` from `@/shared/modules/media/core/types`
  - `projectMediaStore` from `@/shared/modules/projects/media/store`, `proposalMediaStore` from `@/shared/modules/proposals/media/store`
  - `PROJECT_MEDIA` / `PROPOSAL_MEDIA` (`{ ownerKind, variants }`) from each unit's `lib/constants`
  - `optimizeMediaFile({ store, mediaId }: { store: MediaStore, mediaId: number }): Promise<void>`
  - `mediaService` from `@/shared/modules/media/service` (same verbs as before this task)
  - `FALLBACK_VARIANTS` from `@/shared/modules/media/core/lib/image-variants` (replaces `VARIANT_REGISTRY`)

- [ ] **Step 1: Move the three media-service files**

```bash
mkdir -p src/shared/modules/media/core/lib
git mv src/shared/services/media/media.service.ts   src/shared/modules/media/service.ts
git mv src/shared/services/media/optimize-media.ts  src/shared/modules/media/core/lib/optimize-media.ts
git mv src/shared/services/media/DOCS.md            src/shared/modules/media/DOCS.md
```

- [ ] **Step 2: Write the open owner descriptor**

Create `src/shared/modules/media/core/types.ts`:

```ts
// The media module's ONE contract with an owner. `modules/media` imports no owner
// table, CRUD or owner-kind union — an owner hands its store in (MD2, C24).
import type { PgColumn } from 'drizzle-orm/pg-core'
import type { VariantSuffix } from '@/shared/modules/media/core/lib/image-variants'
import type { CrudHandlers } from '@/shared/dal/server/types'
import type { R2BucketName } from '@/shared/services/providers/r2/types'

export interface MediaStore {
  /** Free-form owner label. Carried in the optimize job payload; the media module never branches on it. */
  ownerKind: string
  /** A base-media table. Contained generic, as before (the `any` rule is off repo-wide). */
  table: any
  /** table.projectId | table.proposalId */
  ownerColumn: PgColumn
  bucket: R2BucketName
  /**
   * The owner unit's scoped CRUD DAL. Declared as a GETTER on every store (D6):
   * the unit's CRUD imports the optimize job, the job imports the stores, and the
   * stores import the CRUD. A plain property would be read during module
   * initialisation and throw a TDZ ReferenceError on one of the two entry orders.
   */
  readonly crud: CrudHandlers<any, number>
  /** Builds the R2 object key for a new upload. */
  buildPathKey: (ownerId: string, fileId: string, ext: string, extra?: Record<string, string>) => string
  /** Which variants THIS owner's optimizer writes — drives both the write and the delete (MD3, MD8). */
  variants: readonly VariantSuffix[]
}
```

- [ ] **Step 3: Give each unit its leaf constants, then its store**

Append to `src/shared/modules/projects/media/lib/constants.ts`:

```ts
/**
 * Leaf identity for the project media unit. Read by the store AND by the CRUD
 * hooks (Task 5) — the hooks must NOT import the store, or the cycle in D6 gets
 * a second, unnecessary edge.
 */
export const PROJECT_MEDIA = {
  ownerKind: 'project',
  variants: ['sm', 'md', 'lg'],
} as const
```

Append to `src/shared/modules/proposals/media/lib/constants.ts`:

```ts
/** Leaf identity for the proposal media unit. See the project twin for why this is separate from the store. */
export const PROPOSAL_MEDIA = {
  ownerKind: 'proposal',
  variants: ['xs', 'sm', 'md', 'lg'],
} as const
```

These two lists are today's `VARIANT_REGISTRY.project` / `.proposal`, moved onto their owners (MD3).

Create `src/shared/modules/projects/media/store.ts`:

```ts
import type { MediaStore } from '@/shared/modules/media/core/types'
import { projectMediaFiles } from '@/shared/db/schema/project-media-files'
import { projectMediaCrud } from '@/shared/modules/projects/media/dal/server/crud'
import { PROJECT_MEDIA } from '@/shared/modules/projects/media/lib/constants'
import { R2_BUCKETS } from '@/shared/services/providers/r2/types'

export const projectMediaStore: MediaStore = {
  ownerKind: PROJECT_MEDIA.ownerKind,
  table: projectMediaFiles,
  ownerColumn: projectMediaFiles.projectId,
  bucket: R2_BUCKETS.media,
  // Getter, not a property — see MediaStore.crud (D6).
  get crud() {
    return projectMediaCrud
  },
  buildPathKey: (ownerId, fileId, ext, extra) => `projects/${ownerId}/${extra?.phase ?? 'uncategorized'}/${fileId}${ext}`,
  variants: PROJECT_MEDIA.variants,
}
```

Create `src/shared/modules/proposals/media/store.ts`:

```ts
import type { MediaStore } from '@/shared/modules/media/core/types'
import { proposalMediaFiles } from '@/shared/db/schema/proposal-media-files'
import { proposalMediaCrud } from '@/shared/modules/proposals/media/dal/server/crud'
import { PROPOSAL_MEDIA } from '@/shared/modules/proposals/media/lib/constants'
import { R2_BUCKETS } from '@/shared/services/providers/r2/types'

export const proposalMediaStore: MediaStore = {
  ownerKind: PROPOSAL_MEDIA.ownerKind,
  table: proposalMediaFiles,
  ownerColumn: proposalMediaFiles.proposalId,
  bucket: R2_BUCKETS.media,
  get crud() {
    return proposalMediaCrud
  },
  buildPathKey: (ownerId, fileId, ext) => `proposals/${ownerId}/${fileId}${ext}`,
  variants: PROPOSAL_MEDIA.variants,
}
```

Both path-key builders are copied verbatim from today's `services/media/stores.ts` — changing a key shape would orphan every existing object.

- [ ] **Step 4: Trim the variant registry to the fallback list**

In `src/shared/modules/media/core/lib/image-variants.ts`, replace the whole `VARIANT_REGISTRY` export (the `project` / `proposal` / `fallback` map) with:

```ts
/**
 * Variants assumed for a row whose `optimizationVariants` was never recorded
 * (predates variant tracking). FROZEN — must stay a subset of what those old
 * objects physically have on R2; NEVER add a newer suffix (e.g. `xs`) here or
 * legacy images would request a `-xs.webp` that doesn't exist (404).
 *
 * Per-owner write-time lists live on each owner's store (`MediaStore.variants`).
 */
export const FALLBACK_VARIANTS = ['sm', 'md', 'lg'] as const satisfies readonly VariantSuffix[]
```

Then update its one consumer, `src/shared/lib/get-optimized-urls.ts`:
- line 1: import `FALLBACK_VARIANTS` instead of `VARIANT_REGISTRY` (keep `VARIANT_WIDTH`)
- line 33: `return [...VARIANT_REGISTRY.fallback]` → `return [...FALLBACK_VARIANTS]`

- [ ] **Step 5: Make the optimizer take a store instead of an owner kind**

In `src/shared/modules/media/core/lib/optimize-media.ts`: delete the `getOptimizationTarget` import and the `MediaOwnerKind` type import, and change the signature and the first three statements.

```ts
import type { MediaStore } from '@/shared/modules/media/core/types'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
// … existing imports: setMediaOptimization{Processing,Complete,Failed}, optimizeFile, r2Client

export async function optimizeMediaFile(
  { store, mediaId }: { store: MediaStore, mediaId: number },
): Promise<void> {
  const table = store.table
  // The row is read through the owner's own scoped CRUD — SYSTEM_CONTEXT because a
  // background job has no session and must see every row. This is what removes the
  // last raw `db` import from the media layer (MD2).
  const found = await store.crud.getById(SYSTEM_CONTEXT, { id: mediaId })
  if (!found.success) {
    console.error(`[optimizeMediaFile] ${store.ownerKind} media ${mediaId} read failed`, found.error)
    return
  }
  const file = found.data as any

  if (!file) {
    console.error(`[optimizeMediaFile] ${store.ownerKind} media ${mediaId} not found`)
    return
  }
  // … the rest of the body is unchanged, except:
  //   optimizeFile(originalBuffer, file.mimeType, VARIANT_REGISTRY[ownerKind])
  //     becomes
  //   optimizeFile(originalBuffer, file.mimeType, store.variants)
  //   and the catch-block log uses `store.ownerKind`.
}
```

Keep every other line — the `optimizationStatus === 'optimized'` short-circuit, the `provider === 'stream'` skip, the variant upload loop and the status writes — exactly as they are.

- [ ] **Step 6: Make the job the composition root**

Replace `src/shared/services/providers/upstash/jobs/optimize-media.ts` with:

```ts
import type { MediaStore } from '@/shared/modules/media/core/types'
import { optimizeMediaFile } from '@/shared/modules/media/core/lib/optimize-media'
import { projectMediaStore } from '@/shared/modules/projects/media/store'
import { proposalMediaStore } from '@/shared/modules/proposals/media/store'
import { createJob } from '../lib/create-job'

interface OptimizeMediaPayload {
  ownerKind: string
  mediaId: number
}

/**
 * THE composition root for media owners (C27, MD4). `ownerKind` is resolved to a
 * store here and nowhere else: `modules/media` never sees an owner union, so a new
 * media owner is one line in this map plus its own store.
 *
 * Payload shape is unchanged, so jobs already queued at deploy time still run.
 */
const STORES: Record<string, MediaStore> = {
  project: projectMediaStore,
  proposal: proposalMediaStore,
}

export const optimizeMediaJob = createJob<OptimizeMediaPayload>(
  'optimize-media',
  async ({ ownerKind, mediaId }) => {
    const store = STORES[ownerKind]
    if (!store) {
      console.error(`[optimize-media] unknown ownerKind '${ownerKind}' for media ${mediaId}`)
      return
    }
    await optimizeMediaFile({ store, mediaId })
  },
)
```

- [ ] **Step 7: Repoint the media service and its callers, then delete the dead files**

In `src/shared/modules/media/service.ts`: import `MediaStore` from `@/shared/modules/media/core/types` (was `./stores`), `listMediaByOwner`/`reorderMedia` from `@/shared/modules/media/core/dal/server/media-ops`, `resetMediaOptimizationStatus` from `@/shared/modules/media/core/dal/server/optimization`, `optimizeMediaFile` from `./core/lib/optimize-media`, and change `optimizeNow` to `return optimizeMediaFile({ store, mediaId })`.

```bash
# every remaining importer of the old service paths
grep -rn "shared/services/media" src/ scripts/ --include=*.ts --include=*.tsx
```
Repoint each one: `@/shared/services/media/media.service` → `@/shared/modules/media/service`; `@/shared/services/media/stores` → the owning unit's `store` module (`@/shared/modules/projects/media/store` or `@/shared/modules/proposals/media/store`).

```bash
git rm src/shared/services/media/stores.ts src/shared/services/media/optimization-target.ts
rmdir src/shared/services/media 2>/dev/null; true
grep -rn "MediaOwnerKind\|optimization-target\|shared/services/media" src/ scripts/ --include=*.ts --include=*.tsx
```
Expected from the last grep: **no output**.

- [ ] **Step 8: Verify, including a real optimization round trip**

```bash
pnpm tsc && pnpm lint
```

Then write `scripts/tmp-smoke-optimize.ts` (throwaway, not committed):

```ts
// Throwaway: proves the store-driven optimizer still optimizes a real dev row.
// Run: DRIZZLE_TARGET=dev QSTASH_TOKEN= NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-smoke-optimize.ts
import './lib/load-env'

import process from 'node:process'
import { desc, eq } from 'drizzle-orm'
import { db } from '../src/shared/db'
import { projectMediaFiles } from '../src/shared/db/schema/project-media-files'
import { mediaService } from '../src/shared/modules/media/service'
import { projectMediaStore } from '../src/shared/modules/projects/media/store'

async function main() {
  const [row] = await db.select().from(projectMediaFiles)
    .orderBy(desc(projectMediaFiles.id)).limit(1)
  if (!row) {
    console.error('no project media rows on dev — seed one first')
    process.exit(1)
  }
  console.log('before:', row.id, row.optimizationStatus, row.optimizationVariants)
  await mediaService.optimizeNow(projectMediaStore, row.id)
  const [after] = await db.select().from(projectMediaFiles)
    .where(eq(projectMediaFiles.id, row.id))
  console.log('after :', after.id, after.optimizationStatus, after.optimizationVariants)
  process.exit(0)
}
void main()
```

Expected: `after` prints `optimizationStatus: 'optimized'` with `['sm','md','lg']` — the project store's variant list, proving `store.variants` replaced `VARIANT_REGISTRY[ownerKind]` correctly. Delete the script afterwards.

- [ ] **Step 9: Commit**

```bash
rm -f scripts/tmp-smoke-optimize.ts
git add src/shared/modules src/shared/services src/shared/lib/get-optimized-urls.ts src/trpc scripts
git commit -m "refactor(media): generalize media into modules/media

MD1-MD4: services/media -> modules/media; MediaStore becomes an open owner
descriptor (ownerKind: string, variants, getter crud) and each owner unit exports
its own store; stores.ts, optimization-target.ts and MediaOwnerKind are deleted
(removing the last raw db import from the media layer); the optimize job is the
one composition root mapping ownerKind -> store. Job payload unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Owner-aware variant cleanup and store-built path keys

Fixes a live bug: `r2/client.ts` hard-codes `VARIANT_SUFFIXES = ['sm','md','lg']`, but proposal media writes `xs` too — so every proposal media delete leaves an orphaned `-xs.webp` on R2 forever (MD8).

**Files:**
- Modify: `src/shared/services/providers/r2/client.ts:61-121`
- Create: `src/shared/modules/media/core/lib/purge.ts`
- Modify: `src/shared/modules/media/service.ts` (`removeRecord`), `src/shared/modules/projects/core/dal/server/crud.ts` (`delete.before`), `src/trpc/routers/projects.router/media.router.ts` (`importFromProposal`), `scripts/add-during-media.ts`, `scripts/portfolio-scraper/import-project.ts`
- Test: gates are `pnpm tsc`, `pnpm lint`, a delete smoke that checks R2 for orphans, and a grep for hard-coded keys

**Interfaces:**
- Consumes: `MediaStore`, `projectMediaStore`, `PROJECT_MEDIA` (Task 3).
- Produces:
  - `r2Client.deleteMediaWithVariants(bucket: R2BucketName, pathKey: string, suffixes: readonly string[]): Promise<void>` — third argument is **required**
  - `purgeMediaObject(row: { bucket: string | null, pathKey: string | null, optimizationVariants?: string[] | null }, variants: readonly string[]): Promise<void>` from `@/shared/modules/media/core/lib/purge`

- [ ] **Step 1: Make the provider take the suffix list**

In `src/shared/services/providers/r2/client.ts`: delete the `VARIANT_SUFFIXES` const and its comment (currently lines 60-63), and change the method:

```ts
  /**
   * Delete a media file's original + the given optimized variants. Variant
   * deletions are best-effort — they won't throw if a variant doesn't exist.
   * The suffix list is supplied by the caller: this provider is a leaf and must
   * not import an app-level variant registry (MD8).
   */
  deleteMediaWithVariants: async (bucket: R2BucketName, pathKey: string, suffixes: readonly string[]): Promise<void> => {
    const basePath = pathKey.replace(/\.[^.]+$/, '')
    await Promise.all([
      r2Client.deleteObject(bucket, pathKey),
      ...suffixes.map(suffix =>
        r2Client.deleteObject(bucket, `${basePath}-${suffix}.webp`).catch(() => {}),
      ),
    ])
  },
```

- [ ] **Step 2: Write the one purge helper**

Create `src/shared/modules/media/core/lib/purge.ts`:

```ts
// THE single R2 purge path for media (MD7). A leaf: it imports the R2 provider and
// nothing else, so a DAL hook can call it without a DAL ever importing a service.
import type { R2BucketName } from '@/shared/services/providers/r2/types'
import { r2Client } from '@/shared/services/providers/r2/client'

interface PurgeableRow {
  bucket: string | null
  pathKey: string | null
  optimizationVariants?: string[] | null
}

/**
 * Delete a media row's R2 original and its variants.
 *
 * Suffixes are the owner's write-time list UNIONED with whatever the row actually
 * recorded (D3): `store.variants` alone fixes new rows, and the union also covers
 * rows written when a variant list was longer. A key that doesn't exist is caught
 * and ignored by the provider, so the extra calls are harmless.
 *
 * Rows with null coordinates (a Cloudflare Stream row, Plan 1b) have no object —
 * skipped, and the caller still removes the DB row.
 */
export async function purgeMediaObject(row: PurgeableRow, variants: readonly string[]): Promise<void> {
  if (!row.bucket || !row.pathKey) {
    return
  }
  const suffixes = [...new Set([...variants, ...(row.optimizationVariants ?? [])])]
  await r2Client.deleteMediaWithVariants(row.bucket as R2BucketName, row.pathKey, suffixes)
}
```

- [ ] **Step 3: Point the media service at the helper**

In `src/shared/modules/media/service.ts`, inside `removeRecord`, replace the `if (row.bucket && row.pathKey) { await r2Client.deleteMediaWithVariants(row.bucket, row.pathKey) }` block with:

```ts
    await purgeMediaObject(row, store.variants)
```

and drop the now-unused `r2Client` import if nothing else in the file uses it (`buildUploadTarget` still does — check before removing).

- [ ] **Step 4: Rewrite the project-delete hook (C31 / D1)**

In `src/shared/modules/projects/core/dal/server/crud.ts`, replace the `delete.before` hook body. It keeps living in the DAL — that is what makes it fire on every delete path, including the bare `projectCrud.delete` the router calls — but it stops using inline `db` and stops hard-coding suffixes:

```ts
export const projectCrud = createCrudDal(projectServerSpec, () => ({
  hooks: {
    delete: {
      // G4: the engine hands us the row. R2 media cleanup runs BEFORE the DB
      // cascade removes the project media rows. Non-atomic + partial-tolerant,
      // matching the pre-D order.
      //
      // scope: null is deliberate — the purge must be exhaustive. `ctx.scope` here
      // is the PROJECTS predicate; applying it to the media table would either
      // filter rows we must delete objects for, or produce a column mismatch.
      // A DAL may not import a service, so this reads through the media module's
      // table-generic DAL and purges through the leaf helper (C31, D1).
      async before(row: Project, ctx: ScopedContext) {
        const files = await listMediaByOwner(
          projectMediaFiles,
          projectMediaFiles.projectId,
          { ...ctx, scope: null },
          row.id,
        )
        if (!files.success) {
          return
        }
        await Promise.all(
          files.data.map(f => purgeMediaObject(f as any, PROJECT_MEDIA.variants)),
        )
      },
    },
  },
}))
```

Imports to add: `listMediaByOwner` from `@/shared/modules/media/core/dal/server/media-ops`, `purgeMediaObject` from `@/shared/modules/media/core/lib/purge`, `PROJECT_MEDIA` from `@/shared/modules/projects/media/lib/constants`, `projectMediaFiles` from `@/shared/db/schema/project-media-files`, and the `ScopedContext` type. Remove the now-unused `db`, `eq`, `r2Client` and `R2BucketName` imports **only if** `createProjectWithScopes`/`updateProjectWithScopes` further down the file don't use them.

- [ ] **Step 5: Build every path key from the store**

`src/trpc/routers/projects.router/media.router.ts`, in `importFromProposal` (~line 141), replace the hard-coded key:

```ts
        const destKey = projectMediaStore.buildPathKey(input.projectId, crypto.randomUUID(), ext)
```

(`buildPathKey` defaults the phase segment to `uncategorized` when no `extra.phase` is passed — same string as before.)

`src/trpc/routers/projects.router/google-drive.router.ts` already calls `projectMediaStore.buildPathKey(...)` — leave it alone and note it in the commit body.

- [ ] **Step 6: Move the two scripts onto the CRUD DAL**

Both scripts upload to R2 and then `db.insert(projectMediaFiles)`, which bypasses the DAL — so their rows are never optimized. Build the key from the store and insert through the CRUD so they pick up the hooks in Task 5.

In `scripts/add-during-media.ts` (~line 59):

```ts
    const fileId = crypto.randomUUID()
    const pathKey = projectMediaStore.buildPathKey(project.id, fileId, '.webp', { phase: 'during' })

    await r2Client.putObject(BUCKET, pathKey, webp, 'image/webp')

    const created = await projectMediaCrud.create(SYSTEM_CONTEXT, {
      name: path.basename(file),
      pathKey,
      bucket: BUCKET,
      mimeType: 'image/webp',
      fileExtension: 'webp',
      url: `${PUBLIC_BASE}/${pathKey}`,
      phase: 'during',
      isHeroImage: false,
      sortOrder: sortOrder++,
      projectId: project.id,
    })
    if (!created.success) {
      console.error(`  ! insert failed for ${path.basename(file)}:`, created.error)
    }
```

In `scripts/portfolio-scraper/import-project.ts` (~line 308), the same shape: `const pathKey = projectMediaStore.buildPathKey(project.id, fileId, ext, { phase })`, then `await projectMediaCrud.create(SYSTEM_CONTEXT, { …same values… })` in place of `db.insert(projectMediaFiles).values({ … })`.

Imports for both: `projectMediaCrud` from `../src/shared/modules/projects/media/dal/server/crud` (adjust depth per script), `projectMediaStore` from `../src/shared/modules/projects/media/store`, `SYSTEM_CONTEXT` from `../src/shared/dal/server/types`.

- [ ] **Step 7: Verify, including a real orphan check**

```bash
pnpm tsc && pnpm lint
grep -rn "projects/\${" src/trpc/routers/projects.router/ scripts/add-during-media.ts scripts/portfolio-scraper/import-project.ts
grep -rn "VARIANT_SUFFIXES" src/
```
Expected: both greps print **nothing** (every key now comes from `buildPathKey`; the provider constant is gone).

Then the orphan check — this is the bug the task exists for. Write `scripts/tmp-smoke-purge.ts` (throwaway, deletes real R2 objects, so it creates its own):

```ts
// Throwaway: proves a proposal media delete no longer orphans -xs.webp (MD8).
// Run: DRIZZLE_TARGET=dev QSTASH_TOKEN= NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-smoke-purge.ts
import './lib/load-env'

import { Buffer } from 'node:buffer'
import process from 'node:process'
import { desc } from 'drizzle-orm'
import { db } from '../src/shared/db'
import { proposals } from '../src/shared/db/schema/proposals'
import { SYSTEM_CONTEXT } from '../src/shared/dal/server/types'
import { mediaService } from '../src/shared/modules/media/service'
import { proposalMediaStore } from '../src/shared/modules/proposals/media/store'
import { r2Client } from '../src/shared/services/providers/r2/client'

async function main() {
  const [proposal] = await db.select().from(proposals).orderBy(desc(proposals.createdAt)).limit(1)
  if (!proposal) {
    console.error('no proposals on dev — seed one first')
    process.exit(1)
  }

  const fileId = crypto.randomUUID()
  const pathKey = proposalMediaStore.buildPathKey(proposal.id, fileId, '.jpg')
  const base = pathKey.replace(/\.[^.]+$/, '')

  // the original + one variant per suffix this owner writes, xs included
  await r2Client.putObject(proposalMediaStore.bucket, pathKey, Buffer.from('x'), 'image/jpeg')
  for (const s of proposalMediaStore.variants)
    await r2Client.putObject(proposalMediaStore.bucket, `${base}-${s}.webp`, Buffer.from('x'), 'image/webp')

  const created = await proposalMediaStore.crud.create(SYSTEM_CONTEXT, {
    proposalId: proposal.id,
    name: 'SMOKE-purge',
    mimeType: 'image/jpeg',
    fileExtension: 'jpg',
    pathKey,
    bucket: proposalMediaStore.bucket,
    optimizationVariants: [...proposalMediaStore.variants],
  } as any)
  if (!created.success)
    throw new Error(`create failed: ${JSON.stringify(created.error)}`)

  console.log('before:', await r2Client.listAllKeys(proposalMediaStore.bucket, base))
  const removed = await mediaService.removeRecord(proposalMediaStore, SYSTEM_CONTEXT, (created.data as any).id)
  console.log('remove:', removed.success)
  console.log('after :', await r2Client.listAllKeys(proposalMediaStore.bucket, base))
  process.exit(0)
}
void main()
```

Expected: `before` lists five keys (original + `xs`/`sm`/`md`/`lg`); `after` is `[]`. Before this task, `after` would still hold `…-xs.webp`.

- [ ] **Step 8: Commit**

```bash
rm -f scripts/tmp-smoke-purge.ts
git add src/shared/services/providers/r2/client.ts src/shared/modules src/trpc/routers/projects.router scripts/add-during-media.ts scripts/portfolio-scraper/import-project.ts
git commit -m "fix(media): owner-aware variant cleanup and store-built path keys

MD7, MD8: deleteMediaWithVariants takes the suffix list and the provider's
hard-coded VARIANT_SUFFIXES is deleted, so deleting proposal media no longer
orphans -xs.webp objects. One leaf helper (purgeMediaObject) is now the single
purge path, unioning the store's variants with the row's recorded ones (D3); the
project delete hook uses it and the table-generic media DAL instead of inline db
(C31, D1), purging unscoped so the cleanup stays exhaustive. Path keys come from
the store everywhere, and the two media scripts insert through the CRUD DAL.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Services, lifecycle hooks, and router adapters

The payoff commit: projects gets a server API, and the two row-lifecycle side effects move from service wrappers into CRUD hooks so they fire on **every** origin (D5, C32).

**Files:**
- Create: `src/shared/modules/projects/media/service.ts`, `src/shared/modules/projects/service.ts`, `src/shared/modules/media/core/lib/optimizable.ts`
- Modify: `src/shared/modules/projects/media/dal/server/crud.ts`, `src/shared/modules/proposals/media/dal/server/crud.ts`, `src/shared/modules/media/service.ts`, `src/shared/modules/proposals/media/service.ts`, `src/trpc/routers/projects.router/media.router.ts`, `src/trpc/routers/projects.router/google-drive.router.ts`
- Delete: `src/shared/hooks/use-media-upload.ts`, `src/shared/components/portfolio/{sortable-media-manager,sortable-photo-card,photo-detail-dialog,upload-source-popover}.tsx` (MD13 — a self-contained dead cluster superseded by `src/shared/components/media/`)
- Test: gates are `pnpm tsc`, `pnpm lint`, a naked-path hook smoke, an import-order cycle proof, and a delete-semantics check

**Interfaces:**
- Consumes: everything from Tasks 3 and 4.
- Produces:
  - `isOptimizable(mimeType: unknown): boolean` from `@/shared/modules/media/core/lib/optimizable`
  - `projectMediaService` from `@/shared/modules/projects/media/service` — `...projectMediaCrud`, `buildUploadTarget(ctx, { projectId, filename, mimeType, phase })`, `list(ctx, { projectId })`, `reorder(ctx, { updates })`, `retryOptimization(ctx, { id })`, `movePhase(ctx, { ids, phase })`, `setHero(ctx, { id, isHeroImage })`, `importFromProposal(ctx, { projectId, proposalMediaFileIds })`
  - `projectsService` from `@/shared/modules/projects/service` — `...projectCrud` plus `get media()`
  - `mediaService` loses `createRecord` and `removeRecord`

- [ ] **Step 1: Extract the optimizable predicate to a leaf**

Create `src/shared/modules/media/core/lib/optimizable.ts` with the function currently private inside the media service:

```ts
/** Images and PDFs get a derived-variant optimization pass; everything else is stored as-is. */
export function isOptimizable(mimeType: unknown): boolean {
  return typeof mimeType === 'string' && (mimeType.startsWith('image/') || mimeType === 'application/pdf')
}
```

Delete the private copy from `src/shared/modules/media/service.ts` and import this one there.

- [ ] **Step 2: Add the two hooks to the project media CRUD**

Replace `src/shared/modules/projects/media/dal/server/crud.ts` with:

```ts
import type { ProjectMediaFile } from '@/shared/db/schema/project-media-files'
import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { optimizeMediaJob } from '@/shared/services/providers/upstash/jobs/optimize-media'
import { isOptimizable } from '@/shared/modules/media/core/lib/optimizable'
import { purgeMediaObject } from '@/shared/modules/media/core/lib/purge'
import { PROJECT_MEDIA } from '@/shared/modules/projects/media/lib/constants'
import { projectMediaServerSpec } from '@/shared/modules/projects/media/server-spec'

/**
 * Scoped CRUD handlers for project media files, with the row lifecycle attached
 * (C32, D5): optimize-on-create and purge-on-delete are entity-invariant, so they
 * are factory hooks here rather than wrappers in a service — they fire on every
 * call and every origin, including a bare `projectMediaCrud.create` from a script.
 *
 * HOOK CAVEAT (same as entities/meetings/dal/server/crud.ts): these run INLINE.
 * On the naked path the write autocommits before the hook fires. If a future
 * orchestrator threads a tx in via `withTx`, the dispatch fires PRE-COMMIT and
 * won't roll back; `afterCommit` (sub-plan C) is deferred.
 *
 * The hooks read PROJECT_MEDIA (a leaf constants module), never the store — the
 * store imports this file, and going the other way would add a second edge to the
 * cycle D6 already has to defuse.
 *
 * See ../../server-spec.ts: the project-media router still passes an unscoped ctx,
 * so these run unscoped there until #285 turns the parent bridge on. Serial int PK.
 */
export const projectMediaCrud = createCrudDal(projectMediaServerSpec, () => ({
  hooks: {
    create: {
      after(row: ProjectMediaFile) {
        if (isOptimizable(row.mimeType)) {
          void optimizeMediaJob.dispatch({ ownerKind: PROJECT_MEDIA.ownerKind, mediaId: row.id })
        }
      },
    },
    delete: {
      async before(row: ProjectMediaFile) {
        await purgeMediaObject(row, PROJECT_MEDIA.variants)
      },
    },
  },
}))
```

- [ ] **Step 3: Add the two hooks to the proposal media CRUD**

Replace `src/shared/modules/proposals/media/dal/server/crud.ts` with:

```ts
import type { ProposalMediaFile } from '@/shared/db/schema/proposal-media-files'
import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { optimizeMediaJob } from '@/shared/services/providers/upstash/jobs/optimize-media'
import { isOptimizable } from '@/shared/modules/media/core/lib/optimizable'
import { purgeMediaObject } from '@/shared/modules/media/core/lib/purge'
import { PROPOSAL_MEDIA } from '@/shared/modules/proposals/media/lib/constants'
import { proposalMediaServerSpec } from '@/shared/modules/proposals/media/server-spec'

/**
 * Scoped CRUD handlers for proposal media files. `getById`/`update`/`delete`
 * compose `ctx.scope` — the parent bridge folded in by the child-scoped
 * `proposalMediaProcedure` — so an out-of-scope row is `not-found`, no separate
 * authz probe. `setVisibility`/`rename` route straight through `update`.
 * Serial int PK.
 *
 * Row lifecycle (optimize dispatch, R2 purge) lives in the hooks below (C32, D5),
 * not in the service — so it fires on every origin. Same inline/pre-commit caveat
 * as the project twin (`modules/projects/media/dal/server/crud.ts`).
 */
export const proposalMediaCrud = createCrudDal(proposalMediaServerSpec, () => ({
  hooks: {
    create: {
      after(row: ProposalMediaFile) {
        if (isOptimizable(row.mimeType)) {
          void optimizeMediaJob.dispatch({ ownerKind: PROPOSAL_MEDIA.ownerKind, mediaId: row.id })
        }
      },
    },
    delete: {
      async before(row: ProposalMediaFile) {
        await purgeMediaObject(row, PROPOSAL_MEDIA.variants)
      },
    },
  },
}))
```

- [ ] **Step 4: Strip the two wrappers out of the media service**

In `src/shared/modules/media/service.ts`, delete the `createRecord` and `removeRecord` methods entirely, along with the now-unused `optimizeMediaJob` import **if** `retryOptimization` no longer needs it — it does need it, so keep it. Update the file header to say the service owns upload targets, table-generic list/reorder and the optimization entry points, and that the row lifecycle belongs to each owner's CRUD hooks (C32).

The remaining surface is exactly: `buildUploadTarget`, `reorder`, `list`, `retryOptimization`, `optimizeNow`.

- [ ] **Step 5: Simplify the proposal media service**

In `src/shared/modules/proposals/media/service.ts`:
- delete the `delete` override entirely (the spread `...proposalMediaCrud` now carries it, hook included),
- change `create` to keep its probe but call the CRUD directly:

```ts
  async create(ctx: ScopedContext, input: CreateProposalMediaInput): Promise<DalReturn<ProposalMediaFile>> {
    return dalDbOperation(async () => {
      await assertParentVisible(ctx, input.proposalId)
      return dalVerifySuccess(await proposalMediaCrud.create(ctx, input)) as ProposalMediaFile
    })
  },
```

Update the header comment's slot table: `create` is now "parent-visibility probe → engine create (the create hook dispatches optimize)", and `delete` is "engine slot — the delete hook purges R2 first".

- [ ] **Step 6: Write the project media service**

Create `src/shared/modules/projects/media/service.ts`:

```ts
// Project media service — the `media_files` child of a project: the photo set
// behind the portfolio and the showroom. The R2 object lifecycle and the optimize
// dispatch belong to this unit's CRUD hooks (dal/server/crud.ts, C32), so the
// spread `create`/`delete` below already carry them. What lives here is what the
// DAL cannot see: the store binding for the shared media verbs, and the
// project-only operations that used to sit in the router (MD6).
//
//   ...projectMediaCrud   the engine's five slots, unwrapped (serial int PK)
//   buildUploadTarget     presigned R2 PUT under the store's path key
//   list / reorder        scoped, table-generic, via the media module
//   retryOptimization     own-row probe -> reset status -> optimize dispatch
//   movePhase / setHero   bulk writes on this unit's DAL
//   importFromProposal    copy R2 objects from proposal media onto this project
//
// NOTE (D4): unlike the proposal twin there is NO parent-visibility probe here —
// the project media router still runs on a bare `agentProcedure` with
// `ctx.scope = null`, so adding one would be a live authorization tightening.
// That flip belongs to #285.
import type { MediaPhase } from '@/shared/constants/enums/media'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { ProjectMediaFile } from '@/shared/db/schema/project-media-files'
import type { R2BucketName } from '@/shared/services/providers/r2/types'

import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { mediaService } from '@/shared/modules/media/service'
import { projectMediaCrud } from '@/shared/modules/projects/media/dal/server/crud'
import { moveMediaPhase, setHeroImage } from '@/shared/modules/projects/media/dal/server/mutations'
import { projectMediaStore } from '@/shared/modules/projects/media/store'
import { listImportableProjectMedia } from '@/shared/modules/proposals/media/dal/server/queries'
import { r2Client } from '@/shared/services/providers/r2/client'
import { R2_PUBLIC_DOMAINS } from '@/shared/services/providers/r2/types'

export const projectMediaService = {
  ...projectMediaCrud,

  // ctx-first and DalReturn-wrapped like every other verb, even though there is
  // nothing to scope here yet (D4) — the proposal twin has the same signature, and
  // #285 will put a probe in exactly this spot.
  async buildUploadTarget(
    _ctx: ScopedContext,
    input: { projectId: string, filename: string, mimeType: string, phase: MediaPhase },
  ): Promise<DalReturn<{ uploadUrl: string, pathKey: string, bucket: string }>> {
    return dalDbOperation(async () =>
      mediaService.buildUploadTarget(projectMediaStore, {
        ownerId: input.projectId,
        filename: input.filename,
        mimeType: input.mimeType,
        extra: { phase: input.phase },
      }),
    )
  },

  async list(ctx: ScopedContext, input: { projectId: string }): Promise<DalReturn<ProjectMediaFile[]>> {
    return dalDbOperation(async () =>
      dalVerifySuccess(await mediaService.list(projectMediaStore, ctx, input.projectId)) as ProjectMediaFile[],
    )
  },

  async reorder(ctx: ScopedContext, input: { updates: { id: number, sortOrder: number }[] }): Promise<DalReturn<void>> {
    return mediaService.reorder(projectMediaStore, ctx, input.updates)
  },

  async retryOptimization(ctx: ScopedContext, input: { id: number }): Promise<DalReturn<void>> {
    return dalDbOperation(async () => {
      const row = dalVerifySuccess(await projectMediaCrud.getById(ctx, { id: input.id }))
      if (!row) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      await mediaService.retryOptimization(projectMediaStore, input.id)
    })
  },

  async movePhase(ctx: ScopedContext, input: { ids: number[], phase: MediaPhase }): Promise<DalReturn<void>> {
    return moveMediaPhase(ctx, input.ids, input.phase)
  },

  async setHero(ctx: ScopedContext, input: { id: number, isHeroImage: boolean }): Promise<DalReturn<void>> {
    return setHeroImage(ctx, input.id, input.isHeroImage)
  },

  /**
   * Copy proposal media onto this project. Authorization is the source query:
   * `listImportableProjectMedia` only returns media on proposals attached to THIS
   * project's meetings, so an arbitrary proposal media id can't be imported.
   *
   * Round-2 rush rules kept unchanged on purpose (C30/MD12): no `visibility` check
   * on the source rows. Revisit with the owner, not here.
   */
  async importFromProposal(
    ctx: ScopedContext,
    input: { projectId: string, proposalMediaFileIds: number[] },
  ): Promise<DalReturn<{ imported: number }>> {
    return dalDbOperation(async () => {
      const sources = await listImportableProjectMedia(input.projectId, input.proposalMediaFileIds)
      let imported = 0
      for (const src of sources) {
        if (!src.pathKey || !src.bucket) {
          continue
        }
        const ext = src.fileExtension || (src.pathKey.includes('.') ? `.${src.pathKey.split('.').pop()}` : '')
        const destKey = projectMediaStore.buildPathKey(input.projectId, crypto.randomUUID(), ext)
        await r2Client.copyObject({
          sourceBucket: src.bucket as R2BucketName,
          sourceKey: src.pathKey,
          destBucket: projectMediaStore.bucket,
          destKey,
        })
        dalVerifySuccess(await projectMediaCrud.create(ctx, {
          projectId: input.projectId,
          name: src.name,
          mimeType: src.mimeType,
          fileExtension: ext,
          pathKey: destKey,
          bucket: projectMediaStore.bucket,
          url: `${R2_PUBLIC_DOMAINS[projectMediaStore.bucket] ?? ''}/${destKey}`,
          phase: 'uncategorized',
        }))
        imported++
      }
      return { imported }
    })
  },
} as const

export type ProjectMediaService = typeof projectMediaService
```

- [ ] **Step 7: Write the root projects service**

Create `src/shared/modules/projects/service.ts`:

```ts
// Projects module service — the ONE server-side API for project orchestration,
// shared by tRPC, RSC pages, jobs and scripts. Same shape as
// `modules/proposals/service.ts`: the entity's five CRUD slots spread onto the
// service, then verbs, then child services as GETTERS.
//
// The getter is required, not stylistic: a child service reaches the root, so a
// top-level `media: projectMediaService` would read that binding while this object
// literal is being evaluated — a ReferenceError whenever the child module loads
// first. Reference an imported SERVICE only inside a method body or a getter.
//
// Read verbs (listProjects, the public projection, cover-image rule) arrive in
// spec B — this file exists now so those have a home and so callers can stop
// reaching into the DAL.
import type { SpecCrudHandlers } from '@/shared/dal/server/types'
import type { projectServerSpec } from '@/shared/modules/projects/core/server-spec'

import { projectCrud } from '@/shared/modules/projects/core/dal/server/crud'
import { projectMediaService } from '@/shared/modules/projects/media/service'

export const projectsService = {
  ...projectCrud,

  get media() {
    return projectMediaService
  },
} satisfies SpecCrudHandlers<typeof projectServerSpec>

export type ProjectsService = typeof projectsService
```

- [ ] **Step 8: Turn the routers into adapters**

`src/trpc/routers/projects.router/media.router.ts` — every procedure becomes a thin call. The input schemas and the tRPC path names do **not** change (MD9), so each `…` below stands for the existing `agentProcedure.input(…)` chain, left exactly as it is. Replace only the handler bodies:

```ts
  getUploadUrl: …mutation(async ({ ctx, input }) => {
    const { uploadUrl, pathKey, bucket } = dalToTrpc(await projectsService.media.buildUploadTarget(ctx, input))
    return { uploadUrl, pathKey, publicUrl: `${R2_PUBLIC_DOMAINS[bucket as R2BucketName] ?? ''}/${pathKey}` }
  }),

  create: …mutation(async ({ ctx, input }) =>
    dalToTrpc(await projectsService.media.create(ctx, { ...input, bucket: input.bucket ?? projectMediaStore.bucket })),
  ),

  retryOptimization: …mutation(async ({ ctx, input }) => {
    dalToTrpc(await projectsService.media.retryOptimization(ctx, { id: input.mediaFileId }))
    return { success: true }
  }),

  delete: …mutation(async ({ ctx, input }) => {
    dalToTrpc(await projectsService.media.delete(ctx, { id: input.id }))
  }),

  reorder:  …dalToTrpc(await projectsService.media.reorder(ctx, input)),
  movePhase:…dalToTrpc(await projectsService.media.movePhase(ctx, input)),
  toggleHero:…dalToTrpc(await projectsService.media.setHero(ctx, input)),
  rename:   …dalToTrpc(await projectsService.media.update(ctx, { id: input.id, data: { name: input.name } })),
  importFromProposal: …return dalToTrpc(await projectsService.media.importFromProposal(ctx, input)),
```

`rename` is the MD5 change: renaming is a plain field update, so it goes through the spread `update` slot instead of a bespoke service verb.

`bulkDelete` is the D5 consequence — the engine's delete is not idempotent, so a stale id in the selection must not abort the rest:

```ts
  bulkDelete: agentProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      // A row that is already gone is not an error for a bulk selection (the user
      // may be acting on a stale list) — but any other failure still surfaces.
      for (const id of input.ids) {
        const result = await projectsService.media.delete(ctx, { id })
        if (!result.success && result.error.type !== 'not-found') {
          dalToTrpc(result)
        }
      }
    }),
```

`listImportableProposalMedia` keeps its current body (it is a read with display-URL shaping, not media orchestration).

`src/trpc/routers/projects.router/google-drive.router.ts` — keep the Drive fetch and the R2 upload in the router, and swap the persist call to `dalToTrpc(await projectsService.media.create(ctx, { … }))`. Drop the `mediaService` import.

- [ ] **Step 9: Delete the dead media UI cluster (MD13)**

```bash
git rm src/shared/hooks/use-media-upload.ts \
       src/shared/components/portfolio/sortable-media-manager.tsx \
       src/shared/components/portfolio/sortable-photo-card.tsx \
       src/shared/components/portfolio/photo-detail-dialog.tsx \
       src/shared/components/portfolio/upload-source-popover.tsx
rmdir src/shared/components/portfolio 2>/dev/null; true
grep -rn "components/portfolio/\|hooks/use-media-upload" src/ --include=*.ts --include=*.tsx
```
Expected: **no output**. These five files only referenced each other; the live versions are in `src/shared/components/media/`.

- [ ] **Step 10: Verify — compile, hooks, cycle, delete semantics**

```bash
pnpm tsc && pnpm lint
grep -rn "createRecord\|removeRecord" src/shared/modules src/trpc --include=*.ts
```
Expected: `tsc`/`lint` exit 0; the grep prints only the unrelated client-side `createRecord` callback in `src/shared/components/media/use-media-upload.ts` and its two consumers.

Write `scripts/tmp-smoke-media-hooks.ts` (throwaway):

```ts
// Throwaway: proves the row lifecycle fires off the NAKED DAL path (C32, D5).
// Run: DRIZZLE_TARGET=dev QSTASH_TOKEN= NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-smoke-media-hooks.ts
import './lib/load-env'

import { Buffer } from 'node:buffer'
import process from 'node:process'
import { desc } from 'drizzle-orm'
import { db } from '../src/shared/db'
import { projects } from '../src/shared/db/schema/projects'
import { SYSTEM_CONTEXT } from '../src/shared/dal/server/types'
import { projectMediaCrud } from '../src/shared/modules/projects/media/dal/server/crud'
import { projectMediaStore } from '../src/shared/modules/projects/media/store'
import { projectsService } from '../src/shared/modules/projects/service'
import { r2Client } from '../src/shared/services/providers/r2/client'

async function run(label: string, create: typeof projectMediaCrud.create, del: typeof projectMediaCrud.delete, projectId: string) {
  const fileId = crypto.randomUUID()
  const pathKey = projectMediaStore.buildPathKey(projectId, fileId, '.jpg', { phase: 'during' })
  const base = pathKey.replace(/\.[^.]+$/, '')

  await r2Client.putObject(projectMediaStore.bucket, pathKey, Buffer.from('x'), 'image/jpeg')
  for (const sfx of projectMediaStore.variants)
    await r2Client.putObject(projectMediaStore.bucket, `${base}-${sfx}.webp`, Buffer.from('x'), 'image/webp')

  // 1. create — watch for "DISPATCHING JOB optimize-media" above this line
  const created = await create(SYSTEM_CONTEXT, {
    projectId,
    name: `SMOKE-${label}`,
    mimeType: 'image/jpeg',
    fileExtension: 'jpg',
    pathKey,
    bucket: projectMediaStore.bucket,
    url: `https://example.invalid/${pathKey}`,
    phase: 'during',
  } as any)
  if (!created.success)
    throw new Error(`[${label}] create failed: ${JSON.stringify(created.error)}`)
  const id = (created.data as any).id

  // 2. delete — the hook must purge original + variants
  const first = await del(SYSTEM_CONTEXT, { id })
  const leftovers = await r2Client.listAllKeys(projectMediaStore.bucket, base)
  console.log(`[${label}] delete ok=${first.success} leftovers=${JSON.stringify(leftovers)}`)

  // 3. delete again — no longer an idempotent no-op
  const second = await del(SYSTEM_CONTEXT, { id })
  console.log(`[${label}] second delete success=${second.success} error=${second.success ? '-' : second.error.type}`)
}

async function main() {
  const [project] = await db.select().from(projects).orderBy(desc(projects.createdAt)).limit(1)
  if (!project) {
    console.error('no projects on dev — seed one first')
    process.exit(1)
  }
  await run('naked-dal', projectMediaCrud.create, projectMediaCrud.delete, project.id)
  await run('service', projectsService.media.create, projectsService.media.delete, project.id)
  process.exit(0)
}
void main()
```

Expected, for **both** labels: `DISPATCHING JOB optimize-media` printed by `createJob` before each delete line, `leftovers=[]`, and `second delete success=false error=not-found`. A non-empty `leftovers` means the delete hook did not fire; a missing dispatch line means the create hook did not.

Then the cycle proof (D6) — two one-line scripts, each importing a different entry first:

```bash
DRIZZLE_TARGET=dev NODE_OPTIONS=--conditions=react-server pnpm tsx -e "import('./src/shared/modules/projects/media/dal/server/crud').then(m => console.log('crud-first OK', typeof m.projectMediaCrud.create))"
DRIZZLE_TARGET=dev NODE_OPTIONS=--conditions=react-server pnpm tsx -e "import('./src/shared/services/providers/upstash/jobs/optimize-media').then(m => console.log('job-first OK', m.optimizeMediaJob.key))"
```
Expected: both print OK. A `ReferenceError: Cannot access 'projectMediaCrud' before initialization` means a store declared `crud` as a plain property instead of a getter — fix the store, not the hook.

- [ ] **Step 11: Commit**

```bash
rm -f scripts/tmp-smoke-media-hooks.ts
git add src/shared/modules src/shared/hooks src/shared/components src/trpc/routers/projects.router
git commit -m "feat(projects): project media service, root projects service, lifecycle hooks

C32/D5: optimize-on-create and purge-on-delete move from mediaService wrappers
into createCrudDal hooks on both media units, so they fire on every origin
including a bare crud.create from a script; mediaService.createRecord/removeRecord
are deleted along with the project media overrides and the proposal delete
override (the proposal create probe stays — authorization belongs in a service).
Deleting an already-deleted row now returns not-found, so bulkDelete tolerates it
per id. Adds modules/projects/media/service.ts and the root projects service
(children as getters, D6); the media and google-drive routers become adapters and
movePhase/setHero/importFromProposal leave the router (MD6). rename goes through
the CRUD update slot (MD5). Deletes the dead portfolio media UI cluster (MD13).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Documentation

The rules that describe this layer are now wrong in four places. This task makes the docs match the code that just landed (K2, K6, K7, K10, M7, M8).

**Files:**
- Modify: `docs/codebase-conventions/service-architecture.md`, `docs/codebase-conventions/dal-conventions.md`, `docs/adr/0003-*.md`, `docs/adr/0002-entity-server-system.md`, `docs/permissions/visibility-rules-catalog.md`, `docs/plans/2026-09-13-main-285-sync-plan.md`
- Rewrite: `src/shared/modules/media/DOCS.md`
- Modify: `src/shared/modules/projects/core/DOCS.md` (its own path references)
- Modify (memory, outside the repo): `/home/olis-solutions/.claude/projects/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/memory/coding-conventions.md`
- Test: gate is a grep that no **live rule doc** still cites the old paths (historical plans/specs are snapshots — leave them alone)

**Interfaces:**
- Consumes: the final structure from Tasks 1–5.
- Produces: nothing code-facing.

- [ ] **Step 1: Re-read `service-architecture.md` before touching it**

```bash
git status --porcelain docs/codebase-conventions/service-architecture.md
git diff docs/codebase-conventions/service-architecture.md | head -60
```

⚠️ Another session is editing this file right now (provider-boundary/translator rules for epic #248, pointing at `docs/plans/2026-09-15-construction-data-standardization-epic.md`). **Write onto whatever is there** — do not revert their edits, and make the new `modules/` definition cover their case too. If the file has changed since this plan was written, that is expected; adapt rather than reporting it as staleness.

- [ ] **Step 2: Define `modules/` (K2)**

Add a section to `docs/codebase-conventions/service-architecture.md` covering:
- **What a module is:** a bounded slice of the domain that owns its units. Three kinds exist today — a module with its own tables (`proposals`, `projects`), a provider-backed module with no tables of its own (`construction`), and a capability module that owns no table at all (`media`).
- **Root vs unit `service.ts`:** the root spreads the entity CRUD, adds verbs, and exposes child services as **getters** (never top-level property values — ES module TDZ; `modules/proposals/service.ts` explains the failure mode). A unit's `service.ts` does the same for its own entity.
- **Where `server-spec.ts` lives:** the unit root, not `lib/`.
- **The `db` allowlist:** `db` is imported only inside a `dal/` directory — `modules/*/dal/server/**` and `modules/*/*/dal/server/**` included.
- **Entities vs modules:** an entity that no module claims stays in `src/shared/entities/`; moving it into a module is a deliberate, path-only commit.
- **Row lifecycle vs orchestration (C32):** side effects that must fire for every origin (dispatching a job on create, purging storage on delete) are `createCrudDal` hooks on the entity's DAL. Authorization probes and cross-entity orchestration are service verbs. Cite `modules/projects/media/dal/server/crud.ts` and `entities/meetings/dal/server/crud.ts`.
- Amend `#the-deciding-question` per C17.

- [ ] **Step 3: Rewrite the media module DOCS (K10)**

Replace `src/shared/modules/media/DOCS.md`. It must state:
- the module owns no table and imports no owner table, CRUD or owner-kind union;
- the `MediaStore` contract **including** `crud` (typed `CrudHandlers`, declared as a getter and why — D6) and `variants`, with `ownerColumn` typed `PgColumn`, not `any` (today's doc gets both wrong at `:37-43`);
- **adding a new media owner** is now exactly: a `store.ts`, a `PROJECT_MEDIA`-style constants leaf, the two CRUD hooks, and one line in the job's `STORES` map — the old doc's "store + DAL" answer at `:5-7` was already incomplete;
- the media service's surface is `buildUploadTarget · list · reorder · retryOptimization · optimizeNow`, and **why** `createRecord`/`removeRecord` are gone (C32);
- the import-cycle note (D2/D6): media service → job → stores → owner DAL, and owner DAL → job → stores → owner DAL, safe because `store.crud` is a getter. Say this plainly so it does not read as an accident.

- [ ] **Step 4: Fix the remaining rule docs**

- `docs/codebase-conventions/dal-conventions.md` and `docs/permissions/visibility-rules-catalog.md` (M8): update every `entities/projects` / `entities/media-files` / `services/media` path.
- ADR-0003 (K6): `:25` says "Receive `AuthedContext`" — the code takes `ScopedContext`; `:56` states a two-way deciding question while the doc body has four branches plus a router carve-out; `:95`'s classification list omits module services. ADR-0002 `:195` cites `buildSessionContext(spec)`, which does not exist.
- `memory/coding-conventions.md` (K7): Rule 12 (entities import only enums — they import `db`, DAL and other specs), Rules 15/19 (the `db` allowlist is missing `modules/*/*/dal`).
- `src/shared/modules/projects/core/DOCS.md`: update its own in-file path references.

- [ ] **Step 5: Record the #285 sync facts (M7, MD11)**

Append to `docs/plans/2026-09-13-main-285-sync-plan.md`:
- Task 1 moved the four files #285 edits — `media-ops.ts`, projects `queries.ts`, `server-spec.ts`, `visibility.ts` — and names their new paths.
- Conflict #10: #285 adds table-generic `movePhase`/`setHero` to `media-ops.ts` and the media service, which C24 rules out. The sync takes main's shape (the project media unit) and ports #285's scoping — `requireResolvedScope`, the `inArray` update, the bounded unset — into `modules/projects/media/dal`.
- `mediaFileServerSpec` → `projectMediaServerSpec` (MD9), which #285 references by name.
- The project media create/delete overrides #285 may expect are gone — the hooks carry them now (C32).

- [ ] **Step 6: Verify and commit**

```bash
grep -rn "entities/projects\|entities/media-files\|services/media" \
  docs/codebase-conventions/ docs/adr/ docs/permissions/ src/shared/modules/*/DOCS.md src/shared/modules/*/*/DOCS.md
```
Expected: **no output**. (`docs/plans/**` and `docs/superpowers/**` are historical records — they keep the paths that were true when they were written.)

```bash
git add docs/codebase-conventions docs/adr docs/permissions docs/plans/2026-09-13-main-285-sync-plan.md src/shared/modules
git commit -m "docs(modules): define modules/, refresh media and layering docs

K2: what a module and a unit are, root vs unit service.ts, the getter rule, the db
allowlist, entities-vs-modules, and where a row-lifecycle side effect belongs
(C32); C17 amendment to the deciding question. K10: media DOCS rewritten for the
open MediaStore (crud getter, variants) and the real add-an-owner recipe. K6/K7:
ADR + coding-convention drift. M7/M8/MD11: path references and the #285 sync
entries.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

Finally, tick the landed items in the epic tracker `docs/plans/2026-09-14-upgrading-meeting-flow-epic.md` (§0 row A → `[x]`, and the M/MD/K/C rows this plan covers) and commit that separately.

---

## Out of scope — do not widen

These are **spec B**, not this plan. If you find yourself touching them, stop:

- `crud.router.ts`, `business.router.ts` and `showroom-display.router.ts` keep calling `projectCrud` / the projects DAL directly at their new paths. Moving them onto `projectsService` is R11. Same for `accounting.service.ts`, `upstash/jobs/create-qb-records.ts`, the RSC pages and the sitemap.
- The public showroom procedures still leak `address`, `zip`, `customerId`, `ownerId`, `qbSubCustomerId` (tracker S1 🚨). Real, known, and B's to fix — do not "just" add a projection here; it changes the public API surface.
- Read verbs on the projects service (`listProjects`, the cover-image rule, `groupMediaByPhase`, `listMediaByProjectIds`), the trade-matching rule, and `features/landing/lib/get-trade-images.ts`.
- Turning on the project-media parent scope bridge (#285), and any DDL — including renaming the `media_files` table or dropping `x_project_media_files`.

## Notes for the executor

- **If `pnpm tsc` fails after a sed step**, the fastest diagnosis is `pnpm tsc 2>&1 | head -30` — a module-not-found means a specifier was missed, a "has no exported member" means a symbol rename was partial.
- **`pnpm lint` does not cover `scripts/`.** After editing a script, `pnpm tsc` is the only automated gate; read the diff carefully.
- **Never run `db:push`** in this plan. No schema change is intended and the table name is deliberately unchanged.
- **The dev server does not pick up new Tailwind classes** and is irrelevant here, but if you start one to click through the media manager, restart it after Task 5.
- **Spec drift found while writing this plan** (already corrected here, worth knowing): the spec's A4 says the google-drive router should start building path keys from the store — it already does (`google-drive.router.ts:56`). Only `media.router.ts`'s `importFromProposal` hard-codes a key.
