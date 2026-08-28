import type { R2BucketName } from '@/shared/services/providers/r2/types'
import { TRPCError } from '@trpc/server'
import { and, eq, inArray, like } from 'drizzle-orm'
import { z } from 'zod'
import { mediaPhases } from '@/shared/constants/enums/media'
import { canAccess } from '@/shared/dal/server/lib/resolve-actor-scope'
import { db } from '@/shared/db'
import { insertMediaFilesSchema, meetings, proposalMediaFiles, proposals } from '@/shared/db/schema'
import { mediaFileServerSpec } from '@/shared/entities/media-files/lib/server-spec'
import { projectServerSpec } from '@/shared/entities/projects/lib/server-spec'
import { deriveOriginalMediaUrl, getOptimizedSrc } from '@/shared/lib/get-optimized-urls'
import { mediaService } from '@/shared/services/media/media.service'
import { projectMediaStore } from '@/shared/services/media/stores'
import { r2Client } from '@/shared/services/providers/r2/client'
import { R2_PUBLIC_DOMAINS } from '@/shared/services/providers/r2/types'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'
import { createTRPCRouter } from '../../init'
import { projectMediaProcedure } from './procedures'

export const mediaRouter = createTRPCRouter({
  getUploadUrl: projectMediaProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      phase: z.enum(mediaPhases),
      filename: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!(await canAccess(projectServerSpec, ctx.actor, input.projectId))) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }
      const { uploadUrl, pathKey, bucket } = await mediaService.buildUploadTarget(projectMediaStore, {
        ownerId: input.projectId,
        filename: input.filename,
        mimeType: input.mimeType,
        extra: { phase: input.phase },
      })
      const publicUrl = `${R2_PUBLIC_DOMAINS[bucket] ?? ''}/${pathKey}`
      return { uploadUrl, pathKey, publicUrl }
    }),

  create: projectMediaProcedure
    .input(insertMediaFilesSchema.omit({ bucket: true }).extend({
      bucket: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) =>
      dalToTrpc(await mediaService.createRecord(projectMediaStore, ctx, { ...input, bucket: input.bucket ?? projectMediaStore.bucket })),
    ),

  retryOptimization: projectMediaProcedure
    .input(z.object({ mediaFileId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!(await canAccess(mediaFileServerSpec, ctx.actor, input.mediaFileId))) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Media file not found' })
      }
      await mediaService.retryOptimization(projectMediaStore, input.mediaFileId)
      return { success: true }
    }),

  delete: projectMediaProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await mediaService.removeRecord(projectMediaStore, ctx, input.id))
    }),

  reorder: projectMediaProcedure
    .input(z.object({
      updates: z.array(z.object({ id: z.number(), sortOrder: z.number().int() })),
    }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await mediaService.reorder(projectMediaStore, ctx, input.updates))
    }),

  movePhase: projectMediaProcedure
    .input(z.object({
      ids: z.array(z.number()).min(1),
      phase: z.enum(mediaPhases),
    }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await mediaService.movePhase(projectMediaStore, ctx, input.ids, input.phase))
    }),

  bulkDelete: projectMediaProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      for (const id of input.ids)
        dalToTrpc(await mediaService.removeRecord(projectMediaStore, ctx, id))
    }),

  rename: projectMediaProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(80),
    }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await mediaService.rename(projectMediaStore, ctx, input.id, input.name))
    }),

  toggleHero: projectMediaProcedure
    .input(z.object({
      id: z.number(),
      isHeroImage: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await mediaService.setHero(projectMediaStore, ctx, input.id, input.isHeroImage))
    }),

  listImportableProposalMedia: projectMediaProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!(await canAccess(projectServerSpec, ctx.actor, input.projectId))) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }
      const rows = await db
        .select({
          id: proposalMediaFiles.id,
          proposalId: proposalMediaFiles.proposalId,
          proposalLabel: proposals.label,
          name: proposalMediaFiles.name,
          mimeType: proposalMediaFiles.mimeType,
          pathKey: proposalMediaFiles.pathKey,
          bucket: proposalMediaFiles.bucket,
          optimizationStatus: proposalMediaFiles.optimizationStatus,
          optimizationVariants: proposalMediaFiles.optimizationVariants,
        })
        .from(proposalMediaFiles)
        .innerJoin(proposals, eq(proposals.id, proposalMediaFiles.proposalId))
        .innerJoin(meetings, eq(meetings.id, proposals.meetingId))
        .where(and(eq(meetings.projectId, input.projectId), like(proposalMediaFiles.mimeType, 'image/%')))

      // Public bucket — derive the best display URL (variant or original) for
      // the picker preview. No presigning.
      const withUrl = rows.map(r => ({
        id: r.id,
        proposalId: r.proposalId,
        proposalLabel: r.proposalLabel,
        name: r.name,
        mimeType: r.mimeType,
        url: getOptimizedSrc({
          url: deriveOriginalMediaUrl(r.pathKey, r.bucket),
          pathKey: r.pathKey,
          bucket: r.bucket,
          optimizationStatus: r.optimizationStatus,
          optimizationVariants: r.optimizationVariants,
        }),
      }))

      // Group by proposal for the dialog.
      const byProposal = new Map<string, { proposalId: string, proposalLabel: string, items: typeof withUrl }>()
      for (const item of withUrl) {
        const g = byProposal.get(item.proposalId) ?? { proposalId: item.proposalId, proposalLabel: item.proposalLabel, items: [] }
        g.items.push(item)
        byProposal.set(item.proposalId, g)
      }
      return [...byProposal.values()]
    }),

  importFromProposal: projectMediaProcedure
    .input(z.object({ projectId: z.string().uuid(), proposalMediaFileIds: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      // Destination gate: the caller must be able to see the project they're
      // importing INTO (closes the destination IDOR). The source authz below —
      // the meetings.projectId join — still bounds WHICH proposal media are copyable.
      if (!(await canAccess(projectServerSpec, ctx.actor, input.projectId))) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }
      // Authorization: only copy media that actually belongs to a proposal on
      // THIS project's meetings (prevents importing arbitrary proposal media by id).
      const sources = await db
        .select({
          id: proposalMediaFiles.id,
          name: proposalMediaFiles.name,
          mimeType: proposalMediaFiles.mimeType,
          fileExtension: proposalMediaFiles.fileExtension,
          pathKey: proposalMediaFiles.pathKey,
          bucket: proposalMediaFiles.bucket,
        })
        .from(proposalMediaFiles)
        .innerJoin(proposals, eq(proposals.id, proposalMediaFiles.proposalId))
        .innerJoin(meetings, eq(meetings.id, proposals.meetingId))
        .where(and(eq(meetings.projectId, input.projectId), inArray(proposalMediaFiles.id, input.proposalMediaFileIds), like(proposalMediaFiles.mimeType, 'image/%')))

      let imported = 0
      for (const src of sources) {
        if (!src.pathKey || !src.bucket)
          continue
        const ext = src.fileExtension || (src.pathKey.includes('.') ? `.${src.pathKey.split('.').pop()}` : '')
        const destKey = `projects/${input.projectId}/uncategorized/${crypto.randomUUID()}${ext}`
        await r2Client.copyObject({
          sourceBucket: src.bucket as R2BucketName,
          sourceKey: src.pathKey,
          destBucket: projectMediaStore.bucket,
          destKey,
        })
        const publicUrl = `${R2_PUBLIC_DOMAINS[projectMediaStore.bucket] ?? ''}/${destKey}`
        dalToTrpc(await mediaService.createRecord(projectMediaStore, ctx, {
          projectId: input.projectId,
          name: src.name,
          mimeType: src.mimeType,
          fileExtension: ext,
          pathKey: destKey,
          bucket: projectMediaStore.bucket,
          url: publicUrl,
          phase: 'uncategorized',
        }))
        imported++
      }
      return { imported }
    }),
})
