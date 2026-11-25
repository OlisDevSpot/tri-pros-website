'use client'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { useGetFinanceOptions } from '@/features/proposal-flow/dal/client/queries/use-get-finance-options'
import { deriveChoiceTiles } from '@/features/proposal-flow/lib/derive-choice-tiles'
import { deriveStoredFundingChoice } from '@/features/proposal-flow/lib/derive-stored-funding-choice'
import { cn } from '@/shared/lib/utils'
import { isProposalFrozen } from '@/shared/modules/proposals/core/lib/proposal-lock'

// The stored choice, read the way the page reads it, so the agent sees what the homeowner last saved.
export function FundingChoiceTiles() {
  const { proposal } = useProposalDocument()
  const options = useGetFinanceOptions()
  const choice = deriveStoredFundingChoice(proposal, isProposalFrozen(proposal) ? 'saved' : 'editable')
  const term = options.data?.find(option => option.id === choice.selectedOptionId) ?? null
  const tiles = deriveChoiceTiles(choice, term)

  return (
    <dl className="grid grid-cols-2 gap-1.5">
      {tiles.map((tile, index) => (
        <div
          key={tile.label}
          className={cn(
            'grid min-w-0 gap-1 rounded-lg border border-border bg-card px-3 py-2.5',
            index === 0 && 'border-primary/30 bg-row-selected text-primary',
          )}
        >
          <dt className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">{tile.label}</dt>
          <dd className="truncate font-sans text-lg leading-tight tabular-nums">{tile.value}</dd>
        </div>
      ))}
    </dl>
  )
}
