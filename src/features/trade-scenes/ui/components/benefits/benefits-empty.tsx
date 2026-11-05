'use client'

import { BENEFITS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { CONTROLS_SECTION_ICONS } from '@/features/trade-scenes/constants/scene-control-icons'
import { useSceneControls } from '@/features/trade-scenes/contexts/scene-controls-context'
import { Button } from '@/shared/components/ui/button'

// Over the matrix while nothing is picked: every row reads "No change" under it, and the way to a pick is one press.
export function BenefitsEmpty() {
  const { openSection } = useSceneControls()
  const ModifyIcon = CONTROLS_SECTION_ICONS.modify

  return (
    <div data-benefits-empty className="absolute inset-0 z-2 grid place-items-center p-4">
      <div className="grid max-w-sm justify-items-center gap-2 rounded-[14px] border border-border-strong bg-popover px-6 py-5 text-center text-popover-foreground shadow-2xl">
        <strong className="text-lg leading-snug font-bold text-balance">{BENEFITS_COPY.empty.title}</strong>
        <p className="text-sm text-muted-foreground">{BENEFITS_COPY.empty.body}</p>
        <Button type="button" data-open-modify onClick={() => openSection('modify')} className="mt-1 h-10">
          <ModifyIcon aria-hidden />
          {BENEFITS_COPY.empty.openModify}
        </Button>
      </div>
    </div>
  )
}
