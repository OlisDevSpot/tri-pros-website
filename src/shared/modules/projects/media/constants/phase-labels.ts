import type { MediaPhase } from '@/shared/constants/enums/media'

export const PHASE_LABELS: Record<MediaPhase, string> = {
  before: 'Before',
  during: 'During',
  after: 'After',
  uncategorized: 'Gallery',
}
