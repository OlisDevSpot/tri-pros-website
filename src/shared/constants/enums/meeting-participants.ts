export const meetingParticipantRoles = ['owner', 'co_owner', 'helper'] as const
export type MeetingParticipantRole = (typeof meetingParticipantRoles)[number]
