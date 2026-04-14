import { TRPCError } from '@trpc/server'
import z from 'zod'
import { getTypedKeys } from '@/shared/lib/utils'
import { constructionDataService } from '@/shared/services/construction-data.service'
import { scopeOrAddonSchema } from '@/shared/services/notion/lib/scopes/schema'
import { baseProcedure, createTRPCRouter } from '../../init'

export const scopesRouter = createTRPCRouter({
  getAll: baseProcedure
    .query(async () => {
      return constructionDataService.getAllScopes()
    }),
  getScopesByQuery: baseProcedure
    .input(z.object({
      query: z.string().optional(),
      filterProperty: z.enum(getTypedKeys(scopeOrAddonSchema.omit({ id: true, coverImageUrl: true }).shape)).optional(),
      sortBy: z.object({
        property: z.enum(getTypedKeys(scopeOrAddonSchema.omit({ id: true, coverImageUrl: true }).shape)),
        direction: z.enum(['ascending', 'descending']).optional().default('ascending'),
      }).optional(),
    }))
    .query(async ({ input }) => {
      return constructionDataService.getScopesByQuery(input)
    }),
  getScopesByTrade: baseProcedure
    .input(z.object({ tradeId: z.string() }))
    .query(async ({ input }) => {
      return constructionDataService.getScopesByTrade({ tradeId: input.tradeId })
    }),
  getAllSOW: baseProcedure
    .input(z.object({ scopeId: z.string() }))
    .query(async ({ input }) => {
      try {
        return await constructionDataService.getSOWsByScope({ scopeId: input.scopeId })
      }
      catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          cause: error,
        })
      }
    }),
  getSOWContent: baseProcedure
    .input(z.object({ sowId: z.string() }))
    .query(async ({ input }) => {
      try {
        return await constructionDataService.getSOWContent({ sowId: input.sowId })
      }
      catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          cause: error,
        })
      }
    }),
})
