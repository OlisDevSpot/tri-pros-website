export const BENEFIT_KINDS = ['savings', 'easier-on-hvac', 'protection', 'lasts-longer', 'warranty', 'looks-and-use', 'planet'] as const

export type BenefitKind = typeof BENEFIT_KINDS[number]

// Savings and Planet are worked out from the picks; the rest are written per upgrade.
export type WrittenBenefitKind = Exclude<BenefitKind, 'savings' | 'planet'>

export const BENEFIT_KIND_LABELS = {
  'savings': 'Savings',
  'easier-on-hvac': 'Easier on HVAC',
  'protection': 'Protection',
  'lasts-longer': 'Lasts longer',
  'warranty': 'Warranty',
  'looks-and-use': 'Looks & use',
  'planet': 'Planet',
} as const satisfies Record<BenefitKind, string>
