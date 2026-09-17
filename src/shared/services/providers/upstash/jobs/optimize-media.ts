import type { MediaStore } from '@/shared/modules/media/core/types'
import { optimizeMediaFile } from '@/shared/modules/media/core/lib/optimize-media'
import { projectMediaStore } from '@/shared/modules/projects/media/store'
import { proposalMediaStore } from '@/shared/modules/proposals/media/store'
import { createJob } from '../lib/create-job'

interface OptimizeMediaPayload {
  ownerKind: string
  mediaId: number
}

/**
 * THE composition root for media owners (C27, MD4). `ownerKind` is resolved to a
 * store here and nowhere else: `modules/media` never sees an owner union, so a new
 * media owner is one line in this map plus its own store.
 *
 * Payload shape is unchanged, so jobs already queued at deploy time still run.
 */
const STORES: Record<string, MediaStore> = {
  project: projectMediaStore,
  proposal: proposalMediaStore,
}

export const optimizeMediaJob = createJob<OptimizeMediaPayload>(
  'optimize-media',
  async ({ ownerKind, mediaId }) => {
    const store = STORES[ownerKind]
    if (!store) {
      console.error(`[optimize-media] unknown ownerKind '${ownerKind}' for media ${mediaId}`)
      return
    }
    await optimizeMediaFile({ store, mediaId })
  },
)
