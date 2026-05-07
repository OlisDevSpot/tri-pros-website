import type { SOW } from '../types'

const EMPTY_SOW_SECTION: SOW = {
  contentJSON: '',
  html: '',
  scopes: [],
  title: '',
  trade: { id: '', label: '' },
  financials: {
    sectionPrice: null,
    costLines: [],
    incentives: [],
  },
}

export function createEmptySowSection(overrides?: Partial<SOW>): SOW {
  return structuredClone({ ...EMPTY_SOW_SECTION, ...overrides })
}
