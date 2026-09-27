import type { BillCategory } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'

// App palette hues already used across the codebase; this order passes color-blind separation in both themes.
export const BILL_FILL_CLASSES = {
  electric: 'fill-yellow-600',
  water: 'fill-sky-600',
  gas: 'fill-violet-600',
  gardening: 'fill-emerald-600',
  misc: 'fill-muted-foreground',
} as const satisfies Record<BillCategory, string>

export const BILL_SWATCH_CLASSES = {
  electric: 'bg-yellow-600',
  water: 'bg-sky-600',
  gas: 'bg-violet-600',
  gardening: 'bg-emerald-600',
  misc: 'bg-muted-foreground',
} as const satisfies Record<BillCategory, string>
