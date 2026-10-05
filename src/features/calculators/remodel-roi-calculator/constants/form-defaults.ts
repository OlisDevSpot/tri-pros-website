import type { TradeKey } from '@/features/calculators/remodel-roi-calculator/constants/trades'
import type { RemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/schemas/config'
import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'

type Trades = RemodelRoiFormValues['trades']
type Bill = RemodelRoiFormValues['bills']['electric']
type Current = NonNullable<Trades['roof']>['current']
type Liability = RemodelRoiFormValues['liabilities'][number]

function emptyBill(): Bill {
  return { now: null, cut: { mode: 'trades', value: null } }
}

function emptyCurrent(): Current {
  return { ageYears: null, likeForLikePrice: null, repairsPerYear: null }
}

export function createTradePicks(): { [K in TradeKey]: NonNullable<Trades[K]> } {
  return {
    hvac: { ducts: false, current: emptyCurrent() },
    roof: { current: emptyCurrent() },
    windowsAndDoors: { current: emptyCurrent() },
    atticBasement: {},
    exteriorPaintSiding: { current: emptyCurrent() },
    dryscapingHardscaping: {},
  }
}

export function createOtherLiability(): Liability {
  return { label: '', balance: null, monthlyPayment: null, aprPercent: null, kind: 'other' }
}

export function createRemodelRoiDefaults(config: RemodelRoiConfig): RemodelRoiFormValues {
  return {
    trades: { hvac: null, roof: null, windowsAndDoors: null, atticBasement: null, exteriorPaintSiding: null, dryscapingHardscaping: null },
    bills: { electric: emptyBill(), water: emptyBill(), gas: emptyBill(), gardening: emptyBill(), misc: emptyBill() },
    project: { price: null, incentives: null, downPayment: null, paymentMode: 'financed', aprPercent: null, termYears: config.defaultFinancing.termYears },
    homeValue: null,
    liabilities: [{ label: 'Mortgage', balance: null, monthlyPayment: null, aprPercent: null, kind: 'mortgage' }],
    assumptions: {
      ratesPercent: { electric: null, water: null, gas: null, gardening: null, misc: null },
      constructionPercent: null,
      homeAppreciationPercent: null,
      valueAddedPercent: null,
    },
  }
}
