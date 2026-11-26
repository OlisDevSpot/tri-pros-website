import type { WorkDetailsKind } from '@/features/trade-scenes/lib/work-details-kind'
import type { SceneChangeSlotId } from '@/features/trade-scenes/types'

export const DETAILS_SWITCH: Record<WorkDetailsKind, SceneChangeSlotId | null> = { 'shingle': 'upgrade:cool-roof', 'membrane': 'upgrade:cool-roof', 'paint': 'upgrade:cool-paint', 'vinyl-frame': null, 'gutter': null, 'indoor-unit': 'move:indoor-unit', 'mini-split': null }
