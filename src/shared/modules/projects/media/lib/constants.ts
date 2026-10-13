import { R2_BUCKETS } from '@/shared/services/providers/r2/types'

// Canonical entity-name constant for the ProjectMediaFile entity. Source of truth
// for `EntityName` and `AppSubject` (see domains/permissions/abilities.ts).
export const PROJECT_MEDIA_FILE = 'ProjectMediaFile' as const

/**
 * Leaf identity for the project media unit. Read by the store AND by the CRUD
 * hooks (Task 5) — the hooks must NOT import the store, or the cycle in D6 gets
 * a second, unnecessary edge.
 */
export const PROJECT_MEDIA = {
  ownerKind: 'project',
  variants: ['sm', 'md', 'lg'],
  bucket: R2_BUCKETS.media,
  pathKeyPrefix: (projectId: string) => `projects/${projectId}/`,
} as const
