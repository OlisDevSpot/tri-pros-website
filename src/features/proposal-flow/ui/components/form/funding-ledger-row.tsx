import { FUNDING_LEDGER_ROW } from '@/features/proposal-flow/constants/funding-ledger'
import { LoadingValue } from '@/features/proposal-flow/ui/components/edit-page/loading-value'
import { cn } from '@/shared/lib/utils'

interface Props {
  label: string
  value: string
  sub?: string
  className?: string
}

export function FundingLedgerRow({ label, value, sub, className }: Props) {
  return (
    <div className={cn(FUNDING_LEDGER_ROW, sub && 'py-2', className)}>
      <dt className="flex flex-col">
        {label}
        {sub && (
          <span className="text-xs font-normal text-muted-foreground">
            <LoadingValue width={110}>{sub}</LoadingValue>
          </span>
        )}
      </dt>
      <dd className="tabular-nums">
        <LoadingValue width={64}>{value}</LoadingValue>
      </dd>
    </div>
  )
}
