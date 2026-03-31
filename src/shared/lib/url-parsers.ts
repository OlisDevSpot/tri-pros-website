import { parseAsString } from 'nuqs'

export const editMeetingIdParser = parseAsString.withDefault('').withOptions({ clearOnDefault: true })

export const proposalIdParser = parseAsString.withDefault('').withOptions({ clearOnDefault: true })
