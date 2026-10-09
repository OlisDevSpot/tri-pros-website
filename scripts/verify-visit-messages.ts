import type { VisitMessageSequenceKind, VisitMessageTemplateKey } from '@/shared/modules/meetings/messages/constants/kinds'

import type { VisitMessageFact, VisitMessagePlanInput, VisitMessageVars } from '@/shared/modules/meetings/messages/types'

import type { MergeToken } from '@/shared/services/voip/lib/sms-merge-template'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { ROOTS } from '@/shared/config/roots'
import { companyInfo } from '@/shared/constants/company'
import { VOIP_MESSAGE_STATUS_RANK } from '@/shared/constants/enums/voip'

import { businessDateTime, formatBusinessClock, formatBusinessDay, formatBusinessDayTime } from '@/shared/lib/business-time'
import { formatArrivalWindow } from '@/shared/modules/meetings/core/lib/arrival-window'

import { confirmationsClearedByMove } from '@/shared/modules/meetings/core/lib/confirmation-reset'
import { scheduledForSetByMove } from '@/shared/modules/meetings/core/lib/scheduled-for-set'
import { visitMessageTemplateKeys } from '@/shared/modules/meetings/messages/constants/kinds'
import { VISIT_MESSAGE_TEMPLATE_DEFAULTS, VISIT_MESSAGE_TOKENS } from '@/shared/modules/meetings/messages/constants/templates'
import { buildIcs } from '@/shared/modules/meetings/messages/lib/build-ics'
import { deriveConfirmationTrack } from '@/shared/modules/meetings/messages/lib/derive-confirmation-track'
import { displayFirstName } from '@/shared/modules/meetings/messages/lib/display-first-name'
import { buildGoogleCalendarLink } from '@/shared/modules/meetings/messages/lib/google-calendar-link'
import { isVisitMessageEligible } from '@/shared/modules/meetings/messages/lib/is-visit-message-eligible'
import { matchReplyKeyword } from '@/shared/modules/meetings/messages/lib/match-reply-keyword'
import { planVisitMessages } from '@/shared/modules/meetings/messages/lib/plan-visit-messages'
import { buildVisitMessageVars, renderVisitMessage } from '@/shared/modules/meetings/messages/lib/render-visit-message'
import { resolveRunInstant } from '@/shared/modules/meetings/messages/lib/resolve-run-instant'
import { runWindowFor } from '@/shared/modules/meetings/messages/lib/run-window'
import { shouldSendVisitCancellation } from '@/shared/modules/meetings/messages/lib/should-send-visit-cancellation'
import { MAX_SEGMENTS, validateVisitMessageTemplate } from '@/shared/modules/meetings/messages/lib/validate-visit-message-template'
import { applyDevRecipientOverride } from '@/shared/services/providers/resend/lib/dev-recipients'
import { mapTwilioMessageStatus } from '@/shared/services/voip/lib/map-twilio-message-status'
import { findSectionErrors, listMergeTokens, renderMergeSample, renderMergeTemplate } from '@/shared/services/voip/lib/sms-merge-template'
import { countSmsSegments, findNonGsm7 } from '@/shared/services/voip/lib/sms-segments'
import { escapeVcard, foldVcardLine } from '@/shared/services/voip/lib/vcard'

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

  const sectionTokens: MergeToken<{ name: string, empty: string }>[] = [
    { token: 'name', label: 'Name', sample: 'Maria', resolve: vars => vars.name },
    { token: 'empty', label: 'Empty', sample: '', resolve: vars => vars.empty },
  ]
  const sectionVars = { name: 'Sam', empty: '  ' }
  assert.equal(renderMergeTemplate('Hi{{#name}} {{name}}!{{/name}}', sectionTokens, sectionVars), 'Hi Sam!', '# keeps its text when the token has a value')
  assert.equal(renderMergeTemplate('Hi{{#empty}} there{{/empty}}.', sectionTokens, sectionVars), 'Hi.', '# drops its text when the token is blank')
  assert.equal(renderMergeTemplate('Hi{{^empty}} friend{{/empty}}.', sectionTokens, sectionVars), 'Hi friend.', '^ keeps its text when the token is blank')
  assert.equal(renderMergeTemplate('Hi{{^name}} friend{{/name}}.', sectionTokens, sectionVars), 'Hi.', '^ drops its text when the token has a value')
  assert.equal(renderMergeTemplate('{{#name}}a{{/name}}{{^name}}b{{/name}}', sectionTokens, sectionVars), 'a', 'both polarities side by side')
  assert.equal(renderMergeTemplate('{{#nope}}x {{name}}{{/nope}}', sectionTokens, sectionVars), '{{#nope}}x Sam{{/nope}}', 'an unknown section token stays as typed, inner tokens still merge')
  assert.equal(renderMergeSample('{{#name}}{{name}}{{/name}}|{{#empty}}x{{/empty}}|{{^empty}}y{{/empty}}', sectionTokens), 'Maria||y', 'a sample drives the sections')
  assert.deepEqual(listMergeTokens('{{#a}}{{b}}{{/a}} {{^c}}x{{/c}} {{a}}'), ['a', 'b', 'c'], 'section tokens are listed in order, once each')
  assert.deepEqual(findSectionErrors('{{#a}}x{{/a}} {{^b}}y{{/b}}'), [])
  assert.equal(findSectionErrors('{{#a}}x').length, 1, 'an opener with no closer')
  assert.equal(findSectionErrors('x{{/a}}').length, 1, 'a closer with no opener')
  assert.equal(findSectionErrors('{{#a}}{{#b}}x{{/b}}{{/a}}').length, 1, 'a nested section is reported once')

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
  assert.ok(!injectionEvent.includes('ATTENDEE;CN=x:mailto:evil@x.com'), 'no line contains the injected property')
  assert.ok(injectionEvent.includes('DESCRIPTION:a\\nb'), 'lone CR is escaped to newline escape')

  const controlEvent = buildIcs({ ...event, method: 'REQUEST', sequence: 0, description: 'a\u0000b' }).replace(/\r\n /g, '').split('\r\n')
  assert.ok(controlEvent.includes('DESCRIPTION:ab'), 'NUL and other C0 controls are dropped from TEXT values')

  const multibyteEvent = buildIcs({
    ...event,
    method: 'REQUEST',
    sequence: 0,
    summary: 'é'.repeat(60),
  })
  const byteLines = multibyteEvent.split('\r\n')
  assert.ok(byteLines.every(line => Buffer.byteLength(line, 'utf8') <= 75), 'every physical line is at most 75 octets')
  const unfoldedMultibyte = multibyteEvent.replace(/\r\n /g, '').split('\r\n')
  assert.ok(unfoldedMultibyte.includes(`SUMMARY:${'é'.repeat(60)}`), 'unfolded SUMMARY line contains all 60 multibyte characters')
}
console.log('4. Calendar invite ✓')

