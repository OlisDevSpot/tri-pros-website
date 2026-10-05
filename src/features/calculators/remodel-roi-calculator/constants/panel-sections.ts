export const PANEL_SECTION_KEYS = ['trades', 'project', 'bills', 'home'] as const

export type PanelSectionKey = typeof PANEL_SECTION_KEYS[number]

export const PANEL_SECTION_LABELS = {
  trades: 'Trades in the project',
  project: 'Price and financing',
  bills: 'Bills today',
  home: 'Home and loans',
} as const satisfies Record<PanelSectionKey, string>

export const PANEL_SECTION_SHORT_LABELS = {
  trades: 'Trades',
  project: 'Price',
  bills: 'Bills',
  home: 'Home',
} as const satisfies Record<PanelSectionKey, string>
