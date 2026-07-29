import type { BaseStep, StepId } from '../types'

/** Next step id in declaration order, or null at the end. */
export function linearNext<Step extends BaseStep<string>>(
  steps: Step[],
  currentStepId: StepId,
): StepId | null {
  const i = steps.findIndex(s => s.id === currentStepId)
  return i >= 0 && i < steps.length - 1 ? steps[i + 1].id : null
}
