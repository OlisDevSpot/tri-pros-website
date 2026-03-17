'use client'

import type { CarouselApi } from '@/shared/components/ui/carousel'
import type { MediaFile, Project } from '@/shared/db/schema'
import type { ProjectMediaGroups } from '@/shared/entities/projects/types'
import { motion, useInView } from 'motion/react'
import Image from 'next/image'
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/shared/components/ui/carousel'
import { cn } from '@/shared/lib/utils'

interface TimelinePhase {
  key: string
  label: string
  description: string | null
  photos: MediaFile[]
}

const PHASE_CONFIG: { key: keyof ProjectMediaGroups, label: string, fallbackDescription: string }[] = [
  { key: 'before', label: 'Before', fallbackDescription: 'Where the project began' },
  { key: 'during', label: 'During', fallbackDescription: 'The transformation in progress' },
  { key: 'after', label: 'After', fallbackDescription: 'The finished result' },
]

interface Props {
  project: Project
  media: ProjectMediaGroups
}

export function StoryTimeline({ project, media }: Props) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

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

  return (
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
                  <PhaseCarousel photos={phase.photos} phaseLabel={phase.label} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

interface PhaseCarouselProps {
  photos: MediaFile[]
  phaseLabel: string
}

function PhaseCarousel({ photos, phaseLabel }: PhaseCarouselProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)

  const onSelect = useCallback(() => {
    if (!api) {
      return
    }
    setCurrent(api.selectedScrollSnap())
  }, [api])

  const handleSetApi = useCallback((newApi: CarouselApi) => {
    setApi(newApi)
    if (newApi) {
      newApi.on('select', onSelect)
    }
  }, [onSelect])

  return (
    <div className="space-y-3">
      <Carousel
        setApi={handleSetApi}
        opts={{ align: 'start', loop: photos.length > 1 }}
        className="w-full"
      >
        <CarouselContent className="-ml-3">
          {photos.map(photo => (
            <CarouselItem
              key={photo.id}
              className={cn(
                'pl-3',
                photos.length === 1
                  ? 'basis-full'
                  : 'basis-[85%] sm:basis-[70%] md:basis-[55%] lg:basis-[45%]',
              )}
            >
              <div className="relative aspect-video overflow-hidden rounded-xl shadow-lg">
                <Image
                  src={photo.url}
                  alt={photo.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 85vw, (max-width: 768px) 70vw, (max-width: 1024px) 55vw, 45vw"
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        {photos.length > 1 && (
          <>
            <CarouselPrevious className="-left-3 md:-left-5 bg-background/80 backdrop-blur-sm" />
            <CarouselNext className="-right-3 md:-right-5 bg-background/80 backdrop-blur-sm" />
          </>
        )}
      </Carousel>

      {/* Dot indicators */}
      {photos.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => api?.scrollTo(index)}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                index === current
                  ? 'w-6 bg-primary'
                  : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50',
              )}
              aria-label={`Go to ${phaseLabel} photo ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
