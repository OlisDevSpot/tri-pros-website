import type { ScopedContext } from '@/shared/dal/server/types'
import type { CustomerNote } from '@/shared/db/schema/customer-notes'

import { ThrowableDalError } from '@/shared/dal/server/types'

/** Author + admins only. */
export function assertNoteAuthorOrAdmin(note: CustomerNote, ctx: ScopedContext): void {
  const { ability, userId } = ctx.actor
  const isAdmin = ability.can('manage', 'all')
  if (isAdmin) {
    return
  }
  if (!userId || note.authorId !== userId) {
    throw new ThrowableDalError({ type: 'forbidden' })
  }
}
