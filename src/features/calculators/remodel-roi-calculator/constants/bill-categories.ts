export const BILL_CATEGORIES = ['electric', 'water', 'gas', 'gardening', 'misc'] as const

export type BillCategory = typeof BILL_CATEGORIES[number]

export const BILL_CATEGORY_LABELS = {
  electric: 'Electric',
  water: 'Water',
  gas: 'Gas',
  gardening: 'Gardening',
  misc: 'Misc',
} as const satisfies Record<BillCategory, string>
