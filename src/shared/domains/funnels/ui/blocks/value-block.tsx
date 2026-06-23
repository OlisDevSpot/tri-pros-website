import type { FunnelContext, ValueBlockContent } from '@/shared/domains/funnels/types'
import { ArrowRight } from 'lucide-react'
import { Block } from '@/shared/domains/funnels/ui/block/block'
import { BeforeAfterShowcase } from '@/shared/domains/funnels/ui/blocks/before-after-showcase'

export function ValueBlock({ content }: { content: ValueBlockContent, ctx: FunnelContext }) {
  return (
    <Block surface="plain" align="center">
      <Block.Content>
        <Block.Headline>{content.headline}</Block.Headline>
        {content.intro ? <Block.Body>{content.intro}</Block.Body> : null}
        {content.roiStat
          ? (
              <div className="flex flex-col items-center">
                <span className="text-primary font-bold tabular-nums text-[length:var(--fs-display)]">{content.roiStat.value}</span>
                <span className="text-muted-foreground text-sm">{content.roiStat.label}</span>
              </div>
            )
          : null}
        {content.beforeAfter?.length
          ? <BeforeAfterShowcase pairs={content.beforeAfter} />
          : null}
        <ul className="grid w-full gap-3 sm:grid-cols-2">
          {content.items.map(item => (
            <li key={item.after} className="border-border bg-card flex items-center gap-3 rounded-md border p-4 text-sm shadow-sm">
              <span className="text-muted-foreground flex-1 line-through">{item.before}</span>
              <ArrowRight className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
              <span className="text-foreground flex-1 font-medium">{item.after}</span>
            </li>
          ))}
        </ul>
      </Block.Content>
    </Block>
  )
}
