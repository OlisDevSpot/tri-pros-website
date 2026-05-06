import { applyContractEvent } from '@/shared/dal/server/proposals/api'
import { mapZohoOperationToContractEvent, shouldNotifyOnContractEvent } from '@/shared/entities/proposals/lib/contract-events'
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
 *
 * Lookup is by `signingRequestId`. Once the project-management hub adds
 * addendum signing (PM-hub spec §7), this handler grows a parallel branch
 * that resolves by `media_files.tags.zohoEnvelopeId`.
 */
export const syncZohoSignStatusJob = createJob<SyncZohoSignStatusPayload>(
  'sync-zoho-sign-status',
  async ({ signingRequestId, operationType, performedAt }) => {
    const event = mapZohoOperationToContractEvent(operationType)
    if (!event) {
      return
    }

    const updated = await applyContractEvent({ signingRequestId, event, performedAt })
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