{
  assert.equal(ROOTS.public.homeVisit('m-1', 'tok'), '/home-visits/m-1?token=tok')
  assert.equal(ROOTS.public.homeVisit('m-1'), '/home-visits/m-1', 'staff open it signed in, with no token')
}
console.log('5. Home visit path ✓')

{
  const N = companyInfo.name
  const S = companyInfo.nickname
  for (const key of visitMessageTemplateKeys) {
    const { errors, warnings } = validateVisitMessageTemplate(key, VISIT_MESSAGE_TEMPLATE_DEFAULTS[key])
    assert.deepEqual(errors, [], `the default for ${key} has no errors`)
    assert.ok(warnings.every(issue => issue.code === 'ucs2'), `the default for ${key} warns about nothing but its emoji`)
    assert.equal(warnings.length, key === 'visit_summary' ? 0 : 1, `${key}: only the texts billed per segment warn about emoji`)
  }

  const errors = (key: VisitMessageTemplateKey, body: string) => validateVisitMessageTemplate(key, body).errors.map(issue => issue.code)
  assert.deepEqual(errors('confirmation_reply', '   '), ['empty'])
  assert.deepEqual(errors('confirmation_reply', 'See you {{visit_date}} at {{visit_time}} — \u{1F600}'), [], 'special characters and emoji are not errors')
  assert.deepEqual(errors('confirmation_reply', 'See you {{visit_date}} at {{visit_time}} {{nope}}'), ['unknown_token'])
  assert.deepEqual(errors('confirmation_reply', 'See you {{visit_date}} at {{visit_time}} {{#nope}}x{{/nope}}'), ['unknown_token'], 'a section token is checked like a plain one')
  assert.deepEqual(errors('confirmation_reply', 'See you {{visit_date}} at {{visit_time}} {{coordinator_note}}'), ['token_not_allowed'])
  assert.deepEqual(errors('confirmation_reply', 'See you {{visit_date}} at {{visit_time}} {{#coordinator_note}}x{{/coordinator_note}}'), ['token_not_allowed'], 'so is the summary-only rule')
  assert.deepEqual(errors('confirmation_reply', 'See you {{visit_date}} at {{visit_time}} {{#coordinator_name}}x'), ['bad_section'], 'an opener nobody closes')
  assert.deepEqual(errors('confirmation_reply', 'See you {{visit_date}} at {{visit_time}} x{{/coordinator_name}}'), ['bad_section'], 'a closer nobody opened')
  assert.deepEqual(errors('confirmation_reply', 'See you {{visit_date}}'), ['missing_token'])
  assert.ok(validateVisitMessageTemplate('rep_confirmation', 'Reply STOP to end these texts {{specialist_name}} {{arrival_window}} {{visit_link}}').errors.some(issue => issue.code === 'contains_stop'), 'a spelled-out opt-out line would repeat the one the renderer adds')
  assert.ok(validateVisitMessageTemplate('rep_confirmation', 'text stop to unsubscribe {{specialist_name}} {{arrival_window}} {{visit_link}}').errors.some(issue => issue.code === 'contains_stop'))
  assert.equal(validateVisitMessageTemplate('rep_confirmation', '{{specialist_name}} will stop by between {{arrival_window}}. Your visit page: {{visit_link}}').errors.length, 0, '"stop by" is ordinary English')

  const warnings = (key: VisitMessageTemplateKey, body: string) => validateVisitMessageTemplate(key, body).warnings.map(issue => issue.code)
  assert.deepEqual(warnings('confirmation_reply', 'See you {{visit_date}} at {{visit_time}} \u{1F600}'), ['ucs2'], 'an emoji in a per-segment text warns, it does not block')
  assert.match(validateVisitMessageTemplate('confirmation_reply', 'See you {{visit_date}} at {{visit_time}} \u{1F600}').warnings[0].message, /\u{1F600}.*two to three times as much/u, 'the warning names the characters')
  assert.deepEqual(warnings('visit_summary', `${VISIT_MESSAGE_TEMPLATE_DEFAULTS.visit_summary} \u{1F600}`), [], 'the summary goes as an MMS, so emoji cost nothing extra')
  assert.deepEqual(warnings('rep_confirmation', `${VISIT_MESSAGE_TEMPLATE_DEFAULTS.rep_confirmation} ${'x'.repeat(400)}`), ['ucs2', 'too_long'])
  assert.deepEqual(warnings('visit_summary', `${VISIT_MESSAGE_TEMPLATE_DEFAULTS.visit_summary} ${'x'.repeat(400)}`), [], 'the summary goes as MMS, so its length is not flagged')
  assert.deepEqual(warnings('rep_confirmation', '{{specialist_name}} confirmed. He arrives between {{arrival_window}}. {{visit_link}}'), ['pronoun'])
  assert.deepEqual(warnings('rep_confirmation', '{{specialist_name}} is here between {{arrival_window}}, this morning: {{visit_link}}'), [], '"here" and "this" are not pronouns')
  assert.deepEqual(warnings('day_before_reminder_unconfirmed', 'See you tomorrow at {{visit_time}}: {{visit_link}}'), ['no_yes_ask'])

  const vars = buildVisitMessageVars({ customerName: 'Maria Lopez', specialistName: 'Oliver', coordinatorName: 'Dana', scheduledFor: '2026-10-07T17:00:00.000Z', visitLink: 'https://example.com/v' })
  assert.deepEqual(vars, {
    firstName: 'Maria',
    specialistName: 'Oliver',
    coordinatorName: 'Dana',
    visitDate: 'Wed, Oct 7',
    visitTime: '10:00 AM',
    arrivalWindow: '10:00 and 10:30 AM',
    visitLink: 'https://example.com/v',
    coordinatorNote: '',
  })
  const company = { ...vars, coordinatorName: null }
  const noSpecialist = { ...vars, specialistName: null }
  const bare = { ...vars, specialistName: null, coordinatorName: null }
  const render = (key: VisitMessageTemplateKey, over: VisitMessageVars, stopLine = false) => renderVisitMessage(VISIT_MESSAGE_TEMPLATE_DEFAULTS[key], over, { stopLine })

  assert.equal(
    render('visit_summary', { ...vars, coordinatorNote: 'Gate code 1234.' }, true),
    `Hi Maria 👋 it's Dana from ${N}.

You're all set for Wed, Oct 7 at 10:00 AM 📅 Oliver will be your specialist.

One more thing: Gate code 1234.

Here's your visit page, where you can see the agenda and manage your visit:
https://example.com/v

Reply YES to confirm. Reply STOP to opt out.`,
    'the summary in the coordinator voice, with a specialist and a note; STOP shares the last line',
  )
  assert.equal(
    render('visit_summary', bare, true),
    `Hi Maria 👋 it's ${N}.

You're all set for Wed, Oct 7 at 10:00 AM 📅

Here's your visit page, where you can see the agenda and manage your visit:
https://example.com/v

Reply YES to confirm. Reply STOP to opt out.`,
    'the summary in the company voice: no specialist sentence, no note paragraph, no gap left behind',
  )
  assert.ok(!render('visit_summary', bare).includes('\n\n\n'), 'no triple newline')
  assert.ok(!render('visit_summary', bare).includes('One more thing'))
  assert.ok(render('visit_summary', company).includes(`it's ${N}.`) && render('visit_summary', company).includes('Oliver will be your specialist.'), 'a specialist without a coordinator')
  assert.ok(render('visit_summary', noSpecialist).includes('it\'s Dana from') && !render('visit_summary', noSpecialist).includes('specialist'), 'a coordinator without a specialist')
  assert.ok(render('visit_summary', vars).endsWith('Reply YES to confirm.'), 'no STOP line when none is asked for')

  assert.equal(
    render('day_before_reminder_unconfirmed', vars),
    `Hi Maria, Dana here from ${S} 🙂 Just a heads-up that your home visit is tomorrow at 10:00 AM with Oliver.

Can you reply YES so I know we're still on? If the time no longer works, you can pick a new one here: https://example.com/v`,
  )
  assert.equal(
    render('day_before_reminder_unconfirmed', bare),
    `Hi Maria, it's ${N} 🙂 Just a heads-up that your home visit is tomorrow at 10:00 AM.

Can you reply YES so we know we're still on? If the time no longer works, you can pick a new one here: https://example.com/v`,
  )
  assert.ok(render('day_before_reminder_unconfirmed', company).includes(`it's ${N} 🙂`) && render('day_before_reminder_unconfirmed', company).includes('with Oliver.') && render('day_before_reminder_unconfirmed', company).includes('so we know'))

  assert.equal(
    render('day_before_reminder_confirmed', vars),
    `Hi Maria! See you tomorrow at 10:00 AM 🏡 Oliver is looking forward to meeting you.

Your visit page, in case you need it: https://example.com/v
- Dana, ${N}`,
  )
  assert.equal(
    render('day_before_reminder_confirmed', bare),
    `Hi Maria! See you tomorrow at 10:00 AM 🏡 We're looking forward to meeting you.

Your visit page, in case you need it: https://example.com/v
- ${N}`,
  )

  assert.equal(
    render('rep_confirmation', vars),
    `Good morning Maria ☀️ Oliver just confirmed and will be there between 10:00 and 10:30 AM. Everything you need is here: https://example.com/v
- Dana, ${S}`,
  )
  assert.equal(
    render('rep_confirmation', company),
    `Good morning Maria ☀️ Oliver just confirmed and will be there between 10:00 and 10:30 AM. Everything you need is here: https://example.com/v
- ${N}`,
  )
  assert.ok(!render('rep_confirmation', vars).includes('STOP'))
  assert.equal(
    render('day_before_reminder_confirmed', vars, true),
    `Hi Maria! See you tomorrow at 10:00 AM 🏡 Oliver is looking forward to meeting you.

Your visit page, in case you need it: https://example.com/v
- Dana, ${N}
Reply STOP to opt out.`,
    'after a signature the STOP line takes its own line',
  )
  assert.equal(
    renderVisitMessage('{{#coordinator_name}}x{{/coordinator_name}} Hi {{first_name}}', { ...vars, coordinatorName: null }, { stopLine: false }),
    'Hi Maria',
    'a dropped section that starts a line leaves no leading space',
  )

  assert.equal(render('confirmation_reply', vars), 'Perfect, thank you Maria! You\'re confirmed for Wed, Oct 7 at 10:00 AM ✅')

  assert.equal(
    renderVisitMessage('a  b   \n\n\n\n c  \n', vars, { stopLine: false }),
    'a b\n\nc',
    'runs of spaces collapse, line ends and starts are trimmed, three or more newlines become one blank line, the ends are trimmed',
  )

  assert.equal(countSmsSegments(render('visit_summary', vars)).encoding, 'ucs2', 'the summary may be UCS-2: it goes as an MMS')
  for (const key of visitMessageTemplateKeys.filter(templateKey => templateKey !== 'visit_summary')) {
    const sample = renderMergeSample(VISIT_MESSAGE_TEMPLATE_DEFAULTS[key], VISIT_MESSAGE_TOKENS)
    assert.ok(sample.includes('https://') || !VISIT_MESSAGE_TEMPLATE_DEFAULTS[key].includes('{{visit_link}}'), `${key} counts a real-length link`)
    assert.ok(countSmsSegments(sample).segments <= MAX_SEGMENTS, `${key} stays within ${MAX_SEGMENTS} segments`)
  }

  assert.equal(displayFirstName({ name: 'Dana Whitfield', nickname: 'DJ' }), 'DJ', 'a nickname wins')
  assert.equal(displayFirstName({ name: ' Dana  Whitfield ', nickname: '  ' }), 'Dana', 'else the first name')
  assert.equal(displayFirstName({ name: '   ', nickname: null }), null, 'a blank name is nobody')
  assert.equal(displayFirstName(null), null)

  const visit = { specialistName: 'Oliver', coordinatorName: 'Dana', scheduledFor: '2026-10-07T17:00:00.000Z', visitLink: 'https://example.com/v' }
  assert.equal(buildVisitMessageVars({ ...visit, customerName: null }).firstName, 'there', 'no name on file reads "Hi there"')
  assert.equal(buildVisitMessageVars({ ...visit, customerName: '   ' }).firstName, 'there')
  assert.equal(buildVisitMessageVars({ ...visit, customerName: 'Cher' }).firstName, 'Cher')
  assert.equal(buildVisitMessageVars({ ...visit, customerName: '  Zoë  Kim ' }).firstName, 'Zoë')
  assert.equal(buildVisitMessageVars({ ...visit, customerName: 'Maria', coordinatorNote: '  Gate\ncode   1234. ' }).coordinatorNote, 'Gate code 1234.', 'a note is one line')

  for (const reply of ['YES', 'yes', ' Yes! ', 'y', 'Confirm.', 'confirmed']) {
    assert.equal(matchReplyKeyword(reply), 'confirm', reply)
  }
  for (const reply of ['', 'yes please', 'Yes but my husband can\'t make it', 'no', 'Cancel, can we do Thursday?', 'yess']) {
    assert.equal(matchReplyKeyword(reply), null, reply)
  }
}
console.log('6. Wording: render, validate, replies ✓')

