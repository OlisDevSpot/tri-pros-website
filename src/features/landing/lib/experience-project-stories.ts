import type { PublicProject } from '@/shared/entities/projects/types'
import { testimonials } from '@/shared/constants/company/testimonials'

export interface ProjectStorySlide {
  kind: 'project' | 'testimonial'
  imageUrl: string | null
  imageAlt: string
  quote: string
  homeowner: string
  meta: string
  href: string | null
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

function projectToSlide(row: PublicProject): ProjectStorySlide {
  const { project, heroImage } = row
  const location = [project.city, project.state].filter(Boolean).join(', ')
  const completed = formatCompletedAt(project.completedAt)
  const metaParts = [project.title, location, completed && `Completed ${completed}`].filter(Boolean)

  return {
    kind: 'project',
    imageUrl: heroImage?.url ?? null,
    imageAlt: project.title,
    quote: project.homeownerQuote ?? project.description ?? '',
    homeowner: project.homeownerName ?? '',
    meta: metaParts.join(' · '),
    href: project.accessor ? `/portfolio/projects/${project.accessor}` : null,
  }
}

function testimonialToSlide(t: (typeof testimonials)[number]): ProjectStorySlide {
  return {
    kind: 'testimonial',
    imageUrl: t.image,
    imageAlt: `${t.name}, ${t.project}`,
    quote: t.text,
    homeowner: t.name,
    meta: [t.project, t.location].filter(Boolean).join(' · '),
    href: null,
  }
}

/**
 * Compose the Project Stories carousel slides.
 *
 * Priority: real public projects with homeowner quotes first (real-world
 * images + real proof). Fills out with hardcoded testimonials so the section
 * is always populated. Capped at 8 slides total.
 */
export function buildProjectStorySlides(projects: PublicProject[]): ProjectStorySlide[] {
  const projectSlides = projects
    .filter(row => row.project.homeownerQuote && row.heroImage?.url)
    .sort((a, b) => (b.project.completedAt ?? '').localeCompare(a.project.completedAt ?? ''))
    .map(projectToSlide)

  const testimonialSlides = testimonials.map(testimonialToSlide)

  return [...projectSlides, ...testimonialSlides].slice(0, 8)
}
