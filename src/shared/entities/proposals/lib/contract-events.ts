import type { ContractEvent } from '@/shared/constants/enums'

/**
 * Maps Zoho Sign's raw `operation_type` string to our internal contract
 * event. Returns null for unrecognized types (accepted but no-oped).
 *
 * Zoho's actual payload values diverge from their docs. Both documented
 * and observed values are listed to be resilient. Confirmed via live
 * webhook test on 2026-05-04.
 */
const ZOHO_OP_TO_CONTRACT_EVENT: Record<string, ContractEvent> = {
  // Viewed — docs and observed both use this
  RequestViewed: 'viewed',
  // Completed — docs say RequestCompleted, actual payloads say RequestSigningSuccess
  RequestSigningSuccess: 'completed',
  RequestCompleted: 'completed',
  // Declined — docs say RequestRejected, may also appear as RequestDeclined
  RequestRejected: 'declined',
  RequestDeclined: 'declined',
}

export function mapZohoOperationToContractEvent(op: string): ContractEvent | null {
  return ZOHO_OP_TO_CONTRACT_EVENT[op] ?? null
}

/**
 * Column on `proposals` that records the timestamp for each contract event.
 * Drives both the write and the idempotency predicate.
 */
export const contractEventColumn = {
  viewed: 'contractViewedAt',
  completed: 'contractSignedAt',
  declined: 'contractDeclinedAt',
} as const satisfies Record<ContractEvent, string>

/**
 * Idempotency policy per event:
 *
 * - `viewed`: earliest-event wins (the first VIEW is the meaningful one;
 *   later views are noise).
 * - `completed`/`declined`: write-once. These are terminal events that
 *   fire exactly once per envelope; a duplicate delivery with a different
 *   timestamp is a Zoho retry, not a real second action — preserve the
 *   first stamp.
 */
export const contractEventIdempotencyPolicy = {
  viewed: 'earliest-wins',
  completed: 'write-once',
  declined: 'write-once',
} as const satisfies Record<ContractEvent, 'earliest-wins' | 'write-once'>

/** Events that should fan out to a notification when persisted. */
export function shouldNotifyOnContractEvent(event: ContractEvent): boolean {
  return event === 'completed' || event === 'declined'
}

/**
 * `completed` auto-promotes proposal status to `approved` and stamps
 * `approvedAt` (matching the manual approval flow). `declined` does NOT
 * flip status — customer-initiated declines are rare and almost always
 * recoverable, so the agent intervenes manually.
 */
export function shouldAutoApproveOnContractEvent(event: ContractEvent): boolean {
  return event === 'completed'
}
