'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/helpers'

export function useProposalMedia(proposalId: string) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const listKey = trpc.proposalsRouter.media.list.queryOptions({ proposalId }).queryKey
  const invalidate = () => queryClient.invalidateQueries({ queryKey: listKey })

  const getUploadUrl = useMutation(trpc.proposalsRouter.media.getUploadUrl.mutationOptions())
  const create = useMutation(trpc.proposalsRouter.media.create.mutationOptions())
  const setVisibility = useMutation(trpc.proposalsRouter.media.setVisibility.mutationOptions({ onSuccess: invalidate }))
  const reorder = useMutation(trpc.proposalsRouter.media.reorder.mutationOptions({ onSuccess: invalidate }))
  const rename = useMutation(trpc.proposalsRouter.media.rename.mutationOptions({ onSuccess: invalidate }))
  const remove = useMutation(trpc.proposalsRouter.media.delete.mutationOptions({ onSuccess: invalidate }))
  const retryOptimization = useMutation(trpc.proposalsRouter.media.retryOptimization.mutationOptions({ onSuccess: invalidate }))

  return { getUploadUrl, create, setVisibility, reorder, rename, remove, retryOptimization, invalidate, listKey }
}
