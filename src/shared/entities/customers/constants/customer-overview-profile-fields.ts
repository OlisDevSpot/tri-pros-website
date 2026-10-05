import type { ProfileFieldConfig } from '@/shared/entities/customers/types'

import { CUSTOMER_PROFILE_FIELDS } from '@/shared/entities/customers/constants/customer-profile-fields'

// CustomerProfileKeyInsights already shows these as badges.
const KEY_INSIGHT_FIELD_IDS = new Set(['triggerEvent', 'decisionTimeline', 'outcomePriority', 'householdType'])

export const CUSTOMER_OVERVIEW_PROFILE_FIELDS: ProfileFieldConfig[] = CUSTOMER_PROFILE_FIELDS.filter(
  field => !KEY_INSIGHT_FIELD_IDS.has(field.id),
)
