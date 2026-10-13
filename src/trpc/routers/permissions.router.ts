import { packRules } from '@casl/ability/extra'
import z from 'zod'

import { userRoles } from '@/shared/constants/enums'

import { baseProcedure, createTRPCRouter } from '../init'

export const permissionsRouter = createTRPCRouter({
  // The browser names who it believes is signed in, and caches the answer under that name. A request
  // that is not that user in that role gets no rules, so one user's rules are never kept under another's.
  rules: baseProcedure
    .input(z.object({ userId: z.string(), role: z.enum(userRoles) }))
    .query(({ ctx, input }) => {
      const user = ctx.session?.user
      if (user?.id !== input.userId || user.role !== input.role) {
        return []
      }
      return packRules(ctx.actor.ability.rules)
    }),
})
