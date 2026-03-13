import { parseAsString, parseAsStringLiteral } from 'nuqs'

export const meetingsDashboardStepParser = parseAsStringLiteral(['past-meetings', 'create-meeting', 'edit-meeting'] as const)
  .withDefault('past-meetings')
  .withOptions({ clearOnDefault: false })

export const meetingIdParser = parseAsString.withDefault('').withOptions({ clearOnDefault: true })

export const editMeetingIdParser = parseAsString.withDefault('').withOptions({ clearOnDefault: true })
