import type { BenefitCategoryAccessor, BenefitsOfCategory } from '@/shared/db/types/benefits'
import type { ScopeAccessorOfTrade } from '@/shared/db/types/scopes'
import type { TradeAccessor } from '@/shared/db/types/trades'

type ScopeBenefitsData = {
  [U in TradeAccessor]?: {
    [S in ScopeAccessorOfTrade<U>]?: {
      [K in BenefitCategoryAccessor]?: BenefitsOfCategory<K>[]
    }
  }
}

export const scopeBenefitsData = {
  solar: {
    installPanels: {
      increaseValue: ['functionality', 'increasePropertyValue'],
      receiveIncentives: ['assistancePrograms', 'financing', 'rebates', 'taxDeductible', 'taxCredits'],
      reduceBills: ['electricBill'],
    },
    installBattery: {
      increaseValue: ['functionality', 'increasePropertyValue'],
      receiveIncentives: ['assistancePrograms', 'financing', 'rebates', 'taxDeductible', 'taxCredits'],
      reduceBills: ['electricBill'],
    },
  },
  roof: {
    overlay: {
      increaseComfort: ['noiseReduction'],
      increaseValue: ['fireResistance', 'homeAppeal', 'increasePropertyValue'],
      receiveIncentives: ['assistancePrograms', 'financing', 'rebates', 'taxDeductible'],
      reduceBills: ['gasBill', 'electricBill', 'reduceMaintenance'],
      reduceHeadache: ['hvacLife', 'leakMoldPrevention'],
    },
    tearOff: {
      increaseComfort: ['noiseReduction'],
      increaseValue: ['fireResistance', 'homeAppeal', 'increasePropertyValue'],
      receiveIncentives: ['assistancePrograms', 'financing', 'rebates', 'taxDeductible'],
      reduceBills: ['gasBill', 'electricBill', 'reduceMaintenance'],
      reduceHeadache: ['hvacLife', 'leakMoldPrevention'],
    },
    redeck: {
      increaseComfort: ['noiseReduction'],
      increaseValue: ['fireResistance', 'homeAppeal', 'increasePropertyValue'],
      receiveIncentives: ['assistancePrograms', 'financing', 'rebates', 'taxDeductible'],
      reduceBills: ['gasBill', 'electricBill', 'reduceMaintenance'],
      reduceHeadache: ['hvacLife', 'leakMoldPrevention'],
    },
    tileReset: {
      increaseValue: ['homeAppeal', 'increasePropertyValue'],
      receiveIncentives: ['assistancePrograms', 'financing', 'rebates', 'taxDeductible'],
      reduceBills: ['reduceMaintenance'],
      reduceHeadache: ['hvacLife', 'leakMoldPrevention'],
    },
  },
  windowsAndDoors: {
    replaceWindows: {
      increaseComfort: ['noiseReduction'],
      increaseValue: ['fireResistance', 'functionality', 'homeAppeal', 'homeSecurity', 'increasePropertyValue'],
      receiveIncentives: ['assistancePrograms', 'financing', 'rebates', 'taxDeductible'],
      reduceBills: ['gasBill', 'electricBill', 'reduceMaintenance'],
      reduceHeadache: ['hvacLife'],
    },
    replaceSlidingDoor: {
      increaseComfort: ['noiseReduction'],
      increaseValue: ['fireResistance', 'functionality', 'homeAppeal', 'homeSecurity', 'increasePropertyValue'],
      receiveIncentives: ['assistancePrograms', 'financing', 'rebates', 'taxDeductible'],
      reduceBills: ['gasBill', 'electricBill', 'reduceMaintenance'],
      reduceHeadache: ['hvacLife'],
    },
  },
  hvac: {
    replaceAC: {
      increaseComfort: ['airQuality'],
      increaseValue: ['increasePropertyValue', 'functionality'],
      receiveIncentives: ['assistancePrograms', 'financing', 'rebates', 'taxDeductible'],
      reduceBills: ['gasBill', 'electricBill', 'reduceMaintenance'],
      reduceHeadache: ['leakMoldPrevention', 'hvacLife'],
    },
    replaceFurnace: {
      increaseComfort: ['airQuality'],
      increaseValue: ['increasePropertyValue', 'functionality'],
      receiveIncentives: ['assistancePrograms', 'financing', 'rebates', 'taxDeductible'],
      reduceBills: ['gasBill', 'electricBill', 'reduceMaintenance'],
      reduceHeadache: ['leakMoldPrevention', 'hvacLife'],
    },
    replacePackageUnit: {
      increaseComfort: ['airQuality'],
      increaseValue: ['increasePropertyValue', 'functionality'],
      receiveIncentives: ['assistancePrograms', 'financing', 'rebates', 'taxDeductible'],
      reduceBills: ['gasBill', 'electricBill', 'reduceMaintenance'],
      reduceHeadache: ['leakMoldPrevention', 'hvacLife'],
    },
    replaceSplitSystem: {
      increaseComfort: ['airQuality'],
      increaseValue: ['increasePropertyValue', 'functionality'],
      receiveIncentives: ['assistancePrograms', 'financing', 'rebates', 'taxDeductible'],
      reduceBills: ['gasBill', 'electricBill', 'reduceMaintenance'],
      reduceHeadache: ['leakMoldPrevention', 'hvacLife'],
    },
    installMiniSplit: {
      increaseComfort: ['airQuality'],
      increaseValue: ['increasePropertyValue', 'functionality'],
      receiveIncentives: ['assistancePrograms', 'financing', 'rebates', 'taxDeductible'],
      reduceBills: ['gasBill', 'electricBill', 'reduceMaintenance'],
      reduceHeadache: ['leakMoldPrevention', 'hvacLife'],
    },
  },
  atticBasement: {
    rnrAttic: {
      increaseComfort: ['airQuality'],
      increaseValue: ['increasePropertyValue', 'fireResistance'],
      receiveIncentives: ['assistancePrograms', 'financing', 'rebates', 'taxDeductible', 'taxCredits'],
      reduceBills: ['gasBill', 'electricBill'],
      reduceHeadache: ['leakMoldPrevention', 'hvacLife'],
    },
    installCrawlSpaceInsulation: {
      increaseComfort: ['airQuality'],
      increaseValue: ['increasePropertyValue', 'fireResistance'],
      receiveIncentives: ['assistancePrograms', 'financing', 'rebates', 'taxDeductible', 'taxCredits'],
      reduceBills: ['gasBill', 'electricBill'],
      reduceHeadache: ['leakMoldPrevention', 'hvacLife'],
    },
    topOffAttic: {
      increaseComfort: ['airQuality'],
      increaseValue: ['increasePropertyValue', 'fireResistance'],
      receiveIncentives: ['assistancePrograms', 'financing', 'rebates', 'taxDeductible', 'taxCredits'],
      reduceBills: ['gasBill', 'electricBill'],
      reduceHeadache: ['leakMoldPrevention', 'hvacLife'],
    },
  },
  dryscapingHardscaping: {
    installArtificial: {
      increaseValue: ['homeAppeal', 'increasePropertyValue'],
      receiveIncentives: ['assistancePrograms', 'financing', 'rebates', 'taxDeductible'],
      reduceBills: ['waterBill', 'gardeningBill', 'reduceMaintenance'],
    },
    installConcrete: {
      increaseValue: ['homeAppeal', 'increasePropertyValue', 'fireResistance'],
      receiveIncentives: ['assistancePrograms', 'financing', 'rebates', 'taxDeductible'],
      reduceBills: ['waterBill', 'gardeningBill', 'reduceMaintenance'],
    },
    installPavers: {
      increaseValue: ['homeAppeal', 'increasePropertyValue', 'fireResistance'],
      receiveIncentives: ['assistancePrograms', 'financing', 'rebates', 'taxDeductible'],
      reduceBills: ['waterBill', 'gardeningBill', 'reduceMaintenance'],
    },
    installGravel: {
      increaseValue: ['homeAppeal', 'increasePropertyValue', 'fireResistance'],
      receiveIncentives: ['assistancePrograms', 'financing', 'rebates', 'taxDeductible'],
      reduceBills: ['waterBill', 'gardeningBill', 'reduceMaintenance'],
    },
    installMulch: {
      increaseValue: ['homeAppeal', 'increasePropertyValue', 'fireResistance'],
      receiveIncentives: ['assistancePrograms', 'financing', 'rebates', 'taxDeductible'],
      reduceBills: ['waterBill', 'gardeningBill', 'reduceMaintenance'],
    },
  },
} as const satisfies ScopeBenefitsData
