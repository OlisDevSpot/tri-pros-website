import type { PriceQuoteInput, SolveMultiplierResult } from '@/features/calculators/scope-pricing-calculator/types'

import { priceQuote } from '@/features/calculators/scope-pricing-calculator/lib/price-quote'

export function solveMultiplier(targetTotal: number, input: PriceQuoteInput): SolveMultiplierResult {
  const { default: defaultMultiplier, floor } = input.config.multiplier
  // At the resting value the shift is zero, so every open scope sits at its own scope default.
  const resting = priceQuote({ ...input, overrides: { multiplier: defaultMultiplier } })
  const overriddenIds = new Set(input.lines.flatMap(line => (line.kind === 'formula' && line.multiplierOverride != null ? [line.id] : [])))
  let open: { cost: number, scopeDefault: number }[] = []
  let heldPrice = resting.uncostedPrice
  let costedLines = 0
  for (const line of resting.lines) {
    if (line.status !== 'priced' || line.cost == null || line.multiplier == null) {
      continue
    }
    costedLines += 1
    if (overriddenIds.has(line.id)) {
      heldPrice += line.price
      continue
    }
    open.push({ cost: line.cost, scopeDefault: line.multiplier })
  }
  if (costedLines === 0) {
    return { status: 'no-cost' }
  }
  if (open.length === 0) {
    return { status: 'all-overridden' }
  }
  const target = Number.isFinite(targetTotal) ? targetTotal : 0
  const atFloor = (): SolveMultiplierResult => ({ status: 'below-floor', multiplier: floor, achievedTotal: priceQuote({ ...input, overrides: { multiplier: floor } }).totalPrice })
  let shift = 0
  // The engine clamps a scope whose default + shift falls under the floor, so such a scope is held at its
  // floor price and the shift is re-solved over the rest until no scope clamps.
  while (open.length > 0) {
    const openCost = open.reduce((sum, scope) => sum + scope.cost, 0)
    const openPriceAtDefaults = open.reduce((sum, scope) => sum + scope.cost * scope.scopeDefault, 0)
    shift = (target - heldPrice - openPriceAtDefaults) / openCost
    if (defaultMultiplier + shift < floor - 1e-9) {
      return atFloor()
    }
    const clamped = open.filter(scope => scope.scopeDefault + shift < floor - 1e-9)
    if (clamped.length === 0) {
      break
    }
    heldPrice += clamped.reduce((sum, scope) => sum + scope.cost * floor, 0)
    open = open.filter(scope => !clamped.includes(scope))
  }
  if (open.length === 0) {
    return atFloor()
  }
  const multiplier = defaultMultiplier + shift
  // Line prices round to whole dollars, so report what the quote actually adds up to at this multiplier.
  const achievedTotal = priceQuote({ ...input, overrides: { multiplier } }).totalPrice
  return { status: 'reached', multiplier, achievedTotal }
}
