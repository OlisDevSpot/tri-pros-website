// src/shared/services/media/media.service.ts
import type { MediaStore } from './stores'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { resetMediaOptimizationStatus } from '@/shared/entities/media-files/dal/server/optimization'
import { r2Client } from '@/shared/services/providers/r2/client'
import { optimizeMediaJob } from '@/shared/services/providers/upstash/jobs/optimize-media'
import { optimizeMediaFile } from './optimize-media'

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

  async createRecord<T extends Record<string, unknown>>(store: MediaStore, values: T) {
    const [created] = await db.insert(store.table).values(values as any).returning() as any[]
    if (typeof created.mimeType === 'string' && (created.mimeType.startsWith('image/') || created.mimeType === 'application/pdf'))
      void optimizeMediaJob.dispatch({ ownerKind: store.ownerKind, mediaId: created.id })
    return created
  },

  async removeRecord(store: MediaStore, id: number) {
    const [row] = await db.select().from(store.table).where(eq(store.table.id, id))
    if (!row)
      return
    // Only R2-backed rows have an object to delete. A Stream row (Plan 1b) or a
    // malformed row has null coordinates — skip R2 cleanup, still remove the DB row.
    if (row.bucket && row.pathKey)
      await r2Client.deleteMediaWithVariants(row.bucket, row.pathKey)
    await db.delete(store.table).where(eq(store.table.id, id))
  },

  async reorder(store: MediaStore, updates: { id: number, sortOrder: number }[]) {
    if (updates.length === 0)
      return
    await db.transaction(async (tx) => {
      for (const { id, sortOrder } of updates)
        await tx.update(store.table).set({ sortOrder }).where(eq(store.table.id, id))
    })
  },

  async rename(store: MediaStore, id: number, name: string) {
    await db.update(store.table).set({ name }).where(eq(store.table.id, id))
  },

  async list(store: MediaStore, ownerId: string) {
    return db.select().from(store.table).where(eq(store.ownerColumn, ownerId)).orderBy(asc(store.table.sortOrder))
  },

  // async retry — resets status then queues optimization (interactive Retry button)
  async retryOptimization(store: MediaStore, mediaId: number) {
    await resetMediaOptimizationStatus(store.table, mediaId)
    void optimizeMediaJob.dispatch({ ownerKind: store.ownerKind, mediaId })
  },

  // synchronous, in-process optimize — no QStash (backfill scripts / dev)
  async optimizeNow(store: MediaStore, mediaId: number) {
    return optimizeMediaFile({ ownerKind: store.ownerKind, mediaId })
  },
}
