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
 * THUNKS, not store values — do NOT "simplify" these away (D6). This module sits
 * on the cycle `owner CRUD → this job → owner store → owner CRUD`: each media
 * unit's CRUD imports this job for the optimize dispatch, and each store imports
 * that same CRUD. ES module bindings are live, so a reference resolved at CALL
 * time is always initialised — but a plain `project: projectMediaStore` here is
 * read while THIS module body evaluates, and on a store-first import order that
 * binding is still in its temporal dead zone (`ReferenceError: Cannot access
 * 'projectMediaStore' before initialization`, which took `projects.router/index`
 * down at init — both project routers import the store before the service).
 * Deferring the read into a function body is the same rule `MediaStore.crud`
 * follows with its getter. Proven across every entry point, 2026-09-17.
 *
 * Payload shape is unchanged, so jobs already queued at deploy time still run.
 */
const STORES: Record<string, () => MediaStore> = {
  project: () => projectMediaStore,
  proposal: () => proposalMediaStore,
}

export const optimizeMediaJob = createJob<OptimizeMediaPayload>(
  'optimize-media',
  async ({ ownerKind, mediaId }) => {
    // `?.()` yields undefined for an unknown key — same branch as before.
    const store = STORES[ownerKind]?.()
    if (!store) {
      console.error(`[optimize-media] unknown ownerKind '${ownerKind}' for media ${mediaId}`)
      return
    }
    await optimizeMediaFile({ store, mediaId })
  },
)
