import type { ProposalFormSchema } from '../schemas/form-schema'
import type { UserRole } from '@/shared/db/types/users'

export interface HomeownerInfo {
  name: string
  address: string
  city: string
  state: string
  zipCode: string
  email: string
  phone: string
  projectType: string
  fundingType: string
}

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
