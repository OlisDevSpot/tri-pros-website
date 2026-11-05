'use client'

import type { HomePaintKey } from '@/features/trade-scenes/constants/home-thermal-zones'
import type { ThermalPaintSet } from '@/features/trade-scenes/ui/lib/thermal-paint-set'

import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'

import { HOME_PAINT_KEYS } from '@/features/trade-scenes/constants/home-thermal-zones'
import { useSceneScan } from '@/features/trade-scenes/hooks/use-scene-scan'
import { createThermalPaintSet, paintThermal, restoreThermalPaint, tintThermalPaint } from '@/features/trade-scenes/ui/lib/thermal-paint-set'
import { useEased } from '@/shared/components/scene/hooks/use-eased'
import { normalizeOnScale } from '@/shared/components/scene/lib/normalize-on-scale'
import { THERMAL_SCALE_F } from '@/shared/modules/construction/core/constants/climate-presets'

interface HomeThermalPaintProps {
  /** °F per paint key. */
  temperatures: Record<HomePaintKey, number>
  soakedPartIds: readonly string[]
  /** Called when a later pass swaps paint onto a mesh, so whatever fades the home can take the new material too. */
  onRepaint?: () => void
}

function onScale(values: readonly number[]): Record<HomePaintKey, number> {
  return Object.fromEntries(HOME_PAINT_KEYS.map((key, index) => [key, values[index]])) as Record<HomePaintKey, number>
}

// Mounted while the thermal camera is on: it repaints every surface the home tags, and its unmount hands each mesh back the
// material it wore. Swapped in place, so the house's own materials are never rebuilt for it.
export function HomeThermalPaint({ temperatures, soakedPartIds, onRepaint }: HomeThermalPaintProps) {
  const invalidate = useThree(state => state.invalidate)
  const scene = useThree(state => state.scene)
  const root = useMemo(() => ({ current: scene }), [scene])
  const values = HOME_PAINT_KEYS.map(key => normalizeOnScale(temperatures[key], THERMAL_SCALE_F))
  const latest = useRef(values)
  const paint = useRef<ThermalPaintSet | null>(null)

  const soakedKey = soakedPartIds.join('|')
  const soaked = useMemo(() => new Set(soakedKey === '' ? [] : soakedKey.split('|')), [soakedKey])
  const soakedRef = useRef(soaked)
  useLayoutEffect(() => {
    soakedRef.current = soaked
    invalidate()
  }, [soaked, invalidate])

  useEffect(() => {
    const set = createThermalPaintSet(onScale(latest.current))
    paint.current = set
    // At once rather than on the next frame, so the home's ghost can take the new paint before anything draws.
    paintThermal(scene, set, soakedRef.current)
    invalidate()
    return () => {
      restoreThermalPaint(set)
      paint.current = null
      invalidate()
    }
  }, [scene, invalidate])

  useEased(values, (next) => {
    latest.current = next
    if (paint.current) {
      tintThermalPaint(paint.current, onScale(next))
    }
  })

  useSceneScan(root, (node) => {
    const repainted = paint.current !== null && paintThermal(node, paint.current, soakedRef.current)
    if (repainted) {
      onRepaint?.()
    }
    return repainted
  })

  return null
}
