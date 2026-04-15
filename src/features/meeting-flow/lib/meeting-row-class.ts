import { MEETING_ESTIMATED_DURATION_MS } from '@/features/meeting-flow/constants/scheduling'

/**
 * Returns a background class for a meeting row based on its temporal status:
 * - Upcoming (hasn't started yet): very light yellow
 * - In progress (within estimated duration window): very light orange
 */
export function getMeetingRowClassName(row: { scheduledFor: string | null }): string | undefined {
  if (!row.scheduledFor) {
    return undefined
  }

  const now = Date.now()
  const start = new Date(row.scheduledFor).getTime()
  const end = start + MEETING_ESTIMATED_DURATION_MS

  if (now < start) {
    return 'bg-yellow-400/[0.05]'
  }

  if (now >= start && now <= end) {
    return 'bg-orange-400/[0.1]'
  }

  return undefined
}
