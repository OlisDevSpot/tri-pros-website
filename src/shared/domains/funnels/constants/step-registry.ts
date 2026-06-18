import type { StepRegistry } from '@/shared/domains/funnels/types'
import { CardSelectStepView } from '@/shared/domains/funnels/ui/steps/card-select-step'
import { InfoStepView } from '@/shared/domains/funnels/ui/steps/info-step'
import { LocationStepView } from '@/shared/domains/funnels/ui/steps/location-step'
import { PiiFormStepView } from '@/shared/domains/funnels/ui/steps/pii-form-step'

/** kind → step component. Typed by StepRegistry so each slot is checked against its kind. */
export const STEP_REGISTRY: StepRegistry = {
  'info': InfoStepView,
  'card-select': CardSelectStepView,
  'location': LocationStepView,
  'pii-form': PiiFormStepView,
}
