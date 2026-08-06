// src/trpc/routers/proposals.router/media.router.ts
import type { ScopedContext } from '@/shared/dal/server/types'
import type { ProposalMediaFile } from '@/shared/db/schema/proposal-media-files'
import type { proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'
import type { EntityToolkit } from '@/trpc/lib/create-entity-router'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import z from 'zod'
import { db } from '@/shared/db'
import { proposalMediaFiles, proposalMediaVisibilities } from '@/shared/db/schema/proposal-media-files'
import { assertProposalInScope, assertProposalMediaInScope } from '@/shared/entities/proposal-media-files/dal/server/authz'
import { toProposalMediaView } from '@/shared/entities/proposal-media-files/dal/server/queries'
import { mediaService } from '@/shared/services/media/media.service'
import { proposalMediaStore } from '@/shared/services/media/stores'
import { createTRPCRouter } from '../../init'

/** Throw FORBIDDEN unless the caller may update proposals. */
function assertCanUpdate(ctx: ScopedContext) {
  if (ctx.ability?.cannot('update', 'Proposal') !== false) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to update this proposal.' })
  }
}

export function createProposalMediaRouter(entity: EntityToolkit<typeof proposalServerSpec.table>) {
  return createTRPCRouter({
    getUploadUrl: entity.authedProcedure
      .input(z.object({ proposalId: z.string().uuid(), filename: z.string(), mimeType: z.string() }))
      .mutation(async ({ ctx, input }) => {
        assertCanUpdate(ctx)
        await assertProposalInScope(ctx, input.proposalId)
        return mediaService.buildUploadTarget(proposalMediaStore, {
          ownerId: input.proposalId,
          filename: input.filename,
          mimeType: input.mimeType,
        })
      }),

    create: entity.authedProcedure
      .input(z.object({
        proposalId: z.string().uuid(),
        name: z.string().min(1).max(80),
        pathKey: z.string(),
        bucket: z.string(),
        mimeType: z.string(),
        fileExtension: z.string(),
        duration: z.number().int().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        assertCanUpdate(ctx)
        await assertProposalInScope(ctx, input.proposalId)
        return mediaService.createRecord(proposalMediaStore, input)
      }),

    list: entity.authedProcedure
      .input(z.object({ proposalId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        assertCanUpdate(ctx)
        await assertProposalInScope(ctx, input.proposalId)
        const rows = await mediaService.list(proposalMediaStore, input.proposalId) as ProposalMediaFile[]
        return Promise.all(rows.map(toProposalMediaView))
      }),

    setVisibility: entity.authedProcedure
      .input(z.object({ id: z.number(), visibility: z.enum(proposalMediaVisibilities) }))
      .mutation(async ({ ctx, input }) => {
        assertCanUpdate(ctx)
        await assertProposalMediaInScope(ctx, input.id)
        await db.update(proposalMediaFiles).set({ visibility: input.visibility }).where(eq(proposalMediaFiles.id, input.id))
      }),

    reorder: entity.authedProcedure
      .input(z.object({ updates: z.array(z.object({ id: z.number(), sortOrder: z.number().int() })) }))
      .mutation(async ({ ctx, input }) => {
        assertCanUpdate(ctx)
        await Promise.all(input.updates.map(u => assertProposalMediaInScope(ctx, u.id)))
        await mediaService.reorder(proposalMediaStore, input.updates)
      }),

    rename: entity.authedProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1).max(80) }))
      .mutation(async ({ ctx, input }) => {
        assertCanUpdate(ctx)
        await assertProposalMediaInScope(ctx, input.id)
        await mediaService.rename(proposalMediaStore, input.id, input.name)
      }),

    delete: entity.authedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        assertCanUpdate(ctx)
        await assertProposalMediaInScope(ctx, input.id)
        await mediaService.removeRecord(proposalMediaStore, input.id)
      }),
  })
}
