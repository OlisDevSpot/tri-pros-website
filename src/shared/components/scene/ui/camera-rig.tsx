'use client'

import type { ComponentRef } from 'react'
import type { PerspectiveCamera } from 'three'
import type { CameraGoalState, DoubleTapRequest } from '@/shared/components/scene/lib/camera-goal'
import type { CameraFraming, PanBox, VisibleArea } from '@/shared/components/scene/types'

import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Box3, Vector2, Vector3 } from 'three'

import { MIN_SHARE } from '@/shared/components/scene/constants/scene-camera'
import { SCENE_MOTION } from '@/shared/components/scene/constants/scene-motion'
import { useOptionalSceneCameraApi } from '@/shared/components/scene/contexts/scene-camera-context'
import { useCameraWheel } from '@/shared/components/scene/hooks/use-camera-wheel'
import { useEased } from '@/shared/components/scene/hooks/use-eased'
import { useSceneTaps } from '@/shared/components/scene/hooks/use-scene-taps'
import { useTweened } from '@/shared/components/scene/hooks/use-tweened'
import { cameraFramingKey, cameraGoal } from '@/shared/components/scene/lib/camera-goal'
import { clampOrbitToBox } from '@/shared/components/scene/lib/clamp-orbit-to-box'
import { doubleTapFraming } from '@/shared/components/scene/lib/double-tap-framing'
import { isDoubleTapStop } from '@/shared/components/scene/lib/is-double-tap-stop'
import { panOffset } from '@/shared/components/scene/lib/pan-offset'
import { panSpeedFor, visibleHeight, worldPerPixel } from '@/shared/components/scene/lib/pan-scale'
import { widenFovForAspect } from '@/shared/components/scene/lib/widen-fov-for-aspect'

interface CameraRigProps {
  framing: CameraFraming
  orbit: { minDistance: number, maxDistance: number, maxPolarAngle: number }
  // The part of the canvas nothing covers; the camera frames that part, as if it were the whole canvas.
  visibleArea?: VisibleArea
  // Opt-in: the rep may pan, and the point the camera turns around stays inside the box. Needs a SceneCameraProvider.
  pan?: { box: PanBox, doubleTapDistance: number | null }
}

type AreaFractions = readonly [left: number, right: number, bottom: number, top: number]

const WHOLE_CANVAS: AreaFractions = [0, 0, 0, 0]

// The canvas itself never resizes for what covers it: shifting the frustum keeps the scene drawn under the cover while
// the framing centres in what is left, and the lens widens for that part's shape, not the canvas's. OrbitControls sizes
// a pan by the whole canvas height, so its speed makes up the share a cover above or a card below hides.
function frameVisibleArea(camera: PerspectiveCamera, controls: { panSpeed: number } | null, size: { width: number, height: number }, [left, right, bottom, top]: AreaFractions, baseFov: number) {
  const { width, height } = size
  const visibleW = width * Math.max(1 - left - right, MIN_SHARE)
  const visibleH = visibleHeight(height, top, bottom)
  camera.fov = widenFovForAspect(baseFov, visibleW / visibleH)
  if (controls) {
    controls.panSpeed = panSpeedFor(top, bottom)
  }
  if (left === 0 && right === 0 && bottom === 0 && top === 0) {
    // clearViewOffset leaves the visible area's aspect behind.
    camera.aspect = width / Math.max(height, 1)
    camera.clearViewOffset()
    return
  }
  camera.setViewOffset(visibleW, visibleH, -left * width, -top * height, width, height)
}

