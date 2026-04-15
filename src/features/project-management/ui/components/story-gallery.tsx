'use client'

import type { MediaPhase } from '@/shared/constants/enums/media'
import type { ProjectMediaGroups } from '@/shared/entities/projects/types'
import { motion, useInView } from 'motion/react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { PHASE_LABELS } from '@/features/project-management/constants/phase-labels'
import { PhotoLightbox } from '@/features/project-management/ui/components/photo-lightbox'
import { OptimizedImage } from '@/shared/components/optimized-image'
import { Badge } from '@/shared/components/ui/badge'
import { mediaPhases } from '@/shared/constants/enums/media'
import { cn } from '@/shared/lib/utils'

interface Props {
  media: ProjectMediaGroups
}

export function StoryGallery({ media }: Props) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  const [activeFilter, setActiveFilter] = useState<MediaPhase | 'all'>('all')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const galleryPhotos = useMemo(() => {
    return [
      ...media.before.map(f => ({ ...f, _phase: 'before' as MediaPhase })),
      ...media.during.map(f => ({ ...f, _phase: 'during' as MediaPhase })),
      ...media.after.map(f => ({ ...f, _phase: 'after' as MediaPhase })),
      ...media.uncategorized.map(f => ({ ...f, _phase: 'uncategorized' as MediaPhase })),
    ]
  }, [media])

  const availablePhases = useMemo(() => {
    return mediaPhases.filter(phase => media[phase].length > 0)
  }, [media])

  const filteredPhotos = useMemo(() => {
    if (activeFilter === 'all') {
      return galleryPhotos
    }
    return galleryPhotos.filter(p => p._phase === activeFilter)
  }, [galleryPhotos, activeFilter])

  const handleCloseLightbox = useCallback(() => setLightboxIndex(null), [])
  const handleNavigate = useCallback((index: number) => setLightboxIndex(index), [])

  if (galleryPhotos.length === 0) {
    return null
  }

  return (
    <>
      <section ref={ref} className="bg-muted/30 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.6 }}
            className="mb-10 text-center"
          >
            <h2 className="mb-2 text-2xl font-bold text-foreground lg:text-3xl">
              Project Gallery
            </h2>
            <p className="text-muted-foreground">
              {galleryPhotos.length}
              {' '}
              photo
              {galleryPhotos.length !== 1 ? 's' : ''}
              {' '}
              from this project
            </p>
          </motion.div>

          {/* Phase filter tabs */}
          {availablePhases.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="mb-8 flex flex-wrap justify-center gap-2"
            >
              <Badge
                variant={activeFilter === 'all' ? 'default' : 'outline'}
                className="cursor-pointer px-4 py-1.5 text-sm transition-colors"
                onClick={() => setActiveFilter('all')}
              >
                All
              </Badge>
              {availablePhases.map(phase => (
                <Badge
                  key={phase}
                  variant={activeFilter === phase ? 'default' : 'outline'}
                  className="cursor-pointer px-4 py-1.5 text-sm transition-colors"
                  onClick={() => setActiveFilter(phase)}
                >
                  {PHASE_LABELS[phase]}
                  <span className="ml-1.5 text-xs opacity-60">{media[phase].length}</span>
                </Badge>
              ))}
            </motion.div>
          )}

          {/* Photo grid */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {filteredPhotos.map((photo, i) => {
              const isFeatured = i === 0 && activeFilter === 'all' && filteredPhotos.length > 2

              return (
                <motion.button
                  key={photo.id}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                  transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.6) }}
                  className={cn(
                    'group relative aspect-4/3 cursor-pointer overflow-hidden rounded-xl text-left',
                    isFeatured && 'col-span-2 row-span-2 aspect-auto',
                  )}
                >
                  <OptimizedImage
                    file={photo}
                    alt={photo.name}
                    fill
                    className="transition-transform duration-500 group-hover:scale-105"
                    sizes={
                      isFeatured
                        ? '(max-width: 768px) 100vw, 50vw'
                        : '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw'
                    }
                  />
                  <div className="absolute inset-0 bg-background/0 transition-colors duration-300 group-hover:bg-background/20" />
                  <div className="absolute bottom-0 left-0 right-0 translate-y-full p-3 transition-transform duration-300 group-hover:translate-y-0">
                    <Badge variant="secondary" className="text-xs">
                      {PHASE_LABELS[photo._phase]}
                    </Badge>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>
      </section>

      {/* Lightbox overlay */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={filteredPhotos}
          currentIndex={lightboxIndex}
          onClose={handleCloseLightbox}
          onNavigate={handleNavigate}
        />
      )}
    </>
  )
}
