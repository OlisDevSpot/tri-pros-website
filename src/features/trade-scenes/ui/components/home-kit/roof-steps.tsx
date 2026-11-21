'use client'

import type { ReactNode } from 'react'
import type { CoveringLook } from '@/features/trade-scenes/lib/covering-look'
import type { PartState } from '@/features/trade-scenes/lib/part-state'
import type { PaintLook, SystemLit, SystemPartId } from '@/features/trade-scenes/types'

import { useMemo } from 'react'

import { HOUSE, ROOF_HALF_LENGTH } from '@/features/trade-scenes/constants/home-geometry'
import { useStepPeel } from '@/features/trade-scenes/hooks/use-step-peel'
import { stepStarts } from '@/features/trade-scenes/lib/step-cut-back'
import { EaveMembrane } from '@/features/trade-scenes/ui/components/home-kit/eave-membrane'
import { RoofSlope } from '@/features/trade-scenes/ui/components/home-kit/roof-slope'

interface RoofStepsProps {
  covering: CoveringLook
  deck: PartState
  underlayment: PartState
  radiantBarrier: PartState
  dripEdge: PartState
  iceAndWater: PartState
  shingleTone: string | null
  layout: readonly [number, number]
  paint: PaintLook
  // The new fascia boards' colour where the build replaced the rotted fascia; null where it did not.
  fasciaBoards: string | null
  thermal: boolean
  // The system up close; the roof steps its system parts open here. The attic's radiant barrier stays whole on the rafters.
  lit: SystemLit | null
  // More of the kept run's parts, drawn in the slope's own frame.
  children?: ReactNode
}

const KEPT_ENDS = ['to'] as const
const NO_STEPS: ReadonlyMap<SystemPartId, number> = new Map()

// The near slope's run every home view keeps, from the cut to its end. Up close on the roof it steps open as the peel
// asks: each system part starts a step further from the cut than the one under it. It reads the peel itself, so a
// drag redraws only this run.
export function RoofSteps({ covering, deck, underlayment, radiantBarrier, dripEdge, iceAndWater, shingleTone, layout, paint, fasciaBoards, thermal, lit, children }: RoofStepsProps) {
  const peel = useStepPeel(lit)
  // Only a gable's near slope steps through here; a flat roof's parts step as attic steps.
  const steps = useMemo(() => lit === null ? NO_STEPS : stepStarts(lit.system, 'pitched', lit.shown, peel), [lit, peel])
  return (
    <RoofSlope
      face="front"
      zFrom={HOUSE.cutX}
      zTo={ROOF_HALF_LENGTH}
      layout={layout}
      trimmedEnds={KEPT_ENDS}
      covering={covering}
      deck={deck}
      underlayment={underlayment}
      radiantBarrier={radiantBarrier}
      dripEdge={dripEdge}
      shingleTone={shingleTone}
      paint={paint}
      fasciaBoards={fasciaBoards}
      thermal={thermal}
      steps={steps}
    >
      <EaveMembrane zFrom={steps.get('ice-and-water') ?? HOUSE.cutX} zTo={ROOF_HALF_LENGTH} iceAndWater={iceAndWater} />
      {children}
    </RoofSlope>
  )
}