{
  assert.equal(foldVcardLine('FN:Tri Pros'), 'FN:Tri Pros', 'a short line is untouched')
  assert.equal(foldVcardLine(`X:${'a'.repeat(73)}`), `X:${'a'.repeat(73)}`, 'a line of exactly 75 octets is untouched')

  const long = `PHOTO:${'A'.repeat(300)}`
  const folded = foldVcardLine(long).split('\r\n')
  assert.ok(folded.length > 1)
  assert.ok(folded.every(line => Buffer.byteLength(line, 'utf8') <= 75), 'every physical line is at most 75 octets')
  assert.equal(Buffer.byteLength(folded[0], 'utf8'), 75)
  assert.ok(folded.slice(1).every(line => line.startsWith(' ')), 'continuations start with one space')
  assert.equal(foldVcardLine(long).replace(/\r\n /g, ''), long, 'unfolding restores the line')

  const multibyte = `N:${'é'.repeat(100)}\u{1F600}`
  const foldedMultibyte = foldVcardLine(multibyte)
  assert.ok(foldedMultibyte.split('\r\n').every(line => Buffer.byteLength(line, 'utf8') <= 75))
  assert.equal(foldedMultibyte.replace(/\r\n /g, ''), multibyte, 'no character is split, so unfolding restores it')

  assert.equal(escapeVcard('12 Main; Unit 4, a\\b\nrear'), String.raw`12 Main\; Unit 4\, a\\b\nrear`, 'separators, backslashes and newlines are escaped')
}
console.log('6b. vCard folding ✓')

