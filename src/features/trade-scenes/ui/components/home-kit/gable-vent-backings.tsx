'use client'

import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { homeGableVent } from '@/features/trade-scenes/lib/gable-vent-boxes'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'

const BACKINGS = [homeGableVent(-1).backing, homeGableVent(1).backing]

// Both gables' vents in one draw. What shows between the slats is the attic's air, so the thermal camera reads it as the
// attic, whichever gable it is in.
export function GableVentBackings() {
  return (
    <group userData={thermalTag('attic')}>
      <MergedBoxes boxes={BACKINGS} color={HOME_PALETTE.ventBacking} ignoreTaps />
    </group>
  )
}
