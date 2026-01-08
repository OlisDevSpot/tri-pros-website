import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/helpers'

export function useSendProposalEmail() {
  const queryClient = useQueryClient()

  const trpc = useTRPC()
  return useMutation(trpc.proposalRouter.sendProposalEmail.mutationOptions({
    onSuccess: ({ proposal }) => {
      queryClient.invalidateQueries(trpc.proposalRouter.getProposal.queryOptions({ proposalId: proposal.id }))
    },
  }))
}
