'use client'

import type { AnimationAction, AnimationClip as Clip, Material } from 'three'
import type { GltfAsset } from '@/shared/components/scene/hooks/use-gltf-asset'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AnimationClip, AnimationMixer, AnimationUtils, LoopPingPong, LoopRepeat, Mesh, MeshBasicMaterial } from 'three'

import { FIGURE } from '@/shared/components/scene/constants/figure'

interface LoadedFigureProps {
  asset: GltfAsset
  clip: string
  clipFrom?: number
  overlay?: Clip | null
  palette: Record<string, string>
  running: boolean
  pace?: () => number
  thermal?: { color: string }
}

type Tintable = Material & { color: { set: (value: string) => void } }

// A clip that opens with a move into its pose (standing up, then sitting) is cut to start where the pose holds; it then
// loops back and forth inside the hold, since jumping from its end to its start would replay a seam.
function heldClip(animations: Clip[], name: string, from: number): Clip | null {
  const found = AnimationClip.findByName(animations, name)
  if (!found || from <= 0) {
    return found ?? null
  }
  const fps = FIGURE.subclipFps
  return AnimationUtils.subclip(found, `${found.name}@${from}`, Math.round(from * fps), Math.ceil(found.duration * fps) + 1, fps)
}

export function LoadedFigure({ asset, clip, clipFrom = 0, overlay = null, palette, running, pace, thermal }: LoadedFigureProps) {
  const gltf = asset
  const invalidate = useThree(state => state.invalidate)
  const mixer = useMemo(() => new AnimationMixer(gltf.scene), [gltf.scene])
  const current = useRef<AnimationAction | null>(null)
  const layered = useRef<AnimationAction | null>(null)
  const runningRef = useRef(running)
  runningRef.current = running
  const paceRef = useRef(pace)
  paceRef.current = pace
  // Wound down to a stop at the end of a burst: that still pose is the rest pose, so stopping does not jump it to frame 0.
  const wound = useRef(false)

  useEffect(() => () => {
    mixer.stopAllAction()
    mixer.uncacheRoot(gltf.scene)
    current.current = null
    layered.current = null
  }, [mixer, gltf.scene])

  // The materials are this figure's own clones listed by useGltfAsset, so recolouring never leaks to another figure.
  const paletteKey = JSON.stringify(palette)
  useEffect(() => {
    const colours = JSON.parse(paletteKey) as Record<string, string>
    for (const material of asset.materials) {
      const colour = colours[material.name]
      if (colour && 'color' in material) {
        (material as Tintable).color.set(colour)
      }
    }
    invalidate()
  }, [asset, paletteKey, invalidate])

  const thermalColor = thermal?.color
  useEffect(() => {
    if (!thermalColor) {
      return
    }
    const flat = new MeshBasicMaterial({ color: thermalColor, toneMapped: false })
    const originals = new Map<Mesh, Mesh['material']>()
    gltf.scene.traverse((object) => {
      if (object instanceof Mesh) {
        originals.set(object, object.material)
        object.material = flat
      }
    })
    invalidate()
    return () => {
      originals.forEach((material, mesh) => {
        mesh.material = material
      })
      flat.dispose()
      invalidate()
    }
  }, [gltf.scene, thermalColor, invalidate])

  const base = useMemo(() => heldClip(gltf.animations, clip, clipFrom), [gltf.animations, clip, clipFrom])

  useEffect(() => {
    if (!base) {
      return
    }
    const next = mixer.clipAction(base)
    next.setLoop(clipFrom > 0 ? LoopPingPong : LoopRepeat, Infinity)
    const previous = current.current
    next.reset().play()
    if (previous && previous !== next && runningRef.current) {
      next.crossFadeFrom(previous, FIGURE.crossfadeSeconds, false)
    }
    else if (previous && previous !== next) {
      previous.stop()
    }
    current.current = next
    if (!runningRef.current) {
      mixer.update(0)
    }
    invalidate()
  }, [base, clipFrom, mixer, invalidate])

  // The overlay is additive (its clip's blend mode), a gesture on top of whatever the base clip does.
  useEffect(() => {
    const previous = layered.current
    const next = overlay ? mixer.clipAction(overlay) : null
    if (next === previous) {
      return
    }
    if (previous) {
      if (runningRef.current) {
        previous.fadeOut(FIGURE.crossfadeSeconds)
      }
      else {
        previous.stop()
      }
    }
    if (next) {
      next.reset().play()
      if (runningRef.current) {
        next.fadeIn(FIGURE.crossfadeSeconds)
      }
    }
    layered.current = next
    if (!runningRef.current) {
      mixer.update(0)
    }
    invalidate()
  }, [overlay, mixer, invalidate])

  // Stopped means the rest frame of each clip it is on: a mid-stride pose left frozen reads as a glitch. A figure the burst
  // already wound down to a stop keeps the pose it stopped in.
  useEffect(() => {
    if (running) {
      wound.current = false
      mixer.timeScale = 1
      invalidate()
      return
    }
    mixer.timeScale = 1
    if (wound.current) {
      return
    }
    const action = current.current
    const gesture = layered.current
    if (!action && !gesture) {
      return
    }
    mixer.stopAllAction()
    for (const settled of [action, gesture]) {
      if (settled) {
        settled.reset().play()
        settled.time = 0
      }
    }
    mixer.update(0)
    invalidate()
  }, [running, mixer, invalidate])

  useFrame((state, delta) => {
    if (!running) {
      return
    }
    const speed = paceRef.current ? paceRef.current() : 1
    mixer.timeScale = speed
    wound.current = speed < FIGURE.woundBelow
    mixer.update(Math.min(delta, FIGURE.maxFrameSeconds))
    state.invalidate()
  })

  return <primitive object={gltf.scene} />
}
