import { useTRPC } from '@/trpc/helpers'
import { useQuery } from '@tanstack/react-query'

export function useGetProposal(proposalId: string) {
  const trpc = useTRPC()
  return useQuery(trpc.proposalRouter.getProposal.queryOptions({ proposalId }))
}
