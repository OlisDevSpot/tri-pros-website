import { mediaService } from '@/shared/services/media.service'

import { createJob } from '../lib/create-job'

interface OptimizeImagePayload {
  mediaFileId: number
}

export const optimizeImageJob = createJob<OptimizeImagePayload>(
  'optimize-image',
  async ({ mediaFileId }) => {
    await mediaService.optimizeImage(mediaFileId)
  },
)
