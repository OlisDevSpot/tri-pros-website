import type { userRoles } from '@/shared/constants/enums/user'

export type UserRole = (typeof userRoles)[number]
