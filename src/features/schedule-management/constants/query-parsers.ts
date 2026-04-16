import { parseAsString } from 'nuqs'

export const highlightMeetingParser = parseAsString.withDefault('').withOptions({ clearOnDefault: true })
export const highlightDateParser = parseAsString.withDefault('').withOptions({ clearOnDefault: true })
