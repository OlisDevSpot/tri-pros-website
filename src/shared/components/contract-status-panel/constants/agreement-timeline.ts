export const AGREEMENT_STEPS = [
  {
    key: 'proposal-created',
    label: 'Proposal Created',
    description: 'Your personalized proposal has been prepared',
  },
  {
    key: 'agreement-drafted',
    label: 'Agreement Drafted',
    description: 'A formal agreement has been generated for review',
  },
  {
    key: 'contractor-accepted',
    label: 'Accepted by Contractor',
    description: 'Our team has reviewed and signed the agreement',
  },
  {
    key: 'homeowner-accepted',
    label: 'Accepted by Homeowner',
    description: 'You have signed the agreement — project is confirmed',
  },
] as const

export type AgreementStepKey = typeof AGREEMENT_STEPS[number]['key']
