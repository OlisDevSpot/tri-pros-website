import { cn } from '@/shared/lib/utils'

interface Props {
  items: { label: string, swatch: string }[]
}

export function LegendSwatches({ items }: Props) {
  return (
    <div className="flex flex-wrap gap-x-4.5 gap-y-1.5 text-[12.5px] font-bold text-muted-foreground">
      {items.map(item => (
        <span className="inline-flex items-center gap-1.5" key={item.label}>
          <i aria-hidden className={cn('inline-block h-1 w-3.5 rounded-sm', item.swatch)} />
          {item.label}
        </span>
      ))}
    </div>
  )
}
