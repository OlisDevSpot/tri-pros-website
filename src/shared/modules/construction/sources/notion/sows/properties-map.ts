import type { SowTemplate } from '@/shared/modules/construction/core/schemas'
import type { RawPropertyMap } from '@/shared/services/providers/notion/types'

export const SOW_TEMPLATE_PROPERTIES_MAP = {
  name: {
    label: 'SOW',
    type: 'title',
  },
  scopeIds: {
    label: 'Scope',
    type: 'relation',
  },
} as const satisfies RawPropertyMap<SowTemplate>
