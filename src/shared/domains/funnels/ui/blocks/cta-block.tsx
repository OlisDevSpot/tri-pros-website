'use client'

import type { CtaBlockContent, FunnelContext } from '@/shared/domains/funnels/types'
import { ArrowUp } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { QUESTION_ANCHOR } from '@/shared/domains/funnels/constants/anchors'

export function CtaBlock({ content }: { content: CtaBlockContent, ctx: FunnelContext }) {
  function handleClick() {
    document.getElementById(QUESTION_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section className="flex flex-col items-center py-6">
      <Button size="lg" onClick={handleClick}>
        <ArrowUp className="size-4" aria-hidden="true" />
        {content.label}
      </Button>
    </section>
  )
}
