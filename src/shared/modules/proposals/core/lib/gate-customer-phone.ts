// An agent sees a customer's number once one of their proposals is sent. Applied at the page's read, never inside
// getFullView: contracts, the PDF and the send verb read getFullView with an agent's context and need the raw number.
export function gateCustomerPhone<T extends { customer: { phone: string | null, hasSentProposal: boolean } | null }>(view: T, canSeeUngated: boolean): T {
  if (!view.customer || canSeeUngated || view.customer.hasSentProposal) {
    return view
  }
  return { ...view, customer: { ...view.customer, phone: null } }
}
