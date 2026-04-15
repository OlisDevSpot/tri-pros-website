export const userRoles = ['user', 'homeowner', 'agent', 'super-admin'] as const
export type UserRole = (typeof userRoles)[number]
