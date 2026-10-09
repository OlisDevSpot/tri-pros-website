import type { VisitMessageTemplateKey } from '@/shared/modules/meetings/messages/constants/kinds'
import type { VisitMessageVars } from '@/shared/modules/meetings/messages/types'
import type { MergeToken } from '@/shared/services/voip/lib/sms-merge-template'

import { APP_HOSTS, ROOTS } from '@/shared/config/roots'
import { companyInfo } from '@/shared/constants/company'

/** Appended by the renderer on the first text of a thread, so an edit cannot remove it. */
export const VISIT_MESSAGE_STOP_LINE = 'Reply STOP to opt out.'

// The length of a real link, so a preview counts the segments a homeowner's text will use.
const VISIT_LINK_SAMPLE = `https://${APP_HOSTS.prod[0]}${ROOTS.public.homeVisit('00000000-0000-4000-8000-000000000000', '0'.repeat(32))}`

export const VISIT_MESSAGE_TOKENS = [
  { token: 'first_name', label: 'First name', sample: 'Maria', resolve: vars => vars.firstName },
  { token: 'coordinator_name', label: 'Coordinator name', sample: 'Dana', resolve: vars => vars.coordinatorName ?? '' },
  { token: 'specialist_name', label: 'Specialist name', sample: 'Oliver', resolve: vars => vars.specialistName ?? '' },
  { token: 'visit_date', label: 'Visit date', sample: 'Wed, Oct 7', resolve: vars => vars.visitDate },
  { token: 'visit_time', label: 'Visit time', sample: '10:00 AM', resolve: vars => vars.visitTime },
  { token: 'arrival_window', label: 'Arrival window', sample: '10:00 and 10:30 AM', resolve: vars => vars.arrivalWindow },
  { token: 'visit_link', label: 'Visit link', sample: VISIT_LINK_SAMPLE, resolve: vars => vars.visitLink },
  { token: 'coordinator_note', label: 'Coordinator note', sample: '', resolve: vars => vars.coordinatorNote },
] as const satisfies readonly MergeToken<VisitMessageVars>[]

/** Typed into the send dialog, so only the summary has one. */
export const VISIT_MESSAGE_SUMMARY_ONLY_TOKENS: readonly string[] = ['coordinator_note']

export const VISIT_MESSAGE_REQUIRED_TOKENS: Record<VisitMessageTemplateKey, readonly string[]> = {
  visit_summary: ['visit_link', 'visit_date', 'visit_time'],
  day_before_reminder_unconfirmed: ['visit_link', 'visit_time'],
  day_before_reminder_confirmed: ['visit_link', 'visit_time'],
  rep_confirmation: ['specialist_name', 'arrival_window', 'visit_link'],
  confirmation_reply: ['visit_date', 'visit_time'],
}

const N = companyInfo.name
const S = companyInfo.nickname

// A {{#token}} section drops out when the token is empty, so a text never relies on a coordinator, a specialist or a note existing.
export const VISIT_MESSAGE_TEMPLATE_DEFAULTS: Record<VisitMessageTemplateKey, string> = {
  visit_summary: `Hi {{first_name}} 👋 it's {{#coordinator_name}}{{coordinator_name}} from {{/coordinator_name}}${N}.

You're all set for {{visit_date}} at {{visit_time}} 📅{{#specialist_name}} {{specialist_name}} will be your specialist.{{/specialist_name}}

{{#coordinator_note}}One more thing: {{coordinator_note}}{{/coordinator_note}}

Here's your visit page, where you can see the agenda and manage your visit:
{{visit_link}}

Reply YES to confirm.`,
  day_before_reminder_unconfirmed: `Hi {{first_name}}, {{#coordinator_name}}{{coordinator_name}} here from ${S}{{/coordinator_name}}{{^coordinator_name}}it's ${N}{{/coordinator_name}} 🙂 Just a heads-up that your home visit is tomorrow at {{visit_time}}{{#specialist_name}} with {{specialist_name}}{{/specialist_name}}.

Can you reply YES so {{#coordinator_name}}I know{{/coordinator_name}}{{^coordinator_name}}we know{{/coordinator_name}} we're still on? If the time no longer works, you can pick a new one here: {{visit_link}}`,
  day_before_reminder_confirmed: `Hi {{first_name}}! See you tomorrow at {{visit_time}} 🏡 {{#specialist_name}}{{specialist_name}} is{{/specialist_name}}{{^specialist_name}}We're{{/specialist_name}} looking forward to meeting you.

Your visit page, in case you need it: {{visit_link}}
- {{#coordinator_name}}{{coordinator_name}}, {{/coordinator_name}}${N}`,
  rep_confirmation: `Good morning {{first_name}} ☀️ {{specialist_name}} just confirmed and will be there between {{arrival_window}}. Everything you need is here: {{visit_link}}
- {{#coordinator_name}}{{coordinator_name}}, ${S}{{/coordinator_name}}{{^coordinator_name}}${N}{{/coordinator_name}}`,
  confirmation_reply: `Perfect, thank you {{first_name}}! You're confirmed for {{visit_date}} at {{visit_time}} ✅`,
}
