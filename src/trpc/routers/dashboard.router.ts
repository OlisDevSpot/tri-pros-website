import { z } from 'zod'

import { meetingPipelineStages, proposalPipelineStages } from '@/features/agent-dashboard/constants/pipeline-stages'
import { getActionQueue } from '@/shared/dal/server/dashboard/get-action-queue'
import { getMeetingPipelineItems, getProposalPipelineItems } from '@/shared/dal/server/dashboard/get-pipeline-items'
import { getPipelineStats } from '@/shared/dal/server/dashboard/get-pipeline-stats'
import { movePipelineItem } from '@/shared/dal/server/dashboard/move-pipeline-item'

import { agentProcedure, createTRPCRouter } from '../init'

const pipelineItemSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('proposal'),
    pipelineItemId: z.string(),
    fromStage: z.enum(proposalPipelineStages),
    toStage: z.enum(proposalPipelineStages),
  }),
  z.object({
    type: z.literal('meeting'),
    pipelineItemId: z.string(),
    fromStage: z.enum(meetingPipelineStages),
    toStage: z.enum(meetingPipelineStages),
  }),
])

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

  movePipelineItem: agentProcedure
    .input(pipelineItemSchema)
    .mutation(async ({ ctx, input }) => {
      await movePipelineItem({
        ...input,
        userId: ctx.session.user.id,
      })
    }),
})
