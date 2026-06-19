import type { FaqBlockContent, FunnelContext } from '@/shared/domains/funnels/types'
import { ChevronDown } from 'lucide-react'

export function FaqBlock({ content }: { content: FaqBlockContent, ctx: FunnelContext }) {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 py-10">
      {content.title ? <h2 className="text-foreground text-center text-2xl font-semibold">{content.title}</h2> : null}
      <div className="flex flex-col gap-2">
        {content.items.map(item => (
          <details key={item.q} className="border-border bg-card group rounded-xl border px-4 py-3">
            <summary className="text-foreground flex cursor-pointer list-none items-center justify-between gap-2 font-medium">
              {item.q}
              <ChevronDown className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <p className="text-muted-foreground mt-2 text-sm">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
