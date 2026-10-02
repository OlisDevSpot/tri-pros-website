import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createProjectWithScopes, projectCrud, updateProjectWithScopes } from '@/shared/modules/projects/core/dal/server/crud'
import { getAllProjects, getProjectForEdit, listProjects, projectListInputSchema } from '@/shared/modules/projects/core/dal/server/queries'
import { projectFormSchema } from '@/shared/modules/projects/core/schemas'

import { agentProcedure, createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'
import { projectProcedure } from './procedures'

export const crudRouter = createTRPCRouter({
  getAll: agentProcedure
    .query(async () => {
      return getAllProjects()
    }),

  list: projectProcedure
    .input(projectListInputSchema)
    .query(async ({ ctx, input }) => dalToTrpc(await listProjects(ctx, input))),

  getForEdit: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      return getProjectForEdit(input.id)
    }),

  // Routes through projectCrud via createProjectWithScopes (scopeIds as a
  // call-site closure). scope:null — bare agentProcedure carries no scope, so
  // the crud runs unscoped, identical to the pre-D feature-DAL path (scope
  // tightening is the #285 tail).
  create: agentProcedure
    .input(projectFormSchema)
    .mutation(async ({ ctx, input }) => {
      const { scopeIds, ...projectData } = input
      return dalToTrpc(await createProjectWithScopes({ ...ctx, scope: null }, projectData, scopeIds ?? []))
    }),

  update: agentProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: projectFormSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { scopeIds, ...projectData } = input.data
      const project = dalToTrpc(await updateProjectWithScopes({ ...ctx, scope: null }, input.id, projectData, scopeIds))
      // The public story page is prerendered; without this, edits only appear after the next deploy.
      revalidatePath(`/portfolio/projects/${project.accessor}`)
      return project
    }),

  delete: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await projectCrud.delete({ ...ctx, scope: null }, { id: input.id }))
      return { success: true }
    }),
})
