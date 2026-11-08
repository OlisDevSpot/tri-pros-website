'use client'

import type { WINDOW_FRAMES } from '@/features/trade-scenes/constants/home-geometry'
import type { SystemLit } from '@/features/trade-scenes/types'
import type { windowFrameLook } from '@/features/trade-scenes/ui/lib/window-frame-look'

import { useMemo } from 'react'

import { HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { LOOK_INSIDE_WINDOW } from '@/features/trade-scenes/constants/look-inside'
import { useStepPeel } from '@/features/trade-scenes/hooks/use-step-peel'
import { windowBoxes } from '@/features/trade-scenes/lib/window-boxes'
import { windowSpread } from '@/features/trade-scenes/lib/window-spread'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'

interface FramedWindowFrameProps {
  frame: (typeof WINDOW_FRAMES)[keyof typeof WINDOW_FRAMES]
  frameLook: ReturnType<typeof windowFrameLook>
  // Windows up close.
  lit: SystemLit
}

// The framed window's frame, sill ledge included, drawn apart from the house's other frames while the window is up close so
// the pull can move all of it out of the wall: one draw, or two where its two sides are coloured apart. It reads the pull
// itself, so a drag moves only it.
export function FramedWindowFrame({ frame, frameLook, lit }: FramedWindowFrameProps) {
  const pull = useStepPeel(lit)
  const boxes = useMemo(() => windowBoxes(LOOK_INSIDE_WINDOW.wall, LOOK_INSIDE_WINDOW.opening, frame, HOUSE.floorY, HOUSE.wallThickness), [frame])
  const { roughness, metalness } = frameLook
  return (
    <group position={[...windowSpread(lit.shown, pull).get('frame')!]}>
      {frameLook.outside !== frameLook.inside
        ? (
            <>
              <MergedBoxes boxes={boxes.outside} color={frameLook.outside} radius={0.01} roughness={roughness} metalness={metalness} />
              <MergedBoxes boxes={boxes.inside} color={frameLook.inside} radius={0.01} roughness={roughness} metalness={metalness} />
            </>
          )
        : <MergedBoxes boxes={boxes.frames} color={frameLook.outside} radius={0.01} roughness={roughness} metalness={metalness} />}
    </group>
  )
}
