'use client'

import type { PanelSectionKey } from '@/features/calculators/remodel-roi-calculator/constants/panel-sections'
import type { RemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/schemas/config'
import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { PanelLeftCloseIcon } from 'lucide-react'

import { PANEL_SECTION_KEYS, PANEL_SECTION_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/panel-sections'
import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
import { useStoryUi } from '@/features/calculators/remodel-roi-calculator/contexts/story-ui-context'
import { panelDone, panelSummaries } from '@/features/calculators/remodel-roi-calculator/lib/panel-summaries'
import { BillsSection } from '@/features/calculators/remodel-roi-calculator/ui/components/inputs-panel/bills-section'
import { HomeAndLoansSection } from '@/features/calculators/remodel-roi-calculator/ui/components/inputs-panel/home-and-loans-section'
import { PanelRail } from '@/features/calculators/remodel-roi-calculator/ui/components/inputs-panel/panel-rail'
import { ProjectSection } from '@/features/calculators/remodel-roi-calculator/ui/components/inputs-panel/project-section'
import { TradesSection } from '@/features/calculators/remodel-roi-calculator/ui/components/inputs-panel/trades-section'
import { BlockEyebrow } from '@/shared/components/block/block-eyebrow'
import { CollapsibleSection } from '@/shared/components/collapsible-section'
import { Button } from '@/shared/components/ui/button'

interface Props {
  projection: RemodelRoiProjection
  config: RemodelRoiConfig
  variant: 'docked' | 'sheet'
}

export function InputsPanel({ projection, config, variant }: Props) {
  const { collapsed, setCollapsed, openSection, setOpenSection } = useStoryUi()
  const summaries = panelSummaries(projection)
  const done = panelDone(projection)
  if (variant === 'docked' && collapsed) {
    return <PanelRail done={done} />
  }
  const body: Record<PanelSectionKey, React.ReactNode> = {
    trades: <TradesSection config={config} projection={projection} />,
    project: <ProjectSection config={config} projection={projection} />,
    bills: <BillsSection projection={projection} />,
    home: <HomeAndLoansSection projection={projection} />,
  }
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <div>
          <BlockEyebrow>{STORY_COPY.inputs}</BlockEyebrow>
          <p className="mt-1 text-sm font-semibold">{projection.ready ? 'Story is up to date' : 'Add trades, price and bills to see the story'}</p>
        </div>
        {variant === 'docked' && <Button aria-label="Collapse inputs" className="size-11" onClick={() => setCollapsed(true)} size="icon" type="button" variant="ghost"><PanelLeftCloseIcon /></Button>}
      </div>
      <div className="min-h-0 overflow-y-auto pb-10">
        {PANEL_SECTION_KEYS.map(section => (
          <CollapsibleSection
            className="border-b"
            key={section}
            onOpenChange={next => setOpenSection(next ? section : null)}
            open={openSection === section}
            status={done[section] ? 'done' : 'pending'}
            summary={summaries[section]}
            title={PANEL_SECTION_LABELS[section]}
          >
            {body[section]}
          </CollapsibleSection>
        ))}
      </div>
    </div>
  )
}
