import { cn } from '@/shared/lib/utils'

export interface ChartTooltipRow {
  label: string
  value: string
  swatch?: string
}

interface Props {
  title: string
  rows: ChartTooltipRow[]
}

export function ChartTooltipRows({ title, rows }: Props) {
  return (
    <div className="grid min-w-52 gap-1 text-sm">
      <p className="text-xs font-bold text-muted-foreground">{title}</p>
      {rows.map(row => (
        <div className="flex items-center gap-2" key={`${row.label}${row.value}`}>
          {row.swatch && <i aria-hidden className={cn('inline-block h-1 w-3.5 rounded-sm', row.swatch)} />}
          <span className="flex-1">{row.label}</span>
          <b className="tabular-nums">{row.value}</b>
        </div>
      ))}
    </div>
  )
}
