'use client'

import type { PointerEvent } from 'react'
import type { ProjectMediaFile } from '@/shared/db/schema'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Image from 'next/image'
import { FocusScope } from 'radix-ui/internal'
import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { CrossfadeImage } from '@/shared/modules/media/core/components/display/crossfade-image'
import { OptimizedImage } from '@/shared/modules/media/core/components/display/optimized-image'

/** A project photo, or a plain image (a scanned document) that has no media row behind it. */
export type LightboxPhoto = ProjectMediaFile | { src: string, alt: string, width: number, height: number }

interface Props {
  photos: LightboxPhoto[]
  currentIndex: number
  onClose: () => void
  onNavigate: (index: number) => void
  /** What the photos are of, e.g. a project name; it labels the dialog and leads the top bar. */
  title?: string
  /** What the top bar clears: the site navbar, or only the device's safe area on a page without one. */
  topInset?: 'navbar' | 'safe-area'
}

const TOP_PADDING = {
  // Picks up safe-area-inset-top in the PWA through --navbar-bottom.
  'navbar': 'calc(var(--navbar-bottom, var(--navbar-height, 80px)) + 12px)',
  'safe-area': 'calc(env(safe-area-inset-top, 0px) + 12px)',
} as const

const SWIPE_MIN_PX = 40

export function PhotoLightbox({ photos, currentIndex, onClose, onNavigate, title, topInset = 'navbar' }: Props) {
  const photo = photos[currentIndex]
  const thumbnailContainerRef = useRef<HTMLDivElement>(null)
  const thumbnailRefs = useRef<Map<number, HTMLButtonElement>>(new Map())
  const swipeStartX = useRef<number | null>(null)
  // Safari never focuses a clicked button, so the opener can be the body; then the caller's close handler places focus.
  const [opener] = useState(() => (typeof document === 'undefined' ? null : document.activeElement))
  const onUnmountAutoFocus = useCallback((e: Event) => {
    if (!(opener instanceof HTMLElement) || opener === document.body) {
      e.preventDefault()
    }
  }, [opener])

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

  const onSwipeEnd = (e: PointerEvent) => {
    const start = swipeStartX.current
    swipeStartX.current = null
    if (start === null || photos.length < 2) {
      return
    }
    const dx = e.clientX - start
    if (Math.abs(dx) > SWIPE_MIN_PX) {
      if (dx < 0) {
        goNext()
      }
      else {
        goPrev()
      }
    }
  }

  if (!photo) {
    return null
  }

  return (
    <AnimatePresence>
      {/* Focus moves in on open (the close button, first in order), Tab stays inside, and closing returns it to the opener. */}
      <FocusScope.Root asChild loop trapped onUnmountAutoFocus={onUnmountAutoFocus}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-60 flex flex-col bg-background/95"
          role="dialog"
          aria-modal="true"
          aria-label={title ? `${title} photos` : 'Photos'}
        >
          <div
            className="flex shrink-0 items-center justify-between px-4 py-3"
            style={{ paddingTop: TOP_PADDING[topInset] }}
          >
            <span className="flex min-w-0 items-baseline gap-2 text-sm text-foreground/60">
              {title && <b className="truncate font-semibold text-foreground">{title}</b>}
              <span className="shrink-0">
                {currentIndex + 1}
                {' '}
                /
                {' '}
                {photos.length}
              </span>
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

          {/* Main image area; a horizontal swipe pages, a vertical pan or pinch passes through */}
          <div
            className="relative flex min-h-0 flex-1 touch-pan-y touch-pinch-zoom items-center justify-center px-0 sm:px-14"
            onPointerDown={(e) => {
              swipeStartX.current = e.isPrimary ? e.clientX : null
            }}
            onPointerUp={onSwipeEnd}
            onPointerCancel={() => {
              swipeStartX.current = null
            }}
            // A mouse drag on the photo would start a native image drag, which cancels the pointer.
            onDragStart={e => e.preventDefault()}
          >
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

            {/* Image — constrained to same max-width as thumbnail strip */}
            <div className="relative mx-auto h-full w-full max-w-4xl overflow-hidden rounded-lg">
              {'id' in photo
                ? (
                    <CrossfadeImage
                      alt={photo.name}
                      className="object-contain"
                      image={{ file: photo }}
                      persistBlur
                      priority
                      sizes="(max-width: 896px) 100vw, 896px"
                    />
                  )
                : (
                    <Image
                      key={photo.src}
                      alt={photo.alt}
                      className="size-full object-contain"
                      height={photo.height}
                      priority
                      sizes="(max-width: 896px) 100vw, 896px"
                      src={photo.src}
                      width={photo.width}
                    />
                  )}
            </div>

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
                    key={'id' in thumb ? thumb.id : thumb.src}
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
                    {'id' in thumb
                      ? (
                          <OptimizedImage
                            file={thumb}
                            alt={thumb.name}
                            fill
                            sizes="80px"
                          />
                        )
                      : <Image alt={thumb.alt} className="object-cover" fill sizes="80px" src={thumb.src} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </FocusScope.Root>
    </AnimatePresence>
  )
}
