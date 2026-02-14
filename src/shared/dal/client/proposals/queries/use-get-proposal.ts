import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@/trpc/routers/app'
import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/helpers'

type TRPCClient = ReturnType<typeof useTRPC>

type GetProposalQueryOptions
  = Parameters<TRPCClient['proposalRouter']['getProposal']['queryOptions']>[1]

type RouterOutputs = inferRouterOutputs<AppRouter>
type GetProposalOutput = RouterOutputs['proposalRouter']['getProposal']

export function useGetProposal(proposalId: string, options?: GetProposalQueryOptions) {
  const trpc = useTRPC()
  return useQuery(trpc.proposalRouter.getProposal.queryOptions<GetProposalOutput>({ proposalId }, options as any))
}
