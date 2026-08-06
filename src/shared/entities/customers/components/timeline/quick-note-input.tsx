'use client'

import type { EditNoteValues } from '@/shared/entities/customer-notes/schemas/edit-note-schema'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { useCustomerNoteActions } from '@/shared/entities/customer-notes/hooks/use-customer-note-actions'
import { editNoteSchema } from '@/shared/entities/customer-notes/schemas/edit-note-schema'

interface Props {
  customerId: string
  onSuccess: () => void
}

export function QuickNoteInput({ customerId, onSuccess }: Props) {
  const form = useForm<EditNoteValues>({
    resolver: zodResolver(editNoteSchema),
    defaultValues: { content: '' },
  })

  const { createNote } = useCustomerNoteActions(customerId)

  function handleAddNote(values: EditNoteValues) {
    createNote.mutate(
      { customerId, content: values.content },
      {
        onSuccess: () => {
          form.reset()
          onSuccess()
        },
      },
    )
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      form.handleSubmit(handleAddNote)()
    }
  }

  return (
    <form className="space-y-2" onSubmit={form.handleSubmit(handleAddNote)}>
      <Textarea
        className="min-h-[64px] resize-none text-sm"
        disabled={createNote.isPending}
        onKeyDown={handleKeyDown}
        placeholder="Add a note..."
        rows={2}
        {...form.register('content')}
      />
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-muted-foreground">⌘⏎ to add</span>
        <Button
          disabled={createNote.isPending || !form.watch('content')?.trim()}
          size="sm"
          type="submit"
        >
          {createNote.isPending ? 'Adding...' : 'Add note'}
        </Button>
      </div>
    </form>
  )
}
