'use client'

import type { FunnelSpec } from '@/shared/domains/funnels/types'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useFunnelEngine } from '@/shared/domains/funnels/hooks/use-funnel-engine'
import { FUNNEL_TRANSITION, STEP_VARIANTS } from '@/shared/domains/funnels/lib/funnel-motion'
import { STEP_REGISTRY } from '@/shared/domains/funnels/lib/step-registry'
import { FunnelProgress } from '@/shared/domains/funnels/ui/funnel-progress'

export function FunnelEngine({ spec }: { spec: FunnelSpec }) {
  const engine = useFunnelEngine(spec)
  const reduceMotion = useReducedMotion()

  const StepView = STEP_REGISTRY[engine.step.kind]
  // undefined for the hero (uses funnelContent)
  const stepContent = spec.content.steps[engine.step.id]
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
