export const CUT_MODES = ['trades', 'percent', 'amount'] as const
export type CutMode = typeof CUT_MODES[number]
export const CUT_MODE_LABELS = { trades: 'From trades', percent: '%', amount: '$' } as const satisfies Record<CutMode, string>
