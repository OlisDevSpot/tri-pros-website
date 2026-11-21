'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { YARD_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { useLayoutEditor, useLayoutEditorApi } from '@/features/trade-scenes/contexts/layout-editor-context'
import { useResolvedLayout } from '@/features/trade-scenes/contexts/resolved-layout-context'
import { yardBuildChanges } from '@/features/trade-scenes/lib/yard-picks'
import { presentYards } from '@/features/trade-scenes/lib/yards'
import { RailChip } from '@/features/trade-scenes/ui/components/controls/rail-chip'
import { useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'

// The Lot group's chips: the yards the lot has, a house built to a lot line leaving one out, each marked where the build
// changes it. Mounted only where the lot is data. A yard's card never sits under a spot chip, so a press lets the chip go.
export function YardRailChips() {
  const resolved = useResolvedLayout()
  const editor = useLayoutEditorApi()
  const inputs = useSceneInputsApi<TradeSceneInputs>()
  const held = useLayoutEditor(state => state.yard)
  return presentYards(resolved.yards).map(yard => (
    <RailChip
      key={yard}
      id={yard}
      label={YARD_LABELS[yard]}
      changed={yardBuildChanges(resolved.layout, resolved.yards, yard)}
      pressed={held === yard}
      onPress={() => {
        editor.setState(state => ({ yard: state.yard === yard ? null : yard, selected: null }))
        inputs.setState({ tappedSpot: null })
      }}
    />
  ))
}
