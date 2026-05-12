import type { PublicProject } from '@/shared/entities/projects/types'

export interface ProjectStorySlide {
  imageUrl: string
  imageAlt: string
  quote: string
  homeowner: string
  meta: string
  href: string
}

function formatCompletedAt(iso: string | null): string {
  if (!iso) {
    return ''
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function projectToSlide(row: PublicProject): ProjectStorySlide | null {
  const { project, heroImage } = row
  if (!project.homeownerQuote || !heroImage?.url || !project.accessor) {
    return null
  }
  const location = [project.city, project.state].filter(Boolean).join(', ')
  const completed = formatCompletedAt(project.completedAt)
  const metaParts = [project.title, location, completed && `Completed ${completed}`].filter(Boolean)

  return {
    imageUrl: heroImage.url,
    imageAlt: project.title,
    quote: project.homeownerQuote,
    homeowner: project.homeownerName ?? 'Tri Pros Homeowner',
    meta: metaParts.join(' · '),
    href: `/portfolio/projects/${project.accessor}`,
  }
}

/**
 * Build slides for the Project Stories carousel.
 *
 * STRICT: real DB projects only. Each project must have a hero image, a
 * homeowner quote, and an accessor (URL slug). If no projects meet those
 * conditions, the carousel section is hidden entirely — we do not fall back
 * to fake/seeded testimonial data. Sorted newest-first by completedAt.
 */
export function buildProjectStorySlides(projects: PublicProject[]): ProjectStorySlide[] {
  return projects
    .sort((a, b) => (b.project.completedAt ?? '').localeCompare(a.project.completedAt ?? ''))
    .map(projectToSlide)
    .filter((slide): slide is ProjectStorySlide => slide !== null)
    .slice(0, 8)
}
