import { z } from 'zod'

import { customerPipelineStages } from '@/features/pipeline/constants/customer-pipeline-stages'
import { getCustomerPipelineItems } from '@/features/pipeline/dal/server/get-customer-pipeline-items'
import { getCustomerProfile } from '@/features/pipeline/dal/server/get-customer-profile'
import { moveCustomerPipelineItem } from '@/features/pipeline/dal/server/move-customer-pipeline-item'

import { agentProcedure, createTRPCRouter } from '../init'

export const pipelineRouter = createTRPCRouter({
  getCustomerPipelineItems: agentProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id
    return getCustomerPipelineItems(userId)
  }),

  moveCustomerPipelineItem: agentProcedure
    .input(z.object({
      customerId: z.string().uuid(),
      fromStage: z.enum(customerPipelineStages),
      toStage: z.enum(customerPipelineStages),
    }))
    .mutation(async ({ ctx, input }) => {
      await moveCustomerPipelineItem({
        ...input,
        userId: ctx.session.user.id,
      })
    }),

  getCustomerProfile: agentProcedure
    .input(z.object({
      customerId: z.string().uuid(),
    }))
    .query(async ({ input }) => {
      return getCustomerProfile(input.customerId)
    }),
})
