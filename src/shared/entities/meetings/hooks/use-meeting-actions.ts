'use client'

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { SET_BY_NOT_INTERNAL } from '@/shared/entities/meetings/constants/set-by-not-internal'
import { useTRPC } from '@/trpc/helpers'

export function useMeetingActions() {
  const trpc = useTRPC()
  const { invalidateMeeting } = useInvalidation()

  const deleteMeeting = useMutation(
    trpc.meetingsRouter.crud.delete.mutationOptions({
      onSuccess: () => {
        invalidateMeeting()
        toast.success('Meeting deleted')
      },
      onError: () => toast.error('Failed to delete meeting'),
    }),
  )

  const duplicateMeeting = useMutation(
    trpc.meetingsRouter.crud.duplicate.mutationOptions({
      onSuccess: () => {
        invalidateMeeting()
        toast.success('Meeting duplicated')
      },
      onError: err => toast.error(err.message === SET_BY_NOT_INTERNAL.reason ? SET_BY_NOT_INTERNAL.message : 'Failed to duplicate meeting'),
    }),
  )

  const updateOutcome = useMutation(
    trpc.meetingsRouter.crud.update.mutationOptions({
      onSuccess: () => {
        invalidateMeeting()
        toast.success('Outcome updated')
      },
      onError: () => toast.error('Failed to update outcome'),
    }),
  )

  const updateScheduledFor = useMutation(
    trpc.meetingsRouter.crud.update.mutationOptions({
      onSuccess: () => {
        invalidateMeeting()
        toast.success('Scheduled date updated')
      },
      onError: () => toast.error('Failed to update scheduled date'),
    }),
  )

  const updateConfirmation = useMutation(
    trpc.meetingsRouter.crud.update.mutationOptions({
      onSuccess: () => {
        invalidateMeeting()
        toast.success('Confirmation updated')
      },
      onError: () => toast.error('Failed to update confirmation'),
    }),
  )

  const setOutcomeWithReason = useMutation(
    trpc.meetingsRouter.business.setOutcomeWithReason.mutationOptions({
      onSuccess: () => {
        invalidateMeeting()
        toast.success('Outcome updated')
      },
      onError: () => toast.error('Failed to update outcome'),
    }),
  )

  const rescheduleMeeting = useMutation(
    trpc.meetingsRouter.business.rescheduleMeeting.mutationOptions({
      onSuccess: () => {
        invalidateMeeting()
        toast.success('Meeting rescheduled')
      },
      onError: err => toast.error(err.message === SET_BY_NOT_INTERNAL.reason ? SET_BY_NOT_INTERNAL.message : err.message || 'Failed to reschedule meeting'),
    }),
  )

  const updateSetter = useMutation(
    trpc.meetingsRouter.crud.update.mutationOptions({
      onSuccess: () => {
        invalidateMeeting()
        toast.success('Setter updated')
      },
      onError: err => toast.error(err.message === SET_BY_NOT_INTERNAL.reason ? SET_BY_NOT_INTERNAL.message : 'Failed to update setter'),
    }),
  )

  return { deleteMeeting, duplicateMeeting, updateOutcome, updateScheduledFor, updateConfirmation, setOutcomeWithReason, rescheduleMeeting, updateSetter }
}
