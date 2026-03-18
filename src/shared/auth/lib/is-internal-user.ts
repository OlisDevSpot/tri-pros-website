import type { UserRole } from '@/shared/types/enums'

export function checkIsInternalUser(role: UserRole | undefined) {
  const isInternal = role === 'agent' || role === 'super-admin'
  return isInternal
}
