import type { BillCategory } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'

export const BILL_RATE_LABELS = {
  electric: 'Electric rates rise',
  water: 'Water rates rise',
  gas: 'Gas rates rise',
  gardening: 'Gardening prices rise',
  misc: 'Misc rises',
} as const satisfies Record<BillCategory, string>
