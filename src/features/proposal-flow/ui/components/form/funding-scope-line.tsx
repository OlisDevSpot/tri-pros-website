import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { PriceDisplayMode } from '@/shared/constants/enums'
import { useState } from 'react'
import { scopeOfWorkRows } from '@/features/proposal-flow/lib/scope-of-work-rows'
import { LoadingValue } from '@/features/proposal-flow/ui/components/edit-page/loading-value'
import { SectionPrice } from './section-price'
import { SowPricingSummaryRow } from './sow-pricing-summary-row'

interface Props {
  label: string
  value: string
  sub?: string
  sow: ProposalFormSchema['project']['data']['sow']
  pricingMode: PriceDisplayMode
}

export function FundingScopeLine({ label, value, sub, sow, pricingMode }: Props) {
  const [open, setOpen] = useState(false)
  const rows = scopeOfWorkRows(sow, pricingMode)

  return (
    <div>
      <dt className="contents">
        <SowPricingSummaryRow
          layout="ledger"
          label={label}
          sub={sub && <LoadingValue width={110}>{sub}</LoadingValue>}
          total={<LoadingValue width={64}>{value}</LoadingValue>}
          open={open}
          onOpenChange={setOpen}
        >
          <ul className="flex flex-col gap-2 pt-1 pb-3 pl-3">
            {rows.map((row, index) => (
              // eslint-disable-next-line react/no-array-index-key -- sections have no stable id in the form values
              <li key={index} className="flex items-start justify-between gap-4 text-sm">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{row.title}</span>
                  {row.incentives && <span className="text-xs text-muted-foreground">{row.incentives}</span>}
                </span>
                <SectionPrice {...row.price} className="shrink-0" />
              </li>
            ))}
          </ul>
        </SowPricingSummaryRow>
      </dt>
    </div>
  )
}
