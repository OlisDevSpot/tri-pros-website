'use client'

import type { PortfolioMatch } from '@/shared/modules/projects/core/types'

import { ImagesIcon } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { OptimizedImage } from '@/shared/modules/media/core/components/display/optimized-image'
import { PhotoLightbox } from '@/shared/modules/media/core/components/display/photo-lightbox'
import { usePortfolioProjectDetail } from '@/shared/modules/projects/core/hooks/use-portfolio-project-detail'
import { resolveBeforeAfterPairs } from '@/shared/modules/projects/core/lib/resolve-before-after-pairs'

import { BeforeAfterSlider } from './before-after-slider'

interface Props {
  matches: PortfolioMatch[]
  /** The caption's kicker: "Closest match · {trade}", or "Recent work" for the fallback. */
  kicker: string
}

export function ResultsFeatured({ matches, kicker }: Props) {
  const match = matches[0]
  // Fetches the featured project and the strip's two ahead, so a strip tap opens on loaded photos.
  const detail = usePortfolioProjectDetail(matches, 0)
  const [pairIndex, setPairIndex] = useState(0)
  const [photoIndex, setPhotoIndex] = useState<number | null>(null)
  const galleryButtonRef = useRef<HTMLButtonElement>(null)

  const pairs = useMemo(() => (detail.data ? resolveBeforeAfterPairs(detail.data) : []), [detail.data])
  const photos = useMemo(() => detail.data?.media.all.filter(file => !file.mimeType.startsWith('video/')) ?? [], [detail.data])
  const pair = pairs[pairIndex] ?? pairs[0]
  const closeGallery = useCallback(() => {
    setPhotoIndex(null)
    galleryButtonRef.current?.focus()
  }, [])

  // Also the chapter's placeholder while the match list loads: the slider's box and the caption's lines, so nothing jumps.
  if (!match || detail.isPending) {
    return (
      <div aria-hidden className="grid gap-3.5 @min-[900px]/proposal:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] @min-[900px]/proposal:items-center @min-[900px]/proposal:gap-8">
        <Skeleton className="aspect-4/5 max-h-130 w-full rounded-xl" />
        <div className="grid content-center gap-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-4/5" />
          <Skeleton className="h-4 w-2/5" />
        </div>
      </div>
    )
  }

  const { project, heroImage } = match.row
  const meta = [project.city, project.projectDuration].filter(Boolean).join(' · ')

  return (
    <figure className="m-0 grid gap-3.5 @min-[900px]/proposal:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] @min-[900px]/proposal:items-center @min-[900px]/proposal:gap-8">
      {pair
        ? <BeforeAfterSlider pair={pair} />
        : (
            <div className="relative aspect-4/5 max-h-130 w-full overflow-hidden rounded-xl">
              <OptimizedImage file={heroImage} alt={project.title} fill sizes="(max-width: 900px) 100vw, 55vw" />
            </div>
          )}
      <figcaption className="grid content-center gap-2.5">
        <p className="text-xs font-bold tracking-[0.14em] text-primary uppercase">{kicker}</p>
        <h3 className="font-sans text-2xl leading-[1.15] font-medium text-balance">{project.title}</h3>
        {meta && <p className="text-sm font-bold text-muted-foreground">{meta}</p>}
        {project.description && <p className="max-w-[44ch] text-base text-muted-foreground">{project.description}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {/* One pair needs no switch: the slider's own label names it. */}
          {pairs.length > 1 && pairs.map((p, i) => (
            <button
              key={`${p.before.id}-${p.after.id}`}
              type="button"
              aria-pressed={p === pair}
              onClick={() => setPairIndex(i)}
              className="min-h-9 rounded-full border border-border-strong bg-card px-3 py-2 text-sm leading-none font-bold text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
            >
              {p.label}
            </button>
          ))}
          {photos.length > 0 && (
            <Button ref={galleryButtonRef} variant="ghost" aria-haspopup="dialog" onClick={() => setPhotoIndex(0)} className="font-bold">
              <ImagesIcon aria-hidden />
              {photos.length === 1 ? 'See the photo' : `All ${photos.length} photos`}
            </Button>
          )}
        </div>
      </figcaption>
      {/* The page's container query makes its box the containing block for fixed children; the lightbox covers the viewport from body. */}
      {photoIndex !== null && createPortal(
        <PhotoLightbox photos={photos} currentIndex={photoIndex} onClose={closeGallery} onNavigate={setPhotoIndex} title={project.title} topInset="safe-area" />,
        document.body,
      )}
    </figure>
  )
}
