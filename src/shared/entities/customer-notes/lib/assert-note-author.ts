import type { ScopedContext } from '@/shared/dal/server/types'
import type { CustomerNote } from '@/shared/db/schema/customer-notes'

import { ThrowableDalError } from '@/shared/dal/server/types'

/** Author + admins only. see ../DOCS.md#note-authorship */
export function assertNoteAuthorOrAdmin(note: CustomerNote, ctx: ScopedContext): void {
  const userId = ctx.session?.user.id
  const isAdmin = ctx.ability?.can('manage', 'all') ?? false
  if (isAdmin) {
    return
  }
  if (!userId || note.authorId !== userId) {
    throw new ThrowableDalError({ type: 'forbidden' })
  }
}
