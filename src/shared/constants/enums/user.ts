export const userRoles = ['user', 'homeowner', 'agent', 'super-admin', 'dispatcher'] as const
export type UserRole = (typeof userRoles)[number]
