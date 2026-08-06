# Proposal Media Goes Public — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move proposal media off the private/presigned model onto the public `tpr-media` bucket and portfolio's responsive-`srcSet` render path, introducing a parameterized image optimizer that makes `xs` (~320w) a first-class variant proposals opt into.

**Architecture:** The image optimizer gains an explicit variant-selection parameter chosen at the owner seam (`OptimizationTarget.variants`). Proposal read projections derive public `src`/`srcSet` just-in-time from `pathKey`+`bucket`+`optimizationVariants` (deleting the presigner); the render surfaces switch to `<OptimizedImage>`. Existing `proposals/*` blobs + the `bucket` column migrate to `tpr-media` with zero URL breakage (the media CDN domain has no `tpr-homeowner-files` entry, so derivation already falls back to the `tpr-media` domain).

**Tech Stack:** Next.js 15 (App Router) on Vercel · Cloudflare R2 (`@aws-sdk/client-s3`) · sharp · tRPC + TanStack Query · Drizzle (Postgres/Neon) · Tailwind v4 · motion/react.

**Spec:** `docs/superpowers/specs/2026-08-06-proposal-media-public-render-design.md` — read it for rationale; this plan is the executable form.

## Global Constraints

- **Work on `main`; stage by explicit path** — never `git add -A`. Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **No `pnpm build`** — the only validation cycle is `pnpm tsc` + `pnpm lint`. There is **no unit-test runner** in this repo; do not write `*.test.ts` files or invent a test command. Each task's "test" is `pnpm tsc` + `pnpm lint` clean, plus (for scripts) a `--dry-run`, plus the manual browser checks in the final task.
- **DB pushes:** none needed (no schema change). Migration scripts target prod **only** via `DRIZZLE_TARGET=prod` — never `NODE_ENV`. Scripts load env via `import './lib/load-env'`, never `dotenv/config`.
- **Import direction:** `src/shared/**` must never import `@/features/**`.
- **Uploads stay presigned PUT.** Only the read path changes.
- **Never touch `recordings/*`** in `tpr-homeowner-files`; the blob-copy script enumerates the `proposals/` prefix only. `tpr-company-docs` is out of scope.
- **Dead-code deletion, not deprecation:** `resolveProposalMediaUrl` + its file are deleted outright — no `@deprecated` shim, no dual-shape `url`.
- **No manual `updatedAt`** anywhere (the DB backfill sets `bucket` only).
- **DOCS edits ship in the SAME PR** as the code (docs match code today; deferring the edits creates staleness).
- **`xs` via the registry:** `VARIANT_REGISTRY.project` stays `['sm','md','lg']` (portfolio bytes unchanged); `VARIANT_REGISTRY.proposal` = `['xs','sm','md','lg']`. **Never** add `xs` to `VARIANT_REGISTRY.fallback` — rows that predate variant-tracking have no `-xs.webp` object on R2, so advertising it would 404.
- **Capability only, no re-run:** do NOT build or run a re-optimize script for existing proposal images (YAGNI — new uploads get `xs`; old images fall back to `sm`).

---

## File Structure

**Variant registry + write-side optimizer (Task 1):**
- `src/shared/entities/media-files/lib/image-variants.ts` — **NEW** dependency-free leaf: `VARIANT_OPTIONS` (master array), `VARIANT_REGISTRY` (use-case → subset), derived `VARIANT_WIDTH`, `VariantSuffix` type.
- `src/shared/entities/media-files/lib/process-image-variants.ts` — consume `VARIANT_OPTIONS`; `processImageVariants(buffer, suffixes)`; delete `VARIANT_DEFS` + `SIZE_LIMITS`.
- `src/shared/lib/file-optimization/optimize-file.ts` — `optimizeFile(buffer, mime, variantSuffixes?)` pass-through.
- `src/shared/services/media/optimize-media.ts` — passes `VARIANT_REGISTRY[ownerKind]`. (`optimization-target.ts` is **not** touched — the registry is the owner→variants map.)

**Read-side derivation (Task 2):**
- `src/shared/lib/get-optimized-urls.ts` — consume `VARIANT_WIDTH` + `VARIANT_REGISTRY.fallback`; delete local `VARIANT_WIDTHS` + `ALL_VARIANTS`; new pure `deriveOriginalMediaUrl(pathKey, bucket)` export.

**Read-path flip + store flip = the atomic core (Task 3):**
- `src/shared/entities/proposal-media-files/dal/server/queries.ts` — sync + reshaped `toProposalMediaView`/`ProposalMediaView`.
- `src/shared/entities/proposal-media-files/lib/resolve-media-url.ts` — **DELETE**.
- `src/trpc/routers/projects.router/media.router.ts` — `listImportableProposalMedia` presign→derive.
- `src/shared/entities/proposals/dal/server/queries.ts` — drop `await Promise.all` at the `getFullView` media enrichment.
- `src/trpc/routers/proposals.router/media.router.ts` — drop `Promise.all` in `list`.
- `src/shared/services/media/stores.ts` — `proposalMediaStore.bucket` → `R2_BUCKETS.media`.

**Render surfaces (Task 4):**
- `src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx`
- `src/features/proposal-flow/ui/components/proposal/proposal-media-gallery.tsx`

**Migration scripts (Task 5):**
- `scripts/migrate-proposal-media-r2.ts` (new)
- `scripts/backfill-proposal-media-bucket.ts` (new)

**Guardrails (Task 6):**
- `next.config.ts`

