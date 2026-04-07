import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { invalidateProposal } from '@/shared/dal/client/invalidation'
import { useTRPC } from '@/trpc/helpers'

export function useProposalActions() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const deleteProposal = useMutation(trpc.proposalsRouter.deleteProposal.mutationOptions({
    onSuccess: () => invalidateProposal(queryClient),
    onError: () => toast.error('Failed to delete proposal'),
  }))

  const duplicateProposal = useMutation(trpc.proposalsRouter.duplicateProposal.mutationOptions({
    onSuccess: () => {
      invalidateProposal(queryClient)
      toast.success('Proposal duplicated')
    },
    onError: () => toast.error('Failed to duplicate proposal'),
  }))

  const updateProposal = useMutation(trpc.proposalsRouter.updateProposal.mutationOptions({
    onSuccess: () => {
      invalidateProposal(queryClient)
    },
    onError: () => toast.error('Failed to update proposal'),
  }))

  return { deleteProposal, duplicateProposal, updateProposal }
}
