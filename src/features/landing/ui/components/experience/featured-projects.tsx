'use client'

import type { PublicProject } from '@/shared/entities/projects/types'
import { motion, useInView } from 'motion/react'
import { useRef } from 'react'
import { STAGGER_CONTAINER, VIEWPORT_MARGIN } from '@/features/landing/constants/experience-motion'
import { ROOTS } from '@/shared/config/roots'
import { cn } from '@/shared/lib/utils'
import { FeaturedProjectCard } from './featured-project-card'
import { SectionHeading } from './section-heading'

interface FeaturedProjectsProps {
  projects: PublicProject[]
}

export function FeaturedProjects({ projects }: FeaturedProjectsProps) {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: VIEWPORT_MARGIN })

  if (projects.length === 0) {
    return null
  }

  return (
    <section ref={ref} className="py-20 lg:py-32">
      <div className="container">
        <SectionHeading
          eyebrow="Featured Projects"
          trailing={{ label: 'View All Projects', href: ROOTS.landing.portfolioProjects() }}
        >
          Where craft meets
          {' '}
          <em className="italic text-primary">care</em>
          .
        </SectionHeading>

        <motion.div
          variants={STAGGER_CONTAINER}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className={cn(
            'grid gap-8 lg:gap-10',
            projects.length === 1 && 'grid-cols-1 max-w-3xl mx-auto',
            projects.length === 2 && 'grid-cols-1 md:grid-cols-2',
            projects.length >= 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
          )}
        >
          {projects.map(row => (
            <FeaturedProjectCard key={row.project.id} row={row} />
          ))}
        </motion.div>
      </div>
    </section>
  )
}
