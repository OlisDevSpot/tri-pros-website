'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

export function useCustomerNoteActions(customerId: string) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const { cross } = useInvalidation()
  const invalidate = () => qc.invalidateQueries(cross.customerProfile(customerId))

  const createNote = useMutation(
    trpc.customerNotesRouter.crud.create.mutationOptions({
      onSuccess: () => invalidate(),
      onError: err => toast.error(err.message ?? 'Failed to add note'),
    }),
  )
  const updateNote = useMutation(
    trpc.customerNotesRouter.crud.update.mutationOptions({
      onSuccess: () => invalidate(),
      onError: err => toast.error(err.message ?? 'Failed to update note'),
    }),
  )
  const deleteNote = useMutation(
    trpc.customerNotesRouter.crud.delete.mutationOptions({
      onSuccess: () => {
        invalidate()
        toast.success('Note deleted')
      },
      onError: err => toast.error(err.message ?? 'Failed to delete note'),
    }),
  )

  return { createNote, updateNote, deleteNote }
}
