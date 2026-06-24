'use client'

import type { CarouselApi } from '@/shared/components/ui/carousel'
import { MoveHorizontal } from 'lucide-react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useCallback, useState } from 'react'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/shared/components/ui/carousel'
import { cn } from '@/shared/lib/utils'

/**
 * One real transformation: a before photo and its after. Optional caption
 * (e.g. "Encino — full gut") adds specificity and trust.
 */
export interface BeforeAfterPair {
  before: string
  after: string
  label?: string
}

/**
 * ssr:false — the slider measures the DOM on mount, so rendering it on the
 * server only to throw it away causes hydration churn (mirrors StoryBeforeAfter).
 */
const ReactCompareSlider = dynamic(
  () => import('react-compare-slider').then(m => m.ReactCompareSlider),
  { ssr: false, loading: () => <div className="bg-muted/30 size-full" /> },
)

/**
 * "Transformation showcase" — one project per slide, each a drag-to-reveal
 * before/after, with arrows + dots to skip between projects. Replaces the old
 * 2×2 grid where four small tiles made it impossible to tell what became what.
 *
 * Gesture separation is the whole trick: the compare slider and an Embla
 * carousel both want horizontal drag, so the carousel's own drag is disabled
 * (`watchDrag: false`) and navigation happens via arrows/dots. The slider then
 * owns all horizontal dragging inside a slide — no fight on mobile or desktop.
 *
 * Corner badges + a "drag to compare" hint keep each frame legible before the
 * visitor ever touches it. Scales to any number of pairs; a single pair renders
 * the slider alone (no chrome).
 */
export function BeforeAfterShowcase({ pairs }: { pairs: BeforeAfterPair[] }) {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)

  const handleSetApi = useCallback((next: CarouselApi) => {
    setApi(next)
    if (next) {
      next.on('select', () => setCurrent(next.selectedScrollSnap()))
    }
  }, [])

  if (pairs.length === 0) {
    return null
  }

  const multi = pairs.length > 1

  return (
    <div className="flex w-full flex-col gap-4">
      <Carousel
        setApi={handleSetApi}
        opts={{ watchDrag: false, loop: multi }}
        className="w-full"
      >
        <CarouselContent>
          {pairs.map((pair, i) => (
            <CarouselItem key={`${pair.after}-${i}`} className="basis-full">
              <figure className="relative aspect-4/3 w-full overflow-hidden rounded-2xl shadow-xl select-none sm:aspect-16/10">
                <ReactCompareSlider
                  itemOne={(
                    <div className="relative size-full">
                      <Image src={pair.before} alt={pair.label ? `${pair.label} — before` : 'Before the remodel'} fill sizes="(max-width: 768px) 100vw, 720px" className="object-cover" priority={i === 0} />
                      <span className="pointer-events-none absolute top-3 left-3 rounded-md bg-neutral-900/70 px-2.5 py-1 text-xs font-semibold tracking-wide text-white uppercase shadow-sm backdrop-blur-sm">Before</span>
                    </div>
                  )}
                  itemTwo={(
                    <div className="relative size-full">
                      <Image src={pair.after} alt={pair.label ? `${pair.label} — after` : 'After the remodel'} fill sizes="(max-width: 768px) 100vw, 720px" className="object-cover" priority={i === 0} />
                      <span className="ring-primary/70 pointer-events-none absolute top-3 right-3 rounded-md bg-neutral-900/70 px-2.5 py-1 text-xs font-semibold tracking-wide text-white uppercase shadow-sm ring-1 backdrop-blur-sm">After</span>
                    </div>
                  )}
                  className="size-full"
                />
                {/* Badges live INSIDE each image layer (not pinned to the figure),
                    so react-compare-slider's clip carries them: drag the handle to
                    reveal only one photo and only that photo's badge shows. The
                    "before" badge rides the base layer (top-left), the "after"
                    badge rides the clipped overlay (top-right, brand ring). */}
              </figure>
            </CarouselItem>
          ))}
        </CarouselContent>
        {multi
          ? (
              <>
                {/* Inset INSIDE the image edges (not -left/-right) so the funnel
                    rail never clips them; they overlay the photo at vertical center,
                    clear of the corner badges and the center drag handle. */}
                <CarouselPrevious className="bg-background/80 left-2 z-30 backdrop-blur-sm md:left-3" />
                <CarouselNext className="bg-background/80 right-2 z-30 backdrop-blur-sm md:right-3" />
              </>
            )
          : null}
      </Carousel>

      {/* Caption + drag hint live BELOW the image, clear of the slider handle's
          center column where an overlaid hint gets visually split. */}
      <div className="-mb-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
        {pairs[current]?.label
          ? (
              <>
                <span className="text-foreground font-semibold">{pairs[current]?.label}</span>
                <span className="text-muted-foreground/40" aria-hidden="true">·</span>
              </>
            )
          : null}
        <span className="text-muted-foreground inline-flex items-center gap-1">
          <MoveHorizontal className="size-3.5" aria-hidden="true" />
          Drag to compare
        </span>
      </div>

      {multi
        ? (
            <div className="flex items-center justify-center gap-1.5">
              {pairs.map((pair, i) => (
                <button
                  key={`dot-${pair.after}-${i}`}
                  type="button"
                  onClick={() => api?.scrollTo(i)}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    i === current ? 'bg-primary w-6' : 'bg-muted-foreground/30 hover:bg-muted-foreground/50 w-1.5',
                  )}
                  aria-label={`Go to transformation ${i + 1}`}
                />
              ))}
            </div>
          )
        : null}
    </div>
  )
}
