import { motion } from 'motion/react'
import { ProposalCard } from '@/features/proposal-flow/ui/components/proposal/proposal-card'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { useGetProposals } from '@/shared/dal/client/proposals/queries/use-get-proposals'

export function PastProposalsView() {
  const proposals = useGetProposals()

  if (proposals.isLoading) {
    return (
      <LoadingState
        title="Loading Past Proposals"
        description="This might take a few seconds"
        className="bg-card"
      />
    )
  }

  if (!proposals.data) {
    return (
      <ErrorState
        title="Error: Could not load past proposals"
        description="Please try again"
        className="bg-card"
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ delay: 0.25, duration: 0.25 }}
      className="w-full h-full flex flex-col gap-4"
    >
      {' '}
      <Card className="h-full w-full">
        <CardHeader className="shrink-0">
          <CardTitle>Past Proposals</CardTitle>
          <CardDescription>Your past proposals</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 grow min-h-0 overflow-auto">
          <div className="flex flex-col gap-4">
            {proposals.data?.map(proposal => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
