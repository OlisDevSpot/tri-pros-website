import { contractService } from '@/shared/services/contract.service'

import { createJob } from '../lib/create-job'

interface SyncContractDraftPayload {
  proposalId: string
  ownerKey: string | null
}

export const syncContractDraftJob = createJob<SyncContractDraftPayload>(
  'sync-contract-draft',
  async ({ proposalId, ownerKey }) => {
    await contractService.ensureDraftSynced(proposalId, ownerKey)
  },
)
