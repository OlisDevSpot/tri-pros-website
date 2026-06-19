import type { FunnelContext, ValueBlockContent } from '@/shared/domains/funnels/types'
import { ArrowRight } from 'lucide-react'
import Image from 'next/image'

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
      {content.beforeAfter?.length
        ? (
            <div className="grid w-full gap-4 sm:grid-cols-2">
              {content.beforeAfter.map(pair => (
                <div key={pair.after} className="grid grid-cols-2 gap-2 sm:gap-3">
                  <figure className="border-border relative overflow-hidden rounded-lg border">
                    <Image src={pair.before} alt="Kitchen before the remodel" width={640} height={480} sizes="(max-width: 640px) 45vw, 320px" className="aspect-4/3 w-full object-cover" />
                    <figcaption className="bg-background/85 text-foreground absolute left-2 top-2 rounded-md px-2 py-0.5 text-xs font-semibold backdrop-blur-sm">Before</figcaption>
                  </figure>
                  <figure className="border-border relative overflow-hidden rounded-lg border">
                    <Image src={pair.after} alt="Kitchen after the remodel" width={640} height={480} sizes="(max-width: 640px) 45vw, 320px" className="aspect-4/3 w-full object-cover" />
                    <figcaption className="bg-foreground/85 text-background absolute left-2 top-2 rounded-md px-2 py-0.5 text-xs font-semibold backdrop-blur-sm">After</figcaption>
                  </figure>
                </div>
              ))}
            </div>
          )
        : null}
      <ul className="grid w-full gap-3 sm:grid-cols-2">
        {content.items.map(item => (
          <li key={item.after} className="border-border bg-card flex items-center gap-3 rounded-lg border p-4 text-sm shadow-sm">
            <span className="text-muted-foreground flex-1 line-through">{item.before}</span>
            <ArrowRight className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
            <span className="text-foreground flex-1 font-medium">{item.after}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
