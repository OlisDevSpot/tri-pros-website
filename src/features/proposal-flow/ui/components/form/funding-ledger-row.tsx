import { FUNDING_LEDGER_ROW } from '@/features/proposal-flow/constants/funding-ledger'
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
        {sub && <span className="text-xs font-normal text-muted-foreground">{sub}</span>}
      </dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
