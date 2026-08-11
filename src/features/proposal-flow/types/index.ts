import type { ProposalFormSchema } from '../schemas/form-schema'
import type { UserRole } from '@/shared/constants/enums'

export interface ProposalStep<P> {
  title: string
  roles: UserRole[]
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
