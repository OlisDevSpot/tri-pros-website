import type { Project } from './schema'
import type { RawPropertyMap } from '@/shared/services/notion/types'

export const PROJECT_PROPERTIES_MAP = {
  title: {
    label: 'Project',
    type: 'title',
  },
  relatedContactId: {
    label: 'Contact',
    type: 'relation',
  },
  salesrepsAssigned: {
    label: 'Salesreps Assigned',
    type: 'relation',
  },
} as const satisfies RawPropertyMap<Project>
