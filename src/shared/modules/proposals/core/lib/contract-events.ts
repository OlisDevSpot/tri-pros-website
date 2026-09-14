import type { ContractEvent } from '@/shared/constants/enums'
import type { ZohoContractStatus } from '@/shared/services/providers/zoho-sign/types'

/**
 * Zoho Sign webhook payload mapping + idempotency/notification/auto-approve
 * policies for contract events. see ../DOCS.md#contract-events-from-zoho
 */

// Zoho's actual payloads diverge from docs (docs: RequestCompleted; observed:
// RequestSigningSuccess). Both are accepted. NOTE: `RequestSigningSuccess`
// fires once PER SIGNER, not once per envelope — a two-party envelope emits it
// when the contractor signs while the homeowner is still pending. So mapping it
// to `completed` only expresses "a signing happened"; real completion is
// DERIVED from live signer statuses via `isEnvelopeFullySigned` before any
// terminal write. see ../DOCS.md#contract-events-from-zoho
const ZOHO_OP_TO_CONTRACT_EVENT: Record<string, ContractEvent> = {
  RequestViewed: 'viewed',
  RequestSigningSuccess: 'completed',
  RequestCompleted: 'completed',
  RequestRejected: 'declined',
  RequestDeclined: 'declined',
}

export function mapZohoOperationToContractEvent(op: string): ContractEvent | null {
  return ZOHO_OP_TO_CONTRACT_EVENT[op] ?? null
}

/**
 * Derives true envelope completion from live Zoho signer statuses.
 *
 * Zoho fires `RequestSigningSuccess` once per signer, so the per-signer event
 * alone can't tell us the envelope is done. The contract is "signed" only when
 * EVERY signer role has signed. The envelope's own `actions` define the
 * required set (Contractor + Homeowner, or Homeowner only), so we don't
 * hardcode roles — we require all present signers to be `SIGNED`. An empty
 * signer list (draft / no recipients) is never complete.
 * see ../DOCS.md#contract-events-from-zoho
 */
export function isEnvelopeFullySigned(status: ZohoContractStatus): boolean {
  const signers = status.signerStatuses
  if (signers.length === 0) {
    return false
  }
  return signers.every(signer => signer.status === 'SIGNED')
}

/** Column on `proposals` that records the timestamp for each contract event. */
export const contractEventColumn = {
  viewed: 'contractViewedAt',
  completed: 'contractSignedAt',
  declined: 'contractDeclinedAt',
} as const satisfies Record<ContractEvent, string>

/** see ../DOCS.md#contract-event-idempotency */
export const contractEventIdempotencyPolicy = {
  viewed: 'earliest-wins',
  completed: 'write-once',
  declined: 'write-once',
} as const satisfies Record<ContractEvent, 'earliest-wins' | 'write-once'>

export function shouldNotifyOnContractEvent(event: ContractEvent): boolean {
  return event === 'completed' || event === 'declined'
}

/** see ../DOCS.md#completed-auto-approves */
export function shouldAutoApproveOnContractEvent(event: ContractEvent): boolean {
  return event === 'completed'
}
