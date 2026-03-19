import Image from 'next/image'
import Link from 'next/link'

import { getPublicProjects } from '@/features/landing/dal/server/projects'

interface PortfolioProofProps {
  tradeName: string
}

export async function PortfolioProof({ tradeName }: PortfolioProofProps) {
  const allProjects = await getPublicProjects()

  const tradeNameLower = tradeName.toLowerCase()

  // Score each project by how well it matches this trade:
  // 2 = trade is the only trade on the project (exclusive)
  // 1 = trade is one of multiple trades on the project
  // 0 = trade not present (fallback filler)
  function tradeMatchScore(reqs: string[] | null | undefined): number {
    if (!reqs || !Array.isArray(reqs) || reqs.length === 0) {
      return 0
    }
    const matchCount = reqs.filter(r => r.toLowerCase().includes(tradeNameLower)).length
    if (matchCount === 0) {
      return 0
    }
    return matchCount === reqs.length ? 2 : 1
  }

  const scored = allProjects
    .map(p => ({ p, score: tradeMatchScore(p.project.hoRequirements) }))
    .sort((a, b) => b.score - a.score)

  const matchingProjects = scored.slice(0, 3).map(({ p }) => p)

  if (matchingProjects.length === 0) {
    return null
  }

  const [featured, ...minis] = matchingProjects

  const cityList = matchingProjects
    .map(p => [p.project.city, p.project.state].filter(Boolean).join(', '))
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="container py-16 lg:py-24">
      <div className="text-center mb-12">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
          Real results
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
          A home transformed — just like yours.
        </h2>
        {cityList && (
          <p className="text-sm text-muted-foreground mt-3">
            {cityList}
            {' '}
            — real Tri Pros projects near you
          </p>
        )}
      </div>

      {/* Featured card */}
      <div className="grid sm:grid-cols-2 rounded-xl overflow-hidden border bg-card mb-6">
        <div className="relative h-52 sm:h-auto">
          {featured.heroImage?.url
            ? (
                <Image
                  src={featured.heroImage.url}
                  alt={featured.project.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 50vw"
                  priority
                />
              )
            : (
                <div className="absolute inset-0 bg-muted" />
              )}
        </div>
        <div className="p-6 flex flex-col justify-between">
          <div>
            {featured.project.backstory && (
              <blockquote className="text-sm text-muted-foreground italic leading-relaxed border-l-2 border-primary pl-4 mb-4">
                {featured.project.backstory}
              </blockquote>
            )}
            <p className="text-xs font-semibold text-foreground">
              {featured.project.title}
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">
              {featured.project.city}
              {featured.project.state ? `, ${featured.project.state}` : ''}
            </p>
          </div>
          <Link
            href={`/portfolio/${featured.project.accessor}`}
            className="text-sm font-semibold text-primary hover:underline mt-4 inline-block"
          >
            See full project →
          </Link>
        </div>
      </div>

      {/* Mini cards */}
      {minis.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-4">
          {minis.map(({ project, heroImage }) => (
            <Link
              key={project.id}
              href={`/portfolio/${project.accessor}`}
              className="group block overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-lg"
            >
              <div className="relative h-36 overflow-hidden">
                {heroImage?.url
                  ? (
                      <Image
                        src={heroImage.url}
                        alt={project.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, 50vw"
                      />
                    )
                  : (
                      <div className="absolute inset-0 bg-muted flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">No image</span>
                      </div>
                    )}
              </div>
              <div className="p-4">
                <p className="text-xs font-semibold text-foreground">
                  {project.title}
                </p>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">
                  {project.city}
                  {project.state ? `, ${project.state}` : ''}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
