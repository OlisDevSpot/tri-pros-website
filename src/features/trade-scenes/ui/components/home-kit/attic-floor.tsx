'use client'

import type { PartState } from '@/features/trade-scenes/lib/part-state'

import { useMemo } from 'react'

import { HOME_FADE_TAGS } from '@/features/trade-scenes/constants/home-fades'
import { ATTIC_SPANS } from '@/features/trade-scenes/constants/home-geometry'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { atticInsulationBoxes } from '@/features/trade-scenes/lib/attic-insulation-boxes'
import { atticJoistBoxes } from '@/features/trade-scenes/lib/attic-joist-boxes'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'

interface AtticFloorProps {
  lowSlope: boolean
  insulation: PartState
}

export function AtticFloor({ lowSlope, insulation }: AtticFloorProps) {
  const { open: framing, complete: completeFraming } = useMemo(() => atticJoistBoxes(lowSlope), [lowSlope])
  const blankets = useMemo(() => {
    if (insulation.material === null) {
      return { open: [], complete: [] }
    }
    return {
      open: atticInsulationBoxes(insulation.material, lowSlope, ATTIC_SPANS.open),
      complete: atticInsulationBoxes(insulation.material, lowSlope, ATTIC_SPANS.complete),
    }
  }, [insulation.material, lowSlope])
  const insulationColour = wornColor(HOME_PALETTE.insulationNew, HOME_PALETTE.insulationWorn, insulation.wear)

  return (
    <group userData={thermalTag('attic')}>
      <MergedBoxes boxes={framing} color={HOME_PALETTE.lumber} />
      {blankets.open.length > 0 && (
        <group userData={thermalTag(null, 'attic-insulation')}>
          <MergedBoxes boxes={blankets.open} color={insulationColour} radius={0.03} roughness={1} />
        </group>
      )}
      <group userData={HOME_FADE_TAGS.complete}>
        <MergedBoxes boxes={completeFraming} color={HOME_PALETTE.lumber} />
        {blankets.complete.length > 0 && (
          <group userData={thermalTag(null, 'attic-insulation')}>
            <MergedBoxes boxes={blankets.complete} color={insulationColour} radius={0.03} roughness={1} />
          </group>
        )}
      </group>
    </group>
  )
}
