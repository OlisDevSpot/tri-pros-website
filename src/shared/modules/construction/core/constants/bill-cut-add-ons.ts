// An add-on is a bill cut of its own, so `insulation-step-up` stays apart from the efficiency upgrade that picks R-38, as `ducts` is from `r8-ducts`.
export const BILL_CUT_ADD_ON_IDS = ['ducts', 'radiant-barrier', 'attic-fan', 'insulation-step-up'] as const
export type BillCutAddOnId = typeof BILL_CUT_ADD_ON_IDS[number]

export const BILL_CUT_ADD_ON_LABELS = { 'ducts': 'Ducts', 'radiant-barrier': 'Radiant barrier', 'attic-fan': 'Attic fan', 'insulation-step-up': 'R-38 insulation' } as const satisfies Record<BillCutAddOnId, string>
