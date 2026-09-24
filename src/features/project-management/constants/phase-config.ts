import type { MediaPhase } from '@/shared/constants/enums/media'

export const PHASE_CONFIG: { key: MediaPhase, fallbackDescription: string }[] = [
  { key: 'before', fallbackDescription: 'Where the project began' },
  { key: 'during', fallbackDescription: 'The transformation in progress' },
  { key: 'after', fallbackDescription: 'The finished result' },
]
