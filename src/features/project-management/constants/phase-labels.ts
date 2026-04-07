import type { MediaPhase } from '@/shared/types/enums/media'

export const PHASE_LABELS: Record<MediaPhase, string> = {
  before: 'Before',
  during: 'During',
  after: 'After',
  uncategorized: 'Gallery',
}
