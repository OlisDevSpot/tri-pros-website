'use client'

import type { ChapterId } from '@/features/calculators/remodel-roi-calculator/constants/chapters'

import { InfoIcon } from 'lucide-react'

import { chapterElementId } from '@/features/calculators/remodel-roi-calculator/constants/chapters'
import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
import { useStoryUi } from '@/features/calculators/remodel-roi-calculator/contexts/story-ui-context'
import { BlockEyebrow } from '@/shared/components/block/block-eyebrow'
import { StepMarker } from '@/shared/components/step-marker'
import { Button } from '@/shared/components/ui/button'

interface Props {
  id: ChapterId
  number: number
  question: string
  hasInfo: boolean
  children: React.ReactNode
}

export function StoryChapter({ id, number, question, hasInfo, children }: Props) {
  const { openInfo } = useStoryUi()
  return (
    <section aria-label={question} className="grid scroll-mt-0 gap-4.5 border-b py-12 last:border-b-0" id={chapterElementId(id)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <StepMarker number={number} state="pending" />
          <BlockEyebrow>{question}</BlockEyebrow>
        </div>
        {hasInfo && (
          <Button aria-label={STORY_COPY.infoLabel} className="size-11 text-muted-foreground hover:text-primary" onClick={() => openInfo(id)} size="icon" type="button" variant="ghost">
            <InfoIcon className="size-4.5" />
          </Button>
        )}
      </div>
      {children}
    </section>
  )
}
