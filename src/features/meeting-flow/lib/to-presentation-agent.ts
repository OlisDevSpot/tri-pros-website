import type { inferRouterOutputs } from '@trpc/server'
import type { PresentationAgent } from '@/features/meeting-flow/types'
import type { AppRouter } from '@/trpc/routers/app'

type MeetingWithJoins = NonNullable<inferRouterOutputs<AppRouter>['meetingsRouter']['reads']['getByIdWithJoins']>

/** The meeting owner as the Communication slide introduces them; the cropped headshot wins over the account photo. */
export function toPresentationAgent(meeting: MeetingWithJoins): PresentationAgent {
  return {
    name: meeting.ownerName,
    image: meeting.ownerHeadshotUrl ?? meeting.ownerImage,
    email: meeting.ownerEmail,
    phone: meeting.ownerPhone,
    yearsOfExperience: meeting.ownerYearsOfExperience,
  }
}
