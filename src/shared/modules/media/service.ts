// src/shared/modules/media/service.ts
//
// Media orchestrator. Owns the R2 object lifecycle (presign, delete) and the
// optimize dispatch, and RINGS each media child's scoped CRUD DAL (via
// `store.crud`) + the shared scoped `list`/`reorder` ops — it never touches `db`
// itself. Mutations return `DalReturn` so tRPC routers unwrap with `dalToTrpc`
// and services/jobs inspect the union directly. see docs/codebase-conventions/service-architecture.md
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { MediaStore } from '@/shared/modules/media/core/types'
import { dalSuccess } from '@/shared/dal/server/types'
import { listMediaByOwner, reorderMedia } from '@/shared/modules/media/core/dal/server/media-ops'
import { resetMediaOptimizationStatus } from '@/shared/modules/media/core/dal/server/optimization'
import { purgeMediaObject } from '@/shared/modules/media/core/lib/purge'
import { r2Client } from '@/shared/services/providers/r2/client'
import { optimizeMediaJob } from '@/shared/services/providers/upstash/jobs/optimize-media'
import { optimizeMediaFile } from './core/lib/optimize-media'

function extOf(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot >= 0 ? filename.slice(dot).toLowerCase() : ''
}

/** Images and PDFs get a derived-variant optimization pass; everything else is stored as-is. */
function isOptimizable(mimeType: unknown): boolean {
  return typeof mimeType === 'string' && (mimeType.startsWith('image/') || mimeType === 'application/pdf')
}

export const mediaService = {
  async buildUploadTarget(store: MediaStore, input: { ownerId: string, filename: string, mimeType: string, extra?: Record<string, string> }) {
    const pathKey = store.buildPathKey(input.ownerId, crypto.randomUUID(), extOf(input.filename), input.extra)
    const uploadUrl = await r2Client.getPresignedUploadUrl({ bucket: store.bucket, pathKey, mimeType: input.mimeType })
    return { uploadUrl, pathKey, bucket: store.bucket }
  },

  /** Persist via the scoped CRUD DAL, then queue optimization for image/pdf rows. */
  async createRecord<T extends Record<string, unknown>>(store: MediaStore, ctx: ScopedContext, values: T): Promise<DalReturn<any>> {
    const result = await store.crud.create(ctx, values as any)
    if (result.success && isOptimizable((result.data as any).mimeType)) {
      void optimizeMediaJob.dispatch({ ownerKind: store.ownerKind, mediaId: (result.data as any).id })
    }
    return result
  },

  /** R2 cleanup then scoped delete. Deleting a missing/invisible row is an idempotent no-op. */
  async removeRecord(store: MediaStore, ctx: ScopedContext, id: number): Promise<DalReturn<void>> {
    const found = await store.crud.getById(ctx, { id })
    if (!found.success) {
      return found
    }
    const row = found.data as any
    if (!row) {
      return dalSuccess(undefined)
    }
    // Only R2-backed rows have an object to delete. A Stream row (Plan 1b) or a
    // malformed row has null coordinates — purgeMediaObject skips cleanly, still
    // remove the DB row.
    await purgeMediaObject(row, store.variants)
    return store.crud.delete(ctx, { id })
  },

  /** One scoped transaction — no per-row authz probe (the reorder N+1 kill). */
  async reorder(store: MediaStore, ctx: ScopedContext, updates: { id: number, sortOrder: number }[]): Promise<DalReturn<void>> {
    return reorderMedia(store.table, ctx, updates)
  },

  async rename(store: MediaStore, ctx: ScopedContext, id: number, name: string): Promise<DalReturn<any>> {
    return store.crud.update(ctx, { id, data: { name } as any })
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
