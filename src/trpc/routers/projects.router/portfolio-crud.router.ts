import { z } from 'zod'
import { getProjectForEdit } from '@/features/showroom/dal/server/get-project-for-edit'
import { createShowroomProject, deleteShowroomProject, getAllProjects, updateShowroomProject } from '@/features/showroom/dal/server/manage-project'
import { projectFormSchema } from '@/shared/entities/projects/schemas'
import { agentProcedure, createTRPCRouter } from '../../init'

export const portfolioCrudRouter = createTRPCRouter({
  getAll: agentProcedure
    .query(async () => {
      return getAllProjects()
    }),

  getForEdit: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      return getProjectForEdit(input.id)
    }),

  create: agentProcedure
    .input(projectFormSchema)
    .mutation(async ({ input }) => {
      const { scopeIds, ...projectData } = input
      return createShowroomProject(projectData, scopeIds ?? [])
    }),

  update: agentProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: projectFormSchema.partial(),
    }))
    .mutation(async ({ input }) => {
      const { scopeIds, ...projectData } = input.data
      return updateShowroomProject(input.id, projectData, scopeIds)
    }),

  delete: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await deleteShowroomProject(input.id)
      return { success: true }
    }),
})
