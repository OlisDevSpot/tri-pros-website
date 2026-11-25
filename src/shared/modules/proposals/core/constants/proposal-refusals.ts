// Reasons the proposal DAL and service give when they refuse a write; the client matches on them.
export const PROPOSAL_REFUSALS = {
  frozen: 'proposal_frozen',
  invalidCashDown: 'invalid_cash_down',
  depositOverCap: 'deposit_over_cap',
  notSendable: 'proposal_not_sendable',
  customerEmailMissing: 'customer_email_missing',
} as const
