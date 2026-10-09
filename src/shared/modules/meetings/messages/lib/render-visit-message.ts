import type { VisitMessageVars } from '@/shared/modules/meetings/messages/types'

import { formatBusinessClock, formatBusinessDay } from '@/shared/lib/business-time'
import { formatArrivalWindow } from '@/shared/modules/meetings/core/lib/arrival-window'
import { VISIT_MESSAGE_STOP_LINE, VISIT_MESSAGE_TOKENS } from '@/shared/modules/meetings/messages/constants/templates'
import { renderMergeTemplate } from '@/shared/services/voip/lib/sms-merge-template'

export function buildVisitMessageVars(input: {
  customerName: string | null
  specialistName: string | null
  coordinatorName: string | null
  scheduledFor: string
  visitLink: string
  coordinatorNote?: string | null
}): VisitMessageVars {
  return {
    firstName: input.customerName?.trim().split(/\s+/)[0] || 'there',
    specialistName: input.specialistName,
    coordinatorName: input.coordinatorName,
    visitDate: formatBusinessDay(input.scheduledFor),
    visitTime: formatBusinessClock(input.scheduledFor),
    arrivalWindow: formatArrivalWindow(input.scheduledFor),
    visitLink: input.visitLink,
    coordinatorNote: (input.coordinatorNote ?? '').replace(/\s+/g, ' ').trim(),
  }
}

export function renderVisitMessage(body: string, vars: VisitMessageVars, options: { stopLine: boolean }): string {
  // A dropped section leaves doubled spaces and empty lines where it stood.
  const rendered = renderMergeTemplate(body, VISIT_MESSAGE_TOKENS, vars)
    .split('\n')
    .map(line => line.replace(/ {2,}/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return options.stopLine ? `${rendered} ${VISIT_MESSAGE_STOP_LINE}` : rendered
}
