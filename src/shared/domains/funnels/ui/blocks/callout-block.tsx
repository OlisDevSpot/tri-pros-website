import type { CalloutBlockContent, FunnelContext } from '@/shared/domains/funnels/types'
import { Check } from 'lucide-react'

export function CalloutBlock({ content }: { content: CalloutBlockContent, ctx: FunnelContext }) {
  return (
    <section className="border-border bg-muted/40 mx-auto flex w-full max-w-3xl flex-col items-center gap-3 rounded-2xl border px-6 py-10 text-center">
      <h2 className="text-foreground text-xl font-semibold">{content.headline}</h2>
      <p className="text-muted-foreground max-w-xl text-balance text-sm">{content.body}</p>
      {content.points
        ? (
            <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              {content.points.map(pt => (
                <li key={pt} className="text-foreground flex items-center gap-1 text-xs font-medium">
                  <Check className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
                  {pt}
                </li>
              ))}
            </ul>
          )
        : null}
    </section>
  )
}
