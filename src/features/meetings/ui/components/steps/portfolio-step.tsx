'use client'

import type { MeetingFlowContext } from '@/features/meetings/types'
import { useQuery } from '@tanstack/react-query'
import { PortfolioCard } from '@/features/meetings/ui/components/steps/portfolio-card'
import { EmptyState } from '@/shared/components/states/empty-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { useTRPC } from '@/trpc/helpers'

interface PortfolioStepProps {
  flowContext: MeetingFlowContext
}

export function PortfolioStep({ flowContext }: PortfolioStepProps) {
  const trpc = useTRPC()

  const scopeIds = flowContext.flowState?.tradeSelections?.flatMap(
    t => t.selectedScopes.map(s => s.id),
  ) ?? []

  const portfolioQuery = useQuery(
    trpc.meetingsRouter.getPortfolioForMeeting.queryOptions({ scopeIds }),
  )

  if (portfolioQuery.isLoading) {
    return <LoadingState description="Finding projects that match your selections..." title="Loading portfolio" />
  }

  const projects = portfolioQuery.data ?? []

  if (projects.length === 0) {
    return (
      <EmptyState
        description="Portfolio projects will appear here once they are added."
        title="No portfolio projects available yet"
      />
    )
  }

  return (
    <div className="space-y-8">
      {/* Intro */}
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Our past work</h2>
        <p className="text-sm text-muted-foreground">
          Real projects we&apos;ve completed — similar to what you have in mind.
        </p>
      </div>

      {/* Project list */}
      <div className="space-y-6">
        {projects.map(project => (
          <PortfolioCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  )
}
