import type { Customer, Meeting } from '@/shared/db/schema'

/**
 * Counts how many context panel fields have been filled in.
 * Mirrors the field list defined in ContextPanel.
 */
export function computeContextFilledCount(meeting: Meeting, customer: Customer | null): number {
  const ctx = (meeting.contextJSON ?? {}) as Record<string, unknown>
  const customerProfile = (customer?.customerProfileJSON ?? {}) as Record<string, unknown>
  const propertyProfile = (customer?.propertyProfileJSON ?? {}) as Record<string, unknown>
  const financialProfile = (customer?.financialProfileJSON ?? {}) as Record<string, unknown>

  const situationalFields = [
    ctx.decisionMakersPresent,
    meeting.agentNotes,
  ]

  const customerProfileFields = [
    customerProfile.ageGroup,
    customerProfile.triggerEvent,
    customerProfile.outcomePriority,
    customerProfile.familyStatus,
    customerProfile.householdType,
    customerProfile.timeInHome,
    customerProfile.sellPlan,
    customerProfile.priorContractorExperience,
    customerProfile.decisionTimeline,
    customerProfile.decisionUrgencyRating,
    customerProfile.projectNecessityRating,
    customerProfile.constructionOutlookFavorabilityRating,
  ]

  const propertyFields = [
    propertyProfile.yearBuilt,
    propertyProfile.hoa,
  ]

  const financialFields = [
    financialProfile.creditScore,
    financialProfile.numQuotesReceived,
  ]

  const observationFields = [
    ctx.observedUrgency,
    ctx.observedBudgetComfort,
    ctx.spouseDynamic,
    ctx.customerDemeanor,
  ]

  const outcomeFields = [meeting.meetingOutcome]

  const allFields = [
    ...situationalFields,
    ...customerProfileFields,
    ...propertyFields,
    ...financialFields,
    ...observationFields,
    ...outcomeFields,
  ]

  return allFields.filter(v => v != null && v !== '' && !(Array.isArray(v) && v.length === 0)).length
}
