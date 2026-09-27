import assert from 'node:assert/strict'

import { meetingMonthWindow } from '@/features/agent-dashboard/lib/meeting-windows'
import { businessMonthKey, businessMonthWindow } from '@/shared/lib/business-time'

// ── 7. Pacific months ───────────────────────────────────────────────────────
assert.equal(businessMonthKey('2026-08-01T05:30:00.000Z'), '2026-07', 'July 31 22:30 PDT is July')
assert.equal(businessMonthKey(new Date('2026-08-01T07:00:00.000Z')), '2026-08', 'Aug 1 00:00 PDT is August')
assert.deepEqual(businessMonthWindow('2026-03'), { from: '2026-03-01T08:00:00.000Z', to: '2026-04-01T07:00:00.000Z' }, 'March spans the spring-forward switch')
assert.deepEqual(businessMonthWindow('2026-11'), { from: '2026-11-01T07:00:00.000Z', to: '2026-12-01T08:00:00.000Z' }, 'November spans the fall-back switch')
assert.deepEqual(businessMonthWindow('2026-12'), { from: '2026-12-01T08:00:00.000Z', to: '2027-01-01T08:00:00.000Z' }, 'December rolls the year')
assert.deepEqual(meetingMonthWindow('2026-03-15'), businessMonthWindow('2026-03'), 'dashboard month window is the business month window')
console.log('7. Pacific months ✓')

console.log('✅ verify-analytics-rules passed')
