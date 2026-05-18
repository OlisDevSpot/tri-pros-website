import { SYSTEM_CONTEXT } from '@/shared/dal/server/lib/types'
import { mapZohoOperationToContractEvent, shouldNotifyOnContractEvent } from '@/shared/entities/proposals/lib/contract-events'
import { contractService } from '@/shared/services/contracts.service'
import { notificationService } from '@/shared/services/notification.service'
import { createJob } from '../lib/create-job'

interface SyncZohoSignStatusPayload {
  signingRequestId: string
  /** Raw operation_type from Zoho — may not match our known enum values. */
  operationType: string
  performedAt: string
}

/**
 * Persists a single Zoho Sign event onto the matching proposal.
 * Lookup is by `signingRequestId`. Business logic (idempotency,
 * auto-approve) lives in contractService.applyContractEvent.
 */
export const syncZohoSignStatusJob = createJob<SyncZohoSignStatusPayload>(
  'sync-zoho-sign-status',
  async ({ signingRequestId, operationType, performedAt }) => {
    const event = mapZohoOperationToContractEvent(operationType)
    if (!event) {
      return
    }

    const updated = await contractService.applyContractEvent(SYSTEM_CONTEXT, { signingRequestId, event, performedAt })
    if (!updated) {
      return
    }

    if (shouldNotifyOnContractEvent(event)) {
      await notificationService.notifyContractStatusChange({
        event,
        proposalOwnerId: updated.ownerId,
        proposalId: updated.id,
        occurredAt: performedAt,
      })
    }
  },
)
