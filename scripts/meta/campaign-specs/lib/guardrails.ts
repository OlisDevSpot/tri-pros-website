// scripts/meta/campaign-specs/lib/guardrails.ts
import type { CampaignSpec } from './types.js'

/** $166/day ≈ $5,000/mo — the hard account ceiling from the design spec. */
export const MAX_TOTAL_DAILY_BUDGET_CENTS = 16_600

export function assertBudgetCeiling(specs: CampaignSpec[]): void {
  const totalCents = specs.reduce((sum, spec) => sum + spec.adSet.dailyBudgetCents, 0)
  if (totalCents > MAX_TOTAL_DAILY_BUDGET_CENTS) {
    throw new Error(
      `Budget ceiling exceeded: specs total $${(totalCents / 100).toFixed(2)}/day, `
      + `ceiling is $${(MAX_TOTAL_DAILY_BUDGET_CENTS / 100).toFixed(2)}/day. Refusing to sync.`,
    )
  }
}
