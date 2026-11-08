'use client'

import type { RefObject } from 'react'
import type { CutawayFaceSystemId, HomeHeat, SystemLit } from '@/features/trade-scenes/types'
import type { ResolvedPart, Weather } from '@/shared/modules/construction/core/types'

import { useMemo } from 'react'

import { HEAT_ARROW_LOOK } from '@/features/trade-scenes/constants/heat-arrow-look'
import { useStepPeel } from '@/features/trade-scenes/hooks/use-step-peel'
import { cutawayFaceHeatLanes } from '@/features/trade-scenes/lib/cutaway-face-heat-lanes'
import { HeatArrows } from '@/features/trade-scenes/ui/components/heat-arrows'
import { seasonOf } from '@/shared/modules/construction/core/lib/season-of'

interface CutawayFaceFlowsProps {
  system: CutawayFaceSystemId
  // The window's own parts, which its lanes read its glazing from.
  windowParts: readonly ResolvedPart[]
  heat: HomeHeat | null
  weather: Weather
  // The system up close, held while it leaves, so the window's arrows ride its pull home with it.
  lit: SystemLit
  thermal: boolean
  // 1 while looking inside, easing to 0 as the house comes back.
  fade: RefObject<number>
}

// The home's heat through the window pulled apart or the whole wall up close, Thermal on or off. The readings are no part
// of it: `readingAnchors` places them, the window's on the opened window. It reads the pull itself, so a drag redraws only
// the arrows; the wall has no pull, so its arrows never redraw for it.
export function CutawayFaceFlows({ system, windowParts, heat, weather, lit, thermal, fade }: CutawayFaceFlowsProps) {
  const peel = useStepPeel(lit)
  const windowPeel = system === 'windows' ? peel : 0
  const season = seasonOf(weather)
  const lanes = useMemo(() => heat !== null && season !== null ? cutawayFaceHeatLanes(system === 'windows' ? { system, parts: windowParts, shown: lit.shown, peel: windowPeel } : { system, shown: lit.shown }, heat, season) : [], [system, windowParts, heat, season, lit.shown, windowPeel])
  return lanes.length > 0 && <HeatArrows lanes={lanes} size={HEAT_ARROW_LOOK.size.cutaway} fade={fade} daylight={!thermal} />
}
