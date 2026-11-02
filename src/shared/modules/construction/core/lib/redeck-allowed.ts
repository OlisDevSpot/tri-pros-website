import { ROOF_OFF_SCOPE_IDS } from '@/shared/modules/construction/core/constants/scopes-by-existing-roof'

export function redeckAllowed(scopeIds: readonly string[]): boolean {
  return scopeIds.some(id => (ROOF_OFF_SCOPE_IDS as readonly string[]).includes(id))
}
