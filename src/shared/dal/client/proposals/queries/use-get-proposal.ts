import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/helpers'

export function useGetProposal(proposalId: string) {
  const trpc = useTRPC()
  return useQuery(trpc.proposalRouter.getProposal.queryOptions({ proposalId }))
}
