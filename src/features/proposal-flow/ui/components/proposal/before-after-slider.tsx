'use client'

import type { CSSProperties, PointerEvent } from 'react'
import type { ResolvedBeforeAfterPair } from '@/shared/modules/projects/core/lib/resolve-before-after-pairs'

import { ChevronsLeftRightIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { OptimizedImage } from '@/shared/modules/media/core/components/display/optimized-image'

const SIZES = '(max-width: 900px) 100vw, 55vw'

export function BeforeAfterSlider({ pair }: { pair: ResolvedBeforeAfterPair }) {
  const [pos, setPos] = useState(50)
  const inputRef = useRef<HTMLInputElement>(null)
  // Where the handle was when the gesture began, so a vertical scroll that started on the photo puts it back.
  const dragFrom = useRef<number | null>(null)

  const seek = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setPos(Math.round(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))))
  }

  // iOS WebKit drags a range only from its thumb and never seeks on a track tap, so the photo takes the pointer itself.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || e.button !== 0) {
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    dragFrom.current = pos
    inputRef.current?.focus({ preventScroll: true })
    seek(e)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragFrom.current !== null && e.currentTarget.hasPointerCapture(e.pointerId)) {
      seek(e)
    }
  }
  const onPointerUp = () => {
    dragFrom.current = null
  }
  // touch-pan-y hands a vertical pan to the page, which cancels the pointer.
  const onPointerCancel = () => {
    if (dragFrom.current !== null) {
      setPos(dragFrom.current)
    }
    dragFrom.current = null
  }

  return (
    <div
      className="relative aspect-4/5 max-h-130 w-full cursor-ew-resize touch-pan-y overflow-hidden rounded-xl select-none"
      style={{ '--pos': `${pos}%` } as CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      // A mouse drag on a photo would start a native image drag, which cancels the pointer mid-seek.
      onDragStart={e => e.preventDefault()}
    >
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
      {/* Keyboard and screen readers drive the range; pointers go through to the photo. */}
      <input
        ref={inputRef}
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={e => setPos(Number(e.target.value))}
        aria-label={`Before and after, ${pair.label}`}
        aria-valuetext={`${100 - pos}% after`}
        className="peer pointer-events-none absolute inset-0 m-0 size-full opacity-0"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 rounded-xl peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 peer-focus-visible:ring-inset" />
    </div>
  )
}
