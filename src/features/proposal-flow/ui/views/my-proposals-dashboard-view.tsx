'use client'

import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Eye } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { useTRPC } from '@/trpc/helpers'

function ProposalViewBadge({ proposalId }: { proposalId: string }) {
  const trpc = useTRPC()
  const { data } = useQuery(
    trpc.proposalRouter.getProposalViews.queryOptions({ proposalId }),
  )

  if (!data || data.totalViews === 0) {
    return null
  }

  const lastSeen = data.lastViewedAt
    ? formatDistanceToNow(new Date(data.lastViewedAt), { addSuffix: true })
    : null

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Eye size={12} />
      {data.totalViews}
      {' '}
      {data.totalViews === 1 ? 'view' : 'views'}
      {lastSeen && (
        <>
          {' · '}
          Last seen
          {' '}
          {lastSeen}
        </>
      )}
    </span>
  )
}

export function MyProposalsDashboardView() {
  const trpc = useTRPC()
  const { data: proposals = [], isLoading } = useQuery(
    trpc.proposalRouter.getProposals.queryOptions(),
  )

  if (isLoading) {
    return (
      <div className="p-8 text-muted-foreground text-sm">Loading proposals…</div>
    )
  }

  if (proposals.length === 0) {
    return (
      <div className="p-8 text-muted-foreground text-sm">No proposals yet.</div>
    )
  }

  return (
    <div className="p-6 space-y-3">
      {proposals.map(proposal => (
        <div
          key={proposal.id}
          className="border rounded-xl p-4 flex items-center justify-between gap-4 bg-background"
        >
          <div className="space-y-0.5 min-w-0">
            <p className="font-medium text-foreground truncate">{proposal.label}</p>
            <ProposalViewBadge proposalId={proposal.id} />
          </div>
          <Badge
            variant={
              proposal.status === 'approved'
                ? 'default'
                : proposal.status === 'sent'
                  ? 'secondary'
                  : 'outline'
            }
            className="shrink-0"
          >
            {proposal.status}
          </Badge>
        </div>
      ))}
    </div>
  )
}
