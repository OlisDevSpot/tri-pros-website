import { formatDistanceToNow } from 'date-fns'

export interface MeetingTimeLabel {
  text: string
  variant: 'active' | 'upcoming' | 'past'
}

export function getMeetingTimeLabel(nextMeetingAt: string | null): MeetingTimeLabel | null {
  if (!nextMeetingAt) {
    return null
  }

  const meetingDate = new Date(nextMeetingAt)
  const now = new Date()
  const diffMs = meetingDate.getTime() - now.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)

  if (diffHours <= 0 && diffHours > -2) {
    return { text: 'Meeting in progress', variant: 'active' }
  }

  if (diffHours <= -2) {
    return { text: formatDistanceToNow(meetingDate, { addSuffix: true }), variant: 'past' }
  }

  return { text: formatDistanceToNow(meetingDate, { addSuffix: true }), variant: 'upcoming' }
}
