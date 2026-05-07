import { and, count, desc, eq, getTableColumns, gte, ilike, inArray, lte, or } from 'drizzle-orm'
import { z } from 'zod'
import { getProjectForEdit } from '@/features/project-management/dal/server/get-project-for-edit'
import { createProject, deleteProject, getAllProjects, updateProject } from '@/features/project-management/dal/server/manage-project'
import { projectStatuses } from '@/shared/constants/enums'
import { buildFilterWhere } from '@/shared/dal/server/query/filters'
import { paginate } from '@/shared/dal/server/query/output'
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

  // Server-paginated projects list. Drives the /dashboard/projects records page.
  //
  // Filters (URL-driven via the query toolkit):
  //   status:      multi-select on projects.status
  //   visibility:  'public' | 'draft' (mapped to projects.isPublic)
  //   completedAt: date-range on projects.completedAt
  //   createdAt:   date-range on projects.createdAt
  //
  // Search: ilike against projects.title OR projects.city.
  // Sort whitelist: title, city, status, isPublic, completedAt, createdAt.
  // Default order: createdAt DESC.
  //
  // Each row carries `scopeIds` (aggregated from x_projectScopes) so the row
  // detail sheet stays compatible with the existing project shape.
  list: agentProcedure
    .input(paginatedQueryInput({
      status: z.array(z.enum(projectStatuses)).optional(),
      visibility: z.enum(['public', 'draft']).optional(),
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

      const result = await paginate({
        query: () => db
          .select(getTableColumns(projects))
          .from(projects)
          .where(where)
          .orderBy(...orderBy)
          .limit(input.pagination.limit)
          .offset(input.pagination.offset),
        count: async () => {
          const [row] = await db
            .select({ c: count(projects.id) })
            .from(projects)
            .where(where)
          return row?.c ?? 0
        },
      })

      const projectIds = result.rows.map(r => r.id)
      const scopeRows = projectIds.length > 0
        ? await db
            .select({
              projectId: x_projectScopes.projectId,
              scopeId: x_projectScopes.scopeId,
            })
            .from(x_projectScopes)
            .where(inArray(x_projectScopes.projectId, projectIds))
        : []

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
        rows: result.rows.map(project => ({
          ...project,
          scopeIds: scopesByProject.get(project.id) ?? [],
        })),
        total: result.total,
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