**Docs (Task 7):**
- `src/shared/entities/proposals/DOCS.md`, `src/shared/db/schema/proposal-media-files.ts` (comment), `src/shared/components/media/types.ts` (comments), `src/shared/services/media/DOCS.md`, memory `project-proposal-media-subsystem.md`.

**Deploy coupling:** Tasks 3 + 4 (store flip, read flip, render port) form the atomic prod change — they land on one branch and deploy together; the live-cutover order (blob-copy → deploy → backfill → delta re-copy) is USER-run per the runbook in Task 5.

---

## Task 1: Variant registry (master + registry) + write-side wiring

**Files:**
- Create: `src/shared/entities/media-files/lib/image-variants.ts`
- Modify: `src/shared/entities/media-files/lib/process-image-variants.ts`
- Modify: `src/shared/lib/file-optimization/optimize-file.ts`
- Modify: `src/shared/services/media/optimize-media.ts`

**Interfaces:**
- Produces (all from `image-variants.ts`):
  - `interface VariantOption { suffix: string, width: number, maxBytes: number }`
  - `const VARIANT_OPTIONS` — the master array (`xs`/`sm`/`md`/`lg`), `as const satisfies readonly VariantOption[]`.
  - `type VariantSuffix = (typeof VARIANT_OPTIONS)[number]['suffix']`
  - `const VARIANT_REGISTRY` — use-case → subset, `satisfies Record<string, readonly VariantSuffix[]>`, keys `project | proposal | fallback`.
  - `const VARIANT_WIDTH: Record<string, number>` — derived suffix→width.
  - `processImageVariants(buffer: Buffer, suffixes?: readonly string[]): Promise<ProcessImageResult>` (was `(buffer)`).
  - `optimizeFile(buffer, mimeType, variantSuffixes?: readonly string[]): Promise<FileOptimizationResult>`.
- Consumes: nothing from other tasks. `optimization-target.ts` is **not** modified.

- [ ] **Step 1: Create the two root config objects (dependency-free leaf).**

Create `src/shared/entities/media-files/lib/image-variants.ts`. It imports **nothing** — this is what lets both the client-bundled read side (`get-optimized-urls.ts`) and the `sharp`-importing write side (`process-image-variants.ts`) share it without leaking `sharp` into the client bundle.

```ts
// src/shared/entities/media-files/lib/image-variants.ts

/**
 * Single source of truth for responsive image variants. Dependency-free leaf ON
 * PURPOSE: the client read side (get-optimized-urls.ts) and the server write side
 * (process-image-variants.ts, which imports sharp) BOTH import this — keeping it
 * free of sharp / server-only code is what lets one definition serve both.
 */
export interface VariantOption {
  /** filename suffix + the value stored in `optimizationVariants` */
  suffix: string
  /** target resize width in px; also the srcSet `w` descriptor */
  width: number
  /** output budget; over it the write side re-encodes at lower quality */
  maxBytes: number
}

/**
 * MASTER — every variant the system can produce. The ONLY place a width/budget
 * is declared. Ordered ascending by width. Add a variant = one line here.
 */
export const VARIANT_OPTIONS = [
  { suffix: 'xs', width: 320, maxBytes: 40 * 1024 },
  { suffix: 'sm', width: 640, maxBytes: 80 * 1024 },
  { suffix: 'md', width: 1280, maxBytes: 200 * 1024 },
  { suffix: 'lg', width: 1920, maxBytes: 350 * 1024 },
] as const satisfies readonly VariantOption[]

export type VariantSuffix = (typeof VARIANT_OPTIONS)[number]['suffix']

/**
 * REGISTRY — which subset of the master each use-case gets. Extensible: a new
 * use-case is one line. `as const satisfies` makes the compiler reject a suffix
 * that isn't in VARIANT_OPTIONS, so the two can never drift.
 *
 * - `project`  / `proposal`: the owner the optimizer runs for (write-time selection).
 * - `fallback`: assumed for a row whose `optimizationVariants` was never recorded
 *   (predates variant tracking). FROZEN — must stay a subset of what those old
 *   objects physically have on R2; NEVER add a newer suffix (e.g. `xs`) here or
 *   legacy images would request a `-xs.webp` that doesn't exist (404).
 */
export const VARIANT_REGISTRY = {
  project: ['sm', 'md', 'lg'],
  proposal: ['xs', 'sm', 'md', 'lg'],
  fallback: ['sm', 'md', 'lg'],
} as const satisfies Record<string, readonly VariantSuffix[]>

/** Derived suffix → width lookup. Nobody ever re-declares a width. */
export const VARIANT_WIDTH: Record<string, number>
  = Object.fromEntries(VARIANT_OPTIONS.map(v => [v.suffix, v.width]))
```

- [ ] **Step 2: Rewire the sharp write side to consume the master array.**

In `src/shared/entities/media-files/lib/process-image-variants.ts`, delete the `VARIANT_DEFS` block (lines ~27-32) and the `SIZE_LIMITS` block (lines ~34-39), and add the import:

```ts
import { VARIANT_OPTIONS } from './image-variants'
```

Change the function signature to accept a suffix selection (default = all master suffixes, so any incidental caller still works), and build the working `defs` from the master filtered by the selection:

```ts
export async function processImageVariants(
  originalBuffer: Buffer,
  suffixes: readonly string[] = VARIANT_OPTIONS.map(v => v.suffix),
): Promise<ProcessImageResult> {
```

Immediately after the existing `const decisions` / `const variants` locals are set up, add:

```ts
  const defs = VARIANT_OPTIONS.filter(v => suffixes.includes(v.suffix))
```

