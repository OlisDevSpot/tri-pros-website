import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ShowroomProjectView } from '@/features/showroom/ui/views/showroom-project-view'
import { getShowroomProjectDetail } from '@/shared/dal/server/showroom/get-showroom-project-detail'
import { getShowroomProjects } from '@/shared/dal/server/showroom/get-showroom-projects'

interface Props {
  params: Promise<{ projectAccessor: string }>
}

export async function generateStaticParams() {
  try {
    const projects = await getShowroomProjects()
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
  const detail = await getShowroomProjectDetail(projectAccessor)

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
  const detail = await getShowroomProjectDetail(projectAccessor)

  if (!detail) {
    notFound()
  }

  return <ShowroomProjectView detail={detail} />
}
