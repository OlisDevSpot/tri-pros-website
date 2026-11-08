'use client'

import type { HomePaintKey } from '@/features/trade-scenes/constants/home-thermal-zones'
import type { PartPaint, SystemPartId } from '@/features/trade-scenes/types'
import type { ThermalPaintSet } from '@/features/trade-scenes/ui/lib/thermal-paint-set'

import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'

import { HOME_PAINT_KEYS } from '@/features/trade-scenes/constants/home-thermal-zones'
import { useSceneScan } from '@/features/trade-scenes/hooks/use-scene-scan'
import { PAINTED_SYSTEM_PARTS } from '@/features/trade-scenes/lib/part-paint-temperatures'
import { createThermalPaintSet, paintThermal, restoreThermalPaint, tintThermalPaint } from '@/features/trade-scenes/ui/lib/thermal-paint-set'
import { useEased } from '@/shared/components/scene/hooks/use-eased'
import { normalizeOnScale } from '@/shared/components/scene/lib/normalize-on-scale'
import { THERMAL_SCALE_F } from '@/shared/modules/construction/core/constants/climate-presets'

interface HomeThermalPaintProps {
  /** °F per paint key. */
  temperatures: Record<HomePaintKey, number>
  soakedPartIds: readonly string[]
  /** The lit system parts painted through their depth, on the thermal scale; the zones paint the rest. */
  parts: Readonly<Partial<Record<SystemPartId, PartPaint>>>
  /** Called when a later pass swaps paint onto a mesh, so whatever fades the home can take the new material too. */
  onRepaint?: () => void
}

function onScale(values: readonly number[]): Record<HomePaintKey, number> {
  return Object.fromEntries(HOME_PAINT_KEYS.map((key, index) => [key, values[index]])) as Record<HomePaintKey, number>
}

const ATTIC = HOME_PAINT_KEYS.indexOf('attic')

// The parts' temperatures ride the same ease as the zones, two values a part after them, at fixed places so the list never
// changes length; a part not painted holds the attic's, so one that lights eases in from the air round it.
function partValues(parts: Readonly<Partial<Record<SystemPartId, PartPaint>>>, zones: readonly number[]): number[] {
  return PAINTED_SYSTEM_PARTS.flatMap((id) => {
    const paint = parts[id]
    return paint === undefined ? [zones[ATTIC], zones[ATTIC]] : [paint.inner, paint.outer]
  })
}

function paintedParts(values: readonly number[], painted: readonly SystemPartId[]): Partial<Record<SystemPartId, PartPaint>> {
  const at = HOME_PAINT_KEYS.length
  return Object.fromEntries(painted.map((id) => {
    const index = at + PAINTED_SYSTEM_PARTS.indexOf(id) * 2
    return [id, { inner: values[index], outer: values[index + 1] }]
  }))
}

// Mounted while the thermal camera is on: it repaints every surface the home tags, and its unmount hands each mesh back the
// material it wore. Swapped in place, so the house's own materials are never rebuilt for it.
export function HomeThermalPaint({ temperatures, soakedPartIds, parts, onRepaint }: HomeThermalPaintProps) {
  const invalidate = useThree(state => state.invalidate)
  const scene = useThree(state => state.scene)
  const root = useMemo(() => ({ current: scene }), [scene])
  const zones = HOME_PAINT_KEYS.map(key => normalizeOnScale(temperatures[key], THERMAL_SCALE_F))
  const values = [...zones, ...partValues(parts, zones)]
  const latest = useRef(values)
  const paint = useRef<ThermalPaintSet | null>(null)

  const paintedKey = PAINTED_SYSTEM_PARTS.filter(id => parts[id] !== undefined).join('|')
  const painted = useMemo(() => (paintedKey === '' ? [] : paintedKey.split('|')) as SystemPartId[], [paintedKey])
  const paintedRef = useRef(painted)
  // Which parts wear their own ramp changes at once; their temperatures ease with the zones. The scan this render wakes
  // swaps the paint.
  useLayoutEffect(() => {
    paintedRef.current = painted
    if (paint.current) {
      tintThermalPaint(paint.current, onScale(latest.current), paintedParts(latest.current, painted))
    }
    invalidate()
  }, [painted, invalidate])

  const soakedKey = soakedPartIds.join('|')
  const soaked = useMemo(() => new Set(soakedKey === '' ? [] : soakedKey.split('|')), [soakedKey])
  const soakedRef = useRef(soaked)
  useLayoutEffect(() => {
    soakedRef.current = soaked
    invalidate()
  }, [soaked, invalidate])

  useEffect(() => {
    const set = createThermalPaintSet(onScale(latest.current), paintedParts(latest.current, paintedRef.current))
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
      tintThermalPaint(paint.current, onScale(next), paintedParts(next, paintedRef.current))
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
