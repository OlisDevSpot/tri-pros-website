import type { ProposalFormSchema } from '../schemas/form-schema'

export function calculateProposalDiscounts(proposal: ProposalFormSchema) {
  const { funding } = proposal

  const totalDiscounts = funding.data.incentives.reduce((acc, cur) => {
    if (cur.type === 'discount') {
      return acc + cur.amount
    }

    return acc
  }, 0)

  return totalDiscounts
}
