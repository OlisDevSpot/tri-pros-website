import type { AnswerValue, FunnelAnswers, FunnelSpec, FunnelStep, StepId } from '@/shared/domains/funnels/types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { funnelStateKey } from '@/shared/domains/funnels/constants/storage-keys'
import { defaultLinearNext } from '@/shared/domains/funnels/lib/funnel-flow'
import { usePersistedState } from '@/shared/hooks/use-persisted-state'

interface EngineState {
  currentStepId: StepId
  history: StepId[]
  answers: FunnelAnswers
}

export interface FunnelEngineApi {
  step: FunnelStep
  value: AnswerValue
  answers: FunnelAnswers
  isFirst: boolean
  setAnswer: (value: string | string[]) => void
  advance: () => void
  back: () => void
  reset: () => void
}

export function useFunnelEngine(spec: FunnelSpec): FunnelEngineApi {
  const initial = useMemo<EngineState>(() => ({
    currentStepId: spec.steps[0].id,
    history: [],
    answers: {},
  }), [spec.steps])
  const [state, setState] = usePersistedState<EngineState>(funnelStateKey(spec.slug), initial)

  // Hydration gate: use the default initial state on first render (matching SSR),
  // then switch to persisted state after mount so both renders agree on step[0].
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    setHydrated(true)
  }, [])
  const effective = hydrated ? state : initial

  const step = useMemo(() => {
    const found = spec.steps.find(s => s.id === effective.currentStepId)
    // Spec changed under a resumed state (step id removed) → restart safely.
    return found ?? spec.steps[0]
  }, [spec.steps, effective.currentStepId])

  const field = step.kind === 'card-select' ? step.field : null
  const value = field ? (effective.answers[field] ?? null) : null

  const setAnswer = useCallback((next: string | string[]) => {
    if (!field) {
      return
    }
    setState(prev => ({ ...prev, answers: { ...prev.answers, [field]: next } }))
  }, [field, setState])

  const advance = useCallback(() => {
    setState((prev) => {
      const nextId = spec.flow
        ? spec.flow(prev.answers, prev.currentStepId)
        : defaultLinearNext(spec.steps, prev.currentStepId)
      if (!nextId || nextId === prev.currentStepId) {
        return prev
      }
      return { ...prev, currentStepId: nextId, history: [...prev.history, prev.currentStepId] }
    })
  }, [spec, setState])

  const back = useCallback(() => {
    setState((prev) => {
      if (prev.history.length === 0) {
        return prev
      }
      const history = [...prev.history]
      const previousId = history.pop() as StepId
      return { ...prev, currentStepId: previousId, history }
    })
  }, [setState])

  const reset = useCallback(() => setState(initial), [setState, initial])

  return {
    step,
    value,
    answers: effective.answers,
    isFirst: effective.history.length === 0,
    setAnswer,
    advance,
    back,
    reset,
  }
}
