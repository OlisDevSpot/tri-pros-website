import type { ProposalAccessor } from '@/features/proposal-flow/constants/proposal-steps'

import { proposalSteps } from '@/features/proposal-flow/constants/proposal-steps'
import { cn } from '@/shared/lib/utils'

interface Props {
  chapter: ProposalAccessor
  tone?: 'page' | 'media'
  className?: string
}

export function ChapterEyebrow({ chapter, tone = 'page', className }: Props) {
  const index = proposalSteps.findIndex(step => step.accessor === chapter)
  const step = proposalSteps[index]

  return (
    <p className={cn('flex items-center gap-2.5 text-xs font-bold tracking-[0.16em] uppercase', tone === 'media' ? 'text-(--presentation-accent)' : 'text-muted-foreground', className)}>
      <span className={cn('font-sans tracking-[0.04em]', tone === 'media' ? 'text-on-media' : 'text-primary')}>{String(index + 1).padStart(2, '0')}</span>
      {step?.shortLabel}
    </p>
  )
}
