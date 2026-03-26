import type { NotionPainPoint } from './schema'
import type { RawPropertyMap } from '@/shared/services/notion/types'

export const PAIN_POINT_PROPERTIES_MAP = {
  name: { label: 'Pain point', type: 'title' },
  accessor: { label: 'Accessor', type: 'rich_text' },
  category: { label: 'Category', type: 'select' },
  severity: { label: 'Severity', type: 'select' },
  urgency: { label: 'Urgency', type: 'select' },
  emotionalDrivers: { label: 'Emotional Drivers', type: 'multi_select' },
  trades: { label: 'Trades', type: 'relation' },
  householdResonance: { label: 'Household Resonance', type: 'multi_select' },
  programFit: { label: 'Program Fit', type: 'multi_select' },
  tags: { label: 'Tags', type: 'multi_select' },
} as const satisfies RawPropertyMap<Omit<NotionPainPoint, 'id'>>
