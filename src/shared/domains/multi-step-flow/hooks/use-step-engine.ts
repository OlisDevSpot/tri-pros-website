'use client'

import type { BaseStep, EngineState, FlowConfig, StepAnswers, StepId, StepPersistenceAdapter } from '../types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { linearNext } from '../lib/linear-next'

export interface StepEngineApi {
  step: BaseStep<string>
  value: unknown
  answers: StepAnswers
  isFirst: boolean
  hasNext: boolean
  setAnswer: (value: unknown) => void
  advance: () => void
  back: () => void
  reset: () => void
}

function computeNext<Step extends BaseStep<string>, Ctx>(
  config: FlowConfig<Step, Ctx>,
  answers: StepAnswers,
  currentStepId: StepId,
): StepId | null {
  return config.next ? config.next(answers, currentStepId) : linearNext(config.steps, currentStepId)
}

export function useStepEngine<Step extends BaseStep<string>, Ctx>(
  config: FlowConfig<Step, Ctx>,
  adapter: StepPersistenceAdapter<EngineState>,
  options?: { onNavigate?: () => void },
): StepEngineApi {
  const initial = useMemo<EngineState>(
    () => ({ currentStepId: config.steps[0]?.id ?? '', history: [], answers: {} }),
    [config.steps],
  )

  const [state, setState] = useState<EngineState>(initial)

  // Hydration gate: render `initial` on first paint (matches SSR), then adopt
  // persisted state after mount. `useHydration` lets a DB adapter defer until
  // its async load resolves; a localStorage adapter omits it (loads sync).
  const externalHydrated = adapter.useHydration?.() ?? true
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  const hydrated = mounted && externalHydrated

  useEffect(() => {
    if (!hydrated) {
      return
    }
    const loaded = adapter.load()
    if (loaded) {
      setState(loaded)
    }
    // Adopt persisted state once, when the gate opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  useEffect(() => {
    if (!hydrated) {
      return
    }
    adapter.persist(state)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, hydrated])

  const effective = hydrated ? state : initial

  // Spec-drift guard: a persisted step id no longer in the config falls back
  // to the first step.
  const step = config.steps.find(s => s.id === effective.currentStepId) ?? config.steps[0]

  const value = step ? (effective.answers[step.id] ?? null) : null
  const isFirst = effective.history.length === 0

  const nextId = step ? computeNext(config, effective.answers, step.id) : null
  const hasNext = nextId != null && nextId !== step?.id

  const setAnswer = useCallback((next: unknown) => {
    setState(prev => ({ ...prev, answers: { ...prev.answers, [prev.currentStepId]: next } }))
  }, [])

  const advance = useCallback(() => {
    setState((prev) => {
      const nid = computeNext(config, prev.answers, prev.currentStepId)
      if (nid == null || nid === prev.currentStepId) {
        return prev
      }
      return { ...prev, currentStepId: nid, history: [...prev.history, prev.currentStepId] }
    })
    options?.onNavigate?.()
  }, [config, options])

  const back = useCallback(() => {
    setState((prev) => {
      if (prev.history.length === 0) {
        return prev
      }
      const history = [...prev.history]
      const previousId = history.pop() as StepId
      return { ...prev, currentStepId: previousId, history }
    })
    options?.onNavigate?.()
  }, [options])

  const reset = useCallback(() => setState(initial), [initial])

  return {
    step: step ?? { id: '', kind: '' },
    value,
    answers: effective.answers,
    isFirst,
    hasNext,
    setAnswer,
    advance,
    back,
    reset,
  }
}
