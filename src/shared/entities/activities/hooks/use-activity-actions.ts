'use client'

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

export function useActivityActions() {
  const trpc = useTRPC()
  const { invalidateActivities } = useInvalidation()

  const deleteActivity = useMutation(
    trpc.scheduleRouter.activities.delete.mutationOptions({
      onSuccess: () => {
        toast.success('Activity deleted')
        invalidateActivities()
      },
      onError: () => toast.error('Failed to delete activity'),
    }),
  )

  const completeActivity = useMutation(
    trpc.scheduleRouter.activities.complete.mutationOptions({
      onSuccess: () => {
        toast.success('Activity marked complete')
        invalidateActivities()
      },
      onError: () => toast.error('Failed to complete activity'),
    }),
  )

  const updateActivity = useMutation(
    trpc.scheduleRouter.activities.update.mutationOptions({
      onSuccess: () => {
        toast.success('Activity updated')
        invalidateActivities()
      },
      onError: () => toast.error('Failed to update activity'),
    }),
  )

  return { deleteActivity, completeActivity, updateActivity }
}
