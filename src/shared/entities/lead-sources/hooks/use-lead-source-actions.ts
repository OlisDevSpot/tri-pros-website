'use client'

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

export function useLeadSourceActions() {
  const trpc = useTRPC()
  const { invalidateLeadSource } = useInvalidation()

  const createLeadSource = useMutation(
    trpc.leadSourcesRouter.create.mutationOptions({
      onSuccess: () => {
        invalidateLeadSource()
        toast.success('Lead source created')
      },
      onError: err => toast.error(err.message || 'Failed to create lead source'),
    }),
  )

  const updateLeadSource = useMutation(
    trpc.leadSourcesRouter.update.mutationOptions({
      onSuccess: () => {
        invalidateLeadSource()
        toast.success('Lead source updated')
      },
      onError: err => toast.error(err.message || 'Failed to update lead source'),
    }),
  )

  const toggleActive = useMutation(
    trpc.leadSourcesRouter.update.mutationOptions({
      onSuccess: (updated) => {
        invalidateLeadSource()
        toast.success(updated.isActive ? 'Activated' : 'Deactivated')
      },
      onError: err => toast.error(err.message || 'Failed to toggle'),
    }),
  )

  const rotateToken = useMutation(
    trpc.leadSourcesRouter.rotateToken.mutationOptions({
      onSuccess: () => {
        invalidateLeadSource()
        toast.success('Intake token rotated — share the new URL with the partner')
      },
      onError: err => toast.error(err.message || 'Failed to rotate token'),
    }),
  )

  const duplicateLeadSource = useMutation(
    trpc.leadSourcesRouter.duplicate.mutationOptions({
      onSuccess: () => {
        invalidateLeadSource()
        toast.success('Duplicated')
      },
      onError: err => toast.error(err.message || 'Failed to duplicate'),
    }),
  )

  const deleteLeadSource = useMutation(
    trpc.leadSourcesRouter.delete.mutationOptions({
      onSuccess: () => {
        invalidateLeadSource()
        toast.success('Lead source deleted')
      },
      onError: err => toast.error(err.message || 'Failed to delete'),
    }),
  )

  return {
    createLeadSource,
    updateLeadSource,
    toggleActive,
    rotateToken,
    duplicateLeadSource,
    deleteLeadSource,
  }
}
