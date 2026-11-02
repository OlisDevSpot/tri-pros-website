'use client'

import type { ReactNode } from 'react'
import type { Group } from 'three'
import type { PartPaint } from '@/features/trade-scenes/lib/kit-paint-temperatures'
import type { KitPartPaint } from '@/features/trade-scenes/ui/components/assembly-kits/lib/kit-part-paint'

import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'

import { useSceneScan } from '@/features/trade-scenes/hooks/use-scene-scan'
import { createKitPartPaint, paintKitPart, restoreKitPart, tintKitPart } from '@/features/trade-scenes/ui/components/assembly-kits/lib/kit-part-paint'
import { useEased } from '@/shared/components/scene/hooks/use-eased'

interface PartThermalPaintProps {
  on: boolean
  // Always given, so the eased temperatures stay current while the camera is off and it opens on the right colours.
  paint: PartPaint
  children: ReactNode
}

// The thermal camera on one kit part: while on, every mesh under it wears the home's ironbow paint ramped through the part from
// its inner face to its outer; turned off, each mesh gets back what it wore. Swapped in place, so the part never redraws for it.
export function PartThermalPaint({ on, paint, children }: PartThermalPaintProps) {
  const group = useRef<Group>(null)
  const set = useRef<KitPartPaint | null>(null)
  const invalidate = useThree(state => state.invalidate)
  const target = [paint.inner, paint.outer] as const
  const latest = useRef<readonly [number, number]>(target)

  useLayoutEffect(() => {
    const root = group.current
    if (!on || !root) {
      return
    }
    const created = createKitPartPaint(latest.current[0], latest.current[1])
    set.current = created
    // Before the next frame draws, so the part never shows a frame of its own colours under the camera.
    paintKitPart(root, created)
    invalidate()
    return () => {
      restoreKitPart(created)
      set.current = null
      invalidate()
    }
  }, [on, invalidate])

  useEased(target, (next) => {
    latest.current = next
    if (set.current) {
      tintKitPart(set.current, next[0], next[1])
    }
  })

  useSceneScan(group, node => set.current !== null && paintKitPart(node, set.current))

  return <group ref={group}>{children}</group>
}
