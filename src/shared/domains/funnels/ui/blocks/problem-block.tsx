import type { FunnelContext, ProblemBlockContent } from '@/shared/domains/funnels/types'
import { TriangleAlert } from 'lucide-react'

export function ProblemBlock({ content }: { content: ProblemBlockContent, ctx: FunnelContext }) {
  return (
    <section className="flex flex-col gap-6 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-foreground text-2xl font-semibold">{content.headline}</h2>
        {content.body ? <p className="text-muted-foreground max-w-2xl text-balance">{content.body}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {content.points.map(p => (
          <div key={p.title} className="border-border bg-card flex flex-col gap-1 rounded-2xl border p-5">
            <div className="text-foreground flex items-center gap-2 font-medium">
              <TriangleAlert className="text-destructive size-4 shrink-0" aria-hidden="true" />
              {p.title}
            </div>
            <p className="text-muted-foreground text-sm">{p.body}</p>
          </div>
        ))}
      </div>
      {content.standardLine
        ? <p className="border-primary/30 bg-primary/5 text-foreground mx-auto max-w-3xl text-balance rounded-2xl border px-6 py-4 text-center text-sm font-medium">{content.standardLine}</p>
        : null}
    </section>
  )
}
