'use client'

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

export function useMeetingActions() {
  const trpc = useTRPC()
  const { invalidateMeeting } = useInvalidation()

  const deleteMeeting = useMutation(
    trpc.meetingsRouter.delete.mutationOptions({
      onSuccess: () => {
        invalidateMeeting()
        toast.success('Meeting deleted')
      },
      onError: () => toast.error('Failed to delete meeting'),
    }),
  )

  const duplicateMeeting = useMutation(
    trpc.meetingsRouter.duplicate.mutationOptions({
      onSuccess: () => {
        invalidateMeeting()
        toast.success('Meeting duplicated')
      },
      onError: () => toast.error('Failed to duplicate meeting'),
    }),
  )

  const updateOutcome = useMutation(
    trpc.meetingsRouter.update.mutationOptions({
      onSuccess: () => {
        invalidateMeeting()
        toast.success('Outcome updated')
      },
      onError: () => toast.error('Failed to update outcome'),
    }),
  )

  const updateScheduledFor = useMutation(
    trpc.meetingsRouter.update.mutationOptions({
      onSuccess: () => {
        invalidateMeeting()
        toast.success('Scheduled date updated')
      },
      onError: () => toast.error('Failed to update scheduled date'),
    }),
  )

  return { deleteMeeting, duplicateMeeting, updateOutcome, updateScheduledFor }
}
