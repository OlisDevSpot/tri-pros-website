'use client'

import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import { CheckIcon, XIcon } from 'lucide-react'
import { InlineEditButton } from '@/shared/components/buttons/inline-edit-button'
import { Button } from '@/shared/components/ui/button'

interface Props {
  editForm: ReturnType<typeof useCustomerEditForm>
}

export function CustomerEditToggle({ editForm }: Props) {
  if (!editForm.canEdit) {
    return null
  }

  if (editForm.isEditing) {
    return (
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          aria-label="Save changes"
          className="size-9 shrink-0 rounded-full text-status-success-dot hover:bg-status-success-dot/15 hover:text-status-success-dot"
          disabled={editForm.isPending}
          onClick={editForm.handleSave}
          size="icon"
          variant="ghost"
        >
          <CheckIcon className="size-4" />
        </Button>
        <Button
          aria-label="Cancel editing"
          className="size-9 shrink-0 rounded-full text-foreground/60 hover:bg-foreground/10 hover:text-foreground"
          disabled={editForm.isPending}
          onClick={editForm.handleCancel}
          size="icon"
          variant="ghost"
        >
          <XIcon className="size-4" />
        </Button>
      </div>
    )
  }

  return <InlineEditButton ariaLabel="Edit customer" onClick={() => editForm.startEditing('name')} />
}
