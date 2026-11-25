import { PROPOSAL_REFUSALS } from '@/shared/modules/proposals/core/constants/proposal-refusals'

export const SEND_REFUSAL_COPY: Record<string, string> = {
  [PROPOSAL_REFUSALS.notSendable]: 'This proposal can’t be sent in its current state.',
  [PROPOSAL_REFUSALS.customerEmailMissing]: 'Add the customer’s email to send.',
}