// Fri Oct 9 2026, 10:00 AM Pacific. Day before: reminder 6 PM = 2026-10-09T01:00Z, noon = 2026-10-08T19:00Z.
// Visit day: midnight = 2026-10-09T07:00Z, rep confirmation 8:30 AM = 2026-10-09T15:30Z.
const VISIT = '2026-10-09T17:00:00.000Z'
const VISIT_AS_POSTGRES = '2026-10-09 17:00:00+00'
const OLD_VISIT = '2026-10-08T17:00:00.000Z'

function fact(kind: VisitMessageFact['kind'], over: Partial<VisitMessageFact> = {}): VisitMessageFact {
  return { kind, channel: 'sms', status: 'sent', reason: null, forScheduledFor: VISIT, createdAt: '2026-10-07T18:00:00.000Z', ...over }
}
function planInput(over: Partial<VisitMessagePlanInput> = {}, meeting: Partial<VisitMessagePlanInput['meeting']> = {}): VisitMessagePlanInput {
  return {
    meeting: {
      scheduledFor: VISIT,
      scheduledForSetAt: '2026-10-07T17:00:00.000Z',
      meetingType: 'Fresh',
      meetingOutcome: 'not_set',
      confirmedAt: null,
      homeownerConfirmedAt: null,
      hasRep: true,
      ...meeting,
    },
    messages: [],
    contact: { hasPhone: true, doNotContact: false },
    pausedKinds: [],
    now: new Date('2026-10-07T20:00:00.000Z'),
    ...over,
  }
}
function step(input: VisitMessagePlanInput, kind: VisitMessageSequenceKind) {
  const found = planVisitMessages(input).find(candidate => candidate.kind === kind)
  assert.ok(found, `the plan has a ${kind} step`)
  return found
}

