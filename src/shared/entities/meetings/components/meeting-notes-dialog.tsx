'use client'

import type { EditNoteValues } from '@/shared/entities/customer-notes/schemas/edit-note-schema'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { EntityActionMenu } from '@/shared/components/entities/entity-actions/ui/entity-action-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { Button } from '@/shared/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { useCustomerNoteActionConfigs } from '@/shared/entities/customer-notes/hooks/use-customer-note-action-configs'
import { useCustomerNoteActions } from '@/shared/entities/customer-notes/hooks/use-customer-note-actions'
import { editNoteSchema } from '@/shared/entities/customer-notes/schemas/edit-note-schema'
import { QuickNoteInput } from '@/shared/entities/customers/components/timeline/quick-note-input'
import { formatTimelineDate } from '@/shared/entities/customers/lib/format-timeline-date'
import { INTERNAL_NOTE_FIELD, VISIT_NOTE_FIELD, VISIT_NOTE_MAX_LENGTH } from '@/shared/entities/meetings/constants/visit-note'
import { useTRPC } from '@/trpc/helpers'

interface Props {
  meetingId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MeetingNotesDialog({ meetingId, open, onOpenChange }: Props) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const ability = useAbility()
  const canReadInternalNotes = ability.can('read', 'CustomerNote')
  const canAddInternalNote = ability.can('create', 'CustomerNote')

  const meetingQuery = useQuery(trpc.meetingsRouter.reads.getByIdWithJoins.queryOptions({ id: meetingId }, { enabled: open }))
  const notesQuery = useQuery(trpc.meetingsRouter.reads.internalNotes.queryOptions({ meetingId }, { enabled: open && canReadInternalNotes }))

  const customerId = meetingQuery.data?.customerId ?? ''
  const savedVisitNote = meetingQuery.data?.visitNote ?? ''

  const [visitNote, setVisitNote] = useState<string | null>(null)
  const visitNoteValue = visitNote ?? savedVisitNote
  const isVisitNoteDirty = visitNoteValue.trim() !== savedVisitNote

  const saveVisitNote = useMutation(
    trpc.meetingsRouter.crud.update.mutationOptions({
      onSuccess: () => {
        setVisitNote(null)
        void qc.invalidateQueries(trpc.meetingsRouter.reads.getByIdWithJoins.queryFilter({ id: meetingId }))
        toast.success('Visit note saved')
      },
      onError: err => toast.error(err.message ?? 'Failed to save visit note'),
    }),
  )

  const { updateNote } = useCustomerNoteActions(customerId)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const form = useForm<EditNoteValues>({
    resolver: zodResolver(editNoteSchema),
    defaultValues: { content: '' },
  })
  const { actions: noteActions, DeleteConfirmDialog, canManage } = useCustomerNoteActionConfigs({
    customerId,
    onEdit: (note) => {
      form.reset({ content: note.content })
      setEditingNoteId(note.id)
    },
  })

  // The note hooks refresh the customer profile; the delete runs inside the shared action configs, so the
  // list refreshes off the mutation cache rather than a call-site callback.
  useEffect(() => {
    const keys = [
      trpc.customerNotesRouter.crud.create.mutationKey(),
      trpc.customerNotesRouter.crud.update.mutationKey(),
      trpc.customerNotesRouter.crud.delete.mutationKey(),
    ]
    return qc.getMutationCache().subscribe((event) => {
      const { mutation } = event
      if (event.type === 'updated' && event.action.type === 'success' && keys.some(key => mutation?.options.mutationKey?.join('.') === key.join('.'))) {
        void qc.invalidateQueries(trpc.meetingsRouter.reads.internalNotes.queryFilter({ meetingId }))
      }
    })
  }, [qc, trpc, meetingId])

  function handleEditSubmit(values: EditNoteValues) {
    if (!editingNoteId) {
      return
    }
    updateNote.mutate(
      { id: editingNoteId, data: { content: values.content } },
      { onSuccess: () => setEditingNoteId(null) },
    )
  }

  const notes = notesQuery.data ?? []

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Notes</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="meeting-visit-note">{VISIT_NOTE_FIELD.label}</Label>
          <Textarea
            className="min-h-16 resize-none text-sm"
            disabled={meetingQuery.isLoading}
            id="meeting-visit-note"
            maxLength={VISIT_NOTE_MAX_LENGTH}
            onChange={e => setVisitNote(e.target.value)}
            placeholder={VISIT_NOTE_FIELD.placeholder}
            rows={2}
            value={visitNoteValue}
          />
          <p className="text-xs text-muted-foreground">{VISIT_NOTE_FIELD.helper}</p>
          <div className="flex justify-end">
            <Button
              disabled={!isVisitNoteDirty || saveVisitNote.isPending}
              onClick={() => saveVisitNote.mutate({ id: meetingId, data: { visitNote: visitNoteValue.trim() || null } })}
              size="sm"
            >
              {saveVisitNote.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        {canReadInternalNotes && (
          <div className="space-y-3 border-t border-border/60 pt-4">
            <Label htmlFor={canAddInternalNote && customerId ? 'meeting-internal-note' : undefined}>{INTERNAL_NOTE_FIELD.label}</Label>
            <p className="text-xs text-muted-foreground">{INTERNAL_NOTE_FIELD.helper}</p>

            {notes.length === 0 && !notesQuery.isLoading && (
              <p className="text-sm text-muted-foreground">No internal notes yet.</p>
            )}

            <ul className="space-y-3">
              {notes.map((note) => {
                const isEditing = editingNoteId === note.id
                return (
                  <li className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm" key={note.id}>
                    {isEditing
                      ? (
                          <form className="space-y-2" onSubmit={form.handleSubmit(handleEditSubmit)}>
                            <Textarea
                              aria-label="Edit internal note"
                              className="min-h-16 resize-none text-sm"
                              rows={3}
                              {...form.register('content')}
                            />
                            {form.formState.errors.content && (
                              <p className="text-xs text-destructive">{form.formState.errors.content.message}</p>
                            )}
                            <div className="flex justify-end gap-2">
                              <Button onClick={() => setEditingNoteId(null)} size="sm" type="button" variant="ghost">
                                Cancel
                              </Button>
                              <Button disabled={updateNote.isPending} size="sm" type="submit">
                                {updateNote.isPending ? 'Saving...' : 'Save'}
                              </Button>
                            </div>
                          </form>
                        )
                      : <p className="whitespace-pre-wrap text-foreground">{note.content}</p>}

                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar className="size-5 shrink-0">
                        <AvatarImage src={note.authorImage ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {(note.authorName ?? 'System').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-xs font-medium text-foreground">{note.authorName ?? 'System'}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatTimelineDate(note.createdAt)}</span>
                      {canManage(note) && (
                        <div className="shrink-0">
                          <EntityActionMenu actions={noteActions} entity={note} mode="compact" />
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>

            {canAddInternalNote && customerId && (
              <QuickNoteInput
                customerId={customerId}
                id="meeting-internal-note"
                link={{ entityType: 'meeting', entityId: meetingId }}
                onSuccess={() => {}}
                placeholder={INTERNAL_NOTE_FIELD.placeholder}
              />
            )}
          </div>
        )}
      </DialogContent>
      <DeleteConfirmDialog />
    </Dialog>
  )
}
