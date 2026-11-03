'use client'

import type { ReactNode } from 'react'
import type { ToneMapping } from 'three'
import type { SceneRenderer } from '@/shared/components/scene/types'

import { Canvas } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import dynamic from 'next/dynamic'
import { useMemo, useRef, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { SCENE_DEFAULT_CAMERA, SCENE_DEFAULT_FAR } from '@/shared/components/scene/constants/scene-camera'
import { SceneMotionContext } from '@/shared/components/scene/contexts/scene-motion-context'
import { createWebGpuRenderer } from '@/shared/components/scene/lib/create-webgpu-renderer'
import { startsWheelStream } from '@/shared/components/scene/lib/starts-wheel-stream'
import { SceneLights } from '@/shared/components/scene/ui/scene-lights'

// postprocessing downloads only for a scene that asks for bloom (look-dev today); the home scene never pays for it.
// No loading UI: anything but null inside the canvas would be a DOM node in a three.js tree.
const SceneBloom = dynamic(() => import('@/shared/components/scene/ui/scene-bloom').then(m => m.SceneBloom), { ssr: false, loading: () => null })

interface SceneShellProps {
  label: string
  fallback: ReactNode
  renderer?: SceneRenderer
  bloom?: boolean
  camera?: { fov: number, position: [number, number, number], far?: number }
  // A scene with its own sky lights itself (a winter evening cannot share the studio key light).
  lights?: ReactNode
  shadows?: boolean
  // Set at creation, so no material compiles twice; R3F's own ACES default applies only when this is left out.
  toneMapping?: { mapping: ToneMapping, exposure: number }
  onPointerDown?: () => void
  // Once per wheel stream, not per event: a trackpad sends dozens a second.
  onWheelStream?: () => void
  // Only when the fallback really replaces the canvas (a lost context or a render error).
  onFallback?: () => void
  // DOM drawn over the live canvas only (a key to its colours): never over the fallback, where it would explain nothing.
  overlay?: ReactNode
  children: ReactNode
}

export function SceneShell({ label, fallback, renderer = 'webgl', bloom = false, camera = SCENE_DEFAULT_CAMERA, lights = <SceneLights />, shadows = false, toneMapping, onPointerDown, onWheelStream, onFallback, overlay, children }: SceneShellProps) {
  const reducedMotion = useReducedMotion() ?? false
  const [lost, setLost] = useState(false)
  const [live, setLive] = useState(false)
  const motion = useMemo(() => ({ reducedMotion }), [reducedMotion])
  const lastWheelAt = useRef<number | null>(null)
  // The context listener is attached once, in onCreated, so it reads the latest callback through a ref.
  const onFallbackRef = useRef(onFallback)
  onFallbackRef.current = onFallback

  // An iPad under memory pressure can drop the context mid-meeting; the fallback carries the story from there.
  if (lost) {
    return fallback
  }

  return (
    <ErrorBoundary fallback={fallback} onError={() => onFallbackRef.current?.()}>
      <Canvas
        dpr={[1, 2]}
        frameloop="demand"
        shadows={shadows}
        camera={{ fov: camera.fov, near: 0.1, far: camera.far ?? SCENE_DEFAULT_FAR, position: camera.position }}
        gl={renderer === 'webgpu'
          ? (createWebGpuRenderer as unknown as NonNullable<Parameters<typeof Canvas>[0]['gl']>)
          : { antialias: true, ...(toneMapping && { toneMapping: toneMapping.mapping, toneMappingExposure: toneMapping.exposure }) }}
        fallback={fallback}
        aria-label={label}
        role="img"
        // Capture, so a control that handles the press itself (the orbit drag, a tapped part) still reports it.
        onPointerDownCapture={onPointerDown}
        // Capture as well: a camera rig's own wheel listener stops the event before it bubbles.
        onWheelCapture={onWheelStream && ((event) => {
          const starts = startsWheelStream(lastWheelAt.current, event.timeStamp)
          lastWheelAt.current = event.timeStamp
          if (starts) {
            onWheelStream()
          }
        })}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', () => {
            setLost(true)
            onFallbackRef.current?.()
          }, { once: true })
          setLive(true)
        }}
      >
        <SceneMotionContext value={motion}>
          {lights}
          {children}
          {/* postprocessing has no WebGPU path yet, which is why WebGPU stays a look-dev option. */}
          {bloom && renderer === 'webgl' && <SceneBloom />}
        </SceneMotionContext>
      </Canvas>
      {live && overlay}
    </ErrorBoundary>
  )
}
