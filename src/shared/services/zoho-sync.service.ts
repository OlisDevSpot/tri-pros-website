import type { AttachFile } from './providers/zoho-sign/client'
import type { ProposalContext } from './providers/zoho-sign/lib/documents/types'
import type { ZohoContractStatus, ZohoRequestStatus } from './providers/zoho-sign/types'
import { zohoSignClient } from './providers/zoho-sign/client'
import { dedupeSignerStatuses } from './providers/zoho-sign/lib/dedupe-signer-statuses'
import { assembleEnvelope } from './providers/zoho-sign/lib/documents/assemble-envelope'
import { sanitizeFilename } from './providers/zoho-sign/lib/sanitize-filename'

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

interface CreateEnvelopeResult {
  requestId: string
  status: string
  documentIds: string[]
}

interface DraftResult {
  requestId: string
  status: string
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

/**
 * ACL facade between contracts.service.ts (internal, domain logic) and the
 * Zoho Sign provider. No ScopedContext, no DAL imports — pure
 * domain-to-provider bridge.
 */
function createZohoSyncService() {
  return {
    /** Delegates to assembleEnvelope (registry path — multi-template mergesend). */
    async createEnvelope(ctx: ProposalContext): Promise<CreateEnvelopeResult> {
      return assembleEnvelope(ctx)
    },

    /**
     * Legacy path: single-template createdocument + file attach.
     * Cleans up on attach failure so QStash retry doesn't inherit a
     * half-built envelope.
     */
    async createLegacyDraft(
      templateId: string,
      body: object,
      files: AttachFile[],
    ): Promise<DraftResult> {
      const { requestId, status } = await zohoSignClient.createFromTemplate(templateId, body, false)

      if (files.length > 0) {
        try {
          await zohoSignClient.attachFiles(requestId, files)
        }
        catch (attachErr) {
          await zohoSignClient.deleteRequest(requestId).catch(() => {})
          throw attachErr
        }
      }

      return { requestId, status }
    },

    /** Submit a draft for signing. */
    async submitForSigning(requestId: string): Promise<void> {
      await zohoSignClient.submit(requestId)
    },

    /** Recall (cancel) an in-progress signing request. */
    async recallRequest(requestId: string): Promise<void> {
      await zohoSignClient.recall(requestId)
    },

    /** Recall with silent error swallowing (best-effort). */
    async recallRequestSilent(requestId: string): Promise<void> {
      await zohoSignClient.recall(requestId).catch(() => {})
    },

    /** Delete a draft or recalls+deletes an in-progress request. */
    async deleteRequest(requestId: string): Promise<boolean> {
      return zohoSignClient.deleteRequest(requestId)
    },

    /** Delete with silent error swallowing (best-effort cleanup). */
    async deleteRequestSilent(requestId: string): Promise<void> {
      await zohoSignClient.deleteRequest(requestId).catch(() => {})
    },

    /** Fetch signing status and dedupe signer actions by role. */
    async getRequestStatus(requestId: string): Promise<ZohoContractStatus> {
      const data = await zohoSignClient.getRequest(requestId)
      const req = data.requests
      if (!req) {
        throw new Error(`Zoho Sign status check returned no request for ${requestId}`)
      }

      return {
        requestId: req.request_id,
        requestStatus: req.request_status as ZohoRequestStatus,
        signerStatuses: dedupeSignerStatuses(req.actions ?? []),
      }
    },

    /** Re-exported from provider for caller convenience. */
    sanitizeFilename,
  }
}

export type ZohoSyncService = ReturnType<typeof createZohoSyncService>
export const zohoSyncService = createZohoSyncService()
