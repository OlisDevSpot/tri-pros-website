import type { LotSide, YardId } from '@/features/trade-scenes/types'

export const YARD_IDS = ['front-yard', 'back-yard', 'left-side-yard', 'right-side-yard'] as const

export const AREA_GROUP_IDS = ['exterior', 'interior', 'lot'] as const

export const GROUND_SYSTEM_IDS = ['landscaping', 'hardscaping'] as const

export const YARD_SYSTEM_IDS = ['landscaping', 'hardscaping', 'fencing', 'patio-cover'] as const

// The lot line each yard's fences stand on, which decides the kinds it offers: the front yard's are capped.
export const YARD_LOT_SIDES = { 'front-yard': 'front', 'back-yard': 'back', 'left-side-yard': 'left', 'right-side-yard': 'right' } as const satisfies Record<YardId, LotSide>
