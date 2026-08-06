// src/shared/entities/proposal-media-files/dal/server/queries.ts
import type { ProposalMediaFile, ProposalMediaVisibility } from '@/shared/db/schema/proposal-media-files'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { proposalMediaFiles } from '@/shared/db/schema/proposal-media-files'
import { resolveProposalMediaUrl } from '../../lib/resolve-media-url'

/** Homeowner-facing projection of a proposal media file — presigned url, no R2 internals. */
export interface ProposalMediaView {
  id: number
  name: string
  mimeType: string
  visibility: ProposalMediaVisibility
  url: string | null
  blurDataUrl: string | null
  optimizationStatus: string
  sortOrder: number
  duration: number | null
  pageCount: number | null
}

/** Map a raw row to the presigned view (async — presigns the R2 url). */
export async function toProposalMediaView(row: ProposalMediaFile): Promise<ProposalMediaView> {
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mimeType,
    visibility: row.visibility,
    url: await resolveProposalMediaUrl(row),
    blurDataUrl: row.blurDataUrl,
    optimizationStatus: row.optimizationStatus,
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
