/**
 * Smoke test for the home-visit message flow: the real services against the dev database, one throwaway
 * customer and its meetings, everything deleted at the end.
 *
 *   pnpm tsx --import ./scripts/lib/stub-server-only.mjs scripts/smoke-visit-flow.ts          # Twilio + Google faked, nothing leaves
 *   pnpm tsx --import ./scripts/lib/stub-server-only.mjs scripts/smoke-visit-flow.ts --live   # real texts to the override phone, real events on the dev calendar
 *
 * Replies are always simulated by calling the inbound handler directly. Jobs never reach QStash: the calendar
 * jobs run inline, the rest are only recorded. Exit code 1 on any FAIL; GAP lines are open decisions, not failures.
 */
/* eslint-disable perfectionist/sort-imports -- load-env must run before any module that reads process.env */
import './lib/load-env'
import type { GCalEvent, GCalEventInput, GCalSendUpdates } from '@/shared/services/providers/google-calendar/types'
import process from 'node:process'
import { Client as QstashClient } from '@upstash/qstash'
import { and, eq, inArray, like, or } from 'drizzle-orm'
import { isProductionData } from '@/shared/config/data-target'
import env from '@/shared/config/server-env'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { customerNotes } from '@/shared/db/schema/customer-notes'
import { customers } from '@/shared/db/schema/customers'
import { meetingMessages } from '@/shared/db/schema/meeting-messages'
import { meetingParticipants } from '@/shared/db/schema/meeting-participants'
import { meetings } from '@/shared/db/schema/meetings'
import { voipMessages } from '@/shared/db/schema/voip-messages'
import { getSystemOwnerId } from '@/shared/entities/users/dal/server/system'
import { toNationalDigits } from '@/shared/lib/phone'
import { meetingService } from '@/shared/modules/meetings/service'
import { notificationService } from '@/shared/services/notification.service'
import { GCalRequestError, googleCalendarClient } from '@/shared/services/providers/google-calendar/client'
import { twilioClient } from '@/shared/services/providers/twilio/client'
import { deleteMeetingEventJob } from '@/shared/services/providers/upstash/jobs/delete-meeting-event'
import { syncMeetingToGcalJob } from '@/shared/services/providers/upstash/jobs/sync-meeting-to-gcal'
import { realtimeClient } from '@/shared/services/providers/upstash/realtime'
import { webPushClient } from '@/shared/services/providers/web-push/client'
import { schedulingService } from '@/shared/services/scheduling.service'
import { voipDidsService } from '@/shared/services/voip/voip-dids.service'
/* eslint-enable perfectionist/sort-imports */

const LIVE = process.argv.includes('--live')
const DAY = 24 * 60 * 60 * 1000
const SMOKE_PHONE = '8185550142'
const STRANGER_PHONE = '8185550143'
const INTERNAL_MARKER = 'SMOKE-INTERNAL-ONLY'

// ── Recorders ────────────────────────────────────────────────────────────────

interface TextSent { to: string, body: string }
interface CalendarCall { op: 'create' | 'update' | 'delete', eventId: string, sendUpdates: GCalSendUpdates, event?: GCalEventInput }
interface Notified { kind: 'reply' | 'opt_out', customerName: string, meetingId: string | null }

const texts: TextSent[] = []
const calendar: CalendarCall[] = []
const notified: Notified[] = []
const jobQueue: Array<{ key: string, payload: any }> = []
const jobsSeen: string[] = []
const jobPayloads: unknown[] = []

function mark() {
  return { texts: texts.length, calendar: calendar.length, notified: notified.length, jobs: jobsSeen.length }
}
function since<T>(list: T[], from: number) {
  return list.slice(from)
}

// ── Edges ────────────────────────────────────────────────────────────────────

;(QstashClient.prototype as any).publishJSON = async (request: { url: string, body: unknown }) => {
  const key = new URL(request.url).searchParams.get('job') ?? request.url
  jobsSeen.push(key)
  jobPayloads.push(request.body)
  jobQueue.push({ key, payload: request.body })
  return { messageId: 'smoke' }
}
;(realtimeClient as any).publish = async () => {}
;(webPushClient as any).sendToUser = async () => ({ sent: 0, failed: 0 })
;(webPushClient as any).sendToUsers = async () => ({ sent: 0, failed: 0 })
;(notificationService as any).notifyHomeownerReply = async (params: { customerName: string, meetingId: string | null }) => {
  notified.push({ kind: 'reply', customerName: params.customerName, meetingId: params.meetingId })
}
;(notificationService as any).notifyHomeownerOptedOut = async (params: { customerName: string, meetingId: string | null }) => {
  notified.push({ kind: 'opt_out', customerName: params.customerName, meetingId: params.meetingId })
}

