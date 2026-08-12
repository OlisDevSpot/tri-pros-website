import { z } from 'zod'

import { projectStatusBuckets, projectVisibilities } from '@/shared/constants/enums'
import { dateRangeSchema, paginatedQueryInput } from '@/shared/dal/server/lib/query/schemas'
import { createProject, deleteProject, updateProject } from '@/shared/entities/projects/dal/server/mutations'
import { getAllProjects, getProjectForEdit, listProjects } from '@/shared/entities/projects/dal/server/queries'
import { projectFormSchema } from '@/shared/entities/projects/schemas'

import { agentProcedure, createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'
import { projectProcedure } from './procedures'

export const crudRouter = createTRPCRouter({
  getAll: agentProcedure
    .query(async () => {
      return getAllProjects()
    }),

  // Server-paginated projects list for /dashboard/projects.
  // Each row carries `scopeIds` (aggregated from x_projectScopes) so the
  // detail sheet can resolve trade names without a per-row fetch.
  list: projectProcedure
    .input(paginatedQueryInput({
      // Status is derived from `pipelineStage`, never stored — callers filter by
      // the coarse bucket (active/completed/on_hold/cancelled) and the handler
      // expands it to the matching stages via `stagesForBuckets`.
      statusBucket: z.array(z.enum(projectStatusBuckets)).optional(),
      // Exclude pure-portfolio projects (no meetings) — showcase-only entries
      // that never ran the lifecycle. Real projects have ≥1 birthing meeting.
      excludePortfolio: z.boolean().optional(),
      visibility: z.enum(projectVisibilities).optional(),
      completedAt: dateRangeSchema.optional(),
      createdAt: dateRangeSchema.optional(),
    }))
    .query(async ({ ctx, input }) => dalToTrpc(await listProjects(ctx, input))),

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
