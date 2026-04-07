import { z } from 'zod'
import { getPortfolioProjectDetail } from '@/features/project-management/dal/server/get-portfolio-project-detail'
import { getPortfolioProjects } from '@/features/project-management/dal/server/get-portfolio-projects'
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
