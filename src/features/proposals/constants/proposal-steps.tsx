import type { ProposalStep } from '@/features/proposals/types'
import { CompanySocialButtons } from '@/components/company-social-buttons'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { ProcessOverview } from '@/features/landing/ui/components/about/process-overview'
import { BasicInfo } from '@/features/proposals/ui/components/proposal/basic-info'
import { ProjectOverview } from '@/features/proposals/ui/components/proposal/project-overview'
import { RelatedProjects } from '@/features/proposals/ui/components/proposal/related-projects'

export const proposalSteps: ProposalStep[] = [
  {
    title: 'Basic Info',
    accessor: 'basic-info',
    description: 'Basic Info',
    Component: <BasicInfo />,
  },
  {
    title: 'Project Overview',
    accessor: 'project-overview',
    description: 'Project Overview',
    Component: <ProjectOverview />,
  },
  {
    title: 'About Tri Pros Remodeling',
    accessor: 'about-tri-pros',
    description: 'About Tri Pros Remodeling',
    Component: (
      <div className="flex flex-col items-center gap-4">
        <div className="w-[180px] h-[50px] shrink-0">
          <Logo />
        </div>
        <CompanySocialButtons className="lg:flex-row" />
        <ProcessOverview />
      </div>
    ),
  },
  {
    title: 'Related Projects',
    accessor: 'related-projects',
    description: 'View similar completed projects from our portfolio',
    Component: <RelatedProjects projectType="energy-efficient" />,
  },
  {
    title: 'Scope of Work',
    accessor: 'scope-of-work',
    description: 'Scope of Work',
    Component: <>Scope of Work </>,
  },
  {
    title: 'Funding',
    accessor: 'funding',
    description: 'Funding',
    Component: <>Funding </>,
  },
  {
    title: 'Optional Addons',
    accessor: 'optional-addons',
    description: 'These go well with the scope of work you have selected',
    Component: <>Optional Addons</>,
  },
  {
    title: 'Agreement Link',
    accessor: 'agreement-link',
    description: 'Agreement Link',
    Component: <Button type="button">Agreement Link</Button>,
  },
]
