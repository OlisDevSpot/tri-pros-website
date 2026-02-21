import type { ScopeOrAddon } from './schema'
import type { RawPropertyMap } from '@/shared/services/notion/types'

export const SCOPE_OR_ADDON_PROPERTIES_MAP = {
  name: {
    label: 'Scope or Addon',
    type: 'title',
  },
  entryType: {
    label: 'Entry Type',
    type: 'select',
  },
  unitOfPricing: {
    label: 'Unit of Pricing',
    type: 'select',
  },
  relatedTrade: {
    label: 'Trade',
    type: 'relation',
  },
  relatedScopesOfWork: {
    label: 'Scopes of Work',
    type: 'relation',
  },
} as const satisfies RawPropertyMap<ScopeOrAddon>
