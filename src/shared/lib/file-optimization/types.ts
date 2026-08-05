// src/shared/lib/file-optimization/types.ts
import type { ImageVariant } from '@/shared/entities/media-files/lib/process-image-variants'

/** Coarse file classification that selects an optimization strategy. */
export type FileKind = 'image' | 'video' | 'pdf' | 'other'

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

/**
 * The result of optimizing one file — a pure description of what to persist.
 * The caller uploads `variants` (image WebP buffers) to storage and writes the
 * scalar fields to the media row. Nothing here performs IO.
 */
export interface FileOptimizationResult {
  kind: FileKind
  /** Image WebP size-variant buffers to upload (empty for non-image / skipped). */
  variants: ImageVariant[]
  /** Suffixes actually generated, e.g. ['sm','md'] (empty for non-image / skipped). */
  variantSuffixes: string[]
  /** Base64 WebP blur placeholder for images; null otherwise. */
  blurDataUrl: string | null
  /** PDF page count when known; null otherwise. */
  pageCount: number | null
  /**
   * true when no optimization was performed (video/other in Plan 1). The file
   * is still valid/usable — 'skipped' means "nothing to persist beyond the
   * original", NOT an error.
   */
  skipped: boolean
}
