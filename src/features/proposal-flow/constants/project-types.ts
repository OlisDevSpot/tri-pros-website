import type { ProjectType } from '@/shared/types/enums'

export const PROJECT_TYPES: Record<ProjectType, { title: string, description: string }> = {
  'energy-efficient': {
    title: 'Energy Efficient',
    description: 'Energy efficient projects',
  },
  'general-remodeling': {
    title: 'General Remodeling',
    description: 'General remodeling projects',
  },
}
