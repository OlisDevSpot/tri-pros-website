'use client'

import type { MediaFile } from '@/shared/db/schema'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef } from 'react'
import { OptimizedImage } from '@/shared/components/optimized-image'
import { cn } from '@/shared/lib/utils'

interface Props {
  photos: MediaFile[]
  currentIndex: number
  onClose: () => void
  onNavigate: (index: number) => void
}

export function PhotoLightbox({ photos, currentIndex, onClose, onNavigate }: Props) {
  const photo = photos[currentIndex]
  const thumbnailContainerRef = useRef<HTMLDivElement>(null)
  const thumbnailRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  const goNext = useCallback(() => {
    onNavigate((currentIndex + 1) % photos.length)
  }, [currentIndex, photos.length, onNavigate])

  const goPrev = useCallback(() => {
    onNavigate((currentIndex - 1 + photos.length) % photos.length)
  }, [currentIndex, photos.length, onNavigate])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
      if (e.key === 'ArrowRight') {
        goNext()
      }
      if (e.key === 'ArrowLeft') {
        goPrev()
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose, goNext, goPrev])

  // Auto-scroll thumbnail strip to keep current photo in view
  useEffect(() => {
    const thumb = thumbnailRefs.current.get(currentIndex)
    if (thumb) {
      thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [currentIndex])

  if (!photo) {
    return null
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-60 flex flex-col bg-background/95"
      >
        {/* Top bar — pushed below navbar on mobile */}
        <div
          className="flex shrink-0 items-center justify-between px-4 py-3"
          style={{ paddingTop: 'calc(var(--navbar-height, 80px) + 12px)' }}
        >
          <span className="text-sm text-foreground/60">
            {currentIndex + 1}
            {' '}
            /
            {' '}
            {photos.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
            aria-label="Close lightbox"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Main image area — no horizontal padding on mobile so image fills screen */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-0 sm:px-14">
          {/* Prev button — overlaid on image */}
          {photos.length > 1 && (
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/50 p-2 sm:p-3 text-foreground/80 backdrop-blur-sm transition-colors hover:bg-background/70 hover:text-foreground"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          )}

          {/* Image */}
          <motion.div
            key={photo.id}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="relative h-full w-full"
          >
            <OptimizedImage
              file={photo}
              alt={photo.name}
              fill
              className="object-contain"
              sizes="100vw"
              priority
            />
          </motion.div>

          {/* Next button — overlaid on image */}
          {photos.length > 1 && (
            <button
              type="button"
              onClick={goNext}
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/50 p-2 sm:p-3 text-foreground/80 backdrop-blur-sm transition-colors hover:bg-background/70 hover:text-foreground"
              aria-label="Next photo"
            >
              <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          )}
        </div>

        {/* Thumbnail strip */}
        {photos.length > 1 && (
          <div className="shrink-0 border-t border-foreground/10 bg-background/80 px-4 py-3">
            <div
              ref={thumbnailContainerRef}
              className="mx-auto flex max-w-4xl gap-2 overflow-x-auto pb-1"
            >
              {photos.map((thumb, i) => (
                <button
                  key={thumb.id}
                  ref={(el) => {
                    if (el) {
                      thumbnailRefs.current.set(i, el)
                    }
                    else {
                      thumbnailRefs.current.delete(i)
                    }
                  }}
                  type="button"
                  onClick={() => onNavigate(i)}
                  className={cn(
                    'relative h-14 w-20 shrink-0 overflow-hidden rounded-md transition-all',
                    i === currentIndex
                      ? 'outline-2 outline-primary -outline-offset-2'
                      : 'opacity-50 hover:opacity-80',
                  )}
                  aria-label={`View photo ${i + 1}`}
                >
                  <OptimizedImage
                    file={thumb}
                    alt={thumb.name}
                    fill
                    sizes="80px"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
