import { SYSTEM_CONTEXT } from '@/shared/dal/server/lib/types'
import { zohoSignService } from '@/shared/services/zoho-sign.service'

import { createJob } from '../lib/create-job'

interface SyncContractDraftPayload {
  proposalId: string
}

export const syncContractDraftJob = createJob<SyncContractDraftPayload>(
  'sync-contract-draft',
  async ({ proposalId }) => {
    await zohoSignService.ensureDraftSynced(SYSTEM_CONTEXT, proposalId)
  },
)
