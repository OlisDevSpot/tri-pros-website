import type { CustomerProfile, FinancialProfile, PropertyProfile } from '@/shared/entities/customers/schemas'
import type { MeetingContext, MeetingFlowState } from '@/shared/entities/meetings/schemas'

export type JsonbSection
  = | 'customerProfileJSON'
    | 'financialProfileJSON'
    | 'propertyProfileJSON'
    | 'contextJSON'
    | 'flowStateJSON'

export interface JsonbSectionMap {
  customerProfileJSON: CustomerProfile
  financialProfileJSON: FinancialProfile
  propertyProfileJSON: PropertyProfile
  contextJSON: MeetingContext
  flowStateJSON: MeetingFlowState
}
