'use client'

import type { WINDOW_FRAMES } from '@/features/trade-scenes/constants/home-geometry'
import type { SystemLit, WindowPieceId } from '@/features/trade-scenes/types'
import type { GlassLook } from '@/features/trade-scenes/ui/lib/glass-look'

import { useMemo } from 'react'

import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { LOOK_INSIDE_WINDOW_TAG } from '@/features/trade-scenes/constants/look-inside'
import { PAIRED_PANE_OPACITY, PANE_LOOKS } from '@/features/trade-scenes/constants/system-part-looks'
import { useStepPeel } from '@/features/trade-scenes/hooks/use-step-peel'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { windowPieceBoxes } from '@/features/trade-scenes/lib/window-piece-boxes'
import { windowSpread } from '@/features/trade-scenes/lib/window-spread'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'

interface WindowPanesProps {
  // The window's glass, as the house draws it.
  glass: GlassLook
  frame: (typeof WINDOW_FRAMES)[keyof typeof WINDOW_FRAMES]
  // Windows up close; its shown pieces are the ones this glazing draws.
  lit: SystemLit
  // The rooms' light through the glass at night, as the house's other windows glow.
  glow: number
}

type PaneId = 'pane' | 'outer-pane' | 'inner-pane'
const isPane = (id: WindowPieceId): id is PaneId => id === 'pane' || id === 'outer-pane' || id === 'inner-pane'
// The coating, the gas and the screen read as a tint, a little glossy, and take no wear: they come only with the new window. A working number.
const TINT_ROUGHNESS = 0.2

// The framed window's glazing, each piece whole and drawn once where it stands at rest, then moved out as far as the pull
// moves it. It reads the pull itself, so a drag moves only its pieces.
export function WindowPanes({ glass: glassLook, frame, lit, glow }: WindowPanesProps) {
  const pull = useStepPeel(lit)
  const pieces = useMemo(() => windowPieceBoxes(frame, lit.shown), [frame, lit.shown])
  const spread = windowSpread(lit.shown, pull)
  const paired = lit.shown.has('outer-pane')
  return (
    <>
      {pieces.map(({ id, boxes }) => {
        const pane = isPane(id)
        const tint = pane ? null : PANE_LOOKS[id]
        return (
          <group key={id} position={[...spread.get(id)!]} userData={systemPartTag(id, LOOK_INSIDE_WINDOW_TAG)}>
            <MergedBoxes
              boxes={boxes}
              color={tint === null ? glassLook.color : tint.color}
              roughness={tint === null ? glassLook.roughness : TINT_ROUGHNESS}
              opacity={tint === null ? glassLook.opacity * (paired ? PAIRED_PANE_OPACITY : 1) : tint.opacity}
              emissive={pane ? HOME_PALETTE.glassGlow : undefined}
              emissiveIntensity={pane ? glow : 0}
            />
          </group>
        )
      })}
    </>
  )
}
