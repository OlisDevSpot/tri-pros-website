import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/helpers'

export function useUpdateProposal() {
  const queryClient = useQueryClient()

  const trpc = useTRPC()
  return useMutation(trpc.proposalRouter.updateProposal.mutationOptions({
    onSuccess: (data) => {
      queryClient.invalidateQueries(trpc.proposalRouter.getProposal.queryOptions({ proposalId: data.id }))
      queryClient.invalidateQueries(trpc.proposalRouter.getProposals.queryOptions())
    },
  }))
}
