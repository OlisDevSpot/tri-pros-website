'use client'

import type { FundingChoice } from '@/features/proposal-flow/hooks/use-funding-choice'

import { LockIcon } from 'lucide-react'

import { FINANCING_STARTS_AT, FUNDING_LOCKED_NOTE } from '@/features/proposal-flow/constants/funding-copy'
import { CashDownControl } from '@/features/proposal-flow/ui/components/proposal/cash-down-control'
import { FinanceOptionGroup } from '@/features/proposal-flow/ui/components/proposal/finance-option-group'
import { MonthlyHeadline } from '@/features/proposal-flow/ui/components/proposal/monthly-headline'
import { PayAllCashSwitch } from '@/features/proposal-flow/ui/components/proposal/pay-all-cash-switch'

interface Props {
  choice: FundingChoice
}

export function PayCard({ choice }: Props) {
  const { allCash, canFinance, locked, options, selectedOptionId } = choice
  const picked = options.find(option => option.id === selectedOptionId) ?? null

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="grid gap-4 p-4.5">
        <PayAllCashSwitch checked={allCash} disabled={locked || !canFinance} onCheckedChange={choice.setAllCash} />
        {locked && (
          <p className="flex gap-2.5 rounded-lg bg-status-info-bg px-3.5 py-3 text-sm font-bold text-status-info-fg">
            <LockIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {FUNDING_LOCKED_NOTE}
          </p>
        )}
        {!canFinance && <p className="text-xs text-muted-foreground">{`${FINANCING_STARTS_AT}, so this project is paid in cash.`}</p>}
        <MonthlyHeadline
          allCash={allCash}
          finalTcp={choice.finalTcp}
          deposit={choice.deposit}
          financed={choice.financed}
          shown={picked ?? choice.lowest}
          picked={picked !== null}
          loading={choice.optionsLoading}
          monthlyFor={choice.monthlyFor}
        />
        {!allCash && (
          <>
            <CashDownControl
              cash={choice.cash}
              deposit={choice.deposit}
              finalTcp={choice.finalTcp}
              stops={choice.stops}
              disabled={locked}
              onChange={choice.setCash}
            />
            {options.length > 0 && (
              <FinanceOptionGroup options={options} selectedId={selectedOptionId} monthlyFor={choice.monthlyFor} disabled={locked} onSelect={choice.selectOption} />
            )}
            <p className="text-xs text-muted-foreground">{`Estimates, subject to lender approval. ${FINANCING_STARTS_AT}.`}</p>
          </>
        )}
      </div>
    </div>
  )
}
