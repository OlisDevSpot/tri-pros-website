'use client'

import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { homeGableVent } from '@/features/trade-scenes/lib/gable-vent-boxes'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'

const LOUVRES = { left: homeGableVent(-1).louvres, right: homeGableVent(1).louvres } as const

interface GableVentProps {
  side: -1 | 1
}

// Its slats let a double-tap through to the gable behind, so the glide lands on the house.
export function GableVent({ side }: GableVentProps) {
  return <MergedBoxes boxes={LOUVRES[side < 0 ? 'left' : 'right']} color={HOME_PALETTE.vent} ignoreTaps />
}
