'use client'

import type { EditNoteValues } from '@/shared/entities/customer-notes/schemas/edit-note-schema'
import type { TimelineEvent } from '@/shared/entities/customers/types/timeline'

import { zodResolver } from '@hookform/resolvers/zod'
import { formatDistanceToNow } from 'date-fns'
import { ArrowRightIcon, ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { EntityActionMenu } from '@/shared/components/entity-actions/ui/entity-action-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { useCustomerNoteActionConfigs } from '@/shared/entities/customer-notes/hooks/use-customer-note-action-configs'
import { useCustomerNoteActions } from '@/shared/entities/customer-notes/hooks/use-customer-note-actions'
import { editNoteSchema } from '@/shared/entities/customer-notes/schemas/edit-note-schema'
import { TIMELINE_EVENT_CONFIG } from '@/shared/entities/customers/constants/timeline-event-config'
import { formatTimelineDate } from '@/shared/entities/customers/lib/format-timeline-date'
import { noteFromTimelineEvent } from '@/shared/entities/customers/lib/timeline-note-shape'

interface Props {
  event: TimelineEvent
  customerId: string
  isExpanded: boolean
  onToggle: (id: string) => void
  onOpenMeeting: (meetingId: string) => void
}

export function TimelineEventItem({ event, customerId, isExpanded, onToggle, onOpenMeeting }: Props) {
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)

  const form = useForm<EditNoteValues>({
    resolver: zodResolver(editNoteSchema),
    defaultValues: { content: '' },
  })

  const { updateNote } = useCustomerNoteActions(customerId)
  const { actions: noteActions, DeleteConfirmDialog, canManage } = useCustomerNoteActionConfigs({
    customerId,
    onEdit: (note) => {
      form.reset({ content: note.content })
      setEditingNoteId(note.id)
    },
  })

  const config = TIMELINE_EVENT_CONFIG[event.type]
  const Icon = config.icon
  const metadata = event.metadata ?? {}
  const relativeTime = formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })
  const absoluteDate = formatTimelineDate(event.timestamp)

  const viewCount = typeof metadata.count === 'number' ? metadata.count : undefined
  const title = event.type === 'proposal_viewed' && viewCount && viewCount > 1
    ? `${event.title} (viewed ${viewCount}×)`
    : event.title

  const note = noteFromTimelineEvent(event, customerId)
  const canManageNote = note !== null && canManage(note)
  const isEditingNote = note !== null && editingNoteId === note.id
  // The note's text IS the row header: a snippet when collapsed, the full body
  // when expanded (so it reads once, never duplicated below). While editing we
  // keep the header a snippet and let the textarea own the full content.
  const showFullTitle = isExpanded && !isEditingNote

  const meetingIdRaw = metadata.meetingId
  const meetingId = typeof meetingIdRaw === 'string' || typeof meetingIdRaw === 'number'
    ? String(meetingIdRaw)
    : undefined
  const isNavigable = event.entityType === 'meeting' || event.entityType === 'proposal'
  const hasMetaBadges = (typeof metadata.trade === 'string' && metadata.trade.length > 0)
    || (typeof metadata.value === 'number' && metadata.value > 0)

  function handleEditSubmit(values: EditNoteValues) {
    if (!note) {
      return
    }
    updateNote.mutate(
      { id: note.id, data: { content: values.content } },
      { onSuccess: () => setEditingNoteId(null) },
    )
  }

  return (
    <div
      className={`group/row relative -ml-3 rounded-lg py-1.5 pl-10 pr-1.5 transition-colors ${isExpanded ? 'bg-muted/50' : 'hover:bg-muted/40'}`}
    >
      <span
        className={`absolute left-3 top-1 grid size-5.5 place-items-center rounded-full border border-muted-foreground/25 bg-background ${config.color}`}
      >
        <Icon className="size-3.5" />
        <span className="sr-only">{config.label}</span>
      </span>

      <button
        aria-expanded={isExpanded}
        className="flex w-full items-start gap-2 text-left"
        onClick={() => onToggle(event.id)}
        type="button"
      >
        <span className={`min-w-0 flex-1 text-sm text-foreground ${showFullTitle ? (note ? 'whitespace-pre-wrap' : '') : 'truncate'}`}>
          {title}
        </span>
        {/* Meta rides in a first-line-height box (h-5 = the text-sm line box),
            top-aligned with the title. Because the box height is fixed and the
            button is always items-start, the date + chevron stay on the title's
            first line in every state — collapsed, expanded, single- or
            multi-line — instead of shifting when the row grows. */}
        <span className="flex h-5 shrink-0 items-center gap-2">
          {isNavigable && (
            <ArrowRightIcon className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100" />
          )}
          <span className="text-xs text-muted-foreground" title={absoluteDate}>
            {relativeTime}
          </span>
          <ChevronDownIcon
            className={`size-3.5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2 border-t border-border/60 pt-2 text-sm">
          {note
            ? (
                <>
                  {isEditingNote && (
                    <form className="space-y-2" onSubmit={form.handleSubmit(handleEditSubmit)}>
                      <Textarea
                        className="min-h-16 resize-none text-sm"
                        rows={3}
                        {...form.register('content')}
                      />
                      {form.formState.errors.content && (
                        <p className="text-xs text-destructive">{form.formState.errors.content.message}</p>
                      )}
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => setEditingNoteId(null)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Cancel
                        </Button>
                        <Button disabled={updateNote.isPending} size="sm" type="submit">
                          {updateNote.isPending ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </form>
                  )}

                  {/* Author byline sits at the bottom; the note body is the row
                      header above, so the content is never rendered twice. The
                      action menu trails the author + date as one coherent group
                      (rather than stranded at the far edge), which reads cleanly
                      on the narrow mobile column. */}
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar className="size-5 shrink-0">
                      <AvatarImage src={note.authorImage ?? undefined} />
                      <AvatarFallback className="text-[10px]">
                        {(note.authorName ?? 'System').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-xs font-medium text-foreground">
                      {note.authorName ?? 'System'}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{absoluteDate}</span>
                    {canManageNote && (
                      <div className="shrink-0">
                        <EntityActionMenu actions={noteActions} entity={note} mode="compact" />
                      </div>
                    )}
                  </div>

                  {canManageNote && <DeleteConfirmDialog />}
                </>
              )
            : (
                <>
                  {event.description && (
                    <p className="text-xs text-muted-foreground">{event.description}</p>
                  )}
                  {hasMetaBadges && (
                    <div className="flex flex-wrap gap-2">
                      {typeof metadata.trade === 'string' && metadata.trade && (
                        <span className="text-xs text-muted-foreground">{`Trade: ${metadata.trade}`}</span>
                      )}
                      {typeof metadata.value === 'number' && metadata.value > 0 && (
                        <span className="text-xs text-muted-foreground">{`$${metadata.value.toLocaleString()}`}</span>
                      )}
                    </div>
                  )}
                  {meetingId && (
                    <Button
                      className="h-auto p-0 text-xs"
                      onClick={() => onOpenMeeting(meetingId)}
                      size="sm"
                      variant="link"
                    >
                      Open in Meetings →
                    </Button>
                  )}
                </>
              )}
        </div>
      )}
    </div>
  )
}
