'use client'

import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import type { StepComponent } from '@/shared/domains/funnels/types'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { FUNNEL_TRANSITION, STEP_VARIANTS } from '@/shared/domains/funnels/constants/funnel-motion'
import { STEP_REGISTRY } from '@/shared/domains/funnels/constants/step-registry'
import { useFunnelEngine } from '@/shared/domains/funnels/hooks/use-funnel-engine'
import { getFunnel } from '@/shared/domains/funnels/lib/registry'
import { FunnelProgress } from '@/shared/domains/funnels/ui/funnel-progress'

/**
 * Accepts `slug` (a serializable string) rather than `spec` (which contains
 * functions and cannot cross the server→client boundary). Resolves the spec
 * from the registry on the client, keeping the engine fully client-side.
 */
export function FunnelEngine({ slug }: { slug: FunnelSlug }) {
  const spec = getFunnel(slug)
  const engine = useFunnelEngine(spec)
  const reduceMotion = useReducedMotion()

  // Single narrowing seam: the registry is fully typed per kind, but indexing by
  // a union `kind` widens the lookup — re-narrow here at the one dispatch point.
  const StepView = STEP_REGISTRY[engine.step.kind] as StepComponent
  // undefined for the hero (uses funnelContent)
  const stepContent = spec.content.copy[engine.step.id]
  const currentIndex = spec.steps.findIndex(s => s.id === engine.step.id)

  // `data-funnel` is stamped for later per-trade theming (Plan 5); the 2a
  // engine uses the brand default tokens and injects no custom colors
  // (FunnelTheme is just `{ accent: string }` today).
  return (
    <div data-funnel={spec.slug} className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-8 px-5 py-10">
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
          <StepView
            step={engine.step}
            funnelContent={spec.content}
            content={stepContent}
            value={engine.value}
            onChange={engine.setAnswer}
            onAdvance={engine.advance}
            onBack={engine.back}
            isFirst={engine.isFirst}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
