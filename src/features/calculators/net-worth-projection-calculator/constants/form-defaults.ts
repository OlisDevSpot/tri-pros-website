import type { NetWorthProjectionConfig } from '@/features/calculators/net-worth-projection-calculator/schemas/config'
import type { NetWorthProjectionFormValues } from '@/features/calculators/net-worth-projection-calculator/schemas/form'

type Bills = NetWorthProjectionFormValues['billsNow']
type Liability = NetWorthProjectionFormValues['liabilities'][number]

export const EMPTY_LIABILITY: Liability = { label: '', balance: null, monthlyPayment: null, aprPercent: null }

function emptyBills(): Bills {
  return { electric: null, gas: null, water: null, gardening: null, misc: null }
}

export function createNetWorthProjectionDefaults(config: NetWorthProjectionConfig): NetWorthProjectionFormValues {
  return {
    homeValue: null,
    liabilities: [],
    billsNow: emptyBills(),
    billsAfter: emptyBills(),
    project: {
      price: null,
      incentives: null,
      downPayment: null,
      aprPercent: null,
      termMonths: null,
      uplift: { mode: 'amount', value: 0 },
    },
    assumptions: {
      horizonYears: config.defaultHorizonYears,
      ratesPercent: { ...config.defaultRatesPercent },
    },
  }
}
