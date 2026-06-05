import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { isEnvelopeFullySigned, mapZohoOperationToContractEvent, shouldNotifyOnContractEvent } from '@/shared/entities/proposals/lib/contract-events'
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

    // Zoho fires the signing-success op once PER SIGNER. Derive true
    // completion from live signer statuses before treating the envelope as
    // signed — otherwise the first party (contractor) marks the whole
    // contract signed while the homeowner is still pending. A non-terminal
    // signing is a no-op here; `contractSignedAt` stays null so the read path
    // keeps showing live per-signer progress until everyone has signed.
    // see entities/proposals/DOCS.md#contract-events-from-zoho
    if (event === 'completed') {
      const status = await contractService.getSigningStatus(signingRequestId)
      if (!isEnvelopeFullySigned(status)) {
        return
      }
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
