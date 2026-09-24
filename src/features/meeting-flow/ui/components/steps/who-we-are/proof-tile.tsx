'use client'

import type { ProofTile as ProofTileData } from '@/features/meeting-flow/types'
import { ZoomInIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface ProofTileProps {
  tile: ProofTileData
  /** Opens the document the tile cites; without it the tile is static. */
  onOpen?: () => void
}

/**
 * One proof: what it is, the figure, what the figure means. Nothing here moves on hover or
 * focus, so the snap area's box never shifts. Below a 30rem container the value moves beside the
 * kicker instead of under it, but the DOM order (kicker, value, label) stays put — only the grid
 * placement changes, so reading order is unaffected.
 */
export function ProofTile({ tile, onOpen }: ProofTileProps) {
  const Icon = tile.icon
  const body = (
    <>
      <span className="flex items-center gap-[0.45em] text-presentation-label font-bold text-(--presentation-accent)">
        <Icon aria-hidden className="size-[1em] shrink-0" />
        {tile.kicker}
        {onOpen && <ZoomInIcon aria-hidden className="ml-auto size-[1em] shrink-0 opacity-70" />}
      </span>
      <span className="font-sans text-presentation-figure leading-tight font-bold tracking-tight tabular-nums lining-nums @max-[30rem]/presentation:col-start-2 @max-[30rem]/presentation:row-start-1 @max-[30rem]/presentation:self-baseline @max-[30rem]/presentation:justify-self-end @max-[30rem]/presentation:whitespace-nowrap">{tile.value}</span>
      <span className="text-presentation-label text-white/60">{tile.label}</span>
    </>
  )

  if (!onOpen) {
    return <div className="grid min-w-0 content-start gap-1 pt-presentation-tight @max-[30rem]/presentation:grid-cols-[minmax(0,1fr)_auto] @max-[30rem]/presentation:gap-x-presentation-tight @max-[30rem]/presentation:pt-1">{body}</div>
  }

  return (
    <button
      className={cn(
        'relative grid w-full min-w-0 cursor-zoom-in content-start gap-1 pt-presentation-tight text-left outline-none',
        '@max-[30rem]/presentation:grid-cols-[minmax(0,1fr)_auto] @max-[30rem]/presentation:gap-x-presentation-tight @max-[30rem]/presentation:pt-1',
        'before:absolute before:inset-x-0 before:-top-px before:h-0.5 before:origin-left before:scale-x-0 before:bg-(--presentation-accent) before:transition-transform',
        'hover:before:scale-x-100 focus-visible:before:scale-x-100 focus-visible:ring-[3px] focus-visible:ring-ring/50',
      )}
      type="button"
      onClick={onOpen}
    >
      {body}
      <span className="sr-only">, open the document</span>
    </button>
  )
}
