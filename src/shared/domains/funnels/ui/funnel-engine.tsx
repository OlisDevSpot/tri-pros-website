'use client'

import type { ComponentType } from 'react'
import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import type { FunnelContext, StepProps } from '@/shared/domains/funnels/types'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo } from 'react'
import { FUNNEL_TRANSITION, STEP_VARIANTS } from '@/shared/domains/funnels/constants/funnel-motion'
import { STEP_REGISTRY } from '@/shared/domains/funnels/constants/step-registry'
import { useFunnelEngine } from '@/shared/domains/funnels/hooks/use-funnel-engine'
import { useFunnelUtm } from '@/shared/domains/funnels/hooks/use-funnel-utm'
import { getFunnel } from '@/shared/domains/funnels/lib/registry'
import { FunnelHero } from '@/shared/domains/funnels/ui/funnel-hero'
import { FunnelProgress } from '@/shared/domains/funnels/ui/funnel-progress'

/**
 * Accepts `slug` (serializable) and resolves the spec on the client (the spec
 * contains functions and can't cross the server→client boundary).
 */
export function FunnelEngine({ slug }: { slug: FunnelSlug }) {
  const spec = getFunnel(slug)
  const engine = useFunnelEngine(spec)
  const utm = useFunnelUtm(slug)
  const reduceMotion = useReducedMotion()

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

  const showHero = engine.isFirst

  return (
    <div data-funnel={spec.slug} className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-8 px-5 py-10">
      {showHero ? null : <FunnelProgress total={spec.steps.length} currentIndex={currentIndex} />}
      {showHero ? <FunnelHero content={spec.hero} /> : null}
      <AnimatePresence mode="wait">
        <motion.div
          key={engine.step.id}
          initial={reduceMotion ? false : STEP_VARIANTS.initial}
          animate={STEP_VARIANTS.animate}
          exit={reduceMotion ? undefined : STEP_VARIANTS.exit}
          transition={FUNNEL_TRANSITION}
          className="flex-1"
        >
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
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
