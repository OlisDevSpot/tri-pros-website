import type { ProposalFormSchema } from '../schemas/form-schema'

export interface ProposalStep<P> {
  title: string
  shortLabel: string
  accessor: string
  description: string
  Component: (props: P) => React.ReactNode
}

/**
 * Partial form-state seed applied over `baseDefaultValues` (section-shallow).
 * Derived from `ProposalFormSchema` — never hand-mirrored.
 */
export interface OverrideProposalValues {
  priceDisplayMode?: ProposalFormSchema['priceDisplayMode']
  project?: Partial<ProposalFormSchema['project']>
  funding?: Partial<ProposalFormSchema['funding']>
}

export type ProposalContextTab = 'customer' | 'visit'
