import type { ProposalStep } from '@/features/proposal-flow/types'
import type { UserRole } from '@/shared/db/types/users'
import { AgreementLink } from '@/features/proposal-flow/ui/components/proposal/agreement-link'
import { Funding } from '@/features/proposal-flow/ui/components/proposal/funding'
import { ProjectOverview } from '@/features/proposal-flow/ui/components/proposal/project-overview'
import { RelatedProjects } from '@/features/proposal-flow/ui/components/proposal/related-projects'
import { ScopeOfWork } from '@/features/proposal-flow/ui/components/proposal/scope-of-work'
import { SendProposalLink } from '@/features/proposal-flow/ui/components/proposal/send-proposal-link'
import { TrustedContractor } from '@/features/proposal-flow/ui/components/proposal/trusted-contractor'

export const proposalSteps = [
  {
    title: 'Project Overview',
    accessor: 'project-overview',
    description: 'Project overview',
    Component: ProjectOverview,
    roles: ['homeowner', 'agent'],
  },
  {
    title: 'Trusted Contractor',
    accessor: 'about-tri-pros',
    description: 'About Tri Pros Remodeling',
    Component: TrustedContractor,
    roles: ['homeowner', 'agent'],
  },
  {
    title: 'Past Results',
    accessor: 'related-projects',
    description: 'View similar completed projects from our portfolio',
    Component: RelatedProjects,
    roles: ['homeowner', 'agent'],
  },
  {
    title: 'Scope of Work',
    accessor: 'scope-of-work',
    description: 'Scope of Work',
    Component: ScopeOfWork,
    roles: ['homeowner', 'agent'],
  },
  {
    title: 'Funding',
    accessor: 'funding',
    description: 'Funding',
    Component: Funding,
    roles: ['homeowner', 'agent'],
  },
  {
    title: 'Send Proposal',
    accessor: 'send-proposal',
    description: 'Send proposal link to homeowner',
    Component: SendProposalLink,
    roles: ['agent'],
  },
  {
    title: 'Agreement Link',
    accessor: 'agreement-link',
    description: 'Agreement Link',
    Component: AgreementLink,
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
