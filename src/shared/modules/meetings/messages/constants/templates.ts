import type { VisitMessageTemplateKey } from '@/shared/modules/meetings/messages/constants/kinds'
import type { VisitMessageVars } from '@/shared/modules/meetings/messages/types'
import type { MergeToken } from '@/shared/services/voip/lib/sms-merge-template'

import { APP_HOSTS, ROOTS } from '@/shared/config/roots'
import { companyInfo } from '@/shared/constants/company'

/** Appended by the renderer on the first text of a thread, so an edit cannot remove it. */
export const VISIT_MESSAGE_STOP_LINE = 'Reply STOP to opt out.'

/** A booking can land before a rep is assigned. */
export const REP_NAME_FALLBACK = 'your rep'

// The length of a real link, so a preview counts the segments a homeowner's text will use.
const VISIT_LINK_SAMPLE = `https://${APP_HOSTS.prod[0]}${ROOTS.public.homeVisit('00000000-0000-4000-8000-000000000000', '0'.repeat(32))}`

export const VISIT_MESSAGE_TOKENS = [
  { token: 'first_name', label: 'First name', sample: 'Maria', resolve: vars => vars.firstName },
  { token: 'rep_name', label: 'Rep name', sample: 'Oliver', resolve: vars => vars.repName ?? REP_NAME_FALLBACK },
  { token: 'visit_date', label: 'Visit date', sample: 'Wed, Oct 7', resolve: vars => vars.visitDate },
  { token: 'visit_time', label: 'Visit time', sample: '10:00 AM', resolve: vars => vars.visitTime },
  { token: 'arrival_window', label: 'Arrival window', sample: '10:00 and 10:30 AM', resolve: vars => vars.arrivalWindow },
  { token: 'visit_link', label: 'Visit link', sample: VISIT_LINK_SAMPLE, resolve: vars => vars.visitLink },
  { token: 'office_note', label: 'Office note', sample: '', resolve: vars => vars.officeNote },
] as const satisfies readonly MergeToken<VisitMessageVars>[]

/** Typed into the send dialog, so only the summary has one. */
export const VISIT_MESSAGE_SUMMARY_ONLY_TOKENS: readonly string[] = ['office_note']

export const VISIT_MESSAGE_REQUIRED_TOKENS: Record<VisitMessageTemplateKey, readonly string[]> = {
  visit_summary: ['visit_link', 'visit_date', 'visit_time'],
  day_before_reminder_unconfirmed: ['visit_link', 'visit_time'],
  day_before_reminder_confirmed: ['visit_link', 'visit_time'],
  rep_confirmation: ['rep_name', 'arrival_window', 'visit_link'],
  confirmation_reply: ['visit_date', 'visit_time'],
}

export const VISIT_MESSAGE_TEMPLATE_DEFAULTS: Record<VisitMessageTemplateKey, string> = {
  visit_summary: `Hi {{first_name}}, this is ${companyInfo.name}. Your home visit is booked for {{visit_date}} at {{visit_time}} with {{rep_name}}. {{office_note}} Meet {{rep_name}} and see your visit details: {{visit_link}} Reply YES to confirm.`,
  day_before_reminder_unconfirmed: `Hi {{first_name}}, a reminder that {{rep_name}} from ${companyInfo.name} will see you tomorrow, {{visit_date}} at {{visit_time}}. Reply YES to confirm, or request a new time here: {{visit_link}}`,
  day_before_reminder_confirmed: `Hi {{first_name}}, see you tomorrow at {{visit_time}}! {{rep_name}} is looking forward to meeting you. Your visit: {{visit_link}} - ${companyInfo.name}`,
  rep_confirmation: `Good morning {{first_name}}! {{rep_name}} just confirmed your home visit and is scheduled to arrive between {{arrival_window}}. Your visit page: {{visit_link}} - ${companyInfo.name}`,
  confirmation_reply: `Thank you, {{first_name}}, you're confirmed for {{visit_date}} at {{visit_time}}. See you then! - ${companyInfo.name}`,
}
