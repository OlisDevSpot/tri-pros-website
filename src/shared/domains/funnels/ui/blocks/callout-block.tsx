import type { CalloutBlockContent, FunnelContext } from '@/shared/domains/funnels/types'
import { Check, Wallet } from 'lucide-react'

export function CalloutBlock({ content }: { content: CalloutBlockContent, ctx: FunnelContext }) {
  return (
    <section className="border-border bg-card flex w-full flex-col items-center gap-4 rounded-lg border px-6 py-10 text-center shadow-sm">
      <span className="bg-muted text-foreground flex size-12 items-center justify-center rounded-full">
        <Wallet className="size-6" aria-hidden="true" />
      </span>
      <h2 className="text-foreground text-xl font-semibold">{content.headline}</h2>
      <p className="text-muted-foreground max-w-xl text-balance text-sm">{content.body}</p>
      {content.points
        ? (
            <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {content.points.map(pt => (
                <li key={pt} className="text-foreground flex items-center gap-1.5 text-sm font-medium">
                  <Check className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                  {pt}
                </li>
              ))}
            </ul>
          )
        : null}
    </section>
  )
}
