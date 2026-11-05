'use client'

import type { RefObject } from 'react'
import type { CanvasTexture, InstancedMesh } from 'three'
import type { ArrowLane } from '@/features/trade-scenes/types'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AdditiveBlending, Color, DynamicDrawUsage, InstancedBufferAttribute, NormalBlending, PlaneGeometry, ShaderMaterial } from 'three'

import { HEAT_ARROW_LOOK } from '@/features/trade-scenes/constants/heat-arrow-look'
import { HEAT_ARROW_FRAGMENT_SHADER, HEAT_ARROW_VERTEX_SHADER } from '@/features/trade-scenes/constants/heat-arrow-shader'
import { writeArrowStations } from '@/features/trade-scenes/lib/arrow-stations'
import { createCometTexture } from '@/features/trade-scenes/ui/lib/create-comet-texture'
import { useSceneMotion } from '@/shared/components/scene/contexts/scene-motion-context'
import { ignoreRaycast } from '@/shared/components/scene/lib/ignore-raycast'

interface HeatArrowsProps {
  lanes: readonly ArrowLane[]
  /** The arrow's length in metres. */
  size: number
  /** A live 0..1 the arrows' brightness follows each frame, so they fade with whatever they are drawn in. */
  fade?: RefObject<number>
  /** Drawn over the parts' own colours rather than the thermal camera's paint. */
  daylight?: boolean
  /** Hidden behind whatever surface stands in front of them, rather than laid over the whole scene. */
  depthTest?: boolean
}

interface ArrowBuffers {
  geometry: PlaneGeometry
  centres: InstancedBufferAttribute
  directions: InstancedBufferAttribute
  fades: InstancedBufferAttribute
  flows: InstancedBufferAttribute
}

// One texture for every arrow on every lane, drawn on first use because the canvas only exists in the browser.
let comet: CanvasTexture | null = null
function cometTexture(): CanvasTexture {
  comet ??= createCometTexture()
  return comet
}

function createBuffers(total: number): ArrowBuffers {
  const geometry = new PlaneGeometry(1, 1)
  const centres = new InstancedBufferAttribute(new Float32Array(total * 3), 3).setUsage(DynamicDrawUsage)
  const directions = new InstancedBufferAttribute(new Float32Array(total * 3), 3).setUsage(DynamicDrawUsage)
  const fades = new InstancedBufferAttribute(new Float32Array(total), 1).setUsage(DynamicDrawUsage)
  const flows = new InstancedBufferAttribute(new Float32Array(total), 1)
  geometry.setAttribute('aCentre', centres)
  geometry.setAttribute('aDirection', directions)
  geometry.setAttribute('aFade', fades)
  geometry.setAttribute('aFlow', flows)
  return { geometry, centres, directions, fades, flows }
}

// A lane's flow holds while its arrows move, so it is written when the lanes change rather than every frame.
function weighArrows({ flows }: ArrowBuffers, lanes: readonly ArrowLane[]) {
  let first = 0
  for (const lane of lanes) {
    const count = Math.max(lane.count, 0)
    flows.array.fill(lane.flow, first, first + count)
    first += count
  }
  flows.needsUpdate = true
}

function placeArrows(buffers: ArrowBuffers, lanes: readonly ArrowLane[], seconds: number) {
  const { centres, directions, fades } = buffers
  let first = 0
  for (const lane of lanes) {
    const count = Math.max(lane.count, 0)
    const written = writeArrowStations(lane, seconds, centres.array, directions.array, fades.array, first)
    // A lane that lost its length keeps its slots; dimming them stops its last stations lingering on screen.
    fades.array.fill(0, first + written, first + count)
    first += count
  }
  centres.needsUpdate = true
  directions.needsUpdate = true
  fades.needsUpdate = true
}

// One instanced draw for every arrow on every lane, so however much heat the home shows it costs the tablet a single draw call.
export function HeatArrows({ lanes, size, fade, daylight = false, depthTest = false }: HeatArrowsProps) {
  const { reducedMotion } = useSceneMotion()
  const invalidate = useThree(state => state.invalidate)
  const total = lanes.reduce((sum, lane) => sum + Math.max(lane.count, 0), 0)

  const [material] = useState(() => {
    const texture = cometTexture()
    const image = texture.image as HTMLCanvasElement
    return new ShaderMaterial({
      uniforms: {
        uMap: { value: texture },
        uSize: { value: size },
        uWeakestSize: { value: HEAT_ARROW_LOOK.weakest.size },
        uWeakestBrightness: { value: HEAT_ARROW_LOOK.weakest.brightness },
        uWeakestSaturation: { value: HEAT_ARROW_LOOK.weakest.saturation },
        uAspect: { value: image.height / image.width },
        uBrightness: { value: 1 },
        uDaylight: { value: 0 },
        uDaylightTint: { value: new Color(HEAT_ARROW_LOOK.daylight.tint) },
        uDaylightEdge: { value: new Color(HEAT_ARROW_LOOK.daylight.edge) },
      },
      vertexShader: HEAT_ARROW_VERTEX_SHADER,
      fragmentShader: HEAT_ARROW_FRAGMENT_SHADER,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    })
  })
  useEffect(() => () => material.dispose(), [material])

  // Sized once per arrow total; the lanes' points and speeds are rewritten into these every frame instead.
  const buffers = useMemo(() => createBuffers(total), [total])
  useEffect(() => () => buffers.geometry.dispose(), [buffers])

  const seconds = useRef(0)
  const latestLanes = useRef(lanes)
  const mesh = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    material.uniforms.uSize.value = size
    invalidate()
  }, [material, size, invalidate])

  // Under the thermal camera the arrows glow over the paint; in daylight added light would wash them out on pale parts.
  useLayoutEffect(() => {
    material.uniforms.uDaylight.value = daylight ? 1 : 0
    material.blending = daylight ? NormalBlending : AdditiveBlending
    invalidate()
  }, [material, daylight, invalidate])

  useLayoutEffect(() => {
    material.depthTest = depthTest
    invalidate()
  }, [material, depthTest, invalidate])

  // Under reduced motion the arrows hold still, evenly spaced, so the count still reads; this one write and frame draws
  // them. Otherwise the frame it asks for starts the loop below, which then keeps itself going.
  useLayoutEffect(() => {
    latestLanes.current = lanes
    weighArrows(buffers, lanes)
    placeArrows(buffers, lanes, reducedMotion ? 0 : seconds.current)
    invalidate()
  }, [buffers, lanes, reducedMotion, invalidate])

  // Heat never rests while it is on screen, so the arrows ask for every next frame themselves; unmounting, reduced
  // motion, or every lane running dry (rain) is what lets the canvas go back to rendering on demand.
  useFrame((state, delta) => {
    const brightness = fade?.current ?? 1
    material.uniforms.uBrightness.value = brightness
    // Faded all the way out they stop drawing, even on the frames another set of arrows asks for, and stop asking;
    // whatever raises the fade asks for the next frame.
    if (mesh.current) {
      mesh.current.visible = brightness > 0
    }
    if (reducedMotion || total === 0 || brightness === 0) {
      return
    }
    seconds.current += Math.min(delta, HEAT_ARROW_LOOK.maxFrameSeconds)
    placeArrows(buffers, latestLanes.current, seconds.current)
    state.invalidate()
  })

  if (total === 0) {
    return null
  }
  return (
    <instancedMesh
      ref={mesh}
      key={total}
      args={[buffers.geometry, material, total]}
      frustumCulled={false}
      renderOrder={HEAT_ARROW_LOOK.renderOrder}
      raycast={ignoreRaycast}
    />
  )
}
