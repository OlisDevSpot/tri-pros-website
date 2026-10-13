import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { customerNoteServerSpec } from '@/shared/entities/customer-notes/lib/server-spec'

// Reach is the rules': a note is read through its customer, and edited or deleted by its author
// (`authorId` in the rule) or by a super-admin. The engine probes the customer before a create.
export const customerNoteCrud = createCrudDal(customerNoteServerSpec, () => ({
  hooks: {
    create: {
      // The author is whoever acts; an intake note has no user and keeps the author it was given (none).
      before: (input, ctx) => ({ ...input, authorId: ctx.actor.userId ?? input.authorId ?? null }),
    },
  },
}))
