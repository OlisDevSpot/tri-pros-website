import type { PricingTrade, ScopePricingConfig } from '@/features/calculators/scope-pricing-calculator/schemas/config'
import type { PriceQuoteInput, QuoteLineResult, QuoteOverrides, QuoteResult } from '@/features/calculators/scope-pricing-calculator/types'

import { PERMIT_TRADES, TRADE_LABELS } from '@/features/calculators/scope-pricing-calculator/constants/trade-labels'
import { FORMULAS } from '@/features/calculators/scope-pricing-calculator/lib/formula-registry'
import { resolveFormulaVariables } from '@/features/calculators/scope-pricing-calculator/lib/resolve-formula-variables'
import { getMultiplierTier } from '@/shared/modules/proposals/core/lib/financials/tiers'

function resolveMultiplier(config: ScopePricingConfig, overrides: QuoteOverrides | undefined): number {
  const requested = overrides?.multiplier
  const multiplier = requested != null && Number.isFinite(requested) ? requested : config.multiplier.default
  return Math.max(config.multiplier.floor, multiplier)
}

function splitPrice(cost: number | null, price: number, taxRatePercent: number) {
  // Tax is carried inside the Price, as the ported calculator did, until the tax rule is confirmed.
  const tax = Math.round((price * taxRatePercent) / 100)
  return { cost, price, tax, base: price - tax }
}

function summarize(lines: QuoteLineResult[], multiplier: number): QuoteResult {
  let totalPrice = 0
  let totalTax = 0
  let totalCost = 0
  let costedPrice = 0
  let uncostedPrice = 0
  for (const line of lines) {
    if (line.status !== 'priced') {
      continue
    }
    totalPrice += line.price
    totalTax += line.tax
    if (line.cost == null) {
      uncostedPrice += line.price
    }
    else {
      totalCost += line.cost
      costedPrice += line.price
    }
  }
  const effectiveMultiplier = totalCost > 0 ? costedPrice / totalCost : null
  return {
    lines,
    multiplier,
    totalPrice,
    totalTax,
    totalBase: totalPrice - totalTax,
    totalCost,
    costedPrice,
    uncostedPrice,
    margin: costedPrice - totalCost,
    effectiveMultiplier,
    tier: getMultiplierTier(effectiveMultiplier),
    hasUncostedLines: lines.some(line => line.status === 'priced' && line.cost == null),
  }
}

// Kept free of React and I/O so the engine can move to a shared module once its permanent home is decided.
export function priceQuote({ lines, context, config, overrides }: PriceQuoteInput): QuoteResult {
  const multiplier = resolveMultiplier(config, overrides)
  const results: QuoteLineResult[] = []
  const pricedTrades = new Set<PricingTrade>()

  for (const line of lines) {
    if (line.kind === 'manual') {
      if (line.price == null || !Number.isFinite(line.price) || line.price < 0) {
        results.push({ id: line.id, kind: 'manual', status: 'incomplete', label: line.label, trade: null, needs: [] })
        continue
      }
      results.push({ id: line.id, kind: 'manual', status: 'priced', label: line.label, trade: null, ...splitPrice(null, Math.round(line.price), config.taxRatePercent) })
      continue
    }

    const formula = FORMULAS[line.pricingKey]
    const resolved = resolveFormulaVariables(formula, line.variables)
    if (!resolved.ok) {
      results.push({ id: line.id, kind: 'formula', status: 'incomplete', label: formula.label, trade: formula.trade, needs: resolved.needs })
      continue
    }
    const cost = Math.round(formula.compute(resolved.values, context, config.unitCosts[formula.trade], config))
    pricedTrades.add(formula.trade)
    results.push({ id: line.id, kind: 'formula', status: 'priced', label: formula.label, trade: formula.trade, ...splitPrice(cost, Math.round(cost * multiplier), config.taxRatePercent) })
  }

  for (const trade of PERMIT_TRADES) {
    const fee = config.permitFees[trade]
    if (fee.enabled && pricedTrades.has(trade)) {
      results.push({ id: `permit-${trade}`, kind: 'permit', status: 'priced', label: `Permit (${TRADE_LABELS[trade]})`, trade, ...splitPrice(fee.amount, Math.round(fee.amount * multiplier), config.taxRatePercent) })
    }
  }

  return summarize(results, multiplier)
}
