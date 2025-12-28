import type { ProposalStep } from '@/features/proposals/types'
import { Button } from '@/components/ui/button'
import {
  ProjectOverview,
  RelatedProjects,
  ScopeOfWork,
} from '@/features/proposals/ui/components/proposal'
import { Funding } from '../ui/components/proposal/funding'
import { TrustedContractor } from '../ui/components/proposal/trusted-contractor'

export const proposalSteps: ProposalStep[] = [
  {
    title: 'Project Overview',
    accessor: 'project-overview',
    description: 'Project overview',
    Component: () => <ProjectOverview />,
  },
  {
    title: 'Trusted Contractor',
    accessor: 'about-tri-pros',
    description: 'About Tri Pros Remodeling',
    Component: () => <TrustedContractor />,
  },
  {
    title: 'Past Results',
    accessor: 'related-projects',
    description: 'View similar completed projects from our portfolio',
    Component: () => <RelatedProjects projectType="energy-efficient" />,
  },
  {
    title: 'Scope of Work',
    accessor: 'scope-of-work',
    description: 'Scope of Work',
    Component: () => <ScopeOfWork />,
  },
  {
    title: 'Funding',
    accessor: 'funding',
    description: 'Funding',
    Component: () => <Funding />,
  },
  {
    title: 'Agreement Link',
    accessor: 'agreement-link',
    description: 'Agreement Link',
    Component: () => <Button type="button">Agreement Link</Button>,
  },
]
