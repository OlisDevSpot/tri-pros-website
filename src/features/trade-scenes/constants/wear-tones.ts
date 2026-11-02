import type { StatusTone } from '@/shared/constants/status-tones'
import type { Wear } from '@/shared/modules/construction/core/constants/enums'

export const WEAR_TONES = { new: 'success', good: 'success', fair: 'attention', worn: 'danger', failing: 'danger' } satisfies Record<Wear, StatusTone>
