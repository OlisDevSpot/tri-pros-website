import type { inferRouterOutputs } from '@trpc/server'
import type { PresentationAgent } from '@/features/meeting-flow/types'
import type { AppRouter } from '@/trpc/routers/app'

type MeetingWithJoins = NonNullable<inferRouterOutputs<AppRouter>['meetingsRouter']['reads']['getByIdWithJoins']>

/**
 * The meeting owner as the Communication slide introduces them. Only the cropped headshot is
 * used: an account photo can be a generated letter avatar, and without a headshot the card
 * shows the brand mark instead (U10).
 */
export function toPresentationAgent(meeting: MeetingWithJoins): PresentationAgent {
  return {
    name: meeting.ownerName,
    image: meeting.ownerHeadshotUrl ?? null,
    email: meeting.ownerEmail,
    phone: meeting.ownerPhone,
    yearsOfExperience: meeting.ownerYearsOfExperience,
  }
}
