'use client'

import type { Permission } from '@/shared/domains/permissions/types'

import { useAbility } from '@/shared/domains/permissions/client'

interface Props {
  permission: Permission
  children: React.ReactNode
}

/** A section about something the viewer may not see is left out, never shown empty: "no proposals" would be a lie to someone who cannot read proposals. */
export function Can({ permission, children }: Props) {
  const ability = useAbility()
  return ability.can(...permission) ? children : null
}