export function CameraRig({ framing, orbit, visibleArea, pan }: CameraRigProps) {
  const enabled = pan !== undefined
  const provided = useOptionalSceneCameraApi()
  if (enabled && !provided) {
    throw new Error('CameraRig was given pan without a SceneCameraProvider around it')
  }
  // A rig without pan never touches the store, even under a provider.
  const store = enabled ? provided : null
  const subscribe = useCallback((listener: () => void) => store?.subscribe(listener) ?? (() => {}), [store])
  const recenters = useSyncExternalStore(subscribe, () => store?.getState().recenters ?? 0, () => 0)

  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const camera = useThree(state => state.camera) as PerspectiveCamera
  const invalidate = useThree(state => state.invalidate)
  const get = useThree(state => state.get)
  // The numbers, not the size object, which R3F rebuilds when the canvas only moves.
  const width = useThree(state => state.size.width)
  const height = useThree(state => state.size.height)
  const area: AreaFractions = visibleArea ? [visibleArea.left, visibleArea.right, visibleArea.bottom, visibleArea.top] : WHOLE_CANVAS

  // Advanced in render, since the glide target below needs this render's goal, and committed in a layout effect, since a
  // render may be thrown away. The reducer is pure and an equal render changes nothing. A double-tap reaches it as state,
  // never as a write to the ref, which the next commit would overwrite.
  const framingKey = cameraFramingKey(framing)
  const [doubleTapRequest, setDoubleTapRequest] = useState<DoubleTapRequest | null>(null)
  const goal = useRef<CameraGoalState>({ framingKey, recenters, doubleTapId: 0, doubleTap: null })
  const step = cameraGoal(goal.current, { framingKey, recenters, doubleTap: doubleTapRequest })
  const glideTo = step.state.doubleTap ?? framing
  // A second look at the same spot is a new glide too, as a recenter onto an unchanged framing is.
  const glideKey = `${recenters}:${step.state.doubleTapId}`
  useLayoutEffect(() => {
    goal.current = step.state
    if (step.resetMoved) {
      store?.setState({ moved: false })
    }
  })
  useEffect(() => {
    // The chip must not outlive the camera it recenters: a lost context swaps the canvas for the fallback.
    return () => store?.setState({ moved: false })
  }, [store])

  // Each eased value stops writing once settled, so the user's orbit is theirs until the framing changes again; the
  // seeds start a glide from the live camera so it never snaps back to the previous framing first.
  const stopPosition = useEased(glideTo.position, (value) => {
    camera.position.set(value[0], value[1], value[2])
    controls.current?.update()
  }, () => [camera.position.x, camera.position.y, camera.position.z], glideKey)
  const stopTarget = useEased(glideTo.target, (value) => {
    controls.current?.target.set(value[0], value[1], value[2])
    controls.current?.update()
  }, () => {
    const live = controls.current?.target
    return live ? [live.x, live.y, live.z] : glideTo.target
  }, glideKey)
  const stopGlides = () => {
    stopPosition()
    stopTarget()
  }
  // A real move, never a press: a tap, or a double-tap's first tap, leaves a running glide alone.
  const markMoved = () => {
    stopGlides()
    if (store && !store.getState().moved) {
      store.setState({ moved: true })
    }
  }

  // The lens is the framing's fov widened for the visible area, and its two halves keep separate clocks: the fov glides
  // with the camera, the area with the card. Each keeps what it last applied, and either one frames from both.
  const baseFov = useRef(framing.fov)
  const applied = useRef<AreaFractions>(WHOLE_CANVAS)
  useEased(glideTo.fov, (value) => {
    baseFov.current = value
    frameVisibleArea(camera, controls.current, get().size, applied.current, value)
  })

  // On the curve and clock the card slides by, so the house and the card move as one. Only the view shifts, never the
  // camera, so a fold keeps the user's orbit.
  useTweened(area, (value) => {
    if (!visibleArea) {
      return
    }
    applied.current = value
    frameVisibleArea(camera, controls.current, get().size, value, baseFov.current)
  }, SCENE_MOTION.transition)
  // R3F resets the camera's aspect on every canvas resize, which would stretch the view until the area next changes; the
  // lens widens for the new shape with the canvas, not after it.
  useLayoutEffect(() => {
    frameVisibleArea(camera, controls.current, { width, height }, applied.current, baseFov.current)
    invalidate()
  }, [camera, width, height, invalidate])
  // A rig that stops being given an area hands back the whole canvas once, and nothing re-applies the old offset.
  const framesArea = visibleArea !== undefined
  useLayoutEffect(() => {
    if (!framesArea && applied.current !== WHOLE_CANVAS) {
      applied.current = WHOLE_CANVAS
      frameVisibleArea(camera, controls.current, { width, height }, WHOLE_CANVAS, baseFov.current)
      invalidate()
    }
  }, [framesArea, camera, width, height, invalidate])

  const [minX, minY, minZ] = pan?.box.min ?? [0, 0, 0]
  const [maxX, maxY, maxZ] = pan?.box.max ?? [0, 0, 0]
  const box = useMemo(() => new Box3(new Vector3(minX, minY, minZ), new Vector3(maxX, maxY, maxZ)), [minX, minY, minZ, maxX, maxY, maxZ])
  // The clamp otherwise waits for the controls' next change, so a box that shrinks past a panned target would snap the
  // camera on the rep's next touch. A running glide writes from its own eased values each frame, so this never fights it.
  useLayoutEffect(() => {
    const live = controls.current
    if (enabled && live && clampOrbitToBox(live.target, camera.position, box)) {
      live.update()
      invalidate()
    }
  }, [box, enabled, camera, invalidate])
  // Runs inside the controls' update, before it records where the camera is, so calling update here would re-enter it.
  const clampToBox = () => {
    if (controls.current) {
      clampOrbitToBox(controls.current.target, camera.position, box)
    }
  }
  // The same world per pixel as the drag pan, measured on the visible height the lens spans.
  const panBy = (dxPx: number, dyPx: number) => {
    const live = controls.current
    if (!live) {
      return
    }
    stopGlides()
    camera.updateMatrix()
    const [, , bottom, top] = applied.current
    const worldPerPx = worldPerPixel(camera.position.distanceTo(live.target), camera.fov, visibleHeight(get().size.height, top, bottom))
    const right = new Vector3().setFromMatrixColumn(camera.matrix, 0)
    const up = new Vector3().setFromMatrixColumn(camera.matrix, 1)
    const offset = panOffset({ dxPx, dyPx, right, up, worldPerPx })
    camera.position.add(offset)
    live.target.add(offset)
    clampOrbitToBox(live.target, camera.position, box)
    live.update()
  }
  const zoomBy = (distanceScale: number) => {
    const live = controls.current
    if (!live) {
      return
    }
    stopGlides()
    if (distanceScale < 1) {
      live.dollyIn(distanceScale)
    }
    else {
      live.dollyOut(1 / distanceScale)
    }
  }
  // Glides to the first solid thing under the tap. Up close a tap already looks at a part, so the caller turns this off there;
  // the hook reads it through its latest-callback ref, so the first tap's zoom has turned it off before the second lands.
  const lookAtTap = (clientX: number, clientY: number) => {
    const live = controls.current
    const maxDistance = pan?.doubleTapDistance ?? null
    if (!store || !live || maxDistance === null) {
      return
    }
    const { gl, raycaster, scene, events } = get()
    const rect = gl.domElement.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      return
    }
    const pointer = new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    camera.updateMatrixWorld()
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(scene.children, true).find(each => isDoubleTapStop(each.object, each.face?.materialIndex) === 'stop')
    if (!hit) {
      return
    }
    const looked = { ...doubleTapFraming({ point: hit.point, position: camera.position, target: live.target, box, maxDistance }), fov: framing.fov }
    setDoubleTapRequest(last => ({ id: (last?.id ?? 0) + 1, goal: looked }))
    // The overlay the ring is drawn in shares the event source's box, not necessarily the canvas element's.
    const origin = (events.connected as HTMLElement | undefined)?.getBoundingClientRect() ?? rect
    store.setState({ moved: true, tapMark: { x: clientX - origin.left, y: clientY - origin.top, at: performance.now() } })
  }
  useSceneTaps({ enabled, onMoved: markMoved, onDouble: lookAtTap })
  useCameraWheel({ enabled, panBy, zoomBy, onMoved: markMoved })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={enabled}
      screenSpacePanning
      enableDamping
      minDistance={orbit.minDistance}
      maxDistance={orbit.maxDistance}
      maxPolarAngle={orbit.maxPolarAngle}
      onChange={enabled ? clampToBox : undefined}
      // A drag mid-glide is the user taking the camera; the glide would otherwise pull it back. The fov ease keeps going, since
      // the drag never sets the fov. With pan, a press stops nothing until it really moves.
      onStart={enabled ? undefined : stopGlides}
    />
  )
}
