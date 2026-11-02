'use client'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { CONTROLS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { CONTROLS_SECTION_ICONS } from '@/features/trade-scenes/constants/scene-control-icons'
import { cn } from '@/shared/lib/utils'

export function BenefitsBody() {
  const Icon = CONTROLS_SECTION_ICONS.benefits

  return (
    <div className={CONTROLS_CLASSES.body}>
      <div data-benefits-soon className="grid min-h-full content-center justify-items-center gap-2.5 py-8 text-center">
        <span aria-hidden className={CONTROLS_CLASSES.tile}><Icon /></span>
        <h3 className="text-2xl">{CONTROLS_COPY.benefits.title}</h3>
        <span className={cn(CONTROLS_CLASSES.tag, 'border-dashed border-muted-foreground px-1.75 tracking-[.1em]')}>
          {CONTROLS_COPY.benefits.soon}
        </span>
        <p className="max-w-70 text-xs text-muted-foreground">{CONTROLS_COPY.benefits.body}</p>
      </div>
    </div>
  )
}
