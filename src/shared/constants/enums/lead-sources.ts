/** `manual`: spend is typed in each month. `none`: the source costs nothing (referrals, walk-ins), so it is never "missing". */
export const leadSourceSpendModes = ['manual', 'none'] as const
export type LeadSourceSpendMode = (typeof leadSourceSpendModes)[number]
