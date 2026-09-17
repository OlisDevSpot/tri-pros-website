// src/shared/services/media/stores.ts
import type { PgColumn } from 'drizzle-orm/pg-core'
import type { CrudHandlers } from '@/shared/dal/server/types'
import type { R2BucketName } from '@/shared/services/providers/r2/types'
import { projectMediaFiles } from '@/shared/db/schema/project-media-files'
import { proposalMediaFiles } from '@/shared/db/schema/proposal-media-files'
import { projectMediaCrud } from '@/shared/modules/projects/media/dal/server/crud'
import { proposalMediaCrud } from '@/shared/modules/proposals/media/dal/server/crud'
import { R2_BUCKETS } from '@/shared/services/providers/r2/types'

export type MediaOwnerKind = 'project' | 'proposal'

export interface MediaStore {
  ownerKind: MediaOwnerKind
  table: any // one of the base-media tables; contained generic (rule is off repo-wide)
  ownerColumn: PgColumn // table.projectId | table.proposalId
  bucket: R2BucketName
  /** The child entity's scoped CRUD DAL — the service rings these instead of touching `db`. */
  crud: CrudHandlers<any, number>
  /** builds the R2 object key for a new upload */
  buildPathKey: (ownerId: string, fileId: string, ext: string, extra?: Record<string, string>) => string
}

export const projectMediaStore: MediaStore = {
  ownerKind: 'project',
  table: projectMediaFiles,
  ownerColumn: projectMediaFiles.projectId,
  bucket: R2_BUCKETS.media,
  crud: projectMediaCrud,
  buildPathKey: (ownerId, fileId, ext, extra) => `projects/${ownerId}/${extra?.phase ?? 'uncategorized'}/${fileId}${ext}`,
}

export const proposalMediaStore: MediaStore = {
  ownerKind: 'proposal',
  table: proposalMediaFiles,
  ownerColumn: proposalMediaFiles.proposalId,
  bucket: R2_BUCKETS.media,
  crud: proposalMediaCrud,
  buildPathKey: (ownerId, fileId, ext) => `proposals/${ownerId}/${fileId}${ext}`,
}
