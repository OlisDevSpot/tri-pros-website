'use client'

import { useQuery } from '@tanstack/react-query'
import { motion, useInView } from 'motion/react'
import { useRef, useState } from 'react'
import { useTRPC } from '@/trpc/helpers'
import { ProjectCard } from './project-card'

const ALL_TAG = 'All'

export function ProjectsGrid() {
  const trpc = useTRPC()
  const { data: rows = [], isLoading } = useQuery(
    trpc.landingRouter.projectsRouter.getProjects.queryOptions(),
  )
  const [activeTag, setActiveTag] = useState<string>(ALL_TAG)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })

  // Collect all unique tags from hoRequirements across projects
  const allTags = Array.from(
    new Set(
      rows.flatMap(row => row.project.hoRequirements ?? []),
    ),
  )

  const filtered = activeTag === ALL_TAG
    ? rows
    : rows.filter(row => row.project.hoRequirements?.includes(activeTag))

  return (
    <section className="py-20 lg:py-32 bg-background" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Our
            {' '}
            <span className="text-primary">Portfolio</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Real projects. Real results. Browse our completed work.
          </p>
        </motion.div>

        {/* Filter bar */}
        {allTags.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="flex flex-wrap gap-2 justify-center mb-10"
          >
            {[ALL_TAG, ...allTags].map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeTag === tag
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {tag}
              </button>
            ))}
          </motion.div>
        )}

        {/* Grid */}
        {isLoading
          ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <div key={i} className="aspect-4/3 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            )
          : filtered.length === 0
            ? (
                <div className="text-center py-20 text-muted-foreground">
                  No projects found
                  {activeTag !== ALL_TAG ? ` for "${activeTag}"` : ''}
                  .
                </div>
              )
            : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filtered.map((row, index) => (
                    <ProjectCard key={row.project.id} row={row} index={index} />
                  ))}
                </div>
              )}
      </div>
    </section>
  )
}
