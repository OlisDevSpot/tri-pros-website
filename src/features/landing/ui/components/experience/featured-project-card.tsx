'use client'

import type { PublicProject } from '@/shared/entities/projects/types'
import { ArrowUpRight } from 'lucide-react'
import { motion } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { STAGGER_CHILD } from '@/features/landing/constants/experience-motion'

interface FeaturedProjectCardProps {
  row: PublicProject
}

export function FeaturedProjectCard({ row }: FeaturedProjectCardProps) {
  const { project, heroImage } = row
  const tag = project.hoRequirements?.[0]
  const location = [project.city, project.state].filter(Boolean).join(', ')

  return (
    <motion.article variants={STAGGER_CHILD}>
      <Link
        href={`/portfolio/projects/${project.accessor ?? ''}`}
        className="group block"
      >
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-card mb-5">
          {heroImage?.url
            ? (
                <Image
                  src={heroImage.url}
                  alt={project.title}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  className="object-cover transition-transform duration-[800ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:scale-[1.04]"
                />
              )
            : (
                <div className="h-full w-full bg-gradient-to-br from-foreground/5 to-foreground/[0.02]" />
              )}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent opacity-80" />
        </div>

        {tag
          ? (
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground border border-foreground/10 bg-foreground/[0.03]">
                  {tag}
                </span>
              </div>
            )
          : null}

        <h3 className="font-serif text-2xl lg:text-3xl leading-[1.15] text-foreground group-hover:text-primary transition-colors duration-300 mb-2">
          {project.title}
        </h3>

        {location
          ? <p className="text-sm text-muted-foreground mb-5">{location}</p>
          : null}

        <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-foreground">
          View Project
          <ArrowUpRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </Link>
    </motion.article>
  )
}
