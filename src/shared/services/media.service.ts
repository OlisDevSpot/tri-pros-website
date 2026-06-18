import type { R2BucketName } from '@/shared/services/providers/r2/types'
import {
  getMediaFileById,
  setOptimizationComplete,
  setOptimizationFailed,
  setOptimizationProcessing,
} from '@/shared/entities/media-files/dal/server/queries'
import { processImageVariants } from '@/shared/entities/media-files/lib/process-image-variants'
import { r2Client } from '@/shared/services/providers/r2/client'

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
        const originalBuffer = await r2Client.getObject(bucket, file.pathKey)
        const { variants, blurDataUrl, variantSuffixes } = await processImageVariants(originalBuffer)

        const basePath = file.pathKey.replace(/\.[^.]+$/, '')
        await Promise.all(
          variants.map(v =>
            r2Client.putObject(bucket, `${basePath}-${v.suffix}.webp`, v.buffer, 'image/webp'),
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
