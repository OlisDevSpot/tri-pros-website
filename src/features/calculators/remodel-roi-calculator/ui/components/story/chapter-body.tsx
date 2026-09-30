import type { DetailChapterId } from '@/features/calculators/remodel-roi-calculator/constants/chapters'
import type { LookAheadYears } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import type { ChapterContent, RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { AnswerText } from '@/features/calculators/remodel-roi-calculator/ui/components/story/answer-text'
import { ChapterMath } from '@/features/calculators/remodel-roi-calculator/ui/components/story/chapter-math'
import { ChapterVisual } from '@/features/calculators/remodel-roi-calculator/ui/components/story/chapter-visual'
import { LoansNote } from '@/features/calculators/remodel-roi-calculator/ui/components/story/loans-note'
import { NetWorthSummary } from '@/features/calculators/remodel-roi-calculator/ui/components/story/net-worth-summary'

interface Props {
  chapter: DetailChapterId
  content: ChapterContent
  projection: RemodelRoiProjection
  lookAhead: LookAheadYears
}

export function ChapterBody({ chapter, content, projection, lookAhead }: Props) {
  return (
    <>
      <h3 className="max-w-[34ch] font-sans text-2xl font-semibold text-balance"><AnswerText parts={content.answer} /></h3>
      <ChapterVisual chapter={chapter} lookAhead={lookAhead} projection={projection} />
      {chapter === 'today' && <LoansNote projection={projection} />}
      {chapter === 'total' && <NetWorthSummary lookAhead={lookAhead} projection={projection} />}
      <p className="max-w-[60ch] text-base leading-relaxed text-muted-foreground">{content.guide}</p>
      <ChapterMath equation={content.equation} rows={content.receipt} />
    </>
  )
}
