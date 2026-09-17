// Canonical entity-name constant for the ProjectMediaFile entity. Source of truth
// for `EntityName` and `AppSubject` (see domains/permissions/abilities.ts).
// @migration: media-files DAL is consumed directly by media.service — should eventually go through tRPC entity toolkit
export const PROJECT_MEDIA_FILE = 'ProjectMediaFile' as const

/**
 * Leaf identity for the project media unit. Read by the store AND by the CRUD
 * hooks (Task 5) — the hooks must NOT import the store, or the cycle in D6 gets
 * a second, unnecessary edge.
 */
export const PROJECT_MEDIA = {
  ownerKind: 'project',
  variants: ['sm', 'md', 'lg'],
} as const
