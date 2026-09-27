import type { ReplacementProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { CURRENT_IS_PLURAL, CURRENT_SENTENCE_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/trades'
import { joinWords } from '@/features/calculators/remodel-roi-calculator/lib/join-words'

export function waitingNames(replacements: readonly ReplacementProjection[]): string {
  return joinWords(replacements.map(replacement => CURRENT_SENTENCE_LABELS[replacement.trade]))
}

export function waitingArePlural(replacements: readonly ReplacementProjection[]): boolean {
  return replacements.length > 1 || replacements.some(replacement => CURRENT_IS_PLURAL[replacement.trade])
}

export function installYears(replacement: ReplacementProjection): string {
  const [first, ...again] = replacement.installs.map(install => install.year)
  return again.length ? `about year ${first}, and again in year ${joinWords(again.map(String))}` : `about year ${first}`
}
