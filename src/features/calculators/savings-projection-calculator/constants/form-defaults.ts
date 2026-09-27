import type { SavingsProjectionConfig } from '@/features/calculators/savings-projection-calculator/schemas/config'
import type { SavingsProjectionFormValues } from '@/features/calculators/savings-projection-calculator/schemas/form'

type Bills = SavingsProjectionFormValues['billsNow']
type Liability = SavingsProjectionFormValues['liabilities'][number]

export const EMPTY_LIABILITY: Liability = { label: '', balance: null, monthlyPayment: null, aprPercent: null }

function emptyBills(): Bills {
  return { electric: null, gas: null, water: null, gardening: null, misc: null }
}

export function createSavingsProjectionDefaults(config: SavingsProjectionConfig): SavingsProjectionFormValues {
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
