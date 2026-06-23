'use client'

import type { CtaBlockContent, FunnelContext } from '@/shared/domains/funnels/types'
import { ArrowUp } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { QUESTION_ANCHOR } from '@/shared/domains/funnels/constants/anchors'
import { Block } from '@/shared/domains/funnels/ui/block/block'

export function CtaBlock({ content }: { content: CtaBlockContent, ctx: FunnelContext }) {
  function handleClick() {
    document.getElementById(QUESTION_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <Block surface="plain" align="center" size="compact">
      <Block.Content>
        <Block.Actions>
          <Button size="lg" onClick={handleClick}>
            <ArrowUp className="size-4" aria-hidden="true" />
            {content.label}
          </Button>
        </Block.Actions>
      </Block.Content>
    </Block>
  )
}
