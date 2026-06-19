import type { FunnelContext, GuaranteeBlockContent } from '@/shared/domains/funnels/types'
import { ShieldCheck } from 'lucide-react'

export function GuaranteeBlock({ content }: { content: GuaranteeBlockContent, ctx: FunnelContext }) {
  return (
    <section className="border-border bg-muted/40 flex flex-col items-center gap-3 rounded-2xl border px-6 py-10 text-center">
      <ShieldCheck className="text-muted-foreground size-8" />
      <h2 className="text-xl font-semibold">{content.headline}</h2>
      <p className="text-muted-foreground max-w-md text-sm">{content.body}</p>
      {content.scarcityLine ? <p className="text-foreground text-sm font-medium">{content.scarcityLine}</p> : null}
    </section>
  )
}
