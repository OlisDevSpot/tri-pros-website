import { getActionQueue } from '@/features/agent-dashboard/dal/server/get-action-queue'

import { agentProcedure, createTRPCRouter } from '../init'

export const dashboardRouter = createTRPCRouter({
  getActionQueue: agentProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id
    return getActionQueue(userId)
  }),
})
