import type { ContractEvent } from '@/shared/constants/enums'

/**
 * Zoho Sign webhook payload mapping + idempotency/notification/auto-approve
 * policies for contract events. see ../DOCS.md#contract-events-from-zoho
 */

// Zoho's actual payloads diverge from docs (docs: RequestCompleted; observed:
// RequestSigningSuccess). Both are accepted. Confirmed via live test 2026-05-04.
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