{
  const now = new Date('2026-10-07T20:00:00.000Z')
  assert.equal(isVisitMessageEligible({ meetingType: 'Fresh', meetingOutcome: 'not_set', scheduledFor: VISIT }, now), true)
  assert.equal(isVisitMessageEligible({ meetingType: 'Project', meetingOutcome: 'not_set', scheduledFor: VISIT }, now), false, 'a project meeting serves an existing project')
  assert.equal(isVisitMessageEligible({ meetingType: 'Fresh', meetingOutcome: 'cancelled', scheduledFor: VISIT }, now), false)
  assert.equal(isVisitMessageEligible({ meetingType: 'Fresh', meetingOutcome: 'reschedule_needed', scheduledFor: VISIT }, now), false, 'a homeowner who asked for a new time gets no more texts for this one')
  assert.equal(isVisitMessageEligible({ meetingType: 'Fresh', meetingOutcome: 'not_set', scheduledFor: VISIT }, new Date('2026-10-09T17:00:01.000Z')), false, 'past')
}
console.log('7. Eligibility ✓')

{
  const meeting = { scheduledFor: VISIT, confirmedAt: null, homeownerConfirmedAt: null, homeownerConfirmedVia: null }
  assert.deepEqual(deriveConfirmationTrack(meeting, []), {
    office: { done: false, nudge: 'summary_not_sent' },
    homeowner: { done: false, via: null },
    rep: { done: false },
  })
  assert.deepEqual(deriveConfirmationTrack(meeting, [fact('day_before_reminder')]).office, { done: true, nudge: 'summary_not_sent' }, 'a homeowner reached only by the reminder still sees Booked done')
  assert.deepEqual(deriveConfirmationTrack(meeting, [fact('visit_summary', { forScheduledFor: VISIT_AS_POSTGRES })]).office, { done: true, nudge: null }, 'the same instant in Postgres spelling')
  assert.deepEqual(deriveConfirmationTrack(meeting, [fact('visit_summary', { forScheduledFor: OLD_VISIT })]).office, { done: true, nudge: 'time_changed' }, 'a reschedule keeps the history and asks for a resend')
  assert.deepEqual(deriveConfirmationTrack(meeting, [fact('visit_summary', { status: 'failed' })]).office, { done: false, nudge: 'summary_not_sent' }, 'a failed send reached nobody')
  assert.deepEqual(deriveConfirmationTrack(meeting, [fact('homeowner_reply', { status: 'received' })]).office.done, false, 'a reply is not something the office sent')

  assert.deepEqual(deriveConfirmationTrack({ ...meeting, homeownerConfirmedAt: '2026-10-08T01:00:00.000Z', homeownerConfirmedVia: 'in_app' }, []).homeowner, { done: true, via: 'in_app' })
  assert.deepEqual(deriveConfirmationTrack({ ...meeting, confirmedAt: '2026-10-08T01:00:00.000Z' }, []).homeowner, { done: true, via: 'office' }, 'a phone confirmation the office recorded')

  assert.equal(deriveConfirmationTrack(meeting, [fact('rep_confirmation')]).rep.done, true)
  assert.equal(deriveConfirmationTrack(meeting, [fact('rep_confirmation', { forScheduledFor: OLD_VISIT })]).rep.done, false, 'a moved meeting needs the rep confirmation again')
}
console.log('8. Confirmation track ✓')

