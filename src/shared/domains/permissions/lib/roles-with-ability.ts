import type { UserRole } from '@/shared/constants/enums'
import type { AppAction, AppSubject } from '@/shared/domains/permissions/types'

import { userRoles } from '@/shared/constants/enums'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'

/** A SQL `role IN (…)` needs role strings; deriving them from the abilities keeps the two from drifting. */
export function rolesWithAbility(action: AppAction, subject: AppSubject): UserRole[] {
  return userRoles.filter(role => defineAbilitiesFor({ id: '', role }).can(action, subject))
}
