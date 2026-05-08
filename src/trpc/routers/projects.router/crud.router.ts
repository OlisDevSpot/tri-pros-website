import { and, count, desc, eq, getTableColumns, gte, ilike, inArray, lte, or } from 'drizzle-orm'
import { z } from 'zod'
import { getProjectForEdit } from '@/features/project-management/dal/server/get-project-for-edit'
import { createProject, deleteProject, getAllProjects, updateProject } from '@/features/project-management/dal/server/manage-project'
import { projectStatuses, projectVisibilities } from '@/shared/constants/enums'
import { buildFilterWhere } from '@/shared/dal/server/query/filters'
import { dateRangeSchema, paginatedQueryInput } from '@/shared/dal/server/query/schemas'
import { buildOrderBy } from '@/shared/dal/server/query/sort'
import { db } from '@/shared/db'
import { projects, x_projectScopes } from '@/shared/db/schema'
import { projectFormSchema } from '@/shared/entities/projects/schemas'
import { agentProcedure, createTRPCRouter } from '../../init'

export const crudRouter = createTRPCRouter({
  getAll: agentProcedure
    .query(async () => {
      return getAllProjects()
    }),

  // Server-paginated projects list for /dashboard/projects.
  // Each row carries `scopeIds` (aggregated from x_projectScopes) so the
  // detail sheet can resolve trade names without a per-row fetch.
  list: agentProcedure
    .input(paginatedQueryInput({
      status: z.array(z.enum(projectStatuses)).optional(),
      visibility: z.enum(projectVisibilities).optional(),
      completedAt: dateRangeSchema.optional(),
      createdAt: dateRangeSchema.optional(),
    }))
    .query(async ({ input }) => {
      const searchTerm = input.search?.trim()
      const searchWhere = searchTerm
        ? or(
            ilike(projects.title, `%${searchTerm}%`),
            ilike(projects.city, `%${searchTerm}%`),
          )
        : undefined

      const filterWhere = buildFilterWhere(input.filters, {
        status: v => (v.length > 0 ? inArray(projects.status, v) : undefined),
        visibility: v => eq(projects.isPublic, v === 'public'),
        completedAt: v => and(
          v.from ? gte(projects.completedAt, v.from) : undefined,
          v.to ? lte(projects.completedAt, v.to) : undefined,
        ),
        createdAt: v => and(
          v.from ? gte(projects.createdAt, v.from) : undefined,
          v.to ? lte(projects.createdAt, v.to) : undefined,
        ),
      })

      const where = and(searchWhere, filterWhere)

      const orderBy = buildOrderBy(input.sort, {
        title: projects.title,
        city: projects.city,
        status: projects.status,
        isPublic: projects.isPublic,
        completedAt: projects.completedAt,
        createdAt: projects.createdAt,
      }, desc(projects.createdAt))

      // Page query resolves first; count + scopes overlap in flight.
      // Scopes only depend on the page's projectIds, not the count, so
      // serializing scopes behind `paginate()` would waste a round-trip.
      const rows = await db
        .select(getTableColumns(projects))
        .from(projects)
        .where(where)
        .orderBy(...orderBy)
        .limit(input.pagination.limit)
        .offset(input.pagination.offset)

      const projectIds = rows.map(r => r.id)

      const [total, scopeRows] = await Promise.all([
        db
          .select({ c: count(projects.id) })
          .from(projects)
          .where(where)
          .then(r => r[0]?.c ?? 0),
        projectIds.length > 0
          ? db
              .select({
                projectId: x_projectScopes.projectId,
                scopeId: x_projectScopes.scopeId,
              })
              .from(x_projectScopes)
              .where(inArray(x_projectScopes.projectId, projectIds))
          : Promise.resolve([] as { projectId: string, scopeId: string }[]),
      ])

      const scopesByProject = new Map<string, string[]>()
      for (const row of scopeRows) {
        const list = scopesByProject.get(row.projectId)
        if (list) {
          list.push(row.scopeId)
        }
        else {
          scopesByProject.set(row.projectId, [row.scopeId])
        }
      }

      return {
        rows: rows.map(project => ({
          ...project,
          scopeIds: scopesByProject.get(project.id) ?? [],
        })),
        total,
      }
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
