import type { Wear } from '@/shared/modules/construction/core/constants/enums'
import type { AgeBands } from '@/shared/modules/construction/core/types'

import { wears } from '@/shared/modules/construction/core/constants/enums'

export function ageBandOf(bands: AgeBands, wear: Wear): readonly [from: number, to: number | null] {
  const step = wears.indexOf(wear)
  return [step === 0 ? 0 : bands[step - 1], bands[step] ?? null]
}
