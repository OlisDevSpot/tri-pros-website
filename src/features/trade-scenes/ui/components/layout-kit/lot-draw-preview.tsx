'use client'

import type { BufferGeometry, Mesh } from 'three'
import type { EditorStroke, FenceBrush, GroundBrush, LayoutEditorState } from '@/features/trade-scenes/lib/create-layout-editor'
import type { GridVertex, GroundLayer, LineRange, LotLayout, ResolvedLayout, TileRect, TradeSceneInputs } from '@/features/trade-scenes/types'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef } from 'react'

import { FENCE_KINDS, FENCE_NONE } from '@/features/trade-scenes/constants/fence-kinds'
import { GROUND_BASE, GROUND_MATERIALS, PROPOSED_KEEP } from '@/features/trade-scenes/constants/ground-materials'
import { LAYOUT_EDITOR_LOOK } from '@/features/trade-scenes/constants/layout-editor-look'
import { useLayoutEditor, useLayoutEditorApi } from '@/features/trade-scenes/contexts/layout-editor-context'
import { fenceStrokeBrush, groundStrokeBrush } from '@/features/trade-scenes/lib/draw-brush'
import { lineRangeBetween } from '@/features/trade-scenes/lib/fence-stroke'
import { rectBetween } from '@/features/trade-scenes/lib/paint-tiles'
import { fenceBandGeometry } from '@/features/trade-scenes/ui/lib/fence-band-geometry'
import { regionStripGeometry } from '@/features/trade-scenes/ui/lib/region-strip-geometry'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { ignoreRaycast } from '@/shared/components/scene/lib/ignore-raycast'

interface LotDrawPreviewProps {
  resolved: ResolvedLayout
}

const LIFT = 0.05

// Base and Keep erase, so they show no material's colour.
function brushColor({ existing, proposed }: GroundBrush): string {
  if (existing !== null && existing !== GROUND_BASE) {
    return GROUND_MATERIALS[existing].look.color
  }
  return proposed !== null && proposed !== PROPOSED_KEEP ? GROUND_MATERIALS[proposed].look.color : LAYOUT_EDITOR_LOOK.previewNeutral
}

// None and Keep erase, so they show no kind's colour.
function fenceBrushColor({ existing, proposed }: FenceBrush): string {
  if (existing !== null && existing !== FENCE_NONE) {
    return FENCE_KINDS[existing].look.color
  }
  return proposed !== null && proposed !== PROPOSED_KEEP ? FENCE_KINDS[proposed].look.color : LAYOUT_EDITOR_LOOK.previewNeutral
}

// The colour of what the stroke will write, from the same brush the stroke builds.
function strokeColor({ tool, pick }: LayoutEditorState, view: GroundLayer): string {
  return tool === 'fence' ? fenceBrushColor(fenceStrokeBrush(pick.fence, view)) : brushColor(groundStrokeBrush(pick.ground, view))
}

function inRect(cols: number, rect: TileRect): (i: number) => boolean {
  return (i) => {
    const c = i % cols
    const r = (i - c) / cols
    return c >= rect.c0 && c < rect.c0 + rect.cols && r >= rect.r0 && r < rect.r0 + rect.rows
  }
}

// A press that has not moved yet still shows where the trace starts: the cell to the right of its vertex.
function pressCell([col, row]: GridVertex, lot: LotLayout): LineRange {
  const from = Math.min(col, lot.cols - 1)
  return { axis: 'across', line: row, from, to: from + 1 }
}

function strokeGeometry(stroke: EditorStroke, resolved: ResolvedLayout): BufferGeometry {
  const { lot } = resolved.layout
  if (stroke.tool === 'fence') {
    const range = lineRangeBetween(stroke.from, stroke.to) ?? pressCell(stroke.from, lot)
    return fenceBandGeometry(range, resolved.origin, resolved.heightAt, LAYOUT_EDITOR_LOOK.bandWidth, LAYOUT_EDITOR_LOOK.bandLift)
  }
  return regionStripGeometry(lot, resolved.origin, resolved.heightAt, resolved.mask, inRect(lot.cols, rectBetween(stroke.from, stroke.to)), LIFT)
}

// The rectangle follows the finger in the frame loop, so a stroke's moves never re-render React. It is built as the
// region strips are, a quad per tile row on the grade: one flat plane at the centre row's height sank under the sloped
// front yard at the house end and floated at the street end, and shifted on screen as the stroke grew.
export function LotDrawPreview({ resolved }: LotDrawPreviewProps) {
  const editor = useLayoutEditorApi()
  const open = useLayoutEditor(state => state.stroke !== null)
  const view = useSceneInputs((state: TradeSceneInputs) => state.view)
  const color = useLayoutEditor(state => strokeColor(state, view))
  const fenceTrace = useLayoutEditor(state => state.stroke?.tool === 'fence')
  const invalidate = useThree(state => state.invalidate)
  const mesh = useRef<Mesh>(null)
  const built = useRef<{ stroke: LayoutEditorState['stroke'], resolved: ResolvedLayout, geometry: BufferGeometry } | null>(null)

  // The press's own frame can run before the mesh mounts; one more places it.
  useLayoutEffect(() => {
    if (open) {
      invalidate()
    }
  }, [open, invalidate])

  // The geometry is swapped in the frame loop, so the last one is disposed here rather than by useOwnedGeometry.
  useEffect(() => {
    const owned = built
    return () => {
      owned.current?.geometry.dispose()
      owned.current = null
    }
  }, [])

  useFrame(() => {
    const live = mesh.current
    const stroke = editor.getState().stroke
    if (!live) {
      return
    }
    live.visible = stroke !== null
    if (!stroke || (built.current?.stroke === stroke && built.current.resolved === resolved)) {
      return
    }
    const geometry = strokeGeometry(stroke, resolved)
    built.current?.geometry.dispose()
    built.current = { stroke, resolved, geometry }
    live.geometry = geometry
  })

  if (!open) {
    return null
  }
  // Only the fence's band draws over the scene; the ground's rectangle stays under the house, as the regions do.
  return (
    <mesh ref={mesh} visible={false} raycast={ignoreRaycast} renderOrder={fenceTrace ? LAYOUT_EDITOR_LOOK.fenceOverlayOrder : 0}>
      {fenceTrace
        ? <meshBasicMaterial key="fence" color={color} transparent opacity={LAYOUT_EDITOR_LOOK.previewOpacity} depthWrite={false} depthTest={false} />
        : <meshBasicMaterial key="ground" color={color} transparent opacity={LAYOUT_EDITOR_LOOK.previewOpacity} depthWrite={false} />}
    </mesh>
  )
}
