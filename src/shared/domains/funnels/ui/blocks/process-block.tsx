import type { FunnelContext, ProcessBlockContent } from '@/shared/domains/funnels/types'
import Image from 'next/image'

export function ProcessBlock({ content }: { content: ProcessBlockContent, ctx: FunnelContext }) {
  return (
    <section className="flex flex-col gap-6 py-10">
      {content.title ? <h2 className="text-foreground text-center text-2xl font-semibold">{content.title}</h2> : null}
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {content.steps.map((step, i) => (
          <li key={step.title} className="border-border bg-card flex flex-col overflow-hidden rounded-2xl border">
            {step.image
              ? <Image src={step.image} alt={step.title} width={320} height={180} className="aspect-video w-full object-cover" />
              : null}
            <div className="flex flex-col gap-1 p-4">
              <span className="text-primary text-xs font-semibold tabular-nums">
                Step
                {' '}
                {i + 1}
                {step.duration ? ` · ${step.duration}` : ''}
              </span>
              <span className="text-foreground font-medium">{step.title}</span>
              <p className="text-muted-foreground text-sm">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
