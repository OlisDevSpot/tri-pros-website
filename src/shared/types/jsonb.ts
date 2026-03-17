import type { CustomerProfile, FinancialProfile, PropertyProfile } from '@/shared/entities/customers/schemas'
import type { ProgramData, SituationProfile } from '@/shared/entities/meetings/schemas'

export type JsonbSection
  = | 'customerProfileJSON'
    | 'financialProfileJSON'
    | 'programDataJSON'
    | 'propertyProfileJSON'
    | 'situationProfileJSON'

export interface JsonbSectionMap {
  customerProfileJSON: CustomerProfile
  financialProfileJSON: FinancialProfile
  propertyProfileJSON: PropertyProfile
  situationProfileJSON: SituationProfile
  programDataJSON: ProgramData
}
