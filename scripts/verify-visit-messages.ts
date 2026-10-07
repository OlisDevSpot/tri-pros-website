import assert from 'node:assert/strict'

import type { MergeToken } from '@/shared/services/voip/lib/sms-merge-template'

import { ROOTS } from '@/shared/config/roots'
import { businessDateTime, formatBusinessClock, formatBusinessDay, formatBusinessDayTime } from '@/shared/lib/business-time'
import { buildIcs } from '@/shared/modules/meetings/messages/lib/build-ics'
import { formatArrivalWindow } from '@/shared/modules/meetings/core/lib/arrival-window'
import { applyDevRecipientOverride } from '@/shared/services/providers/resend/lib/dev-recipients'
import { listMergeTokens, renderMergeSample, renderMergeTemplate } from '@/shared/services/voip/lib/sms-merge-template'
import { countSmsSegments, findNonGsm7 } from '@/shared/services/voip/lib/sms-segments'

{
  const payload = {
    to: ['maria@example.com', 'sam@example.com'],
    cc: 'office@example.com',
    bcc: ['audit@example.com'],
    subject: 'Your proposal is ready',
    html: '<p>hi</p>',
  }
  assert.deepEqual(applyDevRecipientOverride(payload, { isProduction: true, override: undefined }), payload, 'production sends exactly what it was given')

  const guarded = applyDevRecipientOverride(payload, { isProduction: false, override: 'owner@example.com' })
  assert.equal(guarded.to, 'owner@example.com', 'outside production the only recipient is the override')
  assert.equal(guarded.cc, undefined, 'cc is dropped: a copy would still reach a real inbox')
  assert.equal(guarded.bcc, undefined, 'bcc is dropped too')
  assert.equal(guarded.subject, '[to maria@example.com, sam@example.com] Your proposal is ready', 'the subject names who it was for')
  assert.equal(guarded.html, '<p>hi</p>', 'the body is untouched')

  assert.throws(
    () => applyDevRecipientOverride(payload, { isProduction: false, override: undefined }),
    /EMAIL_DEV_OVERRIDE/,
    'no override outside production means no send',
  )

  const templated = applyDevRecipientOverride(
    { to: 'a@example.com', cc: 'b@example.com', bcc: 'c@example.com', subject: undefined, template: { id: 't' } },
    { isProduction: false, override: 'owner@example.com' },
  )
  assert.equal(templated.to, 'owner@example.com', 'a template email is rerouted too')
  assert.equal(templated.subject, undefined, 'a template email keeps the subject it does not have')
  assert.equal(templated.cc, undefined, 'template email cc is dropped')
  assert.equal(templated.bcc, undefined, 'template email bcc is dropped')
}
console.log('1. Dev email recipients ✓')

{
  const tokens: MergeToken<{ name: string }>[] = [
    { token: 'first_name', label: 'First name', sample: 'Maria', resolve: vars => vars.name },
  ]
  assert.equal(renderMergeTemplate('Hi {{first_name}}, {{ first_name }}!', tokens, { name: 'Sam' }), 'Hi Sam, Sam!', 'spaces inside the braces are allowed')
  assert.equal(renderMergeTemplate('Hi {{nope}}', tokens, { name: 'Sam' }), 'Hi {{nope}}', 'an unknown token stays as typed')
  assert.equal(renderMergeSample('Hi {{first_name}}', tokens), 'Hi Maria', 'samples stand in for values')
  assert.deepEqual(listMergeTokens('{{a}} {{b}} {{a}}'), ['a', 'b'], 'token names, in order, once each')

  assert.deepEqual(countSmsSegments(''), { chars: 0, segments: 0, encoding: 'gsm7' })
  assert.deepEqual(countSmsSegments('a'.repeat(160)), { chars: 160, segments: 1, encoding: 'gsm7' })
  assert.deepEqual(countSmsSegments('a'.repeat(161)), { chars: 161, segments: 2, encoding: 'gsm7' })
  assert.deepEqual(countSmsSegments('a'.repeat(306)), { chars: 306, segments: 2, encoding: 'gsm7' })
  assert.deepEqual(countSmsSegments('a'.repeat(307)), { chars: 307, segments: 3, encoding: 'gsm7' })
  assert.deepEqual(countSmsSegments('[ok]'), { chars: 6, segments: 1, encoding: 'gsm7' }, 'extension characters count twice')
  assert.deepEqual(countSmsSegments('’'.repeat(70)), { chars: 70, segments: 1, encoding: 'ucs2' }, 'a curly apostrophe switches the whole text to UCS-2')
  assert.deepEqual(countSmsSegments('’'.repeat(71)), { chars: 71, segments: 2, encoding: 'ucs2' })
  assert.equal(countSmsSegments('10:00\u202FAM').encoding, 'ucs2', 'the narrow no-break space Intl prints before AM is not GSM-7')
  assert.deepEqual(findNonGsm7('Hi “Maria” — ok \u{1F600}'), ['“', '”', '—', '\u{1F600}'], 'each offending character, once, in order')
}
console.log('2. SMS templates and segments ✓')

