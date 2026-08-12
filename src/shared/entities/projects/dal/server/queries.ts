import type { MediaFile, Project } from '@/shared/db/schema'
import type { PortfolioProject, PortfolioProjectDetail } from '@/shared/entities/projects/types'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/shared/db'
import { mediaFiles, projects, x_projectScopes } from '@/shared/db/schema'

export async function getPortfolioProjects(): Promise<PortfolioProject[]> {
  const rows = await db
    .select({
      project: projects,
      heroImage: mediaFiles,
    })
    .from(projects)
    .leftJoin(
      mediaFiles,
      and(
        eq(mediaFiles.projectId, projects.id),
        eq(mediaFiles.isHeroImage, true),
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
      .from(mediaFiles)
      .where(eq(mediaFiles.projectId, project.id))
      .orderBy(asc(mediaFiles.sortOrder), desc(mediaFiles.createdAt)),

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
  media: MediaFile[]
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
      .from(mediaFiles)
      .where(eq(mediaFiles.projectId, projectId))
      .orderBy(mediaFiles.sortOrder, mediaFiles.createdAt),
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
