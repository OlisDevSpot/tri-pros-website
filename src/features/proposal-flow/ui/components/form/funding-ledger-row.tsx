import { FUNDING_LEDGER_ROW } from '@/features/proposal-flow/constants/funding-ledger'
import { cn } from '@/shared/lib/utils'

interface Props {
  label: string
  value: string
  className?: string
}

export function FundingLedgerRow({ label, value, className }: Props) {
  return (
    <div className={cn(FUNDING_LEDGER_ROW, className)}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
