'use client'

import type { AnswerContent } from '@/features/calculators/remodel-roi-calculator/types'

import { useStoryUi } from '@/features/calculators/remodel-roi-calculator/contexts/story-ui-context'
import { StatTile } from '@/shared/components/stat-tile'

interface Props {
  answer: AnswerContent
}

export function HeadlineStats({ answer }: Props) {
  const { scrollToChapter } = useStoryUi()
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 @2xl/story:grid-cols-3">
        {answer.stats.map(stat => <StatTile key={stat.label} label={stat.label} onClick={() => scrollToChapter(stat.target)} sub={stat.sub} value={stat.value} />)}
      </div>
      {answer.note && <p className="max-w-[60ch] text-[15.5px] leading-relaxed text-muted-foreground">{answer.note}</p>}
    </div>
  )
}
