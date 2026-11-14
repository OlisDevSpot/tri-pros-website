'use client'

import type { DrawnHvac, TradeSceneInputs } from '@/features/trade-scenes/types'
import type { ResolvedPart } from '@/shared/modules/construction/core/types'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { HOME_PRIMARY_ASSEMBLY } from '@/features/trade-scenes/constants/scene-controls'
import { useSceneTargets } from '@/features/trade-scenes/hooks/use-scene-targets'
import { drawnHvac } from '@/features/trade-scenes/lib/drawn-hvac'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'

const NO_PARTS: readonly ResolvedPart[] = []

function selectDrawnHvacInputs(state: TradeSceneInputs) {
  return { property: state.property, homeMaterials: state.homeMaterials, view: state.view, picks: state.proposedScopeIds }
}

// The indoor unit's location and the head counts are drawing-only facts that never reach the targets, so the house and the
// camera read them here together rather than each working them out.
export function useDrawnHvac(): DrawnHvac {
  const targets = useSceneTargets()
  const { property, homeMaterials, view, picks } = useSceneInputs(useShallow(selectDrawnHvacInputs))
  const parts = targets.assemblies['hvac-attic']?.parts ?? NO_PARTS
  const form = homeRoofForm(targets.assemblies[HOME_PRIMARY_ASSEMBLY]?.form)
  return useMemo(() => drawnHvac(parts, property, homeMaterials, view, form, picks), [parts, property, homeMaterials, view, form, picks])
}
