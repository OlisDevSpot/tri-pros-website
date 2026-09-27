import { defineFormula } from '@/features/calculators/scope-pricing-calculator/lib/define-formula'

export const mpu = defineFormula({
  key: 'mpu',
  trade: 'electricals',
  label: 'Main panel upgrade',
  outcome: 'Increase electrical capacity and safety to support modern appliances, solar, and home expansions',
  variables: ['relocationRequired'],
  compute({ relocationRequired }, _context, costs) {
    return relocationRequired ? costs.mpuWithRelocation : costs.mpuBase
  },
})
