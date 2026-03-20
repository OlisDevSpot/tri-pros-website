'use client'

import type { MediaFile, Project } from '@/shared/db/schema'
import type { ProjectMediaGroups } from '@/shared/entities/projects/types'
import { motion, useInView } from 'motion/react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { PHASE_CONFIG } from '@/features/showroom/constants/phase-config'
import { PhaseCarousel } from '@/features/showroom/ui/components/phase-carousel'
import { PhotoLightbox } from '@/features/showroom/ui/components/photo-lightbox'

interface TimelinePhase {
  key: string
  label: string
  description: string | null
  photos: MediaFile[]
}

interface Props {
  project: Project
  media: ProjectMediaGroups
}

export function StoryTimeline({ project, media }: Props) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  const [lightbox, setLightbox] = useState<{ phaseKey: string, index: number } | null>(null)

  const handlePhotoClick = useCallback((phaseKey: string, index: number) => {
    setLightbox({ phaseKey, index })
  }, [])

  const handleCloseLightbox = useCallback(() => setLightbox(null), [])
  const handleNavigate = useCallback((index: number) => {
    setLightbox(prev => prev ? { ...prev, index } : null)
  }, [])

  const phases = useMemo<TimelinePhase[]>(() => {
    const descriptionMap: Record<string, string | null> = {
      before: project.beforeDescription,
      during: project.duringDescription,
      after: project.afterDescription,
      main: project.mainDescription,
    }

    return PHASE_CONFIG
      .filter(cfg => media[cfg.key].length > 0)
      .map(cfg => ({
        key: cfg.key,
        label: cfg.label,
        description: descriptionMap[cfg.key] ?? cfg.fallbackDescription,
        photos: media[cfg.key],
      }))
  }, [project, media])

  if (phases.length === 0) {
    return null
  }

  const lightboxPhase = lightbox ? phases.find(p => p.key === lightbox.phaseKey) : null

  return (
    <>
      <section ref={ref} className="bg-muted/20 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.6 }}
            className="mb-12 text-center"
          >
            <h2 className="mb-2 text-2xl font-bold text-foreground lg:text-3xl">
              The Journey
            </h2>
            <p className="text-muted-foreground">Follow this project from start to finish</p>
          </motion.div>

          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-5 top-0 hidden h-full w-px bg-border md:block" />

            <div className="space-y-16">
              {phases.map((phase, index) => (
                <motion.div
                  key={phase.key}
                  initial={{ opacity: 0, y: 30 }}
                  animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                  transition={{ duration: 0.5, delay: index * 0.15 }}
                  className="relative"
                >
                  {/* Timeline dot */}
                  <div className="absolute left-5 top-0 z-10 hidden h-3 w-3 -translate-x-1/2 rounded-full border-2 border-primary bg-background md:block" />

                  <div className="md:pl-14">
                    {/* Phase header */}
                    <div className="mb-4">
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                        Step
                        {' '}
                        {index + 1}
                      </span>
                      <h3 className="mt-1 text-xl font-semibold text-foreground">{phase.label}</h3>
                      {phase.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{phase.description}</p>
                      )}
                    </div>

                    {/* Carousel */}
                    <PhaseCarousel
                      photos={phase.photos}
                      phaseLabel={phase.label}
                      onPhotoClick={(index) => handlePhotoClick(phase.key, index)}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {lightbox && lightboxPhase && (
        <PhotoLightbox
          photos={lightboxPhase.photos}
          currentIndex={lightbox.index}
          onClose={handleCloseLightbox}
          onNavigate={handleNavigate}
        />
      )}
    </>
  )
}
