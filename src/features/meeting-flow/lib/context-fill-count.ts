import type { Customer, Meeting } from '@/shared/db/schema'
import type { ProfileFieldConfig } from '@/shared/entities/customers/types'

import { CUSTOMER_PROFILE_FIELDS } from '@/shared/entities/customers/constants/customer-profile-fields'
import { FINANCIAL_PROFILE_FIELDS } from '@/shared/entities/customers/constants/financial-profile-fields'
import { PROPERTY_PROFILE_FIELDS } from '@/shared/entities/customers/constants/property-profile-fields'

// Meeting-specific fields not derived from customer profile definitions
const SITUATIONAL_FIELD_COUNT = 2 // decisionMakersPresent, agentNotes
const OBSERVATION_FIELD_COUNT = 4 // observedUrgency, observedBudgetComfort, spouseDynamic, customerDemeanor
const OUTCOME_FIELD_COUNT = 1 // meetingOutcome

function isFilled(value: unknown): boolean {
  if (value === undefined || value === null || value === '') {
    return false
  }
  if (Array.isArray(value)) {
    return value.length > 0
  }
  return true
}

function countFilledFromFields(
  fields: ProfileFieldConfig[],
  data: Record<string, unknown>,
): number {
  return fields.filter(f => isFilled(data[f.id])).length
}

/**
 * Total number of context panel fields across all sections.
 * Derived from shared field definitions + meeting-specific field counts.
 */
export const CONTEXT_TOTAL_FIELDS
  = SITUATIONAL_FIELD_COUNT
    + CUSTOMER_PROFILE_FIELDS.length
    + PROPERTY_PROFILE_FIELDS.length
    + FINANCIAL_PROFILE_FIELDS.length
    + OBSERVATION_FIELD_COUNT
    + OUTCOME_FIELD_COUNT

/**
 * Counts how many context panel fields have been filled in.
 * Uses shared field definitions for customer profile sections.
 */
export function computeContextFilledCount(meeting: Meeting, customer: Customer | null): number {
  const ctx = (meeting.contextJSON ?? {}) as Record<string, unknown>
  const customerProfile = (customer?.customerProfileJSON ?? {}) as Record<string, unknown>
  const propertyProfile = (customer?.propertyProfileJSON ?? {}) as Record<string, unknown>
  const financialProfile = (customer?.financialProfileJSON ?? {}) as Record<string, unknown>

  // Meeting-specific fields (not derived from shared definitions)
  const situationalFilled = [ctx.decisionMakersPresent, meeting.agentNotes].filter(isFilled).length
  const observationFilled = [
    ctx.observedUrgency,
    ctx.observedBudgetComfort,
    ctx.spouseDynamic,
    ctx.customerDemeanor,
  ].filter(isFilled).length
  const outcomeFilled = [meeting.meetingOutcome].filter(isFilled).length

  // Customer profile fields (derived from shared definitions)
  const customerProfileFilled = countFilledFromFields(CUSTOMER_PROFILE_FIELDS, customerProfile)
  const propertyFilled = countFilledFromFields(PROPERTY_PROFILE_FIELDS, propertyProfile)
  const financialFilled = countFilledFromFields(FINANCIAL_PROFILE_FIELDS, financialProfile)

  return situationalFilled
    + customerProfileFilled
    + propertyFilled
    + financialFilled
    + observationFilled
    + outcomeFilled
}
