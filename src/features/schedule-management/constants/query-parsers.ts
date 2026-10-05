import { parseAsString, parseAsStringLiteral } from 'nuqs/server'

import { SCHEDULE_SHOW_VALUES } from '@/features/schedule-management/constants/schedule-queries'

export const highlightMeetingParser = parseAsString.withDefault('').withOptions({ clearOnDefault: true })

// Unprefixed on purpose: `show` picks which prefixed config (`s_…`) applies.
export const scheduleShowParser = parseAsStringLiteral(SCHEDULE_SHOW_VALUES).withDefault('meetings').withOptions({ clearOnDefault: true })
