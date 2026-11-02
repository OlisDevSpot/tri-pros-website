'use client'

import type { Camera } from 'three'
import type { BlueprintEdgePass } from '@/features/trade-scenes/ui/lib/blueprint-edge-pass'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

import { SCENE_LOAD } from '@/features/trade-scenes/constants/scene-load'
import { useSceneLoadApi, useSceneLoadLines } from '@/features/trade-scenes/contexts/scene-load-context'
import { advanceSceneLoad } from '@/features/trade-scenes/lib/create-scene-load'
import { createBlueprintEdgePass, drawBlueprint } from '@/features/trade-scenes/ui/lib/blueprint-edge-pass'
import { copyBlueprintLines } from '@/features/trade-scenes/ui/lib/copy-blueprint-lines'

// Where the camera stands and what its lens frames: the view offset and the fov live in the projection.
function cameraKey(camera: Camera): string {
  const { position: p, quaternion: q } = camera
  return `${p.x},${p.y},${p.z},${q.x},${q.y},${q.z},${q.w},${camera.projectionMatrix.elements.join(',')}`
}

// Priority 1 holds R3F's own render, and mounted before the ready signal its frame runs first, so the copy is taken before
// the signal's real frame overwrites the drawing buffer in the same frame.
export function BlueprintPass() {
  const store = useSceneLoadApi()
  const lines = useSceneLoadLines()
  const invalidate = useThree(state => state.invalidate)
  const width = useThree(state => state.size.width)
  const height = useThree(state => state.size.height)
  const dpr = useThree(state => state.viewport.dpr)
  const pass = useRef<BlueprintEdgePass | null>(null)
  const due = useRef(true)
  const warned = useRef(false)

  // Made in an effect, so StrictMode's second mount gets a pass of its own rather than one its first unmount disposed.
  useEffect(() => {
    const made = createBlueprintEdgePass()
    pass.current = made
    return () => {
      made.dispose()
      pass.current = null
    }
  }, [])

  // A resized canvas reallocates its drawing buffer, so the line image would be the old framing at the wrong size.
  useEffect(() => {
    due.current = true
    invalidate()
  }, [width, height, dpr, invalidate])

  // Drawn mid-glide, the lines would sit where the house was. A fold only tweens the view offset, a rotation also glides
  // the camera to a new framing, and on a slow frame either takes longer than its nominal clock, so until the handover the
  // pass waits for the camera itself to hold still rather than for a fixed delay.
  const seen = useRef('')
  const captured = useRef('')
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(settle.current), [])

  useFrame(({ gl, scene, camera }) => {
    const view = cameraKey(camera)
    if (view !== seen.current) {
      seen.current = view
      clearTimeout(settle.current)
      // Over the handover the lines are on screen beside the colouring-in scene, so they follow every move as it happens;
      // the signal's real frame still ends each of these frames.
      if (store.getState().phase === 'handover') {
        due.current ||= view !== captured.current
      }
      else {
        settle.current = setTimeout(() => {
          if (seen.current !== captured.current) {
            due.current = true
            invalidate()
          }
        }, SCENE_LOAD.recaptureSettleMs)
      }
    }
    // A frame asked for by a layout effect can come before the pass is made; the capture waits for the next.
    const made = pass.current
    if (!due.current || !made) {
      return
    }
    due.current = false
    captured.current = view
    const warn = (reason: unknown) => {
      if (!warned.current) {
        warned.current = true
        console.warn('The blueprint lines could not be drawn; the scene loads without them.', reason)
      }
    }
    try {
      const canvas = lines.current
      if (!canvas) {
        throw new Error('the lines canvas is not mounted')
      }
      drawBlueprint(gl, scene, camera, made)
      if (!copyBlueprintLines(canvas, gl.domElement)) {
        warn('no 2D context for the lines canvas')
      }
    }
    catch (error) {
      warn(error)
    }
    advanceSceneLoad(store, 'drawing')
  }, 1)

  return null
}
