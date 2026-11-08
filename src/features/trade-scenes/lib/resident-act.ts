import type { Comfort, ResidentAct } from '@/features/trade-scenes/types'
import type { Weather } from '@/shared/modules/construction/core/types'

import { RESIDENT_CLIPS } from '@/features/trade-scenes/constants/resident-clips'

// No comfort (a home with no heat model to read) means nothing to react to, so the residents stay at ease.
export function residentAct(weather: Weather, comfort: Comfort | null, leakInside: number): ResidentAct {
  if (weather === 'rain') {
    return RESIDENT_CLIPS.rain[leakInside > 0 ? 'leaking' : 'dry']
  }
  return RESIDENT_CLIPS[weather][comfort ?? 'fair']
}
