'use client'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { useGetFinanceOptions } from '@/features/proposal-flow/dal/client/queries/use-get-finance-options'
import { deriveStoredFundingChoice } from '@/features/proposal-flow/lib/derive-stored-funding-choice'
import { pickMoneyFormat } from '@/features/proposal-flow/lib/money-format'
import { numberToUSD } from '@/shared/lib/formatters'
import { getLoanValues } from '@/shared/lib/loan-calculations'
import { cn } from '@/shared/lib/utils'
import { isProposalFrozen } from '@/shared/modules/proposals/core/lib/proposal-lock'

// The stored choice, read the way the page reads it, so the agent sees what the homeowner last saved.
export function FundingChoiceTiles() {
  const { proposal } = useProposalDocument()
  const options = useGetFinanceOptions()
  const choice = deriveStoredFundingChoice(proposal, isProposalFrozen(proposal) ? 'saved' : 'editable')
  const format = pickMoneyFormat([choice.finalTcp, choice.deposit, choice.cash, choice.financed])
  const option = options.data?.find(o => o.id === choice.selectedOptionId) ?? null

  const tiles = choice.allCash
    ? [
        { label: 'Plan', value: 'All cash' },
        { label: 'Price', value: format(choice.finalTcp) },
        { label: 'Deposit', value: format(choice.deposit) },
        { label: 'Then', value: `${choice.schedule.filter(row => row.due !== 'signing').length} payments` },
      ]
    : [
        { label: 'Plan', value: 'Financed' },
        { label: 'Cash down', value: format(choice.cash) },
        { label: 'Term', value: option ? `${option.termInMonths / 12} years` : 'Not picked' },
        { label: 'Monthly', value: option ? numberToUSD(getLoanValues(choice.financed, option.interestRate, option.termInMonths).monthly) : '—' },
      ]

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
