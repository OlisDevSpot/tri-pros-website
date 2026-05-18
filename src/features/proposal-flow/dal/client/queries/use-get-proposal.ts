import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@/trpc/routers/app'
import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/helpers'

type TRPCClient = ReturnType<typeof useTRPC>

type GetProposalQueryOptions
  = Parameters<TRPCClient['proposalsRouter']['business']['getFullView']['queryOptions']>[1]

type RouterOutputs = inferRouterOutputs<AppRouter>
type GetProposalOutput = RouterOutputs['proposalsRouter']['business']['getFullView']

export function useGetProposal(proposalId: string, token?: string, options?: GetProposalQueryOptions) {
  const trpc = useTRPC()
  return useQuery(trpc.proposalsRouter.business.getFullView.queryOptions<GetProposalOutput>({ id: proposalId, token }, options as any))
}
