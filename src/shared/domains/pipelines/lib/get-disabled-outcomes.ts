/**
 * Returns a checker function that determines if a derived meeting outcome
 * should be disabled based on the meeting's proposal state.
 *
 * Derived outcomes become selectable when their condition is met:
 * - proposal_created: meeting has at least 1 proposal
 * - proposal_sent: meeting has at least 1 proposal with status 'sent'
 * - converted_to_project: meeting has at least 1 proposal with status 'approved'
 *
 * Note: SQL subquery values may arrive as strings ("0", "true", "false") — coerce before comparing.
 */
export function getOutcomeDisabledChecker(proposalState: {
  proposalCount: number | string | null
  hasSentProposal: boolean | string | null
  hasApprovedProposal: boolean | string | null
}): (status: string) => boolean {
  const count = Number(proposalState.proposalCount) || 0
  const hasSent = proposalState.hasSentProposal === true || proposalState.hasSentProposal === 'true'
  const hasApproved = proposalState.hasApprovedProposal === true || proposalState.hasApprovedProposal === 'true'

  return (status: string) => {
    switch (status) {
      case 'proposal_created':
        return count === 0
      case 'proposal_sent':
        return !hasSent
      case 'converted_to_project':
        return !hasApproved
      default:
        return false
    }
  }
}
