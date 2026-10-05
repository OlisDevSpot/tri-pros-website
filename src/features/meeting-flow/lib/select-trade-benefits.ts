import type { TradeBenefit } from '@/features/meeting-flow/types'
import { BENEFIT_TEMPLATES } from '@/features/meeting-flow/constants/persona-profile-maps'
import { TRADE_BENEFIT_EXCLUSIONS } from '@/features/meeting-flow/constants/trade-benefit-exclusions'

/** Homeowner-voiced benefit lines for a trade, in template order, without the excluded numeric claims. */
export function selectTradeBenefits(tradeName: string, limit: number): TradeBenefit[] {
  const benefits: TradeBenefit[] = []
  for (const template of Object.values(BENEFIT_TEMPLATES)) {
    const body = template.byTrade[tradeName]
    if (body && !TRADE_BENEFIT_EXCLUSIONS.has(body)) {
      benefits.push({ headline: template.headline, body })
    }
  }
  return benefits.slice(0, limit)
}