{
  assert.equal(formatBusinessDay('2026-10-07T17:00:00.000Z'), 'Wed, Oct 7')
  assert.equal(formatBusinessClock('2026-10-07T17:00:00.000Z'), '10:00 AM')
  assert.equal(formatBusinessDayTime('2026-10-07T17:00:00.000Z'), 'Wed, Oct 7, 10:00 AM')
  assert.equal(formatBusinessClock('2026-10-07 17:00:00+00'), '10:00 AM', 'the spelling Postgres hands back is the same instant')
  assert.equal(countSmsSegments(formatBusinessDayTime('2026-10-07T17:00:00.000Z')).encoding, 'gsm7', 'no narrow no-break space survives')

  // 10:00 AM local on the days around both 2026 clock changes (Mar 8, Nov 1).
  assert.equal(formatBusinessClock('2026-03-07T18:00:00.000Z'), '10:00 AM')
  assert.equal(formatBusinessClock('2026-03-08T17:00:00.000Z'), '10:00 AM')
  assert.equal(formatBusinessClock('2026-10-31T17:00:00.000Z'), '10:00 AM')
  assert.equal(formatBusinessClock('2026-11-01T18:00:00.000Z'), '10:00 AM')

  assert.equal(businessDateTime('2026-10-08', 18, 0).toISOString(), '2026-10-09T01:00:00.000Z')
  assert.equal(businessDateTime('2026-10-09', 0, 0).toISOString(), '2026-10-09T07:00:00.000Z')
  assert.equal(businessDateTime('2026-03-08', 8, 30).toISOString(), '2026-03-08T15:30:00.000Z', '8:30 AM on the spring-forward day')
  assert.equal(businessDateTime('2026-03-08', 18, 0).toISOString(), '2026-03-09T01:00:00.000Z', '6 PM on the spring-forward day')
  assert.equal(businessDateTime('2026-11-01', 8, 30).toISOString(), '2026-11-01T16:30:00.000Z', '8:30 AM on the fall-back day')
  assert.equal(businessDateTime('2026-11-01', 18, 0).toISOString(), '2026-11-02T02:00:00.000Z', '6 PM on the fall-back day')

  assert.equal(formatArrivalWindow('2026-10-07T17:00:00.000Z'), '10:00 and 10:30 AM')
  assert.equal(formatArrivalWindow('2026-10-07T18:45:00.000Z'), '11:45 AM and 12:15 PM', 'a window that crosses noon names both halves')
}
console.log('3. Pacific time text ✓')

