import type { Project } from './schema'

export const PROJECT_PROPERTIES_MAP = {
  title: 'Project',
  relatedContactId: 'Contact',
  salesrepsAssigned: 'Salesreps Assigned',
} as const satisfies Omit<Record<keyof Project, string>, 'id'>
