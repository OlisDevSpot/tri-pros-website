import type { ProposalStatus } from '@/shared/constants/enums'

// see ../DOCS.md#proposal-lock-ladder

/**
 * THE canonical lock ladder for proposals. Business logic defined ONCE here;
 * every call site (DAL gates, tRPC locks, UI disabling/affordances) derives
 * from these helpers — never ad-hoc field checks.
 *
 * An envelope, once created, is immutable evidence of what will be signed;
 * to change the proposal, the envelope must be killed first. Envelope
 * creation is always a manual agent decision ("Send Proposal" never
 * auto-creates one), so an existing envelope MEANS the agent deliberately
 * materialized this proposal into a signing package.
 */
export type ProposalLockState
  = 'unlocked' // no envelope — freely editable (the common case)
    | 'draft-locked' // draft envelope exists — editable only after discarding it
    | 'inflight-locked' // contract sent, awaiting signature — recall to edit
    | 'terminal-locked' // approved / signed / declined — permanent; changes need a new proposal

export interface ProposalLockSignals {
  status: ProposalStatus
  contractEnvelopeId: string | null
  contractSentAt: string | null
  contractSignedAt: string | null
  contractDeclinedAt: string | null
}

/**
 * Derives the lock tier. Order matters: terminal signals shadow the earlier
 * tiers (a declined contract still has `contractSentAt` set; a signed one
 * still has `contractEnvelopeId`).
 */
export function getProposalLockState(proposal: ProposalLockSignals): ProposalLockState {
  if (proposal.status === 'approved' || proposal.contractSignedAt != null || proposal.contractDeclinedAt != null) {
    return 'terminal-locked'
  }
  if (proposal.contractSentAt != null) {
    return 'inflight-locked'
  }
  if (proposal.contractEnvelopeId != null) {
    return 'draft-locked'
  }
  return 'unlocked'
}

/** True when the proposal's user-authored content may not be modified. */
export function isProposalFrozen(proposal: ProposalLockSignals): boolean {
  return getProposalLockState(proposal) !== 'unlocked'
}

/**
 * Proposal fields locked while frozen. Everything a user can author is here;
 * lifecycle fields (status, sentAt/approvedAt, signing ids, contract
 * timestamps, QB refs) stay writable — webhooks, auto-approve, and the
 * contract flows must keep flowing on a frozen proposal.
 */
export const frozenProposalLockedFields = [
  'label',
  'formMetaJSON',
  'projectJSON',
  'fundingJSON',
  'financeOptionId',
  'meetingId',
] as const

/** True when an update payload touches any user-authored (locked) field. */
export function touchesFrozenLockedFields(data: Record<string, unknown>): boolean {
  return frozenProposalLockedFields.some(field => field in data)
}
