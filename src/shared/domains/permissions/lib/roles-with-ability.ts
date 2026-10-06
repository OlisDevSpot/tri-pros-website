import type { UserRole } from '@/shared/constants/enums'
import type { Permission } from '@/shared/domains/permissions/types'

import { userRoles } from '@/shared/constants/enums'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'

/** A SQL `role IN (…)` needs role strings; deriving them from the abilities keeps the two from drifting. */
export function rolesWithAbility(...permission: Permission): UserRole[] {
  return userRoles.filter(role => defineAbilitiesFor({ id: '', role }).can(...permission))
}
