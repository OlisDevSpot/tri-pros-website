import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPortfolioProjectDetail } from '@/features/project-management/dal/server/get-portfolio-project-detail'
import { getPortfolioProjects } from '@/features/project-management/dal/server/get-portfolio-projects'
import { ProjectStoryView } from '@/features/project-management/ui/views/project-story-view'

interface Props {
  params: Promise<{ projectAccessor: string }>
}

export async function generateStaticParams() {
  try {
    const projects = await getPortfolioProjects()
    return projects
      .filter(row => row.project.accessor)
      .map(row => ({ projectAccessor: row.project.accessor as string }))
  }
  catch {
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { projectAccessor } = await params
  const detail = await getPortfolioProjectDetail(projectAccessor)

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
  const detail = await getPortfolioProjectDetail(projectAccessor)

  if (!detail) {
    notFound()
  }

  return <ProjectStoryView detail={detail} />
}
