'use client'

import type { CSSProperties } from 'react'
import type { BeforeAfterMedia } from '@/features/meeting-flow/types'
import Image from 'next/image'
import { ReactCompareSlider, ReactCompareSliderCssVars, ReactCompareSliderHandle } from 'react-compare-slider'
import { cn } from '@/shared/lib/utils'

interface BeforeAfterCompareProps {
  media: BeforeAfterMedia
  className?: string
}

/**
 * The same room before and after under one divider the homeowner can drag. It spans its
 * parent's width; its height is the photo's own proportion, or the parent's height when that is
 * shorter, in which case both photos crop top and bottom alike and stay aligned.
 * The slider's root keeps `touch-action: pan-y`, so a vertical swipe on the photo still moves
 * the presentation and only a sideways drag moves the divider. The knob is solid: a backdrop
 * blur over the photo collapses once an ancestor animates.
 */
export function BeforeAfterCompare({ media, className }: BeforeAfterCompareProps) {
  return (
    <div
      className={cn('relative max-h-full w-full overflow-hidden rounded-md', className)}
      data-compare
      style={{ aspectRatio: `${media.width} / ${media.height}` }}
      onClick={(event) => {
        // react-compare-slider focuses the handle root on click, which then swallows the deck's
        // arrow keys; a pointer tap shouldn't keep that focus, only Tab should.
        if (event.detail > 0 && document.activeElement instanceof HTMLElement && event.currentTarget.contains(document.activeElement)) {
          document.activeElement.blur()
        }
      }}
    >
      <ReactCompareSlider
        className="size-full"
        handle={(
          <ReactCompareSliderHandle
            buttonStyle={{
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              backgroundColor: 'white',
              border: 0,
              [ReactCompareSliderCssVars.handleColor]: 'var(--presentation-ground)',
            } as CSSProperties}
          />
        )}
        itemOne={(
          <div className="relative size-full">
            <Image alt={`${media.alt}, before`} className="object-cover" draggable={false} fill sizes="(min-width: 1024px) 50vw, 90vw" src={media.before} />
          </div>
        )}
        itemTwo={(
          <div className="relative size-full">
            <Image alt={`${media.alt}, after`} className="object-cover" draggable={false} fill sizes="(min-width: 1024px) 50vw, 90vw" src={media.after} />
          </div>
        )}
      />
      <span aria-hidden className="pointer-events-none absolute top-presentation-tight left-presentation-tight z-10 rounded-sm bg-black/60 px-2 py-0.5 font-sans text-presentation-label font-semibold">
        Before
      </span>
      <span aria-hidden className="pointer-events-none absolute top-presentation-tight right-presentation-tight z-10 rounded-sm bg-white/90 px-2 py-0.5 font-sans text-presentation-label font-semibold text-(--presentation-ground)">
        After
      </span>
    </div>
  )
}
