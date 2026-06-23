import type { FunnelContext, GuaranteeBlockContent } from '@/shared/domains/funnels/types'
import { ShieldCheck } from 'lucide-react'
import { Block } from '@/shared/domains/funnels/ui/block/block'

export function GuaranteeBlock({ content }: { content: GuaranteeBlockContent, ctx: FunnelContext }) {
  return (
    <Block surface="card" align="center">
      <Block.Content>
        <span className="bg-muted text-foreground ring-border flex size-14 items-center justify-center rounded-full ring-1">
          <ShieldCheck className="size-7" aria-hidden="true" />
        </span>
        <Block.Headline>{content.headline}</Block.Headline>
        <Block.Body>{content.body}</Block.Body>
        {content.scarcityLine
          ? <span className="bg-muted text-foreground rounded-full px-3 py-1 text-xs font-medium">{content.scarcityLine}</span>
          : null}
      </Block.Content>
    </Block>
  )
}
