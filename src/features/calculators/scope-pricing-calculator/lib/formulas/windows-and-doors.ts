import { defineFormula } from '@/features/calculators/scope-pricing-calculator/lib/define-formula'

export const replaceWindows = defineFormula({
  key: 'replaceWindows',
  trade: 'windowsAndDoors',
  label: 'Window replacement',
  outcome: 'Improve comfort, efficiency, and curb appeal with modern double-pane windows',
  variables: ['numSmallWindows', 'numLargeWindows'],
  compute({ numSmallWindows, numLargeWindows }, _context, costs) {
    return numSmallWindows * costs.windowSmall + numLargeWindows * costs.windowLarge
  },
})

export const replaceSlidingDoor = defineFormula({
  key: 'replaceSlidingDoor',
  trade: 'windowsAndDoors',
  label: 'Replace sliding door',
  outcome: 'Upgrade to a smoother, more efficient sliding door that improves access, insulation, and aesthetics',
  variables: ['numStandardSliders', 'numSpecialSliders'],
  compute({ numStandardSliders, numSpecialSliders }, _context, costs) {
    return numStandardSliders * costs.slidingDoorStandard + numSpecialSliders * costs.slidingDoorSpecial
  },
})

export const replaceFrenchDoors = defineFormula({
  key: 'replaceFrenchDoors',
  trade: 'windowsAndDoors',
  label: 'Replace french doors',
  outcome: 'Enhance your entryway with elegant, energy-efficient french doors that brighten the space',
  variables: ['numFrenchDoors'],
  compute({ numFrenchDoors }, _context, costs) {
    return numFrenchDoors * costs.frenchDoor
  },
})
