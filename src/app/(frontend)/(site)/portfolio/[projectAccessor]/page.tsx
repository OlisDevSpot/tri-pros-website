import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ProjectDetailView } from '@/features/landing/ui/views/project-detail-view'
import { getProjectByAccessor, getPublicProjects } from '@/shared/dal/server/landing/projects'

interface Props {
  params: Promise<{ projectAccessor: string }>
}

export async function generateStaticParams() {
  try {
    const projects = await getPublicProjects()
    return projects
      .filter(row => row.project.accessor)
      .map(row => ({ projectAccessor: row.project.accessor as string }))
  }
  catch {
    // Schema not yet migrated — skip static generation
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { projectAccessor } = await params
  const detail = await getProjectByAccessor(projectAccessor)

  if (!detail) {
    return { title: 'Project Not Found' }
  }

  return {
    title: detail.project.title,
    description: detail.project.backstory ?? detail.project.description ?? undefined,
    openGraph: {
      images: detail.media.hero[0]?.url
        ? [{ url: detail.media.hero[0].url }]
        : undefined,
    },
  }
}

export default async function ProjectDetailPage({ params }: Props) {
  const { projectAccessor } = await params
  const detail = await getProjectByAccessor(projectAccessor)

  if (!detail) {
    notFound()
  }

  return <ProjectDetailView detail={detail} />
}
