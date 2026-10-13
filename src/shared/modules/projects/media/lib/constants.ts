import { R2_BUCKETS } from '@/shared/services/providers/r2/types'

// Canonical entity-name constant for the ProjectMediaFile entity. Source of truth
// for `EntityName` and `AppSubject` (see domains/permissions/abilities.ts).
export const PROJECT_MEDIA_FILE = 'ProjectMediaFile' as const

/**
 * Leaf identity for the project media unit. Read by the store AND by the CRUD
 * hooks — the store imports the crud, so hooks importing the store would form an
 * import cycle.
 */
export const PROJECT_MEDIA = {
  ownerKind: 'project',
  variants: ['sm', 'md', 'lg'],
  bucket: R2_BUCKETS.media,
  pathKeyPrefix: (projectId: string) => `projects/${projectId}/`,
} as const
