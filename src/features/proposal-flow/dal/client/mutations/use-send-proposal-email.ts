import { useMutation, useQueryClient } from '@tanstack/react-query'

import { invalidateProposal } from '@/shared/dal/client/invalidation'
import { useTRPC } from '@/trpc/helpers'

export function useSendProposalEmail() {
  const queryClient = useQueryClient()

  const trpc = useTRPC()
  return useMutation(trpc.proposalsRouter.delivery.sendProposalEmail.mutationOptions({
    onSuccess: ({ proposal }) => {
      invalidateProposal(queryClient, proposal.id)
    },
  }))
}
