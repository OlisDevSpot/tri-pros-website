import type { Wear } from '@/shared/modules/construction/core/constants/enums'
import type { AgeBands } from '@/shared/modules/construction/core/types'

import { wears } from '@/shared/modules/construction/core/constants/enums'

export function wearForAge(bands: AgeBands, years: number): Wear {
  const step = bands.findIndex(start => years < start)
  return wears[step === -1 ? bands.length : step]
}
