import type { ProjectStatusBucket, ProjectVisibility } from '@/shared/constants/enums'
import type { DateRange, PaginationFields, SortFields } from '@/shared/dal/server/lib/query/schemas'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { Project, ProjectMediaFile } from '@/shared/db/schema'
import type { PortfolioProject, PortfolioProjectDetail } from '@/shared/modules/projects/core/types'
import { and, asc, count, desc, eq, getTableColumns, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm'
import { stagesForBuckets } from '@/shared/constants/enums'
import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { buildFilterWhere } from '@/shared/dal/server/lib/query/filters'
import { buildOrderBy } from '@/shared/dal/server/lib/query/sort'
import { db } from '@/shared/db'
import { projectMediaFiles, projects, x_projectScopes } from '@/shared/db/schema'
import { hasAssociatedMeeting } from '@/shared/modules/projects/core/lib/visibility'

export async function getPortfolioProjects(): Promise<PortfolioProject[]> {
  const rows = await db
    .select({
      project: projects,
      heroImage: projectMediaFiles,
    })
    .from(projects)
    .leftJoin(
      projectMediaFiles,
      and(
        eq(projectMediaFiles.projectId, projects.id),
        eq(projectMediaFiles.isHeroImage, true),
      ),
    )
    .where(eq(projects.isPublic, true))
    .orderBy(asc(projects.title))

  // Deduplicate: one row per project (take the first hero image match)
  const seen = new Set<string>()
  const uniqueRows = rows.filter((row) => {
    if (seen.has(row.project.id)) {
      return false
    }
    seen.add(row.project.id)
    return true
  })

  if (uniqueRows.length === 0) {
    return []
  }

  // Fetch scope IDs (Notion UUIDs) for all projects
  const scopeRows = await db
    .select({
      projectId: x_projectScopes.projectId,
      scopeId: x_projectScopes.scopeId,
    })
    .from(x_projectScopes)

  // Group scope IDs by project
  const scopesByProject = new Map<string, string[]>()
  for (const row of scopeRows) {
    if (!scopesByProject.has(row.projectId)) {
      scopesByProject.set(row.projectId, [])
    }
    scopesByProject.get(row.projectId)!.push(row.scopeId)
  }

  return uniqueRows.map(row => ({
    project: row.project,
    heroImage: row.heroImage,
    scopeIds: scopesByProject.get(row.project.id) ?? [],
  }))
}

export async function getPortfolioProjectDetail(accessor: string): Promise<PortfolioProjectDetail | null> {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.accessor, accessor), eq(projects.isPublic, true)))

  if (!project) {
    return null
  }

  const [media, scopeRows] = await Promise.all([
    db
      .select()
      .from(projectMediaFiles)
      .where(eq(projectMediaFiles.projectId, project.id))
      .orderBy(asc(projectMediaFiles.sortOrder), desc(projectMediaFiles.createdAt)),

    db
      .select({ scopeId: x_projectScopes.scopeId })
      .from(x_projectScopes)
      .where(eq(x_projectScopes.projectId, project.id)),
  ])

  return {
    project,
    media: {
      hero: media.filter(f => f.isHeroImage),
      before: media.filter(f => f.phase === 'before' && !f.mimeType.startsWith('video/')),
      during: media.filter(f => f.phase === 'during' && !f.mimeType.startsWith('video/')),
      after: media.filter(f => f.phase === 'after' && !f.mimeType.startsWith('video/')),
      uncategorized: media.filter(f => f.phase === 'uncategorized' && !f.mimeType.startsWith('video/')),
      videos: media.filter(f => f.mimeType.startsWith('video/')),
      all: media,
    },
    scopeIds: scopeRows.map(r => r.scopeId),
  }
}

export interface ProjectForEdit {
  project: Project
  scopeIds: string[]
  media: ProjectMediaFile[]
}

export async function getProjectForEdit(projectId: string): Promise<ProjectForEdit | null> {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))

  if (!project) {
    return null
  }

  const [scopeRows, media] = await Promise.all([
    db
      .select({ scopeId: x_projectScopes.scopeId })
      .from(x_projectScopes)
      .where(eq(x_projectScopes.projectId, projectId)),
    db
      .select()
      .from(projectMediaFiles)
      .where(eq(projectMediaFiles.projectId, projectId))
      .orderBy(projectMediaFiles.sortOrder, projectMediaFiles.createdAt),
  ])

  return {
    project,
    scopeIds: scopeRows.map(r => r.scopeId),
    media,
  }
}

