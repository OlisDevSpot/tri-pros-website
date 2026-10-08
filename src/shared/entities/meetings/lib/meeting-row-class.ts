import { MEETING_ESTIMATED_DURATION_MS } from '@/shared/entities/meetings/constants/scheduling'

/**
 * Returns a background class for a meeting row based on its temporal status:
 * - Upcoming (hasn't started yet): pending tint
 * - In progress (within estimated duration window): attention tint
 */
export function getMeetingRowClassName(row: { scheduledFor: string | null }): string | undefined {
  if (!row.scheduledFor) {
    return undefined
  }

  const now = Date.now()
  const start = new Date(row.scheduledFor).getTime()
  const end = start + MEETING_ESTIMATED_DURATION_MS

  if (now < start) {
    return 'bg-status-pending-bg'
  }

  if (now >= start && now <= end) {
    return 'bg-status-attention-bg'
  }

  return undefined
}