{
  const event = {
    prodId: '-//Example Co//Home Visit//EN',
    uid: 'meeting-1@example.com',
    start: '2026-10-07T17:00:00.000Z',
    durationMs: 2 * 60 * 60 * 1000,
    summary: 'Home visit with Oliver; bring questions',
    description: 'Line one\nLine two',
    location: '123 Main St, Pasadena, CA 91101',
    url: 'https://example.com/home-visits/meeting-1?token=abc',
    organizer: { name: 'Example Co', email: 'info@example.com' },
    attendee: { name: 'Lopez, Maria', email: 'maria@example.com' },
    now: new Date('2026-10-05T16:00:00.000Z'),
  }
  const invite = buildIcs({ ...event, method: 'REQUEST', sequence: 0 })
  assert.ok(invite.endsWith('\r\n'), 'lines end in CRLF')
  assert.ok(invite.split('\r\n').every(line => new TextEncoder().encode(line).length <= 75), 'no line is longer than 75 octets')

  const lines = invite.replace(/\r\n /g, '').split('\r\n')
  assert.equal(lines[0], 'BEGIN:VCALENDAR')
  assert.ok(lines.includes('METHOD:REQUEST'))
  assert.ok(lines.includes('UID:meeting-1@example.com'))
  assert.ok(lines.includes('SEQUENCE:0'))
  assert.ok(lines.includes('DTSTAMP:20261005T160000Z'))
  assert.ok(lines.includes('DTSTART:20261007T170000Z'))
  assert.ok(lines.includes('DTEND:20261007T190000Z'))
  assert.ok(lines.includes('SUMMARY:Home visit with Oliver\\; bring questions'), 'semicolons are escaped')
  assert.ok(lines.includes('DESCRIPTION:Line one\\nLine two'), 'newlines are escaped')
  assert.ok(lines.includes('LOCATION:123 Main St\\, Pasadena\\, CA 91101'), 'commas are escaped')
  assert.ok(lines.includes('ORGANIZER;CN=Example Co:mailto:info@example.com'))
  assert.ok(lines.includes('ATTENDEE;CN="Lopez, Maria";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:maria@example.com'), 'a name with a comma is quoted')
  assert.ok(lines.includes('STATUS:CONFIRMED'))

  const cancellation = buildIcs({ ...event, method: 'CANCEL', sequence: 3 }).replace(/\r\n /g, '').split('\r\n')
  assert.ok(cancellation.includes('METHOD:CANCEL'))
  assert.ok(cancellation.includes('UID:meeting-1@example.com'), 'a cancellation names the same event')
  assert.ok(cancellation.includes('SEQUENCE:3'))
  assert.ok(cancellation.includes('STATUS:CANCELLED'))

  const injectionEvent = buildIcs({
    ...event,
    method: 'REQUEST',
    sequence: 0,
    attendee: { name: 'Maria\r\nATTENDEE;CN=x:mailto:evil@x.com', email: 'maria@example.com' },
    description: 'a\rb',
  }).replace(/\r\n /g, '').split('\r\n')
  const attendeeLines = injectionEvent.filter(line => line.startsWith('ATTENDEE'))
  assert.equal(attendeeLines.length, 1, 'exactly one line starts with ATTENDEE')
  assert.ok(!injectionEvent.some(line => line === 'ATTENDEE;CN=x:mailto:evil@x.com'), 'no line contains the injected property')
  assert.ok(injectionEvent.includes('DESCRIPTION:a\\nb'), 'lone CR is escaped to newline escape')

  const multibyteEvent = buildIcs({
    ...event,
    method: 'REQUEST',
    sequence: 0,
    summary: 'é'.repeat(60),
  })
  const byteLines = multibyteEvent.split('\r\n')
  assert.ok(byteLines.every(line => Buffer.byteLength(line, 'utf8') <= 75), 'every physical line is at most 75 octets')
  const unfoldedMultibyte = multibyteEvent.replace(/\r\n /g, '').split('\r\n')
  assert.ok(unfoldedMultibyte.includes('SUMMARY:' + 'é'.repeat(60)), 'unfolded SUMMARY line contains all 60 multibyte characters')
}
console.log('4. Calendar invite ✓')

{
  assert.equal(ROOTS.public.homeVisit('m-1', 'tok'), '/home-visits/m-1?token=tok')
  assert.equal(ROOTS.public.homeVisit('m-1'), '/home-visits/m-1', 'staff open it signed in, with no token')
}
console.log('5. Home visit path ✓')

console.log('✅ verify-visit-messages passed')
