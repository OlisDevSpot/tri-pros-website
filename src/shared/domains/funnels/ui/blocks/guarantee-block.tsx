import type { FunnelContext, GuaranteeBlockContent } from '@/shared/domains/funnels/types'
import { ShieldCheck } from 'lucide-react'

export function GuaranteeBlock({ content }: { content: GuaranteeBlockContent, ctx: FunnelContext }) {
  return (
    <section className="border-border bg-card flex w-full flex-col items-center gap-4 rounded-lg border px-6 py-10 text-center shadow-sm">
      <span className="bg-muted text-foreground ring-border flex size-14 items-center justify-center rounded-full ring-1">
        <ShieldCheck className="size-7" aria-hidden="true" />
      </span>
      <h2 className="text-foreground text-xl font-semibold">{content.headline}</h2>
      <p className="text-muted-foreground max-w-md text-sm">{content.body}</p>
      {content.scarcityLine
        ? <span className="bg-muted text-foreground rounded-full px-3 py-1 text-xs font-medium">{content.scarcityLine}</span>
        : null}
    </section>
  )
}
