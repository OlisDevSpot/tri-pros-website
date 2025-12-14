export const tags = [
  'modern',
  'full-remodel',
  'new-construction',
  'luxury',
  'energy-efficient',
  'sustainable',
  'eco-friendly',
  'green',

  // trades
  'roof',
  'hvac',
  'plumbing',
  'electricals',
  'windows',
  'doors',
  'siding',
  'flooring',
  'kitchen',
  'bathroom',
] as const

export type Tag = typeof tags[number]
