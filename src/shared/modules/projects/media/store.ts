import type { MediaStore } from '@/shared/modules/media/core/types'
import { projectMediaFiles } from '@/shared/db/schema/project-media-files'
import { projectMediaCrud } from '@/shared/modules/projects/media/dal/server/crud'
import { PROJECT_MEDIA } from '@/shared/modules/projects/media/lib/constants'
import { R2_BUCKETS } from '@/shared/services/providers/r2/types'

export const projectMediaStore: MediaStore = {
  ownerKind: PROJECT_MEDIA.ownerKind,
  table: projectMediaFiles,
  ownerColumn: projectMediaFiles.projectId,
  bucket: R2_BUCKETS.media,
  // Getter, not a property — see MediaStore.crud (D6).
  get crud() {
    return projectMediaCrud
  },
  buildPathKey: (ownerId, fileId, ext, extra) => `projects/${ownerId}/${extra?.phase ?? 'uncategorized'}/${fileId}${ext}`,
  variants: PROJECT_MEDIA.variants,
}
