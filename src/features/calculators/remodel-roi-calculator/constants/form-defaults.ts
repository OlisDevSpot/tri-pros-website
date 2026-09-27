import type { RemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/schemas/config'
import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'

type Bills = RemodelRoiFormValues['billsNow']
type Liability = RemodelRoiFormValues['liabilities'][number]

export const EMPTY_LIABILITY: Liability = { label: '', balance: null, monthlyPayment: null, aprPercent: null }

function emptyBills(): Bills {
  return { electric: null, gas: null, water: null, gardening: null, misc: null }
}

export function createRemodelRoiDefaults(config: RemodelRoiConfig): RemodelRoiFormValues {
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
