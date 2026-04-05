import { z } from 'zod'
import { getShowroomProjectDetail } from '@/features/showroom/dal/server/get-showroom-project-detail'
import { getShowroomProjects } from '@/features/showroom/dal/server/get-showroom-projects'
import { baseProcedure, createTRPCRouter } from '../../init'

export const portfolioRouter = createTRPCRouter({
  getAll: baseProcedure
    .query(async () => {
      return getShowroomProjects()
    }),

  getDetail: baseProcedure
    .input(z.object({ accessor: z.string() }))
    .query(async ({ input }) => {
      return getShowroomProjectDetail(input.accessor)
    }),
})
