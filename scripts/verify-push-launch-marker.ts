/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { buildPushPayload } from '@/shared/services/providers/web-push/lib/build-payload'
import './lib/load-env'

const marked = buildPushPayload({ title: 'Proposal signed', navigate: '/dashboard/proposals/abc?launch=1' })
assert.equal(new URL(marked.notification.navigate).search, '', 'the marker is stripped from a relative path')
assert.ok(marked.notification.navigate.endsWith('/dashboard/proposals/abc'), 'the path survives')

const kept = buildPushPayload({ title: 'Open the schedule', navigate: '/dashboard/schedule?show=meetings&launch=1' })
assert.equal(new URL(kept.notification.navigate).search, '?show=meetings', 'other params survive')

const absolute = buildPushPayload({ title: 'x', navigate: 'https://www.triprosremodeling.com/dashboard?launch=1' })
assert.equal(absolute.notification.navigate, 'https://www.triprosremodeling.com/dashboard', 'an absolute url is cleaned too')

const plain = buildPushPayload({ title: 'x', navigate: '/dashboard/customers' })
assert.ok(plain.notification.navigate.endsWith('/dashboard/customers'), 'an unmarked path is untouched')

console.log('✅ push payloads never carry the launch marker')
