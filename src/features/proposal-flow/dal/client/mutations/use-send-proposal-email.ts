import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/helpers'

export function useSendProposalEmail() {
  const queryClient = useQueryClient()

  const trpc = useTRPC()
  return useMutation(trpc.proposalsRouter.sendProposalEmail.mutationOptions({
    onSuccess: ({ proposal }) => {
      queryClient.invalidateQueries(trpc.proposalsRouter.getProposal.queryOptions({ proposalId: proposal.id }))
    },
  }))
}
