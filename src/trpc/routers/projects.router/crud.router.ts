import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createProjectWithScopes, projectCrud, updateProjectWithScopes } from '@/shared/modules/projects/core/dal/server/crud'
import { getProjectForEdit, listProjects, projectListInputSchema } from '@/shared/modules/projects/core/dal/server/queries'
import { projectFormSchema } from '@/shared/modules/projects/core/schemas'

import { agentProcedure, createTRPCRouter, superAdminProcedure } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'

export const crudRouter = createTRPCRouter({
  list: agentProcedure
    .input(projectListInputSchema)
    .query(async ({ ctx, input }) => dalToTrpc(await listProjects(ctx, input))),

  getForEdit: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => dalToTrpc(await getProjectForEdit(ctx, input.id))),

  // The portfolio editor: a project with no meeting is reached by nobody but whoever publishes.
  create: superAdminProcedure
    .input(projectFormSchema)
    .mutation(async ({ ctx, input }) => {
      const { scopeIds, ...projectData } = input
      return dalToTrpc(await createProjectWithScopes(ctx, projectData, scopeIds ?? []))
    }),

  update: agentProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: projectFormSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { scopeIds, ...projectData } = input.data
      const project = dalToTrpc(await updateProjectWithScopes(ctx, input.id, projectData, scopeIds))
      // The public story page is prerendered; without this, edits only appear after the next deploy.
      revalidatePath(`/portfolio/projects/${project.accessor}`)
      return project
    }),

  delete: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await projectCrud.delete(ctx, { id: input.id }))
      return { success: true }
    }),
})
