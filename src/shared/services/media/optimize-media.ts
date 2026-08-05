// src/shared/services/media/optimize-media.ts
import type { MediaOwnerKind } from './stores'
import type { R2BucketName } from '@/shared/services/providers/r2/types'
import {
  setMediaOptimizationComplete,
  setMediaOptimizationFailed,
  setMediaOptimizationProcessing,
} from '@/shared/entities/media-files/dal/server/optimization'
import { optimizeFile } from '@/shared/lib/file-optimization/optimize-file'
import { r2Client } from '@/shared/services/providers/r2/client'
import { getOptimizationTarget } from './optimization-target'

/**
 * Owner-agnostic media optimization. Idempotent (skips already-optimized rows).
 * Fetches the R2 original, runs the pure optimizer, uploads any image variants,
 * and writes status/fields via the table-parameterized setters.
 *
 * Only R2-backed rows are optimized here. A Cloudflare Stream row (provider
 * 'stream', Plan 1b) has no fetchable R2 object — it is skipped. Note: before
 * the Task B1 migration, media_files rows have NO `provider` column, so treat a
 * MISSING/undefined provider as 'r2' (proceed) and skip ONLY an explicit 'stream'.
 */
export async function optimizeMediaFile(
  { ownerKind, mediaId }: { ownerKind: MediaOwnerKind, mediaId: number },
): Promise<void> {
  const { table, getFile } = getOptimizationTarget(ownerKind)
  const file = await getFile(mediaId)

  if (!file) {
    console.error(`[optimizeMediaFile] ${ownerKind} media ${mediaId} not found`)
    return
  }
  if (file.optimizationStatus === 'optimized')
    return
  // Stream assets (Plan 1b) carry no R2 object; nothing to fetch/optimize here.
  if (file.provider === 'stream' || !file.pathKey || !file.bucket)
    return

  await setMediaOptimizationProcessing(table, mediaId)

  try {
    const bucket = file.bucket as R2BucketName
    const originalBuffer = await r2Client.getObject(bucket, file.pathKey)
    const result = await optimizeFile(originalBuffer, file.mimeType)

    if (result.variants.length > 0) {
      const basePath = file.pathKey.replace(/\.[^.]+$/, '')
      await Promise.all(
        result.variants.map(v =>
          r2Client.putObject(bucket, `${basePath}-${v.suffix}.webp`, v.buffer, 'image/webp'),
        ),
      )
    }

    await setMediaOptimizationComplete(table, mediaId, {
      variantSuffixes: result.variantSuffixes,
      blurDataUrl: result.blurDataUrl,
      pageCount: result.pageCount,
    })
  }
  catch (error) {
    console.error(`[optimizeMediaFile] failed for ${ownerKind} ${mediaId}:`, error)
    await setMediaOptimizationFailed(table, mediaId)
  }
}
