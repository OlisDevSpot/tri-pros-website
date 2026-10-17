'use client'

import { CheckIcon } from 'lucide-react'

import { useActiveChapter } from '@/features/proposal-flow/contexts/active-chapter-context'
import { usePortfolioMatch } from '@/features/proposal-flow/contexts/portfolio-match-context'

interface Props {
  tradeId: string
}

export function ScopeDoneBeforeChip({ tradeId }: Props) {
  const { matches } = usePortfolioMatch()
  const { select } = useActiveChapter()
  const first = matches[0]

  if (!first || (first.kind !== 'scope' && first.kind !== 'trade') || !first.matchedTradeIds.includes(tradeId)) {
    return null
  }

  const { title, city } = first.row.project
  return (
    <button
      type="button"
      data-press
      onClick={() => select('results')}
      className="inline-flex items-center gap-2 justify-self-start rounded-full border border-border bg-band px-3 py-2 text-left text-sm font-bold"
    >
      <CheckIcon className="size-4 shrink-0 text-status-success-fg" aria-hidden />
      {`We’ve done this before: ${[title, city].filter(Boolean).join(', ')}`}
    </button>
  )
}
