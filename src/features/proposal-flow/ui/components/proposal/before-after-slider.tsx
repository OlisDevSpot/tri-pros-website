'use client'

import type { CSSProperties } from 'react'
import type { ResolvedBeforeAfterPair } from '@/shared/modules/projects/core/lib/resolve-before-after-pairs'

import { ChevronsLeftRightIcon } from 'lucide-react'
import { useState } from 'react'
import { OptimizedImage } from '@/shared/modules/media/core/components/display/optimized-image'

const SIZES = '(max-width: 900px) 100vw, 55vw'

export function BeforeAfterSlider({ pair }: { pair: ResolvedBeforeAfterPair }) {
  const [pos, setPos] = useState(50)

  return (
    <div className="relative aspect-4/5 max-h-130 w-full touch-pan-y overflow-hidden rounded-xl select-none" style={{ '--pos': `${pos}%` } as CSSProperties}>
      {/* Keyed by file, so switching pairs swaps the photos without resetting the handle. */}
      <OptimizedImage key={pair.before.id} file={pair.before} alt="" fill sizes={SIZES} />
      <div className="absolute inset-0 [clip-path:inset(0_0_0_var(--pos))]">
        <OptimizedImage key={pair.after.id} file={pair.after} alt="" fill sizes={SIZES} />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-(--pos) w-0.5 -translate-x-px bg-on-media ring-1 ring-scrim/20">
        <span className="absolute top-1/2 left-1/2 grid size-10 -translate-1/2 place-items-center rounded-full bg-on-media text-(--presentation-ground) shadow-[0_4px_14px_color-mix(in_oklab,var(--scrim)_35%,transparent)]">
          <ChevronsLeftRightIcon className="size-5.5" />
        </span>
      </div>
      <span className="pointer-events-none absolute top-3 left-3 rounded bg-scrim/65 px-2 py-1.5 text-xs leading-none font-bold tracking-[0.12em] text-on-media uppercase">Before</span>
      <span className="pointer-events-none absolute top-3 right-3 rounded bg-scrim/65 px-2 py-1.5 text-xs leading-none font-bold tracking-[0.12em] text-on-media uppercase">After</span>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={e => setPos(Number(e.target.value))}
        aria-label={`Before and after, ${pair.label}`}
        className="peer absolute inset-0 m-0 size-full cursor-ew-resize opacity-0"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 rounded-xl peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 peer-focus-visible:ring-inset" />
    </div>
  )
}
