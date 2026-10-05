import { rolesWithAbility } from '@/shared/domains/permissions/lib/roles-with-ability'

/** Who can sit a meeting: the roles that own the meetings they book. */
export const PARTICIPANT_ROLES = rolesWithAbility('own', 'Meeting')

/** Who can have booked a meeting: dispatchers book most of them but never sit one. */
export const SETTER_ROLES = rolesWithAbility('create', 'Meeting')
