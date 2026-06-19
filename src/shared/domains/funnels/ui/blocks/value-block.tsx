import type { FunnelContext, ValueBlockContent } from '@/shared/domains/funnels/types'
import { ArrowRight } from 'lucide-react'

export function ValueBlock({ content }: { content: ValueBlockContent, ctx: FunnelContext }) {
  return (
    <section className="flex flex-col gap-6 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-foreground text-2xl font-semibold">{content.headline}</h2>
        {content.intro ? <p className="text-muted-foreground max-w-2xl text-balance">{content.intro}</p> : null}
      </div>
      {content.roiStat
        ? (
            <div className="flex flex-col items-center">
              <span className="text-primary text-4xl font-bold tabular-nums">{content.roiStat.value}</span>
              <span className="text-muted-foreground text-sm">{content.roiStat.label}</span>
            </div>
          )
        : null}
      <ul className="mx-auto flex w-full max-w-2xl flex-col gap-3">
        {content.items.map(item => (
          <li key={item.after} className="border-border bg-card flex items-center gap-3 rounded-xl border p-4 text-sm">
            <span className="text-muted-foreground flex-1 line-through">{item.before}</span>
            <ArrowRight className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
            <span className="text-foreground flex-1 font-medium">{item.after}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
