'use client'

import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Eye } from 'lucide-react'

import { useTRPC } from '@/trpc/helpers'

interface Props {
  proposalId: string
}

export function ProposalViewBadge({ proposalId }: Props) {
  const trpc = useTRPC()
  const { data } = useQuery(
    trpc.proposalsRouter.delivery.getProposalViews.queryOptions({ proposalId }),
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
