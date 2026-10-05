import type { MediaPhase } from '@/shared/constants/enums/media'

/** Photos per media phase, videos excluded; every phase present, zero when empty. */
export type MediaPhaseCounts = Record<MediaPhase, number>
