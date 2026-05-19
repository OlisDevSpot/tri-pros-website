// Canonical entity-name constant for the User entity. Source of truth
// for `EntityName` and `AppSubject` (see domains/permissions/abilities.ts).
// Note: Users are managed by better-auth — no EntityServerSpec.
export const USER = 'User' as const
