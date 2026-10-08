/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { PWA_START_URL } from '@/shared/domains/pwa/constants/launch'
import { isPwaLaunchUrl, withoutPwaLaunchMarker } from '@/shared/domains/pwa/lib/launch-url'

const origin = 'https://www.triprosremodeling.com'

assert.equal(PWA_START_URL, '/dashboard?launch=1', 'start url shape')
assert.equal(isPwaLaunchUrl(new URL(PWA_START_URL, origin)), true, 'the start url is a launch url')
assert.equal(isPwaLaunchUrl(new URL('/dashboard', origin)), false, 'plain dashboard')
assert.equal(isPwaLaunchUrl(new URL('/dashboard?launch=2', origin)), false, 'another value')
assert.equal(isPwaLaunchUrl(new URL('/dashboard/customers?launch=1', origin)), true, 'the marker on any path')

assert.equal(
  withoutPwaLaunchMarker(new URL('/dashboard/proposals/abc?launch=1', origin)).href,
  `${origin}/dashboard/proposals/abc`,
  'marker stripped with no dangling ?',
)
assert.equal(
  withoutPwaLaunchMarker(new URL('/dashboard/schedule?launch=1&show=meetings', origin)).href,
  `${origin}/dashboard/schedule?show=meetings`,
  'other params kept',
)
const untouched = new URL('/dashboard/customers', origin)
assert.equal(withoutPwaLaunchMarker(untouched), untouched, 'an unmarked url comes back as is')

console.log('✅ pwa launch url helpers verified')
