import { z } from 'zod'

import { meetingPipelineStages } from '@/features/agent-dashboard/constants/pipeline-stages'
import { getActionQueue } from '@/shared/dal/server/dashboard/get-action-queue'
import { getMeetingPipelineItems, getProposalPipelineItems } from '@/shared/dal/server/dashboard/get-pipeline-items'
import { getPipelineStats } from '@/shared/dal/server/dashboard/get-pipeline-stats'
import { moveMeetingPipelineItem } from '@/shared/dal/server/dashboard/move-pipeline-item'

import { agentProcedure, createTRPCRouter } from '../init'

export const dashboardRouter = createTRPCRouter({
  getActionQueue: agentProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id
    return getActionQueue(userId)
  }),

  getPipelineStats: agentProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id
    return getPipelineStats(userId)
  }),

  getMeetingPipelineItems: agentProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id
    return getMeetingPipelineItems(userId)
  }),

  getProposalPipelineItems: agentProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id
    return getProposalPipelineItems(userId)
  }),

  moveMeetingPipelineItem: agentProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      fromStage: z.enum(meetingPipelineStages),
      toStage: z.enum(meetingPipelineStages),
    }))
    .mutation(async ({ ctx, input }) => {
      await moveMeetingPipelineItem({
        ...input,
        userId: ctx.session.user.id,
      })
    }),
})
