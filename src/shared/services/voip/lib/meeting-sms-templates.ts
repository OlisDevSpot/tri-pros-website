import { BUSINESS_TIMEZONE } from '@/shared/lib/business-time'

// Every customer-facing text opens with the brand and closes with a reply instruction.
// Carriers score unbranded, instruction-less bursts as spam; 10DLC vetting also expects
// the sample messages we registered to match what we actually send.
const BRAND = 'Tri Pros Remodeling'

// One GSM-7 segment. Two segments are fine but cost double and split on old handsets.
export const SMS_SEGMENT_CHARS = 160

export interface MeetingSmsVars {
  customerName: string
  agentName: string
  scheduledFor: string
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Sent right after booking. Sets the expectation that a reminder is coming so the later text is recognised, not reported. */
export function bookingConfirmationBody(vars: MeetingSmsVars): string {
  return `${BRAND}: Hi ${firstName(vars.customerName)}, ${firstName(vars.agentName)} is booked to visit you ${formatDay(vars.scheduledFor)} at ${formatTime(vars.scheduledFor)}. We'll text a reminder the day before. Reply STOP to opt out.`
}

/** The 6 pm day-before text. Asks for a one-letter reply so confirmation needs no link and no app. */
export function dayBeforeReminderBody(vars: MeetingSmsVars): string {
  return `${BRAND}: Hi ${firstName(vars.customerName)}, ${firstName(vars.agentName)} is coming by tomorrow (${formatDay(vars.scheduledFor)}) at ${formatTime(vars.scheduledFor)} and we're looking forward to it! Reply C to confirm or R to reschedule.`
}

export function confirmedReplyBody(vars: MeetingSmsVars): string {
  return `${BRAND}: Thanks ${firstName(vars.customerName)}, you're confirmed for ${formatDay(vars.scheduledFor)} at ${formatTime(vars.scheduledFor)}. See you then!`
}

export function rescheduleReplyBody(vars: Pick<MeetingSmsVars, 'agentName'>): string {
  return `${BRAND}: No problem. ${firstName(vars.agentName)} will reach out shortly to find a time that works better.`
}

export type ReminderReplyIntent = 'confirm' | 'reschedule' | 'other'

// Single letters plus the words people actually type. Anything else routes to a human.
const CONFIRM_REGEX = /^(?:c|y|yes|confirm|confirmed|ok|okay)\b/i
const RESCHEDULE_REGEX = /^(?:r|n|no|reschedule|change|cancel)\b/i

export function classifyReminderReply(body: string): ReminderReplyIntent {
  const text = body.trim()
  if (CONFIRM_REGEX.test(text)) {
    return 'confirm'
  }
  if (RESCHEDULE_REGEX.test(text)) {
    return 'reschedule'
  }
  return 'other'
}
