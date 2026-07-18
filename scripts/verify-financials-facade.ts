/* eslint-disable no-console */
// Worked-example self-check for the proposal financials façade.
// Run: pnpm tsx scripts/verify-financials-facade.ts
import type { ProjectSection } from '@/shared/entities/proposals/types'
import { computeProposalFinancials } from '@/shared/entities/proposals/lib/financials'

const sow: ProjectSection['data']['sow'] = [
  {
    contentJSON: '',
    html: '',
    scopes: [{ id: 'scope-1', label: 'Demo scope' }],
    title: 'Kitchen',
    trade: { id: 'trade-1', label: 'Kitchen Remodel' },
    financials: {
      sectionPrice: 27000,
      costLines: [
        { id: 'cl-1', label: 'Materials', amount: 4000, relatedScopeId: 'scope-1' },
        { id: 'cl-2', label: 'Labor', amount: 2000, relatedScopeId: 'scope-1' },
      ],
      incentives: [
        { id: 'si-1', label: 'Showcase discount', amount: 4000 },
      ],
    },
  },
]

const financials = computeProposalFinancials({
  pricingMode: 'breakdown',
  sow,
  funding: {
    cashInDeal: 0,
    depositAmount: 1000,
    miscPrice: 0,
    startingTcp: 27000,
    incentives: [{ type: 'discount', amount: 6000, notes: 'Friends & family' }],
  },
})

const checks: [string, unknown, unknown][] = [
  ['subtotal', financials.subtotal, 27000],
  ['totalSectionIncentives', financials.totalSectionIncentives, 4000],
  ['totalGlobalDiscounts', financials.totalGlobalDiscounts, 6000],
  ['totalIncentives', financials.totalIncentives, 10000],
  ['finalTcp', financials.finalTcp, 17000],
  ['totalJobCosts', financials.totalJobCosts, 6000],
  ['margin', financials.margin, 11000],
  ['multiplier (2dp)', financials.multiplier?.toFixed(2), '2.83'],
  ['tier', financials.tier, 'healthy'],
  ['section netPrice', financials.sections[0]?.netPrice, 23000],
  ['section multiplier (2dp)', financials.sections[0]?.multiplier?.toFixed(2), '3.83'],
  ['section tier', financials.sections[0]?.tier, 'excellent'],
  ['breakdown netSubtotal', financials.breakdown.netSubtotal, 23000],
  ['breakdown finalTcp', financials.breakdown.finalTcp, 17000],
  ['breakdown section netPrice', financials.breakdown.sections[0]?.netPrice, 23000],
  ['breakdown global line amount', financials.breakdown.globalLines[0]?.amount, 6000],
  ['breakdown section-incentive line amount', financials.breakdown.sectionIncentiveLines[0]?.amount, 4000],
]

let failed = 0
for (const [name, actual, expected] of checks) {
  const ok = actual === expected
  if (!ok) {
    failed++
  }
  console.log(`${ok ? '✅' : '❌'} ${name}: ${String(actual)}${ok ? '' : ` (expected ${String(expected)})`}`)
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}
console.log('\nAll façade checks passed')
