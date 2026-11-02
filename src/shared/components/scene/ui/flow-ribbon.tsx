'use client'

import type { RefObject } from 'react'
import type { RibbonStyle } from '@/shared/components/scene/constants/ribbon-styles'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AdditiveBlending, Color } from 'three'

import { RIBBON_FRAGMENT_SHADER, RIBBON_VERTEX_SHADER } from '@/shared/components/scene/constants/ribbon-shader'
import { RIBBON_STYLE_UNIFORMS } from '@/shared/components/scene/constants/ribbon-styles'
import { useSceneMotion } from '@/shared/components/scene/contexts/scene-motion-context'
import { useEased } from '@/shared/components/scene/hooks/use-eased'
import { applyRingWidths } from '@/shared/components/scene/lib/apply-ring-widths'
import { buildUnitTube, RIBBON_RADIAL_SEGMENTS, RIBBON_SEGMENTS } from '@/shared/components/scene/lib/build-unit-tube'
import { sampleProfile } from '@/shared/components/scene/lib/sample-profile'

interface FlowRibbonProps {
  points: readonly [number, number, number][]
  widths: readonly number[]
  color: string
  intensity?: number
  style?: RibbonStyle
  speed?: number
  /** Scrolls only while true; at rest the ribbon holds still and shows the flow by its width alone. */
  running?: boolean
  /** A live 0..1 the ribbon's brightness follows each frame, so it fades with whatever it is drawn in. */
  fade?: RefObject<number>
}

export function FlowRibbon({ points, widths, color, intensity = 2.2, style = 'stream', speed = 0.6, running = true, fade }: FlowRibbonProps) {
  const { reducedMotion } = useSceneMotion()
  const invalidate = useThree(state => state.invalidate)
  // Through the constructor, not a `uniforms` prop: R3F copies a prop's uniforms into the material's own object,
  // so the scroll, style and intensity written to ours afterwards would never reach the shader.
  const [parameters] = useState(() => ({
    uniforms: {
      uColor: { value: new Color(color) },
      uIntensity: { value: intensity },
      uTime: { value: 0 },
      uStripes: { value: RIBBON_STYLE_UNIFORMS[style].stripes },
      uSharpness: { value: RIBBON_STYLE_UNIFORMS[style].sharpness },
      uAmplitude: { value: RIBBON_STYLE_UNIFORMS[style].amplitude },
    },
    vertexShader: RIBBON_VERTEX_SHADER,
    fragmentShader: RIBBON_FRAGMENT_SHADER,
  }))
  const { uniforms } = parameters

  // The path is built once per value as a radius-1 tube; the width profile is then eased onto its rings in
  // place, so the flow visibly narrows when the widths change instead of the tube snapping to a new shape.
  const pointsKey = points.flat().join(',')
  const tube = useMemo(() => buildUnitTube(points),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pointsKey])
  useEffect(() => () => tube.geometry.dispose(), [tube])

  // Fixed length: easing maps values by index, so the raw widths (whose length may change) cannot be eased.
  const ringWidths = Array.from({ length: RIBBON_SEGMENTS + 1 }, (_, ring) => sampleProfile(widths, ring / RIBBON_SEGMENTS))
  const appliedWidths = useRef<readonly number[]>(ringWidths)
  const applyWidths = (value: readonly number[]) => {
    const position = tube.geometry.getAttribute('position')
    applyRingWidths(position.array as Float32Array, tube.centres, tube.geometry.getAttribute('normal').array as Float32Array, value, RIBBON_RADIAL_SEGMENTS)
    position.needsUpdate = true
    appliedWidths.current = value
  }
  // A new path starts at unit radius; bring it to the widths already on screen before it first draws.
  useLayoutEffect(() => {
    applyWidths(appliedWidths.current)
    invalidate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tube, invalidate])
  useEased(ringWidths, applyWidths)

  const target = new Color(color)
  const easedIntensity = useRef(intensity)
  useEased([target.r, target.g, target.b, intensity] as const, ([r, g, b, nextIntensity]) => {
    uniforms.uColor.value.setRGB(r, g, b)
    easedIntensity.current = nextIntensity
    uniforms.uIntensity.value = nextIntensity * (fade?.current ?? 1)
  })
  useLayoutEffect(() => {
    uniforms.uStripes.value = RIBBON_STYLE_UNIFORMS[style].stripes
    uniforms.uSharpness.value = RIBBON_STYLE_UNIFORMS[style].sharpness
    uniforms.uAmplitude.value = RIBBON_STYLE_UNIFORMS[style].amplitude
    invalidate()
  }, [uniforms, style, invalidate])

  // Turning reduced motion off, or a burst starting, must restart the scroll after the loop went idle.
  useEffect(() => {
    invalidate()
  }, [reducedMotion, running, invalidate])

  // A scrolling ribbon keeps asking for frames while it runs; with reduced motion, or once it stops running, it
  // holds still and shows the flow by width alone.
  useFrame((state, delta) => {
    if (fade) {
      uniforms.uIntensity.value = easedIntensity.current * fade.current
    }
    if (reducedMotion || !running) {
      return
    }
    uniforms.uTime.value += delta * speed
    state.invalidate()
  })

  return (
    <mesh geometry={tube.geometry}>
      <shaderMaterial
        args={[parameters]}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  )
}
