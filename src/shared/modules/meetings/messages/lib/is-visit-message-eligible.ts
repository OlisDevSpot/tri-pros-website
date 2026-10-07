import type { MeetingOutcome, MeetingType } from '@/shared/constants/enums/meetings'

import { isProjectMeeting } from '@/shared/constants/enums/meetings'

/** A decided outcome ends the texts: cancelled, no-show, and a homeowner's own request for a new time. */
export function isVisitMessageEligible(
  meeting: { meetingType: MeetingType, meetingOutcome: MeetingOutcome, scheduledFor: string },
  now: Date,
): boolean {
  return !isProjectMeeting(meeting)
    && meeting.meetingOutcome === 'not_set'
    && new Date(meeting.scheduledFor).getTime() > now.getTime()
}
