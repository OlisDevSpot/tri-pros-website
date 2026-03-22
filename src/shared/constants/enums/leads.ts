export const leadSources = [
  'telemarketing_leads_philippines',
  'noy',
  'quoteme',
  'other',
] as const

export const leadTypes = [
  'appointment_set', // contact comes in with a meeting already scheduled
  'needs_confirmation', // lead captured, meeting not yet confirmed
  'manual', // manually added by an agent
] as const
