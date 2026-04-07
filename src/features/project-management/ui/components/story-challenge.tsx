'use client'

import type { MediaFile, Project } from '@/shared/db/schema'
import { motion, useInView } from 'motion/react'
import { useRef } from 'react'
import { OptimizedImage } from '@/shared/components/optimized-image'

interface Props {
  project: Project
  mainImage: MediaFile | undefined
}

export function StoryChallenge({ project, mainImage }: Props) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  const hasContent = project.backstory || project.challengeDescription
  if (!hasContent) {
    return null
  }

  return (
    <section ref={ref} className="bg-background py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">
            Their Story
          </h2>
          <div className="h-1 w-12 rounded-full bg-primary" />
        </motion.div>

        <div className={`grid gap-10 ${mainImage ? 'lg:grid-cols-2' : 'max-w-3xl'}`}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="space-y-6"
          >
            {project.backstory && (
              <p className="text-lg leading-relaxed text-foreground/90">
                {project.backstory}
              </p>
            )}
            {project.challengeDescription && (
              <div className="rounded-lg border-l-4 border-primary/30 bg-muted/50 p-5">
                <p className="text-sm font-medium text-muted-foreground mb-1">The Challenge</p>
                <p className="text-foreground/80 leading-relaxed">
                  {project.challengeDescription}
                </p>
              </div>
            )}
          </motion.div>

          {mainImage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative aspect-4/3 overflow-hidden rounded-2xl"
            >
              <OptimizedImage
                file={mainImage}
                alt={mainImage.name}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </motion.div>
          )}
        </div>
      </div>
    </section>
  )
}
