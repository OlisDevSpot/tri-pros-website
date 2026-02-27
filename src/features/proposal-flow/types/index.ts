import type { ProposalFormSchema } from '../schemas/form-schema'
import type { UserRole } from '@/shared/db/types/users'

export interface ProposalStep<P> {
  title: string
  roles: UserRole[]
  accessor: string
  description: string
  Component: (props: P) => React.ReactNode
}

export interface OverrideProposalValues {
  homeowner?: Partial<ProposalFormSchema['homeowner']>
  project?: Partial<ProposalFormSchema['project']>
  funding?: Partial<ProposalFormSchema['funding']>
}
