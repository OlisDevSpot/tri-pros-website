import type { YearBuiltRange } from '@/shared/constants/enums/customers'
import type { InsulationLevel, RoofType } from '@/shared/modules/construction/core/constants/enums'

import { roofTypes } from '@/shared/modules/construction/core/constants/enums'

export const INSULATION_BY_LEVEL = { none: null, r11: 'batts-r11', r19: 'batts-r19', r30: 'batts-r30', r38: 'blown-r38' } as const satisfies Record<InsulationLevel, string | null>

export const COVERING_BY_ROOF = { shingle: 'shingle', tile: 'tile', flat: 'membrane', metal: 'shingle', woodshake: 'wood-shake' } as const satisfies Record<RoofType, string>

// Metal has no drawing yet, so it draws as the nearest covering; a roof is drawn exactly only when it is not listed here.
const NEAREST_DRAWN_ROOFS: readonly RoofType[] = ['metal']
export const EXACT_ROOFS: readonly RoofType[] = roofTypes.filter(roofType => !NEAREST_DRAWN_ROOFS.includes(roofType))

// Drip edge became standard practice in the late 1970s.
export const ERAS_WITH_DRIP_EDGE: ReadonlySet<YearBuiltRange> = new Set<YearBuiltRange>(['1978-1998', '1998-2014', 'Post-2014'])
