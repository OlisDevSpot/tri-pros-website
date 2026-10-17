import type { ProposalAccessor } from '@/features/proposal-flow/constants/proposal-steps'

import { proposalSteps } from '@/features/proposal-flow/constants/proposal-steps'
import { cn } from '@/shared/lib/utils'

interface Props {
  chapter: ProposalAccessor
  title: string
  lede?: string
  tone?: 'page' | 'media'
}

// The eyebrow carries the number and short label, so the H2 is a sentence, never the label again.
export function ChapterHeader({ chapter, title, lede, tone = 'page' }: Props) {
  const index = proposalSteps.findIndex(step => step.accessor === chapter)
  const step = proposalSteps[index]

  return (
    <header className="grid max-w-[60ch] gap-2.5">
      <p className={cn('flex items-center gap-2.5 text-xs font-bold tracking-[0.16em] uppercase', tone === 'media' ? 'text-(--presentation-accent)' : 'text-muted-foreground')}>
        <span className={cn('font-sans tracking-[0.04em]', tone === 'media' ? 'text-on-media' : 'text-primary')}>{String(index + 1).padStart(2, '0')}</span>
        {step?.shortLabel}
      </p>
      <h2 id={`${chapter}-title`} className="font-sans text-3xl leading-[1.15] font-medium text-balance @min-[700px]/proposal:text-4xl">{title}</h2>
      {lede && <p className={cn('max-w-[58ch]', tone === 'media' ? 'text-on-media-muted' : 'text-muted-foreground')}>{lede}</p>}
    </header>
  )
}
