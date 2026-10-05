/**
 * LA-timezone short meeting date (MM/DD) — the single source for meeting-note
 * dates. Both the outcome note and the reschedule note format dates through
 * this so the business timezone lives in exactly one place.
 */
export function formatMeetingDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Los_Angeles',
  })
}

/** Customer-note body for a reschedule (original → cancelled, new meeting booked). */
export function buildRescheduleNote(oldIso: string, newIso: string, reason: string): string {
  return `${formatMeetingDateShort(oldIso)} meeting rescheduled to ${formatMeetingDateShort(newIso)}:\n${reason}`
}
