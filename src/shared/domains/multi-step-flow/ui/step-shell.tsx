'use client'

import type { ComponentType, ReactNode } from 'react'
import type { StepEngineApi } from '../hooks/use-step-engine'
import type { BaseStep, FlowConfig, StepProps, StepRegistry } from '../types'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { QUESTION_MAX_W, RAIL_MAX_W } from '../constants/layout'
import { STEP_TRANSITION, STEP_VARIANTS } from '../constants/step-motion'
import { StepProgress } from './step-progress'

export interface StepShellProps<Step extends BaseStep<string>, Ctx> {
  engine: StepEngineApi
  config: FlowConfig<Step, Ctx>
  ctx: Ctx
  registry: StepRegistry<string>
  /** Engine-specific chrome slots. All optional; absent slots render nothing. */
  landing?: ReactNode
  terminal?: ReactNode
  header?: ReactNode
  footer?: ReactNode
  background?: ReactNode
  /** Optional per-step wrapper (e.g. question-column chrome). */
  renderStep?: (node: ReactNode, step: BaseStep<string>) => ReactNode
  /** Label overrides for nav buttons. */
  backLabel?: string
  nextLabel?: string
}

export function StepShell<Step extends BaseStep<string>, Ctx>({
  engine,
  config,
  ctx,
  registry,
  landing,
  terminal,
  header,
  footer,
  background,
  renderStep,
  backLabel = 'Back',
  nextLabel = 'Next',
}: StepShellProps<Step, Ctx>) {
  const landingId = config.landingStepId ?? config.steps[0]?.id
  const isLanding = engine.isFirst && engine.step.id === landingId
  const isTerminal = (config.terminalKinds ?? []).includes(engine.step.kind)
  const view: 'landing' | 'steps' | 'terminal' = isLanding ? 'landing' : isTerminal ? 'terminal' : 'steps'

  // The one documented widening at the dispatch seam.
  const StepView = registry[engine.step.kind] as ComponentType<StepProps<any, any, any>>
  const content = (engine.step as { content?: unknown }).content ?? null

  const stepNode: ReactNode = (
    <StepView
      advance={engine.advance}
      answers={engine.answers}
      back={engine.back}
      content={content}
      ctx={ctx}
      isAnswered={engine.value != null}
      isFirst={engine.isFirst}
      setValue={engine.setAnswer}
      step={engine.step}
      value={engine.value}
    />
  )
  const stepEl = renderStep ? renderStep(stepNode, engine.step) : stepNode

  const currentIndex = config.steps.findIndex(s => s.id === engine.step.id)

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={view}
        animate={{ opacity: 1 }}
        className="relative min-h-dvh w-full"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        transition={STEP_TRANSITION}
      >
        {background}

        {view === 'landing' && (landing ?? stepEl)}

        {view === 'terminal' && (
          <div className={cn('mx-auto w-full px-4', RAIL_MAX_W)}>
            {header}
            {terminal ?? stepEl}
            {footer}
          </div>
        )}

        {view === 'steps' && (
          <div className={cn('mx-auto flex min-h-dvh w-full flex-col px-4', RAIL_MAX_W)}>
            {header}
            <StepProgress currentIndex={currentIndex} total={config.steps.length} />

            <div className="min-h-0 flex-1 overflow-y-auto py-6">
              <div className={cn('mx-auto w-full', QUESTION_MAX_W)}>
                <AnimatePresence initial={false} mode="wait">
                  <motion.div
                    key={engine.step.id}
                    animate="animate"
                    exit="exit"
                    initial="initial"
                    transition={STEP_TRANSITION}
                    variants={STEP_VARIANTS}
                  >
                    {stepEl}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="flex items-center justify-between py-4">
              <Button disabled={engine.isFirst} variant="outline" onClick={engine.back}>
                {backLabel}
              </Button>
              <Button disabled={!engine.hasNext || engine.value == null} onClick={engine.advance}>
                {nextLabel}
              </Button>
            </div>

            {footer}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
