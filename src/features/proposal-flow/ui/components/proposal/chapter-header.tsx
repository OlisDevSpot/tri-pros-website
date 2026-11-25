import type { ProposalAccessor } from '@/features/proposal-flow/constants/proposal-steps'

import { ChapterEyebrow } from '@/features/proposal-flow/ui/components/proposal/chapter-eyebrow'
import { cn } from '@/shared/lib/utils'

interface Props {
  chapter: ProposalAccessor
  title: string
  lede?: string
  tone?: 'page' | 'media'
  eyebrow?: boolean
}

// The eyebrow carries the number and short label, so the H2 is a sentence, never the label again.
export function ChapterHeader({ chapter, title, lede, tone = 'page', eyebrow = true }: Props) {
  return (
    <header className="grid max-w-[60ch] gap-2.5">
      {eyebrow && <ChapterEyebrow chapter={chapter} tone={tone} />}
      <h2 id={`${chapter}-title`} className="font-sans text-3xl leading-[1.15] font-medium text-balance @min-[700px]/proposal:text-4xl">{title}</h2>
      {lede && <p className={cn('max-w-[58ch]', tone === 'media' ? 'text-on-media-muted' : 'text-muted-foreground')}>{lede}</p>}
    </header>
  )
}