const realSendMessage = twilioClient.sendMessage.bind(twilioClient)
let sidCounter = 0
;(twilioClient as any).sendMessage = async (params: { to: string, body: string }) => {
  texts.push({ to: params.to, body: params.body })
  if (LIVE) {
    return realSendMessage(params as any)
  }
  return { sid: `SMsmokeout${++sidCounter}`, status: 'queued' }
}

// The fake behaves like Google where the sync depends on it (checked against the dev calendar 2026-10-12): a create takes
// a network round trip, an id is refused with 409 while ANY event holds it, a deleted event stays as a `cancelled`
// tombstone that GET still returns, and a PUT with `status: 'confirmed'` brings a tombstone back.
const fakeEvents = new Map<string, GCalEvent>()
const realCalendar = { ...googleCalendarClient }
let etagCounter = 0
const roundTrip = () => new Promise(resolve => setTimeout(resolve, 150))
Object.assign(googleCalendarClient, {
  createEvent: async (token: string, calendarId: string, event: GCalEventInput, sendUpdates: GCalSendUpdates) => {
    let created: GCalEvent
    if (LIVE) {
      created = await realCalendar.createEvent(token, calendarId, event, sendUpdates)
    }
    else {
      await roundTrip()
      if (event.id && fakeEvents.has(event.id)) {
        throw new GCalRequestError(409, 'Google Calendar createEvent failed (409): duplicate')
      }
      created = { ...event, id: event.id ?? `smokeevt${fakeEvents.size + 1}`, etag: `"${++etagCounter}"`, updated: new Date().toISOString(), status: 'confirmed' } as GCalEvent
    }
    fakeEvents.set(created.id, created)
    calendar.push({ op: 'create', eventId: created.id, sendUpdates, event })
    return created
  },
  getEvent: async (token: string, calendarId: string, eventId: string) => {
    if (LIVE) {
      return realCalendar.getEvent(token, calendarId, eventId)
    }
    const found = fakeEvents.get(eventId)
    if (!found) {
      throw new GCalRequestError(404, `fake calendar has no event ${eventId}`)
    }
    return found
  },
  updateEvent: async (token: string, calendarId: string, eventId: string, event: GCalEventInput, sendUpdates: GCalSendUpdates, etag?: string) => {
    let updated: GCalEvent
    if (LIVE) {
      updated = await realCalendar.updateEvent(token, calendarId, eventId, event, sendUpdates, etag)
    }
    else {
      const existing = fakeEvents.get(eventId)
      if (etag && existing && existing.etag !== etag) {
        throw new GCalRequestError(412, 'Google Calendar updateEvent failed (412): precondition')
      }
      updated = { ...event, id: eventId, etag: `"${++etagCounter}"`, updated: new Date().toISOString(), status: event.status ?? existing?.status ?? 'confirmed' } as GCalEvent
    }
    fakeEvents.set(eventId, updated)
    calendar.push({ op: 'update', eventId, sendUpdates, event })
    return updated
  },
  deleteEvent: async (token: string, calendarId: string, eventId: string, sendUpdates: GCalSendUpdates) => {
    if (LIVE) {
      await realCalendar.deleteEvent(token, calendarId, eventId, sendUpdates)
    }
    const existing = fakeEvents.get(eventId)
    if (existing) {
      fakeEvents.set(eventId, { ...existing, status: 'cancelled', etag: `"${++etagCounter}"` })
    }
    calendar.push({ op: 'delete', eventId, sendUpdates })
  },
})

/** Whether the meeting's linked event is on the calendar (not a tombstone). Unknowable in LIVE mode without a read, so it reads. */
async function linkedEventIsLive(meetingId: string) {
  const row = await readMeeting(meetingId)
  if (!row.gcalEventId) {
    return false
  }
  if (LIVE) {
    return true
  }
  return fakeEvents.get(row.gcalEventId)?.status === 'confirmed'
}

