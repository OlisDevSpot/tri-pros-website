import { Card } from '@/shared/components/ui/card'
import { formatAsDollars } from '@/shared/lib/formatters'

interface Props {
  title: string
  moneyLabel: string
  money: number
  homeValue: number
  netWorth: number
}

export function ComparisonCard({ title, moneyLabel, money, homeValue, netWorth }: Props) {
  return (
    <Card className="gap-2 p-4">
      <h4 className="text-sm font-medium">{title}</h4>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{moneyLabel}</dt>
        <dd className="text-right tabular-nums">{formatAsDollars(money)}</dd>
        <dt className="text-muted-foreground">Home value</dt>
        <dd className="text-right tabular-nums">{formatAsDollars(homeValue)}</dd>
        <dt className="text-muted-foreground">Net worth</dt>
        <dd className="text-right tabular-nums">{formatAsDollars(netWorth)}</dd>
      </dl>
    </Card>
  )
}
