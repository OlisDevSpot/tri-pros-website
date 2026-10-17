'use client'

import type { ChapterId } from '@/features/calculators/remodel-roi-calculator/constants/chapters'
import type { AnswerContent } from '@/features/calculators/remodel-roi-calculator/types'

import { StatTile } from '@/shared/components/stat-tile'

interface Props {
  answer: AnswerContent
  onSelectChapter: (chapter: ChapterId) => void
}

export function HeadlineStats({ answer, onSelectChapter }: Props) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 @2xl/story:grid-cols-3">
        {answer.stats.map(stat => <StatTile key={stat.label} label={stat.label} onClick={() => onSelectChapter(stat.target)} sub={stat.sub} value={stat.value} />)}
      </div>
      {answer.note && <p className="max-w-[60ch] text-base leading-relaxed text-muted-foreground">{answer.note}</p>}
    </div>
  )
}
