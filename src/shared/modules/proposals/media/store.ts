import type { MediaStore } from '@/shared/modules/media/core/types'
import { proposalMediaFiles } from '@/shared/db/schema/proposal-media-files'
import { proposalMediaCrud } from '@/shared/modules/proposals/media/dal/server/crud'
import { PROPOSAL_MEDIA } from '@/shared/modules/proposals/media/lib/constants'
import { R2_BUCKETS } from '@/shared/services/providers/r2/types'

export const proposalMediaStore: MediaStore = {
  ownerKind: PROPOSAL_MEDIA.ownerKind,
  table: proposalMediaFiles,
  ownerColumn: proposalMediaFiles.proposalId,
  bucket: R2_BUCKETS.media,
  // Getter, not a property — see MediaStore.crud (D6).
  get crud() {
    return proposalMediaCrud
  },
  buildPathKey: (ownerId, fileId, ext) => `proposals/${ownerId}/${fileId}${ext}`,
  variants: PROPOSAL_MEDIA.variants,
}
