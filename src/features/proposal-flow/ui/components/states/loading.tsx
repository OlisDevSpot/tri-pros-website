import { LoadingState } from '@/shared/components/states/loading-state'

export function ProposalFlowLoadingState() {
  return (
    <div className="h-full w-full flex gap-4 justify-between">
      <nav className="h-50 border border-primary/20 rounded-xl w-(--sidebar-width) shrink-0"></nav>
      <LoadingState title="Loading Proposal Flow" description="This might take a few seconds" />
    </div>
  )
}
