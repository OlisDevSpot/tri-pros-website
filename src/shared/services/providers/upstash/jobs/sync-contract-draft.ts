import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { contractService } from '@/shared/services/contracts.service'

import { createJob } from '../lib/create-job'

interface SyncContractDraftPayload {
  proposalId: string
}

export const syncContractDraftJob = createJob<SyncContractDraftPayload>(
  'sync-contract-draft',
  async ({ proposalId }) => {
    await contractService.ensureDraftSynced(SYSTEM_CONTEXT, proposalId)
  },
)
