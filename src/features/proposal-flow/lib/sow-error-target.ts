import { firstErrorPath } from './form-parts'

export interface SowErrorTarget {
  index: number
  tab: 'description' | 'pricing' | null
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
  if (rest.startsWith('financials.')) {
    tab = 'pricing'
  }
  else if (rest.startsWith('contentJSON') || rest.startsWith('html')) {
    tab = 'description'
  }
  return { index: Number(match[1]), tab }
}
