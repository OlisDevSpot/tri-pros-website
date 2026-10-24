import { firstErrorPath } from './form-parts'

export interface SowErrorTarget {
  index: number
  tab: 'description' | 'pricing' | null
  // Trade and scopes have no field in the section body: they are picked from the header.
  picker: 'trade' | 'scopes' | null
}

const SOW_PATH = /^project\.data\.sow\.(\d+)\.(.+)$/

export function firstSowErrorTarget(errors: unknown): SowErrorTarget | null {
  const path = firstErrorPath(errors)
  const match = path === null ? null : SOW_PATH.exec(path)
  if (!match) {
    return null
  }
  const rest = match[2]
  let tab: SowErrorTarget['tab'] = null
  let picker: SowErrorTarget['picker'] = null
  if (rest.startsWith('financials.')) {
    tab = 'pricing'
  }
  else if (rest.startsWith('contentJSON') || rest.startsWith('html')) {
    tab = 'description'
  }
  else if (rest.startsWith('trade.')) {
    picker = 'trade'
  }
  else if (rest.startsWith('scopes')) {
    picker = 'scopes'
  }
  return { index: Number(match[1]), tab, picker }
}
