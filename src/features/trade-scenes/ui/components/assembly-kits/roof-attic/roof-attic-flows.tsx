'use client'

import type { AssemblyTargets, HomeHeat } from '@/features/trade-scenes/types'
import type { SceneBurst } from '@/shared/components/scene/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { Weather } from '@/shared/modules/construction/core/types'

import { useMemo, useState } from 'react'

import { HEAT_ARROW_LOOK } from '@/features/trade-scenes/constants/heat-arrow-look'
import { useAssemblyKitFade } from '@/features/trade-scenes/contexts/assembly-kit-fade-context'
import { kitHeatLanes } from '@/features/trade-scenes/lib/kit-heat-lanes'
import { rainRibbonPath } from '@/features/trade-scenes/lib/ribbon-paths'
import { RainRibbons } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/rain-ribbons'
import { HeatArrows } from '@/features/trade-scenes/ui/components/heat-arrows'
import { useEased } from '@/shared/components/scene/hooks/use-eased'
import { seasonOf } from '@/shared/modules/construction/core/lib/season-of'

interface RoofAtticFlowsProps {
  form: RoofForm
  targets: AssemblyTargets
  weather: Weather
  heat: HomeHeat | null
  peel: number
  thermalCamera: boolean
  burst: SceneBurst
}

// What moves through the roof in this weather: water in a storm, the home's heat in any other, in every view. A weather the
// kit has no flow for draws none; the panel says so. The flows follow the parts as they peel, eased with them.
export function RoofAtticFlows({ form, targets, weather, heat, peel, thermalCamera, burst }: RoofAtticFlowsProps) {
  const fade = useAssemblyKitFade()
  const [easedPeel, setEasedPeel] = useState(peel)
  useEased(peel, setEasedPeel)
  const season = seasonOf(weather)
  const thermal = targets.mode === 'thermal'
  const heatLanes = useMemo(
    () => thermal && heat !== null && season !== null ? kitHeatLanes(form, targets.parts, heat, season, easedPeel) : [],
    [thermal, form, targets.parts, heat, season, easedPeel],
  )

  if (targets.water && weather === 'rain') {
    const rain = rainRibbonPath(form, targets.parts, targets.water, easedPeel)
    return rain && <RainRibbons rain={rain} burst={burst} fade={fade} />
  }
  if (heatLanes.length === 0) {
    return null
  }
  return <HeatArrows lanes={heatLanes} size={HEAT_ARROW_LOOK.size.kit} fade={fade} daylight={!thermalCamera} />
}