Then update both loops. In the tiny-image branch, replace `for (const def of VARIANT_DEFS) {` with `for (const def of defs) {` (body unchanged — it already reads `def.suffix` / `def.width`). In the `else` branch, replace `for (const def of VARIANT_DEFS) {` with `for (const def of defs) {`, and replace the size-budget lookup:

```ts
      // was: const sizeLimit = SIZE_LIMITS[def.suffix]
      const sizeLimit = def.maxBytes
```

`def.maxBytes` is always defined (master-guaranteed), so the existing `if (sizeLimit && …)` and `sizeLimit ?? Infinity` guards keep working unchanged. Everything else in the file (`resizeWithBudget`, thresholds, blur) is untouched.

- [ ] **Step 3: Add a variant-selection pass-through to `optimizeFile`.**

In `src/shared/lib/file-optimization/optimize-file.ts`, change the signature and the image case (the import of `processImageVariants` stays as-is):

```ts
export async function optimizeFile(
  buffer: Buffer,
  mimeType: string,
  variantSuffixes?: readonly string[],
): Promise<FileOptimizationResult> {
  const kind = classifyFileKind(mimeType)

  switch (kind) {
    case 'image': {
      const { variants, blurDataUrl, variantSuffixes: produced } = await processImageVariants(buffer, variantSuffixes)
      return { kind, variants, variantSuffixes: produced, blurDataUrl, pageCount: null, skipped: false }
    }
```

