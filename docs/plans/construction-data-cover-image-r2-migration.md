# Construction Data — Cover Image R2 Migration (gap addendum)

> **Status**: Open gap on EPIC #195 / ADR-0003 (#196). Discovered 2026-06-02 while diagnosing meeting-flow Step 2 perf regression.
>
> **Owners**: backend slice → TBD; frontend slice → TBD.
>
> **Tracking issues**: #243 (backend) + #244 (frontend).

## TL;DR

EPIC #195 Phase 3 currently scopes the Notion import as **"text/heading/hr only — no media in source."** That phrasing is correct for SOW prose but **omits cover images** on trades and scopes (`Trade.coverImageUrl`, `ScopeOrAddon.coverImageUrl`). Those fields are populated from Notion's `page.cover.external.url`, which today resolves to **uncontrolled external URLs** (Unsplash full-res 1–3.5 MB, Pixabay, arbitrary blog images).

Without a cover-image migration step, after cutover (#205) the construction data lives in-house but the **frontend still hammers external CDNs for every card render** — defeating part of the "drop third-party dependency" goal of the EPIC.

The fix is to migrate cover images into the canonical R2 + `mediaFiles` pipeline already used by portfolio/project surfaces, then switch consumers to `<OptimizedImage>`. This addendum captures the gap, the canonical pattern, and the migration recipe so the EPIC can absorb it without re-scoping.

---

## Evidence — meeting-flow Step 2 perf bug

URL pattern: `/dashboard/meetings/[id]?step=2` (the "Which Specialties Matter to You" page).

DevTools Network panel on a real meeting (verified 2026-06-02):

- **73 requests, 11.9 MB resources, 10.4 MB over the wire, 1.16 s Load**
- Worst offenders (all Unsplash full-res, no resize params):
  - `photo-1549448046-…?ixlib=rb-1.2.1&q=80` — **3.5 MB**
  - `photo-1600607688066-…?ixlib=rb-4.0.3&q=85` — **2.8 MB**
  - `_mg_4410_1600x1000.jpg?width=800&height=800&quality=100` — **1.3 MB**
- Card-render sites — both emit raw `<img>` with no srcSet/sizes/dims:
  - [`src/features/meeting-flow/ui/components/steps/trade-card.tsx:58-68`](../../src/features/meeting-flow/ui/components/steps/trade-card.tsx#L58-L68)
  - [`src/features/meeting-flow/ui/components/steps/scope-card.tsx:54-65`](../../src/features/meeting-flow/ui/components/steps/scope-card.tsx#L54-L65)
- These are the **only** two render sites of `coverImageUrl` in the codebase (`grep -rn "coverImageUrl" src/` returns 2 render sites + adapter/schema/router files).

## Why this is in EPIC scope (not a standalone perf hotfix)

The user explicitly placed this work inside EPIC #195. Reasons it fits:

1. **`OptimizedImage` is structurally incompatible with the current data shape.** It requires a `file` object with `pathKey`, `bucket`, `optimizationStatus`, `optimizationVariants`, `blurDataUrl` — i.e. a `mediaFiles` row. Notion cover URLs are bare strings. A standalone hotfix would need either (a) a URL-rewrite helper that recognizes known CDNs (brittle — Notion editors paste any host), or (b) the exact migration step described below. (b) is the canonical fix.
2. **The migration EPIC is the natural home.** Once trades/scopes live in Postgres, their cover image becomes a `mediaFiles` FK like every other surface in the codebase. Doing this *during* the migration is cheaper than a separate effort.
3. **It closes a stated EPIC goal.** EPIC #195: *"Editing in Notion blocks team velocity; bringing it in-house … removes a third-party dependency."* Leaving cover-image URLs pointing at Notion/Unsplash means the third-party dependency persists at the asset layer.

## Canonical pattern (already in the codebase)

The repo ships a complete R2-variant pipeline. Cover images should adopt it.

| Layer | Path | Purpose |
|---|---|---|
| Schema | [`src/shared/db/schema/media-files.ts`](../../src/shared/db/schema/media-files.ts) | `mediaFiles` table — `url`, `pathKey`, `bucket`, `optimizationStatus`, `optimizationVariants`, `blurDataUrl` |
| Variant generation | [`src/shared/services/providers/r2/lib/process-image-variants.ts`](../../src/shared/services/providers/r2/lib/process-image-variants.ts) | Pre-generates `sm` (640w), `md` (1280w), `lg` (1920w) WebP variants from any source buffer |
| URL helpers | [`src/shared/lib/get-optimized-urls.ts`](../../src/shared/lib/get-optimized-urls.ts) | `getOptimizedSrc()`, `getOptimizedSrcSet()` |
| Render component | [`src/shared/components/optimized-image.tsx`](../../src/shared/components/optimized-image.tsx) | Plain `<img>` with `srcSet` + `sizes` + base64 blur placeholder; required since `next.config.ts` sets `images.unoptimized: true` |
| Reference usage | `src/features/landing/ui/components/portfolio/project-card.tsx`, `src/features/project-management/ui/components/phase-carousel.tsx`, etc. (26+ files) | Canonical `<OptimizedImage file={file} alt="…" sizes="…" />` |

## Schema implication for #198 + #199

EPIC #195 currently keeps the existing `trades.imageUrl: text` column as-is and adds enrichments around it. To absorb cover images into the canonical pipeline:

```ts
// trades (revised)
trades: {
  // … existing columns …
  coverFileId: integer('cover_file_id').references(() => mediaFiles.id, { onDelete: 'set null' }),
  // imageUrl: text — KEEP for one release as deprecated read-only fallback, drop in cutover slice (#205)
}

// scopes (revised) — same shape
scopes: {
  // … existing columns …
  coverFileId: integer('cover_file_id').references(() => mediaFiles.id, { onDelete: 'set null' }),
}
```

The Trades vertical (#198) and Scopes vertical (#199) **must surface this FK in the admin form** (R2 upload widget already implied by their "imageUrl (R2 upload)" line, but now writes a `mediaFiles` row instead of a bare URL) and on the read path (`getById`, `list`).

Issue #243 owns the migration script that backfills `coverFileId` for existing rows by fetching the legacy `imageUrl`, pushing to R2, running `processImageVariants()`, and creating the `mediaFiles` row.

## Migration recipe (#243 — backend)

Single script `scripts/migrate-construction-cover-images.ts` invoked once per env:

1. **Source rows** — every row in `trades` and `scopes` (post Notion import #205-prep) with non-null `imageUrl` and null `coverFileId`.
2. **Fetch** — HTTP GET the `imageUrl`. Handle 404 / network failures with a per-row retry + final log; skip rows that fail twice (manual cleanup later via admin UI).
3. **Process** — feed the buffer to `processImageVariants()` (already handles too-small / too-narrow skip logic per [process-image-variants.ts:28-32](../../src/shared/services/providers/r2/lib/process-image-variants.ts#L28-L32)).
4. **Upload** — push original + variants to R2 under `construction/<entity>/<id>-<slug>.<ext>` keys, in the appropriate bucket (decide as part of follow-up tracker #206 item 5 — likely the existing `tpr-portfolio-projects` bucket with a `construction/` prefix, OR a new `tpr-construction` bucket; coordinate with #206).
5. **Create `mediaFiles` row** — `optimizationStatus: 'optimized'`, populate `optimizationVariants`, `blurDataUrl` (server-side generated from the smallest variant), `bucket`, `pathKey`, `url`.
6. **Wire FK** — `UPDATE trades SET cover_file_id = <newId> WHERE id = …` (same for scopes).
7. **Idempotency** — re-runs skip rows where `coverFileId IS NOT NULL`.
8. **Reporting** — emit a summary: total rows, migrated, skipped (no source URL), failed (with row ID + error).

For the Notion import phase (existing #205-prep work), trades/scopes that come from Notion need their `page.cover.external.url` written to the legacy `imageUrl` field so the migration script above picks them up. If the import already writes that field, no change needed.

## Consumer cleanup (#244 — frontend)

After #243 merges and runs in prod:

- [`trade-card.tsx`](../../src/features/meeting-flow/ui/components/steps/trade-card.tsx) — replace raw `<img src={trade.coverImageUrl}>` with `<OptimizedImage file={trade.coverFile} alt="" sizes="(max-width: 768px) 50vw, 200px" />`.
- [`scope-card.tsx`](../../src/features/meeting-flow/ui/components/steps/scope-card.tsx) — same with scope dims (`sizes="(max-width: 768px) 50vw, 160px"`). Keep the deterministic-gradient fallback for the no-image branch.
- Update the `Trade` + `ScopeOrAddon` schemas to surface `coverFile: MediaFileSelect | null` on the read path (joined in the router/spec).
- Re-measure: target < 2 MB total page weight on the meeting flow step 2 (vs current 11.9 MB). Verify with DevTools.
- Independent of cover images, also worth landing in the same PR: add explicit `width` / `height` to both cards and consider `fetchPriority="low"` on off-screen cards.

## Out of scope (still)

- SOW prose remains text-only — `RichEditor` handles its own attachments via TipTap Image extension (per #197), independent of trade/scope cover images.
- Material `specSheetUrl` (PDF) lives on its own R2 bucket decision in follow-ups #206 item 5.
- Public `/academy/construction` consumer cleanup (when that ships) will use `<OptimizedImage>` natively because it's built post-migration.

## Cross-references

- EPIC: #195
- ADR: #196 (Q13 phrasing needs a note — "text/heading/hr only" applies to SOW content, NOT cover images)
- Trades vertical: #198 (schema change: `coverFileId` FK — coordinate with #243)
- Scopes vertical: #199 (schema change: `coverFileId` FK — coordinate with #243)
- Cutover: #205 (drop legacy `imageUrl: text` column here, after #243 + #244 land)
- Follow-ups: #206 item 5 (R2 bucket strategy — coordinate naming with #243)
- Backend migration: #243
- Frontend cleanup: #244
- Canonical R2 pattern (ambient): no dedicated convention doc yet — see ⚠️ ping below.

## ⚠️ Stale-ref ping

There is **no `docs/codebase-conventions/image-rendering.md`** documenting the `OptimizedImage` + R2-variants pattern, even though it's the canonical approach across 26+ files. The convention exists in code only. This entire class of "developer reaches for raw `<img src={remoteUrl}>`" regression is exactly what a conventions doc would prevent. Worth filing a separate small docs PR.
