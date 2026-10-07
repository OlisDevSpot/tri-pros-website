import assert from 'node:assert/strict'

import type { MergeToken } from '@/shared/services/voip/lib/sms-merge-template'
import type { VisitMessageTemplateKey } from '@/shared/modules/meetings/messages/constants/kinds'

import { ROOTS } from '@/shared/config/roots'
import { businessDateTime, formatBusinessClock, formatBusinessDay, formatBusinessDayTime } from '@/shared/lib/business-time'
import { buildIcs } from '@/shared/modules/meetings/messages/lib/build-ics'
import { formatArrivalWindow } from '@/shared/modules/meetings/core/lib/arrival-window'
import { companyInfo } from '@/shared/constants/company'
import { visitMessageTemplateKeys } from '@/shared/modules/meetings/messages/constants/kinds'
import { VISIT_MESSAGE_TEMPLATE_DEFAULTS } from '@/shared/modules/meetings/messages/constants/templates'
import { matchReplyKeyword } from '@/shared/modules/meetings/messages/lib/match-reply-keyword'
import { buildVisitMessageVars, renderVisitMessage } from '@/shared/modules/meetings/messages/lib/render-visit-message'
import { validateVisitMessageTemplate } from '@/shared/modules/meetings/messages/lib/validate-visit-message-template'
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

