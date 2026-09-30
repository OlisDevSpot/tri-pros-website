'use client'

import type { PanelSectionKey } from '@/features/calculators/remodel-roi-calculator/constants/panel-sections'

import { PanelLeftOpenIcon } from 'lucide-react'

import { PANEL_SECTION_KEYS, PANEL_SECTION_SHORT_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/panel-sections'
import { useStoryUi } from '@/features/calculators/remodel-roi-calculator/contexts/story-ui-context'
import { StepMarker } from '@/shared/components/step-marker'
import { Button } from '@/shared/components/ui/button'

interface Props {
  done: Record<PanelSectionKey, boolean>
}

export function PanelRail({ done }: Props) {
  const { setCollapsed, editSection } = useStoryUi()
  return (
    <div className="grid content-start justify-items-center gap-1.5 px-1.5 py-3.5">
      <Button aria-label="Show inputs" className="size-11" onClick={() => setCollapsed(false)} size="icon" type="button" variant="ghost"><PanelLeftOpenIcon /></Button>
      {PANEL_SECTION_KEYS.map(section => (
        <button className="grid min-h-14 w-16 justify-items-center gap-1 rounded-lg py-2 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground" key={section} onClick={() => editSection(section)} type="button">
          <StepMarker state={done[section] ? 'done' : 'pending'} />
          {PANEL_SECTION_SHORT_LABELS[section]}
        </button>
      ))}
    </div>
  )
}
