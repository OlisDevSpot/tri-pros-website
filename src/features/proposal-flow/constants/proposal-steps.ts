import type { ProposalStep } from '@/features/proposal-flow/types'
import type { UserRole } from '@/shared/constants/enums'
import { Funding } from '@/features/proposal-flow/ui/components/proposal/funding'
import { NextSteps } from '@/features/proposal-flow/ui/components/proposal/next-steps'
import { ProjectOverview } from '@/features/proposal-flow/ui/components/proposal/project-overview'
import { RelatedProjects } from '@/features/proposal-flow/ui/components/proposal/related-projects'
import { ScopeOfWork } from '@/features/proposal-flow/ui/components/proposal/scope-of-work'
import { TrustedContractor } from '@/features/proposal-flow/ui/components/proposal/trusted-contractor'

export const proposalSteps = [
  {
    title: 'Overview',
    shortLabel: 'Overview',
    accessor: 'project-overview',
    description: 'Project overview',
    Component: ProjectOverview,
    roles: ['homeowner', 'agent'],
  },
  {
    title: 'Trusted contractor',
    shortLabel: 'Contractor',
    accessor: 'about-tri-pros',
    description: 'About Tri Pros Remodeling',
    Component: TrustedContractor,
    roles: ['homeowner', 'agent'],
  },
  {
    title: 'Past results',
    shortLabel: 'Results',
    accessor: 'related-projects',
    description: 'View similar completed projects from our portfolio',
    Component: RelatedProjects,
    roles: ['homeowner', 'agent'],
  },
  {
    title: 'Scope of work',
    shortLabel: 'Scope',
    accessor: 'scope-of-work',
    description: 'Scope of Work',
    Component: ScopeOfWork,
    roles: ['homeowner', 'agent'],
  },
  {
    title: 'Funding',
    shortLabel: 'Funding',
    accessor: 'funding',
    description: 'Funding',
    Component: Funding,
    roles: ['homeowner', 'agent'],
  },
  {
    title: 'Next steps',
    shortLabel: 'Next steps',
    accessor: 'agreement',
    description: 'Proposal delivery and contract signing',
    Component: NextSteps,
    roles: ['homeowner', 'agent'],
  },
] as const satisfies ProposalStep<Record<string, any>>[]

export function generateProposalSteps(userRole: UserRole) {
  return proposalSteps.filter((step) => {
    const roles = step.roles as UserRole[]
    return roles.includes(userRole)
  })
}

export type ProposalAccessor = typeof proposalSteps[number]['accessor']
