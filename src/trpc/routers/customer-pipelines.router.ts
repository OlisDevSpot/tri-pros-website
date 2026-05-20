import type { LeadMeta } from '@/shared/entities/customers/schemas'
import { TRPCError } from '@trpc/server'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getCustomerPipelineItems } from '@/features/customer-pipelines/dal/server/get-customer-pipeline-items'
import { getCustomerProfile } from '@/features/customer-pipelines/dal/server/get-customer-profile'
import { moveCustomerPipelineItem } from '@/features/customer-pipelines/dal/server/move-customer-pipeline-item'
import { moveCustomerToPipeline } from '@/features/customer-pipelines/dal/server/move-customer-to-pipeline'
import { meetingPipelines, pipelines } from '@/shared/constants/enums/pipelines'
import { buildUserContext } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { projects } from '@/shared/db/schema/projects'
import { proposals } from '@/shared/db/schema/proposals'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
import { R2_BUCKETS } from '@/shared/services/providers/r2/buckets'
import { getPresignedDownloadUrl } from '@/shared/services/providers/r2/get-presigned-download-url'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'

import { agentProcedure, createTRPCRouter } from '../init'

export const customerPipelinesRouter = createTRPCRouter({
  getCustomerPipelineItems: agentProcedure
    .input(z.object({
      pipeline: z.enum(pipelines).default('fresh'),
    }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const isOmni = ctx.ability.can('manage', 'all')
      return getCustomerPipelineItems(userId, input?.pipeline ?? 'fresh', isOmni)
    }),

  moveCustomerPipelineItem: agentProcedure
    .input(z.object({
      customerId: z.string().uuid(),
      fromStage: z.string(),
      toStage: z.string(),
      pipeline: z.enum(pipelines).default('fresh'),
    }))
    .mutation(async ({ ctx, input }) => {
      const isOmni = ctx.ability.can('manage', 'all')
      await moveCustomerPipelineItem({
        ...input,
        userId: ctx.session.user.id,
        isOmni,
      })
    }),

  moveCustomerToPipeline: agentProcedure
    .input(z.object({
      customerId: z.string().uuid(),
      pipeline: z.enum(meetingPipelines),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.ability.cannot('manage', 'CustomerPipeline')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to move customers between pipelines' })
      }
      await moveCustomerToPipeline(input.customerId, input.pipeline)
    }),

  getCustomerProfile: agentProcedure
    .input(z.object({
      customerId: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      const isSuperAdmin = ctx.ability.can('manage', 'all')
      return getCustomerProfile(input.customerId, { userId: ctx.session.user.id, isSuperAdmin })
    }),

  getRecordingUrl: agentProcedure
    .input(z.object({
      customerId: z.string().uuid(),
    }))
    .query(async ({ input }) => {
      const [customer] = await db
        .select({ leadMetaJSON: customers.leadMetaJSON })
        .from(customers)
        .where(eq(customers.id, input.customerId))
        .limit(1)

      const meta = customer?.leadMetaJSON as LeadMeta | null
      if (!meta?.mp3RecordingKey) {
        return { url: null }
      }

      const url = await getPresignedDownloadUrl({
        bucket: R2_BUCKETS.homeownerFiles,
        pathKey: meta.mp3RecordingKey,
      })

      return { url }
    }),

  // Get projects + proposals for a customer via meeting context (used by customer pipelines sidebar)
  getCustomerProjects: agentProcedure
    .input(z.object({ meetingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const scopedCtx = buildUserContext(ctx.session.user.id, ctx.session.user.role, meetingServerSpec)
      const meeting = dalToTrpc(await meetingCrud.getById(scopedCtx, { id: input.meetingId }))
      if (!meeting?.customerId) {
        return { projects: [], proposals: [] }
      }
      const customerProjects = await db
        .select({ id: projects.id, title: projects.title, status: projects.status, pipelineStage: projects.pipelineStage, createdAt: projects.createdAt })
        .from(projects)
        .where(eq(projects.customerId, meeting.customerId))
        .orderBy(desc(projects.createdAt))
      const meetingProposals = await db
        .select({ id: proposals.id, label: proposals.label, status: proposals.status, createdAt: proposals.createdAt })
        .from(proposals)
        .where(eq(proposals.meetingId, input.meetingId))
        .orderBy(desc(proposals.createdAt))
      return { projects: customerProjects, proposals: meetingProposals }
    }),

  // Assign a meeting to a project (sets projectId + meetingOutcome)
  assignToProject: agentProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      projectId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.ability.cannot('update', 'Meeting')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to update meetings' })
      }
      return dalToTrpc(await meetingCrud.update(
        { session: ctx.session, ability: ctx.ability, scope: null },
        {
          id: input.meetingId,
          data: { projectId: input.projectId, meetingOutcome: 'converted_to_project' },
        },
      ))
    }),

})