(`pdf`, `video`, `other` cases unchanged. When `variantSuffixes` is undefined, `processImageVariants`'s default kicks in — all master suffixes.)

- [ ] **Step 4: Select the owner's set from the registry at dispatch.**

In `src/shared/services/media/optimize-media.ts`, add the import:

```ts
import { VARIANT_REGISTRY } from '@/shared/entities/media-files/lib/image-variants'
```

`optimizeMediaFile` already has `ownerKind` in scope (`{ ownerKind, mediaId }`), and `ownerKind` is `'project' | 'proposal'` — both keys of `VARIANT_REGISTRY`. Change:

```ts
    const result = await optimizeFile(originalBuffer, file.mimeType)
```

to:

```ts
    const result = await optimizeFile(originalBuffer, file.mimeType, VARIANT_REGISTRY[ownerKind])
```

(No change to `optimization-target.ts` — the registry is the owner→variants map.)

- [ ] **Step 5: Verify types + lint.**

Run: `pnpm tsc && pnpm lint`
Expected: exit 0. Confirm the old constants are gone and nothing else referenced them: `grep -rn "VARIANT_DEFS\|SIZE_LIMITS" src` returns nothing. Confirm `processImageVariants`'s only real caller is `optimize-file.ts`: `grep -rn "processImageVariants(" src`.

- [ ] **Step 6: Commit.**

```bash
git add src/shared/entities/media-files/lib/image-variants.ts src/shared/entities/media-files/lib/process-image-variants.ts src/shared/lib/file-optimization/optimize-file.ts src/shared/services/media/optimize-media.ts
git commit -m "feat(media): variant registry (master options + per-use-case sets); add xs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Read side consumes the registry + shared original-URL derivation

**Files:**
- Modify: `src/shared/lib/get-optimized-urls.ts`

**Interfaces:**
- Consumes (from Task 1): `VARIANT_WIDTH`, `VARIANT_REGISTRY` from `@/shared/entities/media-files/lib/image-variants`.
- Produces: `deriveOriginalMediaUrl(pathKey: string | null, bucket: string | null): string` (exported) — the original-object public URL, `''` when no `pathKey`. (`xs` support is automatic — the srcSet builder derives widths from `VARIANT_WIDTH`, which already includes `xs`.)

- [ ] **Step 1: Replace the local width map + legacy constant with registry imports.**

In `src/shared/lib/get-optimized-urls.ts`, delete both local declarations:

```ts
const VARIANT_WIDTHS: Record<string, number> = {
  sm: 640,
  md: 1280,
  lg: 1920,
}

/** Legacy records optimized before variant tracking was added — assume all 3 exist */
const ALL_VARIANTS = ['sm', 'md', 'lg']
```

Add the import at the top of the file (next to the existing `R2_PUBLIC_DOMAINS` import):

```ts
import { VARIANT_REGISTRY, VARIANT_WIDTH } from '@/shared/entities/media-files/lib/image-variants'
```

- [ ] **Step 2: Point `resolveVariants` at the registry's `fallback`, and every width lookup at `VARIANT_WIDTH`.**

In `resolveVariants`, change the null branch:

```ts
function resolveVariants(file: MediaFileInput): string[] {
  // null/undefined = a row that predates variant tracking → assume the frozen
  // fallback set. [] = explicitly no variants (blur-only / tiny image).
  if (file.optimizationVariants == null) {
    return [...VARIANT_REGISTRY.fallback]
  }
  return file.optimizationVariants
}
```

Replace every remaining reference to the deleted `VARIANT_WIDTHS` with `VARIANT_WIDTH`:
- in `getOptimizedSrcSet`, the `.filter(s => VARIANT_WIDTHS[s])` and `.map(s => \`${domain}/${base}-${s}.webp ${VARIANT_WIDTHS[s]}w\`)` lines → `VARIANT_WIDTH`.
- the `Math.max(...variants.map(s => VARIANT_WIDTHS[s] ?? 0))` line → `VARIANT_WIDTH`.

(A proposal row whose `optimizationVariants` includes `'xs'` now emits `…-xs.webp 320w` automatically — no other read-side edit.)

- [ ] **Step 3: Export a shared original-URL deriver (DRYs the mapper + picker in Task 3).**

Add this exported function near the top of the file, right after `DEFAULT_R2_DOMAIN`:

```ts
/**
 * The public URL of a media object's ORIGINAL (un-suffixed) R2 key — the
 * fallback `src` for non-optimized rows and the value proposal read
 * projections carry as `url` (proposal media has no `url` column; it is
 * JIT-derived). Derives the CDN domain from the row's own bucket, so a
 * not-yet-backfilled row still resolves to the media domain. Returns '' when
 * the row has no R2 object (e.g. a 'stream'-provider row).
 */
export function deriveOriginalMediaUrl(pathKey: string | null, bucket: string | null): string {
  if (!pathKey)
    return ''
  const domain = (bucket && R2_PUBLIC_DOMAINS[bucket as keyof typeof R2_PUBLIC_DOMAINS]) || DEFAULT_R2_DOMAIN
  return `${domain}/${pathKey}`
}
```

- [ ] **Step 4: Verify types + lint.**

Run: `pnpm tsc && pnpm lint`
Expected: exit 0. Confirm the old local constants are gone: `grep -rn "VARIANT_WIDTHS\|ALL_VARIANTS" src` returns nothing.

- [ ] **Step 5: Commit.**

```bash
git add src/shared/lib/get-optimized-urls.ts
git commit -m "feat(media): read side consumes variant registry; export deriveOriginalMediaUrl

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Atomic core flip — public reads + store bucket

**Files:**
- Modify: `src/shared/entities/proposal-media-files/dal/server/queries.ts`
- Delete: `src/shared/entities/proposal-media-files/lib/resolve-media-url.ts`
- Modify: `src/trpc/routers/projects.router/media.router.ts:126-163` (`listImportableProposalMedia`)
- Modify: `src/shared/entities/proposals/dal/server/queries.ts:156` (getFullView media enrichment)
- Modify: `src/trpc/routers/proposals.router/media.router.ts:60` (`list`)
- Modify: `src/shared/services/media/stores.ts:30` (`proposalMediaStore.bucket`)

**Interfaces:**
- Consumes (from Task 2): `deriveOriginalMediaUrl(pathKey, bucket)` and `getOptimizedSrc` from `@/shared/lib/get-optimized-urls`.
- Produces: reshaped `interface ProposalMediaView` with `url: string`, `pathKey: string | null`, `bucket: string | null`, `optimizationVariants: string[] | null` (consumed by Task 4). `toProposalMediaView` is now **synchronous**: `(row: ProposalMediaFile) => ProposalMediaView`.

- [ ] **Step 1: Reshape `ProposalMediaView` and make the mapper synchronous + derived.**

In `src/shared/entities/proposal-media-files/dal/server/queries.ts`, replace the `resolveProposalMediaUrl` import:

```ts
import { deriveOriginalMediaUrl } from '@/shared/lib/get-optimized-urls'
```

Replace the `ProposalMediaView` interface and `toProposalMediaView` with:

```ts
/**
 * Homeowner-facing projection of a proposal media file. Public canonical bucket
 * (`tpr-media`): `url` is the JIT-derived original-object URL and `pathKey`/
 * `bucket`/`optimizationVariants` let the client derive responsive src/srcSet
 * via `get-optimized-urls`. No presigning; no `url` column on the table.
 */
export interface ProposalMediaView {
  id: number
  name: string
  mimeType: string
  visibility: ProposalMediaVisibility
  url: string
  pathKey: string | null
  bucket: string | null
  optimizationStatus: string
  optimizationVariants: string[] | null
  blurDataUrl: string | null
  sortOrder: number
  duration: number | null
  pageCount: number | null
}

/** Map a raw row to the public view (sync — the URL is derived, not presigned). */
export function toProposalMediaView(row: ProposalMediaFile): ProposalMediaView {
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mimeType,
    visibility: row.visibility,
    url: deriveOriginalMediaUrl(row.pathKey, row.bucket),
    pathKey: row.pathKey,
    bucket: row.bucket,
    optimizationStatus: row.optimizationStatus,
    optimizationVariants: row.optimizationVariants,
    blurDataUrl: row.blurDataUrl,
    sortOrder: row.sortOrder,
    duration: row.duration,
    pageCount: row.pageCount,
  }
}
```

- [ ] **Step 2: Delete the presigner.**

```bash
git rm src/shared/entities/proposal-media-files/lib/resolve-media-url.ts
```

Confirm no other importer survives: `grep -rn "resolve-media-url\|resolveProposalMediaUrl" src` must return **nothing** after Steps 3–4.

- [ ] **Step 3: Drop the `await` at the two mapper call sites.**

In `src/shared/entities/proposals/dal/server/queries.ts`, change:

```ts
    const media = await Promise.all(mediaRows.map(toProposalMediaView))
```

to:

```ts
    const media = mediaRows.map(toProposalMediaView)
```

Also update the comment above it (currently "presigned at this read choke point") to "derived at this read choke point (public bucket)".

In `src/trpc/routers/proposals.router/media.router.ts`, change the `list` return:

```ts
        return rows.map(toProposalMediaView)
```

- [ ] **Step 4: Swap the import picker from presign to derive.**

In `src/trpc/routers/projects.router/media.router.ts`, remove the `resolveProposalMediaUrl` import (line ~9) and add:

```ts
import { getOptimizedSrc } from '@/shared/lib/get-optimized-urls'
```

In `listImportableProposalMedia`, add `bucket` to the select:

```ts
        .select({
          id: proposalMediaFiles.id,
          proposalId: proposalMediaFiles.proposalId,
          proposalLabel: proposals.label,
          name: proposalMediaFiles.name,
          mimeType: proposalMediaFiles.mimeType,
          pathKey: proposalMediaFiles.pathKey,
          bucket: proposalMediaFiles.bucket,
          optimizationStatus: proposalMediaFiles.optimizationStatus,
          optimizationVariants: proposalMediaFiles.optimizationVariants,
        })
```

Replace the presign block:

```ts
      // Presign each (private bucket) for the picker preview.
      const withUrl = await Promise.all(rows.map(async r => ({
        id: r.id,
        proposalId: r.proposalId,
        proposalLabel: r.proposalLabel,
        name: r.name,
        mimeType: r.mimeType,
        url: await resolveProposalMediaUrl(r),
      })))
```

with a synchronous derive (public bucket — `getOptimizedSrc` builds the best variant URL, falling back to the derived original):

```ts
      // Public bucket — derive the best display URL (variant or original) for
      // the picker preview. No presigning.
      const withUrl = rows.map(r => ({
        id: r.id,
        proposalId: r.proposalId,
        proposalLabel: r.proposalLabel,
        name: r.name,
        mimeType: r.mimeType,
        url: getOptimizedSrc({
          url: deriveOriginalMediaUrl(r.pathKey, r.bucket),
          pathKey: r.pathKey,
          bucket: r.bucket,
          optimizationStatus: r.optimizationStatus,
          optimizationVariants: r.optimizationVariants,
        }),
      }))
```

Add `deriveOriginalMediaUrl` to the same `get-optimized-urls` import:

```ts
import { deriveOriginalMediaUrl, getOptimizedSrc } from '@/shared/lib/get-optimized-urls'
```

- [ ] **Step 5: Flip the store bucket.**

In `src/shared/services/media/stores.ts`, in `proposalMediaStore`, change:

```ts
  bucket: R2_BUCKETS.homeownerFiles,
```

to:

```ts
  bucket: R2_BUCKETS.media,
```

- [ ] **Step 6: Verify types + lint.**

Run: `pnpm tsc && pnpm lint`
Expected: exit 0. `grep -rn "resolveProposalMediaUrl\|resolve-media-url" src` returns nothing. `importFromProposal` is unchanged (already reads `src.bucket`; it now copies `tpr-media → tpr-media`).

- [ ] **Step 7: Commit.**

```bash
git add src/shared/entities/proposal-media-files/dal/server/queries.ts src/trpc/routers/projects.router/media.router.ts src/shared/entities/proposals/dal/server/queries.ts src/trpc/routers/proposals.router/media.router.ts src/shared/services/media/stores.ts
git commit -m "feat(proposals): serve proposal media public — derive URLs, delete presigner, store on tpr-media

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Port render surfaces to `OptimizedImage`

**Files:**
- Modify: `src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx`
- Modify: `src/features/proposal-flow/ui/components/proposal/proposal-media-gallery.tsx`

**Interfaces:**
- Consumes (from Task 3): each row now carries `pathKey`, `bucket`, `optimizationVariants`, `blurDataUrl`, `optimizationStatus`, `url` — exactly the `OptimizedImage.file` shape (`src/shared/components/media/optimized-image.tsx`).

- [ ] **Step 1: Manager — render image thumbnails via `OptimizedImage`.**

In `src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx`, add the import:

```ts
import { OptimizedImage } from '@/shared/components/media/optimized-image'
```

Replace the `renderThumbnail` image branch. Change:

```tsx
        renderThumbnail={(item) => {
          if (item.mimeType.startsWith('image/')) {
            return <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
          }
```

to (reach into `viewById` for the full row `OptimizedImage` needs):

```tsx
        renderThumbnail={(item) => {
          const row = viewById.get(item.id)
          if (item.mimeType.startsWith('image/') && row) {
            return <OptimizedImage file={row} alt={item.name} sizes="(max-width: 768px) 45vw, 220px" />
          }
```

(The `video` and pdf-placeholder branches are unchanged; `video` keeps `item.url`, now the public object URL.)

- [ ] **Step 2: Gallery — render images via `OptimizedImage`, keep video/pdf on the derived URL.**

In `src/features/proposal-flow/ui/components/proposal/proposal-media-gallery.tsx`, add:

```ts
import { OptimizedImage } from '@/shared/components/media/optimized-image'
```

Replace the visual-item image branch. Change:

```tsx
                {item.mimeType.startsWith('video/')
                  ? (
                      <video
                        src={item.url ?? undefined}
                        className="h-full w-full object-cover"
                        controls
                        playsInline
                        preload="metadata"
                      />
                    )
                  : (
                      <img
                        src={item.url ?? undefined}
                        alt={item.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    )}
```

to:

```tsx
                {item.mimeType.startsWith('video/')
                  ? (
                      <video
                        src={item.url}
                        className="h-full w-full object-cover"
                        controls
                        playsInline
                        preload="metadata"
                      />
                    )
                  : (
                      <OptimizedImage
                        file={item}
                        alt={item.name}
                        fill
                        sizes="(max-width: 768px) 45vw, 220px"
                      />
                    )}
```

Also fix the stale comment at the top of the file (`… already homeowner-visibility-only + presigned`) → `… already homeowner-visibility-only + public-derived (from getFullView)`.

- [ ] **Step 3: Verify types + lint.**

Run: `pnpm tsc && pnpm lint`
Expected: exit 0. (`item`/`row` supplies the full `OptimizedImage.file` shape; `pdfs` block and download links are untouched — `item.url` is now the public pdf URL.)

- [ ] **Step 4: Commit.**

```bash
git add src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx src/features/proposal-flow/ui/components/proposal/proposal-media-gallery.tsx
git commit -m "feat(proposals): render proposal media via OptimizedImage (responsive srcSet)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Migration scripts (blob copy + DB backfill)

**Files:**
- Create: `scripts/migrate-proposal-media-r2.ts`
- Create: `scripts/backfill-proposal-media-bucket.ts`

**Interfaces:** standalone scripts; no code imports them. They mirror `scripts/migrate-r2-bucket.ts` and `scripts/backfill-media-bucket.ts`.

- [ ] **Step 1: Write the blob-copy script (proposals/ prefix only).**

Create `scripts/migrate-proposal-media-r2.ts`:

```ts
/**
 * One-time R2 migration: copy every `proposals/*` object from the private
 * `tpr-homeowner-files` bucket into the canonical public `tpr-media` bucket,
 * preserving keys (originals + -xs/-sm/-md/-lg.webp variants). Server-side
 * CopyObject — bytes never transit this process. Idempotent — re-copying
 * overwrites, so it is safe to run repeatedly as a delta sync.
 *
 * Scoped to the `proposals/` prefix ONLY: `recordings/*` (call recordings) stay
 * private in tpr-homeowner-files and must never be copied.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-proposal-media-r2.ts --dry-run   # list source objects, copy nothing
 *   pnpm tsx scripts/migrate-proposal-media-r2.ts             # copy all proposals/* objects
 */

import './lib/load-env'

import { r2Client } from '../src/shared/services/providers/r2/client'
import { R2_BUCKETS } from '../src/shared/services/providers/r2/types'

// eslint-disable-next-line node/prefer-global/process
const DRY_RUN = process.argv.includes('--dry-run')

const SOURCE = R2_BUCKETS.homeownerFiles
const DEST = R2_BUCKETS.media
const PREFIX = 'proposals/'
const CONCURRENCY = 20

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++
      await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

async function main(): Promise<void> {
  console.warn(`[migrate-proposal-media] ${SOURCE}/${PREFIX} → ${DEST}${DRY_RUN ? ' (dry-run)' : ''}`)

  const keys = await r2Client.listAllKeys(SOURCE, PREFIX)
  console.warn(`[migrate-proposal-media] source has ${keys.length} objects under ${PREFIX}`)

  // Safety: never touch anything outside the proposals/ prefix.
  const stray = keys.filter(k => !k.startsWith(PREFIX))
  if (stray.length > 0) {
    console.error(`[migrate-proposal-media] ABORT — ${stray.length} keys outside ${PREFIX} (e.g. ${stray[0]})`)
    // eslint-disable-next-line node/prefer-global/process
    process.exit(1)
  }

  if (DRY_RUN) {
    for (const key of keys.slice(0, 5)) {
      console.warn(`  sample: ${key}`)
    }
    console.warn('[migrate-proposal-media] dry-run — no objects copied')
    return
  }

  let copied = 0
  await mapLimit(keys, CONCURRENCY, async (key) => {
    await r2Client.copyObject({ sourceBucket: SOURCE, sourceKey: key, destBucket: DEST, destKey: key })
    copied++
    if (copied % 100 === 0) {
      console.warn(`[migrate-proposal-media] copied ${copied}/${keys.length}`)
    }
  })

  const destKeys = await r2Client.listAllKeys(DEST, PREFIX)
  console.warn(`[migrate-proposal-media] done — copied ${copied}; dest now has ${destKeys.length} objects under ${PREFIX} (source had ${keys.length})`)
}

main().catch((err) => {
  console.error(err)
  // eslint-disable-next-line node/prefer-global/process
  process.exit(1)
})
```

- [ ] **Step 2: Dry-run the blob-copy script against real R2.**

Run: `pnpm tsx scripts/migrate-proposal-media-r2.ts --dry-run`
Expected: prints a `proposals/…` object count and up to 5 sample keys, all under `proposals/`; copies nothing. If it aborts on a stray key, stop and investigate — do not proceed.

- [ ] **Step 3: Write the DB backfill script.**

Create `scripts/backfill-proposal-media-bucket.ts`:

```ts
/**
 * One-time backfill: repoint proposal media rows from the private
 * `tpr-homeowner-files` bucket to the canonical public `tpr-media`. Proposal
 * media has no `url` column — render URLs are JIT-derived from `bucket`+
 * `pathKey` (get-optimized-urls), so moving `bucket` is what makes derivation
 * accurate. Sets `bucket` only (never `updatedAt` — `.$onUpdate()` owns it).
 *
 * Only touches `proposal_media_files`. Call recordings live under a different
 * table/prefix and are untouched.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-proposal-media-bucket.ts                     # dev DB (default)
 *   DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-proposal-media-bucket.ts # prod DB
 *   … --dry-run   # report affected rows, change nothing
 *
 * DB target follows the environment-axes convention (unset never means prod):
 * see docs/codebase-conventions/environment.md#environment-axes
 * Safe to re-run: the WHERE clause only matches rows still on the old bucket.
 */

import './lib/load-env'

import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

import { R2_BUCKETS } from '../src/shared/services/providers/r2/types'

// eslint-disable-next-line node/prefer-global/process
const DRY_RUN = process.argv.includes('--dry-run')

const OLD_BUCKET = 'tpr-homeowner-files'
const NEW_BUCKET = R2_BUCKETS.media // 'tpr-media'

// eslint-disable-next-line node/prefer-global/process
const IS_PROD_TARGET = process.env.DRIZZLE_TARGET === 'prod'
// eslint-disable-next-line node/prefer-global/process
const DATABASE_URL = IS_PROD_TARGET ? process.env.DATABASE_URL : process.env.DATABASE_DEV_URL
if (!DATABASE_URL) {
  console.error(`No database URL for target "${IS_PROD_TARGET ? 'prod' : 'dev'}" — check .env`)
  // eslint-disable-next-line node/prefer-global/process
  process.exit(1)
}
console.warn(`[backfill-proposal-media-bucket] target=${IS_PROD_TARGET ? 'prod' : 'dev'} host=${new URL(DATABASE_URL).host}`)
console.warn(`[backfill-proposal-media-bucket] ${OLD_BUCKET} → ${NEW_BUCKET}${DRY_RUN ? ' (dry-run)' : ''}`)

const pool = new pg.Pool({ connectionString: DATABASE_URL })
const db = drizzle(pool)

async function main(): Promise<void> {
  const [counts] = (await db.execute(sql`
    SELECT count(*) AS n FROM proposal_media_files WHERE bucket = ${OLD_BUCKET}
  `)).rows
  console.warn(`[backfill-proposal-media-bucket] rows on old bucket: ${counts.n}`)

  if (DRY_RUN) {
    console.warn('[backfill-proposal-media-bucket] dry-run — no changes made')
    return
  }

  const result = await db.execute(sql`
    UPDATE proposal_media_files SET bucket = ${NEW_BUCKET} WHERE bucket = ${OLD_BUCKET}
  `)
  console.warn(`[backfill-proposal-media-bucket] updated ${result.rowCount} rows`)

  const [remaining] = (await db.execute(sql`
    SELECT count(*) AS n FROM proposal_media_files WHERE bucket = ${OLD_BUCKET}
  `)).rows
  console.warn(`[backfill-proposal-media-bucket] rows still on old bucket: ${remaining.n}`)
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err)
    return pool.end().then(() => {
      // eslint-disable-next-line node/prefer-global/process
      process.exit(1)
    })
  })
