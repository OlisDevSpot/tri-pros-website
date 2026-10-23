'use client'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { useFormContext, useWatch } from 'react-hook-form'
import { plural } from '@/features/proposal-flow/lib/form-parts'
import { summarizeSowPrices } from '@/features/proposal-flow/lib/section-price'
import { SectionPrice } from '@/features/proposal-flow/ui/components/form/section-price'
import { LoadingValue } from './loading-value'

export function SowCardSummary() {
  const form = useFormContext<ProposalFormSchema>()
  const sow = useWatch({ control: form.control, name: 'project.data.sow' })
  const mode = useWatch({ control: form.control, name: 'priceDisplayMode' })
  const { count, starting, final, struck } = summarizeSowPrices(sow, mode)
  const showPrice = final !== null && final > 0

  return (
    <LoadingValue width={170}>
      {plural(count, 'section')}
      {showPrice && (
        <>
          {' · '}
          <SectionPrice starting={starting} final={final} struck={struck} />
        </>
      )}
    </LoadingValue>
  )
}
