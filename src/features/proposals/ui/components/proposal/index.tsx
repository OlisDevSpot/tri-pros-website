import { proposalSteps } from '@/features/proposals/constants/proposal-steps'

export { BasicInfo } from './basic-info'
export { Heading } from './heading'
export { ProjectOverview } from './project-overview'
export { RelatedProjects } from './related-projects'

export function Proposal() {
  return (
    <div className="h-full overflow-auto scroll-smooth">
      <div className="container p-0 lg:p-0 pr-8 py-10 space-y-20">
        {proposalSteps.map(step => (
          <div
            id={step.accessor}
            key={step.accessor}
          >
            {step.Component}
          </div>
        ))}
      </div>
    </div>
  )
}
