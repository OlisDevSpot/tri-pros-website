import { useMutation } from '@tanstack/react-query'

import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

export function useSetCashInDeal() {
  const { invalidateProposal } = useInvalidation()

  const trpc = useTRPC()
  return useMutation(trpc.proposalsRouter.funding.setCashInDeal.mutationOptions({
    onSuccess: (data) => {
      invalidateProposal({ proposalId: data.id })
    },
  }))
}
