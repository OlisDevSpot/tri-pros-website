'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

import { PAST_RESULTS_SHOWN } from '@/features/proposal-flow/constants/past-results'
import { ROOTS } from '@/shared/config/roots'
import { OptimizedImage } from '@/shared/modules/media/core/components/display/optimized-image'
import { useTRPC } from '@/trpc/helpers'

export function RelatedProjects() {
  const trpc = useTRPC()
  const projects = useQuery(trpc.landingRouter.projectsRouter.getProjects.queryOptions())
  const rows = (projects.data ?? []).filter(r => r.heroImage).slice(0, PAST_RESULTS_SHOWN)

  return (
    <div className="px-4 py-12 sm:px-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <header className="grid gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Past results</p>
          <h2 id="related-projects-title" className="text-3xl font-semibold text-balance">Work we’ve finished for your neighbors</h2>
        </header>
        {/* A homeowner never meets an empty chapter: with nothing to show, one line points at the portfolio. */}
        {!projects.isPending && rows.length === 0
          ? (
              <p className="text-muted-foreground">
                {'Browse our finished projects in the '}
                <Link href={ROOTS.landing.portfolioProjects()} target="_blank" className="font-semibold text-foreground underline underline-offset-4">portfolio</Link>
                .
              </p>
            )
          : (
              <ul className="grid gap-4 @min-[700px]/proposal:grid-cols-3">
                {rows.map(({ project, heroImage }) => (
                  <li key={project.id}>
                    <Link href={ROOTS.landing.portfolioProject(project.accessor)} target="_blank" className="grid gap-2">
                      <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-muted">
                        {heroImage && <OptimizedImage file={heroImage} alt={project.title} fill sizes="(max-width: 700px) 100vw, 33vw" />}
                      </div>
                      <p className="font-bold">{project.title}</p>
                      <p className="text-sm text-muted-foreground">{[project.city, project.state].filter(Boolean).join(', ')}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
      </div>
    </div>
  )
}
