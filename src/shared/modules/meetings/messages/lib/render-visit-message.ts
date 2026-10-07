import type { VisitMessageVars } from '@/shared/modules/meetings/messages/types'

import { formatBusinessClock, formatBusinessDay } from '@/shared/lib/business-time'
import { formatArrivalWindow } from '@/shared/modules/meetings/core/lib/arrival-window'
import { VISIT_MESSAGE_STOP_LINE, VISIT_MESSAGE_TOKENS } from '@/shared/modules/meetings/messages/constants/templates'
import { renderMergeTemplate } from '@/shared/services/voip/lib/sms-merge-template'

export function buildVisitMessageVars(input: {
  customerName: string | null
  repName: string | null
  scheduledFor: string
  visitLink: string
  officeNote?: string | null
}): VisitMessageVars {
  return {
    firstName: input.customerName?.trim().split(/\s+/)[0] || 'there',
    repName: input.repName,
    visitDate: formatBusinessDay(input.scheduledFor),
    visitTime: formatBusinessClock(input.scheduledFor),
    arrivalWindow: formatArrivalWindow(input.scheduledFor),
    visitLink: input.visitLink,
    officeNote: (input.officeNote ?? '').replace(/\s+/g, ' ').trim(),
  }
}

export function renderVisitMessage(body: string, vars: VisitMessageVars, options: { stopLine: boolean }): string {
  // An empty office note leaves two spaces where the token was.
  const rendered = renderMergeTemplate(body, VISIT_MESSAGE_TOKENS, vars).replace(/ {2,}/g, ' ').trim()
  return options.stopLine ? `${rendered} ${VISIT_MESSAGE_STOP_LINE}` : rendered
}
