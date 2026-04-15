// ─── useAbility Hook ────────────────────────────────────────────────────────
// Use this in any client component to check permissions:
//
//   const ability = useAbility()
//   ability.can('delete', 'Customer')   // true/false
//   ability.cannot('update', 'Meeting') // true/false
//
// The ability updates automatically when the user's session changes.

import type { AppAbility } from './types'

import { use } from 'react'

import { AbilityContext } from './context'

export function useAbility(): AppAbility {
  return use(AbilityContext)
}
