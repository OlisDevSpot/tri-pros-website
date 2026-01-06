import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/helpers'

export function useGetProposals() {
  const trpc = useTRPC()
  return useQuery(trpc.proposalRouter.getProposals.queryOptions())
}
