'use client'

import type { PanelSectionKey } from '@/features/calculators/remodel-roi-calculator/constants/panel-sections'

import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
import { useStoryUi } from '@/features/calculators/remodel-roi-calculator/contexts/story-ui-context'
import { BlockEyebrow } from '@/shared/components/block/block-eyebrow'
import { StepMarker } from '@/shared/components/step-marker'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface Props {
  hasTrades: boolean
  hasBills: boolean
  hasPrice: boolean
}

export function MissingInputs({ hasTrades, hasBills, hasPrice }: Props) {
  const { editSection } = useStoryUi()
  const items: { label: string, done: boolean, section: PanelSectionKey }[] = [
    { label: STORY_COPY.missingItems.trades, done: hasTrades, section: 'trades' },
    { label: STORY_COPY.missingItems.price, done: hasPrice, section: 'project' },
    { label: STORY_COPY.missingItems.bills, done: hasBills, section: 'bills' },
  ]
  const next = items.find(item => !item.done)?.section ?? 'trades'
  return (
    <div className="mt-6 grid max-w-md justify-items-start gap-3 rounded-xl border-[1.5px] border-dashed bg-card p-6">
      <BlockEyebrow>{STORY_COPY.missingTitle}</BlockEyebrow>
      <ul className="grid gap-2">
        {items.map(item => (
          <li className={cn('flex items-center gap-2.5 font-bold', item.done && 'text-muted-foreground line-through')} key={item.label}>
            <StepMarker state={item.done ? 'done' : 'pending'} />
            {item.label}
          </li>
        ))}
      </ul>
      <Button className="min-h-11" onClick={() => editSection(next)} type="button">{STORY_COPY.openInputs}</Button>
    </div>
  )
}
