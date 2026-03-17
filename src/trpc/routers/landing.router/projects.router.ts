import z from 'zod'
import { getProjectByAccessor, getPublicProjects } from '@/features/landing/dal/server/projects'
import { baseProcedure, createTRPCRouter } from '../../init'

export const projectsRouter = createTRPCRouter({
  getProjects: baseProcedure.query(async () => {
    return getPublicProjects()
  }),

  getProjectByAccessor: baseProcedure
    .input(z.object({ accessor: z.string() }))
    .query(async ({ input }) => {
      return getProjectByAccessor(input.accessor)
    }),
})
