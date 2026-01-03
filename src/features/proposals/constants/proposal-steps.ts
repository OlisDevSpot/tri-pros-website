import type { ProposalStep } from '@/features/proposals/types'
import type { financingOptions } from '@/shared/constants/financing-options'
import {
  ProjectOverview,
  RelatedProjects,
  ScopeOfWork,
} from '@/features/proposals/ui/components/proposal'
import { AgreementLink } from '../ui/components/proposal/agreement-link'
import { Funding } from '../ui/components/proposal/funding'
import { TrustedContractor } from '../ui/components/proposal/trusted-contractor'

export const proposalSteps = [
  {
    title: 'Project Overview',
    accessor: 'project-overview',
    description: 'Project overview',
    Component: () => ProjectOverview(),
  },
  {
    title: 'Trusted Contractor',
    accessor: 'about-tri-pros',
    description: 'About Tri Pros Remodeling',
    Component: () => TrustedContractor(),
  },
  {
    title: 'Past Results',
    accessor: 'related-projects',
    description: 'View similar completed projects from our portfolio',
    Component: () => RelatedProjects(),
  },
  {
    title: 'Scope of Work',
    accessor: 'scope-of-work',
    description: 'Scope of Work',
    Component: () => ScopeOfWork(),
  },
  {
    title: 'Funding',
    accessor: 'funding',
    description: 'Funding',
    Component: ({ onPickFinancingOption }: { onPickFinancingOption?: (option: typeof financingOptions[keyof typeof financingOptions][number]) => void }) => Funding({ onPickFinancingOption }),
  },
  {
    title: 'Agreement Link',
    accessor: 'agreement-link',
    description: 'Agreement Link',
    Component: ({ onClick }: { onClick?: () => void }) => AgreementLink({ onClick }),
  },
] as const satisfies ProposalStep<Record<string, any>>[]
