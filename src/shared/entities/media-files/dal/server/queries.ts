import type { MediaFile } from '@/shared/db/schema/media-files'

import { eq } from 'drizzle-orm'

import { db } from '@/shared/db'
import { mediaFiles } from '@/shared/db/schema/media-files'

export type { MediaFile }

// ── Reads ───────────────────────────────────────────────────────────────────

export async function getMediaFileById(id: number): Promise<MediaFile | undefined> {
  const [file] = await db
    .select()
    .from(mediaFiles)
    .where(eq(mediaFiles.id, id))
  return file
}

// ── Optimization status transitions ─────────────────────────────────────────

export async function setOptimizationProcessing(id: number): Promise<void> {
  await db
    .update(mediaFiles)
    .set({ optimizationStatus: 'processing' })
    .where(eq(mediaFiles.id, id))
}

export async function setOptimizationComplete(
  id: number,
  data: { variantSuffixes: string[], blurDataUrl: string },
): Promise<void> {
  await db
    .update(mediaFiles)
    .set({
      optimizationStatus: 'optimized',
      optimizationVariants: data.variantSuffixes,
      blurDataUrl: data.blurDataUrl,
    })
    .where(eq(mediaFiles.id, id))
}

export async function setOptimizationFailed(id: number): Promise<void> {
  await db
    .update(mediaFiles)
    .set({ optimizationStatus: 'failed' })
    .where(eq(mediaFiles.id, id))
}

export async function resetOptimizationStatus(id: number): Promise<void> {
  await db
    .update(mediaFiles)
    .set({ optimizationStatus: 'pending' })
    .where(eq(mediaFiles.id, id))
}