```

- [ ] **Step 4: Dry-run the backfill against the dev DB.**

Run: `pnpm tsx scripts/backfill-proposal-media-bucket.ts --dry-run`
Expected: prints `target=dev`, the dev host, and a row count on the old bucket; changes nothing.

- [ ] **Step 5: Verify types + lint.**

Run: `pnpm tsc && pnpm lint`
Expected: exit 0.

- [ ] **Step 6: Commit.**

```bash
git add scripts/migrate-proposal-media-r2.ts scripts/backfill-proposal-media-bucket.ts
git commit -m "chore(scripts): proposal-media R2 copy + bucket backfill (proposals/ prefix only)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

**Live cutover is USER-run** (do not run outside `--dry-run` during implementation). Order, once the branch is merged and ready to deploy:
1. `pnpm tsx scripts/migrate-proposal-media-r2.ts` (copy-first; re-runnable).
2. Reconcile: source count (`proposals/`) vs dest count printed by the script.
3. Deploy the branch to prod (Tasks 1–4). Then `pnpm tsx scripts/backfill-proposal-media-bucket.ts` (dev, already done in Step 4 pre-merge if desired) → `DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-proposal-media-bucket.ts`.
4. `pnpm tsx scripts/migrate-proposal-media-r2.ts` again (delta — catches uploads during the window).
5. Verify a fresh proposal upload round-trips to `tpr-media`.
6. Safety window, then delete `proposals/*` from `tpr-homeowner-files` (recordings + bucket stay).

