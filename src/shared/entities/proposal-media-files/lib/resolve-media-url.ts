// src/shared/entities/proposal-media-files/lib/resolve-media-url.ts
import type { ProposalMediaFile } from '@/shared/db/schema/proposal-media-files'
import { r2Client } from '@/shared/services/providers/r2/client'
import { R2_BUCKETS } from '@/shared/services/providers/r2/types'

const DEFAULT_VARIANTS = ['sm', 'md', 'lg']

/**
 * Presigned download URL for a proposal media file in the private homeownerFiles
 * bucket. Prefers the optimized 'lg' WebP variant when available, else the
 * original object. Returns null when the row has no R2 object (e.g. a 'stream'
 * provider row — Plan 1b).
 */
export async function resolveProposalMediaUrl(
  row: Pick<ProposalMediaFile, 'pathKey' | 'optimizationStatus' | 'optimizationVariants'>,
): Promise<string | null> {
  if (!row.pathKey)
    return null

  const variants = row.optimizationVariants ?? DEFAULT_VARIANTS
  const key = row.optimizationStatus === 'optimized' && variants.includes('lg')
    ? `${row.pathKey.replace(/\.[^.]+$/, '')}-lg.webp`
    : row.pathKey

  return r2Client.getPresignedDownloadUrl({ bucket: R2_BUCKETS.homeownerFiles, pathKey: key })
}
