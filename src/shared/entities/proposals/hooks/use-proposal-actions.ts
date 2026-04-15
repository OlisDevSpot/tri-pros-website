import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

export function useProposalActions() {
  const trpc = useTRPC()
  const { invalidateProposal } = useInvalidation()

  const deleteProposal = useMutation(trpc.proposalsRouter.crud.deleteProposal.mutationOptions({
    onSuccess: () => invalidateProposal(),
    onError: () => toast.error('Failed to delete proposal'),
  }))

  const duplicateProposal = useMutation(trpc.proposalsRouter.crud.duplicateProposal.mutationOptions({
    onSuccess: () => {
      invalidateProposal()
      toast.success('Proposal duplicated')
    },
    onError: () => toast.error('Failed to duplicate proposal'),
  }))

  const updateProposal = useMutation(trpc.proposalsRouter.crud.updateProposal.mutationOptions({
    onSuccess: () => {
      invalidateProposal()
    },
    onError: () => toast.error('Failed to update proposal'),
  }))

  return { deleteProposal, duplicateProposal, updateProposal }
}
