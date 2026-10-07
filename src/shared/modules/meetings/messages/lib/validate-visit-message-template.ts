import type { VisitMessageTemplateKey } from '@/shared/modules/meetings/messages/constants/kinds'

import {
  VISIT_MESSAGE_REQUIRED_TOKENS,
  VISIT_MESSAGE_SUMMARY_ONLY_TOKENS,
  VISIT_MESSAGE_TOKENS,
} from '@/shared/modules/meetings/messages/constants/templates'
import { listMergeTokens, renderMergeSample } from '@/shared/services/voip/lib/sms-merge-template'
import { countSmsSegments, findNonGsm7 } from '@/shared/services/voip/lib/sms-segments'

export interface TemplateIssue {
  code: string
  message: string
}

const KNOWN_TOKENS: readonly string[] = VISIT_MESSAGE_TOKENS.map(token => token.token)
const MAX_SEGMENTS = 2
const ASKS_FOR_YES: readonly VisitMessageTemplateKey[] = ['visit_summary', 'day_before_reminder_unconfirmed']

/** Errors block a save; warnings do not. The editor runs this live and the save runs it again as the authority. */
export function validateVisitMessageTemplate(
  key: VisitMessageTemplateKey,
  body: string,
): { errors: TemplateIssue[], warnings: TemplateIssue[] } {
  const errors: TemplateIssue[] = []
  const warnings: TemplateIssue[] = []

  if (body.trim().length === 0) {
    return { errors: [{ code: 'empty', message: 'The text is empty.' }], warnings }
  }

  const nonGsm7 = findNonGsm7(body)
  if (nonGsm7.length > 0) {
    errors.push({ code: 'not_gsm7', message: `These characters make the text cost about three times as much: ${nonGsm7.join(' ')}. Use plain quotes and hyphens, and no emoji.` })
  }

  const used = listMergeTokens(body)
  const unknown = used.filter(token => !KNOWN_TOKENS.includes(token))
  if (unknown.length > 0) {
    errors.push({ code: 'unknown_token', message: `Unknown: ${unknown.map(token => `{{${token}}}`).join(', ')}.` })
  }

  const notAllowed = key === 'visit_summary' ? [] : used.filter(token => VISIT_MESSAGE_SUMMARY_ONLY_TOKENS.includes(token))
  if (notAllowed.length > 0) {
    errors.push({ code: 'token_not_allowed', message: `${notAllowed.map(token => `{{${token}}}`).join(', ')} only works in the visit summary.` })
  }

  const missing = VISIT_MESSAGE_REQUIRED_TOKENS[key].filter(token => !used.includes(token))
  if (missing.length > 0) {
    errors.push({ code: 'missing_token', message: `This text needs ${missing.map(token => `{{${token}}}`).join(', ')}.` })
  }

  if (/\bstop\b/i.test(body)) {
    errors.push({ code: 'contains_stop', message: 'Leave out the STOP line. It is added to the first text automatically.' })
  }

  if (key !== 'visit_summary' && countSmsSegments(renderMergeSample(body, VISIT_MESSAGE_TOKENS)).segments > MAX_SEGMENTS) {
    warnings.push({ code: 'too_long', message: `With a real link this is more than ${MAX_SEGMENTS} text segments.` })
  }

  if (/\b(?:he|she|him|his|her)\b/i.test(body)) {
    warnings.push({ code: 'pronoun', message: 'Name the rep with {{rep_name}} instead of a pronoun.' })
  }

  if (ASKS_FOR_YES.includes(key) && !/\byes\b/i.test(body)) {
    warnings.push({ code: 'no_yes_ask', message: 'This text no longer asks the homeowner to reply YES.' })
  }

  return { errors, warnings }
}
