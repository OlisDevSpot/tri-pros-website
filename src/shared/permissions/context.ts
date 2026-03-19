// ─── Ability React Context ──────────────────────────────────────────────────
// Holds the CASL ability instance for the current user.
// Consumed via the useAbility() hook (see hooks.ts).

import type { AppAbility } from './types'

import { createMongoAbility } from '@casl/ability'
import { createContext } from 'react'

// Default: an empty ability that denies everything.
// This is what components see before the provider mounts or when
// there is no authenticated user.
export const AbilityContext = createContext<AppAbility>(createMongoAbility())