{
  const base = planInput()
  assert.deepEqual(planVisitMessages(base).map(candidate => candidate.kind), ['visit_summary', 'day_before_reminder', 'rep_confirmation'])
  assert.deepEqual(step(base, 'visit_summary'), { kind: 'visit_summary', plannedFor: null, state: 'not_sent', reason: 'never_sent', skipReason: null, late: false, variant: null, row: null })
  assert.deepEqual(step(base, 'day_before_reminder'), { kind: 'day_before_reminder', plannedFor: '2026-10-09T01:00:00.000Z', state: 'scheduled', reason: null, skipReason: null, late: false, variant: 'unconfirmed', row: null })
  assert.deepEqual(step(base, 'rep_confirmation'), { kind: 'rep_confirmation', plannedFor: '2026-10-09T15:30:00.000Z', state: 'scheduled', reason: null, skipReason: null, late: false, variant: null, row: null })

  // The noon rule: a summary after noon the day before makes the 6 PM reminder a repeat.
  const afterNoon = planInput({ messages: [fact('visit_summary', { createdAt: '2026-10-08T21:00:00.000Z' })] })
  assert.equal(step(afterNoon, 'visit_summary').state, 'sent')
  assert.equal(step(afterNoon, 'day_before_reminder').skipReason, 'booked_after_noon')
  assert.equal(step(afterNoon, 'rep_confirmation').skipReason, null, 'the morning text still goes')
  const beforeNoon = planInput({ messages: [fact('visit_summary', { createdAt: '2026-10-08T18:00:00.000Z' })] })
  assert.equal(step(beforeNoon, 'day_before_reminder').skipReason, null)
  const failedSummary = planInput({ messages: [fact('visit_summary', { status: 'failed', reason: 'twilio:30006', createdAt: '2026-10-08T21:00:00.000Z' })] })
  assert.equal(step(failedSummary, 'day_before_reminder').skipReason, null, 'a summary that never arrived does not replace the reminder')

  assert.equal(step(planInput({ pausedKinds: ['day_before_reminder'] }), 'day_before_reminder').skipReason, 'paused')
  assert.equal(step(planInput({ pausedKinds: ['day_before_reminder'] }), 'rep_confirmation').skipReason, null)
  assert.equal(step(planInput({ contact: { hasPhone: false, doNotContact: false } }), 'rep_confirmation').skipReason, 'no_phone')
  assert.equal(step(planInput({ contact: { hasPhone: true, doNotContact: true } }), 'rep_confirmation').skipReason, 'dnc')

  // Due: the planned time has come, the window is open, nothing is recorded.
  const atRun = planInput({ now: new Date('2026-10-09T01:00:00.000Z') })
  assert.equal(step(atRun, 'day_before_reminder').state, 'due')
  assert.equal(step(atRun, 'day_before_reminder').late, false)
  assert.equal(step(planInput({ now: new Date('2026-10-09T01:16:00.000Z') }), 'day_before_reminder').late, true, 'after 15 minutes the run is late')
  assert.equal(step(planInput({ now: new Date('2026-10-09T01:00:00.000Z'), pausedKinds: ['day_before_reminder'] }), 'day_before_reminder').state, 'due', 'a paused step is still due: the run records the skip')

  // Recorded rows win.
  const manualSkip = planInput({ messages: [fact('day_before_reminder', { status: 'skipped', reason: 'manual' })] })
  assert.equal(step(manualSkip, 'day_before_reminder').state, 'skipped')
  assert.equal(step(manualSkip, 'day_before_reminder').reason, 'manual')
  const sentThenDecided = planInput({ messages: [fact('visit_summary')] }, { meetingOutcome: 'cancelled' })
  assert.equal(step(sentThenDecided, 'visit_summary').state, 'sent', 'a recorded text stays visible after the meeting is decided')
  assert.equal(step(sentThenDecided, 'day_before_reminder').state, 'not_applicable')
  assert.equal(step(sentThenDecided, 'day_before_reminder').reason, 'outcome_decided')
  assert.equal(step(planInput({ messages: [fact('rep_confirmation', { forScheduledFor: VISIT_AS_POSTGRES })] }), 'rep_confirmation').state, 'sent', 'Postgres spelling of the visit time')

  const sending = planInput({ now: new Date('2026-10-09T01:05:00.000Z'), messages: [fact('day_before_reminder', { status: 'pending', createdAt: '2026-10-09T01:00:05.000Z' })] })
  assert.equal(step(sending, 'day_before_reminder').state, 'sending')
  const stale = planInput({ now: new Date('2026-10-09T01:20:00.000Z'), messages: [fact('day_before_reminder', { status: 'pending', createdAt: '2026-10-09T01:00:05.000Z' })] })
  assert.equal(step(stale, 'day_before_reminder').state, 'failed')
  assert.equal(step(stale, 'day_before_reminder').reason, 'send_interrupted', 'a claim older than 10 minutes never sent')

  // A moved time re-arms both automatic steps; the old texts stay in the chain.
  const moved = planInput({ messages: [fact('visit_summary', { forScheduledFor: OLD_VISIT }), fact('day_before_reminder', { forScheduledFor: OLD_VISIT }), fact('rep_confirmation', { forScheduledFor: OLD_VISIT, status: 'skipped', reason: 'manual' })] })
  assert.equal(step(moved, 'visit_summary').reason, 'time_changed')
  assert.equal(step(moved, 'day_before_reminder').state, 'scheduled')
  assert.equal(step(moved, 'rep_confirmation').state, 'scheduled', 'a skip covered the old time only')

  // Nothing recorded and nothing will send.
  const bookedAfterRun = planInput({ now: new Date('2026-10-09T02:30:00.000Z') }, { scheduledForSetAt: '2026-10-09T02:00:00.000Z' })
  assert.equal(step(bookedAfterRun, 'day_before_reminder').state, 'not_sent')
  assert.equal(step(bookedAfterRun, 'day_before_reminder').reason, 'booked_after_run', 'booked at 7 PM the day before: the 6 PM run had gone')
  const sameDay = planInput({ now: new Date('2026-10-09T16:20:00.000Z') }, { scheduledForSetAt: '2026-10-09T16:15:00.000Z' })
  assert.equal(step(sameDay, 'rep_confirmation').state, 'not_sent')
  assert.equal(step(sameDay, 'rep_confirmation').reason, 'booked_after_run', 'booked at 9:15 AM for 10 AM: no "good morning" text an hour late')
  const sameDayPostgres = planInput({ now: new Date('2026-10-09T16:20:00.000Z') }, { scheduledForSetAt: '2026-10-09 16:15:00.123456+00' })
  assert.equal(step(sameDayPostgres, 'rep_confirmation').state, 'not_sent')
  assert.equal(step(sameDayPostgres, 'rep_confirmation').reason, 'booked_after_run', 'a scheduledForSetAt in Postgres microsecond spelling reads the same')
  const movedAfterRun = planInput({ now: new Date('2026-10-09T16:20:00.000Z') }, { scheduledFor: '2026-10-09T21:00:00.000Z', scheduledForSetAt: '2026-10-09T16:15:00.000Z' })
  assert.equal(step(movedAfterRun, 'rep_confirmation').state, 'not_sent')
  assert.equal(step(movedAfterRun, 'rep_confirmation').reason, 'booked_after_run', 'moved in place at 9:15 AM into 2 PM today: the 8:30 run had gone, and a retry must not text it')
  const movedBeforeRun = planInput({ now: new Date('2026-10-09T16:20:00.000Z') }, { scheduledFor: '2026-10-09T21:00:00.000Z', scheduledForSetAt: '2026-10-09T14:00:00.000Z' })
  assert.equal(step(movedBeforeRun, 'rep_confirmation').state, 'due', 'moved at 7 AM: the 8:30 run owns it')
  const missed = planInput({ now: new Date('2026-10-09T07:30:00.000Z') })
  assert.equal(step(missed, 'day_before_reminder').state, 'not_sent')
  assert.equal(step(missed, 'day_before_reminder').reason, 'no_record', 'the window closed at midnight with nothing recorded')

  // Not applicable.
  assert.deepEqual(planVisitMessages(planInput({}, { meetingType: 'Project' })).map(candidate => [candidate.state, candidate.reason]), [['not_applicable', 'project_meeting'], ['not_applicable', 'project_meeting'], ['not_applicable', 'project_meeting']])
  assert.equal(step(planInput({}, { hasRep: false }), 'rep_confirmation').reason, 'no_rep')
  assert.equal(step(planInput({}, { hasRep: false }), 'day_before_reminder').state, 'scheduled', 'the reminder goes without a rep, as "your rep"')
  const early = planInput({}, { scheduledFor: '2026-10-09T15:00:00.000Z' })
  assert.equal(step(early, 'rep_confirmation').state, 'not_applicable')
  assert.equal(step(early, 'rep_confirmation').reason, 'before_9am', 'an 8 AM visit gets no 8:30 text')

  assert.equal(step(planInput({}, { homeownerConfirmedAt: '2026-10-08T01:00:00.000Z' }), 'day_before_reminder').variant, 'confirmed')
  assert.equal(step(planInput({}, { confirmedAt: '2026-10-08T01:00:00.000Z' }), 'day_before_reminder').variant, 'confirmed', 'the office recording a phone confirmation counts')
}
console.log('9. Visit message plan ✓')

