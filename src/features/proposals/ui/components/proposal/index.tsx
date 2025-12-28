import { motion } from 'motion/react'
import { proposalSteps } from '@/features/proposals/constants/proposal-steps'
import { Heading } from './heading'

export { Heading } from './heading'
export { ProjectOverview } from './project-overview'
export { RelatedProjects } from './related-projects'
export { ScopeOfWork } from './scope-of-work'

export function Proposal() {
  return (
    <div className="h-full overflow-auto scroll-smooth">
      <div className="container p-0 lg:p-0 pr-8 py-10 space-y-20">
        <Heading />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-20"
        >
          {proposalSteps.map(step => (
            <div
              id={step.accessor}
              key={step.accessor}
            >
              {step.Component()}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
