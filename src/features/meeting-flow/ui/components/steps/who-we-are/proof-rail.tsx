'use client'

import type { FocusPoint, ProofRail as ProofRailData } from '@/features/meeting-flow/types'
import { ProofTile } from '@/features/meeting-flow/ui/components/steps/who-we-are/proof-tile'
import { cn } from '@/shared/lib/utils'

interface ProofRailProps {
  rail: ProofRailData
  /** Called with a tile's `opens` when the tile is pressed; tiles without `opens` stay static. */
  onOpen?: (opens: { document: number, focus: FocusPoint }) => void
}

/**
 * The proofs under a slide's centrepiece, built the same way on every point: an eyebrow that
 * names the argument, then its tiles on one hairline, split by hairlines, never boxed as cards.
 * On a phone-width presentation the tiles stack, so no figure clips.
 */
export function ProofRail({ rail, onOpen }: ProofRailProps) {
  return (
    <div className="grid gap-presentation-tight" data-proof-rail>
      <p className="font-mono text-presentation-label font-bold tracking-[0.16em] text-white/55 uppercase">{rail.eyebrow}</p>
      <ul className={cn(rail.tiles.length === 4 ? 'grid-cols-4' : 'grid-cols-3', 'grid divide-x divide-white/10 border-t border-white/15 @max-[30rem]/presentation:grid-cols-1 @max-[30rem]/presentation:divide-x-0 @max-[30rem]/presentation:divide-y')}>
        {rail.tiles.map((tile) => {
          const { opens } = tile
          return (
            <li key={tile.kicker} className="min-w-0 px-[1.4cqw] first:pl-0 last:pr-0 @max-[30rem]/presentation:px-0 @max-[30rem]/presentation:pb-presentation-tight">
              <ProofTile tile={tile} onOpen={opens && onOpen ? () => onOpen(opens) : undefined} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
