import Image from 'next/image'
import Link from 'next/link'

import { getPublicProjects } from '@/features/landing/dal/server/projects'

interface PortfolioProofProps {
  tradeName: string
}

export async function PortfolioProof({ tradeName }: PortfolioProofProps) {
  const allProjects = await getPublicProjects()

  const tradeNameLower = tradeName.toLowerCase()
  const matchingProjects = allProjects
    .filter((p) => {
      const requirements = p.project.hoRequirements
      if (!requirements || !Array.isArray(requirements)) {
        return false
      }
      return requirements.some(req =>
        req.toLowerCase().includes(tradeNameLower),
      )
    })
    .slice(0, 3)

  if (matchingProjects.length === 0) {
    return null
  }

  return (
    <section className="container py-16 lg:py-24">
      <h2 className="text-3xl sm:text-4xl font-bold text-foreground text-center mb-12">
        See Our Work in Action
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {matchingProjects.map(({ project, heroImage }) => (
          <Link
            key={project.id}
            href={`/portfolio/${project.accessor}`}
            className="group block overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-lg"
          >
            <div className="relative aspect-4/3 overflow-hidden">
              {heroImage?.url
                ? (
                    <Image
                      src={heroImage.url}
                      alt={project.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  )
                : (
                    <div className="absolute inset-0 bg-muted flex items-center justify-center">
                      <span className="text-sm text-muted-foreground">No image</span>
                    </div>
                  )}
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {project.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {project.city}
                {', '}
                {project.state}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
