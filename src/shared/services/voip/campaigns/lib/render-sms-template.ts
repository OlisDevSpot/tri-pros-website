import type { SmsMergeVars } from '@/shared/entities/voip-campaigns/lib/sms-merge-tokens'

import { SMS_MERGE_TOKENS } from '@/shared/entities/voip-campaigns/lib/sms-merge-tokens'

// Pure {{token}} substitution for campaign SMS bodies. Renders in-app because
// CloudTalk's /sms/send takes a literal body (no contact merge). Tokens come
// from the shared registry; unknown tokens are left untouched. No I/O.

const RESOLVERS = new Map(SMS_MERGE_TOKENS.map(t => [t.token, t.resolve]))

export function renderSmsTemplate(body: string, vars: SmsMergeVars): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    const resolve = RESOLVERS.get(key)
    return resolve ? resolve(vars) : match
  })
}
