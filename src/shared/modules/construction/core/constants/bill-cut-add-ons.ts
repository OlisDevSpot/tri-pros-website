export const BILL_CUT_ADD_ON_IDS = ['ducts', 'radiant-barrier', 'attic-fan'] as const
export type BillCutAddOnId = typeof BILL_CUT_ADD_ON_IDS[number]

export const BILL_CUT_ADD_ON_LABELS = { 'ducts': 'Ducts', 'radiant-barrier': 'Radiant barrier', 'attic-fan': 'Attic fan' } as const satisfies Record<BillCutAddOnId, string>
