import { defineFormula } from '@/features/calculators/scope-pricing-calculator/lib/define-formula'

export const replaceSplitSystem = defineFormula({
  key: 'replaceSplitSystem',
  trade: 'hvac',
  label: 'Replace split system',
  outcome: 'Install a modern HVAC system that delivers better comfort, quieter operation, and lower energy costs',
  variables: ['systemTonnage'],
  compute({ systemTonnage }, _context, costs) {
    return costs.threeTonRnr + (systemTonnage - 3) * costs.perTonStep
  },
})

export const replaceFurnace = defineFormula({
  key: 'replaceFurnace',
  trade: 'hvac',
  label: 'Replace furnace',
  outcome: 'Replace your aging furnace for improved heating performance, safety, and efficiency',
  variables: ['systemTonnage'],
  compute({ systemTonnage }, _context, costs) {
    return costs.furnace36kBTURnr + (systemTonnage - 3) * costs.perTonStep
  },
})

export const installMiniSplit = defineFormula({
  key: 'installMiniSplit',
  trade: 'hvac',
  label: 'Install mini-split',
  outcome: 'Add targeted, high-efficiency heating and cooling with compact, quiet mini-split units',
  variables: ['numMiniSplits'],
  compute({ numMiniSplits }, _context, costs) {
    return costs.miniSplits * numMiniSplits
  },
})
