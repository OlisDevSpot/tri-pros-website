'use client'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { useFormContext, useWatch } from 'react-hook-form'
import { plural } from '@/features/proposal-flow/lib/form-parts'
import { formatLedgerAmount } from '@/features/proposal-flow/lib/format-ledger-amount'
import { summarizeSowPrices } from '@/features/proposal-flow/lib/section-price'
import { LoadingValue } from './loading-value'

export function SowCardSummary() {
  const form = useFormContext<ProposalFormSchema>()
  const sow = useWatch({ control: form.control, name: 'project.data.sow' })
  const mode = useWatch({ control: form.control, name: 'priceDisplayMode' })
  const { count, final } = summarizeSowPrices(sow, mode)
  const showPrice = final !== null && final > 0

  return (
    <LoadingValue width={170}>
      {plural(count, 'section')}
      {showPrice && (
        <>
          {' · '}
          <span className="text-sm font-semibold tabular-nums">{formatLedgerAmount(final)}</span>
        </>
      )}
    </LoadingValue>
  )
}