---

## Task 6: Guardrail — `noindex` on the homeowner proposal page (route metadata)

**Files:**
- Modify: `src/app/(frontend)/proposal-flow/proposal/[proposalId]/page.tsx`

**Interfaces:** none. **Does NOT touch `next.config.ts`.**

**Why:** the homeowner proposal page is reachable by anyone holding the unguessable share link (it is *not* login-gated) and renders property photos + pricing. The public-bucket security model rests on "unguessable URL = capability URL"; the main real-world way such URLs get de-cloaked is a leaked link being crawled and indexed. `noindex` is the standard, cheap mitigation. `Referrer-Policy` is **deliberately omitted** — modern browsers already default to `strict-origin-when-cross-origin`, so an explicit header adds no meaningful protection and isn't worth a config touch.

- [ ] **Step 1: Add a `metadata` export to the proposal page.**

In `src/app/(frontend)/proposal-flow/proposal/[proposalId]/page.tsx` (which currently has no `metadata`/`generateMetadata` export), add a `Metadata` import and a static `metadata` export above the default component:

```ts
import type { Metadata } from 'next'
```

```ts
// Homeowner proposal view renders property photos + pricing behind an
// unguessable share URL. Keep it out of search indexes (the capability-URL
// model's main leak vector). Referrer-Policy is left to the browser default
// (strict-origin-when-cross-origin), so no next.config change is needed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}
```

