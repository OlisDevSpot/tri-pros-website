'use client'

import type { JSX } from 'react'
import type { EntityActionConfig } from '@/shared/components/entity-actions/types'
import type { CustomerNoteWithAuthor } from '@/shared/entities/customers/types'

import { useMemo } from 'react'

import { useSession } from '@/shared/domains/auth/client'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { NOTE_ACTIONS } from '@/shared/entities/customer-notes/constants/note-actions'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { useCustomerNoteActions } from './use-customer-note-actions'

interface Args {
  customerId: string
  onEdit: (note: CustomerNoteWithAuthor) => void
}

interface Result {
  actions: EntityActionConfig<CustomerNoteWithAuthor>[]
  DeleteConfirmDialog: () => JSX.Element
  /**
   * Author-or-admin gate — mirrors `assertNoteAuthorOrAdmin` (server enforces
   * the same rule). The render site (timeline row) applies this per-note to
   * decide whether to mount the actions menu at all, rather than filtering
   * inside the memoized `actions` array below.
   */
  canManage: (note: CustomerNoteWithAuthor) => boolean
}

export function useCustomerNoteActionConfigs({ customerId, onEdit }: Args): Result {
  const ability = useAbility()
  const { data: session } = useSession()
  const { deleteNote } = useCustomerNoteActions(customerId)
  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: 'Delete note',
    message: 'This permanently deletes the note. This cannot be undone.',
  })

  const currentUserId = session?.user?.id
  const isAdmin = ability.can('manage', 'all')

  const actions = useMemo((): EntityActionConfig<CustomerNoteWithAuthor>[] => {
    return [
      {
        action: NOTE_ACTIONS.edit,
        onAction: note => onEdit(note),
      },
      {
        action: NOTE_ACTIONS.delete,
        onAction: async (note) => {
          if (!(await confirmDelete())) {
            return
          }
          deleteNote.mutate({ id: note.id })
        },
        isLoading: deleteNote.isPending,
      },
    ]
  }, [confirmDelete, deleteNote, onEdit])

  const canManage = (note: CustomerNoteWithAuthor) =>
    isAdmin || (!!currentUserId && note.authorId === currentUserId)

  return { actions, DeleteConfirmDialog, canManage }
}
