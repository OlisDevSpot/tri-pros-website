import type { VisitMessageSequenceKind, VisitMessageTemplateKey } from '@/shared/modules/meetings/messages/constants/kinds'

import type { VisitMessageFact, VisitMessagePlanInput, VisitMessageVars } from '@/shared/modules/meetings/messages/types'

import type { MeetingForGCal } from '@/shared/services/providers/google-calendar/lib/map-to-gcal'

import type { MergeToken } from '@/shared/services/voip/lib/sms-merge-template'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { ROOTS } from '@/shared/config/roots'
import { companyInfo } from '@/shared/constants/company'
import { canRescheduleFromOutcome, derivedMeetingOutcomes, DID_NOT_OCCUR_OUTCOMES, LIVE_MEETING_OUTCOMES, MEETING_OUTCOME_SENTIMENT, MEETING_OUTCOME_SIT, outcomeRequiresReason, rescheduleBlockedReason, RESCHEDULED_ORIGINAL_REASON, selectableMeetingOutcomes } from '@/shared/constants/enums/meetings'
import { VOIP_MESSAGE_STATUS_RANK } from '@/shared/constants/enums/voip'
import { OUTCOME_PIPELINE_MAP } from '@/shared/domains/pipelines/lib/outcome-pipeline-map'

import { businessDateTime, formatBusinessClock, formatBusinessDay, formatBusinessDayTime } from '@/shared/lib/business-time'
import { formatArrivalWindow } from '@/shared/modules/meetings/core/lib/arrival-window'

