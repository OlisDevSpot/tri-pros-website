// src/shared/entities/proposal-media-files/dal/server/queries.ts
import type { ProposalMediaFile, ProposalMediaVisibility } from '@/shared/db/schema/proposal-media-files'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { proposalMediaFiles } from '@/shared/db/schema/proposal-media-files'
import { deriveOriginalMediaUrl } from '@/shared/lib/get-optimized-urls'

/**
 * Homeowner-facing projection of a proposal media file. Public canonical bucket
 * (`tpr-media`): `url` is the JIT-derived original-object URL and `pathKey`/
 * `bucket`/`optimizationVariants` let the client derive responsive src/srcSet
 * via `get-optimized-urls`. No presigning; no `url` column on the table.
 */
export interface ProposalMediaView {
  id: number
  name: string
  mimeType: string
  visibility: ProposalMediaVisibility
  url: string
  pathKey: string | null
  bucket: string | null
  optimizationStatus: string
  optimizationVariants: string[] | null
  blurDataUrl: string | null
  sortOrder: number
  duration: number | null
  pageCount: number | null
}

/** Map a raw row to the public view (sync — the URL is derived, not presigned). */
export function toProposalMediaView(row: ProposalMediaFile): ProposalMediaView {
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mimeType,
    visibility: row.visibility,
    url: deriveOriginalMediaUrl(row.pathKey, row.bucket),
    pathKey: row.pathKey,
    bucket: row.bucket,
    optimizationStatus: row.optimizationStatus,
    optimizationVariants: row.optimizationVariants,
    blurDataUrl: row.blurDataUrl,
    sortOrder: row.sortOrder,
    duration: row.duration,
    pageCount: row.pageCount,
  }
}

/** Fetch one row by id (used by authz + write paths). No scope applied here. */
export async function getProposalMediaFileById(id: number): Promise<ProposalMediaFile | undefined> {
  const [row] = await db.select().from(proposalMediaFiles).where(eq(proposalMediaFiles.id, id))
  return row
}

/** Homeowner-visible rows for a proposal, ordered — feeds the customer-facing gallery. */
export async function listHomeownerProposalMedia(proposalId: string): Promise<ProposalMediaFile[]> {
  return db
    .select()
    .from(proposalMediaFiles)
    .where(and(eq(proposalMediaFiles.proposalId, proposalId), eq(proposalMediaFiles.visibility, 'homeowner')))
    .orderBy(asc(proposalMediaFiles.sortOrder))
}
