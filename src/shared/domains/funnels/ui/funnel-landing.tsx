'use client'

import type { ReactNode } from 'react'
import type { FunnelContext, FunnelSpec, MarketingBlock } from '@/shared/domains/funnels/types'
import { Button } from '@/shared/components/ui/button'
import { DEFAULT_LANDING_BLOCKS } from '@/shared/domains/funnels/constants/default-landing-blocks'
import { MARKETING_REGISTRY } from '@/shared/domains/funnels/constants/marketing-registry'
import { FunnelHero } from '@/shared/domains/funnels/ui/funnel-hero'

const QUESTION_ANCHOR = 'funnel-q1'

function scrollToQuestion() {
  document.getElementById(QUESTION_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function renderBlock(block: MarketingBlock, ctx: FunnelContext, index: number) {
  // Re-narrow per kind: the registry is typed per kind; indexing by the union
  // widens the lookup, so cast through `never` content like the step seam does.
  const Block = MARKETING_REGISTRY[block.kind] as (props: { content: typeof block.content, ctx: FunnelContext }) => ReactNode
  return <Block key={`${block.kind}-${index}`} content={block.content} ctx={ctx} />
}

export function FunnelLanding({ spec, ctx, children }: { spec: FunnelSpec, ctx: FunnelContext, children: ReactNode }) {
  const blocks = spec.landing?.blocks ?? DEFAULT_LANDING_BLOCKS
  return (
    <div className="flex w-full flex-col items-center gap-16 py-10">
      <div className="flex w-full max-w-xl flex-col gap-8 px-5">
        <FunnelHero content={spec.hero} />
        <div id={QUESTION_ANCHOR} className="scroll-mt-6">{children}</div>
      </div>
      <div className="flex w-full max-w-5xl flex-col gap-12 px-5">
        {blocks.map((block, i) => renderBlock(block, ctx, i))}
      </div>
      <Button size="lg" onClick={scrollToQuestion}>Ready? See if you qualify ↑</Button>
    </div>
  )
}
