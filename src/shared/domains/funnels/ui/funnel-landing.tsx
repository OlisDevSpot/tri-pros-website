'use client'

import type { ReactNode, Ref } from 'react'
import type { FunnelContext, FunnelSpec, MarketingBlock } from '@/shared/domains/funnels/types'
import type { HeroScroll } from '@/shared/domains/funnels/ui/funnel-hero'
import { ArrowUp } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Fragment, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import { DEFAULT_LANDING_BLOCKS } from '@/shared/domains/funnels/constants/default-landing-blocks'
import { FUNNEL_TRANSITION } from '@/shared/domains/funnels/constants/funnel-motion'
import { MARKETING_REGISTRY } from '@/shared/domains/funnels/constants/marketing-registry'
import { FunnelHero } from '@/shared/domains/funnels/ui/funnel-hero'
import { TrustBar } from '@/shared/domains/funnels/ui/trust-bar'

const QUESTION_ANCHOR = 'funnel-q1'

function scrollToQuestion() {
  document.getElementById(QUESTION_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function renderBlock(block: MarketingBlock, ctx: FunnelContext, _index: number) {
  // Re-narrow per kind: the registry is typed per kind; indexing by the union
  // widens the lookup, so cast through the per-kind content like the step seam.
  const Block = MARKETING_REGISTRY[block.kind] as (props: { content: typeof block.content, ctx: FunnelContext }) => ReactNode
  return <Block content={block.content} ctx={ctx} />
}

export function FunnelLanding({ spec, ctx, children, scrollToQuestionOnMount, heroRef, scroll }: {
  spec: FunnelSpec
  ctx: FunnelContext
  children: ReactNode
  scrollToQuestionOnMount?: boolean
  heroRef?: Ref<HTMLElement>
  scroll?: HeroScroll | null
}) {
  const reduceMotion = useReducedMotion()
  const blocks = spec.landing?.blocks ?? DEFAULT_LANDING_BLOCKS

  // On a Back-return to the landing (Q1 already answered) jump to the question
  // so the Continue affordance is visible instead of buried under the hero.
  useEffect(() => {
    if (scrollToQuestionOnMount) {
      document.getElementById(QUESTION_ANCHOR)?.scrollIntoView({ block: 'start' })
    }
  }, [scrollToQuestionOnMount])

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={FUNNEL_TRANSITION}
      className="flex w-full flex-col items-center gap-16 py-10"
    >
      <div className="flex w-full max-w-xl flex-col gap-8 px-5">
        <FunnelHero content={spec.hero} onCta={scrollToQuestion} ref={heroRef} scroll={scroll} />
        <TrustBar />
        <div id={QUESTION_ANCHOR} className="scroll-mt-6">{children}</div>
      </div>
      <div className="flex w-full max-w-5xl flex-col gap-12 px-5">
        {blocks.map((block, i) => (
          <Fragment key={`${block.kind}-${i}`}>
            {renderBlock(block, ctx, i)}
            {(i + 1) % 3 === 0 && i < blocks.length - 1
              ? (
                  <Button size="lg" onClick={scrollToQuestion} className="self-center">
                    <ArrowUp className="size-4" />
                    See if you qualify
                  </Button>
                )
              : null}
          </Fragment>
        ))}
      </div>
      <Button size="lg" onClick={scrollToQuestion}>Ready? See if you qualify ↑</Button>
    </motion.div>
  )
}
