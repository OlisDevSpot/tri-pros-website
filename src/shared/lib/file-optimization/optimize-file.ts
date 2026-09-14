// src/shared/lib/file-optimization/optimize-file.ts
import type { Buffer } from 'node:buffer'
import type { FileKind, FileOptimizationResult } from './types'
import { processImageVariants } from '@/shared/entities/media-files/lib/process-image-variants'
import { readPdfPageCount } from './strategies/pdf'

/** Map a MIME type to its optimization strategy bucket. */
export function classifyFileKind(mimeType: string): FileKind {
  if (mimeType.startsWith('image/'))
    return 'image'
  if (mimeType.startsWith('video/'))
    return 'video'
  if (mimeType === 'application/pdf')
    return 'pdf'
  return 'other'
}

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
