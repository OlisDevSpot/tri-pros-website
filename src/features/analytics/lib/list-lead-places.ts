import type { LeadRecordSet } from '@/features/analytics/types'

/** Filter choices come from the leads' own anchors, so every choice matches at least one lead. */
export function listLeadPlaces(records: LeadRecordSet): { cities: string[], zips: string[] } {
  const cities = new Set<string>()
  const zips = new Set<string>()
  for (const lead of records.leads) {
    if (lead.city !== null) {
      cities.add(lead.city)
    }
    if (lead.zip !== null) {
      zips.add(lead.zip)
    }
  }
  return { cities: [...cities].sort(), zips: [...zips].sort() }
}
