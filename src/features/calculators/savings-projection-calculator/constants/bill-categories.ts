export const BILL_CATEGORIES = ['electric', 'gas', 'water', 'gardening', 'misc'] as const

export type BillCategory = typeof BILL_CATEGORIES[number]

export const BILL_CATEGORY_LABELS = {
  electric: 'Electric',
  gas: 'Gas',
  water: 'Water',
  gardening: 'Gardening',
  misc: 'Misc',
} as const satisfies Record<BillCategory, string>
