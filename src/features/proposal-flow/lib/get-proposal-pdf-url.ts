/** Relative URL for the token-gated proposal PDF route (same-origin). */
export function getProposalPdfUrl(proposalId: string, token: string): string {
  return `/api/proposals/${proposalId}/pdf?token=${encodeURIComponent(token)}`
}
