import type { MediaStore } from '@/shared/modules/media/core/types'
import { proposalMediaFiles } from '@/shared/db/schema/proposal-media-files'
import { proposalMediaCrud } from '@/shared/modules/proposals/media/dal/server/crud'
import { PROPOSAL_MEDIA } from '@/shared/modules/proposals/media/lib/constants'

export const proposalMediaStore: MediaStore = {
  ownerKind: PROPOSAL_MEDIA.ownerKind,
  table: proposalMediaFiles,
  ownerColumn: proposalMediaFiles.proposalId,
  bucket: PROPOSAL_MEDIA.bucket,
  // Getter, not a property — see MediaStore.crud. The store imports the crud, so a property would form an import cycle.
  get crud() {
    return proposalMediaCrud
  },
  buildPathKey: (ownerId, fileId, ext) => `${PROPOSAL_MEDIA.pathKeyPrefix(ownerId)}${fileId}${ext}`,
  variants: PROPOSAL_MEDIA.variants,
}
