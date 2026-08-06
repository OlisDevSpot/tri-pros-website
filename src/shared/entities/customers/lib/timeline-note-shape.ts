import type { CustomerNoteWithAuthor } from '@/shared/entities/customers/types'
import type { TimelineEvent } from '@/shared/entities/customers/types/timeline'

/**
 * `note_added` events carry the note's fields flattened onto the
 * `TimelineEvent` (title = content, metadata = author fields — see
 * `build-timeline-events.ts`). Reconstructs the `CustomerNoteWithAuthor`
 * shape so a timeline row can reuse the shared note action-configs
 * (`canManage` / `EntityActionMenu` / inline edit) unmodified. Returns `null`
 * for non-note events.
 */
export function noteFromTimelineEvent(event: TimelineEvent, customerId: string): CustomerNoteWithAuthor | null {
  if (event.type !== 'note_added' || !event.entityId) {
    return null
  }

  const metadata = event.metadata ?? {}

  return {
    id: event.entityId,
    customerId,
    content: event.title,
    authorId: typeof metadata.authorId === 'string' ? metadata.authorId : null,
    authorName: typeof metadata.authorName === 'string' ? metadata.authorName : null,
    authorImage: typeof metadata.authorImage === 'string' ? metadata.authorImage : null,
    createdAt: event.timestamp,
    updatedAt: event.timestamp,
  }
}