{
  assert.equal(resolveRunInstant('day_before_reminder', new Date('2026-10-09T00:59:58.000Z'))?.toISOString(), '2026-10-09T01:00:00.000Z', 'a delivery two seconds early is still tonight\'s run, evaluated at 6 PM')
  assert.equal(step(planInput({ now: new Date('2026-10-09T01:00:00.000Z') }), 'day_before_reminder').state, 'due')
  assert.equal(resolveRunInstant('day_before_reminder', new Date('2026-10-09T01:03:00.000Z'))?.toISOString(), '2026-10-09T01:03:00.000Z', 'a late delivery runs at the time it arrived')
  assert.equal(resolveRunInstant('day_before_reminder', new Date('2026-10-09T00:50:00.000Z')), null, 'ten minutes early is not this run')
  assert.equal(resolveRunInstant('day_before_reminder', new Date('2026-10-09T07:05:00.000Z')), null, 'a retry at 12:05 AM is not the next day\'s 6 PM run')
  assert.equal(resolveRunInstant('rep_confirmation', new Date('2026-10-09T15:30:00.000Z'))?.toISOString(), '2026-10-09T15:30:00.000Z')
  assert.equal(resolveRunInstant('rep_confirmation', new Date('2026-11-01T16:30:00.000Z'))?.toISOString(), '2026-11-01T16:30:00.000Z', '8:30 AM on the fall-back day')
  assert.equal(resolveRunInstant('day_before_reminder', new Date('2026-10-09T04:00:00.000Z')), null, 'a retry at 9:00 PM Pacific sends nothing')
  assert.equal(resolveRunInstant('day_before_reminder', new Date('2026-10-09T03:59:00.000Z'))?.toISOString(), '2026-10-09T03:59:00.000Z', '8:59 PM still runs')
  assert.equal(resolveRunInstant('rep_confirmation', new Date('2026-10-10T04:30:00.000Z')), null, 'the ceiling holds for both kinds')
}
console.log('10. Run time ✓')

{
  const FUTURE = { scheduledFor: '2026-10-12T17:00:00.000Z', now: new Date('2026-10-09T17:00:00.000Z') }
  const invite = fact('visit_summary', { channel: 'email' })
  assert.equal(shouldSendVisitCancellation({ chainMessages: [invite], hasSuccessor: false, ...FUTURE }), true)
  assert.equal(shouldSendVisitCancellation({ chainMessages: [invite], hasSuccessor: true, ...FUTURE }), false, 'a reschedule\'s original has a successor: the next summary updates the same calendar entry')
  assert.equal(shouldSendVisitCancellation({ chainMessages: [fact('visit_summary')], hasSuccessor: false, ...FUTURE }), false, 'a text-only summary put nothing on a calendar')
  assert.equal(shouldSendVisitCancellation({ chainMessages: [fact('visit_summary', { channel: 'email', status: 'failed' })], hasSuccessor: false, ...FUTURE }), false)
  assert.equal(shouldSendVisitCancellation({ chainMessages: [fact('visit_summary', { channel: 'email', forScheduledFor: OLD_VISIT })], hasSuccessor: false, ...FUTURE }), true, 'an invite sent before a reschedule is still on their calendar')
  assert.equal(shouldSendVisitCancellation({ chainMessages: [invite], hasSuccessor: false, scheduledFor: '2026-10-09T17:00:00.000Z', now: new Date('2026-10-09T17:00:00.000Z') }), false, 'a visit at or before now has nothing to cancel')
  assert.equal(shouldSendVisitCancellation({ chainMessages: [invite], hasSuccessor: false, scheduledFor: '2026-10-08T17:00:00.000Z', now: new Date('2026-10-09T17:00:00.000Z') }), false)
}
console.log('11. Cancellation rule ✓')

