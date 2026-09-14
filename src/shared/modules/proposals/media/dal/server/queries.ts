// src/shared/modules/proposals/media/dal/server/queries.ts
import type { ProposalMediaFile, ProposalMediaVisibility } from '@/shared/db/schema/proposal-media-files'
import { and, asc, eq, inArray, like } from 'drizzle-orm'
import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema/meetings'
import { proposalMediaFiles } from '@/shared/db/schema/proposal-media-files'
import { proposals } from '@/shared/db/schema/proposals'
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

export interface ImportableProjectMediaRow {
  id: number
  proposalId: string
  proposalLabel: string
  name: string
  mimeType: string
  fileExtension: string | null
  pathKey: string | null
  bucket: string | null
  optimizationStatus: string
  optimizationVariants: string[] | null
}

/**
 * Image rows on proposals belonging to THIS project's meetings — the import-picker
 * source set. Authorization by construction: the meeting→project join means only
 * media reachable from the project is returned (no arbitrary-id import). Pass `ids`
 * to restrict to a chosen subset (the actual import call).
 */
export async function listImportableProjectMedia(
  projectId: string,
  ids?: number[],
): Promise<ImportableProjectMediaRow[]> {
  return db
    .select({
      id: proposalMediaFiles.id,
      proposalId: proposalMediaFiles.proposalId,
      proposalLabel: proposals.label,
      name: proposalMediaFiles.name,
      mimeType: proposalMediaFiles.mimeType,
      fileExtension: proposalMediaFiles.fileExtension,
      pathKey: proposalMediaFiles.pathKey,
      bucket: proposalMediaFiles.bucket,
      optimizationStatus: proposalMediaFiles.optimizationStatus,
      optimizationVariants: proposalMediaFiles.optimizationVariants,
    })
    .from(proposalMediaFiles)
    .innerJoin(proposals, eq(proposals.id, proposalMediaFiles.proposalId))
    .innerJoin(meetings, eq(meetings.id, proposals.meetingId))
    .where(and(
      eq(meetings.projectId, projectId),
      like(proposalMediaFiles.mimeType, 'image/%'),
      ids && ids.length > 0 ? inArray(proposalMediaFiles.id, ids) : undefined,
    ))
}

/** Homeowner-visible rows for a proposal, ordered — feeds the customer-facing gallery. */
export async function listHomeownerProposalMedia(proposalId: string): Promise<ProposalMediaFile[]> {
  return db
    .select()
    .from(proposalMediaFiles)
    .where(and(eq(proposalMediaFiles.proposalId, proposalId), eq(proposalMediaFiles.visibility, 'homeowner')))
    .orderBy(asc(proposalMediaFiles.sortOrder))
}
