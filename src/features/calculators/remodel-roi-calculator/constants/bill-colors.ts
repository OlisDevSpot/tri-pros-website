import type { BillCategory } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'

import { BILL_CATEGORIES, BILL_CATEGORY_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'

// Bill categories are unordered, so they take the categorical chart set, not status colors.
export const BILL_COLORS = {
  electric: 'var(--chart-3)',
  water: 'var(--chart-1)',
  gas: 'var(--chart-4)',
  gardening: 'var(--chart-2)',
  misc: 'var(--chart-5)',
} as const satisfies Record<BillCategory, string>

export const BILL_CHART_CONFIG = Object.fromEntries(
  BILL_CATEGORIES.map(category => [category, { label: BILL_CATEGORY_LABELS[category], color: BILL_COLORS[category] }]),
) as Record<BillCategory, { label: string, color: string }>

export const BILL_SWATCH_CLASSES = {
  electric: 'bg-chart-3',
  water: 'bg-chart-1',
  gas: 'bg-chart-4',
  gardening: 'bg-chart-2',
  misc: 'bg-chart-5',
} as const satisfies Record<BillCategory, string>
