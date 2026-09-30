import type { BillCategory } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'

import { BILL_CATEGORIES, BILL_CATEGORY_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'

// App palette hues already used across the codebase; this order passes color-blind separation in both themes.
// BILL_SWATCH_CLASSES below is what keeps Tailwind emitting these --color-* variables: v4 only emits a theme
// variable a used class actually references, and BILL_CHART_CONFIG's colors are plain CSS, not classes.
export const BILL_COLORS = {
  electric: 'var(--color-yellow-600)',
  water: 'var(--color-sky-600)',
  gas: 'var(--color-violet-600)',
  gardening: 'var(--color-emerald-600)',
  misc: 'var(--muted-foreground)',
} as const satisfies Record<BillCategory, string>

export const BILL_CHART_CONFIG = Object.fromEntries(
  BILL_CATEGORIES.map(category => [category, { label: BILL_CATEGORY_LABELS[category], color: BILL_COLORS[category] }]),
) as Record<BillCategory, { label: string, color: string }>

export const BILL_SWATCH_CLASSES = {
  electric: 'bg-yellow-600',
  water: 'bg-sky-600',
  gas: 'bg-violet-600',
  gardening: 'bg-emerald-600',
  misc: 'bg-muted-foreground',
} as const satisfies Record<BillCategory, string>
