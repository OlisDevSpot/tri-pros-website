import type { ProposalStep } from '@/features/proposal-flow/types'
import type { financingOptions } from '@/shared/constants/financing-options'
import type { UserRole } from '@/shared/db/types/users'
import {
  ProjectOverview,
  RelatedProjects,
  ScopeOfWork,
} from '@/features/proposal-flow/ui/components/proposal'
import { AgreementLink } from '@/features/proposal-flow/ui/components/proposal/agreement-link'
import { Funding } from '@/features/proposal-flow/ui/components/proposal/funding'
import { SendProposalLink } from '@/features/proposal-flow/ui/components/proposal/send-proposal-link'
import { TrustedContractor } from '@/features/proposal-flow/ui/components/proposal/trusted-contractor'

export const proposalSteps = [
  {
    title: 'Project Overview',
    accessor: 'project-overview',
    description: 'Project overview',
    Component: () => ProjectOverview(),
    roles: ['homeowner', 'agent'],
  },
  {
    title: 'Trusted Contractor',
    accessor: 'about-tri-pros',
    description: 'About Tri Pros Remodeling',
    Component: () => TrustedContractor(),
    roles: ['homeowner', 'agent'],
  },
  {
    title: 'Past Results',
    accessor: 'related-projects',
    description: 'View similar completed projects from our portfolio',
    Component: () => RelatedProjects(),
    roles: ['homeowner', 'agent'],
  },
  {
    title: 'Scope of Work',
    accessor: 'scope-of-work',
    description: 'Scope of Work',
    Component: () => ScopeOfWork(),
    roles: ['homeowner', 'agent'],
  },
  {
    title: 'Funding',
    accessor: 'funding',
    description: 'Funding',
    Component: ({ onPickFinancingOption }: { onPickFinancingOption?: (option: typeof financingOptions[keyof typeof financingOptions][number]) => void }) => Funding({ onPickFinancingOption }),
    roles: ['homeowner', 'agent'],
  },
  {
    title: 'Send Proposal',
    accessor: 'send-proposal',
    description: 'Send proposal link to homeowner',
    Component: ({ onClick }: { onClick?: () => void }) => SendProposalLink({ onClick }),
    roles: ['agent'],
  },
  {
    title: 'Agreement Link',
    accessor: 'agreement-link',
    description: 'Agreement Link',
    Component: ({ onClick }: { onClick?: () => void }) => AgreementLink({ onClick }),
    roles: ['homeowner'],
  },
] as const satisfies ProposalStep<Record<string, any>>[]

export function generateProposalSteps(userRole: UserRole) {
  return proposalSteps.filter((step) => {
    const roles = step.roles as UserRole[]
    return roles.includes(userRole)
  })
}

export type ProposalAccessor = typeof proposalSteps[number]['accessor']
export const overrideSections: ProposalAccessor[] = ['funding', 'send-proposal', 'agreement-link']
