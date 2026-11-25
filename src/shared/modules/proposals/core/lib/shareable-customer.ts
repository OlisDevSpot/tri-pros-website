/** `hasSentProposal` only unlocks the agent's view of the phone; it is internal state and never leaves to a share link. */
export function toShareableCustomer<C extends { hasSentProposal: boolean }>(customer: C | null): Omit<C, 'hasSentProposal'> | null {
  if (!customer) {
    return null
  }
  const { hasSentProposal: _hasSentProposal, ...shareable } = customer
  return shareable
}
