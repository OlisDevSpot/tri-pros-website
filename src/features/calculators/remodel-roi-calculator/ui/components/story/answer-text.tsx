import type { AnswerPart } from '@/features/calculators/remodel-roi-calculator/types'

import { TONE_TEXT_CLASSES } from '@/features/calculators/remodel-roi-calculator/constants/story-classes'
import { glueFigures } from '@/features/calculators/remodel-roi-calculator/lib/glue-figures'
import { cn } from '@/shared/lib/utils'

interface Props {
  parts: AnswerPart[]
}

export function AnswerText({ parts }: Props) {
  return (
    <>
      {parts.map((part, index) => part.tone
        // eslint-disable-next-line react/no-array-index-key -- a sentence's parts never reorder, and the same text can repeat
        ? <b className={cn('whitespace-nowrap tabular-nums @max-[40rem]/story:whitespace-normal', TONE_TEXT_CLASSES[part.tone])} key={index}>{glueFigures(part.text)}</b>
        // eslint-disable-next-line react/no-array-index-key -- a sentence's parts never reorder, and the same text can repeat
        : <span key={index}>{part.text}</span>)}
    </>
  )
}
