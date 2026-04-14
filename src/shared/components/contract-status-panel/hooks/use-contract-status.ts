import { useQuery } from '@tanstack/react-query'
import { useRef } from 'react'

import { useTRPC } from '@/trpc/helpers'

const MAX_DRAFT_POLL_ATTEMPTS = 10

export function useContractStatus(proposalId: string, token?: string, isSent?: boolean) {
  const trpc = useTRPC()
  const draftPollCountRef = useRef(0)

  const query = useQuery({
    ...trpc.proposalsRouter.contracts.getContractStatus.queryOptions({ proposalId, token }),
    refetchInterval: (query) => {
      const data = query.state.data
      const requestStatus = data?.requestStatus

      // Once signing is in-progress, fixed 30s polling (existing behavior)
      if (requestStatus === 'inprogress') {
        draftPollCountRef.current = 0
        return 30_000
      }

      // Draft arrived or terminal state — stop polling
      if (data) {
        draftPollCountRef.current = 0
        return false
      }

      // Proposal sent but no contract status yet — QStash job is creating the draft
      // Exponential backoff: 3s, 4.5s, 6.75s, 10s, 15s... (mirrors image optimization pattern)
      if (isSent && !data) {
        if (draftPollCountRef.current >= MAX_DRAFT_POLL_ATTEMPTS) {
          return false
        }
        draftPollCountRef.current++
        return Math.min(3000 * 1.5 ** (draftPollCountRef.current - 1), 30_000)
      }

      return false
    },
  })

  const isDraftSyncing = isSent && !query.data && draftPollCountRef.current > 0

  return { ...query, isDraftSyncing }
}
