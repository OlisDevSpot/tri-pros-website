import { pickPrimaryTrade } from './pick-primary-trade'

// Pure {{token}} substitution for campaign SMS bodies. Renders in-app because
// CloudTalk's /sms/send takes a literal body (no contact merge). Supported
// tokens: {{first_name}}, {{city}}, {{primary_trade}}. Unknown tokens are left
// untouched. No I/O.

interface RenderSmsTemplateVars {
  name: string
  city: string
  interestedTradesRaw: string[]
}

export function renderSmsTemplate(body: string, vars: RenderSmsTemplateVars): string {
  const firstName = vars.name.trim().split(/\s+/)[0] ?? ''
  const replacements: Record<string, string> = {
    first_name: firstName,
    city: vars.city,
    primary_trade: pickPrimaryTrade(vars.interestedTradesRaw),
  }
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    key in replacements ? replacements[key]! : match)
}
