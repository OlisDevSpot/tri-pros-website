import type { StepComponent, StepKind } from '@/shared/domains/funnels/types'
import { CardSelectStepView } from '@/shared/domains/funnels/ui/steps/card-select-step'
import { InfoStepView } from '@/shared/domains/funnels/ui/steps/info-step'

export const STEP_REGISTRY: Record<StepKind, StepComponent> = {
  'info': InfoStepView as StepComponent,
  'card-select': CardSelectStepView as StepComponent,
}
