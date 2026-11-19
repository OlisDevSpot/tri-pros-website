'use client'

import type { ThreeEvent } from '@react-three/fiber'
import type { Vector3 } from 'three'
import type { EditorStroke } from '@/features/trade-scenes/lib/create-layout-editor'
import type { ResolvedLayout, TradeSceneInputs } from '@/features/trade-scenes/types'
import type { GroundHandlers } from '@/features/trade-scenes/ui/components/layout-kit/layout-ground'

import { useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { MAGNET_TILES } from '@/features/trade-scenes/constants/layout-grid'
import { useLayoutEditor, useLayoutEditorApi } from '@/features/trade-scenes/contexts/layout-editor-context'
import { applyFenceStroke, applyStroke, commitLayout } from '@/features/trade-scenes/lib/create-layout-editor'
import { fenceStrokeBrush, groundStrokeBrush } from '@/features/trade-scenes/lib/draw-brush'
import { lineRangeBetween, magnetVertex, vertexAlong } from '@/features/trade-scenes/lib/fence-stroke'
import { rectBetween } from '@/features/trade-scenes/lib/paint-tiles'
import { tileAt, vertexAt } from '@/features/trade-scenes/lib/tile-at'
import { isNearestSolidHit } from '@/features/trade-scenes/ui/lib/nearest-solid-hit'
import { useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'

interface OpenStroke {
  pointerId: number
  target: Element
  // A captured pointer whose ray misses the ground is handed the press's own hit again, point and all.
  downPoint: Vector3
  // Refuses a new stroke past a cancel until every finger is up.
  hold: () => void
  detach: () => void
}

export function useLotDrawHandlers(resolved: ResolvedLayout): GroundHandlers | null {
  const mode = useLayoutEditor(state => state.mode)
  const tool = useLayoutEditor(state => state.tool)
  const editor = useLayoutEditorApi()
  const inputs = useSceneInputsApi<TradeSceneInputs>()
  const invalidate = useThree(state => state.invalidate)
  const scene = useThree(state => state.scene)
  const raycaster = useThree(state => state.raycaster)
  const open = useRef<OpenStroke | null>(null)
  const held = useRef<(() => void) | null>(null)

  const closeStroke = useCallback((hold = false) => {
    const active = open.current
    if (!active) {
      return null
    }
    open.current = null
    if (active.target.hasPointerCapture(active.pointerId)) {
      active.target.releasePointerCapture(active.pointerId)
    }
    if (hold) {
      active.hold()
    }
    else {
      active.detach()
    }
    const { stroke } = editor.getState()
    editor.setState({ stroke: null })
    invalidate()
    return stroke
  }, [editor, invalidate])

  // Leaving draw mode, or the lot unmounting, mid-stroke must still drop the stroke and the document's listeners.
  useEffect(() => {
    if (mode !== 'draw') {
      return
    }
    return () => {
      closeStroke()
      held.current?.()
    }
  }, [mode, closeStroke])

  const fenceStrokeAt = useCallback((x: number, z: number): EditorStroke | null => {
    const { origin, layout } = resolved
    const magnet = magnetVertex(origin, layout.lot, x, z, MAGNET_TILES)
    if (magnet) {
      return { tool: 'fence', from: magnet.vertex, to: magnet.vertex, lock: magnet.lock }
    }
    const vertex = vertexAt(origin, layout.lot, x, z)
    return vertex && { tool: 'fence', from: vertex, to: vertex, lock: null }
  }, [resolved])

  const onPointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (!event.isPrimary || event.button !== 0 || open.current || held.current) {
      return
    }
    // A press on a wall or the roof would paint ground the user cannot see, so it opens no stroke.
    if (!isNearestSolidHit(event, raycaster, scene)) {
      return
    }
    const tile = tileAt(resolved.origin, resolved.layout.lot, event.point.x, event.point.z)
    const stroke = tool === 'fence' ? fenceStrokeAt(event.point.x, event.point.z) : tile && { tool, from: tile, to: tile } satisfies EditorStroke
    if (!stroke) {
      return
    }
    event.stopPropagation()
    const target = event.target as Element
    target.setPointerCapture(event.pointerId)
    const doc = (event.nativeEvent.target as Node | null)?.ownerDocument ?? document
    const { pointerId } = event
    // With touch-action none a pinch fires no pointercancel, and a second finger off the ground never reaches this mesh;
    // R3F forwards no pointercancel to a mesh either, so the document hears both. A second finger cancels the stroke, and
    // until the last finger lifts no press opens another: the fingers of a pinch land one after another, and each would
    // start a stroke of its own.
    const down = new Set([pointerId])
    const listening = new AbortController()
    const detach = () => listening.abort()
    const release = () => {
      held.current = null
      detach()
    }
    const onDown = (native: PointerEvent) => {
      down.add(native.pointerId)
      if (!native.isPrimary) {
        closeStroke(true)
      }
    }
    const onLift = (native: PointerEvent) => {
      down.delete(native.pointerId)
      if (native.type === 'pointercancel' && native.pointerId === pointerId) {
        closeStroke(true)
      }
      if (held.current && down.size === 0) {
        release()
      }
    }
    const options = { capture: true, signal: listening.signal }
    doc.addEventListener('pointerdown', onDown, options)
    doc.addEventListener('pointerup', onLift, options)
    doc.addEventListener('pointercancel', onLift, options)
    open.current = {
      pointerId,
      target,
      downPoint: event.point,
      hold: () => {
        held.current = release
      },
      detach,
    }
    editor.setState({ stroke })
    invalidate()
  }, [resolved, tool, scene, raycaster, editor, invalidate, closeStroke, fenceStrokeAt])

  const onPointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    const active = open.current
    const stroke = editor.getState().stroke
    if (!active || !stroke || !event.isPrimary || event.pointerId !== active.pointerId) {
      return
    }
    event.stopPropagation()
    if (event.point === active.downPoint) {
      return
    }
    const { origin, layout } = resolved
    const { x, z } = event.point
    const to = stroke.tool === 'ground'
      ? tileAt(origin, layout.lot, x, z)
      : stroke.lock ? vertexAlong(origin, layout.lot, stroke.lock, x, z) : vertexAt(origin, layout.lot, x, z)
    if (!to || (to[0] === stroke.to[0] && to[1] === stroke.to[1])) {
      return
    }
    editor.setState({ stroke: { ...stroke, to } })
    invalidate()
  }, [resolved, editor, invalidate])

  const onPointerUp = useCallback((event: ThreeEvent<PointerEvent>) => {
    const active = open.current
    if (!active || !event.isPrimary || event.pointerId !== active.pointerId) {
      return
    }
    event.stopPropagation()
    const stroke = closeStroke()
    if (!stroke) {
      return
    }
    const { from, to } = stroke
    // A press that never left its tile or its vertex is a slip, not a stroke: it paints nothing.
    if (from[0] === to[0] && from[1] === to[1]) {
      return
    }
    // Read at the lift, so a flip of the view made mid-stroke is the layer written. A pick from the bar restarts drawing
    // and drops the stroke, so it never reaches here.
    const { pick } = editor.getState()
    const { view, layout } = inputs.getState()
    if (stroke.tool === 'ground') {
      commitLayout(inputs, editor, applyStroke(layout, rectBetween(from, to), groundStrokeBrush(pick.ground, view)))
      return
    }
    const range = lineRangeBetween(from, to)
    if (range) {
      commitLayout(inputs, editor, applyFenceStroke(layout, range, fenceStrokeBrush(pick.fence, view)))
    }
  }, [editor, inputs, closeStroke])

  const onPointerCancel = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (open.current?.pointerId === event.pointerId) {
      closeStroke()
    }
  }, [closeStroke])

  return useMemo(
    () => mode === 'draw' ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } : null,
    [mode, onPointerDown, onPointerMove, onPointerUp, onPointerCancel],
  )
}
