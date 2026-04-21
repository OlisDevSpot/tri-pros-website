/**
 * @deprecated Lead sources are now managed via the `lead_sources` table + `customers.leadSourceId` FK.
 * This const is kept only to keep the legacy `lead_source` pgEnum column alive during the dual-column
 * migration; it will be removed in the follow-up PR that drops the column.
 */
export const leadSources = [
  'telemarketing_leads_philippines',
  'noy',
  'quoteme',
  'other',
] as const
export type LeadSource = (typeof leadSources)[number]

export const leadTypes = [
  'appointment_set', // contact comes in with a meeting already scheduled
  'needs_confirmation', // lead captured, meeting not yet confirmed
  'manual', // manually added by an agent
] as const
export type LeadType = (typeof leadTypes)[number]

export const intakeModes = [
  'customer_only', // create customer record only
  'customer_and_meeting', // create customer + meeting scheduling fields
] as const
export type IntakeMode = (typeof intakeModes)[number]
