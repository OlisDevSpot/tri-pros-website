// src/shared/modules/media/core/lib/optimize-media.ts
import type { MediaStore } from '@/shared/modules/media/core/types'
import type { R2BucketName } from '@/shared/services/providers/r2/types'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
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
  // The row is read through the owner's own scoped CRUD — SYSTEM_CONTEXT because a
  // background job has no session and must see every row. This is what removes the
  // last raw `db` read on the media service/optimizer path (MD2) — the table-generic
  // DAL ops (media-ops.ts, optimization.ts) still import `db` legitimately.
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
