'use client'

import type { ChapterId } from '@/features/calculators/remodel-roi-calculator/constants/chapters'
import type { LookAheadYears } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import type { RemodelRoiProjection, StoryContent } from '@/features/calculators/remodel-roi-calculator/types'

import { useMemo } from 'react'

import { BILL_CATEGORIES } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'
import { CHAPTER_IDS, chapterElementId, CHAPTERS_WITH_INFO, INTRO_ONLY, isDetailChapter } from '@/features/calculators/remodel-roi-calculator/constants/chapters'
import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
import { useStoryUi } from '@/features/calculators/remodel-roi-calculator/contexts/story-ui-context'
import { ChapterBody } from '@/features/calculators/remodel-roi-calculator/ui/components/story/chapter-body'
import { ChapterRail } from '@/features/calculators/remodel-roi-calculator/ui/components/story/chapter-rail'
import { HeadlineStats } from '@/features/calculators/remodel-roi-calculator/ui/components/story/headline-stats'
import { MissingInputs } from '@/features/calculators/remodel-roi-calculator/ui/components/story/missing-inputs'
import { PathsIntro } from '@/features/calculators/remodel-roi-calculator/ui/components/story/paths-intro'
import { Receipt } from '@/features/calculators/remodel-roi-calculator/ui/components/story/receipt'
import { StoryChapter } from '@/features/calculators/remodel-roi-calculator/ui/components/story/story-chapter'
import { TopBar } from '@/features/calculators/remodel-roi-calculator/ui/components/story/top-bar'
import { Button } from '@/shared/components/ui/button'
import { useActiveSection } from '@/shared/hooks/use-active-section'

interface Props {
  projection: RemodelRoiProjection
  story: StoryContent
  lookAhead: LookAheadYears
  onLookAheadChange: (years: LookAheadYears) => void
  showInputsButton: boolean
}

export function StoryCanvas({ projection, story, lookAhead, onLookAheadChange, showInputsButton }: Props) {
  const { scroller, registerScroller, openAssumptions } = useStoryUi()
  const chapters = projection.ready ? CHAPTER_IDS : INTRO_ONLY
  const ids = useMemo(() => chapters.map(chapterElementId), [chapters])
  const activeId = useActiveSection(ids, { rootEl: scroller })
  const active = chapters.find(chapter => chapterElementId(chapter) === activeId) ?? 'intro'
  const question = (chapter: ChapterId) => (chapter === 'intro' ? story.intro.question : chapter === 'answer' ? story.answer.question : chapter === 'basis' ? story.basis.question : story[chapter].question)

  return (
    <div className="@container/story relative min-h-0">
      <div className="relative h-full overflow-y-auto scroll-pt-14 [scroll-behavior:auto]" ref={registerScroller}>
        <TopBar lookAhead={lookAhead} onLookAheadChange={onLookAheadChange} projection={projection} showInputsButton={showInputsButton} />
        <div className="mx-auto max-w-[760px] px-8 pb-20">
          {chapters.map((chapter, index) => (
            <StoryChapter hasInfo={(CHAPTERS_WITH_INFO as readonly ChapterId[]).includes(chapter)} id={chapter} key={chapter} number={index + 1} question={question(chapter)}>
              {chapter === 'intro' && <PathsIntro intro={story.intro} />}
              {chapter === 'answer' && <HeadlineStats answer={story.answer} />}
              {isDetailChapter(chapter) && <ChapterBody chapter={chapter} content={story[chapter]} lookAhead={lookAhead} projection={projection} />}
              {chapter === 'basis' && (
                <>
                  <h3 className="max-w-[34ch] font-sans text-2xl font-semibold">{story.basis.answer}</h3>
                  <p className="max-w-[60ch] text-base leading-relaxed text-muted-foreground">{story.basis.guide}</p>
                  <Receipt rows={story.basis.receipt} />
                  <Button className="min-h-11 justify-self-start" onClick={openAssumptions} type="button" variant="outline">{STORY_COPY.changeWorkingNumber}</Button>
                  <p className="mt-2 max-w-[26ch] font-sans text-2xl font-semibold leading-snug">{STORY_COPY.close}</p>
                </>
              )}
            </StoryChapter>
          ))}
          {!projection.ready && <MissingInputs hasBills={BILL_CATEGORIES.some(category => projection.cuts[category].bill > 0)} hasPrice={projection.project.price > 0} hasTrades={projection.trades.length > 0} />}
        </div>
      </div>
      {projection.ready && <ChapterRail active={active} />}
    </div>
  )
}
