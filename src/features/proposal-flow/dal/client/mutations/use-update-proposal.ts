import { useMutation } from '@tanstack/react-query'

import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

export function useUpdateProposal() {
  const { invalidateProposal } = useInvalidation()

  const trpc = useTRPC()
  return useMutation(trpc.proposalsRouter.crud.updateProposal.mutationOptions({
    onSuccess: (data) => {
      invalidateProposal({ proposalId: data.id })
    },
  }))
}
