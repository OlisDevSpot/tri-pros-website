'use client'

import type { useCustomerEditForm } from '@/features/customer-pipelines/hooks/use-customer-edit-form'

import { PencilIcon } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'

interface Props {
  editForm: ReturnType<typeof useCustomerEditForm>
}

export function ProfileEditActions({ editForm }: Props) {
  if (!editForm.canEdit) {
    return null
  }

  if (editForm.isEditing) {
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        <Button size="sm" variant="outline" onClick={editForm.handleSave} disabled={editForm.isPending}>
          {editForm.isPending ? 'Saving...' : 'Save'}
        </Button>
        <Button size="sm" variant="ghost" onClick={editForm.handleCancel} disabled={editForm.isPending}>
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <Button size="sm" variant="outline" className="shrink-0" onClick={() => editForm.startEditing()}>
      <PencilIcon className="mr-1.5 h-3.5 w-3.5" />
      Edit
    </Button>
  )
}
