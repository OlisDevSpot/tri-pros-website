import { pickPrimaryTrade } from '@/shared/services/voip/campaigns/lib/pick-primary-trade'

// Single source of truth for SMS merge tokens. The authoring chips (client) and
// renderSmsTemplate (server) both derive from this list, so the UI can never
// advertise a token the renderer ignores. Pure — no I/O. Unknown tokens render
// literal (see render-sms-template.ts).
// see docs/superpowers/specs/2026-06-18-sms-cadence-editor-ui-design.md §6

export interface SmsMergeVars {
  name: string
  city: string
  state: string
  zip: string
  interestedTradesRaw: string[]
}

export interface SmsMergeToken {
  /** The literal token as typed in a body, e.g. "first_name" (no braces). */
  token: string
  /** Human label for the chip, e.g. "First name". */
  label: string
  /** Example value shown in tooltips/preview, e.g. "Maria". */
  sample: string
  resolve: (vars: SmsMergeVars) => string
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? ''

export const SMS_MERGE_TOKENS: readonly SmsMergeToken[] = [
  { token: 'first_name', label: 'First name', sample: 'Maria', resolve: v => firstName(v.name) },
  { token: 'full_name', label: 'Full name', sample: 'Maria Lopez', resolve: v => v.name },
  { token: 'city', label: 'City', sample: 'Pasadena', resolve: v => v.city },
  { token: 'state', label: 'State', sample: 'CA', resolve: v => v.state },
  { token: 'zip', label: 'ZIP', sample: '91101', resolve: v => v.zip },
  { token: 'primary_trade', label: 'Primary trade', sample: 'Roofing', resolve: v => pickPrimaryTrade(v.interestedTradesRaw) },
  { token: 'all_trades', label: 'All trades', sample: 'Roofing, Solar', resolve: v => v.interestedTradesRaw.join(', ') },
]
