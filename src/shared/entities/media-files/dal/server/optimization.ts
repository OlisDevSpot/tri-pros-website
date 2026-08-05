import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'

/**
 * Table-parameterized optimization-status setters. Operate on any base-media
 * table (media_files | proposal_media_files) so the shared optimize orchestrator
 * stays owner-agnostic. The generic-table casts are contained to this file —
 * the same pragmatic pattern the media service uses. Callers pass the correct
 * owner-specific table.
 */

// A base-media table — every such table has id/optimizationStatus/optimizationVariants/blurDataUrl;
// only some (proposal_media_files) additionally have pageCount. Contained `any` (rule is off repo-wide).
type AnyMediaTable = any

export async function setMediaOptimizationProcessing(table: AnyMediaTable, id: number): Promise<void> {
  await db.update(table).set({ optimizationStatus: 'processing' }).where(eq(table.id, id))
}

export async function setMediaOptimizationComplete(
  table: AnyMediaTable,
  id: number,
  data: { variantSuffixes: string[], blurDataUrl: string | null, pageCount?: number | null },
): Promise<void> {
  const values: Record<string, unknown> = {
    optimizationStatus: 'optimized',
    optimizationVariants: data.variantSuffixes,
    blurDataUrl: data.blurDataUrl,
  }
  // Write pageCount ONLY when the target table actually has that column
  // (proposal_media_files does; media_files does not). `table.pageCount` is a
  // Drizzle Column object when the column exists, undefined otherwise.
  if (table.pageCount && data.pageCount != null)
    values.pageCount = data.pageCount

  await db.update(table).set(values).where(eq(table.id, id))
}

export async function setMediaOptimizationFailed(table: AnyMediaTable, id: number): Promise<void> {
  await db.update(table).set({ optimizationStatus: 'failed' }).where(eq(table.id, id))
}
