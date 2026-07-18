// see ../DOCS.md#final-tcp-derived

/**
 * THE freeze predicate for the whole proposal — content, financials, and
 * agreement context alike.
 *
 * Frozen iff the contract is in flight or completed — i.e. actually SENT for
 * signing — not when a draft envelope merely exists (every "Send Proposal"
 * pre-creates a Zoho draft envelope, so keying on `signingRequestId` froze
 * proposals at the wrong lifecycle stage). `contractSentAt` is the persisted
 * proxy for "envelope exists AND is beyond Zoho draft": stamped only by
 * `sendSigningRequest`/`resendSigningRequest`, cleared on recall/discard.
 * Declined and completed contracts keep their stamp — deliberately frozen;
 * renegotiation happens on a new proposal, never by editing the sent shape.
 *
 * Single source for the DAL gates (`replaceProposalIncentives`, the
 * `update.before` content gate in the server-spec), the agreement-context
 * lock (`applyEnvelopeContext`), and UI disabling.
 */
export function isProposalFrozen(proposal: { contractSentAt: string | null }): boolean {
  return proposal.contractSentAt != null
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
