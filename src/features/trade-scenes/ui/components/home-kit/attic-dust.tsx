'use client'

import type { SystemLit } from '@/features/trade-scenes/types'

import { useMemo } from 'react'

import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { ATTIC_DUST } from '@/features/trade-scenes/constants/look-inside'
import { ceilingOpeningDust } from '@/features/trade-scenes/lib/ceiling-opening-dust'
import { ceilingOpeningPart } from '@/features/trade-scenes/lib/ceiling-opening-part'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { CutawayRotStains } from '@/features/trade-scenes/ui/components/home-kit/cutaway-rot-stains'

const NO_TAG = {}

interface AtticDustProps {
  ducted: boolean
  thermal: boolean
  lit: SystemLit | null
}

// The dust lies on the ceiling round each opening and the blanket covers it, so the cut-back is where it shows. Under another
// system's Look inside the ceiling is lit for the leak while the blanket ghosts, so dust tagged as the ceiling would float there.
export function AtticDust({ ducted, thermal, lit }: AtticDustProps) {
  const boxes = useMemo(() => ceilingOpeningDust(ducted), [ducted])
  if (lit !== null && lit.system !== 'attic') {
    return null
  }
  const part = ceilingOpeningPart(lit)
  return (
    <group userData={part === null ? NO_TAG : systemPartTag(part)}>
      <CutawayRotStains boxes={boxes} thermal={thermal} color={HOME_PALETTE.atticDust} alpha={ATTIC_DUST.alpha} />
    </group>
  )
}
