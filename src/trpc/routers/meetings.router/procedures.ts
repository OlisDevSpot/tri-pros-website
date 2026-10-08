import { TRPCError } from '@trpc/server'

import { agentProcedure } from '../../init'

/** The visit-message surfaces. No role is granted `VisitMessages`, so only a super-admin passes today. */
export const visitMessagesProcedure = agentProcedure.use(async ({ ctx, next }) => {
  if (ctx.actor.ability.cannot('read', 'VisitMessages')) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to see visit messages.' })
  }
  return next({ ctx })
})
