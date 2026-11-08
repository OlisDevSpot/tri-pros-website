'use client'

import type { RefObject } from 'react'

import { createContext } from 'react'

// How far up close still shows: 1 while looking inside, easing to 0 as the ghost eases home. The house's one leave ease,
// so whatever closes as up close lets go closes on it.
export const LookInsideFadeContext = createContext<RefObject<number> | null>(null)
