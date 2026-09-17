// src/shared/modules/media/service.ts
//
// Media orchestrator. Owns what is the SAME for every media owner: the presigned
// upload target, the table-generic scoped `list`/`reorder`, and the two
// optimization entry points (queued retry, in-process optimize). It rings the
// shared table-parameterized DAL ops — it never touches `db` itself.
//
// What it does NOT own (C32): the ROW LIFECYCLE. Optimize-on-create and
// purge-on-delete are entity invariants, so each owner declares them as
// `createCrudDal` hooks on its own media CRUD (`modules/{projects,proposals}/
// media/dal/server/crud.ts`). That way they fire on every call and every origin —
// a tRPC mutation, a job, a bare `crud.create` from a script — instead of only on
// the paths that happened to route through a service wrapper.
//
// Mutations return `DalReturn` so tRPC routers unwrap with `dalToTrpc` and
// services/jobs inspect the union directly.
// see docs/codebase-conventions/service-architecture.md
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { MediaStore } from '@/shared/modules/media/core/types'
import { listMediaByOwner, reorderMedia } from '@/shared/modules/media/core/dal/server/media-ops'
import { resetMediaOptimizationStatus } from '@/shared/modules/media/core/dal/server/optimization'
import { r2Client } from '@/shared/services/providers/r2/client'
import { optimizeMediaJob } from '@/shared/services/providers/upstash/jobs/optimize-media'
import { optimizeMediaFile } from './core/lib/optimize-media'

function extOf(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot >= 0 ? filename.slice(dot).toLowerCase() : ''
}

export const mediaService = {
  async buildUploadTarget(store: MediaStore, input: { ownerId: string, filename: string, mimeType: string, extra?: Record<string, string> }) {
    const pathKey = store.buildPathKey(input.ownerId, crypto.randomUUID(), extOf(input.filename), input.extra)
    const uploadUrl = await r2Client.getPresignedUploadUrl({ bucket: store.bucket, pathKey, mimeType: input.mimeType })
    return { uploadUrl, pathKey, bucket: store.bucket }
  },

  /** One scoped transaction — no per-row authz probe (the reorder N+1 kill). */
  async reorder(store: MediaStore, ctx: ScopedContext, updates: { id: number, sortOrder: number }[]): Promise<DalReturn<void>> {
    return reorderMedia(store.table, ctx, updates)
  },

  async list(store: MediaStore, ctx: ScopedContext, ownerId: string): Promise<DalReturn<Record<string, unknown>[]>> {
    return listMediaByOwner(store.table, store.ownerColumn, ctx, ownerId)
  },

  // async retry — resets status then queues optimization (interactive Retry button)
  async retryOptimization(store: MediaStore, mediaId: number) {
    await resetMediaOptimizationStatus(store.table, mediaId)
    void optimizeMediaJob.dispatch({ ownerKind: store.ownerKind, mediaId })
  },

  // synchronous, in-process optimize — no QStash (backfill scripts / dev)
  async optimizeNow(store: MediaStore, mediaId: number) {
    return optimizeMediaFile({ store, mediaId })
  },
}
