'use client'

import type { CtaBlockContent, FunnelContext } from '@/shared/domains/funnels/types'
import { ArrowUp } from 'lucide-react'
import { QUESTION_ANCHOR } from '@/shared/domains/funnels/constants/anchors'
import { Block } from '@/shared/domains/funnels/ui/block/block'
import { FunnelCta } from '@/shared/domains/funnels/ui/funnel-cta'

export function CtaBlock({ content }: { content: CtaBlockContent, ctx: FunnelContext }) {
  function handleClick() {
    document.getElementById(QUESTION_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <Block surface="plain" align="center" size="compact">
      <Block.Content>
        <Block.Actions>
          <FunnelCta onClick={handleClick} className="self-center">
            <ArrowUp className="size-4" aria-hidden="true" />
            {content.label}
          </FunnelCta>
        </Block.Actions>
      </Block.Content>
    </Block>
  )
}