- [ ] **Step 2: Verify types + lint.**

Run: `pnpm tsc && pnpm lint`
Expected: exit 0.

- [ ] **Step 3: Commit.**

```bash
git add "src/app/(frontend)/proposal-flow/proposal/[proposalId]/page.tsx"
git commit -m "feat(proposals): noindex the homeowner proposal page (route metadata)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Docs + memory (same PR)

**Files:**
- Modify: `src/shared/entities/proposals/DOCS.md` (`#proposal-media` section)
- Modify: `src/shared/db/schema/proposal-media-files.ts:13` (doc-comment)
- Modify: `src/shared/components/media/types.ts:8,31,35` (comments)
- Modify: `src/shared/services/media/DOCS.md` (stores table + any presign phrasing)
- Modify: `/home/olis-solutions/.claude/projects/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/memory/project-proposal-media-subsystem.md`

**Interfaces:** none (documentation).

- [ ] **Step 1: Rewrite `proposals/DOCS.md#proposal-media` to the public model.**

Read `src/shared/entities/proposals/DOCS.md` around lines 360–406. Make these edits (preserve the `#proposal-media` slug and surrounding structure):
- The bullet beginning **"Private + presigned-only"** (~:363): rewrite to describe the **public canonical bucket** `tpr-media` (`R2_BUCKETS.media`), **still no `url` column** — the public URL is **JIT-derived** (`domain/pathKey`, `deriveOriginalMediaUrl`) in `toProposalMediaView`, and the client derives responsive `src`/`srcSet` via `get-optimized-urls`. Keep the "no `url` column" decision, reframed as JIT-derivation (not presigning).
- The getFullView line (~:365) mentioning "presigned per-row via `toProposalMediaView`": change to "derived per-row (sync) via `toProposalMediaView`".
- The **Why** (~:368) that currently justifies "Private-bucket + presigned-only … time-boxed, never a permanent public URL": rewrite to the unguessable-public-URL/capability-URL rationale (see the epic spec §"Decision: serve proposal media public").
- The **Reference impl** (~:369): drop the `URL resolution … resolve-media-url.ts` entry (file deleted).
- The anti-pattern (~:386-387) "**Adding a `url` column … or caching a presigned URL** … resolved fresh via `resolveProposalMediaUrl`": rewrite — the new anti-pattern is "adding a stored `url` column or a presigned read path; the public URL is JIT-derived."
- Update **Last updated** (~:406).

