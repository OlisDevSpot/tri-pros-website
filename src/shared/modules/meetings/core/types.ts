/** The owner and co-owner of a meeting, as a proposal shows them; these four fields are all that leave to a share link. */
export interface MeetingRep {
  name: string
  email: string
  phone: string | null
  headshotUrl: string | null
}
