'use client'

import type { JSX } from 'react'
import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { CustomerNoteWithAuthor } from '@/shared/entities/customers/types'

import { useMemo } from 'react'

import { useAbility } from '@/shared/domains/permissions/client'
import { subject } from '@/shared/domains/permissions/subject'
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
   * The author rule, tested on the note: the render site mounts the actions menu only on notes the
   * reader may change, rather than filtering inside the memoized `actions` array below.
   */
  canManage: (note: CustomerNoteWithAuthor) => boolean
}

export function useCustomerNoteActionConfigs({ customerId, onEdit }: Args): Result {
  const ability = useAbility()
  const { deleteNote } = useCustomerNoteActions(customerId)
  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: 'Delete note',
    message: 'This permanently deletes the note. This cannot be undone.',
  })

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

  const canManage = (note: CustomerNoteWithAuthor) => ability.can('update', subject('CustomerNote', note))

  return { actions, DeleteConfirmDialog, canManage }
}
