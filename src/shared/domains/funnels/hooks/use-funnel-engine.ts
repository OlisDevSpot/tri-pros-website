import type { FunnelAnswers, FunnelSpec, FunnelStep, StepId } from '@/shared/domains/funnels/types'
import { useCallback, useMemo } from 'react'
import { funnelStateKey } from '@/shared/domains/funnels/constants/storage-keys'
import { usePersistedState } from '@/shared/hooks/use-persisted-state'

interface EngineState {
  currentStepId: StepId
  history: StepId[]
  answers: FunnelAnswers
}

export interface FunnelEngine {
  step: FunnelStep
  value: string | string[] | null
  answers: FunnelAnswers
  isFirst: boolean
  setAnswer: (value: string | string[]) => void
  advance: () => void
  back: () => void
  reset: () => void
}

export function useFunnelEngine(spec: FunnelSpec): FunnelEngine {
  const initial: EngineState = {
    currentStepId: spec.steps[0].id,
    history: [],
    answers: {},
  }
  const [state, setState] = usePersistedState<EngineState>(funnelStateKey(spec.slug), initial)

  const step = useMemo(() => {
    const found = spec.steps.find(s => s.id === state.currentStepId)
    // Spec changed under a resumed state (step id removed) → restart safely.
    return found ?? spec.steps[0]
  }, [spec.steps, state.currentStepId])

  const field = step.kind === 'card-select' ? step.field : null
  const value = field ? (state.answers[field] ?? null) : null

  const setAnswer = useCallback((next: string | string[]) => {
    if (!field) {
      return
    }
    setState(prev => ({ ...prev, answers: { ...prev.answers, [field]: next } }))
  }, [field, setState])

  const advance = useCallback(() => {
    setState((prev) => {
      const nextId = spec.flow(prev.answers, prev.currentStepId)
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
    answers: state.answers,
    isFirst: state.history.length === 0,
    setAnswer,
    advance,
    back,
    reset,
  }
}
