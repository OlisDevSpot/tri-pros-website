export const SOW_SECTION_TABS = [
  { id: 'description', label: 'Description' },
  { id: 'pricing', label: 'Pricing' },
] as const

export type SowSectionTab = (typeof SOW_SECTION_TABS)[number]['id']
