export const painPointSeverities = ['critical', 'high', 'medium', 'low', 'variable'] as const
export type PainPointSeverity = (typeof painPointSeverities)[number]

export const painPointUrgencies = ['critical', 'high', 'medium', 'low'] as const
export type PainPointUrgency = (typeof painPointUrgencies)[number]

export const painPointEmotionalDrivers = [
  'fear',
  'lossAversion',
  'maximizeGain',
  'prideOfOwnership',
  'socialProof',
  'trust',
] as const
export type PainPointEmotionalDriver = (typeof painPointEmotionalDrivers)[number]

export const painPointCategories = [
  'Thermal Inefficiencies & Discomfort',
  'Financial Leak',
  'Structural Risk',
  'Health (IAQ) And Safety',
  'Missed Aesthetics And Resale Potential',
  'Deferred Lifestyle Upgrades',
  'Life Trigger',
] as const
export type PainPointCategory = (typeof painPointCategories)[number]