- [ ] **Step 2: Fix the schema doc-comment.**

In `src/shared/db/schema/proposal-media-files.ts`, change line 13:

```ts
/** Proposal-owned files; private bucket, presigned-only access (no `url` column); lock-exempt. */
```

to:

```ts
/** Proposal-owned files; public canonical bucket (tpr-media), JIT-derived URL (no `url` column); lock-exempt. */
```

- [ ] **Step 3: Fix the shared `MediaItem` comments.**

In `src/shared/components/media/types.ts`:
- Line ~8 (`url` field doc): change `proposal: presigned` → `proposal: public variant/original (derived)`.
- Line ~31 (`renderThumbnail` doc): change `proposal: presigned img/video/pdf` → `proposal: OptimizedImage / public video+pdf`.
- Line ~35 (`renderPreview` doc): change `proposal: presigned img/video/pdf` → `proposal: OptimizedImage / public video+pdf`.

- [ ] **Step 4: Fix `services/media/DOCS.md`.**

In `src/shared/services/media/DOCS.md`, in the stores table (~:51) change the `proposalMediaStore` bucket cell `tpr-homeowner-files (private)` → `tpr-media (public)`. Scan the file for any remaining "proposal … presigned" phrasing and align it to the public model (the `:158` guard about `provider: 'stream'` rows is about missing R2 objects, not presigning — leave it).

- [ ] **Step 5: Update memory.**

Edit `memory/project-proposal-media-subsystem.md` to record: proposal media cut over to the **public `tpr-media`** bucket (Sub-plan 2); presigning (`resolveProposalMediaUrl`) deleted; reads JIT-derived; `xs` variant added for proposals; render surfaces on `OptimizedImage`. Note the live cutover (blob-copy + prod backfill + `proposals/*` decommission) as USER-run.

- [ ] **Step 6: Verify + commit.**

Run: `pnpm tsc && pnpm lint` (docs-only, but confirm the schema/types comment edits didn't break anything).
Expected: exit 0.

```bash
git add src/shared/entities/proposals/DOCS.md src/shared/db/schema/proposal-media-files.ts src/shared/components/media/types.ts src/shared/services/media/DOCS.md
git commit -m "docs(proposals): proposal media is public (tpr-media, JIT-derived) — retire presigned framing

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

(The memory file lives outside the repo — no `git add` needed.)

---

## Final verification (before opening the PR / handoff)

Run the full gate and the manual browser parity checks from the spec §9:

- [ ] `pnpm tsc && pnpm lint` clean on the whole branch.
- [ ] `grep -rn "resolveProposalMediaUrl\|resolve-media-url\|ALL_VARIANTS\|VARIANT_WIDTHS\|VARIANT_DEFS\|SIZE_LIMITS" src` returns nothing (all replaced by the `image-variants.ts` registry).
- [ ] **Dev browser (Network panel):** proposal manager grid tile pulls `-xs`/`-sm.webp` (not `-lg`/original); homeowner gallery images render (public URLs) and video/pdf still work; import picker thumbnails render (including a non-optimized row).
- [ ] Fresh proposal image upload (dev) round-trips: PUT to `tpr-media`, optimization job produces `-xs/-sm/-md/-lg.webp`, tile renders.
- [ ] **Portfolio regression:** a project gallery still renders correctly (project variant set unchanged — `sm/md/lg`).
- [ ] Produce the USER cutover runbook (Task 5's live-cutover list) for the operator.
