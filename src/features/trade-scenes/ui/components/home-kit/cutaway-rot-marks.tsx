'use client'

import type { CutawayRotSpot, CutawaySteps, SystemLit, SystemPartId, TintedBoxes } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { ResolvedPart, WaterFlow, Weather } from '@/shared/modules/construction/core/types'

import { useMemo } from 'react'

import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { useStepPeel } from '@/features/trade-scenes/hooks/use-step-peel'
import { cutawayRotSpots } from '@/features/trade-scenes/lib/cutaway-rain-path'
import { deckRotSpots } from '@/features/trade-scenes/lib/deck-rot-spots'
import { feltRainHole } from '@/features/trade-scenes/lib/felt-wear-marks'
import { partState } from '@/features/trade-scenes/lib/part-state'
import { rotMarkGroups } from '@/features/trade-scenes/lib/rot-mark-groups'
import { rotStainBoxes } from '@/features/trade-scenes/lib/rot-stain-boxes'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { woodReplacedBoxes } from '@/features/trade-scenes/lib/wood-replaced-boxes'
import { CutawayRotStains } from '@/features/trade-scenes/ui/components/home-kit/cutaway-rot-stains'
import { TintedMarks } from '@/features/trade-scenes/ui/components/home-kit/tinted-marks'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'

interface CutawayRotMarksProps {
  form: RoofForm
  parts: readonly ResolvedPart[]
  water: WaterFlow | null
  weather: Weather
  system: 'roof' | 'attic'
  // The system up close, held while it leaves, so the marks ride the steps shut with it.
  lit: SystemLit
  thermal: boolean
}

// The rot still in the wood and the sheets the build set in its place, each under its own part's tag inside the house, so a
// pick lights it, fades it or hides it with that part. The rain's soak stains and the old deck's own rot share a part but keep
// separate lists, so one coming and going never turns the other's stains over. It reads the peel itself, so a drag redraws only these.
export function CutawayRotMarks({ form, parts, water, weather, system, lit, thermal }: CutawayRotMarksProps) {
  const peel = useStepPeel(lit)
  const steps: CutawaySteps = useMemo(() => ({ system, shown: lit.shown, peel }), [system, lit.shown, peel])
  const marks = useMemo(() => {
    const soak = weather === 'rain' && water !== null ? cutawayRotSpots(form, parts, water, steps) : []
    const deck = system === 'roof' ? deckRotSpots(form, parts, steps) : []
    const lists = new Map<SystemPartId, CutawayRotSpot[][]>()
    for (const list of [soak, deck]) {
      for (const { partId, spots } of rotMarkGroups(list)) {
        lists.set(partId, [...lists.get(partId) ?? [], spots])
      }
    }
    return [...lists].map(([partId, grouped]) => ({ partId, stains: rotStainBoxes(grouped), sheets: woodReplacedBoxes(grouped.flat()) }))
  }, [weather, water, form, parts, system, steps])
  // The hole is the felt's own mark, not a rot stain, and shows the deck's colour under it.
  const hole = useMemo((): TintedBoxes[] => {
    const box = feltRainHole(form, parts, steps, weather)
    const deck = partState(parts, 'deck')
    const colour = deck.material === 'spaced-boards' ? HOME_PALETTE.boardsWorn : wornColor(HOME_PALETTE.plywood, HOME_PALETTE.plywoodWorn, deck.wear)
    return box === null ? [] : [{ color: colour, boxes: [box] }]
  }, [form, parts, steps, weather])

  return (
    <>
      {hole.length > 0 && (
        <group userData={systemPartTag('underlayment')}>
          <TintedMarks lists={hole} thermal={thermal} />
        </group>
      )}
      {marks.map(({ partId, stains, sheets }) => (
        <group key={partId} userData={systemPartTag(partId)}>
          {stains.length > 0 && <CutawayRotStains boxes={stains} thermal={thermal} />}
          <TintedMarks lists={sheets} thermal={thermal} />
        </group>
      ))}
    </>
  )
}
