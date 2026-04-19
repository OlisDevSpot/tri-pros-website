import type { LeadMeta } from '@/shared/entities/customers/schemas'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getCustomerPipelineItems } from '@/features/customer-pipelines/dal/server/get-customer-pipeline-items'
import { getCustomerProfile } from '@/features/customer-pipelines/dal/server/get-customer-profile'
import { moveCustomerPipelineItem } from '@/features/customer-pipelines/dal/server/move-customer-pipeline-item'
import { moveCustomerToPipeline } from '@/features/customer-pipelines/dal/server/move-customer-to-pipeline'
import { meetingPipelines, pipelines } from '@/shared/constants/enums/pipelines'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { R2_BUCKETS } from '@/shared/services/r2/buckets'
import { getPresignedDownloadUrl } from '@/shared/services/r2/get-presigned-download-url'

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
      return getCustomerProfile(input.customerId, { isSuperAdmin })
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

})
