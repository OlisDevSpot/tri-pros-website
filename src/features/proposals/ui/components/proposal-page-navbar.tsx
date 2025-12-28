import Link from 'next/link'
import { proposalSteps } from '@/features/proposals/constants/proposal-steps'

export function ProposalPageNavbar() {
  return (
    <div className="h-14 bg-foreground/20 shrink-0">
      <div className="h-full w-full flex">
        {proposalSteps.map(step => (
          <div
            key={step.accessor}
            className="flex-1"
          >
            <Link
              className="h-full w-full flex items-center justify-center hover:bg-foreground/40 transition"
              href={`#${step.accessor}`}
            >
              {step.title}
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
