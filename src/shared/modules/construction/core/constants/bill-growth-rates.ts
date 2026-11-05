import type { BillCategory } from '@/shared/modules/construction/core/constants/bill-categories'

// The team's estimate from thousands of customer bills analysed over the years; editable in the calculator.
export const BILL_GROWTH_RATES_PERCENT = { electric: 7.57, water: 8.9, gas: 9.1, gardening: 5, misc: 0 } as const satisfies Record<BillCategory, number>
