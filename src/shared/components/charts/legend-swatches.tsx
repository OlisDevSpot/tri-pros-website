import type { ChartConfig } from '@/shared/components/ui/chart'

// Distributive so a union config (one branch's keys per ternary) keeps each branch's own keys,
// rather than collapsing to their intersection the way a plain `keyof C` would.
type ConfigKey<C> = C extends ChartConfig ? keyof C & string : never

interface Props<C extends ChartConfig> {
  config: C
  keys?: readonly ConfigKey<C>[]
}

export function LegendSwatches<C extends ChartConfig>({ config, keys = Object.keys(config) as ConfigKey<C>[] }: Props<C>) {
  return (
    <div className="flex flex-wrap gap-x-4.5 gap-y-1.5 text-xs font-bold text-muted-foreground">
      {keys.map((key) => {
        const item = config[key as keyof C]
        return (
          <span className="inline-flex items-center gap-1.5" key={key}>
            <i aria-hidden className="inline-block h-1 w-3.5 rounded-sm" style={{ background: item.color }} />
            {item.label}
          </span>
        )
      })}
    </div>
  )
}
