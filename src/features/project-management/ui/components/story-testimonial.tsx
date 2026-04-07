'use client'

import type { Project } from '@/shared/db/schema'
import { motion, useInView } from 'motion/react'
import { useRef } from 'react'

interface Props {
  project: Project
}

export function StoryTestimonial({ project }: Props) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  if (!project.homeownerQuote) {
    return null
  }

  return (
    <section ref={ref} className="bg-primary/5 py-16 lg:py-24">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.7 }}
        >
          {/* Decorative quote mark */}
          <span className="mb-6 block text-6xl font-serif leading-none text-primary/30 lg:text-8xl">
            &ldquo;
          </span>

          <blockquote className="-mt-8 text-xl leading-relaxed text-foreground/90 italic lg:text-2xl">
            {project.homeownerQuote}
          </blockquote>

          {project.homeownerName && (
            <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              &mdash;
              {' '}
              {project.homeownerName}
            </p>
          )}
        </motion.div>
      </div>
    </section>
  )
}
