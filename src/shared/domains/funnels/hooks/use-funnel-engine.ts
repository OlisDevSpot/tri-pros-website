import type { AnswerValue, FunnelAnswers, FunnelSpec, FunnelStep, StepId } from '@/shared/domains/funnels/types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { funnelStateKey } from '@/shared/domains/funnels/constants/storage-keys'
import { defaultLinearNext } from '@/shared/domains/funnels/lib/funnel-flow'
import { scrollFunnelToTop } from '@/shared/domains/funnels/lib/scroll-funnel-to-top'
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
  hasNext: boolean
  setAnswer: (value: AnswerValue) => void
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

  // Hydration gate: render the default initial state on first client paint
  // (matching SSR), then switch to persisted state after mount.
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

  // One typed slot per step, keyed by step id (no `field`).
  const value = effective.answers[step.id] ?? null

  const setAnswer = useCallback((next: AnswerValue) => {
    setState(prev => ({ ...prev, answers: { ...prev.answers, [step.id]: next } }))
  }, [step.id, setState])

  // `advance` / `back` carry a coupled side-effect: every move resets the page
  // scroll to the top (see ../lib/scroll-funnel-to-top). Written here at the
  // source — not at the call sites — so the Next/Back buttons, card-select / ZIP
  // auto-advances, and the hero's Q1 all inherit it. The landing's own on-mount
  // scroll (FunnelLanding `scrollToQuestionOnMount`) runs after a Back-return and
  // settles on the question, so this never fights it.
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
    scrollFunnelToTop()
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
    scrollFunnelToTop()
  }, [setState])

  const reset = useCallback(() => setState(initial), [setState, initial])

  const nextId = spec.flow
    ? spec.flow(effective.answers, step.id)
    : defaultLinearNext(spec.steps, step.id)
  const hasNext = nextId != null && nextId !== step.id

  return {
    step,
    value,
    answers: effective.answers,
    isFirst: effective.history.length === 0,
    hasNext,
    setAnswer,
    advance,
    back,
    reset,
  }
}