interface ProjectWithScopeIds extends Project {
  scopeIds: string[]
}

export async function getAllProjects(): Promise<ProjectWithScopeIds[]> {
  const rows = await db
    .select()
    .from(projects)
    .orderBy(asc(projects.title))

  const scopeRows = rows.length > 0
    ? await db
        .select({
          projectId: x_projectScopes.projectId,
          scopeId: x_projectScopes.scopeId,
        })
        .from(x_projectScopes)
        .where(inArray(x_projectScopes.projectId, rows.map(r => r.id)))
    : []

  const scopesByProject = new Map<string, string[]>()
  for (const row of scopeRows) {
    if (!scopesByProject.has(row.projectId)) {
      scopesByProject.set(row.projectId, [])
    }
    scopesByProject.get(row.projectId)!.push(row.scopeId)
  }

  return rows.map(project => ({
    ...project,
    scopeIds: scopesByProject.get(project.id) ?? [],
  }))
}

/** `crud.list` input shape — mirrors the router's `paginatedQueryInput({...})` schema (kept in crud.router.ts). */
export interface ProjectListInput {
  pagination: PaginationFields
  sort?: SortFields
  search?: string
  filters?: {
    statusBucket?: ProjectStatusBucket[]
    excludePortfolio?: boolean
    visibility?: ProjectVisibility
    completedAt?: DateRange
    createdAt?: DateRange
  }
}

/**
 * Server-paginated projects list for /dashboard/projects. Each row carries
 * `scopeIds` (aggregated from x_projectScopes) so the detail sheet can
 * resolve trade names without a per-row fetch. Scope is set by middleware
 * (`projectProcedure` → `ctx.scope`; null for omni).
 */
export async function listProjects(
  ctx: ScopedContext,
  input: ProjectListInput,
): Promise<DalReturn<{ rows: ProjectWithScopeIds[], total: number }>> {
  return dalDbOperation(async () => {
    const scopeWhere = ctx.scope ?? undefined

    const searchTerm = input.search?.trim()
    const searchWhere = searchTerm
      ? or(
          ilike(projects.title, `%${searchTerm}%`),
          ilike(projects.city, `%${searchTerm}%`),
        )
      : undefined

    const filterWhere = buildFilterWhere(input.filters, {
      // Expand the requested buckets to their stages. coalesce null→'closed'
      // so a stray unset-stage project groups with Completed, matching
      // deriveProjectStatusBucket's null fallback. (Pure-portfolio nulls are
      // separately dropped by excludePortfolio.)
      statusBucket: v => (v.length > 0 ? inArray(sql`coalesce(${projects.pipelineStage}, 'closed')`, stagesForBuckets(v)) : undefined),
      excludePortfolio: v => (v ? hasAssociatedMeeting() : undefined),
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

    const where = and(scopeWhere, searchWhere, filterWhere)

    const orderBy = buildOrderBy(input.sort, {
      title: projects.title,
      city: projects.city,
      isPublic: projects.isPublic,
      completedAt: projects.completedAt,
      createdAt: projects.createdAt,
    })

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
  })
}

/**
 * Grouped scope-match counts for `getTradeImages` (landing page trade
 * carousels): how many of `scopeNotionIds` each matching project has
 * (`matchingRows`), and how many scopes each of those projects has in total
 * (`totalRows`) — used to tell single-trade projects from multi-trade ones.
 */
export async function getProjectScopeCountsByScopeIds(scopeNotionIds: string[]): Promise<{
  matchingRows: { projectId: string, matchCount: number }[]
  totalRows: { projectId: string, totalCount: number }[]
}> {
  const matchingRows = await db
    .select({ projectId: x_projectScopes.projectId, matchCount: count() })
    .from(x_projectScopes)
    .where(inArray(x_projectScopes.scopeId, scopeNotionIds))
    .groupBy(x_projectScopes.projectId)

  const projectIds = matchingRows.map(r => r.projectId)
  if (projectIds.length === 0) {
    return { matchingRows, totalRows: [] }
  }

  const totalRows = await db
    .select({ projectId: x_projectScopes.projectId, totalCount: count() })
    .from(x_projectScopes)
    .where(inArray(x_projectScopes.projectId, projectIds))
    .groupBy(x_projectScopes.projectId)

  return { matchingRows, totalRows }
}
