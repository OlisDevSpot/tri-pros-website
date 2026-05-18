import type { SOW } from './schema'
import type { RawPropertyMap } from '@/shared/services/notion/types'

export const SOW_PROPERTIES_MAP = {
  name: {
    label: 'SOW',
    type: 'title',
  },
  relatedScope: {
    label: 'Scope',
    type: 'relation',
  },
} as const satisfies RawPropertyMap<SOW>
