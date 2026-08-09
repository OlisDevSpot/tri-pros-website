// scripts/meta/campaign-specs/lib/guardrails.ts
import type { CampaignSpec } from './types.js'

/** $166/day ≈ $5,000/mo — the hard account ceiling from the design spec. */
export const MAX_TOTAL_DAILY_BUDGET_CENTS = 16_600

export function assertBudgetCeiling(specs: CampaignSpec[]): void {
  // Budget is CBO (campaign-level): each campaign's dailyBudgetCents is the total
  // daily spend across all its ad sets. Sum campaigns for the account-wide total.
  const totalCents = specs.reduce((sum, spec) => sum + spec.dailyBudgetCents, 0)
  if (totalCents > MAX_TOTAL_DAILY_BUDGET_CENTS) {
    throw new Error(
      `Budget ceiling exceeded: specs total $${(totalCents / 100).toFixed(2)}/day, `
      + `ceiling is $${(MAX_TOTAL_DAILY_BUDGET_CENTS / 100).toFixed(2)}/day. Refusing to sync.`,
    )
  }
}

/**
 * Throws if any two specs share the same campaign `key`.
 * A duplicate key produces two create-campaign ops that both write to the same lock
 * entry, guaranteeing a permanent orphan. Call this before any API work.
 */
export function assertUniqueSpecKeys(specs: CampaignSpec[]): void {
  const seen = new Set<string>()
  for (const spec of specs) {
    if (seen.has(spec.key))
      throw new Error(`Duplicate campaign spec key: "${spec.key}". Keys must be unique.`)
    seen.add(spec.key)
  }
}
