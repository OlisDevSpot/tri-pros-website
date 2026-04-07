import { z } from 'zod'
import { getProjectForEdit } from '@/features/project-management/dal/server/get-project-for-edit'
import { createProject, deleteProject, getAllProjects, updateProject } from '@/features/project-management/dal/server/manage-project'
import { projectFormSchema } from '@/shared/entities/projects/schemas'
import { agentProcedure, createTRPCRouter } from '../../init'

export const crudRouter = createTRPCRouter({
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
      return createProject(projectData, scopeIds ?? [])
    }),

  update: agentProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: projectFormSchema.partial(),
    }))
    .mutation(async ({ input }) => {
      const { scopeIds, ...projectData } = input.data
      return updateProject(input.id, projectData, scopeIds)
    }),

  delete: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await deleteProject(input.id)
      return { success: true }
    }),
})
