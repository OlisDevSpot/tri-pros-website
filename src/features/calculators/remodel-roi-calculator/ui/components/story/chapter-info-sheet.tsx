'use client'

import type { StoryContent } from '@/features/calculators/remodel-roi-calculator/types'

import { isDetailChapter } from '@/features/calculators/remodel-roi-calculator/constants/chapters'
import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
import { useStoryUi } from '@/features/calculators/remodel-roi-calculator/contexts/story-ui-context'
import { AnswerText } from '@/features/calculators/remodel-roi-calculator/ui/components/story/answer-text'
import { Receipt } from '@/features/calculators/remodel-roi-calculator/ui/components/story/receipt'
import { UsesList } from '@/features/calculators/remodel-roi-calculator/ui/components/story/uses-list'
import { BlockEyebrow } from '@/shared/components/block/block-eyebrow'
import { ResponsiveSheet } from '@/shared/components/dialogs/sheets/responsive-sheet'

interface Props {
  story: StoryContent
}

export function ChapterInfoSheet({ story }: Props) {
  const { sheet, closeSheet } = useStoryUi()
  const chapter = sheet?.kind === 'info' ? sheet.chapter : null
  const content = chapter && isDetailChapter(chapter) ? story[chapter] : null
  return (
    <ResponsiveSheet description={STORY_COPY.infoLabel} drawerClassName="max-h-[80vh]" onOpenChange={open => !open && closeSheet()} open={chapter != null} sheetClassName="sm:max-w-[460px]" title={chapter === 'answer' ? story.answer.question : content?.question ?? ''}>
      {chapter === 'answer' && <p className="text-sm leading-relaxed">{story.answer.method}</p>}
      {content && (
        <div className="grid gap-3.5">
          <p className="font-sans text-base font-semibold leading-snug"><AnswerText parts={content.answer} /></p>
          {content.uses.length > 0 && (
            <>
              <BlockEyebrow>What it uses</BlockEyebrow>
              <UsesList rows={content.uses} />
            </>
          )}
          <BlockEyebrow>How it's worked out</BlockEyebrow>
          <p className="text-sm leading-relaxed">{content.method}</p>
          {content.receipt.length > 0 && (
            <>
              <BlockEyebrow>The math</BlockEyebrow>
              <Receipt rows={content.receipt} />
            </>
          )}
        </div>
      )}
    </ResponsiveSheet>
  )
}
