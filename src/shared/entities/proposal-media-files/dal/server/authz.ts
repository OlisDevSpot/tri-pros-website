// src/shared/entities/proposal-media-files/dal/server/authz.ts
import type { ScopedContext } from '@/shared/dal/server/types'
import { TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { proposalMediaFiles } from '@/shared/db/schema/proposal-media-files'
import { proposals } from '@/shared/db/schema/proposals'

/** Throw NOT_FOUND unless the proposal is visible in the caller's scope. */
export async function assertProposalInScope(ctx: ScopedContext, proposalId: string): Promise<void> {
  const [row] = await db
    .select({ id: proposals.id })
    .from(proposals)
    .where(and(eq(proposals.id, proposalId), ctx.scope ?? undefined))
  if (!row)
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
}

/** Throw NOT_FOUND unless the media file's parent proposal is visible in the caller's scope. */
export async function assertProposalMediaInScope(ctx: ScopedContext, mediaFileId: number): Promise<void> {
  const [row] = await db
    .select({ id: proposalMediaFiles.id })
    .from(proposalMediaFiles)
    .innerJoin(proposals, eq(proposals.id, proposalMediaFiles.proposalId))
    .where(and(eq(proposalMediaFiles.id, mediaFileId), ctx.scope ?? undefined))
  if (!row)
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal media file not found' })
}
