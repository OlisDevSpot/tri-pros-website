'use client'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { CONTROLS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { CONTROLS_SECTION_ICONS } from '@/features/trade-scenes/constants/scene-control-icons'
import { ControlsModalHead } from '@/features/trade-scenes/ui/components/controls/controls-modal-head'
import { cn } from '@/shared/lib/utils'

// Benefits shows only the build, and its tag says so.
export function BenefitsHead() {
  return (
    <ControlsModalHead icon={CONTROLS_SECTION_ICONS.benefits} title={CONTROLS_COPY.sections.benefits}>
      <span data-benefits-tag className={cn(CONTROLS_CLASSES.tag, CONTROLS_CLASSES.tagProposed)}>{CONTROLS_COPY.benefits.tag}</span>
    </ControlsModalHead>
  )
}
