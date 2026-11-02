'use client'

import type { ShaderMaterial } from 'three'
import type { ThermalSeason, ThermalStyle } from '@/shared/components/scene/constants/thermal-palettes'

import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, Vector3 } from 'three'

import { THERMAL_PALETTES } from '@/shared/components/scene/constants/thermal-palettes'
import { THERMAL_FRAGMENT_SHADER, THERMAL_VERTEX_SHADER } from '@/shared/components/scene/constants/thermal-shader'
import { useEased } from '@/shared/components/scene/hooks/use-eased'

// `inner` is the temperature at the part's -axis face; `halfThickness` is in the geometry's unscaled local units,
// so the geometry must be centred on the axis.
interface ThermalMaterialProps {
  inner: number
  outer: number
  halfThickness: number
  season: ThermalSeason
  style?: ThermalStyle
  axis?: 'x' | 'y' | 'z'
  opacity?: number
}

const AXES = { x: new Vector3(1, 0, 0), y: new Vector3(0, 1, 0), z: new Vector3(0, 0, 1) } as const

export function ThermalMaterial({ inner, outer, halfThickness, season, style = 'ironbow', axis = 'y', opacity = 1 }: ThermalMaterialProps) {
  const material = useRef<ShaderMaterial>(null)
  const uniforms = useMemo(() => ({
    uStops: { value: THERMAL_PALETTES[style][season].map(hex => new Color(hex)) },
    uInner: { value: inner },
    uOuter: { value: outer },
    uAxis: { value: AXES[axis].clone() },
    uHalfThickness: { value: halfThickness },
    uCentre: { value: 0 },
    uOpacity: { value: opacity },
  // Built once; every later change eases through the uniforms below instead of recompiling the shader.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [])
  // Through the constructor, not a `uniforms` prop: R3F copies a prop's uniforms into the material's own object,
  // so a number written to ours afterwards would never reach the shader.
  const parameters = useMemo(() => ({ uniforms, vertexShader: THERMAL_VERTEX_SHADER, fragmentShader: THERMAL_FRAGMENT_SHADER }), [uniforms])

  const stops = THERMAL_PALETTES[style][season].flatMap((hex) => {
    const color = new Color(hex)
    return [color.r, color.g, color.b]
  })
  useEased(stops, (value) => {
    uniforms.uStops.value.forEach((color, index) => color.setRGB(value[index * 3], value[index * 3 + 1], value[index * 3 + 2]))
  })
  useEased([inner, outer, opacity] as const, ([nextInner, nextOuter, nextOpacity]) => {
    uniforms.uInner.value = nextInner
    uniforms.uOuter.value = nextOuter
    uniforms.uOpacity.value = nextOpacity
    const target = material.current
    if (target) {
      // Follows the eased value, not the prop, so a fade-in is not opaque on frame one.
      const transparent = nextOpacity < 0.999
      if (target.transparent !== transparent) {
        target.transparent = transparent
        target.needsUpdate = true
      }
      target.depthWrite = nextOpacity > 0.5
    }
  })
  const invalidate = useThree(state => state.invalidate)
  useLayoutEffect(() => {
    uniforms.uAxis.value.copy(AXES[axis])
    uniforms.uHalfThickness.value = halfThickness
    invalidate()
  }, [uniforms, axis, halfThickness, invalidate])

  return (
    <shaderMaterial ref={material} args={[parameters]} toneMapped={false} />
  )
}
