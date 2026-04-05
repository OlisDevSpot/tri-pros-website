import type { R2BucketName } from '@/shared/services/r2/buckets'

import { eq } from 'drizzle-orm'

import { db } from '@/shared/db'
import { mediaFiles } from '@/shared/db/schema/media-files'
import { getObject } from '@/shared/services/r2/lib/get-object'
import { processImageVariants } from '@/shared/services/r2/lib/process-image-variants'
import { putObject } from '@/shared/services/r2/put-object'

import { createJob } from '../lib/create-job'

interface OptimizeImagePayload {
  mediaFileId: number
}

export const optimizeImageJob = createJob<OptimizeImagePayload>(
  'optimize-image',
  async ({ mediaFileId }) => {
    const [file] = await db
      .select()
      .from(mediaFiles)
      .where(eq(mediaFiles.id, mediaFileId))

    if (!file) {
      console.error(`[optimize-image] Media file ${mediaFileId} not found`)
      return
    }

    if (file.optimizationStatus === 'optimized') {
      return
    }

    await db
      .update(mediaFiles)
      .set({ optimizationStatus: 'processing' })
      .where(eq(mediaFiles.id, mediaFileId))

    try {
      const bucket = file.bucket as R2BucketName
      const originalBuffer = await getObject(bucket, file.pathKey)
      const { variants, blurDataUrl } = await processImageVariants(originalBuffer)

      const basePath = file.pathKey.replace(/\.[^.]+$/, '')
      await Promise.all(
        variants.map(v =>
          putObject(bucket, `${basePath}-${v.suffix}.webp`, v.buffer, 'image/webp'),
        ),
      )

      await db
        .update(mediaFiles)
        .set({ optimizationStatus: 'optimized', blurDataUrl })
        .where(eq(mediaFiles.id, mediaFileId))
    }
    catch (error) {
      console.error(`[optimize-image] Failed for media file ${mediaFileId}:`, error)
      await db
        .update(mediaFiles)
        .set({ optimizationStatus: 'failed' })
        .where(eq(mediaFiles.id, mediaFileId))
    }
  },
)
