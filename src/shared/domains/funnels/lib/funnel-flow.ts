import type { FunnelStep, StepId } from '@/shared/domains/funnels/types'

/**
 * Default linear progression: the step after `currentStepId` in declaration
 * order, or null at the end. The engine uses this when a spec defines no `flow`,
 * so `steps` is the single source of truth for ordering in linear funnels.
 */
export function defaultLinearNext(steps: FunnelStep[], currentStepId: StepId): StepId | null {
  const i = steps.findIndex(s => s.id === currentStepId)
  return i >= 0 && i < steps.length - 1 ? steps[i + 1].id : null
}
