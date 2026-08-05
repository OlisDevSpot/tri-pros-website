import type { MediaOwnerKind } from '@/shared/services/media/stores'
import { optimizeMediaFile } from '@/shared/services/media/optimize-media'
import { createJob } from '../lib/create-job'

interface OptimizeMediaPayload {
  ownerKind: MediaOwnerKind
  mediaId: number
}

export const optimizeMediaJob = createJob<OptimizeMediaPayload>(
  'optimize-media',
  async ({ ownerKind, mediaId }) => {
    await optimizeMediaFile({ ownerKind, mediaId })
  },
)
