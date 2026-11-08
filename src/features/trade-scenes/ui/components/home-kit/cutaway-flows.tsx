'use client'

import type { RefObject } from 'react'
import type { CeilingOpening, CutawaySystemId, HomeHeat, SystemLit } from '@/features/trade-scenes/types'
import type { SceneBurst } from '@/shared/components/scene/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { ResolvedPart, WaterFlow, Weather } from '@/shared/modules/construction/core/types'

import { useMemo } from 'react'

import { HEAT_ARROW_LOOK } from '@/features/trade-scenes/constants/heat-arrow-look'
import { SECTION_READING_IDS } from '@/features/trade-scenes/constants/home-anchors'
import { CUTAWAY_FLOW_COLORS } from '@/features/trade-scenes/constants/home-palette'
import { CUTAWAY_FLOW } from '@/features/trade-scenes/constants/look-inside'
import { useStepPeel } from '@/features/trade-scenes/hooks/use-step-peel'
import { cutawayHeatLanes, cutawayReadingSpots } from '@/features/trade-scenes/lib/cutaway-heat-lanes'
import { cutawayRainPath, cutawayRibbonWidths } from '@/features/trade-scenes/lib/cutaway-rain-path'
import { readingPinId } from '@/features/trade-scenes/lib/reading-pin-id'
import { HeatArrows } from '@/features/trade-scenes/ui/components/heat-arrows'
import { LeakDrip } from '@/features/trade-scenes/ui/components/home-kit/leak-drip'
import { RIBBON_SEGMENTS } from '@/shared/components/scene/lib/build-unit-tube'
import { FlowRibbon } from '@/shared/components/scene/ui/flow-ribbon'
import { SceneAnchor } from '@/shared/components/scene/ui/scene-anchor'
import { seasonOf } from '@/shared/modules/construction/core/lib/season-of'

interface CutawayFlowsProps {
  form: RoofForm
  parts: readonly ResolvedPart[]
  water: WaterFlow | null
  heat: HomeHeat | null
  weather: Weather
  system: CutawaySystemId
  // The ceiling openings air sealing has not closed; only the attic's flow comes through them.
  leaks: readonly CeilingOpening[]
  // The system up close, held while it leaves, so the flows ride the steps shut with it.
  lit: SystemLit
  // Still looking inside: the readings on the steps are pins, so they let go at once as up close leaves.
  looking: boolean
  thermal: boolean
  burst: SceneBurst
  // 1 while looking inside, easing to 0 as the house comes back.
  fade: RefObject<number>
}

// What moves through the stepped roof and attic in this weather: the rain down the steps, into the gutter or on through
// to a drip on the ceiling; the home's heat in any other weather, Thermal on or off. Under the thermal camera the readings pin on the steps. It reads the peel itself, so a drag redraws only the flows.
export function CutawayFlows({ form, parts, water, heat, weather, system, leaks, lit, looking, thermal, burst, fade }: CutawayFlowsProps) {
  const peel = useStepPeel(lit)
  const steps = useMemo(() => ({ system, shown: lit.shown, peel }), [system, lit.shown, peel])
  const season = seasonOf(weather)
  const rain = useMemo(() => weather === 'rain' && water !== null ? cutawayRainPath(form, parts, water, steps) : null, [weather, water, form, parts, steps])
  const lanes = useMemo(() => weather !== 'rain' && heat !== null && season !== null ? cutawayHeatLanes(form, parts, heat, season, steps, leaks) : [], [weather, heat, season, form, parts, steps, leaks])
  const readings = useMemo(() => looking && thermal && heat !== null ? cutawayReadingSpots(form, parts, steps) : null, [looking, thermal, heat, form, parts, steps])

  return (
    <>
      {rain && (
        <FlowRibbon
          points={rain.points}
          widths={cutawayRibbonWidths(rain, RIBBON_SEGMENTS + 1)}
          color={CUTAWAY_FLOW_COLORS.rain}
          intensity={CUTAWAY_FLOW.intensity}
          speed={CUTAWAY_FLOW.speed}
          running={burst.running}
          fade={fade}
        />
      )}
      {/* The house's own drip, drawn again outside its ghost, larger and over the scene, so it reads under the lit ceiling
          from above it, where the rain gets through. */}
      {rain?.drip && <LeakDrip burst={burst} scale={CUTAWAY_FLOW.dripScale} overlay />}
      {lanes.length > 0 && <HeatArrows lanes={lanes} size={HEAT_ARROW_LOOK.size.cutaway} fade={fade} daylight={!thermal} />}
      {readings && SECTION_READING_IDS.map(reading => <SceneAnchor key={reading} id={readingPinId(reading)} position={[...readings[reading]]} />)}
    </>
  )
}
