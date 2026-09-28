import type { SourceTag as Tag } from '@/features/calculators/remodel-roi-calculator/types'

import { SOURCE_TAG_CLASSES } from '@/features/calculators/remodel-roi-calculator/constants/story-classes'
import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
import { cn } from '@/shared/lib/utils'

interface Props {
  tag: Tag
  className?: string
}

export function SourceTag({ tag, className }: Props) {
  return <span className={cn('inline-flex h-6 shrink-0 items-center justify-self-end whitespace-nowrap rounded-full px-2 text-[11px] font-bold', SOURCE_TAG_CLASSES[tag], className)}>{STORY_COPY.tags[tag]}</span>
}
