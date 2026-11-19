import type { ReactNode } from 'react'
import type { WeatherSky } from '@/features/trade-scenes/types'

import { createContext, use } from 'react'

// Lets a surface draw its own lot in the home kit's place without the kit knowing about layouts.
export const LotSlotContext = createContext<((ground: WeatherSky['ground']) => ReactNode) | null>(null)

export function useLotSlot() {
  return use(LotSlotContext)
}
