import type { Pipeline } from '@/shared/constants/enums/pipelines'
import type { AppAbility } from '@/shared/domains/permissions/types'

import { TRPCError } from '@trpc/server'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { moveCustomerPipelineItem } from '@/features/customer-pipelines/dal/server/move-customer-pipeline-item'
import { moveCustomerToPipeline } from '@/features/customer-pipelines/dal/server/move-customer-to-pipeline'
import { deriveProjectStatusBucket, meetingPipelines, pipelines } from '@/shared/constants/enums/pipelines'
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { db } from '@/shared/db'
import { customerLeadAttribution } from '@/shared/db/schema/customer-lead-attribution'
import { customers } from '@/shared/db/schema/customers'
import { projects } from '@/shared/db/schema/projects'
import { proposals } from '@/shared/db/schema/proposals'
import { getAccessiblePipelines } from '@/shared/domains/pipelines/lib/get-accessible-pipelines'
import { getCustomerProfile } from '@/shared/entities/customers/dal/server/get-customer-profile'
import { customerPipelineItemsInputSchema, getCustomerPipelineItems } from '@/shared/entities/customers/dal/server/pipeline-items'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { r2Client } from '@/shared/services/providers/r2/client'
import { R2_BUCKETS } from '@/shared/services/providers/r2/types'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'

import { agentProcedure, createTRPCRouter } from '../init'

// A pipeline the role is not offered is refused, not just untabbed: the projects pipeline carries values.
function assertPipelineOpen(ability: AppAbility, pipeline: Pipeline) {
  if (!getAccessiblePipelines(ability).includes(pipeline)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'This pipeline is not available to your role.' })
  }
}

export const customerPipelinesRouter = createTRPCRouter({
  getCustomerPipelineItems: agentProcedure
    .input(customerPipelineItemsInputSchema)
    .query(async ({ ctx, input }) => {
      assertPipelineOpen(ctx.actor.ability, input.pipeline)
      return dalToTrpc(await getCustomerPipelineItems(ctx, input))
    }),

  moveCustomerPipelineItem: agentProcedure
    .input(z.object({
      customerId: z.string().uuid(),
      fromStage: z.string(),
      toStage: z.string(),
      pipeline: z.enum(pipelines).default('fresh'),
    }))
    .mutation(async ({ ctx, input }) => {
      assertPipelineOpen(ctx.actor.ability, input.pipeline)
      await moveCustomerPipelineItem({
        ...input,
        user: { userId: ctx.session.user.id, ability: ctx.actor.ability },
      })
    }),

  moveCustomerToPipeline: agentProcedure
    .input(z.object({
      customerId: z.string().uuid(),
      pipeline: z.enum(meetingPipelines),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.actor.ability.cannot('manage', 'CustomerPipeline')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to move customers between pipelines' })
      }
      await moveCustomerToPipeline(ctx, input.customerId, input.pipeline)
    }),

  getCustomerProfile: agentProcedure
    .input(z.object({
      customerId: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => getCustomerProfile(ctx, input.customerId)),

  getRecordingUrl: agentProcedure
    .input(z.object({
      customerId: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      if (!(await permit(ctx, 'read', customerServerSpec).probe(input.customerId))) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }
      const [row] = await db
        .select({ captureJSON: customerLeadAttribution.captureJSON })
        .from(customers)
        .leftJoin(customerLeadAttribution, eq(customerLeadAttribution.customerId, customers.id))
        .where(eq(customers.id, input.customerId))
        .limit(1)

      const meta = row?.captureJSON ?? null
      if (!meta?.mp3RecordingKey) {
        return { url: null }
      }

      const url = await r2Client.getPresignedDownloadUrl({
        bucket: R2_BUCKETS.homeownerFiles,
        pathKey: meta.mp3RecordingKey,
      })

      return { url }
    }),

  // Get projects + proposals for a customer via meeting context (used by customer pipelines sidebar)
  getCustomerProjects: agentProcedure
    .input(z.object({ meetingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const meeting = dalToTrpc(await meetingCrud.getById(ctx, { id: input.meetingId }))
      if (!meeting?.customerId) {
        return { projects: [], proposals: [] }
      }
      const customerProjectRows = await db
        .select({ id: projects.id, title: projects.title, pipelineStage: projects.pipelineStage, createdAt: projects.createdAt })
        .from(projects)
        .where(eq(projects.customerId, meeting.customerId))
        .orderBy(desc(projects.createdAt))
      // status is derived from pipelineStage (the column was removed)
      const customerProjects = customerProjectRows.map(p => ({ ...p, status: deriveProjectStatusBucket(p.pipelineStage) }))
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
      // The meeting side is the actor's reach; the project side waits for the Project family.
      return dalToTrpc(await meetingCrud.update(ctx, {
        id: input.meetingId,
        data: { projectId: input.projectId, meetingOutcome: 'converted_to_project' },
      }))
    }),

})
