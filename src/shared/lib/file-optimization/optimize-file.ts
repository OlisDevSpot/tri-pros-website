// src/shared/lib/file-optimization/optimize-file.ts
import type { Buffer } from 'node:buffer'
import type { FileOptimizationResult } from './types'
import { processImageVariants } from '@/shared/entities/media-files/lib/process-image-variants'
import { readPdfPageCount } from './strategies/pdf'
import { classifyFileKind } from './types'

/** A skipped result — nothing to persist beyond the original object. */
function skipped(kind: FileOptimizationResult['kind']): FileOptimizationResult {
  return { kind, variants: [], variantSuffixes: [], blurDataUrl: null, pageCount: null, skipped: true }
}

/**
 * Pure optimizer core: classify by MIME type and produce a description of what
 * to persist. Performs NO storage or DB IO — the caller uploads `variants` and
 * writes the scalar fields.
 *
 *   image → WebP size variants + blur (via processImageVariants)
 *   pdf   → page count (best-effort)
 *   video → skipped in Plan 1 (PLAN 1b: Cloudflare Stream transcode + poster)
 *   other → skipped
 */
export async function optimizeFile(buffer: Buffer, mimeType: string): Promise<FileOptimizationResult> {
  const kind = classifyFileKind(mimeType)

  switch (kind) {
    case 'image': {
      const { variants, blurDataUrl, variantSuffixes } = await processImageVariants(buffer)
      return { kind, variants, variantSuffixes, blurDataUrl, pageCount: null, skipped: false }
    }
    case 'pdf': {
      const pageCount = await readPdfPageCount(buffer)
      return { kind, variants: [], variantSuffixes: [], blurDataUrl: null, pageCount, skipped: false }
    }
    case 'video':
      // PLAN 1b: hand off to the Cloudflare Stream provider (transcode + poster
      // frame + readiness webhook). In Plan 1 videos are stored as-is.
      return skipped(kind)
    case 'other':
      return skipped(kind)
  }
}