{
  const confirmed = { scheduledFor: VISIT_AS_POSTGRES, confirmedAt: '2026-10-08T01:00:00.000Z', homeownerConfirmedAt: '2026-10-08T02:00:00.000Z' }
  assert.deepEqual(confirmationsClearedByMove(confirmed, { scheduledFor: OLD_VISIT }), { confirmedAt: null, homeownerConfirmedAt: null, homeownerConfirmedVia: null }, 'a moved time clears both confirmations')
  assert.deepEqual(confirmationsClearedByMove(confirmed, { scheduledFor: VISIT }), {}, 'a same-time re-save in another spelling keeps them')
  assert.deepEqual(confirmationsClearedByMove(confirmed, {}), {}, 'a patch that does not touch the time clears nothing')
  assert.deepEqual(confirmationsClearedByMove({ ...confirmed, confirmedAt: null }, { scheduledFor: OLD_VISIT }), { homeownerConfirmedAt: null, homeownerConfirmedVia: null }, 'only what was set')
  assert.deepEqual(confirmationsClearedByMove({ ...confirmed, homeownerConfirmedAt: null }, { scheduledFor: OLD_VISIT }), { confirmedAt: null })
  assert.deepEqual(confirmationsClearedByMove(confirmed, { scheduledFor: OLD_VISIT, confirmedAt: '2026-10-08T03:00:00.000Z' }), { homeownerConfirmedAt: null, homeownerConfirmedVia: null }, 'a patch that moves the time and confirms it keeps its own confirmation')
  const setAt = new Date('2026-10-08T03:00:00.000Z')
  assert.deepEqual(scheduledForSetByMove({ scheduledFor: VISIT_AS_POSTGRES }, { scheduledFor: OLD_VISIT }, setAt), { scheduledForSetAt: '2026-10-08T03:00:00.000Z' }, 'a moved time is set now')
  assert.deepEqual(scheduledForSetByMove({ scheduledFor: VISIT_AS_POSTGRES }, { scheduledFor: VISIT }, setAt), {}, 'a same-time re-save in another spelling keeps the fact')
  assert.deepEqual(scheduledForSetByMove({ scheduledFor: VISIT }, {}, setAt), {}, 'a patch that does not touch the time sets nothing')
}
console.log('12. Confirmations hold for one time ✓')

{
  assert.equal(mapTwilioMessageStatus('accepted'), 'queued')
  assert.equal(mapTwilioMessageStatus('Sent'), 'sent')
  assert.equal(mapTwilioMessageStatus('read'), 'delivered')
  assert.equal(mapTwilioMessageStatus('undelivered'), 'undelivered')
  assert.equal(mapTwilioMessageStatus('partially_delivered'), null, 'a state the table has no word for is ignored')
  assert.ok(VOIP_MESSAGE_STATUS_RANK.sent < VOIP_MESSAGE_STATUS_RANK.delivered, 'delivered outranks sent')
  assert.equal(VOIP_MESSAGE_STATUS_RANK.failed, VOIP_MESSAGE_STATUS_RANK.delivered, 'one terminal state never overwrites another')
}
console.log('13. Twilio status mapping ✓')

{
  const link = buildGoogleCalendarLink({ summary: 'Home visit with Tri Pros', start: VISIT, durationMs: 2 * 60 * 60 * 1000, location: '1 Main St, Calabasas, CA 91302', description: 'Oliver will arrive between 10:00 and 10:30 AM.' })
  assert.ok(link.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE'))
  assert.ok(link.includes('dates=20261009T170000Z%2F20261009T190000Z'), 'UTC stamps for the booked time and two hours after')
  assert.ok(link.includes('text=Home+visit+with+Tri+Pros'))
  assert.ok(link.includes('location=1+Main+St%2C+Calabasas%2C+CA+91302'))
}
console.log('14. Google Calendar link ✓')

{
  assert.deepEqual(runWindowFor('day_before_reminder', new Date('2026-10-09T01:00:00.000Z')), { day: '2026-10-09', from: '2026-10-09T07:00:00.000Z', to: '2026-10-10T07:00:00.000Z' }, 'the 6 PM run on Oct 8 covers Oct 9, Pacific')
  assert.deepEqual(runWindowFor('rep_confirmation', new Date('2026-10-09T15:30:00.000Z')), { day: '2026-10-09', from: '2026-10-09T07:00:00.000Z', to: '2026-10-10T07:00:00.000Z' }, 'the 8:30 run covers its own day')
  assert.deepEqual(runWindowFor('day_before_reminder', new Date('2026-11-02T02:00:00.000Z')), { day: '2026-11-02', from: '2026-11-02T08:00:00.000Z', to: '2026-11-03T08:00:00.000Z' }, 'the window after the fall-back switch starts at the PST midnight')
}
console.log('15. Run window ✓')

console.log('✅ verify-visit-messages passed')
