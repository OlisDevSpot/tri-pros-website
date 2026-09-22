import type { Trade } from '@/shared/modules/construction/core/schemas'
import type { RawPropertyMap } from '@/shared/services/providers/notion/types'

/** `disabled` is an extraction-time gate, not a domain field — see ./adapter.ts. */
export type TradePropertySource = Omit<Trade, 'slug' | 'coverImageUrl'> & { disabled: boolean }

export const TRADE_PROPERTIES_MAP = {
  name: {
    label: 'Trade',
    type: 'title',
  },
  category: {
    label: 'Type',
    type: 'select',
  },
  scopeIds: {
    label: 'Scopes',
    type: 'relation',
  },
  disabled: {
    label: 'Disabled',
    type: 'checkbox',
  },
} as const satisfies RawPropertyMap<TradePropertySource>
