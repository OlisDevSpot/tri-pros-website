import type { StepRegistry } from '@/shared/domains/funnels/types'
import { AddressStepView } from '@/shared/domains/funnels/ui/steps/address-step'
import { CardSelectStepView } from '@/shared/domains/funnels/ui/steps/card-select-step'
import { ConfirmationStepView } from '@/shared/domains/funnels/ui/steps/confirmation-step'
import { PiiFormStepView } from '@/shared/domains/funnels/ui/steps/pii-form-step'
import { ZipStepView } from '@/shared/domains/funnels/ui/steps/zip-step'

/** kind → step component. Typed by StepRegistry so each slot is checked against its kind. */
export const STEP_REGISTRY: StepRegistry = {
  'address': AddressStepView,
  'card-select': CardSelectStepView,
  'confirmation': ConfirmationStepView,
  'pii-form': PiiFormStepView,
  'zip': ZipStepView,
}
