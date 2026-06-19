'use client'

import type { ComponentType } from 'react'
import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import type { FunnelContext, StepProps } from '@/shared/domains/funnels/types'
import type { HeroScroll } from '@/shared/domains/funnels/ui/funnel-hero'
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useMemo, useRef } from 'react'
import { Button } from '@/shared/components/ui/button'
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
  STEP_VARIANTS,
} from '@/shared/domains/funnels/constants/funnel-motion'
import { STEP_REGISTRY } from '@/shared/domains/funnels/constants/step-registry'
import { useFunnelEngine } from '@/shared/domains/funnels/hooks/use-funnel-engine'
import { useFunnelUtm } from '@/shared/domains/funnels/hooks/use-funnel-utm'
import { getFunnel } from '@/shared/domains/funnels/lib/registry'
import { FunnelLanding } from '@/shared/domains/funnels/ui/funnel-landing'
import { FunnelProgress } from '@/shared/domains/funnels/ui/funnel-progress'
import { FunnelStickyHeader } from '@/shared/domains/funnels/ui/funnel-sticky-header'

/**
 * Accepts `slug` (serializable) and resolves the spec on the client (the spec
 * contains functions and can't cross the server→client boundary).
 *
 * Owns the funnel's single scroll choreography: one `useScroll` on the landing
 * hero drives the hero text fade/lift, the big-logo cross-fade, and the slim
 * sticky header's fade-in. The header is mounted here (above the transformed
 * `motion.div` wrappers) so `position: fixed` stays viewport-anchored and the
 * bar persists as one DOM node across the landing→step transition. On step
 * pages the hero isn't rendered, so the header gets a constant `1` opacity.
 * see ../constants/funnel-motion.ts
 */
export function FunnelEngine({ slug }: { slug: FunnelSlug }) {
  const spec = getFunnel(slug)
  const engine = useFunnelEngine(spec)
  const utm = useFunnelUtm(slug)
  const reduceMotion = useReducedMotion()

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

  // Constant opacity for the header on step pages (no hero scroll to track).
  const alwaysVisible = useMotionValue(1)

  // Ambient funnel-level context handed to every step (e.g. the lead step will
  // read ctx.utm/offer/slug here in 2b — no engine special-case needed).
  const ctx = useMemo<FunnelContext>(
    () => ({ slug: spec.slug, offer: spec.offer, theme: spec.theme, utm }),
    [spec, utm],
  )

  const currentIndex = spec.steps.findIndex(s => s.id === engine.step.id)

  // Single documented dispatch seam: the registry is typed per kind, but indexing
  // by a union `kind` widens the lookup. Re-narrow here with the ONE cast; each
  // step component stays fully typed against its own StepProps<S>.
  const StepView = STEP_REGISTRY[engine.step.kind] as ComponentType<StepProps>

  const stepEl = (
    <StepView
      step={engine.step}
      content={engine.step.content}
      value={engine.value}
      isAnswered={engine.value != null}
      setValue={engine.setAnswer}
      answers={engine.answers}
      ctx={ctx}
      advance={engine.advance}
      back={engine.back}
      isFirst={engine.isFirst}
    />
  )

  return (
    <div data-funnel={spec.slug} className="min-h-dvh w-full">
      <FunnelStickyHeader opacity={engine.isFirst ? headerOpacity : alwaysVisible} />
      {engine.isFirst
        ? (
            <FunnelLanding
              spec={spec}
              ctx={ctx}
              heroRef={heroRef}
              scroll={heroScroll}
              scrollToQuestionOnMount={engine.value != null}
            >
              {stepEl}
            </FunnelLanding>
          )
        : (
            <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-8 px-5 pb-10 pt-16">
              <FunnelProgress total={spec.steps.length} currentIndex={currentIndex} />
              <AnimatePresence mode="wait">
                <motion.div
                  key={engine.step.id}
                  initial={reduceMotion ? false : STEP_VARIANTS.initial}
                  animate={STEP_VARIANTS.animate}
                  exit={reduceMotion ? undefined : STEP_VARIANTS.exit}
                  transition={FUNNEL_TRANSITION}
                  className="flex-1"
                >
                  {stepEl}
                </motion.div>
              </AnimatePresence>
              <div className="flex items-center justify-between gap-3">
                <Button variant="ghost" onClick={engine.back}>← Back</Button>
                {engine.value != null && engine.hasNext
                  ? <Button onClick={engine.advance}>Next →</Button>
                  : <span />}
              </div>
            </div>
          )}
    </div>
  )
}
