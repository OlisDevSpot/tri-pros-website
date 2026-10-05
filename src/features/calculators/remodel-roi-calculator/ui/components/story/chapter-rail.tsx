'use client'

import type { ChapterId } from '@/features/calculators/remodel-roi-calculator/constants/chapters'

import { CHAPTER_IDS, CHAPTER_RAIL_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/chapters'
import { useStoryUi } from '@/features/calculators/remodel-roi-calculator/contexts/story-ui-context'
import { cn } from '@/shared/lib/utils'

interface Props {
  active: ChapterId
}

export function ChapterRail({ active }: Props) {
  const { scrollToChapter } = useStoryUi()
  return (
    <nav aria-label="Chapters" className="group absolute top-20 right-3 z-10 grid gap-1">
      {CHAPTER_IDS.map(chapter => (
        <button aria-current={chapter === active} aria-label={CHAPTER_RAIL_LABELS[chapter]} className="flex h-7 items-center justify-end gap-2 px-1.5 text-xs font-bold text-muted-foreground aria-[current=true]:text-foreground pointer-coarse:h-11" key={chapter} onClick={() => scrollToChapter(chapter)} type="button">
          <span className="whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">{CHAPTER_RAIL_LABELS[chapter]}</span>
          <i aria-hidden className={cn('size-2 shrink-0 rounded-full bg-border transition-transform', chapter === active && 'scale-135 bg-primary')} />
        </button>
      ))}
    </nav>
  )
}
