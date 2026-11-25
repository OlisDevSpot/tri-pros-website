import type { PropertyLayout } from '@/features/trade-scenes/types'
import { LAYOUT_TILE } from '@/features/trade-scenes/constants/layout-grid'
import { defaultLayout } from '@/features/trade-scenes/lib/default-layout'

export const DEFAULT_LAYOUT = defaultLayout(LAYOUT_TILE)

export const LAYOUT_FIXTURES: Record<'ranch', PropertyLayout> = { ranch: DEFAULT_LAYOUT }
