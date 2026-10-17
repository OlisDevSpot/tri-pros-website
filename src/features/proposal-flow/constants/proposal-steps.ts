import type { ProposalStep } from '@/features/proposal-flow/types'
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
    accessor: 'overview',
    description: 'Project overview',
    Component: ProjectOverview,
  },
  {
    title: 'Trusted contractor',
    shortLabel: 'Contractor',
    accessor: 'contractor',
    description: 'About Tri Pros Remodeling',
    Component: TrustedContractor,
  },
  {
    title: 'Past results',
    shortLabel: 'Results',
    accessor: 'results',
    description: 'View similar completed projects from our portfolio',
    Component: RelatedProjects,
  },
  {
    title: 'Scope of work',
    shortLabel: 'Scope',
    accessor: 'scope',
    description: 'Scope of Work',
    Component: ScopeOfWork,
  },
  {
    title: 'Funding',
    shortLabel: 'Funding',
    accessor: 'funding',
    description: 'Funding',
    Component: Funding,
  },
  {
    title: 'Next steps',
    shortLabel: 'Next steps',
    accessor: 'next-steps',
    description: 'Proposal delivery and contract signing',
    Component: NextSteps,
  },
] as const satisfies ProposalStep<Record<string, any>>[]

export const proposalChapterIds = proposalSteps.map(step => step.accessor)

export type ProposalAccessor = typeof proposalSteps[number]['accessor']
