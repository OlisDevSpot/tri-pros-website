'use client'

import type { DrawnGutter } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { HOME_FADE_TAGS } from '@/features/trade-scenes/constants/home-fades'
import { downspoutFeet } from '@/features/trade-scenes/lib/downspout-boxes'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'
import { gutterLook } from '@/features/trade-scenes/ui/lib/gutter-look'

interface DownspoutFeetProps {
  form: RoofForm
  gutter: DrawnGutter
}

const FEET = { 'pitched': downspoutFeet('pitched'), 'low-slope': downspoutFeet('low-slope') } as const
// The same rounding as each form's downspouts above them, the gable's drawn with its gutter and the flat roof's drains, so a
// foot reads as the same pipe.
const RADIUS = { 'pitched': 0.01, 'low-slope': 0.02 } as const satisfies Record<RoofForm, number>

// On the lawn, beside the house rather than lifted with it, so the feet stay put while the floor eases.
export function DownspoutFeet({ form, gutter }: DownspoutFeetProps) {
  const { kept, complete } = FEET[form]
  const { color, roughness } = gutterLook(gutter.hex, gutter.wear)
  return (
    <group userData={thermalTag('roof', 'gutter')}>
      <group userData={systemPartTag('gutter')}>
        <MergedBoxes boxes={kept} color={color} radius={RADIUS[form]} roughness={roughness} />
        {complete.length > 0 && (
          <group userData={HOME_FADE_TAGS.complete}>
            <MergedBoxes boxes={complete} color={color} radius={RADIUS[form]} roughness={roughness} />
          </group>
        )}
      </group>
    </group>
  )
}
