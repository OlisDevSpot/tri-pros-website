'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { EquirectangularReflectionMapping } from 'three'

import { SCENE_LOAD } from '@/features/trade-scenes/constants/scene-load'
import { WEATHER_SKIES } from '@/features/trade-scenes/constants/weather-skies'
import { useSceneLoadApi } from '@/features/trade-scenes/contexts/scene-load-context'
import { markSceneReady } from '@/features/trade-scenes/lib/create-scene-load'
import { compileScene } from '@/features/trade-scenes/ui/lib/compile-scene'
import { uploadSceneTextures } from '@/features/trade-scenes/ui/lib/upload-scene-textures'
import { useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'

function nextAnimationFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()))
}

// The gate: while it is mounted R3F draws nothing itself, so the real materials compile here, off the first frame, and the
// first true frame is drawn while the canvas is still hidden under the lines.
export function SceneReadySignal() {
  const store = useSceneLoadApi()
  const inputs = useSceneInputsApi<TradeSceneInputs>()
  const gl = useThree(state => state.gl)
  const scene = useThree(state => state.scene)
  const camera = useThree(state => state.camera)
  const invalidate = useThree(state => state.invalidate)

  const showReal = useRef(false)
  const onFrame = useRef<(() => void) | null>(null)
  const onDrewReal = useRef<(() => void) | null>(null)

  useFrame(({ gl: renderer, scene: drawn, camera: viewer }) => {
    onFrame.current?.()
    // The canvas is visible from the handover on, so every frame then ends on the real scene, even one that only ran for a
    // recapture: the pass's normal-map image must never be what gets presented.
    if (showReal.current || store.getState().phase === 'handover') {
      renderer.render(drawn, viewer)
      // Its own render, not `gl.info.render.frame`, which a recapture or an environment bake moves as well.
      onDrewReal.current?.()
    }
  }, 1)

  useEffect(() => {
    let stopped = false
    const startedAt = performance.now()
    let warned = false
    const warn = (reason: unknown) => {
      if (!warned) {
        warned = true
        console.warn('The scene could not be fully prepared before it is shown.', reason)
      }
    }

    // drei sets the sky image as an equirect texture; the Lightformer stand-in is a cube.
    const { weather } = inputs.getState()
    const environmentFinal = () => !WEATHER_SKIES[weather].environment.image
      || scene.environment?.mapping === EquirectangularReflectionMapping
      || performance.now() - startedAt >= SCENE_LOAD.envCapMs
    const waitForEnvironment = () => new Promise<void>((resolve) => {
      onFrame.current = () => {
        if (environmentFinal()) {
          onFrame.current = null
          resolve()
        }
        else {
          invalidate()
        }
      }
      invalidate()
    })

    // Once the cap has handed over, or the canvas is gone, nothing here may run on: a late compile or upload would land in
    // the handover, at live, or on a renderer that has been swapped for the fallback.
    let capped = false
    const cut = () => stopped || capped

    const prepare = async () => {
      await waitForEnvironment()
      invalidate()
      if (cut()) {
        return
      }
      await compileScene(gl, scene, camera, cut)
      invalidate()
      if (cut()) {
        return
      }
      uploadSceneTextures(gl, scene)
      invalidate()
    }

    let capTimer: ReturnType<typeof setTimeout> | undefined
    const cap = new Promise<void>((resolve) => {
      capTimer = setTimeout(() => {
        capped = true
        onFrame.current = null
        resolve()
      }, SCENE_LOAD.overallCapMs)
    })

    const run = async () => {
      try {
        await Promise.race([prepare(), cap])
      }
      catch (error) {
        warn(error)
      }
      clearTimeout(capTimer)
      if (stopped) {
        return
      }
      await new Promise<void>((resolve) => {
        onDrewReal.current = () => {
          onDrewReal.current = null
          resolve()
        }
        showReal.current = true
        invalidate()
      })
      await nextAnimationFrame()
      if (stopped) {
        return
      }
      markSceneReady(store)
      invalidate()
    }
    void run()

    return () => {
      stopped = true
      clearTimeout(capTimer)
      onFrame.current = null
      onDrewReal.current = null
    }
  }, [store, inputs, gl, scene, camera, invalidate])

  // A fresh frame presented once the canvas is on its way to visible, in case the hidden one was never composited.
  useEffect(() => store.subscribe((state, previous) => {
    if (state.phase === 'handover' && previous.phase !== 'handover') {
      invalidate()
    }
  }), [store, invalidate])

  // R3F draws on its own again once this unmounts, but only on the next request.
  useEffect(() => () => invalidate(), [invalidate])

  return null
}
