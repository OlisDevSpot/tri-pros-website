import type { SmsMergeVars } from '@/shared/entities/voip-campaigns/lib/sms-merge-tokens'

import { SMS_MERGE_TOKENS } from '@/shared/entities/voip-campaigns/lib/sms-merge-tokens'
import { renderMergeTemplate } from '@/shared/services/voip/lib/sms-merge-template'

// The dialer's SMS send takes a literal body (no contact merge), so campaign bodies render in-app.
export function renderSmsTemplate(body: string, vars: SmsMergeVars): string {
  return renderMergeTemplate(body, SMS_MERGE_TOKENS, vars)
}
