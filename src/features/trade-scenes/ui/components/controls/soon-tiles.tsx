'use client'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'

interface SoonTilesProps {
  tiles: readonly { title: string, hint: string }[]
}

export function SoonTiles({ tiles }: SoonTilesProps) {
  return (
    <div className="grid gap-2 pt-2.5">
      {tiles.map(tile => (
        <div key={tile.title} data-soon-tile className={CONTROLS_CLASSES.soonTile}>
          <span data-soon-title className="text-sm font-bold">{tile.title}</span>
          <span className="text-xs text-muted-foreground">{tile.hint}</span>
        </div>
      ))}
    </div>
  )
}
