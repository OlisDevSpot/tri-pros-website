import type { CustomerProfileMeeting } from '@/shared/entities/customers/types'

export function formatMeetingType(t: string | null): string {
  if (!t) {
    return 'Meeting'
  }
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function formatMeetingDate(d: CustomerProfileMeeting['scheduledFor']): string {
  if (!d) {
    return 'Unscheduled'
  }
  const date = new Date(d)
  return Number.isNaN(date.getTime())
    ? 'Unscheduled'
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
