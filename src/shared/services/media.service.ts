import type { R2BucketName } from '@/shared/services/r2/buckets'
import {
  getMediaFileById,
  setOptimizationComplete,
  setOptimizationFailed,
  setOptimizationProcessing,
} from '@/shared/dal/server/media-files/api'
import { getObject } from '@/shared/services/r2/lib/get-object'
import { processImageVariants } from '@/shared/services/r2/lib/process-image-variants'
import { putObject } from '@/shared/services/r2/put-object'

function createMediaService() {
  return {
    optimizeImage: async (mediaFileId: number) => {
      const file = await getMediaFileById(mediaFileId)

      if (!file) {
        console.error(`[mediaService] Media file ${mediaFileId} not found`)
        return
      }

      if (file.optimizationStatus === 'optimized') {
        return
      }

      await setOptimizationProcessing(mediaFileId)

      try {
        const bucket = file.bucket as R2BucketName
        const originalBuffer = await getObject(bucket, file.pathKey)
        const { variants, blurDataUrl, variantSuffixes } = await processImageVariants(originalBuffer)

        const basePath = file.pathKey.replace(/\.[^.]+$/, '')
        await Promise.all(
          variants.map(v =>
            putObject(bucket, `${basePath}-${v.suffix}.webp`, v.buffer, 'image/webp'),
          ),
        )

        await setOptimizationComplete(mediaFileId, { variantSuffixes, blurDataUrl })
      }
      catch (error) {
        console.error(`[mediaService] Optimization failed for ${mediaFileId}:`, error)
        await setOptimizationFailed(mediaFileId)
      }
    },
  }
}

export type MediaService = ReturnType<typeof createMediaService>
export const mediaService = createMediaService()
