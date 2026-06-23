import type { FunnelContext, ProcessBlockContent } from '@/shared/domains/funnels/types'
import Image from 'next/image'
import { Block } from '@/shared/domains/funnels/ui/block/block'

export function ProcessBlock({ content }: { content: ProcessBlockContent, ctx: FunnelContext }) {
  return (
    <Block surface="plain" align="center">
      <Block.Content>
        {content.title ? <Block.Headline>{content.title}</Block.Headline> : null}
        <ol className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {content.steps.map((step, i) => (
            <li key={step.title} className="border-border bg-card flex flex-col overflow-hidden rounded-md border text-left shadow-sm">
              {step.image
                ? (
                    <div className="relative">
                      <Image src={step.image} alt={step.title} width={320} height={180} className="aspect-video w-full object-cover" />
                      <span className="bg-card text-foreground border-border absolute left-3 top-3 flex size-7 items-center justify-center rounded-full border text-sm font-semibold tabular-nums shadow-sm">{i + 1}</span>
                    </div>
                  )
                : null}
              <div className="flex flex-col gap-1 p-4">
                <span className="text-muted-foreground text-xs font-semibold tabular-nums">
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
      </Block.Content>
    </Block>
  )
}
