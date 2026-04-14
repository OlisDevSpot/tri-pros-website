import { useQuery } from '@tanstack/react-query'

import { useTRPC } from '@/trpc/helpers'

export function useContractStatus(proposalId: string, token?: string) {
  const trpc = useTRPC()

  const query = useQuery({
    ...trpc.proposalsRouter.contracts.getContractStatus.queryOptions({ proposalId, token }),
    refetchInterval: (query) => {
      const status = query.state.data?.requestStatus
      if (status === 'inprogress') {
        return 30_000
      }
      return false
    },
  })

  return query
}
