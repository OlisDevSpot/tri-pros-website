import assert from 'node:assert/strict'

import { formatBusinessWeekday, formatBusinessWeekdayTime } from '@/shared/lib/business-time'

assert.equal(formatBusinessWeekday('2026-10-09T16:00:00.000Z'), 'Fri')
assert.equal(formatBusinessWeekdayTime('2026-10-10T18:09:00.000Z'), 'Sat 11:09 AM')
// 01:00 UTC on Monday is still Sunday evening in Los Angeles.
assert.equal(formatBusinessWeekdayTime('2026-10-12T01:00:00.000Z'), 'Sun 6:00 PM')
assert.doesNotMatch(formatBusinessWeekdayTime(new Date()), /[\u202F\xA0]/)

console.log('✅ business-time weekday formatters verified')
