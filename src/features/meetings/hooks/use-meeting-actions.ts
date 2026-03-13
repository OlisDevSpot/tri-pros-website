'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useTRPC } from '@/trpc/helpers'

export function useMeetingActions() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries(trpc.meetingsRouter.getAll.queryFilter())
  }

  const deleteMeeting = useMutation(
    trpc.meetingsRouter.delete.mutationOptions({
      onSuccess: () => {
        invalidate()
        toast.success('Meeting deleted')
      },
      onError: () => toast.error('Failed to delete meeting'),
    }),
  )

  const duplicateMeeting = useMutation(
    trpc.meetingsRouter.duplicate.mutationOptions({
      onSuccess: () => {
        invalidate()
        toast.success('Meeting duplicated')
      },
      onError: () => toast.error('Failed to duplicate meeting'),
    }),
  )

  const updateStatus = useMutation(
    trpc.meetingsRouter.update.mutationOptions({
      onSuccess: () => {
        invalidate()
        toast.success('Status updated')
      },
      onError: () => toast.error('Failed to update status'),
    }),
  )

  return { deleteMeeting, duplicateMeeting, updateStatus }
}
