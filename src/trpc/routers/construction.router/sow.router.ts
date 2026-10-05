import { TRPCError } from '@trpc/server'
import z from 'zod'
import { constructionService } from '@/shared/modules/construction/service'
import { baseProcedure, createTRPCRouter } from '../../init'

export const sowRouter = createTRPCRouter({
  byScope: baseProcedure
    .input(z.object({ scopeId: z.string() }))
    .query(async ({ input }) => {
      try {
        return await constructionService.getSowTemplatesByScope(input.scopeId)
      }
      catch (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause: error })
      }
    }),

  content: baseProcedure
    .input(z.object({ sowId: z.string() }))
    .query(async ({ input }) => {
      try {
        return await constructionService.getSowContent(input.sowId)
      }
      catch (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause: error })
      }
    }),
})
