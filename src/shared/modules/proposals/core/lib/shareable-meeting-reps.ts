import type { MeetingRep } from '@/shared/modules/meetings/core/types'

/** The homeowner met these reps; these four fields are all that leave to a share link, whatever the read carried. */
export function toShareableMeetingReps(reps: MeetingRep[]): MeetingRep[] {
  return reps.map(({ name, email, phone, headshotUrl }) => ({ name, email, phone, headshotUrl }))
}
