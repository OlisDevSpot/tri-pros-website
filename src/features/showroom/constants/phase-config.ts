import type { ProjectMediaGroups } from '@/shared/entities/projects/types'

export const PHASE_CONFIG: { key: keyof ProjectMediaGroups, label: string, fallbackDescription: string }[] = [
  { key: 'before', label: 'Before', fallbackDescription: 'Where the project began' },
  { key: 'during', label: 'During', fallbackDescription: 'The transformation in progress' },
  { key: 'after', label: 'After', fallbackDescription: 'The finished result' },
]
