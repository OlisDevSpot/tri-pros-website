import type { Trade } from './schema'
import type { RawPropertyMap } from '@/shared/services/notion/types'

export const TRADE_PROPERTIES_MAP = {
  name: {
    label: 'Trade',
    type: 'title',
  },
  type: {
    label: 'Type',
    type: 'select',
  },
  homeOrLot: {
    label: 'Home or Lot',
    type: 'select',
  },
  relatedScopes: {
    label: 'Scopes',
    type: 'relation',
  },
} as const satisfies RawPropertyMap<Trade>
