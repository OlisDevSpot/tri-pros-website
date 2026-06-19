'use client'

import type { ComponentType } from 'react'
import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import type { FunnelContext, StepProps } from '@/shared/domains/funnels/types'
import { AnimatePresence, motion, useMotionValue, useReducedMotion } from 'motion/react'
import { useMemo } from 'react'
import { Button } from '@/shared/components/ui/button'
import { FUNNEL_TRANSITION, STEP_VARIANTS } from '@/shared/domains/funnels/constants/funnel-motion'
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
 * The slim sticky header appears on every screen. On the landing, the hero
 * scroll drives its reveal — so that copy is owned by `FunnelLanding`, which
 * remounts with the hero (see its docblock for why the scroll subscription
 * must live there). On step pages there is no hero to track, so the engine
 * renders an always-visible copy with a constant opacity.
 */
export function FunnelEngine({ slug }: { slug: FunnelSlug }) {
  const spec = getFunnel(slug)
  const engine = useFunnelEngine(spec)
  const utm = useFunnelUtm(slug)
  const reduceMotion = useReducedMotion()

  // Constant opacity for the header on step pages (no hero scroll to track).
  const stickyOpacity = useMotionValue(1)

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

  if (engine.isFirst) {
    return (
      <div data-funnel={spec.slug} className="min-h-dvh w-full">
        <FunnelLanding spec={spec} ctx={ctx} scrollToQuestionOnMount={engine.value != null}>{stepEl}</FunnelLanding>
      </div>
    )
  }

  return (
    <div data-funnel={spec.slug} className="min-h-dvh w-full">
      <FunnelStickyHeader opacity={stickyOpacity} />
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
    </div>
  )
}
