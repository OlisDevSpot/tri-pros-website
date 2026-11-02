'use client'

import type { ScenePinRegistry } from '@/shared/components/scene/types'

import { createContext } from 'react'

export const ScenePinsContext = createContext<ScenePinRegistry | null>(null)
