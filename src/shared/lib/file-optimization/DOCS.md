# File Optimization — DOCS.md

## purpose

Pure, owner-agnostic file optimizer core. `optimizeFile(buffer, mimeType)` classifies the
file and returns a `FileOptimizationResult` describing what to persist. It performs **NO
IO** — no R2/storage client, no DB writes. Callers (e.g. the A6 `optimizeMediaFile`
orchestrator) fetch the buffer, upload the returned `variants` to storage, and write the
scalar fields to the owning row.

## strategy-dispatch

`classifyFileKind(mimeType)` buckets a MIME type into `image | video | pdf | other`.

- **image** → reuses `processImageVariants` from
  `src/shared/entities/media-files/lib/process-image-variants.ts` for WebP size variants
  + blur placeholder. This layer does not reimplement image processing.
- **pdf** → `readPdfPageCount` (in `strategies/pdf.ts`) reads a best-effort page count via
  `pdf-lib`. Never throws — a parse failure returns `null`, not an optimize failure.
- **video / other** → skipped in Plan 1 (`skipped: true`); the original file is still
  valid and usable as-is.

## plan-1b-extension-point

- video → hand off to a Cloudflare Stream provider (transcode + poster frame + readiness
  webhook).
- pdf → first-page raster → WebP thumbnail (pdfjs-dist + canvas), surfaced as a
  `thumbnailPathKey`.

Extension points are marked `// PLAN 1b:` in `strategies/pdf.ts` and `optimize-file.ts`.

## import-direction

This directory must never import from `@/features/**`, storage clients, or `db`. The only
cross-imports allowed are `ImageVariant`/`processImageVariants` from
`entities/media-files/lib` and the `pdf-lib`/`sharp` packages.
