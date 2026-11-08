'use client'

import type { PartState } from '@/features/trade-scenes/lib/part-state'
import type { BoxSpec, SystemLit } from '@/features/trade-scenes/types'

import { useMemo } from 'react'

import { HOME_FADE_TAGS } from '@/features/trade-scenes/constants/home-fades'
import { ATTIC_SPANS, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { atticInsulationBoxes } from '@/features/trade-scenes/lib/attic-insulation-boxes'
import { atticJoistBoxes } from '@/features/trade-scenes/lib/attic-joist-boxes'
import { laidInsulationDepth } from '@/features/trade-scenes/lib/laid-insulation-depth'
import { clipBoxes } from '@/features/trade-scenes/lib/step-cut-back'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { AtticDust } from '@/features/trade-scenes/ui/components/home-kit/attic-dust'
import { AtticSteps } from '@/features/trade-scenes/ui/components/home-kit/attic-steps'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'

interface AtticFloorProps {
  lowSlope: boolean
  insulation: PartState
  // What a top off lays its new blanket over: the insulation the home already has.
  over: string | null
  lit: SystemLit | null
  // Whether the ceiling still leaks air, which leaves dust on the blanket over each gap.
  dusty: boolean
  ducted: boolean
  thermal: boolean
}

interface Blankets {
  old: BoxSpec[]
  laid: BoxSpec[]
}

const NO_BLANKETS: Blankets = { old: [], laid: [] }
const JOIST_TAG = thermalTag('attic')
const INSULATION_TAG = thermalTag(null, 'attic-insulation')

// A top off draws the old blanket at its own depth and the new blown one from there up to the new depth; a replace draws
// only the new.
function blankets(material: string, over: string | null, lowSlope: boolean, span: { from: number, to: number }): Blankets {
  const laid = atticInsulationBoxes(material, lowSlope, span)
  if (over === null) {
    return { old: [], laid }
  }
  return { old: atticInsulationBoxes(over, lowSlope, span), laid: clipBoxes(laid, 1, WALL_TOP_Y + laidInsulationDepth(over, lowSlope), Infinity) }
}

export function AtticFloor({ lowSlope, insulation, over, lit, dusty, ducted, thermal }: AtticFloorProps) {
  const { open: framing, complete: completeFraming } = useMemo(() => atticJoistBoxes(lowSlope), [lowSlope])
  const material = insulation.material
  const { open, complete } = useMemo(() => material === null
    ? { open: NO_BLANKETS, complete: NO_BLANKETS }
    : { open: blankets(material, over, lowSlope, ATTIC_SPANS.open), complete: blankets(material, over, lowSlope, ATTIC_SPANS.complete) }, [material, over, lowSlope])
  const insulationColour = wornColor(HOME_PALETTE.insulationNew, HOME_PALETTE.insulationWorn, insulation.wear)
  // Under a flat roof the joists carry the roof, so they are its rafters; under a gable they are the ceiling's framing, the
  // drywall hanging from them.
  const joists = lowSlope ? 'rafters' : 'ceiling-joists'

  return (
    <group userData={JOIST_TAG}>
      <AtticSteps part={joists} lit={lit} thermal={JOIST_TAG} boxes={framing} color={HOME_PALETTE.lumber} />
      {open.old.length > 0 && <AtticSteps part="attic-insulation" lit={lit} thermal={INSULATION_TAG} boxes={open.old} color={HOME_PALETTE.insulationWorn} radius={0.03} roughness={1} />}
      {open.laid.length > 0 && <AtticSteps part="attic-insulation" lit={lit} thermal={INSULATION_TAG} boxes={open.laid} color={insulationColour} radius={0.03} roughness={1} />}
      {/* The front span steps too, so the cutaway runs the attic's whole depth; Partly open still lifts it away. */}
      <group userData={HOME_FADE_TAGS.complete}>
        <AtticSteps part={joists} lit={lit} thermal={JOIST_TAG} boxes={completeFraming} color={HOME_PALETTE.lumber} />
        {complete.old.length > 0 && <AtticSteps part="attic-insulation" lit={lit} thermal={INSULATION_TAG} boxes={complete.old} color={HOME_PALETTE.insulationWorn} radius={0.03} roughness={1} />}
        {complete.laid.length > 0 && <AtticSteps part="attic-insulation" lit={lit} thermal={INSULATION_TAG} boxes={complete.laid} color={insulationColour} radius={0.03} roughness={1} />}
      </group>
      {dusty && <AtticDust lowSlope={lowSlope} material={material} ducted={ducted} thermal={thermal} lit={lit} />}
    </group>
  )
}
