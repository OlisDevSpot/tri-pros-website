'use client'

import type { EditorSelection } from '@/features/trade-scenes/lib/create-layout-editor'
import type { ResolvedLayout } from '@/features/trade-scenes/types'

import { BufferGeometry } from 'three'

import { LAYOUT_EDITOR_LOOK } from '@/features/trade-scenes/constants/layout-editor-look'
import { fenceBandGeometry } from '@/features/trade-scenes/ui/lib/fence-band-geometry'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'
import { ignoreRaycast } from '@/shared/components/scene/lib/ignore-raycast'

interface LayoutFenceHighlightProps {
  resolved: ResolvedLayout
  selected: EditorSelection | null
}

// A line's id is its first cell, so a repaint can rename the selected one; a stale id draws nothing rather than a guess.
export function LayoutFenceHighlight({ resolved, selected }: LayoutFenceHighlightProps) {
  const line = selected?.type === 'fence' ? resolved.fences.find(f => f.id === selected.id) ?? null : null
  const geometry = useOwnedGeometry(
    () => line ? fenceBandGeometry(line, resolved.origin, resolved.heightAt, LAYOUT_EDITOR_LOOK.highlightWidth, LAYOUT_EDITOR_LOOK.highlightLift) : new BufferGeometry(),
    [resolved, line],
  )
  if (!line) {
    return null
  }
  return (
    <mesh geometry={geometry} raycast={ignoreRaycast} renderOrder={LAYOUT_EDITOR_LOOK.fenceOverlayOrder}>
      <meshBasicMaterial color={LAYOUT_EDITOR_LOOK.selected} depthWrite={false} depthTest={false} />
    </mesh>
  )
}