{
  for (const key of visitMessageTemplateKeys) {
    assert.deepEqual(validateVisitMessageTemplate(key, VISIT_MESSAGE_TEMPLATE_DEFAULTS[key]), { errors: [], warnings: [] }, `the default for ${key} is clean`)
  }

  const errors = (key: VisitMessageTemplateKey, body: string) => validateVisitMessageTemplate(key, body).errors.map(issue => issue.code)
  assert.deepEqual(errors('confirmation_reply', '   '), ['empty'])
  assert.deepEqual(errors('confirmation_reply', 'See you {{visit_date}} at {{visit_time}} — thanks'), ['not_gsm7'], 'an em dash is rejected')
  assert.match(validateVisitMessageTemplate('confirmation_reply', 'See you {{visit_date}} at {{visit_time}} — \u{1F600}').errors[0].message, /—.*\u{1F600}/u, 'the message lists each offending character')
  assert.deepEqual(errors('confirmation_reply', 'See you {{visit_date}} at {{visit_time}} {{nope}}'), ['unknown_token'])
  assert.deepEqual(errors('confirmation_reply', 'See you {{visit_date}} at {{visit_time}} {{office_note}}'), ['token_not_allowed'])
  assert.deepEqual(errors('confirmation_reply', 'See you {{visit_date}}'), ['missing_token'])
  assert.deepEqual(errors('confirmation_reply', 'See you {{visit_date}} at {{visit_time}}. Reply stop to opt out.'), ['contains_stop'], 'the renderer adds the STOP line; a second copy would repeat it')

  const warnings = (key: VisitMessageTemplateKey, body: string) => validateVisitMessageTemplate(key, body).warnings.map(issue => issue.code)
  assert.deepEqual(warnings('rep_confirmation', `${VISIT_MESSAGE_TEMPLATE_DEFAULTS.rep_confirmation} ${'x'.repeat(200)}`), ['too_long'])
  assert.deepEqual(warnings('visit_summary', `${VISIT_MESSAGE_TEMPLATE_DEFAULTS.visit_summary} ${'x'.repeat(400)}`), [], 'the summary goes as MMS, so its length is not flagged')
  assert.deepEqual(warnings('rep_confirmation', '{{rep_name}} confirmed. He arrives between {{arrival_window}}. {{visit_link}}'), ['pronoun'])
  assert.deepEqual(warnings('rep_confirmation', '{{rep_name}} is here between {{arrival_window}}, this morning: {{visit_link}}'), [], '"here" and "this" are not pronouns')
  assert.deepEqual(warnings('day_before_reminder_unconfirmed', 'See you tomorrow at {{visit_time}}: {{visit_link}}'), ['no_yes_ask'])

  const vars = buildVisitMessageVars({ customerName: 'Maria Lopez', repName: 'Oliver', scheduledFor: '2026-10-07T17:00:00.000Z', visitLink: 'https://example.com/v' })
  assert.deepEqual(vars, {
    firstName: 'Maria',
    repName: 'Oliver',
    visitDate: 'Wed, Oct 7',
    visitTime: '10:00 AM',
    arrivalWindow: '10:00 and 10:30 AM',
    visitLink: 'https://example.com/v',
    officeNote: '',
  })
  assert.equal(
    renderVisitMessage(VISIT_MESSAGE_TEMPLATE_DEFAULTS.visit_summary, vars, { stopLine: true }),
    `Hi Maria, this is ${companyInfo.name}. Your home visit is booked for Wed, Oct 7 at 10:00 AM with Oliver. Meet Oliver and see your visit details: https://example.com/v Reply YES to confirm. Reply STOP to opt out.`,
    'an empty note leaves no double space, and the STOP line is appended',
  )
  assert.ok(
    renderVisitMessage(VISIT_MESSAGE_TEMPLATE_DEFAULTS.visit_summary, { ...vars, officeNote: 'Gate code 1234.' }, { stopLine: false })
      .includes('with Oliver. Gate code 1234. Meet Oliver'),
    'the office note sits where the token is',
  )
  assert.ok(
    renderVisitMessage(VISIT_MESSAGE_TEMPLATE_DEFAULTS.visit_summary, { ...vars, repName: null }, { stopLine: false })
      .includes('with your rep. Meet your rep and see'),
    'a meeting with no rep yet says "your rep"',
  )
  assert.ok(!renderVisitMessage(VISIT_MESSAGE_TEMPLATE_DEFAULTS.rep_confirmation, vars, { stopLine: false }).includes('STOP'))

  for (const key of visitMessageTemplateKeys) {
    assert.equal(countSmsSegments(renderVisitMessage(VISIT_MESSAGE_TEMPLATE_DEFAULTS[key], vars, { stopLine: true })).encoding, 'gsm7', `${key} renders as GSM-7 with real formatted times`)
  }

  const visit = { repName: 'Oliver', scheduledFor: '2026-10-07T17:00:00.000Z', visitLink: 'https://example.com/v' }
  assert.equal(buildVisitMessageVars({ ...visit, customerName: null }).firstName, 'there', 'no name on file reads "Hi there"')
  assert.equal(buildVisitMessageVars({ ...visit, customerName: '   ' }).firstName, 'there')
  assert.equal(buildVisitMessageVars({ ...visit, customerName: 'Cher' }).firstName, 'Cher')
  assert.equal(buildVisitMessageVars({ ...visit, customerName: '  Zoë  Kim ' }).firstName, 'Zoë')
  assert.equal(
    countSmsSegments(renderVisitMessage(VISIT_MESSAGE_TEMPLATE_DEFAULTS.confirmation_reply, buildVisitMessageVars({ ...visit, customerName: 'Zoë Kim' }), { stopLine: false })).encoding,
    'ucs2',
    'a name outside GSM-7 still sends, spelled right',
  )
  assert.equal(buildVisitMessageVars({ ...visit, customerName: 'Maria', officeNote: '  Gate\ncode   1234. ' }).officeNote, 'Gate code 1234.', 'a note is one line')

  for (const reply of ['YES', 'yes', ' Yes! ', 'y', 'Confirm.', 'confirmed']) {
    assert.equal(matchReplyKeyword(reply), 'confirm', reply)
  }
  for (const reply of ['', 'yes please', 'Yes but my husband can\'t make it', 'no', 'Cancel, can we do Thursday?', 'yess']) {
    assert.equal(matchReplyKeyword(reply), null, reply)
  }
}
console.log('6. Wording: render, validate, replies ✓')

console.log('✅ verify-visit-messages passed')
