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
      const isOmni = ctx.session.user.role === 'super-admin'
      return getCustomerPipelineItems(userId, input?.pipeline ?? 'active', { omni: isOmni })
    }),

  moveCustomerPipelineItem: agentProcedure
    .input(z.object({
      customerId: z.string().uuid(),
      fromStage: z.string(),
      toStage: z.string(),
      pipeline: z.enum(customerPipelines).default('active'),
    }))
    .mutation(async ({ ctx, input }) => {
      await moveCustomerPipelineItem({
        ...input,
        userId: ctx.session.user.id,
      })
    }),

  moveCustomerToPipeline: agentProcedure
    .input(z.object({
      customerId: z.string().uuid(),
      pipeline: z.enum(customerPipelines),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.user.role !== 'super-admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only super-admins can move customers between pipelines' })
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
