import type { FunnelContext, ProblemBlockContent } from '@/shared/domains/funnels/types'
import { ShieldCheck, TriangleAlert } from 'lucide-react'

export function ProblemBlock({ content }: { content: ProblemBlockContent, ctx: FunnelContext }) {
  return (
    <section className="flex flex-col gap-6 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-foreground text-2xl font-semibold">{content.headline}</h2>
        {content.body ? <p className="text-muted-foreground max-w-2xl text-balance">{content.body}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {content.points.map(p => (
          <div key={p.title} className="border-border bg-card flex flex-col gap-2 rounded-lg border p-5 shadow-sm">
            <div className="text-foreground flex items-center gap-2.5 font-semibold">
              <span className="bg-destructive/10 text-destructive flex size-8 shrink-0 items-center justify-center rounded-md">
                <TriangleAlert className="size-4" aria-hidden="true" />
              </span>
              {p.title}
            </div>
            <p className="text-muted-foreground text-sm">{p.body}</p>
          </div>
        ))}
      </div>
      {content.standardLine
        ? (
            <div className="border-border border-l-foreground/30 bg-card text-foreground flex w-full items-start gap-3 rounded-lg border border-l-4 px-6 py-5 shadow-sm">
              <ShieldCheck className="text-foreground mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <p className="text-balance text-sm font-medium">{content.standardLine}</p>
            </div>
          )
        : null}
    </section>
  )
}
