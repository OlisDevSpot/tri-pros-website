export const UPLIFT_MODES = ['amount', 'percentOfPrice'] as const

export type UpliftMode = typeof UPLIFT_MODES[number]

export const UPLIFT_MODE_LABELS = {
  amount: '$',
  percentOfPrice: '% of price',
} as const satisfies Record<UpliftMode, string>
