import type { UseQueryOptions } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/helpers'

export function useGetProposals(options?: UseQueryOptions) {
  const trpc = useTRPC()
  return useQuery(trpc.proposalRouter.getProposals.queryOptions(undefined, options as any))
}
