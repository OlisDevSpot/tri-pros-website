export const PAYMENT_MODES = ['financed', 'cash'] as const
export type PaymentMode = typeof PAYMENT_MODES[number]
export const PAYMENT_MODE_LABELS = { financed: 'Financed', cash: 'Cash' } as const satisfies Record<PaymentMode, string>

export const TERM_YEARS = [10, 15, 20, 25] as const
export type TermYears = typeof TERM_YEARS[number]

export const LIABILITY_KINDS = ['mortgage', 'other'] as const
export type LiabilityKind = typeof LIABILITY_KINDS[number]
