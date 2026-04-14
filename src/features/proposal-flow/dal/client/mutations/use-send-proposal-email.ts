import { useMutation } from '@tanstack/react-query'

import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

export function useSendProposalEmail() {
  const { invalidateProposal } = useInvalidation()

  const trpc = useTRPC()
  return useMutation(trpc.proposalsRouter.delivery.sendProposalEmail.mutationOptions({
    onSuccess: ({ proposal }) => {
      invalidateProposal({ proposalId: proposal.id })
    },
  }))
}
