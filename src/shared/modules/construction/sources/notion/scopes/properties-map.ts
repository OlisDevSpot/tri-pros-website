import type { Scope } from '@/shared/modules/construction/core/schemas'
import type { RawPropertyMap } from '@/shared/services/providers/notion/types'

export const SCOPE_PROPERTIES_MAP = {
  name: {
    label: 'Scope or Addon',
    type: 'title',
  },
  kind: {
    label: 'Entry Type',
    type: 'select',
  },
  unitOfPricing: {
    label: 'Unit of Pricing',
    type: 'select',
  },
  tradeId: {
    label: 'Trade',
    type: 'relation',
  },
  sowIds: {
    label: 'Scopes of Work',
    type: 'relation',
  },
} as const satisfies RawPropertyMap<Omit<Scope, 'coverImageUrl'>>
