import { z } from 'zod'
import { getPortfolioProjectDetail, getPortfolioProjects } from '@/shared/entities/projects/dal/server/queries'
import { baseProcedure, createTRPCRouter } from '../../init'

export const showroomDisplayRouter = createTRPCRouter({
  getAll: baseProcedure
    .query(async () => {
      return getPortfolioProjects()
    }),

  getDetail: baseProcedure
    .input(z.object({ accessor: z.string() }))
    .query(async ({ input }) => {
      return getPortfolioProjectDetail(input.accessor)
    }),
})