/** What QStash would have delivered: the calendar jobs run here, in order; the rest stay recorded only. */
async function drainJobs() {
  while (jobQueue.length) {
    const { key, payload } = jobQueue.shift()!
    if (key === syncMeetingToGcalJob.key) {
      await syncMeetingToGcalJob.handler(payload)
    }
    else if (key === deleteMeetingEventJob.key) {
      await deleteMeetingEventJob.handler(payload)
    }
  }
}

// ── Reporting ────────────────────────────────────────────────────────────────

const results: Array<{ status: 'PASS' | 'FAIL' | 'GAP', step: string, detail: string }> = []
function check(step: string, ok: boolean, detail: string) {
  results.push({ status: ok ? 'PASS' : 'FAIL', step, detail })
}
function gap(step: string, detail: string) {
  results.push({ status: 'GAP', step, detail })
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

let customerId: string | null = null
let customerName = ''
const meetingIds: string[] = []
let inboundCounter = 0
let mainLineE164 = ''

async function createMeeting(daysAhead: number, visitNote?: string) {
  const created = await meetingService.create(SYSTEM_CONTEXT, {
    customerId: customerId!,
    ownerId: await getSystemOwnerId(),
    meetingType: 'Fresh',
    scheduledFor: new Date(Date.now() + daysAhead * DAY).toISOString(),
    visitNote,
  } as any)
  if (!created.success) {
    throw new Error(`could not create a meeting: ${JSON.stringify(created.error)}`)
  }
  meetingIds.push(created.data.id)
  return created.data
}

async function readMeeting(id: string) {
  const [row] = await db.select().from(meetings).where(eq(meetings.id, id))
  return row
}

async function reply(from: string, body: string, optOutType: 'STOP' | 'START' | 'HELP' | null = null) {
  const handled = await meetingService.business.handleHomeownerReply(SYSTEM_CONTEXT, {
    providerMessageId: `SMsmokein${++inboundCounter}${Date.now()}`,
    from,
    to: mainLineE164,
    body,
    mediaCount: 0,
    optOutType: optOutType as any,
  })
  if (!handled.success) {
    throw new Error(`reply handler failed: ${JSON.stringify(handled.error)}`)
  }
  await drainJobs()
  return handled.data
}

const e164 = (national: string) => `+1${national}`

// ── Steps ────────────────────────────────────────────────────────────────────

async function run() {
  if (isProductionData()) {
    throw new Error('Refusing to run: this process points at production data.')
  }
  const overrideE164 = env.VOIP_DEV_OVERRIDE_NUMBER
  if (!overrideE164 || !env.EMAIL_DEV_OVERRIDE) {
    throw new Error('VOIP_DEV_OVERRIDE_NUMBER and EMAIL_DEV_OVERRIDE must both be set.')
  }
  const mainLine = await voipDidsService.getMainLineDid()
  if (!mainLine.success || !mainLine.data) {
    throw new Error('No main line in the dev database.')
  }
  mainLineE164 = mainLine.data.e164
  const taken = await db.select({ id: customers.id }).from(customers).where(inArray(customers.phone, [SMOKE_PHONE, STRANGER_PHONE]))
  if (taken.length) {
    throw new Error(`A customer already holds ${SMOKE_PHONE} or ${STRANGER_PHONE}; a previous run did not clean up. Delete it by hand.`)
  }

  customerName = `ZZ Smoke ${new Date().toISOString().slice(11, 19)}`
  const [customer] = await db.insert(customers).values({
    name: customerName,
    email: 'smoke@example.invalid',
    phone: SMOKE_PHONE,
    city: 'Smoke',
    zip: '00000',
  } as any).returning()
  customerId = customer.id

  // 0. Booking: the office event exists, with no guests and no email.
  let at = mark()
  const visit = await createMeeting(3, 'Gate code 1234')
  await db.insert(customerNotes).values({ customerId, content: INTERNAL_MARKER, entityType: 'meeting', entityId: visit.id } as any)
  await drainJobs()
  const booked = since(calendar, at.calendar)
  check('0 booking', booked.length === 1 && booked[0].op === 'create' && booked[0].sendUpdates === 'none' && !(booked[0].event?.attendees?.length), `calendar: ${JSON.stringify(booked.map(c => ({ op: c.op, sendUpdates: c.sendUpdates, guests: c.event?.attendees?.map(a => a.email) })))}`)

  // 1. Welcome text: link, no calendar link, invite stored, Google invites the (override) inbox.
  at = mark()
  const welcome = await meetingService.business.sendVisitSummary(SYSTEM_CONTEXT, { meetingId: visit.id })
  await drainJobs()
  const afterWelcome = await readMeeting(visit.id)
  const welcomeText = since(texts, at.texts)[0]
  check('1a welcome text sent', welcome.success && welcomeText != null && welcomeText.to === overrideE164, welcome.success ? `sms ${welcome.data.sms.status} → ${welcomeText?.to ?? 'nothing'}` : JSON.stringify(welcome.error))
  check('1b text carries the visit link, no calendar link', welcomeText != null && welcomeText.body.includes(afterWelcome.shareToken) && !/\.ics|calendar\.google|add to calendar/i.test(welcomeText.body), welcomeText ? JSON.stringify(welcomeText.body.slice(0, 160)) : 'no text')
  check('1c invite stored', welcome.success && welcome.data.invite === 'invited' && afterWelcome.homeownerInvitedAt != null, `invite: ${welcome.success ? welcome.data.invite : '-'}`)
  const invited = since(calendar, at.calendar)
  const inviteCall = invited.find(c => c.op === 'update')
  check('1d Google invites the override inbox', invited.length === 1 && inviteCall?.sendUpdates === 'all' && inviteCall.event?.attendees?.some(a => a.email === env.EMAIL_DEV_OVERRIDE) === true, JSON.stringify(invited.map(c => ({ op: c.op, sendUpdates: c.sendUpdates, guests: c.event?.attendees?.map(a => a.email) }))))
  const description = inviteCall?.event?.description ?? ''
  check('1e event shows the visit note and nothing internal', description.includes('Gate code 1234') && !description.includes(INTERNAL_MARKER) && description.includes(afterWelcome.shareToken), JSON.stringify(description.slice(0, 200)))

  // 2. YES from the homeowner's own number (production shape). Twilio flags a YES as START.
  at = mark()
  const yes = await reply(e164(SMOKE_PHONE), 'Yes', 'START')
  const confirmedRow = await readMeeting(visit.id)
  check('2 YES from the homeowner confirms and thanks them', yes.action === 'confirmed' && yes.meetingId === visit.id && confirmedRow.homeownerConfirmedAt != null
  && since(texts, at.texts).length === 1 && since(notified, at.notified).length === 0, `action ${yes.action}, texts ${since(texts, at.texts).length}, office notified ${since(notified, at.notified).length}`)

  // 3. YES from the override phone (dev): every dev text lands there, so a dev reply comes from there.
  at = mark()
  const devYes = await reply(overrideE164, 'Yes', 'START')
  const devNotified = since(notified, at.notified)
  check('3 dev reply from the override phone reaches the visit texted last', devYes.meetingId === visit.id, `action ${devYes.action}, meeting ${devYes.meetingId ?? 'none'}, office notified as ${devNotified.map(n => n.customerName).join(', ') || 'nobody'}`)

  // 4. Free text: the office hears it under the right name.
  at = mark()
  const free = await reply(e164(SMOKE_PHONE), 'Can we make it 3pm instead?')
  const freeNotified = since(notified, at.notified)
  check('4 free text goes to the office under the right name', free.action === 'forwarded' && freeNotified[0]?.customerName === customerName && freeNotified[0]?.meetingId === visit.id, `action ${free.action}, notified ${JSON.stringify(freeNotified)}`)

  // 5. A YES nobody can place.
  at = mark()
  const stranger = await reply(e164(STRANGER_PHONE), 'Yes', 'START')
  check('5 unmatched reply reaches the office', since(notified, at.notified).length === 1, `action ${stranger.action}`)
  if (since(texts, at.texts).length === 0) {
    gap('5 unmatched reply', 'the sender gets no answer at all (no visit found). Decide: a generic "we got your message" reply, or silence.')
  }

  // 6. Visit note edit: the event follows, nobody is emailed.
  at = mark()
  const edited = await meetingService.update(SYSTEM_CONTEXT, { id: visit.id, data: { visitNote: 'Gate code 9999' } } as any)
  await drainJobs()
  const noteCalls = since(calendar, at.calendar)
  check('6 visit note edit updates the event quietly', edited.success && noteCalls.length === 1 && noteCalls[0].op === 'update' && noteCalls[0].sendUpdates === 'none' && (noteCalls[0].event?.description ?? '').includes('Gate code 9999'), JSON.stringify(noteCalls.map(c => ({ op: c.op, sendUpdates: c.sendUpdates }))))

  // 7. Reschedule: the visit moves to a new meeting; Google sends one update.
  at = mark()
  const before = await readMeeting(visit.id)
  const moved = await meetingService.business.reschedule(SYSTEM_CONTEXT, { meetingId: visit.id, newScheduledFor: new Date(Date.now() + 4 * DAY).toISOString(), reason: 'smoke test' })
  if (!moved.success) {
    throw new Error(`reschedule failed: ${JSON.stringify(moved.error)}`)
  }
  meetingIds.push(moved.data.id)
  const syncTargets = since(jobsSeen, at.jobs).flatMap((key, i) => key === syncMeetingToGcalJob.key ? [(jobPayloads[at.jobs + i] as { meetingId: string }).meetingId] : [])
  await drainJobs()
  const original = await readMeeting(visit.id)
  const replacement = await readMeeting(moved.data.id)
  const moveCalls = since(calendar, at.calendar)
  check('7a original reads Rescheduled, replacement owns link + event + invite', original.meetingOutcome === 'rescheduled' && replacement.shareToken === before.shareToken
  && replacement.gcalEventId === before.gcalEventId && replacement.homeownerInvitedAt != null && original.gcalEventId == null, `original ${original.meetingOutcome}, token moved ${replacement.shareToken === before.shareToken}, event moved ${replacement.gcalEventId === before.gcalEventId}`)
  // The original's own sync (it entered rescheduled) finds no event after the hand-off, so it writes nothing.
  check('7b Google gets one update and sends one "Updated invitation"', syncTargets.includes(moved.data.id) && moveCalls.length === 1 && moveCalls[0].op === 'update' && moveCalls[0].eventId === replacement.gcalEventId && moveCalls[0].sendUpdates === 'all', `syncs for ${syncTargets.map(id => id === visit.id ? 'original' : id === moved.data.id ? 'replacement' : id).join(' + ')}, calendar ${JSON.stringify(moveCalls.map(c => ({ op: c.op, sendUpdates: c.sendUpdates })))}`)

  // 8. Cancel the replacement: Google sends its cancellation.
  at = mark()
  const cancelled = await meetingService.business.setOutcomeWithReason(SYSTEM_CONTEXT, { meetingId: moved.data.id, outcome: 'cancelled', reason: 'smoke test' })
  await drainJobs()
  const cancelCalls = since(calendar, at.calendar)
  check('8 cancel deletes the event and Google emails the homeowner', cancelled.success && cancelCalls.length === 1 && cancelCalls[0].op === 'delete' && cancelCalls[0].sendUpdates === 'all', JSON.stringify(cancelCalls.map(c => ({ op: c.op, sendUpdates: c.sendUpdates }))))

  // 9. STOP: do-not-contact.
  at = mark()
  const stop = await reply(e164(SMOKE_PHONE), 'STOP', 'STOP')
  const [afterStop] = await db.select({ dnc: customers.dncOptedOutAt }).from(customers).where(eq(customers.id, customerId))
  check('9 STOP puts the customer on do-not-contact', stop.action === 'opt_out' && afterStop.dnc != null && since(notified, at.notified).some(n => n.kind === 'opt_out'), `action ${stop.action}, dnc ${afterStop.dnc ?? 'not set'}`)

  // The calendar under stress, faked only: these rounds invite the homeowner, so LIVE would email the override inbox each time.
  if (!LIVE) {
    const invitedNotices = (from: number) => since(calendar, from).filter(c => c.sendUpdates === 'all').length

    // R1. A QStash retry overlapping the first run: two syncs of one invited, never-synced meeting.
    const fresh = await createMeeting(5)
    jobQueue.length = 0
    await db.update(meetings).set({ homeownerInvitedAt: new Date().toISOString() }).where(eq(meetings.id, fresh.id))
    at = mark()
    await Promise.all([schedulingService.syncMeeting(fresh.id), schedulingService.syncMeeting(fresh.id)])
    const raceCreates = since(calendar, at.calendar).filter(c => c.op === 'create').length
    check('R1 two overlapping syncs make one event and one invite', raceCreates === 1 && invitedNotices(at.calendar) === 1 && await linkedEventIsLive(fresh.id), `events created ${raceCreates}, invites ${invitedNotices(at.calendar)}`)
    const eventId = (await readMeeting(fresh.id)).gcalEventId

    // R2. Cancel, then un-cancel: the same event comes back and the homeowner is invited again.
    const cancelFresh = () => meetingService.business.setOutcomeWithReason(SYSTEM_CONTEXT, { meetingId: fresh.id, outcome: 'cancelled', reason: 'smoke test' })
    const uncancelFresh = () => meetingService.update(SYSTEM_CONTEXT, { id: fresh.id, data: { meetingOutcome: 'not_set' } } as any)
    await cancelFresh()
    await drainJobs()
    at = mark()
    await uncancelFresh()
    await drainJobs()
    const restored = await readMeeting(fresh.id)
    check('R2 un-cancel restores the same event and re-invites', restored.gcalEventId === eventId && await linkedEventIsLive(fresh.id) && invitedNotices(at.calendar) === 1, `event ${restored.gcalEventId === eventId ? 'same' : `changed ${eventId} → ${restored.gcalEventId}`}, live ${await linkedEventIsLive(fresh.id)}, invites ${invitedNotices(at.calendar)}`)

    // R3. Un-cancelled before the cancellation's delete job ran: the late delete must not take the event back off.
    await cancelFresh()
    await uncancelFresh()
    jobQueue.reverse()
    await drainJobs()
    check('R3 a late cancellation delete leaves an un-cancelled visit on the calendar', await linkedEventIsLive(fresh.id), `linked ${(await readMeeting(fresh.id)).gcalEventId ?? 'none'}, live ${await linkedEventIsLive(fresh.id)}`)
  }
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanup() {
  if (!customerId) {
    return
  }
  if (LIVE) {
    const leftover = await db.select({ gcalEventId: meetings.gcalEventId }).from(meetings).where(eq(meetings.customerId, customerId))
    for (const { gcalEventId } of leftover) {
      if (gcalEventId) {
        await schedulingService.deleteMeetingEvent({ gcalEventId, notice: 'none' })
      }
    }
  }
  const ourMessages = or(
    eq(voipMessages.customerId, customerId),
    like(voipMessages.providerMessageId, 'SMsmoke%'),
    inArray(voipMessages.remoteE164, [e164(SMOKE_PHONE), e164(STRANGER_PHONE)]),
  )
  const messageIds = (await db.select({ id: voipMessages.id }).from(voipMessages).where(ourMessages)).map(row => row.id)
  if (meetingIds.length) {
    await db.delete(meetingMessages).where(inArray(meetingMessages.meetingId, meetingIds))
    await db.delete(meetingParticipants).where(inArray(meetingParticipants.meetingId, meetingIds))
  }
  if (messageIds.length) {
    await db.delete(meetingMessages).where(inArray(meetingMessages.voipMessageId, messageIds))
    await db.delete(voipMessages).where(inArray(voipMessages.id, messageIds))
  }
  await db.delete(customerNotes).where(eq(customerNotes.customerId, customerId))
  await db.delete(meetings).where(eq(meetings.customerId, customerId))
  await db.delete(customers).where(and(eq(customers.id, customerId), eq(customers.phone, SMOKE_PHONE)))
  const [left] = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId))
  console.log(left ? '\n⚠ cleanup left the smoke customer behind' : '\ncleanup: smoke customer, meetings, notes and messages deleted')
}

run()
  .catch((error) => {
    results.push({ status: 'FAIL', step: 'aborted', detail: error instanceof Error ? error.message : String(error) })
  })
  .finally(async () => {
    try {
      await cleanup()
    }
    catch (error) {
      console.error('cleanup failed', error)
      process.exitCode = 1
    }
    console.log(`\nVisit flow smoke (${LIVE ? 'LIVE: real texts + dev calendar' : 'faked Twilio + Google'}), ${toNationalDigits(env.VOIP_DEV_OVERRIDE_NUMBER)?.slice(-4) ? `override …${toNationalDigits(env.VOIP_DEV_OVERRIDE_NUMBER)?.slice(-4)}` : ''}`)
    for (const result of results) {
      console.log(`${result.status.padEnd(4)}  ${result.step}  —  ${result.detail}`)
    }
    const failed = results.filter(result => result.status === 'FAIL').length
    console.log(`\n${results.filter(r => r.status === 'PASS').length} pass · ${failed} fail · ${results.filter(r => r.status === 'GAP').length} open decisions`)
    if (failed) {
      process.exitCode = 1
    }
    process.exit()
  })
