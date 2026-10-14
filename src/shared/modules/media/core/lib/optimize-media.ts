// src/shared/modules/media/core/lib/optimize-media.ts
import type { MediaStore } from '@/shared/modules/media/core/types'
import type { R2BucketName } from '@/shared/services/providers/r2/types'
import { systemContext } from '@/shared/dal/server/lib/contexts'
import { optimizeFile } from '@/shared/lib/file-optimization/optimize-file'
import {
  setMediaOptimizationComplete,
  setMediaOptimizationFailed,
  setMediaOptimizationProcessing,
} from '@/shared/modules/media/core/dal/server/optimization'
import { r2Client } from '@/shared/services/providers/r2/client'

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
  { store, mediaId }: { store: MediaStore, mediaId: number },
): Promise<void> {
  const table = store.table
  // A queued job has no session and must see every owner's row.
  const found = await store.crud.getById(systemContext('job:media-optimization'), { id: mediaId })
  if (!found.success) {
    // Transient DB error (cold start, connection reset) — throw so the QStash
    // route handler's promise rejects and QStash sees a 500 and retries. Returning
    // here would leave the row `pending` forever with only this log as a trace.
    console.error(`[optimizeMediaFile] ${store.ownerKind} media ${mediaId} read failed`, found.error)
    throw new Error(`optimizeMediaFile: ${store.ownerKind} media ${mediaId} read failed: ${found.error.type}`)
  }
  const file = found.data as any

  if (!file) {
    // Genuinely missing row (bad id, already deleted) — retrying can never help,
    // so log and return instead of throwing. Do not "harmonise" this with the
    // read-failure branch above; they differ on purpose.
    console.error(`[optimizeMediaFile] ${store.ownerKind} media ${mediaId} not found`)
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
    const result = await optimizeFile(originalBuffer, file.mimeType, store.variants)

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
    console.error(`[optimizeMediaFile] failed for ${store.ownerKind} ${mediaId}:`, error)
    await setMediaOptimizationFailed(table, mediaId)
  }
}
