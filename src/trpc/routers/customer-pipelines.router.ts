import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import { getCustomerPipelineItems } from '@/features/customer-pipelines/dal/server/get-customer-pipeline-items'
import { getCustomerProfile } from '@/features/customer-pipelines/dal/server/get-customer-profile'
import { moveCustomerPipelineItem } from '@/features/customer-pipelines/dal/server/move-customer-pipeline-item'
import { moveCustomerToPipeline } from '@/features/customer-pipelines/dal/server/move-customer-to-pipeline'
import { customerPipelines } from '@/shared/constants/enums'

import { agentProcedure, createTRPCRouter } from '../init'

export const customerPipelinesRouter = createTRPCRouter({
  getCustomerPipelineItems: agentProcedure
    .input(z.object({
      pipeline: z.enum(customerPipelines).default('active'),
    }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const isOmni = ctx.ability.can('manage', 'all')
      return getCustomerPipelineItems(userId, input?.pipeline ?? 'active', isOmni)
    }),

  moveCustomerPipelineItem: agentProcedure
    .input(z.object({
      customerId: z.string().uuid(),
      fromStage: z.string(),
      toStage: z.string(),
      pipeline: z.enum(customerPipelines).default('active'),
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
      pipeline: z.enum(customerPipelines),
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
    .query(async ({ input }) => {
      return getCustomerProfile(input.customerId)
    }),
})
