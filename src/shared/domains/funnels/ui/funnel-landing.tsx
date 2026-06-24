'use client'

import type { ReactNode } from 'react'
import type { FunnelContext, FunnelSpec, MarketingBlock } from '@/shared/domains/funnels/types'
import type { HeroScroll } from '@/shared/domains/funnels/ui/funnel-hero'
import { ArrowUp } from 'lucide-react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { Fragment, useEffect, useRef } from 'react'
import { QUESTION_ANCHOR } from '@/shared/domains/funnels/constants/anchors'
import {
  FOOTER_CTA_LABEL,
  INTERSTITIAL_CTA_BY_SECTION,
  INTERSTITIAL_CTA_FALLBACK,
} from '@/shared/domains/funnels/constants/cta-copy'
import { DEFAULT_LANDING_BLOCKS } from '@/shared/domains/funnels/constants/default-landing-blocks'
import { FUNNEL_QUESTION_MAX_W, FUNNEL_RAIL_MAX_W } from '@/shared/domains/funnels/constants/funnel-layout'
import {
  FUNNEL_TRANSITION,
  HERO_HEADER_OPACITY_IN,
  HERO_HEADER_OPACITY_OUT,
  HERO_LOGO_OPACITY_IN,
  HERO_LOGO_OPACITY_OUT,
  HERO_LOGO_SCALE_IN,
  HERO_LOGO_SCALE_TARGET,
  HERO_SCROLL_OFFSET,
  HERO_TEXT_LIFT_PX,
  HERO_TEXT_OPACITY_IN,
  HERO_TEXT_OPACITY_OUT,
} from '@/shared/domains/funnels/constants/funnel-motion'
import { MARKETING_REGISTRY } from '@/shared/domains/funnels/constants/marketing-registry'
import { FunnelCta } from '@/shared/domains/funnels/ui/funnel-cta'
import { FunnelHero } from '@/shared/domains/funnels/ui/funnel-hero'
import { FunnelStickyHeader } from '@/shared/domains/funnels/ui/funnel-sticky-header'
import { TrustBar } from '@/shared/domains/funnels/ui/trust-bar'

function scrollToQuestion() {
  document.getElementById(QUESTION_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function renderBlock(block: MarketingBlock, ctx: FunnelContext, _index: number) {
  // Re-narrow per kind: the registry is typed per kind; indexing by the union
  // widens the lookup, so cast through the per-kind content like the step seam.
  const Block = MARKETING_REGISTRY[block.kind] as (props: { content: typeof block.content, ctx: FunnelContext }) => ReactNode
  return <Block content={block.content} ctx={ctx} />
}

/**
 * Owns the hero scroll choreography. The single `useScroll` lives HERE (not in
 * the engine) on purpose: the landing unmounts when the funnel advances to a
 * step and remounts on Back, so the hook — and its element-bound scroll
 * subscription — re-initializes against the freshly-mounted hero each time.
 * Hoisting it to the always-mounted engine froze `scrollYProgress` at its last
 * value after the hero remounted (framer-motion's useScroll never re-binds a
 * stable target ref). see ./funnel-hero.tsx, ../constants/funnel-motion.ts
 *
 * The slim sticky header is rendered here as a fragment sibling — OUTSIDE the
 * entrance `motion.div` — so its `position: fixed` is anchored to the viewport
 * rather than the transformed wrapper. The step branch renders its own
 * always-visible copy from the engine.
 */
export function FunnelLanding({ spec, ctx, children, variant, scrollToQuestionOnMount }: {
  spec: FunnelSpec
  ctx: FunnelContext
  children: ReactNode
  variant?: string
  scrollToQuestionOnMount?: boolean
}) {
  const reduceMotion = useReducedMotion()
  const blocks = (variant ? spec.variants?.[variant]?.blocks : undefined)
    ?? spec.landing?.blocks
    ?? DEFAULT_LANDING_BLOCKS

  const heroRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: [...HERO_SCROLL_OFFSET] })

  // Reduced motion gates only translate/scale (vestibular-unsafe); the opacity
  // cross-fades are kept — they aid comprehension and are motion-sickness-safe.
  const textOpacity = useTransform(scrollYProgress, HERO_TEXT_OPACITY_IN, HERO_TEXT_OPACITY_OUT)
  const textY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : HERO_TEXT_LIFT_PX])
  const logoOpacity = useTransform(scrollYProgress, HERO_LOGO_OPACITY_IN, HERO_LOGO_OPACITY_OUT)
  const logoScale = useTransform(scrollYProgress, HERO_LOGO_SCALE_IN, [1, reduceMotion ? 1 : HERO_LOGO_SCALE_TARGET])
  const headerOpacity = useTransform(scrollYProgress, HERO_HEADER_OPACITY_IN, HERO_HEADER_OPACITY_OUT)
  const heroScroll: HeroScroll = { textOpacity, textY, logoOpacity, logoScale }

  // On a Back-return to the landing (Q1 already answered) jump to the question
  // so the Continue affordance is visible instead of buried under the hero.
  useEffect(() => {
    if (scrollToQuestionOnMount) {
      document.getElementById(QUESTION_ANCHOR)?.scrollIntoView({ block: 'start' })
    }
  }, [scrollToQuestionOnMount])

  return (
    <>
      <FunnelStickyHeader opacity={headerOpacity} widthClass={FUNNEL_RAIL_MAX_W} />
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={FUNNEL_TRANSITION}
        className="relative flex w-full flex-col items-center gap-16 overflow-x-clip pt-2.5 pb-10"
      >
        <div className="flex w-full flex-col items-center gap-8">
          <div className={`w-full ${FUNNEL_RAIL_MAX_W} px-2.5`}>
            <FunnelHero content={spec.hero} onCta={scrollToQuestion} ref={heroRef} scroll={heroScroll} />
          </div>
          <div className={`flex w-full ${FUNNEL_QUESTION_MAX_W} flex-col gap-8 px-2.5`}>
            <TrustBar />
            <div id={QUESTION_ANCHOR} className="scroll-mt-20">{children}</div>
          </div>
        </div>
        <div className={`flex w-full ${FUNNEL_RAIL_MAX_W} flex-col gap-12 px-2.5`}>
          {blocks.map((block, i) => (
            <Fragment key={`${block.kind}-${i}`}>
              {renderBlock(block, ctx, i)}
              {(i + 1) % 3 === 0 && i < blocks.length - 1
                ? (
                    <FunnelCta onClick={scrollToQuestion} className="self-center">
                      <ArrowUp className="size-4" />
                      {INTERSTITIAL_CTA_BY_SECTION[block.kind] ?? INTERSTITIAL_CTA_FALLBACK}
                    </FunnelCta>
                  )
                : null}
            </Fragment>
          ))}
        </div>
        <FunnelCta onClick={scrollToQuestion} className="self-center">
          {FOOTER_CTA_LABEL}
          <ArrowUp className="size-4" />
        </FunnelCta>
      </motion.div>
    </>
  )
}
