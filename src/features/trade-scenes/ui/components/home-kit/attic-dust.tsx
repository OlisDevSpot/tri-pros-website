'use client'

import type { SystemLit } from '@/features/trade-scenes/types'

import { useMemo } from 'react'

import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { ATTIC_DUST } from '@/features/trade-scenes/constants/look-inside'
import { useStepPeel } from '@/features/trade-scenes/hooks/use-step-peel'
import { atticDustPatches } from '@/features/trade-scenes/lib/attic-dust-patches'
import { stepStarts } from '@/features/trade-scenes/lib/step-cut-back'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { CutawayRotStains } from '@/features/trade-scenes/ui/components/home-kit/cutaway-rot-stains'

interface AtticDustProps {
  lowSlope: boolean
  material: string | null
  ducted: boolean
  thermal: boolean
  lit: SystemLit | null
}

// The dirt an installer looks for on the blanket right over each air gap. Up close on the attic it starts where the blanket's
// step does, so the openings in the bare strip show their gaps, not floating dirt. Under another system's Look inside the
// ceiling is lit for the leak while the blanket ghosts, so dust tagged as the ceiling would float there.
export function AtticDust({ lowSlope, material, ducted, thermal, lit }: AtticDustProps) {
  const peel = useStepPeel(lit)
  const from = lit === null ? null : (stepStarts(lit.system, lit.shown, peel).get('attic-insulation') ?? null)
  const boxes = useMemo(() => atticDustPatches(material, lowSlope, ducted, from), [material, lowSlope, ducted, from])
  if (lit !== null && lit.system !== 'attic') {
    return null
  }
  return (
    <group userData={systemPartTag('ceiling')}>
      <CutawayRotStains boxes={boxes} thermal={thermal} color={HOME_PALETTE.atticDust} alpha={ATTIC_DUST.alpha} />
    </group>
  )
}
