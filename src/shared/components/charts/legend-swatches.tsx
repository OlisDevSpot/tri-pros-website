import type { ChartConfig } from '@/shared/components/ui/chart'

interface Props {
  config: ChartConfig
  keys?: readonly string[]
}

export function LegendSwatches({ config, keys = Object.keys(config) }: Props) {
  return (
    <div className="flex flex-wrap gap-x-4.5 gap-y-1.5 text-[12.5px] font-bold text-muted-foreground">
      {keys.map(key => (
        <span className="inline-flex items-center gap-1.5" key={key}>
          <i aria-hidden className="inline-block h-1 w-3.5 rounded-sm" style={{ background: config[key].color }} />
          {config[key].label}
        </span>
      ))}
    </div>
  )
}
