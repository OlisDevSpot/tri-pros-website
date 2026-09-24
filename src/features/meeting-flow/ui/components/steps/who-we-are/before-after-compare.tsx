'use client'

import type { BeforeAfterMedia } from '@/features/meeting-flow/types'
import Image from 'next/image'
import { ReactCompareSlider, ReactCompareSliderHandle } from 'react-compare-slider'

interface BeforeAfterCompareProps {
  media: BeforeAfterMedia
}

/**
 * The same room before and after under one divider the homeowner can drag. The slider's root
 * keeps `touch-action: pan-y`, so a vertical swipe on the photo still moves the presentation
 * and only a sideways drag moves the divider. The knob is solid: a backdrop blur over the photo
 * collapses once an ancestor animates. Its width is capped by the screen's height, so on a tall
 * screen the pair never crowds out the record.
 */
export function BeforeAfterCompare({ media }: BeforeAfterCompareProps) {
  return (
    <div
      className="relative mx-auto overflow-hidden rounded-md"
      data-compare
      style={{ aspectRatio: `${media.width} / ${media.height}`, width: `min(100%, calc(42cqh * ${media.width} / ${media.height}))` }}
    >
      <ReactCompareSlider
        className="size-full"
        handle={(
          <ReactCompareSliderHandle
            buttonStyle={{ backdropFilter: 'none', WebkitBackdropFilter: 'none', backgroundColor: 'white', color: 'var(--presentation-ground)', border: 0 }}
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