import { confirmationsClearedByMove } from '@/shared/modules/meetings/core/lib/confirmation-reset'
import { outcomeChangeNeedsSync } from '@/shared/modules/meetings/core/lib/outcome-change-needs-sync'
import { rescheduledOriginalOutcome } from '@/shared/modules/meetings/core/lib/rescheduled-original-outcome'
import { scheduledForSetByMove } from '@/shared/modules/meetings/core/lib/scheduled-for-set'
import { visitMessageTemplateKeys } from '@/shared/modules/meetings/messages/constants/kinds'
import { VISIT_MESSAGE_STOP_LINE, VISIT_MESSAGE_TEMPLATE_DEFAULTS, VISIT_MESSAGE_TOKENS } from '@/shared/modules/meetings/messages/constants/templates'
import { deriveConfirmationTrack } from '@/shared/modules/meetings/messages/lib/derive-confirmation-track'
import { displayFirstName } from '@/shared/modules/meetings/messages/lib/display-first-name'
import { isVisitMessageEligible } from '@/shared/modules/meetings/messages/lib/is-visit-message-eligible'
import { matchReplyKeyword } from '@/shared/modules/meetings/messages/lib/match-reply-keyword'
import { planVisitMessages } from '@/shared/modules/meetings/messages/lib/plan-visit-messages'
import { buildVisitMessageVars, renderVisitMessage } from '@/shared/modules/meetings/messages/lib/render-visit-message'
import { resolveRunInstant } from '@/shared/modules/meetings/messages/lib/resolve-run-instant'
import { runWindowFor } from '@/shared/modules/meetings/messages/lib/run-window'
import { MAX_SEGMENTS, validateVisitMessageTemplate } from '@/shared/modules/meetings/messages/lib/validate-visit-message-template'
import { carryAttendeeResponses, decideCalendarNotice, decideCancellationNotice, homeownerMarker, noticeStateFromEvent, toSendUpdates } from '@/shared/services/providers/google-calendar/lib/calendar-notice'
import { meetingToGCalEvent } from '@/shared/services/providers/google-calendar/lib/map-to-gcal'
import { resolveMeetingGuests } from '@/shared/services/providers/google-calendar/lib/meeting-guests'
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
  assert.deepEqual(errors('confirmation_reply', 'See you {{visit_date}} at {{visit_time}} {{visit_note}}'), ['token_not_allowed'])
  assert.deepEqual(errors('confirmation_reply', 'See you {{visit_date}} at {{visit_time}} {{#visit_note}}x{{/visit_note}}'), ['token_not_allowed'], 'so is the summary-only rule')
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
    visitNote: '',
  })
  const company = { ...vars, coordinatorName: null }
  const noSpecialist = { ...vars, specialistName: null }
  const bare = { ...vars, specialistName: null, coordinatorName: null }
  const render = (key: VisitMessageTemplateKey, over: VisitMessageVars, stopLine = false) => renderVisitMessage(VISIT_MESSAGE_TEMPLATE_DEFAULTS[key], over, { stopLine })

  assert.equal(
    render('visit_summary', { ...vars, visitNote: 'Gate code 1234.' }, true),
    `Hi Maria 👋 it's Dana from ${N}.

You're all set for Wed, Oct 7 at 10:00 AM 📅 Oliver will be your specialist.

One more thing: Gate code 1234.

Here's your visit page, where you can see the agenda and manage your visit:
https://example.com/v

Reply YES to confirm. ${VISIT_MESSAGE_STOP_LINE}`,
    'the summary in the coordinator voice, with a specialist and a note; STOP shares the last line',
  )
  assert.equal(
    render('visit_summary', bare, true),
    `Hi Maria 👋 it's ${N}.

You're all set for Wed, Oct 7 at 10:00 AM 📅

Here's your visit page, where you can see the agenda and manage your visit:
https://example.com/v

Reply YES to confirm. ${VISIT_MESSAGE_STOP_LINE}`,
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
${VISIT_MESSAGE_STOP_LINE}`,
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
  assert.equal(buildVisitMessageVars({ ...visit, customerName: 'Maria', visitNote: '  Gate\ncode   1234. ' }).visitNote, 'Gate code 1234.', 'a note is one line')

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
  assert.deepEqual(runWindowFor('day_before_reminder', new Date('2026-10-09T01:00:00.000Z')), { day: '2026-10-09', from: '2026-10-09T07:00:00.000Z', to: '2026-10-10T07:00:00.000Z' }, 'the 6 PM run on Oct 8 covers Oct 9, Pacific')
  assert.deepEqual(runWindowFor('rep_confirmation', new Date('2026-10-09T15:30:00.000Z')), { day: '2026-10-09', from: '2026-10-09T07:00:00.000Z', to: '2026-10-10T07:00:00.000Z' }, 'the 8:30 run covers its own day')
  assert.deepEqual(runWindowFor('day_before_reminder', new Date('2026-11-02T02:00:00.000Z')), { day: '2026-11-02', from: '2026-11-02T08:00:00.000Z', to: '2026-11-03T08:00:00.000Z' }, 'the window after the fall-back switch starts at the PST midnight')
}
console.log('15. Run window ✓')

{
  assert.ok((derivedMeetingOutcomes as readonly string[]).includes('rescheduled'), 'the system sets it; pickers show it disabled')
  assert.ok(!(selectableMeetingOutcomes as readonly string[]).includes('rescheduled'))
  assert.equal(MEETING_OUTCOME_SENTIMENT.rescheduled, 'neutral', 'a reschedule is not a loss')
  assert.equal(MEETING_OUTCOME_SIT.rescheduled, 'not_sat')
  assert.ok(!LIVE_MEETING_OUTCOMES.includes('rescheduled'), 'the replacement is the live meeting')
  assert.equal(canRescheduleFromOutcome('rescheduled'), false, 'the replacement is what gets rescheduled next')
  assert.ok(!(DID_NOT_OCCUR_OUTCOMES as readonly string[]).includes('rescheduled'))
  assert.equal(outcomeRequiresReason('rescheduled'), false)
  assert.equal(OUTCOME_PIPELINE_MAP.rescheduled, null, 'the original does not go to rehash')
  assert.equal(isVisitMessageEligible({ meetingType: 'Fresh', meetingOutcome: 'rescheduled', scheduledFor: '2099-01-01T17:00:00.000Z' }, new Date('2026-10-12T17:00:00.000Z')), false, 'nothing is sent for a rescheduled original')
}
console.log('16. The rescheduled outcome ✓')

{
  const meeting: MeetingForGCal = {
    id: 'm1',
    scheduledFor: '2026-10-20T17:00:00.000Z',
    meetingType: 'Fresh',
    projectId: null,
    customerName: 'Maria Lopez',
    customerEmail: 'maria@example.com',
    customerAddress: '1 Main St',
    customerCity: 'Calabasas',
    customerState: 'CA',
    customerZip: '91302',
    visitNote: 'Please park in the driveway.',
    homeownerInvitedAt: '2026-10-12T17:00:00.000Z',
    shareToken: 'tok',
    tradeSelections: [{ tradeName: 'Roofing', selectedScopes: [{ label: 'Tear-off' }, { label: 'Gutters' }] }],
    gcalEventId: null,
    gcalEtag: null,
    participantEmails: ['rep@triprosremodeling.com'],
    meetingOutcome: 'not_set',
  }
  const guests = { attendees: [{ email: 'rep@triprosremodeling.com' }, { email: 'maria@example.com' }], homeownerEmail: 'maria@example.com' }
  const extras = { visitLink: 'https://example.com/home-visits/m1?token=tok', questionsPhone: '(818) 555-0100', guests }
  const event = meetingToGCalEvent(meeting, extras)!
  assert.equal(event.summary, `Home visit: Maria Lopez · ${companyInfo.name}`)
  assert.equal(meetingToGCalEvent({ ...meeting, projectId: 'p1', meetingType: 'Project' }, extras)!.summary, 'Project: Maria Lopez', 'homeowners are never invited to project meetings, so those keep a project title')
  const description = event.description!
  const order = ['Please park in the driveway.', 'Roofing: Tear-off, Gutters', extras.visitLink, `Questions? Call or text ${companyInfo.nickname} at (818) 555-0100`]
  const positions = order.map(part => description.indexOf(part))
  assert.ok(positions.every(position => position >= 0), `every part is present: ${description}`)
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, 'visit note, trades, visit page, then questions')
  assert.ok(!/dashboard|Synced from|maria@example\.com|Phone:/i.test(description), 'no dashboard link, footer, or customer contact details')
  assert.ok(!meetingToGCalEvent({ ...meeting, visitNote: null }, extras)!.description!.startsWith('\n'), 'no blank lead when there is no note')
  assert.deepEqual(event.attendees, guests.attendees)
  assert.deepEqual(event.extendedProperties, homeownerMarker('maria@example.com'))
  assert.equal(event.location, '1 Main St, Calabasas, CA, 91302')
  assert.equal(meetingToGCalEvent({ ...meeting, meetingOutcome: 'cancelled' }, extras), null, 'a cancelled meeting has no event')
  assert.equal(meetingToGCalEvent({ ...meeting, meetingOutcome: 'rescheduled' }, extras), null, 'a rescheduled original has no event')
  assert.notEqual(meetingToGCalEvent({ ...meeting, meetingOutcome: 'no_show' }, extras), null, 'a no-show keeps its event as history')
}
console.log('17. The meeting event ✓')

{
  const base = { isProduction: true, staffEmails: ['rep@triprosremodeling.com', 'REP@triprosremodeling.com'], invitedHomeownerEmail: 'maria@example.com', devOverride: 'owner@triprosremodeling.com' }
  assert.deepEqual(resolveMeetingGuests(base), { attendees: [{ email: 'rep@triprosremodeling.com' }, { email: 'maria@example.com' }], homeownerEmail: 'maria@example.com' }, 'production: staff once each, then the homeowner')
  assert.deepEqual(resolveMeetingGuests({ ...base, invitedHomeownerEmail: null }), { attendees: [{ email: 'rep@triprosremodeling.com' }], homeownerEmail: null })
  assert.deepEqual(resolveMeetingGuests({ ...base, isProduction: false }), { attendees: [{ email: 'owner@triprosremodeling.com' }], homeownerEmail: 'owner@triprosremodeling.com' }, 'dev: no staff, and the homeowner is the override inbox')
  assert.deepEqual(resolveMeetingGuests({ ...base, isProduction: false, devOverride: null }), { attendees: [], homeownerEmail: null }, 'dev without an override invites nobody')
  assert.deepEqual(resolveMeetingGuests({ ...base, isProduction: false, invitedHomeownerEmail: null }), { attendees: [], homeownerEmail: null })
}
console.log('18. Meeting guests ✓')

{
  const at = (start: string, homeownerEmail: string | null, location = '1 Main St') => ({ start, location, homeownerEmail })
  const T = '2026-10-20T17:00:00.000Z'
  const noticeNow = new Date('2026-10-19T17:00:00.000Z')
  const sameInstantOtherFormat = '2026-10-20T10:00:00-07:00'
  assert.equal(decideCalendarNotice(null, at(T, null), noticeNow), 'none', 'a new event without the homeowner emails nobody')
  assert.equal(decideCalendarNotice(null, at(T, 'maria@example.com'), noticeNow), 'notify', 'a new event with the homeowner is their invite')
  assert.equal(decideCalendarNotice(at(T, null), at(T, 'maria@example.com'), noticeNow), 'notify', 'homeowner added')
  assert.equal(decideCalendarNotice(at(T, 'maria@example.com'), at(T, null), noticeNow), 'notify', 'homeowner removed: Google cancels for them')
  assert.equal(decideCalendarNotice(at(T, 'maria@example.com'), at(T, 'maria.new@example.com'), noticeNow), 'notify', 'a changed email swaps the guest in one update')
  assert.equal(decideCalendarNotice(at(T, 'maria@example.com'), at('2026-10-21T17:00:00.000Z', 'maria@example.com'), noticeNow), 'notify', 'start moved')
  assert.equal(decideCalendarNotice(at(T, 'maria@example.com'), at(T, 'maria@example.com', '2 Oak Ave'), noticeNow), 'notify', 'location moved')
  assert.equal(decideCalendarNotice(at(sameInstantOtherFormat, 'Maria@Example.com'), at(T, 'maria@example.com'), noticeNow), 'none', 'Google already matches: a retry sends nothing')
  assert.equal(decideCalendarNotice(at(T, null), at('2026-10-21T17:00:00.000Z', null), noticeNow), 'none', 'staff-only changes stay silent')
  assert.equal(decideCalendarNotice(at(T, 'maria@example.com', ' 1 Main St '), at(T, 'maria@example.com'), noticeNow), 'none', 'a note, trades or title change alone is silent')

  assert.equal(decideCalendarNotice(at('2026-10-18T17:00:00.000Z', null), at('2026-10-18T17:00:00.000Z', 'maria@example.com'), noticeNow), 'none', 'a visit that has started gets no emails')
  assert.equal(decideCalendarNotice(at('2026-10-18T17:00:00.000Z', 'maria@example.com'), at(T, 'maria@example.com'), noticeNow), 'notify', 'a past visit moved to the future notifies')

  const now = new Date('2026-10-19T17:00:00.000Z')
  assert.equal(decideCancellationNotice({ homeownerInvited: true, scheduledFor: T, now }), 'notify')
  assert.equal(decideCancellationNotice({ homeownerInvited: true, scheduledFor: '2026-10-19T16:00:00.000Z', now }), 'none', 'no cancellation for a visit that has happened')
  assert.equal(decideCancellationNotice({ homeownerInvited: false, scheduledFor: T, now }), 'none')

  assert.equal(toSendUpdates('notify', { isProduction: true }), 'externalOnly', 'staff on the company domain stay silent')
  assert.equal(toSendUpdates('notify', { isProduction: false }), 'all', 'the dev override sits on the company domain, which externalOnly never emails')
  assert.equal(toSendUpdates('none', { isProduction: true }), 'none')

  const current = {
    id: 'e',
    summary: 's',
    etag: 'x',
    updated: T,
    status: 'confirmed' as const,
    start: { dateTime: sameInstantOtherFormat },
    end: { dateTime: sameInstantOtherFormat },
    location: '1 Main St',
    attendees: [{ email: 'maria@example.com', responseStatus: 'accepted' as const }, { email: 'rep@triprosremodeling.com', responseStatus: 'needsAction' as const }],
    extendedProperties: homeownerMarker('maria@example.com'),
  }
  assert.deepEqual(noticeStateFromEvent(current), { start: sameInstantOtherFormat, location: '1 Main St', homeownerEmail: 'maria@example.com' })
  assert.equal(noticeStateFromEvent({ ...current, attendees: [current.attendees[1]] }).homeownerEmail, null, 'removed in Google: no longer a guest')
  assert.equal(noticeStateFromEvent({ ...current, extendedProperties: undefined }).homeownerEmail, null, 'an event from before the marker has no homeowner')
  assert.deepEqual(
    carryAttendeeResponses([{ email: 'Maria@example.com' }, { email: 'new@triprosremodeling.com' }], current.attendees),
    [{ email: 'Maria@example.com', responseStatus: 'accepted' }, { email: 'new@triprosremodeling.com' }],
    'the homeowner keeps their Yes across an update',
  )
}
console.log('19. Calendar notices ✓')

{
  assert.equal(rescheduledOriginalOutcome('not_set'), 'rescheduled')
  assert.equal(rescheduledOriginalOutcome('reschedule_needed'), 'rescheduled')
  assert.equal(rescheduledOriginalOutcome('no_show'), null, 'a no-show rebooked keeps its no-show')
  assert.equal(rescheduledOriginalOutcome('cancelled'), null, 'a cancellation rebooked keeps its cancellation')
}
console.log('20. Reschedule original outcome ✓')

{
  const vars = buildVisitMessageVars({ customerName: 'Maria Lopez', specialistName: null, coordinatorName: 'Dana', scheduledFor: '2026-10-20T17:00:00.000Z', visitLink: 'https://example.com/v', visitNote: 'Please park in the driveway.' })
  const withNote = renderVisitMessage(VISIT_MESSAGE_TEMPLATE_DEFAULTS.visit_summary, vars, { stopLine: true })
  assert.ok(withNote.includes('One more thing: Please park in the driveway.'), withNote)
  const withoutNote = renderVisitMessage(VISIT_MESSAGE_TEMPLATE_DEFAULTS.visit_summary, { ...vars, visitNote: '' }, { stopLine: true })
  assert.ok(!withoutNote.includes('One more thing'), 'the section drops out with no note')
  assert.ok(!/calendar|\.ics/i.test(withNote), 'the welcome text carries no calendar link')
}
console.log('21. Welcome text and the visit note ✓')

{
  const cases = [
    ['not_set', 'cancelled', false, 'the cancel transition deletes the event itself'],
    ['cancelled', 'not_set', true, 'un-cancelling puts the visit back on the calendar'],
    ['rescheduled', 'not_set', true, 'an original brought back gets its event back'],
    ['not_set', 'rescheduled', true, 'a moved visit leaves the calendar'],
    ['not_set', 'no_show', false, 'a no-show keeps its past event'],
    ['cancelled', 'cancelled', false, 'no change, no sync'],
  ] as const
  for (const [previous, next, expected, why] of cases) {
    assert.equal(outcomeChangeNeedsSync(previous, next), expected, `${previous} → ${next}: ${why}`)
  }
}
console.log('22. Outcome changes that sync the calendar ✓')

{
  assert.equal(rescheduleBlockedReason('not_set'), null)
  assert.equal(rescheduleBlockedReason('no_show'), null)
  assert.equal(rescheduleBlockedReason('rescheduled'), RESCHEDULED_ORIGINAL_REASON, 'a moved visit points at its replacement')
  const happened = rescheduleBlockedReason('converted_to_project')
  assert.ok(happened && happened !== RESCHEDULED_ORIGINAL_REASON && happened.includes('already happened'), String(happened))
}
console.log('23. Reschedule blocked reasons ✓')

console.log('✅ verify-visit-messages passed')
